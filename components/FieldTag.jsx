"use client";
import { useRef } from "react";
import { PenTool, CalendarDays, Type, X } from "lucide-react";

export default function FieldTag({ field, signer, onDrag, onRemove, containerRef, locked }) {
  const dragging = useRef(false);
  const onDown = (e) => { if (locked) return; dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); };
  const onMove = (e) => {
    if (!dragging.current || !containerRef.current) return;
    const r = containerRef.current.getBoundingClientRect();
    let x = ((e.clientX - r.left) / r.width) * 100;
    let y = ((e.clientY - r.top) / r.height) * 100;
    x = Math.min(92, Math.max(2, x)); y = Math.min(90, Math.max(4, y));
    onDrag(field.id, x, y);
  };
  const onUp = () => { dragging.current = false; };

  return (
    <div
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
      style={{
        position: "absolute", left: `${field.x}%`, top: `${field.y}%`, transform: "translate(0,-50%)",
        cursor: locked ? "default" : "grab", background: "rgba(255,255,255,0.94)",
        border: `1.5px solid ${signer.color}`, borderRadius: 5,
        padding: field.kind === "signature" ? "5px 10px" : "4px 9px",
        display: "flex", alignItems: "center", gap: 6, touchAction: "none",
        boxShadow: "0 2px 6px rgba(16,42,67,0.12)", userSelect: "none", minWidth: 80,
      }}
    >
      {field.value ? (
        field.kind === "signature" ? (
          field.value.type === "image"
            ? <img src={field.value.data} alt="signature" style={{ height: 26, display: "block" }} />
            : <span style={{ fontFamily: "'Caveat', cursive", fontSize: 22, color: "#102A43" }}>{field.value.data}</span>
        ) : field.kind === "date" ? (
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#102A43" }}>{field.value}</span>
        ) : (
          <span style={{ fontFamily: "'Public Sans', sans-serif", fontSize: 12.5, color: "#102A43" }}>{field.value}</span>
        )
      ) : (
        <>
          {field.kind === "signature" ? <PenTool size={12} color={signer.color} />
            : field.kind === "date" ? <CalendarDays size={12} color={signer.color} />
            : <Type size={12} color={signer.color} />}
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: signer.color }}>
            {signer.name}{field.kind === "text" ? " · title" : ""}
          </span>
        </>
      )}
      {!locked && (
        <button onPointerDown={(e) => e.stopPropagation()} onClick={() => onRemove(field.id)} style={{ border: "none", background: "none", cursor: "pointer", padding: 0, marginLeft: 2, lineHeight: 0 }}>
          <X size={11} color="#9AA0AA" />
        </button>
      )}
    </div>
  );
}
