"use client";
export default function Logo({ size = 40, ink = "var(--ink)" }) {
  return (
    <svg width={size} height={size * 0.86} viewBox="0 0 120 103" style={{ display: "block" }}>
      <text x="2" y="58" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="800" fontSize="56" fill={ink}>$</text>
      <g transform="translate(30,18)">
        <polygon points="0,10 62,10 62,62 0,62" fill="var(--teal)" />
        <polyline points="0,10 31,38 62,10" fill="none" stroke="#F7FAFC" strokeWidth="2.5" />
        <path d="M10 47 C 16 40, 20 52, 26 45 C 30 41, 33 49, 40 44" fill="none" stroke="#F7FAFC" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="58" cy="58" r="13" fill="var(--gold)" stroke="#F7FAFC" strokeWidth="2" />
        <path d="M52 58 l4 4 l8 -9" fill="none" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <path d="M2 88 C 20 96, 34 84, 30 92" fill="none" stroke="var(--teal)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
