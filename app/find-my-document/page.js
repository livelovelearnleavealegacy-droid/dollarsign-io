import FindMyDocumentClient from "./FindMyDocumentClient";

// The form itself needs browser state, so it lives in a client
// component. This file stays a server component for one reason: only a
// server component may export metadata, and without its own title this
// page inherited the homepage's — three URLs claiming to be the same
// page is a duplicate-title signal.
export const metadata = {
  title: "Find My Document — Resend a Lost Signing Link",
  description:
    "Lost the email with your signing link or completed document? Enter your email address and DollarSign.io will resend every link tied to it. No account needed.",
  alternates: { canonical: "/find-my-document" },
  openGraph: {
    title: "Find My Document — DollarSign.io",
    description: "Resend a lost signing link or completed document to your email address.",
    url: "/find-my-document",
  },
};

export default function Page() {
  return <FindMyDocumentClient />;
}
