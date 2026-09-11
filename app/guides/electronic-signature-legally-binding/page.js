import GuidePage, { h2, h3, p, ul, li, link, callout, Cta, Related } from "@/components/GuidePage";

export const metadata = {
  title: "What Makes an E-Signature Legally Binding?",
  description:
    "ESIGN and UETA, the four things a valid electronic signature must demonstrate, what a defensible audit trail contains, and what is excluded entirely.",
  alternates: { canonical: "/guides/electronic-signature-legally-binding" },
  openGraph: {
    title: "What makes an electronic signature legally binding?",
    description: "ESIGN, UETA, what an audit trail must contain, and what is excluded entirely.",
    url: "/guides/electronic-signature-legally-binding",
    type: "article",
  },
};

export default function Page() {
  return (
    <GuidePage
      slug="electronic-signature-legally-binding"
      title="What makes an electronic signature legally binding?"
      description={metadata.description}
      updated="September 11, 2026"
      published="2026-09-11"
      intro="In the United States an electronic signature has the same legal effect as ink — but only when the record can show certain things. This is what those things are, and what to look for in whatever you use."
    >
      <div style={callout}>
        <strong>We are a software company, not a law firm, and this is not legal advice.</strong> Whether a particular
        agreement is enforceable depends on far more than how it was signed. If something matters, ask a lawyer.
      </div>

      <h2 style={h2}>The two laws</h2>
      <p style={p}>
        <strong>The ESIGN Act</strong> (the Electronic Signatures in Global and National Commerce Act, 2000) is federal
        and says a signature, contract or record may not be denied legal effect solely because it is electronic.
      </p>
      <p style={p}>
        <strong>UETA</strong> (the Uniform Electronic Transactions Act) is the state-level counterpart, adopted in
        nearly every state. It does the same work at state level and is where most of the detail lives for ordinary
        contracts. The two overlap heavily; the practical upshot is that electronic signing is well-settled law in the
        US, not a grey area.
      </p>

      <h2 style={h2}>The four things a signature has to demonstrate</h2>
      <p style={p}>
        Validity is not a property of the signature image. It is a property of the record around it. Four elements
        matter:
      </p>

      <h3 style={h3}>1. Intent to sign</h3>
      <p style={p}>
        The signer has to have meant to sign. Drawing a signature, typing a name into a signature field, or clicking a
        clearly-labelled button all qualify — a name that merely appears in a document does not.
      </p>

      <h3 style={h3}>2. Consent to do business electronically</h3>
      <p style={p}>
        Under ESIGN this is a separate, affirmative step, not something buried in terms of service. For consumer
        transactions there are additional disclosure requirements. In practice: the signer should be shown a consent
        notice and have to agree to it before signing, and that agreement should be recorded.
      </p>

      <h3 style={h3}>3. Association of the signature with the record</h3>
      <p style={p}>
        The signature has to be logically connected to the document it signs, in a way that would reveal tampering.
        This is why a good service produces one finished file containing both the signed pages and the audit record,
        and fingerprints it — commonly with a SHA-256 hash, so any later alteration changes the hash.
      </p>

      <h3 style={h3}>4. Retention and reproduction</h3>
      <p style={p}>
        Everyone entitled to the record must be able to keep it and reproduce it. In practice that means every party
        gets a copy of the completed document, and can retrieve it later.
      </p>

      <h2 style={h2}>What a defensible audit trail contains</h2>
      <p style={p}>
        If a signature is ever questioned, the certificate is the evidence. A weak one records that a document was
        signed. A useful one records, for every signer:
      </p>
      <ul style={ul}>
        <li style={li}>When they consented to sign electronically, with IP address and browser</li>
        <li style={li}>When they submitted their signature, with IP address and browser</li>
        <li style={li}>Confirmation that they reviewed the full document, not only the signature page</li>
        <li style={li}>Every time an invitation was sent or resent, and to which address</li>
        <li style={li}>A cryptographic fingerprint of the finished document</li>
      </ul>
      <p style={p}>
        Worth knowing before you sign anything: that certificate is delivered to <em>everyone</em> on the document. Your
        IP address and timestamps are visible to the other parties. That is the point of it, but people are often
        surprised.
      </p>

      <h2 style={h2}>Documents that are excluded</h2>
      <p style={p}>
        ESIGN and most state UETA versions carve out categories entirely, or impose formalities that electronic signing
        does not provide. Do not sign these electronically:
      </p>
      <ul style={ul}>
        <li style={li}>Wills, codicils and testamentary trusts</li>
        <li style={li}>Anything requiring notarisation, a witness, or wet ink under applicable law</li>
        <li style={li}>Adoption, divorce and other family-law matters</li>
        <li style={li}>Court filings, orders and pleadings</li>
        <li style={li}>Notices of eviction, foreclosure or repossession of a primary residence</li>
        <li style={li}>Termination of utility services, or cancellation of health or life insurance benefits</li>
        <li style={li}>Product recall notices, and documents accompanying hazardous materials in transport</li>
      </ul>
      <p style={p}>
        This is a summary and requirements vary by state and transaction. The fuller list is in{" "}
        <a href="/terms" style={link}>section 6 of our Terms</a>. When in doubt, paper and a lawyer.
      </p>

      <h2 style={h2}>Does the price of the service change any of this?</h2>
      <p style={p}>
        No. Nothing in ESIGN or UETA refers to what you paid. A signature collected through a $1.99 envelope that
        records consent, review, intent and a fingerprint is not weaker than one collected through a $540-a-year seat
        that records the same things. What higher tiers buy is workflow — templates, integrations, bulk sending — and
        in some cases stronger identity verification, which is a genuine difference for high-value transactions where
        you need more assurance than control of an email address.
      </p>
      <p style={p}>
        The question to ask a provider is not what it costs. It is: <strong>show me the certificate.</strong>
      </p>

      <h2 style={h2}>How we implement each requirement</h2>
      <ul style={ul}>
        <li style={li}><strong>Intent:</strong> signers draw or type a signature and confirm intent before submitting.</li>
        <li style={li}><strong>Consent:</strong> a separate disclosure screen that must be accepted before the document opens.</li>
        <li style={li}><strong>Review:</strong> the signing page will not accept a signature until every page has been displayed.</li>
        <li style={li}><strong>Association:</strong> one combined PDF of the signed pages plus the Certificate of Completion, fingerprinted with SHA-256.</li>
        <li style={li}><strong>Retention:</strong> the completed document is emailed to the sender and every signer, kept indefinitely, and recoverable through <a href="/find-my-document" style={link}>find my document</a>.</li>
      </ul>

      <Cta>
        <strong>See the certificate before you commit to anything.</strong> DollarSign.io is $1.99 an envelope with no
        account and no subscription, and every completed document carries the full audit record described above.{" "}
        <a href="/" style={link}>Upload a document</a>, or read the{" "}
        <a href="/faq" style={link}>FAQ</a> first.
      </Cta>

      <Related exclude={["electronic-signature-legally-binding"]} />
    </GuidePage>
  );
}
