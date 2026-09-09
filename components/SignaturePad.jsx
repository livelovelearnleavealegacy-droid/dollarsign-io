"use client";
import { useRef, useState, useEffect } from "react";
import { PenTool, X, Check, RotateCcw } from "lucide-react";
import { ov, iconBtn, tabBtn, tabBtnActive, linkBtn, inputStyle, primaryBtn } from "@/lib/shared";

/* Remembering a signature is a per-device convenience, not an account.
   It lives in this browser's localStorage and never reaches the server,
   so it survives a repeat signing on the same phone and nowhere else —
   which is exactly the amount of memory a product with no accounts
   should have. Signatures and initials are stored under separate keys:
   offering someone's full signature when a page asks for initials would
   put the wrong mark on the document.

   The saved mark is stored WITH THE NAME OF WHOEVER MADE IT, and is only
   ever offered back to that same name. Without this, in-person signing
   and saved signatures combine badly: you hand your phone to the next
   signer, their pad opens pre-loaded with YOUR signature, and one
   distracted tap puts your mark on their line. A device is not a person,
   so the device's memory has to be keyed to a person.

   Legacy values (a bare data URL from before this change) have no owner
   recorded, so they are ignored rather than guessed at. */
const STORAGE_KEYS = { signature: "ds_saved_signature_v2", initials: "ds_saved_initials_v2" };

const normaliseName = (n) => String(n || "").trim().toLowerCase().replace(/\s+/g, " ");

function readSaved(kind, signerName) {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS[kind] || STORAGE_KEYS.signature);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.data !== "string" || !parsed.data.startsWith("data:image/")) return null;
    // Only hand it back to the person who made it.
    if (normaliseName(parsed.name) !== normaliseName(signerName)) return null;
    return parsed.data;
  } catch {
    // Private mode, blocked site data, a browser that throws on access,
    // or a legacy/corrupt value. A missing convenience must never block
    // signing.
    return null;
  }
}
function writeSaved(kind, signerName, dataUrl) {
  try {
    window.localStorage.setItem(
      STORAGE_KEYS[kind] || STORAGE_KEYS.signature,
      JSON.stringify({ name: String(signerName || ""), data: dataUrl })
    );
  } catch { /* non-fatal */ }
}
function clearSaved(kind) {
  try { window.localStorage.removeItem(STORAGE_KEYS[kind] || STORAGE_KEYS.signature); } catch { /* non-fatal */ }
}

