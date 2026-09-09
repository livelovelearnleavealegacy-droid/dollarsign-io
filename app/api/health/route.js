import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getPageFile } from "@/lib/db";

// Liveness AND readiness.
//
// The previous version returned ok:true whenever Node was running,
// which meant every monitor pointed at it would report green while the
// volume was unmounted and the app could not create an envelope or
// serve a signed document. A health check that cannot fail is not a
// health check.
//
// So this actually touches the two things the app cannot work without:
// the database, and the directory the page images live in. Both checks
// are cheap enough to run every 5 minutes forever — one indexed lookup
// that matches nothing, and one permission check that writes nothing.
export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {};
  let ok = true;

  // A real query through the real connection. The id will never exist;
  // what matters is that the statement prepares and runs, which means
  // the database file is present, readable and not corrupt.
  try {
    getPageFile("__healthcheck__");
    checks.database = "ok";
  } catch {
    checks.database = "failed";
    ok = false;
  }

  // The page images are the record — an envelope's PDF is rebuilt from
  // them and nothing else can. If this directory is missing or
  // read-only, uploads are silently about to start failing.
  try {
    const dbPath = process.env.DB_PATH || path.join(process.cwd(), "dollarsign.db");
    fs.accessSync(path.join(path.dirname(dbPath), "pages"), fs.constants.W_OK);
    checks.storage = "ok";
  } catch {
    checks.storage = "failed";
    ok = false;
  }

  // Named checks only, never the underlying error. This endpoint is
  // public and unauthenticated; error text would hand a stranger the
  // filesystem layout.
  return NextResponse.json({ ok, checks, time: new Date().toISOString() }, { status: ok ? 200 : 503 });
}
