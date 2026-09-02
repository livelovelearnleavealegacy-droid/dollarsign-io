"use client";
import { useState } from "react";
import { Type, X, Check } from "lucide-react";
import { ov, iconBtn, inputStyle, primaryBtn } from "@/lib/shared";

export default function TextFieldPad({ label = "text", onConfirm, onCancel }) {
  const [val, setVal] = useState("");
  const confirm = () => { if (val.trim()) onConfirm(val.trim()); };
  return (
    <div style={ov.backdrop}>
      <div style={{ ...ov.card, maxWidth: 380 }}>
        <div style={ov.headRow}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Type size={17} color="var(--accent)" />
            <h3 style={ov.title}>Fill in {label.toLowerCase()}</h3>
          </div>
          <button onClick={onCancel} style={iconBtn}><X size={18} /></button>
        </div>
        <input
          autoFocus value={val} onChange={(e) => setVal(e.target.value)}
          placeholder={`e.g. ${label}`}
          onKeyDown={(e) => e.key === "Enter" && confirm()}
          style={{ ...inputStyle, fontFamily: "'Public Sans', sans-serif", fontSize: 14 }}
        />
        <button onClick={confirm} style={{ ...primaryBtn, width: "100%", marginTop: 16 }}>
          <Check size={16} style={{ marginRight: 6 }} /> Apply
        </button>
      </div>
    </div>
  );
}