export default function SignaturePad({ onConfirm, onCancel, kind = "signature", signerName = "" }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [mode, setMode] = useState("draw");
  const [typed, setTyped] = useState("");
  const [empty, setEmpty] = useState(true);
  const [saved, setSaved] = useState(null);

  const isInitials = kind === "initials";
  const title = isInitials ? "Add your initials" : "Sign the envelope";
  const typePlaceholder = isInitials ? "Type your initials" : "Type your full name";

  // localStorage is only available in the browser, so this has to wait
  // for mount rather than run during render.
  useEffect(() => {
    const v = readSaved(kind, signerName);
    setSaved(v);
    if (v) setMode("saved");
  }, [kind, signerName]);

  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const start = (e) => {
    drawing.current = true; setEmpty(false);
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineWidth = 2.6; ctx.lineCap = "round"; ctx.strokeStyle = "#102A43";
    const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
    canvasRef.current.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext("2d");
    const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke();
  };
  const end = () => { drawing.current = false; };
  const clear = () => {
    const c = canvasRef.current;
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
    setEmpty(true);
  };

  // Renders the typed name to a transparent PNG using the same Caveat
  // face shown in the preview above. Two reasons this beats storing the
  // string: the final PDF is built server-side and has no access to a
  // web font, and what the signer actually saw becomes the artifact
  // rather than something re-rendered later with a font that might not
  // have loaded.
  const typedToPng = (name) => {
    const scale = 4; // render high and let the PDF scale it down
    const fontPx = 64;
    const measure = document.createElement("canvas").getContext("2d");
    measure.font = `600 ${fontPx}px 'Caveat', cursive`;
    const w = Math.ceil(measure.measureText(name).width) + 24;
    const h = Math.ceil(fontPx * 1.6);

    const c = document.createElement("canvas");
    c.width = w * scale;
    c.height = h * scale;
    const ctx = c.getContext("2d");
    ctx.scale(scale, scale);
    ctx.font = `600 ${fontPx}px 'Caveat', cursive`;
    ctx.fillStyle = "#102A43";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(name, 12, fontPx * 1.1);
    return c.toDataURL("image/png");
  };

  const apply = (dataUrl) => {
    writeSaved(kind, signerName, dataUrl);
    onConfirm({ type: "image", data: dataUrl });
  };

  const confirm = () => {
    if (mode === "saved") {
      if (!saved) return;
      onConfirm({ type: "image", data: saved });
      return;
    }
    if (mode === "draw") {
      if (empty) return;
      apply(canvasRef.current.toDataURL("image/png"));
    } else {
      const name = typed.trim();
      if (!name) return;
      apply(typedToPng(name));
    }
  };

  const forget = () => {
    clearSaved(kind);
    setSaved(null);
    setMode("draw");
  };

  const modes = saved ? ["saved", "draw", "type"] : ["draw", "type"];
  const modeLabel = { saved: "Saved", draw: "Draw", type: "Type" };

  return (
    <div style={ov.backdrop}>
      <div style={{ ...ov.card, maxWidth: 460 }}>
        <div style={ov.headRow}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PenTool size={17} color="var(--accent)" />
            <h3 style={ov.title}>{title}</h3>
          </div>
          <button onClick={onCancel} style={iconBtn}><X size={18} /></button>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {modes.map((m) => (
            <button key={m} onClick={() => setMode(m)} style={{ ...tabBtn, ...(mode === m ? tabBtnActive : {}) }}>
              {modeLabel[m]}
            </button>
          ))}
        </div>

        {mode === "saved" && saved && (
          <div>
            <div style={{ padding: "18px 12px", background: "#fff", border: "1.5px dashed var(--line)", borderRadius: 6, textAlign: "center", minHeight: 90, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src={saved} alt={isInitials ? "saved initials" : "saved signature"} style={{ maxHeight: 70, maxWidth: "100%" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, color: "#8A8F98" }}>
                saved on this device for {signerName || "you"}
              </span>
              <button onClick={forget} style={linkBtn}><X size={12} style={{ marginRight: 4 }} />forget</button>
            </div>
          </div>
        )}

        {mode === "draw" && (
          <>
            <canvas
              ref={canvasRef} width={400} height={150}
              onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end}
              style={{ width: "100%", height: 150, background: "#fff", border: "1.5px dashed var(--line)", borderRadius: 6, touchAction: "none", cursor: "crosshair" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, color: "#8A8F98" }}>
                {isInitials ? "initial above the line" : "sign above the line"}
              </span>
              <button onClick={clear} style={linkBtn}><RotateCcw size={12} style={{ marginRight: 4 }} />clear</button>
            </div>
          </>
        )}

        {mode === "type" && (
          <div>
            <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={typePlaceholder} style={{ ...inputStyle, fontSize: 16 }} />
            <div style={{ marginTop: 14, padding: "18px 12px", background: "#fff", border: "1.5px dashed var(--line)", borderRadius: 6, textAlign: "center" }}>
              <span style={{ fontFamily: "'Caveat', cursive", fontSize: 34, color: "#102A43" }}>
                {typed || (isInitials ? "Your initials" : "Your signature")}
              </span>
            </div>
          </div>
        )}

        <button onClick={confirm} style={{ ...primaryBtn, width: "100%", marginTop: 16 }}>
          <Check size={16} style={{ marginRight: 6 }} /> {isInitials ? "Apply initials" : "Apply signature"}
        </button>
      </div>
    </div>
  );
}
