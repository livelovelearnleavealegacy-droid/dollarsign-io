import { NextResponse } from "next/server";
import { randomUUID, createHash } from "crypto";
import path from "path";
import fs from "fs";
import { insertSourceFile } from "@/lib/db";

/**
 * Stores the ORIGINAL uploaded PDF.
 *
 * Until now the original was thrown away: every page was rasterised to a
 * JPEG in the browser and the finished document was assembled from those
 * pictures. That worked, but it meant the thing a customer received was
 * a photograph of their contract — not selectable, not searchable, and
 * several times larger than the file they started with.
 *
 * Keeping the source lets lib/pdfBuild.js stamp signatures onto the real
 * pages instead. The rendered images stay, but only as preview material
 * for the editor and signing page, so they no longer have to be
 * high-resolution.
 */

const SOURCES_DIR = path.join(
  path.dirname(process.env.DB_PATH || path.join(process.cwd(), "dollarsign.db")),
  "sources"
);
fs.mkdirSync(SOURCES_DIR, { recursive: true });

// A source is only useful if pdf-lib can later reopen it. Anything else
// simply doesn't get one, and those pages fall back to the raster path.
const MAX_SOURCE_BYTES = 50 * 1024 * 1024;

export async function POST(req) {
  const formData = await req.formData();
  const file = formData.get("file");
  const pageCount = parseInt(formData.get("pageCount"), 10) || null;

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "no file provided" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: `unsupported source type: ${file.type}` }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MAX_SOURCE_BYTES) {
    return NextResponse.json({ error: "that file is too large to keep as a source" }, { status: 413 });
  }
  // Trust the magic bytes over the declared type.
  if (buffer.slice(0, 5).toString("latin1") !== "%PDF-") {
    return NextResponse.json({ error: "that file is not a PDF" }, { status: 400 });
  }

  const id = randomUUID();
  const filename = `${id}.pdf`;
  fs.writeFileSync(path.join(SOURCES_DIR, filename), buffer);

  // Hashed once, here, so the document fingerprint never has to re-read
  // a large file at completion time.
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  insertSourceFile({ id, filename, mime: "application/pdf", pageCount, sha256 });

  return NextResponse.json({ id, pageCount, bytes: buffer.length });
}
