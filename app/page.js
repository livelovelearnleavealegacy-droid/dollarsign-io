"use client";
import { useState, useRef, useCallback } from "react";
import {
  Upload, Download, PenTool, ChevronLeft, ChevronRight,
  Users, Plus, X, ArrowRight, FileText, AlertTriangle, Loader2,
} from "lucide-react";
import Logo from "@/components/Logo";
import FieldTag from "@/components/FieldTag";
import {
  FLAT_PRICE, MAX_SIGNERS, MAX_PAGES, SIGNER_COLORS, calcPrice, uid,
  primaryBtn, iconBtn, chipBtn, inputStyle,
} from "@/lib/shared";

export default function Home() {
  const [step, setStep] = useState("landing"); // landing | editor
  const [pages, setPages] = useState([]);
  const [pageIdx, setPageIdx] = useState(0);
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [signers, setSigners] = useState([
    { id: uid(), name: "Signer 1", email: "", color: SIGNER_COLORS[0], isSelf: false },
    { id: uid(), name: "Signer 2", email: "", color: SIGNER_COLORS[1], isSelf: false },
  ]);
  const [activeSignerId, setActiveSignerId] = useState(null);
  const [fields, setFields] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);

  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const addPageInputRef = useRef(null);

  const uploadPage = async (blob, mime, w, h) => {
    const formData = new FormData();
    formData.append("file", blob, `page.${mime.split("/")[1]}`);
    formData.append("width", w);
    formData.append("height", h);
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

  const fileToPdfPages = async (file) => {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const pages = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport }).promise;

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
      pages.push(await uploadPage(blob, "image/jpeg", canvas.width, canvas.height));
    }
    return pages;
  };

  const loadFiles = (fileList, cb, existingCount = 0) => {
    const files = Array.from(fileList);
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
      });
  };

  const onUpload = (e) => {
    if (!e.target.files?.length) return;
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

  const addField = (kind) => {
    if (!activeSignerId || !pages[pageIdx]) return;
    setFields((f) => [...f, { id: uid(), pageId: pages[pageIdx].id, signerId: activeSignerId, kind, x: 50, y: 50, value: null }]);
  };
  const dragField = useCallback((id, x, y) => {
    setFields((fs) => fs.map((f) => (f.id === id ? { ...f, x, y } : f)));
  }, []);
  const removeField = (id) => setFields((fs) => fs.filter((f) => f.id !== id));

  const price = calcPrice();
  const currentPage = pages[pageIdx];
  const pageFields = fields.filter((f) => f.pageId === currentPage?.id);
  const readyToCreate =
    pages.length > 0 && fields.length > 0 &&
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
          pages, signers, fields,
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
    <div style={{ minHeight: "100vh" }}>
      {/* ---------- LANDING ---------- */}
      {step === "landing" && (
        <div>
          <div style={{ padding: "72px 24px 56px", textAlign: "center" }}>
            <div style={{ maxWidth: 560, margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <img src="/wordmark.png" alt="DollarSign.io" style={{ height: 56, width: "auto" }} />
              </div>
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
                { icon: <Download size={16} />, t: "Yours to Keep", d: "Final document delivered to all signers by email, ready to download." },
                { icon: <Users size={16} />, t: "PCI Compliant", d: `Credit cards processed by Strip. We never see credit card information.` },
              ].map((c, i) => (
                <div key={i} style={{ background: "var(--card)", borderRadius: 12, boxShadow: "var(--shadow)", padding: 16 }}>
                  <div style={{ color: "var(--accent)", marginBottom: 8 }}>{c.icon}</div>
                  <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 4, color: "var(--ink)" }}>{c.t}</div>
                  <div style={{ fontSize: 16, color: "#5B5F6B", lineHeight: 1.4 }}>{c.d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---------- EDITOR ---------- */}
      {step === "editor" && currentPage && (
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px 130px" }}>
          <TopBar sub="placing fields" />

          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FFF8E8", border: "1px solid #F4B942", borderRadius: 8, padding: "10px 12px", margin: "16px 0" }}>
            <AlertTriangle size={15} color="#946B00" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 16, color: "#6B5000", lineHeight: 1.45, margin: 0 }}>
              The U.S. ESIGN Act doesn't cover every document type — don't use this for wills or testamentary
              trusts, family law matters (divorce, adoption), court orders, eviction/foreclosure/repossession
              notices, utility cancellation notices, health or life insurance cancellations, product recalls,
              or hazardous materials transport documents. Use paper for those.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, margin: "16px 0" }}>
            <input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Your name (shown to signers)" style={{ ...inputStyle, fontFamily: "'Plus Jakarta Sans', sans-serif" }} />
            <input value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} placeholder="Your email (for completion notice)" style={{ ...inputStyle, fontFamily: "'Plus Jakarta Sans', sans-serif" }} />
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

          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <button onClick={() => addField("signature")} disabled={!activeSignerId} style={{ ...chipBtn, opacity: activeSignerId ? 1 : 0.4 }}><Plus size={13} /> Signature field</button>
            <button onClick={() => addField("date")} disabled={!activeSignerId} style={{ ...chipBtn, opacity: activeSignerId ? 1 : 0.4 }}><Plus size={13} /> Date field</button>
            <button onClick={() => addField("text")} disabled={!activeSignerId} style={{ ...chipBtn, opacity: activeSignerId ? 1 : 0.4 }}><Plus size={13} /> Text field</button>
          </div>

          <div ref={containerRef} style={{ position: "relative", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
            <img src={currentPage.src} alt={`page ${pageIdx + 1}`} style={{ width: "100%", display: "block" }} />
            {pageFields.map((f) => (
              <FieldTag key={f.id} field={f} signer={signers.find((s) => s.id === f.signerId)} onDrag={dragField} onRemove={removeField} containerRef={containerRef} />
            ))}
          </div>
          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, color: "#8A8F98", marginTop: 10 }}>drag tags onto the exact spot · fields carry over per page</p>

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

function TopBar({ sub, envId }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Logo size={22} />
        {envId && <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, letterSpacing: 1.5, color: "#8A8F98" }}>{envId}</span>}
      </div>
      <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: "var(--accent)" }}>{sub}</span>
    </div>
  );
}
