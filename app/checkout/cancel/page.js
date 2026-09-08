"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowRight } from "lucide-react";
import { primaryBtn } from "@/lib/shared";

function CancelInner() {
  const envelopeId = useSearchParams().get("envelope");
  const [resuming, setResuming] = useState(false);
  const [error, setError] = useState(null);

  // The envelope still exists as a pending_payment draft — the pages
  // were uploaded before checkout started. Previously this page told
  // people their document was gone and made them upload everything
  // again, which for a hundred-page file is brutal.
  const resume = async () => {
    setResuming(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ envelopeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't restart checkout.");
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setResuming(false);
    }
  };

  return (
    <div style={{ maxWidth: 440, margin: "0 auto", padding: "70px 20px", textAlign: "center" }}>
      <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 600, margin: "0 0 8px", color: "var(--ink)" }}>
        Payment canceled
      </h2>
      <p style={{ color: "#5B5F6B", fontSize: 16, lineHeight: 1.55, marginBottom: 24 }}>
        Nothing was charged and no signers were emailed.
        {envelopeId
          ? " Your document, signers and fields are all still saved — pick up where you left off."
          : " Your document wasn't saved — you'll need to upload it again to try once more."}
      </p>

      {envelopeId && (
        <>
          {error && <p style={{ color: "#C1440E", fontSize: 16, marginBottom: 12 }}>{error}</p>}
          <button onClick={resume} disabled={resuming} style={{ ...primaryBtn, opacity: resuming ? 0.6 : 1 }}>
            {resuming ? <Loader2 size={16} className="spin" style={{ marginRight: 6 }} /> : null}
            {resuming ? "Restarting checkout…" : "Resume payment"}
            {!resuming && <ArrowRight size={15} style={{ marginLeft: 6 }} />}
          </button>
          <p style={{ fontSize: 16, color: "#9AA0AA", marginTop: 14 }}>
            Bookmark this page to come back to it later.
          </p>
        </>
      )}

      <p style={{ marginTop: 24 }}>
        <Link href="/" style={{ color: "#8A8F98", fontSize: 16 }}>← Start a new envelope</Link>
      </p>
    </div>
  );
}

export default function CheckoutCancelPage() {
  return (
    <Suspense fallback={<div style={{ padding: "70px 20px", textAlign: "center", color: "#8A8F98" }}>Loading…</div>}>
      <CancelInner />
    </Suspense>
  );
}
