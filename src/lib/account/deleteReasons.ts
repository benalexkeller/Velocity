// Why athletes delete their account: the choices in Profile → Delete account. The answer is saved without any link
// to the person (feedback table, tab "account-deleted", user_id empty) before the account is deleted, and shows on
// the Admin page. Answering is optional: deleting is never blocked by it.
export const DELETE_REASONS: { k: string; label: string }[] = [
  { k: "race_done", label: "My race is over or I'm taking a break from training" },
  { k: "other_app", label: "I'm switching to another app" },
  { k: "plan_fit", label: "The plan didn't fit my schedule or level" },
  { k: "hard_to_use", label: "It was hard to use or confusing" },
  { k: "missing", label: "A feature I need is missing, for example my watch" },
  { k: "coach", label: "The coach's answers weren't helpful" },
  { k: "privacy", label: "I'm worried about my data or privacy" },
  { k: "duplicate", label: "I have another account or was only testing" },
  { k: "other", label: "Other" },
];
export const DELETE_TAB = "account-deleted";
export const deleteReasonLabel = (k: string) => DELETE_REASONS.find((r) => r.k === k)?.label ?? k;
