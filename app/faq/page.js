import LegalPage, { h2, h3, p, link, callout } from "@/components/LegalPage";

export const metadata = {
  title: "FAQ — Electronic Signature Questions",
  description:
    "What it costs, whether an electronic signature is legally binding, what to do when a signer never got the email, and how refunds work — answered plainly.",
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "FAQ & Support — DollarSign.io",
    description: "Straight answers about cost, legality, delivery problems, and refunds.",
    url: "/faq",
  },
};

// FAQPage structured data. Only a subset of the page — the questions
// people actually search for as questions — and each answer is the
// visible text with the links stripped, which is what Google requires:
// markup that doesn't appear on the page is a manual-action risk.
// If an answer below is edited, edit it in both places.
const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      q: "What does it cost?",
      a: "$1.99 per envelope. Flat — one price whether it's a one-page form with one signer or a hundred-page contract with ten. No subscription, no per-signature fees, no account required. The limits are 10 signers and 100 pages per envelope.",
    },
    {
      q: "Are electronic signatures valid?",
      a: "In the United States, electronic signatures have the same legal effect as handwritten ones under the federal ESIGN Act of 2000 and, in nearly every state, the Uniform Electronic Transactions Act. We enforce the requirements those laws impose: each signer must separately consent to sign electronically, must be able to review the whole document, and must affirm their intent to sign. All three steps are recorded server-side. We're a software company, not a law firm, and this isn't legal advice.",
    },
    {
      q: "Do I need an account to sign?",
      a: "No. Click the link in your email, review the document, and sign. There is nothing to install and nothing to sign up for.",
    },
    {
      q: "What's the Certificate of Completion?",
      a: "The last page of your signed PDF. It records, for every signer, when they consented, when they signed, the IP address and browser they used, and a SHA-256 fingerprint of the finished document. If a signature is ever questioned, that page is your evidence — and the fingerprint means anyone can verify the document hasn't been altered since.",
    },
    {
      q: "Can I get a refund?",
      a: "Yes, for any reason. Email support@dollarsign.io and we'll refund you — we don't ask why. Please email us rather than disputing the charge with your bank; a refund takes us a minute and a dispute takes you weeks.",
    },
    {
      q: "My signer never got the email. Where should they look first?",
      a: "The spam or junk folder, every time. This is the single most common issue, and the email is in there the large majority of the time. Ask them to search their whole mailbox for dollarsign.io rather than scrolling the inbox — filtered mail often skips the inbox entirely.",
    },
    {
      q: "Are there documents I shouldn't use this for?",
      a: "Yes — wills, anything requiring notarization or a witness, court filings, most family-law matters, and several kinds of statutory notice are excluded from electronic signature by law. The full list is in section 6 of the Terms. If you're unsure, ask a lawyer before sending.",
    },
    {
      q: "What file types can I upload?",
      a: "PDFs and images (PNG, JPG). PDFs are rendered page by page in your browser as you upload them, so a long document takes a moment.",
    },
  ].map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

function Q({ q, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h3 style={{ ...h3, marginTop: 0 }}>{q}</h3>
      {children}
    </div>
  );
}

