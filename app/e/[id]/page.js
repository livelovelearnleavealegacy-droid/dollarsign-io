"use client";
import { useEffect, useState } from "react";
import { Download, Check, Clock, ShieldCheck, Loader2, Send, Mail, Ban, PenTool, Copy, ArrowRight, AlertTriangle } from "lucide-react";
import Seal from "@/components/Seal";
import { todayStr, inputStyle, primaryBtn } from "@/lib/shared";
import { isTerminal as statusIsTerminal } from "@/lib/guards";

export default function EnvelopeStatusPage({ params }) {
  const { id } = params;
  const [envelope, setEnvelope] = useState(null);
  const [error, setError] = useState(null);

  // Per-signer resend state, keyed by signer id:
  //   resending[signerId] = true while the request is in flight
  //   resendMsg[signerId] = { ok: boolean, text: string } after it lands
  const [resending, setResending] = useState({});
  const [resendMsg, setResendMsg] = useState({});

  // Void is a two-step flow: this only asks for the confirmation email.
  // Nothing is cancelled until the sender clicks the link in it.
  const [voidRequesting, setVoidRequesting] = useState(false);
  const [voidMsg, setVoidMsg] = useState(null);

  // "Send another like this" — a copy of this envelope's document and
  // field layout, with the signer names/emails editable before paying.
  const [showCopy, setShowCopy] = useState(false);
  const [copySigners, setCopySigners] = useState([]);
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState(null);

  useEffect(() => {
    fetch(`/api/envelopes/${id}`)
      .then((r) => { if (!r.ok) throw new Error("Envelope not found."); return r.json(); })
      .then(setEnvelope)
      .catch((err) => setError(err.message));
  }, [id]);


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

  const openCopy = () => {
    setCopyError(null);
    setCopySigners(envelope.signers.map((s) => ({ id: s.id, name: s.name || "", email: s.email || "", isSelf: !!s.isSelf })));
    setShowCopy(true);
  };

  // Creates the copy, then hands straight off to Stripe. A copy is a
  // new envelope and a new $1.99 — nothing is duplicated for free.
  const sendCopy = async () => {
    setCopying(true);
    setCopyError(null);
    try {
      const dupRes = await fetch(`/api/envelopes/${id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signers: copySigners }),
      });
      const dup = await dupRes.json();
      if (!dupRes.ok) throw new Error(dup.error || "Couldn't copy this envelope.");

      const checkoutRes = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ envelopeId: dup.envelope.id }),
      });
      const checkout = await checkoutRes.json();
      if (!checkoutRes.ok) throw new Error(checkout.error || "Couldn't start checkout.");
      window.location.href = checkout.url;
    } catch (err) {
      setCopyError(err.message);
      setCopying(false);
    }
  };

  const requestVoid = async () => {
    setVoidRequesting(true);
    setVoidMsg(null);
    try {
      const res = await fetch(`/api/envelopes/${id}/void-request`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't start the void.");
      setVoidMsg({ ok: true, text: `Confirmation link sent to ${data.sentTo}. Open it to finish voiding — nothing has changed yet.` });
    } catch (err) {
      setVoidMsg({ ok: false, text: err.message });
    } finally {
      setVoidRequesting(false);
    }
  };

  if (error) return <Centered><h2 style={h2}>Can't find that envelope</h2><p style={p}>{error}</p></Centered>;
  if (!envelope) return <Centered><h2 style={h2}>Loading…</h2></Centered>;

  const signerStatus = (signer) => {
    const theirs = envelope.fields.filter((f) => f.signerId === signer.id);
    return theirs.length > 0 && theirs.every((f) => f.value);
  };

  const isTerminal = statusIsTerminal(envelope.status);

  /* Addresses the mail provider told us it could not deliver to.

     Recorded on the audit log by the Resend webhook rather than in a
     column, so it survives redeploys, appears on the certificate, and
     needed no schema change. Before this existed, a bounced invitation
     showed here as "pending" forever and the sender had no way to tell
     a slow signer from an address that never received anything. */
  const bounced = new Map();
  for (const e of envelope.auditLog || []) {
    if (e.type === "email_bounced" && e.email) bounced.set(String(e.email).toLowerCase(), e);
  }
  const anyPending = !isTerminal && envelope.signers.some(
    (s) => !signerStatus(s) && s.email && !s.isSelf
  );

  // Everyone who still owes a signature, in listed order. In sequential
  // mode only the first of them can actually sign right now, so only
  // that one is offered the in-person link — pointing at a signer the
  // server will refuse would be worse than not offering it.
  const outstanding = envelope.signers.filter((s) => !signerStatus(s) &&
    envelope.fields.some((f) => f.signerId === s.id));
  const inPersonEligible = isTerminal
    ? []
    : envelope.signingMode === "sequential" ? outstanding.slice(0, 1) : outstanding;
  const canSignInPerson = (s) => inPersonEligible.some((x) => x.id === s.id);

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "40px 20px", textAlign: "center" }}>
      {envelope.status === "completed" && <Seal label="COMPLETED" date={todayStr()} size={100} />}
      <h2 style={h2}>
        {envelope.status === "completed"
          ? "Envelope completed"
          : envelope.status === "declined"
          ? "Signing declined"
          : envelope.status === "voided"
          ? "Envelope voided"
          : envelope.status === "expired"
          ? "Envelope expired"
          : "Waiting on signers"}
      </h2>
      {envelope.documentName && (
        <p style={{ ...p, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>{envelope.documentName}</p>
      )}
      <p style={p}>
        Tracking {envelope.trackingId} · {envelope.pages.length} page{envelope.pages.length !== 1 ? "s" : ""}
        {envelope.status === "sent" && envelope.expiresAt
          ? ` · expires ${new Date(envelope.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
          : ""}
      </p>

      {envelope.status === "expired" && (
        <div style={{ background: "#FDF3F0", border: "1px solid #E7BCAE", borderRadius: 10, padding: "14px 16px", textAlign: "left", marginBottom: 20 }}>
          <p style={{ fontSize: 16, color: "#8A3212", lineHeight: 1.5, margin: 0 }}>
            This envelope reached its expiry date before everyone signed, so every signing link stopped
            working. Use <strong>Send another like this</strong> below to send it again with the same document
            and field layout.
          </p>
        </div>
      )}

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

      {envelope.status === "voided" && (() => {
        const ev = (envelope.auditLog || []).find((e) => e.type === "voided");
        return (
          <div style={{ background: "#FDF3F0", border: "1px solid #E7BCAE", borderRadius: 10, padding: "14px 16px", textAlign: "left", marginBottom: 20 }}>
            <p style={{ fontSize: 16, color: "#8A3212", lineHeight: 1.5, margin: 0 }}>
              The sender voided this envelope, so every signing link stopped working and it can never be
              completed.
              {ev?.reason ? <><br /><br />Reason given: &ldquo;{ev.reason}&rdquo;</> : null}
            </p>
          </div>
        );
      })()}

      <div style={{ background: "#fff", boxShadow: "var(--shadow)", borderRadius: 10, padding: 16, textAlign: "left", marginBottom: anyPending ? 12 : 24 }}>
        {envelope.signers.map((s) => {
          const complete = signerStatus(s);
          const bounceFor = (x) => (x.email ? bounced.get(String(x.email).toLowerCase()) : null);
          const canResend = !complete && !!s.email && !s.isSelf && !isTerminal;
          const msg = resendMsg[s.id];
          return (
            <div key={s.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {complete ? <Check size={16} color="#4E8B5A" /> : <Clock size={16} color="#9AA0AA" />}
                <div style={{ flex: 1, fontSize: 16, color: "var(--ink)" }}>{s.name}</div>
                <span style={{ fontSize: 16, fontFamily: "'Plus Jakarta Sans', sans-serif", color: complete ? "#4E8B5A" : bounceFor(s) ? "#C1440E" : "#9AA0AA" }}>
                  {complete ? "signed" : bounceFor(s) ? "undeliverable" : "pending"}
                </span>
              </div>

              {!complete && bounceFor(s) && (
                <div style={{ display: "flex", gap: 7, alignItems: "flex-start", paddingLeft: 24, marginTop: 6, fontSize: 13, lineHeight: 1.5, color: "#C1440E" }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>
                    {bounceFor(s).complaint
                      ? <>This signer marked the invitation as spam, so further email to <strong>{s.email}</strong> may not reach them.</>
                      : <>We couldn&apos;t deliver the invitation to <strong>{s.email}</strong> — their mail server rejected it, so they never received the link.</>}
                    {" "}Resending won&apos;t help if the address itself is wrong. Check it, then use <strong>Send another like this</strong> below to send a corrected copy.
                  </span>
                </div>
              )}

              {canSignInPerson(s) && (
                <div style={{ paddingLeft: 24, marginTop: 6 }}>
                  <a
                    href={`/sign/${id}/${s.id}`}
                    style={{ ...resendBtn, textDecoration: "none", cursor: "pointer" }}
                  >
                    <PenTool size={13} style={{ marginRight: 5 }} />
                    Sign in person
                  </a>
                  <span style={{ fontSize: 13, color: "#9AA0AA", marginLeft: 8 }}>
                    opens their signing page on this device
                  </span>
                </div>
              )}

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

      {envelope.status === "sent" && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 18, marginBottom: 24, textAlign: "left" }}>
          {voidMsg ? (
            <p style={{ fontSize: 16, lineHeight: 1.5, margin: 0, color: voidMsg.ok ? "#4E8B5A" : "#C1440E" }}>
              {voidMsg.text}
            </p>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "#8A8F98", lineHeight: 1.5, margin: "0 0 8px" }}>
                Sent this to the wrong person, or need to start over? Voiding cancels the envelope and kills
                every signing link. We'll email the sender a confirmation link first — nothing changes until
                it's clicked.
              </p>
              <button
                type="button"
                onClick={requestVoid}
                disabled={voidRequesting}
                style={{ ...voidBtn, opacity: voidRequesting ? 0.55 : 1, cursor: voidRequesting ? "default" : "pointer" }}
              >
                {voidRequesting
                  ? <Loader2 size={13} className="spin" style={{ marginRight: 5 }} />
                  : <Ban size={13} style={{ marginRight: 5 }} />}
                {voidRequesting ? "Sending…" : "Void this envelope"}
              </button>
            </>
          )}
        </div>
      )}

      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 18, marginBottom: 24, textAlign: "left" }}>
        {!showCopy ? (
          <>
            <p style={{ fontSize: 13, color: "#8A8F98", lineHeight: 1.5, margin: "0 0 8px" }}>
              Need to send this same document again — a new tenant, another client, next quarter? Reuse
              this document and its field layout without setting any of it up again. Signatures are not
              copied, and it is a new envelope at the usual flat price.
            </p>
            <button type="button" onClick={openCopy} style={{ ...resendBtn, cursor: "pointer" }}>
              <Copy size={13} style={{ marginRight: 5 }} /> Send another like this
            </button>
          </>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: "#8A8F98", lineHeight: 1.5, margin: "0 0 10px" }}>
              Same document, same fields. Change who signs it, then continue to payment. To add or remove
              signers you will need to build a new envelope, because the fields are attached to these ones.
            </p>
            {copySigners.map((s, i) => (
              <div key={s.id} style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <input
                  value={s.name}
                  onChange={(e) => setCopySigners((cs) => cs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  placeholder="Name"
                  style={{ ...inputStyle, flex: "1 1 120px", padding: "7px 10px" }}
                />
                <input
                  value={s.email}
                  onChange={(e) => setCopySigners((cs) => cs.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))}
                  placeholder={s.isSelf ? "you sign this one" : "email address"}
                  disabled={s.isSelf}
                  style={{ ...inputStyle, flex: "1 1 160px", padding: "7px 10px", opacity: s.isSelf ? 0.55 : 1 }}
                />
              </div>
            ))}
            {copyError && <p style={{ color: "#C1440E", fontSize: 14, margin: "6px 0" }}>{copyError}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setShowCopy(false)}
                disabled={copying}
                style={{ flex: 1, border: "1px solid var(--line)", background: "#fff", borderRadius: 7, padding: "10px 14px", fontSize: 16, color: "#5B5F6B", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendCopy}
                disabled={copying}
                style={{ ...primaryBtn, flex: 1, opacity: copying ? 0.6 : 1 }}
              >
                {copying ? <Loader2 size={15} className="spin" style={{ marginRight: 6 }} /> : null}
                {copying ? "Starting checkout…" : "Continue to payment"}
                {!copying && <ArrowRight size={14} style={{ marginLeft: 6 }} />}
              </button>
            </div>
          </div>
        )}
      </div>

      {envelope.status === "completed" && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 16 }}>
            <ShieldCheck size={16} color="var(--teal)" />
            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, letterSpacing: 1, color: "#8A8F98" }}>
              {envelope.pages.length} page{envelope.pages.length !== 1 ? "s" : ""} + audit certificate, in one PDF
            </span>
          </div>

          {/* Built on the server. The browser used to flatten every page
              onto a canvas here, which could exhaust memory on a long
              document — this is just a download now. */}
          <a href={`/api/envelopes/${id}/pdf`} style={dlBtn}>
            <Download size={17} style={{ marginRight: 8 }} /> Download signed document (PDF)
          </a>

          {envelope.documentHash && (
            <p style={{ fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#9AA0AA", marginTop: 14, wordBreak: "break-all" }}>
              sha256 {envelope.documentHash}
            </p>
          )}
          <p style={{ fontSize: 13, lineHeight: 1.5, color: "#9AA0AA", marginTop: 16 }}>
            Save a copy for your records. You can always come back to this page, or use{" "}
            <a href="/find-my-document" style={{ color: "#9AA0AA" }}>find my document</a> if you lose the link.
          </p>
        </div>
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

const voidBtn = {
  border: "1px solid #E7BCAE", background: "#fff", borderRadius: 20,
  padding: "5px 12px", fontSize: 13, color: "#8A3212",
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  display: "inline-flex", alignItems: "center",
};

function Centered({ children }) {
  return <div style={{ maxWidth: 420, margin: "0 auto", padding: "80px 20px", textAlign: "center" }}>{children}</div>;
}
