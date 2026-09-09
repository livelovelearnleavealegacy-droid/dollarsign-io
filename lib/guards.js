// One place that decides whether an envelope may still be acted on.
//
// Every bug found in this project so far has been the same shape: an
// endpoint that writes to the audit trail without checking whether the
// envelope is still open. Replayed signatures, the consent endpoint,
// resend/decline — three instances of one mistake, each fixed
// separately by hand.
//
// Adding "expired" as a fifth status would have meant editing seven
// routes and hoping none was missed, which is precisely how the first
// three happened. So the list lives here instead, and routes ask this
// module rather than re-deriving it. A sixth status later is a one-line
// change.

export const TERMINAL_STATUSES = ["completed", "declined", "voided", "expired"];

export function isTerminal(status) {
  return TERMINAL_STATUSES.includes(status);
}

const DEFAULT_MESSAGES = {
  pending_payment: "This envelope hasn't been paid for yet.",
  completed: "This envelope is already complete.",
  declined: "A signer declined this envelope.",
  voided: "The sender voided this envelope.",
  expired: "This envelope expired before everyone signed, so it can no longer be signed.",
};

/**
 * Returns { status, error } when the envelope must not be acted on, or
 * null when it is still open for business.
 *
 * `messages` overrides the wording per status so each route keeps the
 * phrasing that makes sense in its own context, while the SET of blocked
 * statuses stays centralised.
 */
export function blockedReason(envelope, messages = {}) {
  const s = envelope?.status;
  if (s === "pending_payment") {
    return { status: 402, error: messages.pending_payment || DEFAULT_MESSAGES.pending_payment };
  }
  if (isTerminal(s)) {
    return { status: 409, error: messages[s] || DEFAULT_MESSAGES[s] };
  }
  return null;
}
