import CheckClient from "./CheckClient";

// Server component purely so this page can carry its own metadata; the
// lookup form is the client component next door.
export const metadata = {
  title: "Check My Envelope — Delivery Status",
  description:
    "Paste your tracking number to see what happened to your envelope — delivered, opened, or bounced. If something failed on our end, you get a free envelope.",
  alternates: { canonical: "/check" },
  openGraph: {
    title: "Check My Envelope — DollarSign.io",
    description: "See what happened to your envelope, and get a free one if something went wrong.",
    url: "/check",
  },
};

export default function Page() {
  return <CheckClient />;
}
