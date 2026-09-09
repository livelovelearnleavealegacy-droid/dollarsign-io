import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  listPageFileRows,
  listReferencedPageIds,
  listSourceFileRows,
  listReferencedSourceIds,
  deletePageFile,
  deleteSourceFile,
} from "@/lib/db";

// Deletes page images and source PDFs that no envelope references.
//
// DRY RUN BY DEFAULT. Nothing is deleted unless the request explicitly
// says apply=1. The report at /api/admin/orphans deliberately deleted
// nothing at all; this is the same accounting with a switch, and the
// switch is off unless somebody reaches for it.
//
// Two guards that matter more than they look:
//
//   1. Minimum age. A page file is written BEFORE the envelope that
//      references it exists — that is how the upload flow works — so a
//      file created seconds ago is not an orphan, it is an envelope
//      mid-creation. Deleting it would destroy a document somebody is
//      in the middle of preparing. Default 7 days, never below 1.
//
//   2. Bytes first, row second. If the file is removed and the row
//      survives, the orphan report shows it as missingOnDisk — visible,
//      fixable. If the row went first and the delete failed, the bytes
//      would sit on the volume with nothing pointing at them: invisible
//      waste, which is exactly how 843 MB hid last time.
//
// Gated on ADMIN_TOKEN. With the variable unset the route 404s.
export const dynamic = "force-dynamic";

const DEFAULT_MIN_AGE_DAYS = 7;

export async function POST(req) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return NextResponse.json({ error: "not found" }, { status: 404 });
  const url = new URL(req.url);
  const provided = req.headers.get("x-admin-token") || url.searchParams.get("token");
  if (provided !== expected) return NextResponse.json({ error: "not found" }, { status: 404 });

  const apply = url.searchParams.get("apply") === "1";
  const requestedAge = Number(url.searchParams.get("minAgeDays"));
  const minAgeDays = Number.isFinite(requestedAge) && requestedAge >= 1 ? requestedAge : DEFAULT_MIN_AGE_DAYS;
  const cutoff = Date.now() - minAgeDays * 864e5;

  const dbPath = process.env.DB_PATH || path.join(process.cwd(), "dollarsign.db");
  const pagesDir = path.join(path.dirname(dbPath), "pages");
  const sourcesDir = path.join(path.dirname(dbPath), "sources");

  const result = {
    mode: apply ? "APPLIED — files deleted" : "dry run — nothing deleted",
    minAgeDays,
    pageImages: { candidates: 0, deleted: 0, freedMb: 0, skippedTooNew: 0, errors: [] },
    sourcePdfs: { candidates: 0, deleted: 0, freedMb: 0, skippedTooNew: 0, errors: [] },
    examples: [],
  };

  const sweep = (rows, referenced, dir, bucket, remove, kind) => {
    let freed = 0;
    for (const row of rows) {
      if (referenced.has(row.id)) continue;
      const full = path.join(dir, row.filename);
      let st;
      try { st = fs.statSync(full); }
      catch {
        // No bytes on disk. The row is the only thing left, and it
        // points at nothing — safe to drop, and leaving it would keep
        // inflating every count in the orphan report.
        bucket.candidates++;
        if (apply) { try { remove(row.id); bucket.deleted++; } catch (e) { bucket.errors.push(`${row.id}: ${e.message}`); } }
        continue;
      }
      if (st.mtimeMs > cutoff) { bucket.skippedTooNew++; continue; }

      bucket.candidates++;
      if (result.examples.length < 25) {
        result.examples.push({ kind, id: row.id, sizeKb: Math.round(st.size / 1024), ageDays: +((Date.now() - st.mtimeMs) / 864e5).toFixed(1) });
      }
      if (!apply) { freed += st.size; continue; }

      try {
        fs.unlinkSync(full);        // bytes first
        remove(row.id);             // row second
        bucket.deleted++;
        freed += st.size;
      } catch (e) {
        bucket.errors.push(`${row.id}: ${e.message}`);
      }
    }
    bucket.freedMb = +(freed / 1048576).toFixed(2);
  };

  sweep(listPageFileRows(), listReferencedPageIds(), pagesDir, result.pageImages, deletePageFile, "page");
  sweep(listSourceFileRows(), listReferencedSourceIds(), sourcesDir, result.sourcePdfs, deleteSourceFile, "source");

  result.totalFreedMb = +(result.pageImages.freedMb + result.sourcePdfs.freedMb).toFixed(2);
  if (!apply) result.next = "Re-send with ?apply=1 to actually delete these files.";

  return NextResponse.json(result);
}
