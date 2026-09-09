"use client";
import { useRef } from "react";
import { PenTool, CalendarDays, Type, Check, X } from "lucide-react";
import { CHECKED } from "@/lib/shared";

const KIND_SUFFIX = { text: " · title", initials: " · initials", checkbox: " · checkbox" };

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

  const icon =
    field.kind === "signature" || field.kind === "initials" ? <PenTool size={12} color={signer.color} />
    : field.kind === "date" ? <CalendarDays size={12} color={signer.color} />
    : field.kind === "checkbox" ? <Check size={12} color={signer.color} />
    : <Type size={12} color={signer.color} />;

  // Initials sit in margins next to dense text, so the tag has to be
  // physically smaller than a signature tag or it covers the clause it
  // belongs to while the sender is placing it.
  const isSmall = field.kind === "initials" || field.kind === "checkbox";

  return (
    <div
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
      style={{
        position: "absolute", left: `${field.x}%`, top: `${field.y}%`, transform: "translate(0,-50%)",
        cursor: locked ? "default" : "grab", background: "rgba(255,255,255,0.94)",
        border: `1.5px solid ${signer.color}`, borderRadius: 5,
        padding: field.kind === "signature" ? "5px 10px" : "4px 9px",
        display: "flex", alignItems: "center", gap: 6, touchAction: "none",
        boxShadow: "0 2px 6px rgba(16,42,67,0.12)", userSelect: "none",
        minWidth: isSmall ? 44 : 80,
      }}
    >
      {field.value ? (
        field.kind === "signature" || field.kind === "initials" ? (
          field.value.type === "image"
            ? <img src={field.value.data} alt={field.kind} style={{ height: field.kind === "initials" ? 18 : 26, display: "block" }} />
            : <span style={{ fontFamily: "'Caveat', cursive", fontSize: 22, color: "#102A43" }}>{field.value.data}</span>
        ) : field.kind === "checkbox" ? (
          <CheckBox checked={field.value === CHECKED} />
        ) : (
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, color: "#102A43" }}>{field.value}</span>
        )
      ) : (
        <>
          {icon}
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, color: signer.color }}>
            {signer.name}{KIND_SUFFIX[field.kind] || ""}
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

// An unchecked box is drawn, not omitted. "They were asked and said no"
// and "this was never presented" are different facts, and the PDF makes
// the same distinction.
export function CheckBox({ checked, size = 16 }) {
  return (
    <span style={{
      width: size, height: size, border: "1.6px solid #102A43", borderRadius: 3,
      display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      {checked ? <Check size={size - 4} color="#102A43" strokeWidth={3} /> : null}
    </span>
  );
}
