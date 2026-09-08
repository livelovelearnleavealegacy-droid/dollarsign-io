import LegalPage, { h2, h3, p, ul, li, link, callout } from "@/components/LegalPage";

export const metadata = {
  title: "Privacy Policy — DollarSign.io",
  description: "What DollarSign.io collects, why, who it is shared with, and how to have it deleted.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="September 8, 2026"
      intro="This explains what DollarSign.io collects, why we collect it, who else touches it, and how to get it deleted."
    >
      <div style={callout}>
        <strong>The short version.</strong> We collect what we need to deliver your document and to prove how it was signed — names, email addresses, the document itself, and the IP address and browser of each signer at the moment they consented and signed. We do not sell it, we do not advertise, and we do not track you around the internet. Email{" "}
        <a href="mailto:support@dollarsign.io" style={link}>support@dollarsign.io</a> to have your documents deleted.
      </div>

      <h2 style={h2}>What we collect</h2>

      <h3 style={h3}>Information you give us</h3>
      <ul style={ul}>
        <li style={li}><strong>Your name and email address</strong> as the sender of an envelope.</li>
        <li style={li}><strong>Each signer&apos;s name and email address,</strong> as entered by the sender.</li>
        <li style={li}><strong>Your document.</strong> When you upload a file, it is converted in your browser into page images, which are then uploaded and stored on our server. Whatever your document contains, we store.</li>
        <li style={li}><strong>Field values entered by signers</strong> — drawn or typed signatures, dates, and text.</li>
      </ul>

      <h3 style={h3}>Information we record automatically</h3>
      <p style={p}>
        To make a signature defensible under the ESIGN Act, we have to record how it happened. For each signer we log, server-side:
      </p>
      <ul style={ul}>
        <li style={li}>The time they consented to sign electronically, with their IP address and browser user-agent</li>
        <li style={li}>The time they submitted their signature, with their IP address and browser user-agent</li>
        <li style={li}>Confirmation that they paged through the whole document and affirmed intent to sign</li>
        <li style={li}>Each time an invitation was sent or resent, and to which address</li>
      </ul>
      <p style={p}>
        This audit trail is embedded in the Certificate of Completion attached to the final PDF, which means <strong>every party to the document can see it</strong> — including the IP addresses and timestamps of the other signers. That is the point of the record, but it is worth knowing before you sign something.
      </p>

      <h3 style={h3}>Payment information</h3>
      <p style={p}>
        Payments are processed by Stripe on Stripe&apos;s own hosted checkout pages. Your card number never reaches our servers and we cannot see it. We receive a confirmation from Stripe containing a payment identifier and the billing email you gave them.
      </p>

      <h3 style={h3}>What we do not collect</h3>
      <ul style={ul}>
        <li style={li}>No accounts, no passwords — there is nothing to sign into.</li>
        <li style={li}>No advertising or analytics trackers, and no third-party cookies set by us.</li>
        <li style={li}>No cross-site tracking, no data brokers, no profile building.</li>
      </ul>

      <h2 style={h2}>How we use it</h2>
      <p style={p}>Only to run the Service:</p>
      <ul style={ul}>
        <li style={li}>To deliver signing invitations and notifications by email</li>
        <li style={li}>To display your document to the people you sent it to, and to assemble the final signed PDF</li>
        <li style={li}>To produce the audit certificate and the SHA-256 fingerprint of the completed document</li>
        <li style={li}>To take payment and issue refunds</li>
        <li style={li}>To answer your support emails</li>
        <li style={li}>To investigate abuse or fraud, and to comply with the law</li>
      </ul>
      <p style={p}>
        We do not sell personal information, and we do not share it for cross-context behavioral advertising. We do not use your documents to train machine-learning models.
      </p>

      <h2 style={h2}>Who else handles your data</h2>
      <p style={p}>We use a small number of service providers, all located in the United States:</p>
      <ul style={ul}>
        <li style={li}><strong>Railway</strong> — hosting and file storage. Your document images and the database live on a private storage volume there.</li>
        <li style={li}><strong>Stripe</strong> — payment processing. Stripe handles card data under its own privacy policy.</li>
        <li style={li}><strong>Resend</strong> — transactional email delivery. Resend sends our mail through Amazon SES, so the contents of our notification emails, including signing links, pass through both.</li>
      </ul>
      <p style={p}>
        We may also disclose information if we are legally required to, or where we believe in good faith it is necessary to protect someone&apos;s safety or to investigate fraud. If our business is ever sold or transferred, envelope data may transfer with it, subject to this policy.
      </p>

      <h2 style={h2}>How documents are protected — and the one thing to know</h2>
      <p style={p}>
        Traffic to the site is encrypted with HTTPS. Documents are stored on a private volume that is not publicly browsable, and completed documents are fingerprinted with SHA-256 so tampering is detectable.
      </p>
      <p style={p}>
        <strong>Access is by link.</strong> Envelope and signing URLs contain long random identifiers that cannot practically be guessed, but there is no password on them: anyone who has the link can open that envelope. This is what makes signing work without accounts, and it is the same trade-off most signing services make — but it means you should treat a signing link like the document itself, and avoid forwarding it to people who should not see it.
      </p>
      <p style={p}>
        No system is perfectly secure, and we cannot guarantee that unauthorized access will never occur.
      </p>

      <h2 style={h2}>How long we keep it</h2>
      <p style={p}>
        We keep envelopes and completed documents indefinitely, so that you can retrieve them later using the original link or the{" "}
        <a href="/find-my-document" style={link}>find my document</a> page. We would rather you be able to pull up a contract in three years than have it disappear.
      </p>
      <p style={p}>
        If you would rather it not be kept, email{" "}
        <a href="mailto:support@dollarsign.io" style={link}>support@dollarsign.io</a> from the address associated with the envelope and we will delete the document, its page images, and its audit record. Deletion is permanent and cannot be undone, so download your copy first. We will confirm when it is done, normally within a few business days.
      </p>
      <p style={p}>
        Some records outside the envelope itself — payment records held by Stripe, email delivery logs held by Resend — are retained by those providers under their own schedules and may survive deletion of the document.
      </p>

      <h2 style={h2}>Your choices</h2>
      <ul style={ul}>
        <li style={li}><strong>Get your documents back.</strong> Use <a href="/find-my-document" style={link}>find my document</a> to have links emailed to the address you used.</li>
        <li style={li}><strong>Get a copy of your data,</strong> or ask what we hold about you — email support and we will send it.</li>
        <li style={li}><strong>Delete it.</strong> See above.</li>
        <li style={li}><strong>Correct it.</strong> Names and email addresses on a sent envelope cannot be edited, because the audit record has to stay accurate. If something is wrong, ask us to delete the envelope and send a new one.</li>
      </ul>
      <p style={p}>
        Depending on where you live — California, Colorado, Connecticut, Virginia, and a growing number of other states, or the EEA and UK — you may have statutory rights to access, delete, correct, or port your personal information, and to be free from discrimination for exercising them. We honor these requests from everyone, regardless of where you live. Email support to make one. If you are unsatisfied with our response, you may have a right to appeal or to complain to your state attorney general or data protection authority.
      </p>

      <h2 style={h2}>Signers, as distinct from senders</h2>
      <p style={p}>
        If you received a document to sign, the sender chose to send it to you; we did not obtain your address from anywhere else. You can decline to sign simply by not signing. If you believe you received a document in error or do not want your information retained, email{" "}
        <a href="mailto:support@dollarsign.io" style={link}>support@dollarsign.io</a> and we will look into it. Note that an envelope you have already signed belongs to the other parties too, and we will weigh their interest in keeping the record before deleting it.
      </p>

      <h2 style={h2}>Children</h2>
      <p style={p}>
        The Service is not directed to children and is not intended for anyone under 18. We do not knowingly collect information from children. If you believe a child has used the Service, email us and we will delete the data.
      </p>

      <h2 style={h2}>Changes to this policy</h2>
      <p style={p}>
        We may update this policy. The &quot;last updated&quot; date at the top reflects the current version. If a change materially reduces the protection of information we already hold, we will make a reasonable effort to notify affected senders by email.
      </p>

      <h2 style={h2}>Contact</h2>
      <p style={p}>
        Live, Love, Learn, Leave a Legacy LLC<br />
        <a href="mailto:support@dollarsign.io" style={link}>support@dollarsign.io</a>
      </p>
    </LegalPage>
  );
}