export default function FaqPage() {
  return (
    <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
    />
    <LegalPage
      title="FAQ & Support"
      intro="Most questions are answered here. If yours isn't, email support@dollarsign.io and we'll get back to you within two business days."
    >
      <h2 style={{ ...h2, marginTop: 0 }}>My signer never got the email</h2>

      <Q q="Where should they look first?">
        <p style={p}>
          The spam or junk folder, every time. This is the single most common issue, and the email is in there the large majority of the time. Ask them to search their whole mailbox for <strong>dollarsign.io</strong> rather than scrolling the inbox — filtered mail often skips the inbox entirely.
        </p>
      </Q>

      <Q q="It's not in spam either. Now what?">
        <p style={p}>
          Open your envelope&apos;s status page — the link is in the confirmation email you received when you sent it — and click <strong>Resend invite</strong> next to that signer&apos;s name. That page also shows the exact address the invitation went to, which is worth double-checking for typos before you resend.
        </p>
        <p style={p}>
          You can resend up to five times per signer, with a few minutes between attempts.
        </p>
      </Q>

      <Q q="Their company email is blocking it">
        <p style={p}>
          Some corporate mail filters quarantine messages containing external links, and the signer never sees them. Ask them to have IT release the message or allow mail from <strong>dollarsign.io</strong>. If that isn&apos;t practical, the simplest fix is to send to a personal address instead — delete the envelope, email us for a refund, and send a new one.
        </p>
      </Q>

      <Q q="I typed the wrong email address">
        <p style={p}>
          A sent envelope can&apos;t be edited, because changing a signer after the fact would corrupt the audit record. Send a new envelope to the correct address, then email{" "}
          <a href="mailto:support@dollarsign.io" style={link}>support@dollarsign.io</a> and we&apos;ll refund the first one.
        </p>
      </Q>

      <h2 style={h2}>Finding a document again</h2>

      <Q q="I lost the link to my document">
        <p style={p}>
          Use <a href="/find-my-document" style={link}>find my document</a>. Enter the email address you used, and we&apos;ll email you links to every envelope associated with it — in progress and completed. For privacy, that page shows the same message whether or not anything matched, so check your inbox for the result.
        </p>
      </Q>

      <Q q="How long do you keep my documents?">
        <p style={p}>
          Indefinitely. You can come back and download a completed document years later. That said, don&apos;t rely on us as your only copy — download the signed PDF and store it somewhere you control.
        </p>
      </Q>

      <Q q="Can you delete my document?">
        <p style={p}>
          Yes. Email <a href="mailto:support@dollarsign.io" style={link}>support@dollarsign.io</a> from the address on the envelope. Deletion is permanent, so download your copy first.
        </p>
      </Q>

      <h2 style={h2}>Payment</h2>

      <Q q="What does it cost?">
        <p style={p}>
          $1.99 per envelope. Flat — one price whether it&apos;s a one-page form with one signer or a hundred-page contract with ten. No subscription, no per-signature fees, no account required. The limits are 10 signers and 100 pages per envelope.
        </p>
      </Q>

      <Q q="I paid but nothing was sent">
        <p style={p}>
          Invitations go out within a few seconds of payment clearing. If a minute has passed and your signers have nothing, check{" "}
          <a href="/find-my-document" style={link}>find my document</a> to confirm the envelope exists, then email us with your tracking number (it looks like <strong>ENV-XXXXXX</strong>). We&apos;ll either get it delivered or refund you.
        </p>
      </Q>

      <Q q="Can I get a refund?">
        <p style={p}>
          Yes, for any reason. Email <a href="mailto:support@dollarsign.io" style={link}>support@dollarsign.io</a> and we&apos;ll refund you — we don&apos;t ask why. Please email us rather than disputing the charge with your bank; a refund takes us a minute and a dispute takes you weeks.
        </p>
      </Q>

      <Q q="Where's my receipt?">
        <p style={p}>
          Stripe emails a receipt to the address you entered at checkout, right after payment. Check spam if you don&apos;t see it.
        </p>
      </Q>

      <h2 style={h2}>Sending a document</h2>

      <Q q="What file types can I upload?">
        <p style={p}>
          PDFs and images (PNG, JPG). PDFs are rendered page by page in your browser as you upload them, so a long document takes a moment.
        </p>
      </Q>

      <Q q="How do I put signature fields on the document?">
        <p style={p}>
          Add your signers first, then pick a signer and click the spot on the page where their signature, date, or text field should go. Each signer gets their own color, so you can see at a glance who is responsible for what. Drag a field to move it, or click the x on it to remove it. There&apos;s no limit on how many fields you can place.
        </p>
      </Q>

      <Q q="What order do people sign in?">
        <p style={p}>
          In the order you listed them. Each signer is notified when it becomes their turn, so signer three isn&apos;t bothered until signers one and two are done.
        </p>
      </Q>

      <Q q="Can I sign my own document?">
        <p style={p}>
          Yes — mark yourself as a signer when you build the envelope and you can fill your own fields directly, without emailing yourself a link.
        </p>
      </Q>

      <Q q="Can I add a signer after sending?">
        <p style={p}>
          No. The signer list is fixed once the envelope is paid for, so that the audit record reflects exactly what was agreed to. Send a new envelope instead.
        </p>
      </Q>

      <h2 style={h2}>Signing a document</h2>

      <Q q="Do I need an account to sign?">
        <p style={p}>
          No. Click the link in your email, review the document, and sign. There is nothing to install and nothing to sign up for.
        </p>
      </Q>

      <Q q="Why do I have to scroll through every page?">
        <p style={p}>
          Because the ESIGN Act requires that you have a genuine opportunity to review what you&apos;re agreeing to. The signing page won&apos;t let you submit until you&apos;ve seen every page — it&apos;s a legal requirement, not an obstacle course.
        </p>
      </Q>

      <Q q="Will I get a copy of what I signed?">
        <p style={p}>
          Yes. When the last signer finishes, everyone on the envelope — the sender and every signer with an email address — receives the completed document.
        </p>
      </Q>

      <h2 style={h2}>Is it legally binding?</h2>

      <Q q="Are electronic signatures valid?">
        <p style={p}>
          In the United States, electronic signatures have the same legal effect as handwritten ones under the federal ESIGN Act of 2000 and, in nearly every state, the Uniform Electronic Transactions Act. We enforce the requirements those laws impose: each signer must separately consent to sign electronically, must be able to review the whole document, and must affirm their intent to sign. All three steps are recorded server-side.
        </p>
        <p style={p}>
          We&apos;re a software company, not a law firm, and this isn&apos;t legal advice. Whether a particular agreement is enforceable depends on much more than how it was signed.
        </p>
      </Q>

      <Q q="What's the Certificate of Completion?">
        <p style={p}>
          The last page of your signed PDF. It records, for every signer, when they consented, when they signed, the IP address and browser they used, and a SHA-256 fingerprint of the finished document. If a signature is ever questioned, that page is your evidence — and the fingerprint means anyone can verify the document hasn&apos;t been altered since.
        </p>
      </Q>

      <Q q="Someone says they didn't sign it">
        <p style={p}>
          Send them the completed PDF and point them to the certificate on the last page. It shows the timestamp, IP address, and browser recorded at the moment of signing. We can&apos;t take sides in a dispute between parties or contact anyone on your behalf, but the record is there for both of you.
        </p>
      </Q>

      <Q q="Are there documents I shouldn't use this for?">
        <p style={p}>
          Yes — wills, anything requiring notarization or a witness, court filings, most family-law matters, and several kinds of statutory notice are excluded from electronic signature by law. The full list is in{" "}
          <a href="/terms" style={link}>section 6 of the Terms</a>. If you&apos;re unsure, ask a lawyer before sending.
        </p>
      </Q>

      <h2 style={h2}>Privacy and security</h2>

      <Q q="Who can see my document?">
        <p style={p}>
          You, your signers, and no one else. We don&apos;t sell data, run ads, or use your documents to train AI models. One thing worth knowing: signing links contain a long random ID but no password, so anyone holding the link can open the envelope. Treat a signing link like the document itself.
        </p>
      </Q>

      <Q q="Is the signed PDF searchable?">
        <p style={p}>
          Not currently. Uploaded documents are converted to page images, so the final PDF is a picture of each signed page rather than selectable text. It&apos;s a faithful visual record, but you can&apos;t copy text out of it.
        </p>
      </Q>

      <div style={{ ...callout, marginTop: 40 }}>
        <strong>Still stuck?</strong><br />
        Email <a href="mailto:support@dollarsign.io" style={link}>support@dollarsign.io</a>. Include your tracking number (<strong>ENV-XXXXXX</strong>) if you have one — it lets us find your envelope immediately instead of writing back to ask for it.
        <br /><br />
        We reply within two business days. Support is by email only; we don&apos;t offer phone support or live chat.
      </div>
    </LegalPage>
    </>
  );
}
