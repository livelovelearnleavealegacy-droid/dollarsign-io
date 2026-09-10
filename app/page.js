"use client";
import { useState, useRef, useCallback } from "react";
import {
  Upload, Download, PenTool, ChevronLeft, ChevronRight,
  Users, Plus, X, ArrowRight, FileText, Loader2,
  Search, Clock, LifeBuoy,
} from "lucide-react";
import FieldTag from "@/components/FieldTag";
import {
  FLAT_PRICE, MAX_SIGNERS, MAX_PAGES, SIGNER_COLORS, calcPrice, uid,
  FIELD_KINDS, FIELD_LABELS, EXPIRY_CHOICES, DEFAULT_EXPIRY_DAYS, DEFAULT_SIGNING_MODE,
  primaryBtn, iconBtn, chipBtn, inputStyle,
} from "@/lib/shared";

// Drawn inline rather than imported so the spinner can't depend on a
// particular lucide version shipping an Hourglass glyph. `.spin` is the
// existing 0.8s rotation in globals.css.
function Hourglass({ size = 22, color = "#8A8F98" }) {
  return (
    <svg
      className="spin" width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 2h14" />
      <path d="M5 22h14" />
      <path d="M7 2v4a5 5 0 0 0 5 5 5 5 0 0 0 5-5V2" />
      <path d="M7 22v-4a5 5 0 0 1 5-5 5 5 0 0 1 5 5v4" />
    </svg>
  );
}

// Above this, rendering is slow enough that silence reads as a hang, so
// the wait gets named instead of just spun at.
const LARGE_UPLOAD_BYTES = 4 * 1024 * 1024;

