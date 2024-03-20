/// Convention:
/// "account" is an address returned by a connected wallet,
/// and "address" as any arbitrary Ethereum address.

/**
 * Convert an `account` string into lowercase form.
 * This ensures accurate string comparison, since
 * Ethereum addresses are case-insensitive.
 */
export const getAccount = (account: string) => account.toLowerCase();

/**
 * Shorten an Ethereum address for UI display.
 */
export function trimAddress(address: string, showSuffix: boolean = true) {
  return `${address.substring(0, 6)}${
    showSuffix ? `..${address.slice(-4)}` : ''
  }`;
}
