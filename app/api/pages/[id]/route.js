import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getPageFile } from "@/lib/db";

const PAGES_DIR = path.join(
  path.dirname(process.env.DB_PATH || path.join(process.cwd(), "dollarsign.db")),
  "pages"
);

// Serves a single page image by id. Cached aggressively since a page's
// image, once uploaded, never changes.
export async function GET(req, { params }) {
  const page = getPageFile(params.id);
  if (!page) return NextResponse.json({ error: "not found" }, { status: 404 });

  const filePath = path.join(PAGES_DIR, page.filename);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "file missing on disk" }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": page.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
