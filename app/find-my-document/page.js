"use client";
import { useState } from "react";
import { Mail, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import Logo from "@/components/Logo";
import { primaryBtn, inputStyle } from "@/lib/shared";

export default function FindMyDocument() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 440, margin: "0 auto", padding: "80px 20px", textAlign: "center" }}>
      <Logo size={44} />
      <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 26, margin: "20px 0 10px", color: "var(--ink)" }}>
        Find my document
      </h1>
      <p style={{ fontSize: 16, color: "#5B5F6B", lineHeight: 1.5, marginBottom: 28 }}>
        Lost the email with your signing link or completed document? Enter the email address you used, and we'll send you the links again.
      </p>

      {done ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "20px 0" }}>
          <CheckCircle2 size={40} color="#4E8B5A" />
          <p style={{ fontSize: 16, color: "#1C2B4A", lineHeight: 1.5 }}>
            If we found any documents for that email address, we've sent the links to it. Check your inbox (and spam folder) in a moment.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ position: "relative" }}>
            <Mail size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#8A8F98" }} />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{ ...inputStyle, fontFamily: "'Plus Jakarta Sans', sans-serif", paddingLeft: 38 }}
            />
          </div>
          {error && <p style={{ color: "#C1440E", fontSize: 14, margin: 0 }}>{error}</p>}
          <button type="submit" disabled={submitting} style={{ ...primaryBtn, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? <Loader2 size={16} className="spin" style={{ marginRight: 6 }} /> : null}
            {submitting ? "Sending…" : "Send me the links"}
            {!submitting && <ArrowRight size={15} style={{ marginLeft: 6 }} />}
          </button>
        </form>
      )}
    </div>
  );
}
