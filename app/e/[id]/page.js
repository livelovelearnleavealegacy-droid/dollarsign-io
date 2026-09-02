"use client";
import { useEffect, useState } from "react";
import { Download, Check, Clock, ShieldCheck } from "lucide-react";
import Logo from "@/components/Logo";
import Seal from "@/components/Seal";
import { todayStr } from "@/lib/shared";
import { buildFinalPages, hashPages, buildCertificatePage } from "@/lib/compositePages";

export default function EnvelopeStatusPage({ params }) {
  const { id } = params;
  const [envelope, setEnvelope] = useState(null);
  const [error, setError] = useState(null);
  const [finalPages, setFinalPages] = useState([]);
  const [certificateUrl, setCertificateUrl] = useState(null);
  const [documentHash, setDocumentHash] = useState(null);
  const [building, setBuilding] = useState(false);

  useEffect(() => {
    fetch(`/api/envelopes/${id}`)
      .then((r) => { if (!r.ok) throw new Error("Envelope not found."); return r.json(); })
      .then(setEnvelope)
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (envelope?.status === "completed" && finalPages.length === 0 && !building) {
      setBuilding(true);
      (async () => {
        const pages = await buildFinalPages(envelope.pages, envelope.fields);
        const hash = await hashPages(pages);
        const cert = await buildCertificatePage(envelope, hash);
        setFinalPages(pages);
        setDocumentHash(hash);
        setCertificateUrl(cert);
        setBuilding(false);
      })();
    }
  }, [envelope, finalPages.length, building]);

  if (error) return <Centered><Logo size={40} /><h2 style={h2}>Can't find that envelope</h2><p style={p}>{error}</p></Centered>;
  if (!envelope) return <Centered><Logo size={40} /><h2 style={h2}>Loading…</h2></Centered>;

  const signerStatus = (signer) => {
    const theirs = envelope.fields.filter((f) => f.signerId === signer.id);
    return theirs.length > 0 && theirs.every((f) => f.value);
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "40px 20px", textAlign: "center" }}>
      {envelope.status === "completed" ? (
        <Seal label="COMPLETED" date={todayStr()} size={100} />
      ) : (
        <Logo size={56} />
      )}
      <h2 style={h2}>{envelope.status === "completed" ? "Envelope completed" : "Waiting on signers"}</h2>
      <p style={p}>Tracking {envelope.trackingId} · {envelope.pages.length} page{envelope.pages.length !== 1 ? "s" : ""}</p>

      <div style={{ background: "#fff", boxShadow: "var(--shadow)", borderRadius: 10, padding: 16, textAlign: "left", marginBottom: 24 }}>
        {envelope.signers.map((s) => {
          const complete = signerStatus(s);
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              {complete ? <Check size={16} color="#4E8B5A" /> : <Clock size={16} color="#9AA0AA" />}
              <div style={{ flex: 1, fontSize: 13, color: "var(--ink)" }}>{s.name}</div>
              <span style={{ fontSize: 10.5, fontFamily: "'IBM Plex Mono', monospace", color: complete ? "#4E8B5A" : "#9AA0AA" }}>{complete ? "signed" : "pending"}</span>
            </div>
          );
        })}
      </div>

      {envelope.status === "completed" && (
        building ? (
          <p style={{ fontSize: 13, color: "#8A8F98" }}>Flattening pages and building the audit certificate…</p>
        ) : (
          <>
            {finalPages.map((fp, i) => (
              <div key={fp.id} style={{ marginBottom: 18 }}>
                <img src={fp.url} alt={`signed page ${i + 1}`} style={{ width: "100%", borderRadius: 8, border: "1px solid var(--line)", marginBottom: 8 }} />
                <a href={fp.url} download={`${envelope.trackingId}-page${i + 1}.png`} style={dlBtn}>
                  <Download size={15} style={{ marginRight: 6 }} /> Download page {i + 1}
                </a>
              </div>
            ))}

            {certificateUrl && (
              <div style={{ marginTop: 30, paddingTop: 24, borderTop: "1px solid var(--line)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 12 }}>
                  <ShieldCheck size={16} color="var(--teal)" />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1, color: "#8A8F98" }}>AUDIT CERTIFICATE</span>
                </div>
                <img src={certificateUrl} alt="certificate of completion" style={{ width: "100%", borderRadius: 8, border: "1px solid var(--line)", marginBottom: 8 }} />
                <a href={certificateUrl} download={`${envelope.trackingId}-certificate.png`} style={dlBtn}>
                  <Download size={15} style={{ marginRight: 6 }} /> Download certificate
                </a>
                <p style={{ fontSize: 10.5, fontFamily: "'IBM Plex Mono', monospace", color: "#9AA0AA", marginTop: 10, wordBreak: "break-all" }}>
                  sha256 {documentHash}
                </p>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}

const h2 = { fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600, margin: "18px 0 6px", color: "var(--ink)" };
const p = { color: "#5B5F6B", fontSize: 14, marginBottom: 20 };
const dlBtn = { background: "var(--accent)", color: "#fff", borderRadius: 7, padding: "11px 18px", fontSize: 14, fontWeight: 600, display: "flex", justifyContent: "center", alignItems: "center", textDecoration: "none" };

function Centered({ children }) {
  return <div style={{ maxWidth: 420, margin: "0 auto", padding: "80px 20px", textAlign: "center" }}>{children}</div>;
}
