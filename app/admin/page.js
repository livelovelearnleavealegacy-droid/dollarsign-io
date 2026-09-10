"use client";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, Loader2, LogOut, ExternalLink, Search } from "lucide-react";
import { primaryBtn, inputStyle } from "@/lib/shared";

/* The operator view.
 *
 * Deliberately a plain table rather than a dashboard of charts: the
 * question this page answers is "does anything need me today", and a
 * chart is a worse answer to that than a list with the problems at the
 * top.
 *
 * The token lives in sessionStorage, not localStorage — it closes with
 * the tab. An admin token that survives on a shared or borrowed machine
 * is a bigger risk than retyping it. */
const TOKEN_KEY = "ds_admin_token";

const STATUS_STYLE = {
  sent: { bg: "#EEF3FB", fg: "#2D6CDF", label: "awaiting signature" },
  completed: { bg: "#EFF6F0", fg: "#3F7A4E", label: "completed" },
  pending_payment: { bg: "#F4F5F7", fg: "#6B7280", label: "unpaid draft" },
  declined: { bg: "#FDF1EC", fg: "#B33D0C", label: "declined" },
  voided: { bg: "#FDF1EC", fg: "#B33D0C", label: "voided" },
  expired: { bg: "#FDF1EC", fg: "#B33D0C", label: "expired" },
};

const ui = { fontFamily: "'Plus Jakarta Sans', sans-serif" };

