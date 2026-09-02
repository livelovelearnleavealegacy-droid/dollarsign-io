"use client";
import Link from "next/link";
import Logo from "@/components/Logo";

export default function CheckoutCancelPage() {
  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: "80px 20px", textAlign: "center" }}>
      <Logo size={40} />
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600, margin: "16px 0 6px", color: "var(--ink)" }}>
        Payment canceled
      </h2>
      <p style={{ color: "#5B5F6B", fontSize: 14, marginBottom: 20 }}>
        Nothing was charged and no signers were emailed. Your document wasn't saved — you'll need to
        upload it again to try once more.
      </p>
      <Link href="/" style={{ color: "var(--accent)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
        ← Start over
      </Link>
    </div>
  );
}
