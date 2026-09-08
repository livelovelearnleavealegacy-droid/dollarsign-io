// Server-side assembly of the final signed PDF.
//
// This replaces an earlier client-side build that flattened each page
// onto a canvas in the recipient's browser. That worked, but a
// hundred-page envelope on a phone is a real memory risk, and when it
// failed the only feedback was "Something went wrong building the final
// document." Building here removes that failure mode entirely.
//
// Deliberately no custom font. Typed signatures are rasterised to PNG
// at signing time (see components/SignaturePad.jsx), so every signature
// arrives as an image and nothing here needs Caveat. Legacy envelopes
// signed before that change still carry { type: "text" } values and
// fall back to an oblique standard font.

import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getPageFile } from "@/lib/db";

const INK = rgb(0x10 / 255, 0x2a / 255, 0x43 / 255);
const GRAY = rgb(0x5b / 255, 0x5f / 255, 0x6b / 255);
const FAINT = rgb(0x9a / 255, 0xa0 / 255, 0xaa / 255);
const LINE = rgb(0xda / 255, 0xdc / 255, 0xe0 / 255);

function pagesDir() {
  const dbPath = process.env.DB_PATH || path.join(process.cwd(), "dollarsign.db");
  return path.join(path.dirname(dbPath), "pages");
}

function dataUrlToBytes(dataUrl) {
  const comma = dataUrl.indexOf(",");
  return Buffer.from(dataUrl.slice(comma + 1), "base64");
}

async function embedByMime(pdfDoc, bytes, mime) {
  if (mime === "image/png") return pdfDoc.embedPng(bytes);
  if (mime === "image/jpeg" || mime === "image/jpg") return pdfDoc.embedJpg(bytes);
  // Fall back on the magic bytes rather than trusting the recorded mime.
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return pdfDoc.embedPng(bytes);
  return pdfDoc.embedJpg(bytes);
}

/**
 * Builds the complete document: every page with its field values burned
 * in, followed by the Certificate of Completion. Returns raw PDF bytes.
 */
export async function buildEnvelopePdf(envelope) {
  const pdfDoc = await PDFDocument.create();
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const courier = await pdfDoc.embedFont(StandardFonts.Courier);

  for (const page of envelope.pages) {
    const row = getPageFile(page.id);
    if (!row) throw new Error(`page file missing for ${page.id}`);
    const bytes = fs.readFileSync(path.join(pagesDir(), row.filename));
    const img = await embedByMime(pdfDoc, bytes, row.mime);

    const W = img.width, H = img.height;
    const pdfPage = pdfDoc.addPage([W, H]);
    pdfPage.drawImage(img, { x: 0, y: 0, width: W, height: H });

    for (const f of envelope.fields.filter((x) => x.pageId === page.id)) {
      if (!f.value) continue;
      // Field coordinates are percentages measured from the TOP-LEFT of
      // the page, matching the editor. PDF space runs from the BOTTOM
      // left, so every y is flipped here.
      const px = (f.x / 100) * W;
      const py = (f.y / 100) * H;
      const y = H - py;

      if (f.kind === "date") {
        pdfPage.drawText(String(f.value), { x: px, y, size: Math.round(W * 0.016), font: helv, color: INK });
      } else if (f.kind === "text") {
        pdfPage.drawText(String(f.value), { x: px, y, size: Math.round(W * 0.018), font: helv, color: INK });
      } else if (f.value?.type === "image") {
        const sig = await pdfDoc.embedPng(dataUrlToBytes(f.value.data));
        const w = W * 0.16;
        const h = w * (sig.height / sig.width);
        // The canvas version drew the signature sitting ON the line, so
        // its bottom edge lands on the field's y position.
        pdfPage.drawImage(sig, { x: px, y, width: w, height: h });
      } else if (f.value?.type === "text") {
        // Legacy: signed before typed signatures were rasterised.
        pdfPage.drawText(String(f.value.data), { x: px, y, size: Math.round(W * 0.035), font: helvOblique, color: INK });
      }
    }
  }

  addCertificate(pdfDoc, envelope, { helv, helvBold, courier });
  return await pdfDoc.save();
}

/* The Certificate of Completion, drawn with PDF primitives rather than
   rasterised from a canvas. Letter-sized so it prints cleanly regardless
   of the document's own page dimensions. */
