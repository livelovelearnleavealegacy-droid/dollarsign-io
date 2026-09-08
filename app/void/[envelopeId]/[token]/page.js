"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, Ban, CheckCircle2, Loader2 } from "lucide-react";
import { primaryBtn, inputStyle } from "@/lib/shared";

// The page the emailed void link opens. It exists rather than voiding on
// click because mail scanners prefetch links — a GET that voided would
// fire on delivery. Nothing destructive happens until the button below
// is pressed.
export default function VoidConfirmPage({ params }) {
  const { envelopeId, token } = params;
  const [envelope, setEnvelope] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [reason, setReason] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState(null);
  const [done, setDone] = useState(null);

  useEffect(() => {
    fetch(`/api/envelopes/${envelopeId}`)
      .then((r) => { if (!r.ok) throw new Error("We couldn't find that envelope."); return r.json(); })
      .then(setEnvelope)
      .catch((e) => setLoadError(e.message));
  }, [envelopeId]);

  const confirmVoid = async () => {
    setVoiding(true);
    setVoidError(null);
    try {
      const res = await fetch(`/api/envelopes/${envelopeId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, reason: reason || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't void this envelope.");
      setDone(data);
    } catch (err) {
      setVoidError(err.message);
    } finally {
      setVoiding(false);
    }
  };

  if (loadError) return <Wrap><h1 style={h1}>Can't open this envelope</h1><p style={p}>{loadError}</p></Wrap>;
  if (!envelope) return <Wrap><h1 style={h1}>Loading…</h1></Wrap>;

  if (done) {
    return (
      <Wrap>
        <CheckCircle2 size={44} color="#4E8B5A" />
        <h1 style={h1}>Envelope voided</h1>
        <p style={p}>
          <strong>{envelope.documentName || envelope.trackingId}</strong> has been cancelled. Every signing
          link for it stopped working immediately, and it can't be completed.
        </p>
        <p style={p}>
          {done.notifiedCount > 0
            ? `We let ${done.notifiedCount} signer${done.notifiedCount === 1 ? "" : "s"} know.`
            : "There were no signers to notify."}
        </p>
        <p style={{ ...p, color: "#9AA0AA" }}>
          Need this document signed after all? Send a new envelope — this one can't be reopened.
        </p>
      </Wrap>
    );
  }

  const already = ["completed", "declined", "voided"].includes(envelope.status);
  if (already) {
    const label = envelope.status === "completed" ? "already complete"
      : envelope.status === "declined" ? "already declined by a signer"
      : "already voided";
    return (
      <Wrap>
        <h1 style={h1}>Nothing to void</h1>
        <p style={p}>This envelope is {label}, so there's nothing left to cancel.</p>
        <p style={p}><a href={`/e/${envelopeId}`} style={{ color: "var(--ink)" }}>View its status</a></p>
      </Wrap>
    );
  }

  const signedCount = envelope.signers.filter((s) => {
    const theirs = envelope.fields.filter((f) => f.signerId === s.id);
    return theirs.length > 0 && theirs.every((f) => f.value);
  }).length;

  return (
    <Wrap>
      <h1 style={h1}>Void this envelope?</h1>
      {envelope.documentName && (
        <p style={{ ...p, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>{envelope.documentName}</p>
      )}
      <p style={{ ...p, color: "#9AA0AA" }}>
        Tracking {envelope.trackingId} · {envelope.signers.length} signer{envelope.signers.length === 1 ? "" : "s"}
      </p>

      <div style={{ background: "#FDF3F0", border: "1px solid #E7BCAE", borderRadius: 10, padding: "14px 16px", textAlign: "left", margin: "20px 0" }}>
        <p style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 16, color: "#8A3212", lineHeight: 1.5, margin: 0 }}>
          <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            <strong>This can't be undone.</strong> Every signing link stops working immediately and the
            document can never be completed.
            {signedCount > 0 && (
              <> {signedCount} of {envelope.signers.length} signer{envelope.signers.length === 1 ? "" : "s"}{" "}
              {signedCount === 1 ? "has" : "have"} already signed — voiding discards that too.</>
            )}
          </span>
        </p>
      </div>

      <div style={{ textAlign: "left" }}>
        <label style={{ fontSize: 16, color: "#5B5F6B", display: "block", marginBottom: 6 }}>
          Reason (optional — shared with the signers)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Sent to the wrong address"
          maxLength={500}
          rows={3}
          style={{ ...inputStyle, fontFamily: "'Plus Jakarta Sans', sans-serif", resize: "vertical" }}
        />
      </div>

      {voidError && <p style={{ color: "#C1440E", fontSize: 16, margin: "12px 0 0", lineHeight: 1.5 }}>{voidError}</p>}

      <button
        onClick={confirmVoid}
        disabled={voiding}
        style={{ ...primaryBtn, background: "#C1440E", width: "100%", marginTop: 16, opacity: voiding ? 0.6 : 1 }}
      >
        {voiding ? <Loader2 size={16} className="spin" style={{ marginRight: 6 }} /> : <Ban size={16} style={{ marginRight: 6 }} />}
        {voiding ? "Voiding…" : "Yes, void this envelope"}
      </button>
      <p style={{ marginTop: 14 }}>
        <a href={`/e/${envelopeId}`} style={{ color: "#8A8F98", fontSize: 16 }}>No, leave it active</a>
      </p>
    </Wrap>
  );
}

const h1 = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 26, margin: "16px 0 10px", color: "var(--ink)" };
const p = { fontSize: 16, color: "#5B5F6B", lineHeight: 1.55, marginBottom: 14 };

function Wrap({ children }) {
  return <div style={{ maxWidth: 480, margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>{children}</div>;
}
