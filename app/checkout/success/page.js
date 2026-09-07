"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Mail, MailCheck, MailX } from "lucide-react";
import Logo from "@/components/Logo";

function CheckoutSuccessInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const envelopeId = searchParams.get("envelope");

  const [envelope, setEnvelope] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!envelopeId) { setError("Missing envelope reference in the return URL."); return; }
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/envelopes/${envelopeId}`);
        if (!res.ok) throw new Error("Couldn't find that envelope.");
        const data = await res.json();
        if (cancelled) return;

        if (data.status !== "pending_payment") {
          const selfSigner = data.signers.find((s) => s.isSelf);
          if (selfSigner) {
            const selfAlreadySigned = data.fields
              .filter((f) => f.signerId === selfSigner.id)
              .every((f) => f.value);
            if (!selfAlreadySigned) {
              router.replace(`/sign/${envelopeId}/${selfSigner.id}`);
              return;
            }
          }
          setEnvelope(data);
          return;
        }

        if (attempts < 15) {
          setTimeout(poll, 1000);
        } else {
          setError("Payment is taking longer than expected to confirm. Refresh this page in a moment.");
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    };

    poll();
    return () => { cancelled = true; };
  }, [envelopeId, router]);

  if (error) {
    return (
      <Centered>
        <Logo size={40} />
        <h2 style={h2}>Something went wrong</h2>
        <p style={p}>{error}</p>
      </Centered>
    );
  }

  if (!envelope) {
    return (
      <Centered>
        <Logo size={40} />
        <h2 style={h2}>Confirming payment…</h2>
        <p style={p}>This only takes a moment.</p>
      </Centered>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "40px 20px", textAlign: "center" }}>
      <Logo size={56} />
      <h2 style={h2}>Envelope sent</h2>
      <p style={p}>Tracking {envelope.trackingId}</p>

      <div style={{ background: "#fff", boxShadow: "var(--shadow)", borderRadius: 10, padding: 16, textAlign: "left" }}>
        {envelope.signers.filter((s) => !s.isSelf).map((s) => {
          const sentEvent = (envelope.auditLog || []).find((e) => e.type === "email_sent" && e.signerId === s.id);
          const failedEvent = (envelope.auditLog || []).find((e) => e.type === "email_failed" && e.signerId === s.id);
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              {sentEvent ? <MailCheck size={16} color="#4E8B5A" /> : failedEvent ? <MailX size={16} color="#C1440E" /> : <Mail size={16} color="#9AA0AA" />}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "var(--ink)" }}>{s.name}</div>
                <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: "#8A8F98" }}>{s.email}</div>
              </div>
              <span style={{ fontSize: 10.5, fontFamily: "'IBM Plex Mono', monospace", color: sentEvent ? "#4E8B5A" : failedEvent ? "#C1440E" : "#9AA0AA" }}>
                {sentEvent ? "sent" : failedEvent ? "failed" : "pending"}
              </span>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 11.5, color: "#9AA0AA", marginTop: 18, lineHeight: 1.5 }}>
        You'll get a completion email once everyone's done. Check status anytime at <code>/e/{envelope.id}</code>.
      </p>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<Centered><Logo size={40} /><h2 style={h2}>Loading…</h2></Centered>}>
      <CheckoutSuccessInner />
    </Suspense>
  );
}

const h2 = { fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600, margin: "18px 0 6px", color: "var(--ink)" };
const p = { color: "#5B5F6B", fontSize: 14, marginBottom: 20 };

function Centered({ children }) {
  return <div style={{ maxWidth: 420, margin: "0 auto", padding: "80px 20px", textAlign: "center" }}>{children}</div>;
}
