"use client";
import { useEffect, useState } from "react";
import { Download, Check, Clock, ShieldCheck, Loader2 } from "lucide-react";
import Logo from "@/components/Logo";
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
          const hash = await hashPages(finalPages);
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
              <div style={{ flex: 1, fontSize: 16, color: "var(--ink)" }}>{s.name}</div>
              <span style={{ fontSize: 16, fontFamily: "'Plus Jakarta Sans', sans-serif", color: complete ? "#4E8B5A" : "#9AA0AA" }}>{complete ? "signed" : "pending"}</span>
            </div>
          );
        })}
      </div>

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

function Centered({ children }) {
  return <div style={{ maxWidth: 420, margin: "0 auto", padding: "80px 20px", textAlign: "center" }}>{children}</div>;
}
