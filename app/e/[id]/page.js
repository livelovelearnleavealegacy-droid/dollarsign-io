"use client";
import { useEffect, useState } from "react";
import { Download, Check, Clock, ShieldCheck, Loader2, Send, Mail } from "lucide-react";
import Seal from "@/components/Seal";
import { todayStr } from "@/lib/shared";
import { buildFinalPages, hashPages, buildCertificatePage, buildFinalPdf } from "@/lib/compositePages";

export default function EnvelopeStatusPage({ params }) {
  const { id } = params;
  const [envelope, setEnvelope] = useState(null);
  const [error, setError] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [documentHash, setDocumentHash] = useState(null);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState(null);

  // Per-signer resend state, keyed by signer id:
  //   resending[signerId] = true while the request is in flight
  //   resendMsg[signerId] = { ok: boolean, text: string } after it lands
  const [resending, setResending] = useState({});
  const [resendMsg, setResendMsg] = useState({});

  useEffect(() => {
    fetch(`/api/envelopes/${id}`)
      .then((r) => { if (!r.ok) throw new Error("Envelope not found."); return r.json(); })
      .then(setEnvelope)
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (envelope?.status === "completed" && !pdfUrl && !building) {
      setBuilding(true);
      setBuildError(null);
      (async () => {
        try {
          const finalPages = await buildFinalPages(envelope.pages, envelope.fields);
          // Prefer the fingerprint the server computed and stored at
          // completion. The client-side fallback only exists for
          // envelopes completed before that was added — it is not
          // reproducible across browsers, which is why it was replaced.
          const hash = envelope.documentHash || (await hashPages(finalPages));
          const certificate = await buildCertificatePage(envelope, hash);
          const pdfBlob = await buildFinalPdf(finalPages, certificate);
          setDocumentHash(hash);
          setPdfUrl(URL.createObjectURL(pdfBlob));
        } catch (err) {
          setBuildError(err.message || "Something went wrong building the final document.");
        } finally {
          setBuilding(false);
        }
      })();
    }
  }, [envelope, pdfUrl, building]);

  const resendInvite = async (signer) => {
    setResending((r) => ({ ...r, [signer.id]: true }));
    setResendMsg((m) => ({ ...m, [signer.id]: null }));
    try {
      const res = await fetch(`/api/envelopes/${id}/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signerId: signer.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't resend that invite.");
      setResendMsg((m) => ({
        ...m,
        [signer.id]: { ok: true, text: `Sent again to ${data.sentTo}. Ask them to check their spam folder.` },
      }));
      if (data.envelope) setEnvelope(data.envelope);
    } catch (err) {
      setResendMsg((m) => ({ ...m, [signer.id]: { ok: false, text: err.message } }));
    } finally {
      setResending((r) => ({ ...r, [signer.id]: false }));
    }
  };

  if (error) return <Centered><h2 style={h2}>Can't find that envelope</h2><p style={p}>{error}</p></Centered>;
  if (!envelope) return <Centered><h2 style={h2}>Loading…</h2></Centered>;

  const signerStatus = (signer) => {
    const theirs = envelope.fields.filter((f) => f.signerId === signer.id);
    return theirs.length > 0 && theirs.every((f) => f.value);
  };

  const anyPending = envelope.status !== "completed" && envelope.status !== "declined" && envelope.signers.some(
    (s) => !signerStatus(s) && s.email && !s.isSelf
  );

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "40px 20px", textAlign: "center" }}>
      {envelope.status === "completed" && <Seal label="COMPLETED" date={todayStr()} size={100} />}
      <h2 style={h2}>
        {envelope.status === "completed"
          ? "Envelope completed"
          : envelope.status === "declined"
          ? "Signing declined"
          : "Waiting on signers"}
      </h2>
      {envelope.documentName && (
        <p style={{ ...p, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>{envelope.documentName}</p>
      )}
      <p style={p}>Tracking {envelope.trackingId} · {envelope.pages.length} page{envelope.pages.length !== 1 ? "s" : ""}</p>

      {envelope.status === "declined" && (() => {
        const ev = (envelope.auditLog || []).find((e) => e.type === "declined");
        return (
          <div style={{ background: "#FDF3F0", border: "1px solid #E7BCAE", borderRadius: 10, padding: "14px 16px", textAlign: "left", marginBottom: 20 }}>
            <p style={{ fontSize: 16, color: "#8A3212", lineHeight: 1.5, margin: 0 }}>
              <strong>{ev?.signerName || "A signer"}</strong> declined to sign, so this envelope is closed and
              no further signatures can be added.
              {ev?.reason ? <><br /><br />Reason given: &ldquo;{ev.reason}&rdquo;</> : null}
            </p>
          </div>
        );
      })()}

      <div style={{ background: "#fff", boxShadow: "var(--shadow)", borderRadius: 10, padding: 16, textAlign: "left", marginBottom: anyPending ? 12 : 24 }}>
        {envelope.signers.map((s) => {
          const complete = signerStatus(s);
          const canResend = !complete && !!s.email && !s.isSelf && envelope.status !== "completed" && envelope.status !== "declined";
          const msg = resendMsg[s.id];
          return (
            <div key={s.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {complete ? <Check size={16} color="#4E8B5A" /> : <Clock size={16} color="#9AA0AA" />}
                <div style={{ flex: 1, fontSize: 16, color: "var(--ink)" }}>{s.name}</div>
                <span style={{ fontSize: 16, fontFamily: "'Plus Jakarta Sans', sans-serif", color: complete ? "#4E8B5A" : "#9AA0AA" }}>{complete ? "signed" : "pending"}</span>
              </div>

              {canResend && (
                <div style={{ paddingLeft: 24, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => resendInvite(s)}
                    disabled={!!resending[s.id]}
                    style={{
                      ...resendBtn,
                      opacity: resending[s.id] ? 0.55 : 1,
                      cursor: resending[s.id] ? "default" : "pointer",
                    }}
                  >
                    {resending[s.id]
                      ? <Loader2 size={13} className="spin" style={{ marginRight: 5 }} />
                      : <Send size={13} style={{ marginRight: 5 }} />}
                    {resending[s.id] ? "Sending…" : "Resend invite"}
                  </button>
                  {s.email && (
                    <span style={{ fontSize: 13, color: "#9AA0AA", marginLeft: 8 }}>{s.email}</span>
                  )}
                  {msg && (
                    <p style={{ fontSize: 13, lineHeight: 1.45, margin: "5px 0 2px", color: msg.ok ? "#4E8B5A" : "#C1440E" }}>
                      {msg.text}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {anyPending && (
        <p style={{ display: "flex", alignItems: "flex-start", gap: 7, textAlign: "left", fontSize: 13, lineHeight: 1.5, color: "#8A8F98", marginBottom: 24 }}>
          <Mail size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            Signer says they never got the email? Have them check their spam or junk folder first — that's where it usually is.
            If it isn't there, resend the invite above. Still stuck? <a href="/faq" style={{ color: "#8A8F98" }}>See the FAQ</a>.
          </span>
        </p>
      )}

      {envelope.status === "completed" && (
        <>
          {building && (
            <p style={{ fontSize: 16, color: "#8A8F98", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Loader2 size={16} className="spin" /> Flattening pages and building your document…
            </p>
          )}

          {buildError && (
            <p style={{ fontSize: 16, color: "#C1440E" }}>{buildError}</p>
          )}

          {pdfUrl && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 16 }}>
                <ShieldCheck size={16} color="var(--teal)" />
                <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, letterSpacing: 1, color: "#8A8F98" }}>
                  {envelope.pages.length} page{envelope.pages.length !== 1 ? "s" : ""} + audit certificate, combined into one PDF
                </span>
              </div>
              <a href={pdfUrl} download={`${envelope.trackingId}.pdf`} style={dlBtn}>
                <Download size={17} style={{ marginRight: 8 }} /> Download signed document (PDF)
              </a>
              {documentHash && (
                <p style={{ fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#9AA0AA", marginTop: 14, wordBreak: "break-all" }}>
                  sha256 {documentHash}
                </p>
              )}
              <p style={{ fontSize: 13, lineHeight: 1.5, color: "#9AA0AA", marginTop: 16 }}>
                Save a copy for your records. You can always come back to this page, or use{" "}
                <a href="/find-my-document" style={{ color: "#9AA0AA" }}>find my document</a> if you lose the link.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const h2 = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 600, margin: "18px 0 6px", color: "var(--ink)" };
const p = { color: "#5B5F6B", fontSize: 16, marginBottom: 20 };
const dlBtn = { background: "var(--accent)", color: "#fff", borderRadius: 7, padding: "14px 24px", fontSize: 17, fontWeight: 600, display: "inline-flex", justifyContent: "center", alignItems: "center", textDecoration: "none" };
const resendBtn = {
  border: "1px solid var(--line)", background: "#fff", borderRadius: 20,
  padding: "4px 11px", fontSize: 13, color: "#5B5F6B",
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  display: "inline-flex", alignItems: "center",
};

function Centered({ children }) {
  return <div style={{ maxWidth: 420, margin: "0 auto", padding: "80px 20px", textAlign: "center" }}>{children}</div>;
}
