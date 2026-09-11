import LegalPage, { h2, p, ul, li, link, callout } from "@/components/LegalPage";

export const metadata = {
  title: "Terms of Service",
  description:
    "What you pay, what we deliver, our no-questions refund policy, and the documents that may not be signed electronically.",
  alternates: { canonical: "/terms" },
  openGraph: { title: "Terms of Service — DollarSign.io", url: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="September 8, 2026"
      intro="These terms are a contract between you and Live, Love, Learn, Leave a Legacy LLC. Please read them before you send a document for signature."
    >
      <div style={callout}>
        <strong>The short version.</strong> You pay $1.99 per envelope. We deliver it, collect signatures, and give you a signed PDF with an audit certificate. If something goes wrong, email{" "}
        <a href="mailto:support@dollarsign.io" style={link}>support@dollarsign.io</a> and we will refund you, no questions asked. We are a tool, not a law firm, and there are some documents you should not sign electronically at all — those are listed below.
      </div>

      <h2 style={h2}>1. Who we are</h2>
      <p style={p}>
        DollarSign.io (the &quot;Service&quot;) is operated by Live, Love, Learn, Leave a Legacy LLC (&quot;we,&quot; &quot;us,&quot; &quot;our&quot;). By uploading a document, sending an envelope, or signing one, you agree to these Terms of Service. If you do not agree, do not use the Service.
      </p>

      <h2 style={h2}>2. What the Service does</h2>
      <p style={p}>
        You upload a document, add signers, place signature and other fields, and pay a flat fee. We email each signer a link to review and sign. When everyone has signed, we produce a combined PDF containing the signed pages and a Certificate of Completion recording the signing events.
      </p>
      <p style={p}>
        Your uploaded document is converted into page images when you upload it. The final signed PDF is assembled from those images. It is a faithful visual record of what was signed, but it is not a text-searchable copy of your original file, and the original file&apos;s underlying text and formatting data are not retained.
      </p>

      <h2 style={h2}>3. Pricing and payment</h2>
      <ul style={ul}>
        <li style={li}>Each envelope costs a flat $1.99, regardless of how many pages or signers it contains.</li>
        <li style={li}>An envelope may contain up to 10 signers and up to 100 pages. These limits are enforced when the envelope is created.</li>
        <li style={li}>Payment is collected through Stripe before the envelope is sent. We never see or store your full card number.</li>
        <li style={li}>Prices may change, but a change never affects an envelope you have already paid for.</li>
      </ul>

      <h2 style={h2}>4. Refunds</h2>
      <p style={p}>
        If you are unhappy with the Service for any reason, email{" "}
        <a href="mailto:support@dollarsign.io" style={link}>support@dollarsign.io</a> and we will refund your payment. We do not require an explanation and we do not investigate. Refunds are issued to the original payment method and typically appear within five to ten business days, depending on your bank.
      </p>
      <p style={p}>
        Please email us before disputing a charge with your bank. A dispute costs us substantially more than the payment itself, takes far longer to resolve for you, and we would rather just refund you.
      </p>

      <h2 style={h2}>5. Your responsibilities</h2>
      <p style={p}>When you send an envelope, you are confirming all of the following:</p>
      <ul style={ul}>
        <li style={li}>You have the right to send the document and to share it with the signers you have listed.</li>
        <li style={li}>The email addresses you entered are correct and belong to the people you intend to sign. We deliver to the address you provide, and we cannot recall a document once it has been sent.</li>
        <li style={li}>You are not using the Service to commit fraud, to impersonate anyone, or to obtain a signature by deception.</li>
        <li style={li}>You will keep your own copy of the completed document. See section 9 on retention.</li>
      </ul>

      <h2 style={h2}>6. Documents you should not sign electronically</h2>
      <p style={p}>
        Federal law (the ESIGN Act) and most state versions of UETA specifically exclude certain categories of document from electronic signature, or require additional formalities we do not provide. Do not use the Service for:
      </p>
      <ul style={ul}>
        <li style={li}>Wills, codicils, and testamentary trusts</li>
        <li style={li}>Documents requiring notarization, a witness, or a wet-ink signature under applicable law</li>
        <li style={li}>Adoption, divorce, and other family-law matters</li>
        <li style={li}>Court filings, orders, notices, and pleadings</li>
        <li style={li}>Notices of eviction, foreclosure, or repossession of a primary residence</li>
        <li style={li}>Notices of termination of utility services, or cancellation of health or life insurance benefits</li>
        <li style={li}>Product recall notices, or documents accompanying the transport of hazardous materials</li>
        <li style={li}>Transactions governed by the Uniform Commercial Code, other than sections 1-107 and 1-206 and Articles 2 and 2A</li>
      </ul>
      <p style={p}>
        This list is a summary, not legal advice, and requirements vary by state and by transaction. If you are unsure whether your document can be signed electronically, ask a lawyer before you send it.
      </p>

      <h2 style={h2}>7. We do not provide legal advice</h2>
      <p style={p}>
        We are a software tool. We do not draft, review, interpret, or advise on the content of your documents, and nothing on this site is legal advice. Whether your document is valid, enforceable, or appropriate for your situation is between you and your own attorney.
      </p>

      <h2 style={h2}>8. Electronic signatures and the audit record</h2>
      <p style={p}>
        Before signing, each signer is shown a consent disclosure and must affirmatively agree to do business electronically, must page through the entire document, and must affirm their intent to sign. We record each of these steps server-side, along with the time, IP address, and browser user-agent, and include them in the Certificate of Completion attached to the final PDF. Each completed document is fingerprinted with a SHA-256 hash so that any later alteration is detectable.
      </p>
      <p style={p}>
        We provide this record so that you have evidence of how a signature was obtained. We do not guarantee any particular legal outcome, and we do not represent you in a dispute. If a signature is challenged, the Certificate of Completion is available to you as evidence, but the enforceability of your document depends on facts and law outside our control.
      </p>

      <h2 style={h2}>9. Document retention and availability</h2>
      <p style={p}>
        We keep your envelopes and completed documents available on the Service indefinitely, so you can retrieve them later using the original link or the{" "}
        <a href="/find-my-document" style={link}>find my document</a> page. You may ask us to delete a document at any time by emailing{" "}
        <a href="mailto:support@dollarsign.io" style={link}>support@dollarsign.io</a>; deletion is permanent and we cannot recover a deleted document afterward.
      </p>
      <p style={p}>
        We are not a document archive or a system of record. Download and store your own copy of anything you need to keep. We may delete data if we cease operating the Service, and we will make a reasonable effort to give notice by email before doing so.
      </p>

      <h2 style={h2}>10. Support</h2>
      <p style={p}>
        Support is provided by email at <a href="mailto:support@dollarsign.io" style={link}>support@dollarsign.io</a>. We aim to respond within two business days. We do not offer phone support or live chat.
      </p>
      <p style={p}>We can help you with:</p>
      <ul style={ul}>
        <li style={li}>Problems with the Service itself — uploads, payments, delivery, downloads</li>
        <li style={li}>Resending a signing invitation, or recovering a lost link</li>
        <li style={li}>Refunds and billing questions</li>
        <li style={li}>Deleting your documents</li>
      </ul>
      <p style={p}>We cannot help you with:</p>
      <ul style={ul}>
        <li style={li}>What your document should say, or whether it is legally sufficient</li>
        <li style={li}>Persuading a signer to sign, or contacting a signer on your behalf</li>
        <li style={li}>Disputes between you and another party to a document</li>
      </ul>
      <p style={p}>
        Most common questions are answered on the <a href="/faq" style={link}>FAQ page</a>.
      </p>

      <h2 style={h2}>11. Availability</h2>
      <p style={p}>
        We do not promise any particular level of uptime. The Service may be unavailable for maintenance, or because of failures at hosting, email, or payment providers we depend on. We are not liable for delays in delivering an envelope or a notification.
      </p>

      <h2 style={h2}>12. Acceptable use</h2>
      <p style={p}>You may not use the Service to:</p>
      <ul style={ul}>
        <li style={li}>Send unsolicited bulk mail, or use signer email addresses for any purpose other than the document at hand</li>
        <li style={li}>Upload malware, or content that is unlawful, infringing, or sexually exploitative of minors</li>
        <li style={li}>Attempt to access another person&apos;s envelope, probe the Service for vulnerabilities, or interfere with its operation</li>
        <li style={li}>Evade the page, signer, or pricing limits by automated means</li>
      </ul>
      <p style={p}>
        We may suspend or terminate access, and cancel an envelope, if we believe in good faith that these terms have been violated. Where we cancel an unused envelope, we refund it.
      </p>

      <h2 style={h2}>13. Disclaimer of warranties</h2>
      <p style={p}>
        The Service is provided &quot;as is&quot; and &quot;as available,&quot; without warranties of any kind, whether express or implied, including any implied warranties of merchantability, fitness for a particular purpose, title, or non-infringement. We do not warrant that the Service will be uninterrupted, secure, or error-free, or that any document will be delivered to, opened by, or signed by its intended recipient.
      </p>

      <h2 style={h2}>14. Limitation of liability</h2>
      <p style={p}>
        To the fullest extent permitted by law, our total liability to you for any claim arising out of or relating to the Service is limited to the greater of the amount you paid us for the envelope giving rise to the claim, or $20.
      </p>
      <p style={p}>
        We are not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, lost business, lost data, or the loss or unenforceability of any agreement, even if we have been advised of the possibility of such damages. Some jurisdictions do not allow certain of these limitations, in which case they apply to the maximum extent permitted.
      </p>

      <h2 style={h2}>15. Indemnification</h2>
      <p style={p}>
        You agree to indemnify and hold harmless Live, Love, Learn, Leave a Legacy LLC and its members from any claim, loss, or expense (including reasonable attorneys&apos; fees) arising out of the documents you send, your use of the Service, or your violation of these terms or of any law or third-party right.
      </p>

      <h2 style={h2}>16. Changes to these terms</h2>
      <p style={p}>
        We may update these terms. The &quot;last updated&quot; date at the top reflects the current version. Changes apply to envelopes created after they are posted; the version in effect when you paid governs that envelope.
      </p>

      <h2 style={h2}>17. Governing law</h2>
      <p style={p}>
        These terms are governed by the laws of the State of Wyoming, without regard to its conflict-of-laws rules. Any dispute will be brought exclusively in the state or federal courts located in Wyoming, and you consent to personal jurisdiction there.
      </p>

      <h2 style={h2}>18. Contact</h2>
      <p style={p}>
        Live, Love, Learn, Leave a Legacy LLC<br />
        <a href="mailto:support@dollarsign.io" style={link}>support@dollarsign.io</a>
      </p>
    </LegalPage>
  );
}
