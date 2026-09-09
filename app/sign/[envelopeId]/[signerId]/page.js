"use client";
import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Lock, PenTool, CalendarDays, Type, XCircle } from "lucide-react";
import Seal from "@/components/Seal";
import SignaturePad from "@/components/SignaturePad";
import TextFieldPad from "@/components/TextFieldPad";
import ConsentScreen from "@/components/ConsentScreen";
import { CheckBox } from "@/components/FieldTag";
import { todayStr, primaryBtn, iconBtn, inputStyle, ov, CHECKED, UNCHECKED } from "@/lib/shared";

export default function SignPage({ params }) {
  const { envelopeId, signerId } = params;
  const [envelope, setEnvelope] = useState(null);
  const [error, setError] = useState(null);
  const [pageIdx, setPageIdx] = useState(0);
  const [visitedPages, setVisitedPages] = useState(new Set([0]));
  const [fields, setFields] = useState([]);
  const [showSignPad, setShowSignPad] = useState(false);
  const [signPadKind, setSignPadKind] = useState("signature");
  const [showTextPad, setShowTextPad] = useState(false);
  const [activeFieldId, setActiveFieldId] = useState(null);
  const [attested, setAttested] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [done, setDone] = useState(false);

  // Decline flow
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declining, setDeclining] = useState(false);
  const [declineError, setDeclineError] = useState(null);
  const [declined, setDeclined] = useState(false);

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

  if (declined || envelope.status === "declined") {
    return (
      <StatusScreen
        title="Signing declined"
        message="This document was declined and can no longer be signed. Everyone on the envelope has been notified."
      />
    );
  }

  if (envelope.status === "voided") {
    return (
      <StatusScreen
        title="This document was withdrawn"
        message="The sender voided this envelope, so there is nothing left to sign. If you were expecting to sign it, contact them directly — they may send a corrected version."
      />
    );
  }

  if (envelope.status === "expired") {
    return (
      <StatusScreen
        title="This document expired"
        message="It reached its expiry date before everyone signed, so it can no longer be signed. If you still need to sign, contact the sender — they can send it again."
      />
    );
  }

  if (envelope.status === "completed") {
    return <StatusScreen title="Already complete" message="Every signer has finished this envelope. Check your email for the completed document." />;
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

  const openSignPad = (fieldId, kind = "signature") => { setActiveFieldId(fieldId); setSignPadKind(kind); setShowSignPad(true); };
  // A checkbox toggles rather than opening anything. It starts null
  // (never answered) and becomes "checked"/"unchecked" — both truthy, so
  // an unchecked box still counts as a completed field. Storing `false`
  // would leave the envelope permanently unfinishable.
  const toggleCheck = (fieldId) =>
    setFields((fs) => fs.map((f) => (f.id === fieldId ? { ...f, value: f.value === CHECKED ? UNCHECKED : CHECKED } : f)));
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

  const confirmDecline = async () => {
    setDeclining(true);
    setDeclineError(null);
    try {
      const res = await fetch(`/api/envelopes/${envelopeId}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signerId, reason: declineReason || null }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Couldn't record your decline.");
      }
      setShowDecline(false);
      setDeclined(true);
    } catch (err) {
      setDeclineError(err.message);
    } finally {
      setDeclining(false);
    }
  };

  if (done) {
    // Who still owes a signature, in the sender's listed order. Offering
    // to pass the device along is what makes signing in person work at
    // all: everyone standing at the same desk shouldn't have to go and
    // find their own email to continue.
    const stillPending = envelope.signers.filter((s) => {
      const theirs = envelope.fields.filter((f) => f.signerId === s.id);
      return theirs.length > 0 && !theirs.every((f) => f.value);
    });
    const nextUp = envelope.signingMode === "sequential" ? stillPending.slice(0, 1) : stillPending;

    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
        <Seal label="SIGNED" date={todayStr()} size={110} />
        <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 600, margin: "18px 0 6px", color: "var(--ink)" }}>You're all set</h2>
        <p style={{ color: "#5B5F6B", fontSize: 16 }}>
          Your part of {envelope.documentName ? `${envelope.documentName} (${envelope.trackingId})` : `tracking ${envelope.trackingId}`} is complete.
        </p>

        {envelope.status !== "completed" && nextUp.length > 0 && (
          <div style={{ borderTop: "1px solid var(--line)", marginTop: 26, paddingTop: 20, textAlign: "left" }}>
            <p style={{ fontSize: 16, color: "#5B5F6B", lineHeight: 1.5, margin: "0 0 12px" }}>
              Signing together in person? Hand this device to whoever is next — they can sign right here
              instead of waiting for their email.
            </p>
            {nextUp.map((s) => (
              <a
                key={s.id}
                href={`/sign/${envelopeId}/${s.id}`}
                style={{
                  ...primaryBtn, width: "100%", marginBottom: 8, textDecoration: "none",
                  background: "#fff", color: "var(--ink)", border: "1.5px solid var(--ink)",
                }}
              >
                Hand device to {s.name}
              </a>
            ))}
            <p style={{ fontSize: 13, color: "#9AA0AA", lineHeight: 1.5, margin: "6px 0 0" }}>
              Not together? Ignore this — {nextUp.length === 1 ? "they have" : "they each have"} their own emailed link.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px 190px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
        <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>
          {envelope.documentName || envelope.trackingId}
        </span>
        <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, color: signer.color }}>signing as {signer.name}</span>
      </div>

      <p style={{ fontSize: 16, color: "#5B5F6B", margin: "16px 0" }}>
        {envelope.senderName || "Someone"} sent you this document. Review every page, fill in your fields, then submit.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button disabled={pageIdx === 0} onClick={() => goToPage(pageIdx - 1)} style={{ ...iconBtn, opacity: pageIdx === 0 ? 0.3 : 1 }}><ChevronLeft size={18} /></button>
        <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, color: "#5B5F6B" }}>
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
                if (f.kind === "signature" || f.kind === "initials") openSignPad(f.id, f.kind);
                else if (f.kind === "date") applyDate(f.id);
                else if (f.kind === "checkbox") toggleCheck(f.id);
                else openTextPad(f.id);
              }}
              style={{
                position: "absolute", left: `${f.x}%`, top: `${f.y}%`, transform: "translate(0,-50%)",
                cursor: mine ? "pointer" : "default", background: "rgba(255,255,255,0.95)",
                border: `1.5px solid ${f.value ? "#4E8B5A" : mine ? owner.color : "#C7CAD1"}`, borderRadius: 5,
                padding: f.kind === "signature" ? "5px 12px" : "4px 9px", opacity: mine || f.value ? 1 : 0.55,
              }}>
              {f.value ? (
                f.kind === "signature" || f.kind === "initials" ? (
                  f.value.type === "image"
                    ? <img src={f.value.data} alt={f.kind} style={{ height: f.kind === "initials" ? 18 : 26 }} />
                    : <span style={{ fontFamily: "'Caveat', cursive", fontSize: 22 }}>{f.value.data}</span>
                ) : f.kind === "checkbox" ? (
                  <CheckBox checked={f.value === CHECKED} />
                ) : <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16 }}>{f.value}</span>
              ) : mine ? (
                <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, color: owner.color, display: "flex", alignItems: "center", gap: 5 }}>
                  {f.kind === "signature" || f.kind === "initials" ? <PenTool size={12} /> : f.kind === "date" ? <CalendarDays size={12} /> : f.kind === "checkbox" ? <Check size={12} /> : <Type size={12} />}
                  tap to {f.kind === "signature" ? "sign" : f.kind === "initials" ? "initial" : f.kind === "date" ? "date" : f.kind === "checkbox" ? "check" : "fill in"}
                </span>
              ) : (
                <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, color: "#9AA0AA", display: "flex", alignItems: "center", gap: 5 }}>
                  <Lock size={11} /> {owner.name}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {!allPagesReviewed && (
        <p style={{ fontSize: 16, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#C1440E", marginTop: 10 }}>
          visit every page before you can submit ({visitedPages.size} of {envelope.pages.length} reviewed)
        </p>
      )}

      {/* Declining has to be a real, visible option. A signer with no way
          out just abandons the link, and the sender waits forever without
          ever learning why. */}
      <p style={{ marginTop: 18, textAlign: "center" }}>
        <button
          type="button"
          onClick={() => setShowDecline(true)}
          style={{ border: "none", background: "none", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, color: "#8A8F98", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <XCircle size={14} /> I don't want to sign this
        </button>
      </p>

      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "#fff", borderTop: "1px solid var(--line)", padding: "14px 16px" }}>
        <div style={{ maxWidth: 608, margin: "0 auto" }}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} style={{ marginTop: 2 }} />
            <span style={{ fontSize: 16, color: "#3A3F47", lineHeight: 1.4 }}>
              I intend this electronic mark to be my legal signature, equivalent to my handwritten signature, and I confirm I've reviewed this document.
            </span>
          </label>
          {submitError && <p style={{ color: "#C1440E", fontSize: 16, marginBottom: 8 }}>{submitError}</p>}
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

      {showDecline && (
        <div style={ov.backdrop}>
          <div style={ov.card}>
            <div style={ov.headRow}>
              <h3 style={ov.title}>Decline to sign?</h3>
            </div>
            <p style={{ fontSize: 16, color: "#5B5F6B", lineHeight: 1.5, marginTop: 0 }}>
              This ends the envelope for everyone. No one else will be able to sign it, and the sender and the
              other signers will be told you declined. This can't be undone.
            </p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Reason (optional — shared with the sender)"
              maxLength={500}
              rows={3}
              style={{ ...inputStyle, fontFamily: "'Plus Jakarta Sans', sans-serif", resize: "vertical", marginBottom: 12 }}
            />
            {declineError && <p style={{ color: "#C1440E", fontSize: 16, margin: "0 0 10px" }}>{declineError}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowDecline(false)}
                disabled={declining}
                style={{ flex: 1, border: "1px solid var(--line)", background: "#fff", borderRadius: 7, padding: "11px 14px", fontSize: 16, color: "#5B5F6B", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Keep signing
              </button>
              <button
                type="button"
                onClick={confirmDecline}
                disabled={declining}
                style={{ flex: 1, border: "none", background: "#C1440E", color: "#fff", borderRadius: 7, padding: "11px 14px", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: declining ? 0.6 : 1 }}
              >
                {declining ? "Declining…" : "Decline"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSignPad && <SignaturePad kind={signPadKind} signerName={signer.name} onConfirm={applySignature} onCancel={() => setShowSignPad(false)} />}
      {showTextPad && <TextFieldPad label="title" onConfirm={applyText} onCancel={() => setShowTextPad(false)} />}
    </div>
  );
}

function StatusScreen({ title, message }) {
  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: "80px 20px", textAlign: "center" }}>
      <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20, fontWeight: 600, margin: "0 0 6px", color: "var(--ink)" }}>{title}</h2>
      <p style={{ color: "#5B5F6B", fontSize: 16 }}>{message}</p>
    </div>
  );
}
