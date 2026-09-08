import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { listPageFileRows, listReferencedPageIds } from "@/lib/db";

// READ ONLY. Reports which page files are no longer referenced by any
// envelope, how old they are, and what they cost in disk.
//
// Deliberately deletes nothing. Page images are the record, not a
// cache — an envelope's PDF can always be rebuilt from them, but
// nothing can rebuild them. Before writing a delete rule we want to see
// real data rather than imagine what an orphan looks like.
//
// Gated on ADMIN_TOKEN. With the variable unset the route 404s, so an
// unconfigured deploy exposes nothing.
export async function GET(req) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return NextResponse.json({ error: "not found" }, { status: 404 });
  const provided = req.headers.get("x-admin-token") || new URL(req.url).searchParams.get("token");
  if (provided !== expected) return NextResponse.json({ error: "not found" }, { status: 404 });

  const dbPath = process.env.DB_PATH || path.join(process.cwd(), "dollarsign.db");
  const dir = path.join(path.dirname(dbPath), "pages");

  const rows = listPageFileRows();
  const referenced = listReferencedPageIds();

  const now = Date.now();
  let orphanBytes = 0, referencedBytes = 0, missingOnDisk = 0;
  const buckets = { "under 24h": 0, "1-7 days": 0, "7-30 days": 0, "over 30 days": 0 };
  const oldest = [];

  for (const r of rows) {
    let size = 0, mtime = null;
    try { const st = fs.statSync(path.join(dir, r.filename)); size = st.size; mtime = st.mtimeMs; }
    catch { missingOnDisk++; continue; }

    if (referenced.has(r.id)) { referencedBytes += size; continue; }

    orphanBytes += size;
    const ageMs = now - mtime;
    const ageH = ageMs / 36e5;
    // Anything very recent may simply be mid-upload: a page is written
    // before the envelope that references it exists. Never treat those
    // as orphans.
    if (ageH < 24) buckets["under 24h"]++;
    else if (ageH < 24 * 7) buckets["1-7 days"]++;
    else if (ageH < 24 * 30) buckets["7-30 days"]++;
    else buckets["over 30 days"]++;
    oldest.push({ id: r.id, filename: r.filename, sizeKb: Math.round(size / 1024), ageDays: +(ageMs / 864e5).toFixed(1) });
  }

  oldest.sort((a, b) => b.ageDays - a.ageDays);
  const mb = (b) => +(b / 1048576).toFixed(2);

  return NextResponse.json({
    note: "Read-only report. Nothing is deleted. Files under 24h old may simply be mid-upload.",
    pageFilesInDatabase: rows.length,
    referencedByAnEnvelope: rows.length - oldest.length - missingOnDisk,
    orphaned: oldest.length,
    missingOnDisk,
    referencedMb: mb(referencedBytes),
    orphanedMb: mb(orphanBytes),
    reclaimableMb: mb(orphanBytes),
    orphanAgeBuckets: buckets,
    oldestOrphans: oldest.slice(0, 25),
  });
}
