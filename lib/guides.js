// The one list of guides. Plain data, deliberately no JSX and no React
// import: app/sitemap.js pulls this in, and a sitemap has no business
// dragging a component tree into its bundle.
//
// Adding a guide means adding a row here and creating the matching
// app/guides/<slug>/page.js. The hub page, the "related" links and the
// sitemap all read from this, so they cannot drift apart.
export const GUIDES = [
  {
    slug: "docusign-cost-one-document",
    title: "What does DocuSign cost for one document?",
    blurb: "There is no single-document price. The cheapest plan is $11/month on an annual commitment — here is the arithmetic.",
  },
  {
    slug: "docusign-alternative-no-subscription",
    title: "DocuSign alternatives with no subscription",
    blurb: "What “no subscription” actually means, what you give up, and when a subscription is genuinely the better buy.",
  },
  {
    slug: "cheapest-way-to-sign-a-contract-online",
    title: "The cheapest way to get a contract signed online",
    blurb: "It depends entirely on how many you send. The break-even math, with current prices.",
  },
  {
    slug: "sign-document-without-account",
    title: "How to sign a document without creating an account",
    blurb: "Signing rarely needs an account. Sending usually does — that is the part worth avoiding.",
  },
  {
    slug: "do-you-need-a-docusign-account-to-sign",
    title: "Do you need a DocuSign account to sign a document?",
    blurb: "No. Signing is free for recipients. Here is when an account is actually required, and how to spot a fake request.",
  },
  {
    slug: "electronic-signature-legally-binding",
    title: "What makes an electronic signature legally binding?",
    blurb: "ESIGN, UETA, the four things a signature has to demonstrate, and what a defensible audit trail contains.",
  },
];

export const guideUrl = (slug) => `/guides/${slug}`;