function Pill({ status }) {
  const s = STATUS_STYLE[status] || { bg: "#F4F5F7", fg: "#6B7280", label: status };
  return (
    <span style={{ ...ui, fontSize: 13, fontWeight: 600, color: s.fg, background: s.bg, borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

function Tile({ label, value, tone }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px", minWidth: 128, flex: "1 1 128px" }}>
      <div style={{ ...ui, fontSize: 12.5, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: "#8A8F98" }}>{label}</div>
      <div style={{ ...ui, fontSize: 26, fontWeight: 700, color: tone || "var(--ink)", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{value}</div>
    </div>
  );
}

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [entered, setEntered] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [onlyAttention, setOnlyAttention] = useState(false);
  // Hidden by default: the test suite outnumbers real envelopes roughly
  // seventy to one, and a page that opens on somebody else's noise is
  // a page nobody opens twice.
  const [showTests, setShowTests] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(TOKEN_KEY);
      if (saved) setToken(saved);
    } catch { /* storage blocked — the form still works */ }
  }, []);

  const load = useCallback(async (t, withTests = false) => {
    if (!t) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/envelopes?limit=300${withTests ? "&includeTests=1" : ""}`, {
        headers: { "x-admin-token": t },
      });
      if (res.status === 404) throw new Error("That token doesn't match — or ADMIN_TOKEN isn't set in Railway.");
      if (!res.ok) throw new Error(`Server returned ${res.status}.`);
      setData(await res.json());
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (token) load(token, showTests); }, [token, showTests, load]);

  const signIn = (e) => {
    e.preventDefault();
    const t = entered.trim();
    if (!t) return;
    try { sessionStorage.setItem(TOKEN_KEY, t); } catch { /* fine */ }
    setToken(t);
    setEntered("");
  };

  const signOut = () => {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* fine */ }
    setToken("");
    setData(null);
  };

  if (!token) {
    return (
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "80px 20px" }}>
        <h1 style={{ ...ui, fontSize: 24, fontWeight: 700, margin: "0 0 8px", color: "var(--ink)" }}>Operator view</h1>
        <p style={{ fontSize: 16, color: "#5B5F6B", lineHeight: 1.5, marginBottom: 20 }}>
          Paste your admin token. It's kept for this browser tab only and forgotten when you close it.
        </p>
        <form onSubmit={signIn} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="password"
            autoFocus
            value={entered}
            onChange={(e) => setEntered(e.target.value)}
            placeholder="admin token"
            style={{ ...inputStyle, ...ui }}
          />
          <button type="submit" style={primaryBtn}>Open</button>
        </form>
        {error && <p style={{ fontSize: 15, color: "#C1440E", marginTop: 14 }}>{error}</p>}
      </div>
    );
  }

  const envelopes = (data?.envelopes || []).filter((e) => {
    if (onlyAttention && !e.attention.length) return false;
    if (!filter.trim()) return true;
    const q = filter.trim().toLowerCase();
    return [e.trackingId, e.documentName, e.senderEmail, e.senderName, ...(e.signers || []).map((s) => s.email)]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  const s = data?.summary;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 20px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <h1 style={{ ...ui, fontSize: 24, fontWeight: 700, margin: 0, color: "var(--ink)" }}>Operator view</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => load(token, showTests)} disabled={loading}
            style={{ ...ui, background: "none", border: "1px solid var(--line)", borderRadius: 8, padding: "7px 12px", fontSize: 14, cursor: "pointer", color: "var(--ink)" }}>
            {loading ? <Loader2 size={13} className="spin" style={{ marginRight: 5 }} /> : <RefreshCw size={13} style={{ marginRight: 5 }} />}
            Refresh
          </button>
          <button onClick={signOut}
            style={{ ...ui, background: "none", border: "1px solid var(--line)", borderRadius: 8, padding: "7px 12px", fontSize: 14, cursor: "pointer", color: "#8A8F98" }}>
            <LogOut size={13} style={{ marginRight: 5 }} /> Forget token
          </button>
        </div>
      </div>

      {error && <p style={{ fontSize: 15, color: "#C1440E", marginBottom: 14 }}>{error}</p>}

      {s && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
          <Tile label="Needs attention" value={s.needsAttention} tone={s.needsAttention ? "#B33D0C" : undefined} />
          <Tile label="Awaiting signature" value={s.awaitingSignature} />
          <Tile label="Completed" value={s.completed} />
          <Tile label="Sent (30 days)" value={s.sentLast30Days} />
          <Tile label="Unpaid drafts" value={s.unpaidDrafts} />
          <Tile label="Closed early" value={s.declined + s.voided + s.expired} />
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ position: "relative", flex: "1 1 240px" }}>
          <Search size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#8A8F98" }} />
          <input value={filter} onChange={(e) => setFilter(e.target.value)}
            placeholder="tracking number, document, or email"
            style={{ ...inputStyle, ...ui, paddingLeft: 34, fontSize: 15, padding: "9px 12px 9px 34px" }} />
        </div>
        <label style={{ ...ui, display: "flex", gap: 7, alignItems: "center", fontSize: 15, color: "var(--ink)", cursor: "pointer" }}>
          <input type="checkbox" id="only-attention" checked={onlyAttention} onChange={(e) => setOnlyAttention(e.target.checked)} />
          Only what needs me
        </label>
        {!!s?.testEnvelopes && (
          <label style={{ ...ui, display: "flex", gap: 7, alignItems: "center", fontSize: 15, color: "#8A8F98", cursor: "pointer" }}>
            <input type="checkbox" id="show-tests" checked={showTests} onChange={(e) => setShowTests(e.target.checked)} />
            Show {s.testEnvelopes} test envelope{s.testEnvelopes === 1 ? "" : "s"}
          </label>
        )}
      </div>

      {!envelopes.length && !loading && (
        <p style={{ fontSize: 16, color: "#5B5F6B" }}>
          {data ? "Nothing matches." : "No data yet."}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {envelopes.map((e) => (
          <div key={e.id}
            style={{
              background: "var(--card)", border: "1px solid var(--line)",
              borderLeft: e.attention.length ? "3px solid #B33D0C" : "3px solid var(--line)",
              borderRadius: 10, padding: "14px 16px",
            }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
              <div style={{ ...ui, fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>
                {e.isTest && <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: ".05em", color: "#8A8F98", marginRight: 7 }}>TEST</span>}
                {e.documentName || "Untitled"}{" "}
                <span style={{ fontFamily: "monospace", fontSize: 13, color: "#8A8F98", fontWeight: 400 }}>{e.trackingId}</span>
              </div>
              <Pill status={e.status} />
            </div>

            <div style={{ ...ui, fontSize: 14, color: "#5B5F6B", marginTop: 5, display: "flex", gap: 14, flexWrap: "wrap" }}>
              <span>{e.senderEmail || e.senderName || "no sender"}</span>
              <span>{e.pageCount} page{e.pageCount === 1 ? "" : "s"} · {e.fieldCount} field{e.fieldCount === 1 ? "" : "s"}</span>
              <span>{e.signedCount} of {e.signerCount} signed</span>
              {e.sentDays !== null && <span>sent {e.sentDays < 1 ? "today" : `${Math.floor(e.sentDays)}d ago`}</span>}
              {e.status === "sent" && e.remindersSent > 0 && <span>{e.remindersSent}/{e.remindersMax} reminders</span>}
            </div>

            {e.waitingOn.length > 0 && e.status === "sent" && (
              <div style={{ ...ui, fontSize: 14, color: "#5B5F6B", marginTop: 4 }}>
                waiting on {e.waitingOn.join(", ")}
              </div>
            )}

            {e.attention.length > 0 && (
              <div style={{ display: "flex", gap: 7, alignItems: "flex-start", marginTop: 8, color: "#B33D0C", fontSize: 14.5, lineHeight: 1.45 }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={ui}>{e.attention.join(" · ")}</span>
              </div>
            )}

            <div style={{ marginTop: 9 }}>
              <a href={`/e/${e.id}`} target="_blank" rel="noreferrer"
                style={{ ...ui, fontSize: 14, color: "var(--ink)", textDecoration: "underline" }}>
                Open status page <ExternalLink size={12} style={{ marginLeft: 3 }} />
              </a>
            </div>
          </div>
        ))}
      </div>

      {data && (
        <p style={{ ...ui, fontSize: 13, color: "#9AA0AA", marginTop: 20 }}>
          {data.returned} envelope{data.returned === 1 ? "" : "s"} · read at {new Date(data.at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
