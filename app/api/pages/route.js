import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import { insertPageFile } from "@/lib/db";

const PAGES_DIR = path.join(
  path.dirname(process.env.DB_PATH || path.join(process.cwd(), "dollarsign.db")),
  "pages"
);
fs.mkdirSync(PAGES_DIR, { recursive: true });

const EXT_BY_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Receives one page image at a time as multipart/form-data — never a
// giant JSON blob. Saved straight to the same persistent volume the
// SQLite database lives on, so it survives redeploys the same way.
export async function POST(req) {
  const formData = await req.formData();
  const file = formData.get("file");
  const width = parseInt(formData.get("width"), 10) || null;
  const height = parseInt(formData.get("height"), 10) || null;
  // Which source PDF page this render came from, if any. Recorded here
  // so the envelope route can look the link up instead of trusting a
  // client to declare it.
  const sourceId = formData.get("sourceId") || null;
  const sourcePage = parseInt(formData.get("sourcePage"), 10) || null;

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "no file provided" }, { status: 400 });
  }

  const ext = EXT_BY_MIME[file.type];
  if (!ext) {
    return NextResponse.json({ error: `unsupported file type: ${file.type}` }, { status: 400 });
  }

  const id = randomUUID();
  const filename = `${id}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(PAGES_DIR, filename), buffer);

  insertPageFile({ id, filename, mime: file.type, width, height, sourceId, sourcePage });

  return NextResponse.json({ id, width, height });
}
