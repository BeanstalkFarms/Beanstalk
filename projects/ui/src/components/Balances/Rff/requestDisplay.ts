import { BEAN_ADDRESS, WSTETH_ADDRESS } from '~/lib/Rff/request';
import type { RffRequestStatus } from '~/lib/Rff/client';

export function requestTokenSymbol(address: string): 'BEAN' | 'wstETH' {
  if (address.toLowerCase() === BEAN_ADDRESS.toLowerCase()) return 'BEAN';
  if (address.toLowerCase() === WSTETH_ADDRESS.toLowerCase()) return 'wstETH';
  throw new Error('Unsupported RFF token');
}

function expiryText(deadlineSeconds: number, nowSeconds: number): string {
  const remainingSeconds = Math.max(0, deadlineSeconds - nowSeconds);
  if (remainingSeconds < 60) return 'Expires in <1 min';
  if (remainingSeconds < 86_400) {
    return `Expires in ${Math.ceil(remainingSeconds / 60)} min`;
  }
  return `Expires in ${Math.ceil(remainingSeconds / 86_400)} days`;
}

export function requestStatusText(
  status: RffRequestStatus,
  deadlineSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1_000)
): string {
  switch (status) {
    case 'OPEN':
      return `Pending review · ${expiryText(deadlineSeconds, nowSeconds)}`;
    case 'LOCKED':
      return 'Fill in progress';
    case 'SAFE_PROPOSED':
      return 'Awaiting multisig execution';
    case 'EXECUTED':
      return 'Filled';
    case 'CANCELLED':
      return 'Cancelled';
    case 'EXPIRED':
      return 'Expired';
    default:
      return 'Unknown';
  }
}
