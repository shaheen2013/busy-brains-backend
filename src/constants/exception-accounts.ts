/**
 * Exception accounts: enterprise users who pay outside the system.
 *
 * Matching is done at request time against the email stored on the user
 * record, so an entry works even if the account is created later.
 *
 * When `exceptionGiven` is true the user can create up to `childAllowed`
 * children (instead of the plan based 1 or 3), gets full content access
 * without a purchase, and sees `billingDescription` on the billing page
 * instead of payment/pricing cards. An entry with `exceptionGiven: false`
 * is ignored and the user follows the normal plan flow.
 */
export type ExceptionAccount = {
  email: string;
  childAllowed: number;
  exceptionGiven: boolean;
  billingDescription: string;
};

export const EXCEPTION_ACCOUNTS: ExceptionAccount[] = [
  {
    email: "siam122@gmail.com",
    childAllowed: 9,
    exceptionGiven: true,
    billingDescription:
      "You have paid outside the system. You are allowed up to 9 children.",
  },
  // {
  //   email: "enterprise@example.com",
  //   childAllowed: 10,
  //   exceptionGiven: true,
  //   billingDescription:
  //     "You have paid outside the system. You are allowed up to 10 children.",
  // },
];

export function findExceptionAccount(
  email: string | null | undefined,
): ExceptionAccount | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  return (
    EXCEPTION_ACCOUNTS.find(
      (entry) =>
        entry.exceptionGiven && entry.email.trim().toLowerCase() === normalized,
    ) ?? null
  );
}
