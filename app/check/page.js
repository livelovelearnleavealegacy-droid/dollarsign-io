"use client";
import { useState } from "react";
import { Mail, Hash, Loader2, AlertTriangle, CheckCircle2, Gift, Copy } from "lucide-react";
import { primaryBtn, inputStyle } from "@/lib/shared";

// "Something went wrong with my envelope."
//
// Most of the time nothing did: the signer got it and hasn't finished.
// Saying so plainly, with timestamps, answers the question that would
// otherwise arrive as a support email. When something genuinely failed,
// this hands over a free-envelope code without anyone having to ask.
export default function CheckPage() {
  const [trackingId, setTrackingId] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingId, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — the code is on screen to type */ }
  };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "60px 20px" }}>
      <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 26, margin: "0 0 10px", color: "var(--ink)", textAlign: "center" }}>
        Check an envelope
      </h1>
      <p style={{ fontSize: 16, color: "#5B5F6B", lineHeight: 1.5, marginBottom: 28, textAlign: "center" }}>
        Something not working? Enter your tracking number and we&apos;ll tell you exactly what happened to your document —
        and make it right if the problem was on our end.
      </p>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ position: "relative" }}>
          <Hash size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#8A8F98" }} />
          <input
            required
            value={trackingId}
            onChange={(e) => setTrackingId(e.target.value)}
            placeholder="ENV-XXXXXX"
            style={{ ...inputStyle, fontFamily: "'Plus Jakarta Sans', sans-serif", paddingLeft: 38, textTransform: "uppercase" }}
          />
        </div>
        <div style={{ position: "relative" }}>
          <Mail size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#8A8F98" }} />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="the email address you used"
            style={{ ...inputStyle, fontFamily: "'Plus Jakarta Sans', sans-serif", paddingLeft: 38 }}
          />
        </div>
        <button type="submit" disabled={submitting} style={{ ...primaryBtn, opacity: submitting ? 0.6 : 1 }}>
          {submitting ? <Loader2 size={16} className="spin" style={{ marginRight: 6 }} /> : null}
          {submitting ? "Checking…" : "Check my envelope"}
        </button>
        <p style={{ fontSize: 13, color: "#9AA0AA", lineHeight: 1.5, margin: 0 }}>
          We ask for both because the tracking number alone isn&apos;t proof the envelope is yours — the history below names
          everyone on it.
        </p>
      </form>

      {error && (
        <p style={{ fontSize: 15, color: "#C1440E", marginTop: 16 }}>{error}</p>
      )}

      {result && !result.found && (
        <div style={{ background: "#fff", boxShadow: "var(--shadow)", borderRadius: 10, padding: 18, marginTop: 24 }}>
          <p style={{ fontSize: 15, color: "#1C2B4A", lineHeight: 1.55, margin: 0 }}>{result.message}</p>
        </div>
      )}

      {result && result.found && (
        <div style={{ marginTop: 28 }}>
          <div style={{ background: "#fff", boxShadow: "var(--shadow)", borderRadius: 10, padding: 18, marginBottom: 16 }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 17, fontWeight: 600, color: "var(--ink)" }}>
              {result.documentName || result.trackingId}
            </div>
            <div style={{ fontSize: 14, color: "#5B5F6B", marginTop: 4 }}>
              Tracking {result.trackingId} · status {result.status}
              {result.waitingOn?.length ? ` · waiting on ${result.waitingOn.join(", ")}` : ""}
            </div>
          </div>

          {result.findings.length > 0 ? (
            <div style={{ background: "#FFF6F2", border: "1px solid #F3D3C6", borderRadius: 10, padding: 18, marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                <AlertTriangle size={17} color="#C1440E" />
                <strong style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, color: "#C1440E" }}>
                  We found a problem
                </strong>
              </div>
              {result.findings.map((f, i) => (
                <p key={i} style={{ fontSize: 15, color: "#1C2B4A", lineHeight: 1.55, margin: "0 0 8px" }}>{f.text}</p>
              ))}

              {result.credit && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #F3D3C6" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <Gift size={17} color="#1C2B4A" />
                    <strong style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, color: "var(--ink)" }}>
                      {result.credit.reissued ? "Your replacement envelope code" : "Here's a free envelope, on us"}
                    </strong>
                  </div>
                  <p style={{ fontSize: 15, color: "#1C2B4A", lineHeight: 1.55, margin: "0 0 10px" }}>
                    Enter this code at checkout next time. It covers one envelope in full and can only be used once.
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <code style={{ fontFamily: "monospace", fontSize: 18, letterSpacing: 1, background: "#fff", border: "1px solid var(--line)", borderRadius: 7, padding: "8px 14px", color: "var(--ink)" }}>
                      {result.credit.code}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyCode(result.credit.code)}
                      style={{ background: "none", border: "1px solid var(--line)", borderRadius: 7, padding: "8px 12px", fontSize: 14, cursor: "pointer", color: "var(--ink)" }}
                    >
                      <Copy size={13} style={{ marginRight: 5 }} />
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p style={{ fontSize: 13, color: "#8A8F98", margin: "10px 0 0" }}>
                    Write it down — this page won&apos;t remember it for you, though checking again will show you the same code.
                  </p>
                </div>
              )}

              {result.creditError && (
                <p style={{ fontSize: 15, color: "#1C2B4A", lineHeight: 1.55, margin: "10px 0 0" }}>
                  Email <a href="mailto:support@dollarsign.io" style={{ color: "#1C2B4A", fontWeight: 600 }}>support@dollarsign.io</a> with
                  your tracking number and we&apos;ll put this right — a refund or a free envelope, whichever you prefer.
                </p>
              )}
            </div>
          ) : (
            <div style={{ background: "#F3F8F4", border: "1px solid #CFE3D4", borderRadius: 10, padding: 18, marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <CheckCircle2 size={17} color="#4E8B5A" />
                <strong style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, color: "var(--ink)" }}>
                  Everything worked on our end
                </strong>
              </div>
              <p style={{ fontSize: 15, color: "#1C2B4A", lineHeight: 1.55, margin: 0 }}>
                We don&apos;t see a failure on this envelope — the history below shows what actually happened to it.
                {result.waitingOn?.length
                  ? ` It's still waiting on ${result.waitingOn.join(", ")}.`
                  : ""}
                {" "}If that doesn&apos;t match what you&apos;re seeing, email{" "}
                <a href="mailto:support@dollarsign.io" style={{ color: "#1C2B4A", fontWeight: 600 }}>support@dollarsign.io</a>{" "}
                with your tracking number and a person will sort it out.
              </p>
            </div>
          )}

          <div style={{ background: "#fff", boxShadow: "var(--shadow)", borderRadius: 10, padding: 18 }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>
              What happened
            </div>
            {result.timeline.map((t, i) => (
              <div key={i} style={{ padding: "7px 0", borderBottom: i === result.timeline.length - 1 ? "none" : "1px solid var(--line)" }}>
                <div style={{ fontSize: 15, color: "#1C2B4A", lineHeight: 1.4 }}>{t.text}</div>
                <div style={{ fontFamily: "monospace", fontSize: 12, color: "#9AA0AA", marginTop: 2 }}>{t.at}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
