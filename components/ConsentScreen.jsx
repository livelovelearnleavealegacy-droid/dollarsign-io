"use client";
import { useState } from "react";
import { FileCheck } from "lucide-react";
import Logo from "@/components/Logo";
import { primaryBtn } from "@/lib/shared";

/**
 * ESIGN requires consent to sign electronically be obtained separately
 * from the act of signing itself, and requires the signer be told:
 * their right to a paper copy, their right to withdraw consent, and
 * the hardware/software needed to access the record. This screen is
 * that disclosure — shown once per signer, before they ever see the
 * document.
 */
export default function ConsentScreen({ envelopeId, signerId, signerName, senderName, senderEmail, trackingId, onConsented }) {
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const consent = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/envelopes/${envelopeId}/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signerId }),
      });
      if (!res.ok) throw new Error("Couldn't record consent — try again.");
      const data = await res.json();
      onConsented(data.envelope);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "48px 20px 100px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
        <Logo size={26} />
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1.5, color: "#8A8F98" }}>{trackingId}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <FileCheck size={18} color="var(--accent)" />
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 21, fontWeight: 600, color: "var(--ink)", margin: 0 }}>
          Consent to electronic signature
        </h1>
      </div>
      <p style={{ fontSize: 13.5, color: "#5B5F6B", marginBottom: 20 }}>
        Before {signerName || "you"} can view and sign this document, please review the following.
      </p>

      <div style={{ background: "var(--card)", boxShadow: "var(--shadow)", borderRadius: 10, padding: 20, fontSize: 13, color: "#3A3F47", lineHeight: 1.65 }}>
        <p style={{ marginTop: 0 }}>
          {senderName || "The sender"} has asked you to sign a document electronically through DollarSign.io.
          Signing electronically has the same legal effect as signing on paper, once you consent below.
        </p>
        <ul style={{ paddingLeft: 18, margin: "12px 0" }}>
          <li>You may review the entire document before deciding whether to sign it.</li>
          <li>
            You have the right to request a paper copy instead, and the right to withdraw this
            consent at any time before signing, by contacting {senderName || "the sender"}
            {senderEmail ? <> at <strong>{senderEmail}</strong></> : null}.
          </li>
          <li>
            To view and sign, you need a device with an up-to-date web browser, JavaScript enabled,
            and a valid email address to receive confirmation.
          </li>
          <li>This consent applies only to this document (tracking {trackingId}).</li>
        </ul>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 16, cursor: "pointer" }}>
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} style={{ marginTop: 2 }} />
          <span style={{ fontSize: 13 }}>
            I have read this disclosure and consent to sign this document electronically.
          </span>
        </label>
      </div>

      {error && <p style={{ color: "#C1440E", fontSize: 12.5, marginTop: 10 }}>{error}</p>}

      <button
        disabled={!checked || submitting}
        onClick={consent}
        style={{ ...primaryBtn, width: "100%", marginTop: 18, opacity: checked ? 1 : 0.4 }}
      >
        {submitting ? "Recording consent…" : "I consent — continue to document"}
      </button>
    </div>
  );
}
