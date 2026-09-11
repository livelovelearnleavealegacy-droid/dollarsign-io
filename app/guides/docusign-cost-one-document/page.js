import GuidePage, { h2, p, ul, li, link, callout, Table, Source, Cta, Related } from "@/components/GuidePage";

export const metadata = {
  title: "What Does DocuSign Cost for One Document?",
  description:
    "DocuSign has no single-document price — the cheapest plan is $11/month on an annual commitment. Here is what one signature actually costs, with the arithmetic.",
  alternates: { canonical: "/guides/docusign-cost-one-document" },
  openGraph: {
    title: "What does DocuSign cost for one document?",
    description: "There is no one-document price. Here is the real arithmetic.",
    url: "/guides/docusign-cost-one-document",
    type: "article",
  },
};

export default function Page() {
  return (
    <GuidePage
      slug="docusign-cost-one-document"
      title="What does DocuSign cost for one document?"
      description={metadata.description}
      updated="September 11, 2026"
      published="2026-09-11"
      intro="If you need one signature on one document, the honest answer is that DocuSign does not sell that. It sells subscriptions, and the smallest one is an annual commitment."
    >
      <div style={callout}>
        <strong>The short answer.</strong> There is no per-document price. DocuSign&apos;s cheapest published plan is
        Personal at <strong>$11/month, listed with an annual commitment of $132</strong>. So a single document costs you
        a plan, not a fee — and if you only ever send that one, it cost $132.
      </div>

      <h2 style={h2}>What DocuSign charges</h2>
      <p style={p}>
        These are the plans on DocuSign&apos;s own pricing page. The envelope limits matter as much as the prices: an
        &quot;envelope&quot; is one document sent to one set of signers, and every plan caps how many you get.
      </p>

      <Table
        head={["Plan", "Price", "Users", "Envelope limit"]}
        rows={[
          ["Personal", "$11/month · $132/year", "1", "5 per month"],
          ["Standard", "$30/user/month · $360/user/year", "up to 50", "100 per user per year"],
          ["Business Pro", "$45/user/month · $540/user/year", "up to 50", "100 per user per year"],
          ["Enterprise", "Custom — contact sales", "50+", "Custom"],
        ]}
      />
      <Source>
        Read from DocuSign&apos;s plans and pricing page in September 2026. Prices change without notice —{" "}
        <a href="https://ecom.docusign.com/plans-and-pricing/esignature" style={link} rel="nofollow noopener" target="_blank">check the current page</a>{" "}
        before relying on any of this.
      </Source>

      <h2 style={h2}>So what does one document actually cost?</h2>
      <p style={p}>
        Divide the yearly price by how many documents you actually send. This is where subscriptions get expensive for
        occasional senders, because the denominator is small.
      </p>

      <Table
        head={["Documents you send in a year", "DocuSign Personal ($132/yr)", "Pay-per-envelope at $1.99"]}
        rows={[
          ["1", "$132.00 each", "$1.99 total"],
          ["5", "$26.40 each", "$9.95 total"],
          ["12", "$11.00 each", "$23.88 total"],
          ["30", "$4.40 each", "$59.70 total"],
          ["60 (the plan's ceiling)", "$2.20 each", "$119.40 total"],
        ]}
        note="Personal allows 5 envelopes a month, so 60 a year is the most the plan permits."
      />

      <p style={p}>
        The plan never gets cheaper per document than <strong>$2.20</strong>, because it runs out of envelopes before it
        runs out of year. That is the part most comparisons miss: the cap, not the price, sets the floor.
      </p>

      <h2 style={h2}>The two things worth reading twice</h2>
      <ul style={ul}>
        <li style={li}>
          <strong>The annual commitment.</strong> The $11 figure is listed against a $132 annual commitment. A one-off
          document is not a one-off payment.
        </li>
        <li style={li}>
          <strong>The envelope cap is per user, per year.</strong> On Standard and Business Pro you are buying 100
          envelopes per seat per year. Going over means buying another seat or moving up a tier — not paying a small
          overage.
        </li>
      </ul>

      <h2 style={h2}>What about the free trial?</h2>
      <p style={p}>
        If a trial is being offered when you look, it will cover a single document. Trials are time-limited and are
        designed to roll into a paid plan, so put the cancellation date in your calendar the day you start one. A trial
        solves a one-off document; it does not solve the second one six months later.
      </p>

      <h2 style={h2}>When DocuSign is worth the subscription</h2>
      <p style={p}>
        Genuinely often. If you send documents weekly, need reusable templates, want bulk send, have a team that shares
        a workspace, or need it wired into Salesforce or a CRM, you are buying software, not signatures — and $360 a
        year for a seat is ordinary business software pricing. At that point per-document billing is the wrong shape
        and you should not use it.
      </p>
      <p style={p}>
        The mismatch is specifically at the low end: a landlord with one lease, someone selling a car, a contractor with
        an occasional statement of work. A subscription priced for daily use is a bad fit for four documents a year.
      </p>

      <h2 style={h2}>What you give up going per-document</h2>
      <p style={p}>
        Being straight about it: no saved templates, no dashboard of past sends, no team seats, no CRM integrations, no
        single sign-on. Those are real things and some people need them. What you keep is the part that makes a
        signature a signature — consent, a full review of the document, an attestation of intent, and an audit
        certificate. Those come from the{" "}
        <a href="/guides/electronic-signature-legally-binding" style={link}>ESIGN Act</a>, not from a price tier.
      </p>

      <Cta>
        <strong>If you just need this one signed.</strong> DollarSign.io is $1.99 per envelope — up to 10 signers and
        100 pages, no account, no subscription, nothing to cancel. Everyone gets the signed PDF with a Certificate of
        Completion. <a href="/" style={link}>Upload your document</a> and see the whole thing before you pay.
      </Cta>

      <Related exclude={["docusign-cost-one-document"]} />
    </GuidePage>
  );
}
