"use client";
import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Lock, PenTool, CalendarDays, Type } from "lucide-react";
import Logo from "@/components/Logo";
import Seal from "@/components/Seal";
import SignaturePad from "@/components/SignaturePad";
import TextFieldPad from "@/components/TextFieldPad";
import ConsentScreen from "@/components/ConsentScreen";
import { todayStr, primaryBtn, iconBtn } from "@/lib/shared";

export default function SignPage({ params }) {
  const { envelopeId, signerId } = params;
  const [envelope, setEnvelope] = useState(null);
  const [error, setError] = useState(null);
  const [pageIdx, setPageIdx] = useState(0);
  const [visitedPages, setVisitedPages] = useState(new Set([0]));
  const [fields, setFields] = useState([]);
  const [showSignPad, setShowSignPad] = useState(false);
  const [showTextPad, setShowTextPad] = useState(false);
  const [activeFieldId, setActiveFieldId] = useState(null);
  const [attested, setAttested] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/envelopes/${envelopeId}`)
      .then((r) => {
        if (!r.ok) throw new Error("This envelope link isn't valid or has expired.");
        return r.json();
      })
      .then((data) => { setEnvelope(data); setFields(data.fields); })
      .catch((err) => setError(err.message));
  }, [envelopeId]);

  const goToPage = (idx) => {
    setPageIdx(idx);
    setVisitedPages((v) => new Set(v).add(idx));
  };

  if (error) return <StatusScreen title="Can't open this envelope" message={error} />;
  if (!envelope) return <StatusScreen title="Loading…" message="Fetching your document." />;

  const signer = envelope.signers.find((s) => s.id === signerId);
  if (!signer) return <StatusScreen title="Signer not found" message="This link doesn't match a signer on this envelope." />;

  if (envelope.status === "pending_payment") {
    return <StatusScreen title="Not ready yet" message="This envelope's payment hasn't been confirmed yet. Try this link again in a moment." />;
  }

  // ESIGN requires consent be obtained separately from, and before, the
  // act of signing — this gate blocks access to the document itself
  // until that's on record.
  const hasConsented = (envelope.auditLog || []).some((e) => e.type === "consent" && e.signerId === signerId);
  if (!hasConsented) {
    return (
      <ConsentScreen
        envelopeId={envelopeId}
        signerId={signerId}
        signerName={signer.name}
        senderName={envelope.senderName}
        senderEmail={envelope.senderEmail}
        trackingId={envelope.trackingId}
        onConsented={(updated) => setEnvelope(updated)}
      />
    );
  }

  const currentPage = envelope.pages[pageIdx];
  const pageFields = fields.filter((f) => f.pageId === currentPage.id);
  const mySignerFields = fields.filter((f) => f.signerId === signerId);
  const myFieldsDone = mySignerFields.every((f) => f.value);
  const allPagesReviewed = visitedPages.size === envelope.pages.length;
  const canSubmit = myFieldsDone && allPagesReviewed && attested;

  const openSignPad = (fieldId) => { setActiveFieldId(fieldId); setShowSignPad(true); };
  const applySignature = (val) => {
    setFields((fs) => fs.map((f) => (f.id === activeFieldId ? { ...f, value: val } : f)));
    setShowSignPad(false);
  };
  const applyDate = (fieldId) => setFields((fs) => fs.map((f) => (f.id === fieldId ? { ...f, value: todayStr() } : f)));
  const openTextPad = (fieldId) => { setActiveFieldId(fieldId); setShowTextPad(true); };
  const applyText = (val) => {
    setFields((fs) => fs.map((f) => (f.id === activeFieldId ? { ...f, value: val } : f)));
    setShowTextPad(false);
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/envelopes/${envelopeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signerId, fields: mySignerFields, attested: true, reviewedAllPages: true }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Couldn't submit your signature.");
      }
      const data = await res.json();
      setEnvelope(data.envelope);
      setDone(true);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
        <Seal label="SIGNED" date={todayStr()} size={110} />
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600, margin: "18px 0 6px", color: "var(--ink)" }}>You're all set</h2>
        <p style={{ color: "#5B5F6B", fontSize: 14 }}>Your part of tracking {envelope.trackingId} is complete.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px 190px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Logo size={22} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1.5, color: "#8A8F98" }}>{envelope.trackingId}</span>
        </div>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: signer.color }}>signing as {signer.name}</span>
      </div>

      <p style={{ fontSize: 14, color: "#5B5F6B", margin: "16px 0" }}>
        {envelope.senderName || "Someone"} sent you this document. Review every page, fill in your fields, then submit.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button disabled={pageIdx === 0} onClick={() => goToPage(pageIdx - 1)} style={{ ...iconBtn, opacity: pageIdx === 0 ? 0.3 : 1 }}><ChevronLeft size={18} /></button>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#5B5F6B" }}>
          page {pageIdx + 1} of {envelope.pages.length} {visitedPages.has(pageIdx) ? "" : "· not yet reviewed"}
        </span>
        <button disabled={pageIdx === envelope.pages.length - 1} onClick={() => goToPage(pageIdx + 1)} style={{ ...iconBtn, opacity: pageIdx === envelope.pages.length - 1 ? 0.3 : 1 }}><ChevronRight size={18} /></button>
      </div>

      <div style={{ position: "relative", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
        <img src={currentPage.src} alt={`page ${pageIdx + 1}`} style={{ width: "100%", display: "block" }} />
        {pageFields.map((f) => {
          const mine = f.signerId === signerId;
          const owner = envelope.signers.find((s) => s.id === f.signerId);
          return (
            <div key={f.id}
              onClick={() => {
                if (!mine) return;
                if (f.kind === "signature") openSignPad(f.id);
                else if (f.kind === "date") applyDate(f.id);
                else openTextPad(f.id);
              }}
              style={{
                position: "absolute", left: `${f.x}%`, top: `${f.y}%`, transform: "translate(0,-50%)",
                cursor: mine ? "pointer" : "default", background: "rgba(255,255,255,0.95)",
                border: `1.5px solid ${f.value ? "#4E8B5A" : mine ? owner.color : "#C7CAD1"}`, borderRadius: 5,
                padding: f.kind === "signature" ? "5px 12px" : "4px 9px", opacity: mine || f.value ? 1 : 0.55,
              }}>
              {f.value ? (
                f.kind === "signature" ? (
                  f.value.type === "image" ? <img src={f.value.data} alt="sig" style={{ height: 26 }} /> : <span style={{ fontFamily: "'Caveat', cursive", fontSize: 22 }}>{f.value.data}</span>
                ) : <span style={{ fontFamily: f.kind === "date" ? "'IBM Plex Mono', monospace" : "'Public Sans', sans-serif", fontSize: 12.5 }}>{f.value}</span>
              ) : mine ? (
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, color: owner.color, display: "flex", alignItems: "center", gap: 5 }}>
                  {f.kind === "signature" ? <PenTool size={12} /> : f.kind === "date" ? <CalendarDays size={12} /> : <Type size={12} />}
                  tap to {f.kind === "signature" ? "sign" : f.kind === "date" ? "date" : "fill in"}
                </span>
              ) : (
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, color: "#9AA0AA", display: "flex", alignItems: "center", gap: 5 }}>
                  <Lock size={11} /> {owner.name}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {!allPagesReviewed && (
        <p style={{ fontSize: 11.5, fontFamily: "'IBM Plex Mono', monospace", color: "#C1440E", marginTop: 10 }}>
          visit every page before you can submit ({visitedPages.size} of {envelope.pages.length} reviewed)
        </p>
      )}

      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "#fff", borderTop: "1px solid var(--line)", padding: "14px 16px" }}>
        <div style={{ maxWidth: 608, margin: "0 auto" }}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} style={{ marginTop: 2 }} />
            <span style={{ fontSize: 12, color: "#3A3F47", lineHeight: 1.4 }}>
              I intend this electronic mark to be my legal signature, equivalent to my handwritten signature, and I confirm I've reviewed this document.
            </span>
          </label>
          {submitError && <p style={{ color: "#C1440E", fontSize: 12, marginBottom: 8 }}>{submitError}</p>}
          <button disabled={!canSubmit || submitting} onClick={submit} style={{ ...primaryBtn, width: "100%", opacity: canSubmit ? 1 : 0.4 }}>
            <Check size={16} style={{ marginRight: 6 }} />
            {submitting
              ? "Submitting…"
              : !myFieldsDone
              ? `${mySignerFields.filter((f) => !f.value).length} field(s) left`
              : !allPagesReviewed
              ? "Review every page to continue"
              : !attested
              ? "Confirm the statement above to submit"
              : "Submit my signature"}
          </button>
        </div>
      </div>

      {showSignPad && <SignaturePad onConfirm={applySignature} onCancel={() => setShowSignPad(false)} />}
      {showTextPad && <TextFieldPad label="title" onConfirm={applyText} onCancel={() => setShowTextPad(false)} />}
    </div>
  );
}

function StatusScreen({ title, message }) {
  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: "80px 20px", textAlign: "center" }}>
      <Logo size={40} />
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600, margin: "16px 0 6px", color: "var(--ink)" }}>{title}</h2>
      <p style={{ color: "#5B5F6B", fontSize: 14 }}>{message}</p>
    </div>
  );
}
