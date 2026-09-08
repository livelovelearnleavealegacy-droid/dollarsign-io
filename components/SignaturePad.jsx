"use client";
import { useRef, useState } from "react";
import { PenTool, X, Check, RotateCcw } from "lucide-react";
import { ov, iconBtn, tabBtn, tabBtnActive, linkBtn, inputStyle, primaryBtn } from "@/lib/shared";

export default function SignaturePad({ onConfirm, onCancel }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [mode, setMode] = useState("draw");
  const [typed, setTyped] = useState("");
  const [empty, setEmpty] = useState(true);

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
  const confirm = () => {
    if (mode === "draw") {
      if (empty) return;
      onConfirm({ type: "image", data: canvasRef.current.toDataURL("image/png") });
    } else {
      if (!typed.trim()) return;
      onConfirm({ type: "text", data: typed.trim() });
    }
  };

  return (
    <div style={ov.backdrop}>
      <div style={{ ...ov.card, maxWidth: 460 }}>
        <div style={ov.headRow}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PenTool size={17} color="var(--accent)" />
            <h3 style={ov.title}>Sign the envelope</h3>
          </div>
          <button onClick={onCancel} style={iconBtn}><X size={18} /></button>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {["draw", "type"].map((m) => (
            <button key={m} onClick={() => setMode(m)} style={{ ...tabBtn, ...(mode === m ? tabBtnActive : {}) }}>
              {m === "draw" ? "Draw" : "Type"}
            </button>
          ))}
        </div>
        {mode === "draw" ? (
          <>
            <canvas
              ref={canvasRef} width={400} height={150}
              onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end}
              style={{ width: "100%", height: 150, background: "#fff", border: "1.5px dashed var(--line)", borderRadius: 6, touchAction: "none", cursor: "crosshair" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, color: "#8A8F98" }}>sign above the line</span>
              <button onClick={clear} style={linkBtn}><RotateCcw size={12} style={{ marginRight: 4 }} />clear</button>
            </div>
          </>
        ) : (
          <div>
            <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type your full name" style={{ ...inputStyle, fontSize: 16 }} />
            <div style={{ marginTop: 14, padding: "18px 12px", background: "#fff", border: "1.5px dashed var(--line)", borderRadius: 6, textAlign: "center" }}>
              <span style={{ fontFamily: "'Caveat', cursive", fontSize: 34, color: "#102A43" }}>{typed || "Your signature"}</span>
            </div>
          </div>
        )}
        <button onClick={confirm} style={{ ...primaryBtn, width: "100%", marginTop: 16 }}>
          <Check size={16} style={{ marginRight: 6 }} /> Apply signature
        </button>
      </div>
    </div>
  );
}
