/// Convention:
/// "account" is an address returned by a connected wallet,
/// and "address" as any arbitrary Ethereum address.

/**
 * Convert an `account` string into lowercase form.
 * This ensures accurate string comparison, since
 * Ethereum addresses are case-insensitive.
 */
export let getAccount = (account: string) => account.toLowerCase();

/**
 * In the development environment: forcibly override the
 * getAccount function to return an impersonated account address.
 * In combination with a custom `useSigner` hook, this allows
 * forked node impersonation of a user for debugging purposes.
 * 
 * This code block should be automatically removed from the production bundle
 * by the compiler when `import.meta.env.DEV === false`.
 */
export const IMPERSONATED_ACCOUNT = import.meta.env.VITE_OVERRIDE_FARMER_ACCOUNT;
if (import.meta.env.DEV && IMPERSONATED_ACCOUNT) {
  console.warn(`Using overridden Farmer account: ${IMPERSONATED_ACCOUNT}`);
  getAccount = () => ((IMPERSONATED_ACCOUNT as string).toLowerCase());
}

/**
 * Shorten an Ethereum address for UI display.
 */
export function trimAddress(address: string, showSuffix : boolean = true) {
  return `${address.substring(0, 6)}${showSuffix ? `..${address.slice(-4)}` : ''}`;
}