export default function Home() {
  const [step, setStep] = useState("landing"); // landing | editor
  const [pages, setPages] = useState([]);
  const [pageIdx, setPageIdx] = useState(0);
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [signers, setSigners] = useState([
    { id: uid(), name: "Signer 1", email: "", color: SIGNER_COLORS[0], isSelf: false },
    { id: uid(), name: "Signer 2", email: "", color: SIGNER_COLORS[1], isSelf: false },
  ]);
  const [activeSignerId, setActiveSignerId] = useState(null);
  const [fields, setFields] = useState([]);
  const [signingMode, setSigningMode] = useState(DEFAULT_SIGNING_MODE);
  const [expiresInDays, setExpiresInDays] = useState(DEFAULT_EXPIRY_DAYS);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  // { large } while a document is being rendered; null otherwise.
  const [preparing, setPreparing] = useState(null);
  // pageId -> true once that page image has actually painted.
  const [pageLoaded, setPageLoaded] = useState({});
  // Sticks around after the upload so page-to-page waits are explained too.
  const [isLargeDocument, setIsLargeDocument] = useState(false);

  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const addPageInputRef = useRef(null);

  const uploadPage = async (blob, mime, w, h, source) => {
    const formData = new FormData();
    formData.append("file", blob, `page.${mime.split("/")[1]}`);
    formData.append("width", w);
    formData.append("height", h);
    // Recorded against the page file itself, so the server can later
    // establish the link without taking the client's word for it.
    if (source?.sourceId) {
      formData.append("sourceId", source.sourceId);
      formData.append("sourcePage", String(source.sourcePage));
    }
    const res = await fetch("/api/pages", { method: "POST", body: formData });
    if (!res.ok) throw new Error("Failed to upload a page. Please try again.");
    const { id } = await res.json();
    return { id, src: `/api/pages/${id}`, w, h };
  };

  const fileToImagePage = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          uploadPage(file, file.type, img.naturalWidth, img.naturalHeight)
            .then((page) => resolve([page]))
            .catch(reject);
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Keeps the original PDF. Everything else about a page — the image the
  // editor and signing page display — is preview material once this
  // succeeds, because the finished document gets built by stamping the
  // real pages rather than redrawing pictures of them.
  //
  // Deliberately non-fatal: if this fails the pages simply carry no
  // source and take the old raster path, which still works.
  const uploadSource = async (file, pageCount) => {
    try {
      const formData = new FormData();
      formData.append("file", file, file.name || "document.pdf");
      formData.append("pageCount", String(pageCount));
      const res = await fetch("/api/sources", { method: "POST", body: formData });
      if (!res.ok) return null;
      const { id } = await res.json();
      return id || null;
    } catch {
      return null;
    }
  };

  const fileToPdfPages = async (file) => {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    // A fresh copy for pdf.js: it may take ownership of the buffer it is
    // handed, and the same File still has to be uploadable afterwards.
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;

    const sourceId = await uploadSource(file, pdf.numPages);

    // With the original kept, the rendered image only ever has to look
    // right on screen, so it is rendered smaller — a page that used to
    // cost ~450KB now costs a fraction of that. Without a source the
    // image IS the finished document, so it stays high-resolution.
    const scale = sourceId ? 1.25 : 2;
    const quality = sourceId ? 0.8 : 0.85;

    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport }).promise;

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      const uploaded = await uploadPage(blob, "image/jpeg", canvas.width, canvas.height,
        sourceId ? { sourceId, sourcePage: i } : null);
      pages.push(sourceId ? { ...uploaded, sourceId, sourcePage: i } : uploaded);
    }
    return pages;
  };

  const loadFiles = (fileList, cb, existingCount = 0) => {
    const files = Array.from(fileList);
    // Rendering happens in this tab, so a big PDF looks like a frozen
    // page unless something on screen says otherwise.
    const totalBytes = files.reduce((n, f) => n + (f.size || 0), 0);
    const large = totalBytes >= LARGE_UPLOAD_BYTES;
    if (large) setIsLargeDocument(true);
    setPreparing({ large });
    Promise.all(
      files.map((f) => (f.type === "application/pdf" ? fileToPdfPages(f) : fileToImagePage(f)))
    )
      .then((pageArrays) => {
        let newPages = pageArrays.flat();
        const total = existingCount + newPages.length;
        if (total > MAX_PAGES) {
          const allowed = Math.max(0, MAX_PAGES - existingCount);
          newPages = newPages.slice(0, allowed);
          alert(`This plan supports up to ${MAX_PAGES} pages. Only the first ${allowed} new page(s) were added.`);
        }
        cb(newPages);
      })
      .catch((err) => {
        console.error(err);
        alert("Something went wrong uploading your document. Please try again.");
      })
      .finally(() => setPreparing(null));
  };

  const onUpload = (e) => {
    if (!e.target.files?.length) return;
    // Seed the document name from the file so it's never blank, while
    // staying editable — "Lease.pdf" beats "ENV-84QTU2" in an inbox.
    const firstName = e.target.files[0]?.name || "";
    if (firstName && !documentName) {
      setDocumentName(firstName.replace(/\.[^.]+$/, "").slice(0, 120));
    }
    loadFiles(e.target.files, (newPages) => {
      setPages(newPages);
      setPageIdx(0);
      setActiveSignerId(signers[0].id);
      setStep("editor");
    }, 0);
  };

  const onAddPages = (e) => {
    if (!e.target.files?.length) return;
    loadFiles(e.target.files, (newPages) => setPages((p) => [...p, ...newPages]), pages.length);
  };

  const addSigner = () => {
    if (signers.length >= MAX_SIGNERS) {
      alert(`This plan supports up to ${MAX_SIGNERS} signers.`);
      return;
    }
    setSigners((s) => [...s, { id: uid(), name: `Signer ${s.length + 1}`, email: "", color: SIGNER_COLORS[s.length % SIGNER_COLORS.length], isSelf: false }]);
  };
  const removeSigner = (id) => {
    if (signers.length <= 1) return;
    setSigners((s) => s.filter((x) => x.id !== id));
    setFields((f) => f.filter((x) => x.signerId !== id));
    if (activeSignerId === id) setActiveSignerId(signers.find((s) => s.id !== id)?.id || null);
  };
  const renameSigner = (id, name) => setSigners((s) => s.map((x) => (x.id === id ? { ...x, name } : x)));
  const emailSigner = (id, email) => setSigners((s) => s.map((x) => (x.id === id ? { ...x, email } : x)));
  const toggleSelf = (id) => setSigners((s) => s.map((x) => ({ ...x, isSelf: x.id === id ? !x.isSelf : false })));

  // New fields land in the upper quartile rather than dead centre: a
  // tag that appears near the top of the page is visible without
  // scrolling, so people can see it arrive and drag it from there.
  const addField = (kind) => {
    if (!activeSignerId || !pages[pageIdx]) return;
    setFields((f) => [...f, { id: uid(), pageId: pages[pageIdx].id, signerId: activeSignerId, kind, x: 50, y: 22, value: null }]);
  };
  const markPageLoaded = useCallback((id) => {
    setPageLoaded((m) => (m[id] ? m : { ...m, [id]: true }));
  }, []);
  const dragField = useCallback((id, x, y) => {
    setFields((fs) => fs.map((f) => (f.id === id ? { ...f, x, y } : f)));
  }, []);
  const removeField = (id) => setFields((fs) => fs.filter((f) => f.id !== id));

  const price = calcPrice();
  const currentPage = pages[pageIdx];
  const pageFields = fields.filter((f) => f.pageId === currentPage?.id);
  // Sender email is required, not optional. Three things depend on it:
  // the completion notice, finding the document later, and voiding the
  // envelope — voiding in particular is impossible without it, since
  // controlling that address is the only proof of being the sender.
  const readyToCreate =
    pages.length > 0 && fields.length > 0 &&
    senderEmail.includes("@") &&
    signers.every((s) => s.name.trim() && (s.isSelf || s.email.includes("@")));

  // Create the envelope as a pending-payment draft, then hand off to a
  // real, hosted Stripe Checkout page. Nothing is emailed and nothing
  // is charged until Stripe's webhook confirms the payment actually
  // happened — see app/api/webhooks/stripe/route.js.
  const startCheckout = async () => {
    setSubmitting(true);
    setCheckoutError(null);
    try {
      const createRes = await fetch("/api/envelopes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName: senderName || "Someone",
          senderEmail: senderEmail || null,
          documentName: documentName || null,
          pages, signers, fields, signingMode, expiresInDays,
        }),
      });
      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.error || "Couldn't save the envelope.");
      }
      const { envelope } = await createRes.json();

      const checkoutRes = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ envelopeId: envelope.id }),
      });
      if (!checkoutRes.ok) {
        const err = await checkoutRes.json();
        throw new Error(err.error || "Couldn't start checkout.");
      }
      const { url } = await checkoutRes.json();
      window.location.href = url; // hand off to Stripe's hosted checkout page
    } catch (err) {
      setCheckoutError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "60vh" }}>
      {/* Rendering a PDF happens in this tab and can take a while. Without
          this the Upload button just goes quiet, which reads as broken. */}
      {preparing && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed", inset: 0, zIndex: 60, background: "rgba(255,255,255,0.94)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14,
            padding: 24, textAlign: "center",
          }}
        >
          <Hourglass size={34} color="var(--accent)" />
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, color: "var(--ink)" }}>
            Preparing your document…
          </div>
          {preparing.large && (
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, color: "#8A8F98", maxWidth: 340, lineHeight: 1.5 }}>
              This is a large file, so it takes a little longer. Please keep this tab open.
            </div>
          )}
        </div>
      )}

      {/* ---------- LANDING ---------- */}
      {step === "landing" && (
        <div>
          <div style={{ padding: "56px 24px 56px", textAlign: "center" }}>
            <div style={{ maxWidth: 560, margin: "0 auto" }}>
              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, letterSpacing: 1, color: "#8A8F98", margin: "0 0 34px" }}>
                Pay as you go. Sign with confidence.
              </p>
              <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: "clamp(30px,6vw,44px)", lineHeight: 1.12, margin: "0 0 16px", color: "var(--ink)" }}>
                Multi-Page. Multi-Signer.<br />One Envelope.
              </h1>
              <p style={{ fontSize: 16, color: "#5B5F6B", maxWidth: 440, lineHeight: 1.55, margin: "0 auto 32px" }}>
                No subscription. Upload your document, place your signer, date and text fields, pay and send.
              </p>
              <button onClick={() => fileInputRef.current.click()} style={{ ...primaryBtn, fontSize: 16, padding: "13px 26px", boxShadow: "var(--shadow)" }}>
                <Upload size={17} style={{ marginRight: 8 }} /> Upload Document
              </button>
              <input ref={fileInputRef} type="file" accept="image/*,application/pdf" multiple onChange={onUpload} style={{ display: "none" }} />
            </div>
          </div>

          <div style={{ maxWidth: 640, margin: "0 auto", padding: "8px 24px 48px" }}>
            <div style={{ background: "var(--card)", borderRadius: 12, boxShadow: "var(--shadow)", padding: "18px 20px", marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, letterSpacing: 1.5, color: "#8A8F98" }}>PRICING</span>
                <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 26, fontWeight: 700, color: "var(--ink)" }}>${FLAT_PRICE.toFixed(2)} <span style={{ fontSize: 16, fontWeight: 400, color: "#8A8F98" }}>per envelope</span></span>
              </div>
              <ul style={{ fontSize: 16, color: "#5B5F6B", lineHeight: 2, paddingLeft: 18, margin: 0 }}>
                <li>No subscription. Flat rate per envelope</li>
                <li>Up to {MAX_SIGNERS} signers</li>
                <li>Up to {MAX_PAGES} pages</li>
                <li>Unlimited signature, date, and text fields</li>
              </ul>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { icon: <FileText size={16} />, t: "Generous Capacity", d: `Up to ${MAX_PAGES} pages with up to ${MAX_SIGNERS} signers per envelope.` },
                { icon: <PenTool size={16} />, t: "Draw or Type", d: "Each person receives their own link to sign or type their name." },
                { icon: <Download size={16} />, t: "Yours to Keep", d: "Final document delivered to all signers by email. Documents recoverable indefinitely." },
                { icon: <Users size={16} />, t: "PCI Compliant", d: `Credit card processing done by Stripe. We never see your credit card information.` },
                { icon: <Search size={16} />, t: "Still a Real Document", d: "We sign your original PDF instead of a picture of it, so the finished file stays searchable, selectable, and small." },
                { icon: <Clock size={16} />, t: "Keeps Things Moving", d: "Automatic reminders, an optional expiry date, and signing either in order or all at once — your choice." },
              ].map((c, i) => (
                <div key={i} style={{ background: "var(--card)", borderRadius: 12, boxShadow: "var(--shadow)", padding: 16 }}>
                  <div style={{ color: "var(--accent)", marginBottom: 8 }}>{c.icon}</div>
                  <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 4, color: "var(--ink)" }}>{c.t}</div>
                  <div style={{ fontSize: 16, color: "#5B5F6B", lineHeight: 1.4 }}>{c.d}</div>
                </div>
              ))}
            </div>

            {/* Support is a feature here, not fine print. At $1.99 an
                envelope the only affordable support is the kind people
                never have to ask for, so the things that make it
                unnecessary are worth saying out loud. */}
            <div style={{ background: "var(--card)", borderRadius: 12, boxShadow: "var(--shadow)", padding: 16, marginTop: 16 }}>
              <div style={{ color: "var(--accent)", marginBottom: 8 }}><LifeBuoy size={16} /></div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 4, color: "var(--ink)" }}>
                Hassle-Free Support
              </div>
              <div style={{ fontSize: 16, color: "#5B5F6B", lineHeight: 1.45 }}>
                No account to create and nothing to cancel. Resend an invitation, fix a mistyped address, or look up a
                document you lost the link to — all yourself, in seconds. If something on our end goes wrong, tell us your
                tracking number and we&apos;ll make it right, no argument. Real people answer{" "}
                <a href="mailto:support@dollarsign.io" style={{ color: "#5B5F6B", textDecoration: "underline" }}>support@dollarsign.io</a>{" "}
                within two business days.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- EDITOR ---------- */}
      {step === "editor" && currentPage && (
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px 130px" }}>
          <input
            value={documentName}
            onChange={(e) => setDocumentName(e.target.value)}
            placeholder="Document name (shown to signers and in emails)"
            maxLength={120}
            style={{ ...inputStyle, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 10 }}
          />

          <div style={{ display: "flex", gap: 10, margin: "0 0 16px" }}>
            <input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Your name (shown to signers)" style={{ ...inputStyle, fontFamily: "'Plus Jakarta Sans', sans-serif" }} />
            <input value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} placeholder="Your email (required — for the completed document)" style={{ ...inputStyle, fontFamily: "'Plus Jakarta Sans', sans-serif" }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
            <button disabled={pageIdx === 0} onClick={() => setPageIdx((i) => i - 1)} style={{ ...iconBtn, opacity: pageIdx === 0 ? 0.3 : 1 }}><ChevronLeft size={18} /></button>
            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, color: "#5B5F6B" }}>page {pageIdx + 1} of {pages.length}</span>
            <button disabled={pageIdx === pages.length - 1} onClick={() => setPageIdx((i) => i + 1)} style={{ ...iconBtn, opacity: pageIdx === pages.length - 1 ? 0.3 : 1 }}><ChevronRight size={18} /></button>
            <button onClick={() => { if (pages.length >= MAX_PAGES) { alert(`This plan supports up to ${MAX_PAGES} pages.`); return; } addPageInputRef.current.click(); }} style={{ ...chipBtn, marginLeft: "auto", opacity: pages.length >= MAX_PAGES ? 0.4 : 1 }}><Plus size={13} /> Add page</button>
            <input ref={addPageInputRef} type="file" accept="image/*,application/pdf" multiple onChange={onAddPages} style={{ display: "none" }} />
          </div>

          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "var(--shadow)", padding: 12, marginBottom: 14 }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, letterSpacing: 1.5, color: "#8A8F98", marginBottom: 10 }}>SIGNERS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {signers.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div
                    onClick={() => setActiveSignerId(s.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 20, cursor: "pointer",
                      border: `1.5px solid ${s.color}`, background: activeSignerId === s.id ? s.color : "#fff",
                    }}>
                    <span style={{ width: 7, height: 7, borderRadius: 99, background: activeSignerId === s.id ? "#fff" : s.color }} />
                    <input
                      value={s.name} onClick={() => setActiveSignerId(s.id)}
                      onChange={(e) => renameSigner(s.id, e.target.value)}
                      style={{ border: "none", background: "transparent", fontSize: 16, width: Math.max(56, s.name.length * 7), color: activeSignerId === s.id ? "#fff" : "#102A43" }}
                    />
                    {signers.length > 1 && (
                      <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); removeSigner(s.id); }} style={{ border: "none", background: "none", cursor: "pointer", padding: 0, lineHeight: 0 }}>
                        <X size={11} color={activeSignerId === s.id ? "#fff" : "#9AA0AA"} />
                      </button>
                    )}
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 16, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#5B5F6B", cursor: "pointer" }}>
                    <input type="checkbox" checked={s.isSelf} onChange={() => toggleSelf(s.id)} /> this is me
                  </label>
                  {!s.isSelf && (
                    <input
                      value={s.email} onChange={(e) => emailSigner(s.id, e.target.value)}
                      placeholder="email address"
                      style={{ ...inputStyle, flex: "1 1 160px", padding: "5px 8px", fontSize: 16 }}
                    />
                  )}
                </div>
              ))}
              <button onClick={addSigner} style={{ ...chipBtn, alignSelf: "flex-start", opacity: signers.length >= MAX_SIGNERS ? 0.4 : 1 }}><Plus size={13} /> Add signer</button>
            </div>
          </div>

          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 400, color: "var(--ink)", lineHeight: 1.5, margin: "0 0 12px" }}>
            Pick a signer above, then click a field to drop it on this page and drag it where you want it.
          </p>

          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {FIELD_KINDS.map((k) => (
              <button
                key={k}
                onClick={() => addField(k)}
                disabled={!activeSignerId}
                style={{ ...chipBtn, opacity: activeSignerId ? 1 : 0.4 }}
              >
                <Plus size={13} /> {FIELD_LABELS[k]} field
              </button>
            ))}
          </div>

          {/* aspectRatio holds the page's real shape before the image
              arrives, so nothing jumps underneath a field being dragged
              and the drop coordinates stay honest while it loads. */}
          <div
            ref={containerRef}
            style={{
              position: "relative", border: "1px solid var(--line)", borderRadius: 8,
              overflow: "hidden", background: "#fff", marginBottom: 14,
              aspectRatio: currentPage.w && currentPage.h ? `${currentPage.w} / ${currentPage.h}` : undefined,
            }}
          >
            {!pageLoaded[currentPage.id] && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: "#fff" }}>
                <Hourglass size={26} />
                <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: "#8A8F98" }}>
                  Loading page {pageIdx + 1} of {pages.length}…
                </span>
                {isLargeDocument && (
                  <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: "#8A8F98", maxWidth: 320, textAlign: "center", lineHeight: 1.45 }}>
                    Large files take a little longer.
                  </span>
                )}
              </div>
            )}
            <img
              key={currentPage.id}
              src={currentPage.src}
              alt={`page ${pageIdx + 1}`}
              // A cached image can finish before React attaches onLoad,
              // which would otherwise leave the hourglass spinning forever.
              ref={(el) => { if (el && el.complete) markPageLoaded(currentPage.id); }}
              onLoad={() => markPageLoaded(currentPage.id)}
              style={{ width: "100%", display: "block", opacity: pageLoaded[currentPage.id] ? 1 : 0 }}
            />
            {pageFields.map((f) => (
              <FieldTag key={f.id} field={f} signer={signers.find((s) => s.id === f.signerId)} onDrag={dragField} onRemove={removeField} containerRef={containerRef} />
            ))}
          </div>

          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "var(--shadow)", padding: 12, marginBottom: 14 }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, letterSpacing: 1.5, color: "#8A8F98", marginBottom: 10 }}>SENDING</div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {[
                { v: "parallel", label: "Everyone at once", hint: "All signers get their link immediately and can sign in any order." },
                { v: "sequential", label: "One at a time", hint: "Each signer is emailed only when the person before them has finished." },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setSigningMode(o.v)}
                  title={o.hint}
                  style={{
                    ...chipBtn,
                    borderColor: signingMode === o.v ? "var(--ink)" : "var(--line)",
                    background: signingMode === o.v ? "var(--ink)" : "#fff",
                    color: signingMode === o.v ? "#fff" : "#102A43",
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 14, color: "#8A8F98", lineHeight: 1.45, margin: "0 0 12px" }}>
              {signingMode === "sequential"
                ? "Signers are emailed in the order listed above — each one only when the person before them finishes."
                : "Every signer gets their link as soon as you pay, and they can sign in any order."}
            </p>

            <label style={{ fontSize: 16, color: "#5B5F6B", fontFamily: "'Plus Jakarta Sans', sans-serif", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              Expires after
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                style={{ ...inputStyle, width: "auto", padding: "6px 10px" }}
              >
                {EXPIRY_CHOICES.map((d) => (
                  <option key={d} value={d}>{d === 0 ? "never" : `${d} days`}</option>
                ))}
              </select>
              <span style={{ fontSize: 14, color: "#8A8F98" }}>
                unsigned signers are reminded along the way
              </span>
            </label>
          </div>

          <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "#fff", borderTop: "1px solid var(--line)", padding: "12px 16px" }}>
            <div style={{ maxWidth: 608, margin: "0 auto" }}>
              {checkoutError && <p style={{ color: "#C1440E", fontSize: 16, marginBottom: 8 }}>{checkoutError}</p>}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 19, fontWeight: 700 }}>${price.total.toFixed(2)}</div>
                  <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, color: "#8A8F98" }}>{signers.length} signer{signers.length > 1 ? "s" : ""} · {fields.length} field{fields.length !== 1 ? "s" : ""} · {pages.length} page{pages.length !== 1 ? "s" : ""}</div>
                </div>
                <button disabled={!readyToCreate || submitting} onClick={startCheckout} style={{ ...primaryBtn, opacity: readyToCreate ? 1 : 0.4 }}>
                  {submitting ? <Loader2 size={16} className="spin" style={{ marginRight: 6 }} /> : null}
                  {submitting ? "Starting checkout…" : "Continue to payment"}
                  {!submitting && <ArrowRight size={15} style={{ marginLeft: 6 }} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