function addCertificate(pdfDoc, envelope, fonts) {
  const { helv, helvBold, courier } = fonts;
  const W = 612, H = 792, left = 54;
  let page = pdfDoc.addPage([W, H]);
  let y = H - 64;

  const text = (s, opts) => page.drawText(s, opts);
  const newPageIfNeeded = (needed) => {
    if (y - needed < 60) { page = pdfDoc.addPage([W, H]); y = H - 64; }
  };

  text("DollarSign.io", { x: left, y, size: 18, font: helvBold, color: INK });
  text("Certificate of Completion", { x: left, y: y - 24, size: 15, font: helvBold, color: INK });
  y -= 56;

  page.drawLine({ start: { x: left, y }, end: { x: W - left, y }, color: LINE, thickness: 1 });
  y -= 26;

  const row = (label, value) => {
    text(label, { x: left, y, size: 9.5, font: helv, color: FAINT });
    text(String(value ?? "—"), { x: left + 130, y, size: 9.5, font: courier, color: GRAY });
    y -= 17;
  };
  if (envelope.documentName) row("Document", envelope.documentName.slice(0, 58));
  row("Tracking ID", envelope.trackingId);
  row("Pages", envelope.pages.length);
  row("Status", envelope.status);
  row("Signers", envelope.signers.length);

  y -= 6;
  text("Document fingerprint (SHA-256)", { x: left, y, size: 9.5, font: helv, color: FAINT });
  y -= 15;
  const hash = envelope.documentHash || "not recorded";
  for (const chunk of hash.match(/.{1,64}/g) || [hash]) {
    text(chunk, { x: left, y, size: 8, font: courier, color: GRAY });
    y -= 12;
  }
  y -= 10;
  page.drawLine({ start: { x: left, y }, end: { x: W - left, y }, color: LINE, thickness: 1 });
  y -= 28;

  text("Signing events", { x: left, y, size: 12, font: helvBold, color: INK });
  y -= 22;

  const shown = ["created", "consent", "signed", "completed", "declined", "voided", "invite_resent"];
  for (const e of (envelope.auditLog || []).filter((x) => shown.includes(x.type))) {
    newPageIfNeeded(46);
    const heading =
      e.type === "created" ? `Envelope created by ${e.senderName || "sender"}`
      : e.type === "consent" ? `Consented to sign electronically — ${e.signerName || "signer"}`
      : e.type === "signed" ? `Signed by ${e.signerName || "signer"}${e.attested ? " (affirmed signing intent)" : ""}`
      : e.type === "completed" ? "All signatures collected"
      : e.type === "declined" ? `Declined by ${e.signerName || "signer"}`
      : e.type === "voided" ? "Voided by the sender"
      : `Invitation resent to ${e.signerEmail || "signer"}`;
    text(heading.slice(0, 92), { x: left, y, size: 9.5, font: helvBold, color: INK });
    y -= 13;
    // System events (completion) have no actor, so no IP is claimed for
    // them — "IP unknown" would imply one was expected and missing.
    const who = e.signerEmail || e.senderEmail;
    const meta = e.ip
      ? `${fmt(e.at)}   ·   IP ${e.ip}${who ? "   ·   " + who : ""}`
      : fmt(e.at);
    text(meta.slice(0, 104), { x: left, y, size: 7.5, font: courier, color: GRAY });
    y -= 11;
    if (e.userAgent) { text(e.userAgent.slice(0, 104), { x: left, y, size: 7, font: courier, color: FAINT }); y -= 11; }
    if (e.reason) { text(`Reason: ${e.reason}`.slice(0, 104), { x: left, y, size: 7.5, font: helv, color: GRAY }); y -= 11; }
    y -= 8;
  }

  newPageIfNeeded(70);
  y -= 10;
  page.drawLine({ start: { x: left, y }, end: { x: W - left, y }, color: LINE, thickness: 1 });
  y -= 18;
  const disclaimer = "This certificate records the IP address, timestamp, and browser reported by each signer's device at the moment they acted, captured server-side. It is an audit trail, not a legal opinion — consult counsel on what your use case requires under the ESIGN Act or applicable law.";
  for (const line of wrap(disclaimer, helv, 7.5, W - left * 2)) {
    text(line, { x: left, y, size: 7.5, font: helv, color: FAINT });
    y -= 10;
  }
}

function wrap(s, font, size, maxWidth) {
  const words = s.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(next, size) > maxWidth) { lines.push(cur); cur = w; }
    else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function fmt(iso) {
  if (!iso) return "unknown time";
  const d = new Date(iso);
  return isNaN(d) ? String(iso) : d.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
}
