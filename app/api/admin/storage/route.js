import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// READ ONLY. What is actually on the persistent volume, and how much
// room is left.
//
// THE DESIGN RULE HERE: enumerate, never assume.
//
// The first version of this file measured three things by name — the
// database, pages/, sources/ — and reported everything else as an
// unexplained gap. It immediately hid 67 MB of cached PDFs in that gap,
// which is the same failure as the 843 MB of dead rows that sat
// unnoticed inside the database: a report only ever sees what it was
// written to look for. So this version lists whatever is in the volume
// root and measures each entry, whether or not the app knows what it
// is. A directory added next year appears by itself.
//
// Gated on ADMIN_TOKEN. With the variable unset the route 404s, so an
// unconfigured deploy exposes nothing.
export const dynamic = "force-dynamic";

// What each top-level entry is for, so the report reads as sentences
// rather than a list of paths. An entry missing from this map is not an
// error — it is reported as "unrecognised", which is the signal.
const KNOWN = {
  "pages": "rendered page images — the record; an envelope's PDF is rebuilt from these",
  "sources": "original uploaded PDFs, kept so output stays text-searchable",
  "pdfs": "cache of completed documents; regenerable, self-sweeps after 30 days unused",
  "lost+found": "filesystem's own recovery directory; not ours",
};

// Recursive size, in bytes, with a depth limit so a symlink loop or a
// surprise deep tree can't turn a status check into a hang.
function measure(target, depth = 0) {
  let bytes = 0, files = 0;
  let st;
  try { st = fs.lstatSync(target); } catch { return { bytes: 0, files: 0 }; }
  if (st.isSymbolicLink()) return { bytes: 0, files: 0 };
  if (st.isFile()) return { bytes: st.size, files: 1 };
  if (!st.isDirectory() || depth > 6) return { bytes: 0, files: 0 };

  let entries;
  try { entries = fs.readdirSync(target); } catch { return { bytes: 0, files: 0 }; }
  for (const name of entries) {
    const sub = measure(path.join(target, name), depth + 1);
    bytes += sub.bytes;
    files += sub.files;
  }
  return { bytes, files };
}

export async function GET(req) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return NextResponse.json({ error: "not found" }, { status: 404 });
  const provided = req.headers.get("x-admin-token") || new URL(req.url).searchParams.get("token");
  if (provided !== expected) return NextResponse.json({ error: "not found" }, { status: 404 });

  const dbPath = process.env.DB_PATH || path.join(process.cwd(), "dollarsign.db");
  const root = path.dirname(dbPath);
  const mb = (b) => +(b / 1048576).toFixed(2);

  // Everything in the volume root, measured, named, and flagged if the
  // app has no idea what it is.
  const entries = [];
  let accountedBytes = 0;
  const unrecognised = [];
  let rootEntries = [];
  try { rootEntries = fs.readdirSync(root).sort(); } catch { /* reported as an empty volume below */ }

  for (const name of rootEntries) {
    const { bytes, files } = measure(path.join(root, name));
    accountedBytes += bytes;
    const isDbFile = name === path.basename(dbPath) || name.startsWith(`${path.basename(dbPath)}-`);
    const purpose = isDbFile ? "the SQLite database and its journal" : KNOWN[name] || null;
    if (!purpose && bytes > 1048576) unrecognised.push({ name, mb: mb(bytes) });
    entries.push({ name, mb: mb(bytes), files, purpose: purpose || "UNRECOGNISED — nothing in the app claims this" });
  }

  // The database is three files, not one: SQLite keeps a write-ahead log
  // and a shared-memory index beside it. A WAL that never checkpoints is
  // its own way to fill a disk.
  const sizeOf = (p) => { try { return fs.statSync(p).size; } catch { return 0; } };
  const database = { fileMb: mb(sizeOf(dbPath)), walMb: mb(sizeOf(`${dbPath}-wal`)), shmMb: mb(sizeOf(`${dbPath}-shm`)) };

  const byName = (n) => entries.find((e) => e.name === n) || { mb: 0, files: 0 };
  const pageImages = { files: byName("pages").files, mb: byName("pages").mb };
  const sourcePdfs = { files: byName("sources").files, mb: byName("sources").mb };
  const cachedPdfs = { files: byName("pdfs").files, mb: byName("pdfs").mb };

  // Free space on the mount itself. This is the number that decides
  // whether the next upload succeeds.
  let volume;
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

  // Now that every entry is measured, this gap should be small — a few
  // MB of block-allocation slack and filesystem reserve. A large gap
  // means something is consuming the volume that cannot even be listed.
  const unaccountedMb = volume && volume.usedMb != null ? +(volume.usedMb - mb(accountedBytes)).toFixed(2) : null;

  return NextResponse.json({
    note: "Read-only. Nothing is written or deleted.",
    at: new Date().toISOString(),
    volumeRoot: root,
    entries,
    unrecognised,
    database,
    pageImages,
    sourcePdfs,
    cachedPdfs,
    accountedForMb: mb(accountedBytes),
    unaccountedMb,
    volume,
  });
}
