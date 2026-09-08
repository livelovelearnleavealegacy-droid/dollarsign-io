// Flattens signature/date/text field values onto each page image,
// producing downloadable PNGs. Runs client-side (needs the DOM canvas).

export function buildFinalPages(pages, fields) {
  return Promise.all(pages.map((page) => new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = page.w;
    canvas.height = page.h;
    const ctx = canvas.getContext("2d");
    const base = new Image();
    base.onload = async () => {
      ctx.drawImage(base, 0, 0, page.w, page.h);
      const pf = fields.filter((f) => f.pageId === page.id);
      for (const f of pf) {
        if (!f.value) continue;
        const px = (f.x / 100) * page.w, py = (f.y / 100) * page.h;
        if (f.kind === "date") {
          ctx.font = `${Math.round(page.w * 0.016)}px 'Plus Jakarta Sans', sans-serif`;
          ctx.fillStyle = "#102A43";
          ctx.fillText(f.value, px, py);
        } else if (f.kind === "text") {
          ctx.font = `${Math.round(page.w * 0.018)}px 'Plus Jakarta Sans', sans-serif`;
          ctx.fillStyle = "#102A43";
          ctx.fillText(f.value, px, py);
        } else if (f.value.type === "text") {
          ctx.font = `${Math.round(page.w * 0.04)}px 'Caveat', cursive`;
          ctx.fillStyle = "#102A43";
          ctx.fillText(f.value.data, px, py);
        } else {
          await new Promise((res) => {
            const sigImg = new Image();
            sigImg.onload = () => {
              const w = page.w * 0.16, h = w * (sigImg.height / sigImg.width);
              ctx.drawImage(sigImg, px, py - h, w, h);
              res();
            };
            sigImg.src = f.value.data;
          });
        }
      }
      resolve({ id: page.id, url: canvas.toDataURL("image/png"), w: page.w, h: page.h });
    };
    base.src = page.src;
  })));
}

/** SHA-256 fingerprint of the final flattened pages, for tamper-evidence on the certificate. */
export async function hashPages(finalPages) {
  const concatenated = finalPages.map((p) => p.url).join("|");
  const bytes = new TextEncoder().encode(concatenated);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Renders a one-page "Certificate of Completion": tracking ID, document
 * fingerprint, and every signing event from the server-recorded audit
 * log (IP, timestamp, user agent — captured server-side, not client-
 * reported, which is what gives it evidentiary weight).
 */
export async function buildCertificatePage(envelope, documentHash) {
  const W = 1700, H = 2200;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  let y = 130;
  const left = 110;
  const ink = "#102A43";
  const gray = "#5B5F6B";
  const line = "#DADCE0";

  // Wordmark
  ctx.fillStyle = ink;
  ctx.font = "700 44px Georgia, serif";
  ctx.fillText("DollarSign", left, y);
  const w1 = ctx.measureText("DollarSign").width;
  ctx.fillStyle = "#2DD4BF";
  ctx.fillText(".io", left + w1, y);

  y += 60;
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(W - left, y); ctx.stroke();

  y += 70;
  ctx.fillStyle = ink;
  ctx.font = "600 40px Georgia, serif";
  ctx.fillText("Certificate of Completion", left, y);

  y += 50;
  ctx.font = "16px monospace";
  ctx.fillStyle = gray;
  ctx.fillText(`Tracking ID   ${envelope.trackingId}`, left, y);
  y += 28;
  ctx.fillText(`Pages          ${envelope.pages.length}`, left, y);
  y += 28;
  ctx.fillText(`Status          ${envelope.status}`, left, y);
  y += 28;
  ctx.fillText(`Document hash (SHA-256)`, left, y);
  y += 26;
  ctx.font = "14px monospace";
  wrapMono(ctx, documentHash, left, y, W - left * 2, 20);
  y += 46;

  y += 20;
  ctx.strokeStyle = line;
  ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(W - left, y); ctx.stroke();
  y += 50;

  ctx.font = "600 24px Georgia, serif";
  ctx.fillStyle = ink;
  ctx.fillText("Signing events", left, y);
  y += 20;

  const events = (envelope.auditLog || []).filter((e) => e.type === "created" || e.type === "consent" || e.type === "signed");
  for (const e of events) {
    y += 46;
    if (y > H - 160) break; // simple guard against overflow on huge audit logs
    ctx.font = "600 18px 'Helvetica Neue', Arial, sans-serif";
    ctx.fillStyle = ink;
    const heading = e.type === "created"
      ? `Envelope created by ${e.senderName || "sender"}`
      : e.type === "consent"
      ? `Consented to sign electronically — ${e.signerName || "signer"}`
      : `Signed by ${e.signerName || "signer"}${e.attested ? " (affirmed signing intent)" : ""}`;
    ctx.fillText(heading, left, y);
    y += 26;
    ctx.font = "13.5px monospace";
    ctx.fillStyle = gray;
    const email = e.signerEmail || e.senderEmail;
    ctx.fillText(`${formatTs(e.at)}   ·   IP ${e.ip || "unknown"}${email ? "   ·   " + email : ""}`, left, y);
    y += 22;
    ctx.fillText(truncate(e.userAgent || "", 100), left, y);
  }

  y = H - 100;
  ctx.strokeStyle = line;
  ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(W - left, y); ctx.stroke();
  y += 34;
  ctx.font = "12.5px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillStyle = "#9AA0AA";
  wrapText(
    ctx,
    "This certificate records the IP address, timestamp, and browser reported by each signer's device at the moment they submitted their signature, captured server-side. It is an audit trail, not a legal opinion — consult counsel on what your use case requires under the ESIGN Act or applicable law.",
    left, y, W - left * 2, 18
  );

  return { url: canvas.toDataURL("image/png"), w: W, h: H };
}

/**
 * Assembles every flattened page plus the certificate into a single
 * downloadable PDF, using pdf-lib (runs entirely in the browser — no
 * server round-trip needed). Each PNG becomes one PDF page, sized to
 * match the image's own pixel dimensions.
 */
export async function buildFinalPdf(finalPages, certificate) {
  const { PDFDocument } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.create();

  const dataUrlToBytes = async (dataUrl) => {
    const res = await fetch(dataUrl);
    return new Uint8Array(await res.arrayBuffer());
  };

  for (const page of finalPages) {
    const bytes = await dataUrlToBytes(page.url);
    const png = await pdfDoc.embedPng(bytes);
    const pdfPage = pdfDoc.addPage([png.width, png.height]);
    pdfPage.drawImage(png, { x: 0, y: 0, width: png.width, height: png.height });
  }

  if (certificate) {
    const bytes = await dataUrlToBytes(certificate.url);
    const png = await pdfDoc.embedPng(bytes);
    const pdfPage = pdfDoc.addPage([png.width, png.height]);
    pdfPage.drawImage(png, { x: 0, y: 0, width: png.width, height: png.height });
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: "application/pdf" });
}

function formatTs(iso) {
  if (!iso) return "unknown time";
  const d = new Date(iso);
  return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "medium" }) + " (" + iso + ")";
}
function truncate(s, n) { return s.length > n ? s.slice(0, n) + "…" : s; }
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word + " ";
      y += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, y);
}
function wrapMono(ctx, text, x, y, maxWidth, lineHeight) {
  const charsPerLine = Math.floor(maxWidth / 8.5);
  for (let i = 0; i < text.length; i += charsPerLine) {
    ctx.fillText(text.slice(i, i + charsPerLine), x, y);
    y += lineHeight;
  }
}
