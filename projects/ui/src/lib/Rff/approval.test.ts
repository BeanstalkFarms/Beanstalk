import { decodeFunctionData } from 'viem';
import { describe, expect, it } from 'vitest';

import {
  BEANSTALK_ADDRESS,
  ERC20_APPROVAL_ABI,
  INTERNAL_APPROVAL_ABI,
  adaptiveInputAmount,
  buildApprovalCall,
  isExactRffAllowance,
} from './approval';
import { BalanceMode, BEAN_ADDRESS } from './request';

const SAFE = '0x1111111111111111111111111111111111111111';

describe('RFF approval gate', () => {
  it('approves the Safe for the exact Circulating input on the token', () => {
    const call = buildApprovalCall(
      BalanceMode.EXTERNAL,
      BEAN_ADDRESS,
      SAFE,
      1_000_000n
    );
    const decoded = decodeFunctionData({
      abi: ERC20_APPROVAL_ABI,
      data: call.data,
    });

    expect(call.to).toBe(BEAN_ADDRESS);
    expect(decoded.functionName).toBe('approve');
    expect(decoded.args).toEqual([SAFE, 1_000_000n]);
  });

  it('approves the Safe for the exact Farm input through Beanstalk', () => {
    const call = buildApprovalCall(
      BalanceMode.INTERNAL,
      BEAN_ADDRESS,
      SAFE,
      1_000_000n
    );
    const decoded = decodeFunctionData({
      abi: INTERNAL_APPROVAL_ABI,
      data: call.data,
    });

    expect(call.to).toBe(BEANSTALK_ADDRESS);
    expect(decoded.functionName).toBe('approveToken');
    expect(decoded.args).toEqual([SAFE, BEAN_ADDRESS, 1_000_000n]);
  });

  it('shows the adaptive amount without mutating the signed maximum', () => {
    expect(adaptiveInputAmount(1_000_000n, 750_000n, 800_000n)).toBe(750_000n);
    expect(adaptiveInputAmount(1_000_000n, 2_000_000n, 800_000n)).toBe(
      800_000n
    );
  });

  it('requires an exact allowance instead of accepting a stale unlimited approval', () => {
    expect(isExactRffAllowance(1_000_000n, 1_000_000n)).toBe(true);
    expect(isExactRffAllowance(2_000_000n, 1_000_000n)).toBe(false);
    expect(isExactRffAllowance(999_999n, 1_000_000n)).toBe(false);
  });
});
