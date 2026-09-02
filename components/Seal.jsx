"use client";
import { useRef } from "react";
import { uid } from "@/lib/shared";

export default function Seal({ label = "SIGNED", date, size = 96 }) {
  const id = useRef(uid()).current;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block" }}>
      <defs>
        <path id={`arcTop-${id}`} d="M 15 50 A 35 35 0 0 1 85 50" fill="none" />
        <path id={`arcBot-${id}`} d="M 85 52 A 35 35 0 0 1 15 52" fill="none" />
      </defs>
      <circle cx="50" cy="50" r="46" fill="none" stroke="var(--teal)" strokeWidth="2.5" />
      <circle cx="50" cy="50" r="39" fill="none" stroke="var(--teal)" strokeWidth="1" />
      <text fontFamily="'IBM Plex Mono', monospace" fontSize="9.5" fontWeight="600" fill="var(--ink)" letterSpacing="2">
        <textPath href={`#arcTop-${id}`} startOffset="50%" textAnchor="middle">{label}</textPath>
      </text>
      <text fontFamily="'IBM Plex Mono', monospace" fontSize="7.5" fill="var(--ink)" letterSpacing="1.5">
        <textPath href={`#arcBot-${id}`} startOffset="50%" textAnchor="middle">{date}</textPath>
      </text>
      <circle cx="50" cy="50" r="16" fill="var(--gold)" />
      <path d="M42 50 l6 6 l11 -13" fill="none" stroke="var(--ink)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
