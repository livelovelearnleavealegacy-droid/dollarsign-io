import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// READ ONLY. What is actually on the volume, and how much room is left.
//
// This exists because of a specific failure: the orphaned-file report
// accounted for 146 MB of a 991 MB volume and looked healthy, while
// 843 MB of pre-refactor rows sat inside the database file itself —
// invisible, because nothing measured the database. A monitoring tool
// only sees what it was built to look at, so this one measures every
// component separately and then checks that they add up.
//
// Gated on ADMIN_TOKEN. With the variable unset the route 404s, so an
// unconfigured deploy exposes nothing.
export const dynamic = "force-dynamic";

function dirBytes(dir) {
  let bytes = 0, files = 0;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return { bytes: 0, files: 0, missing: true }; }
  for (const e of entries) {
    if (!e.isFile()) continue;
    try { bytes += fs.statSync(path.join(dir, e.name)).size; files++; } catch { /* vanished mid-scan */ }
  }
  return { bytes, files, missing: false };
}

export async function GET(req) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return NextResponse.json({ error: "not found" }, { status: 404 });
  const provided = req.headers.get("x-admin-token") || new URL(req.url).searchParams.get("token");
  if (provided !== expected) return NextResponse.json({ error: "not found" }, { status: 404 });

  const dbPath = process.env.DB_PATH || path.join(process.cwd(), "dollarsign.db");
  const root = path.dirname(dbPath);
  const mb = (b) => +(b / 1048576).toFixed(2);

  // The database is three files, not one: SQLite keeps a write-ahead
  // log and a shared-memory index beside it. A WAL that never
  // checkpoints is its own way to fill a disk, so count them.
  let dbBytes = 0, walBytes = 0, shmBytes = 0;
  try { dbBytes = fs.statSync(dbPath).size; } catch { /* not created until first write */ }
  try { walBytes = fs.statSync(`${dbPath}-wal`).size; } catch { /* no WAL */ }
  try { shmBytes = fs.statSync(`${dbPath}-shm`).size; } catch { /* no shm */ }

  const pages = dirBytes(path.join(root, "pages"));
  const sources = dirBytes(path.join(root, "sources"));

  // Free space on the mount itself. Everything above is what we know
  // about; this is the number that decides whether the next upload
  // succeeds, which is why it is reported even when the parts look fine.
  let volume = null;
  try {
    const st = fs.statfsSync(root);
    const total = st.blocks * st.bsize;
    const free = st.bavail * st.bsize;
    volume = {
      totalMb: mb(total),
      freeMb: mb(free),
      usedMb: mb(total - free),
      usedPct: total ? +(((total - free) / total) * 100).toFixed(1) : null,
    };
  } catch { volume = { error: "statfs unavailable on this platform" }; }

  const accountedBytes = dbBytes + walBytes + shmBytes + pages.bytes + sources.bytes;

  return NextResponse.json({
    note: "Read-only. Nothing is written or deleted.",
    at: new Date().toISOString(),
    volumeRoot: root,
    database: { fileMb: mb(dbBytes), walMb: mb(walBytes), shmMb: mb(shmBytes) },
    pageImages: { files: pages.files, mb: mb(pages.bytes), ...(pages.missing ? { missing: true } : {}) },
    sourcePdfs: { files: sources.files, mb: mb(sources.bytes), ...(sources.missing ? { missing: true } : {}) },
    accountedForMb: mb(accountedBytes),
    // If this is much larger than accountedForMb, something is using
    // the volume that no part of this app knows about. That gap is the
    // whole point of the endpoint.
    unaccountedMb: volume && volume.usedMb != null ? +(volume.usedMb - mb(accountedBytes)).toFixed(2) : null,
    volume,
  });
}
