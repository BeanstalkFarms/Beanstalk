import { useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ethers } from 'ethers';
import type { Address } from 'viem';

import useAccount from '~/hooks/ledger/useAccount';
import { useSigner } from '~/hooks/ledger/useSigner';
import { BEANSTALK_ADDRESS, buildApprovalCall } from '~/lib/Rff/approval';
import { BalanceMode } from '~/lib/Rff/request';

const ERC20_ALLOWANCE_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
];
const INTERNAL_ALLOWANCE_ABI = [
  'function tokenAllowance(address account, address spender, address token) view returns (uint256)',
];

export default function useRffApproval(input: {
  token?: Address;
  safeAddress?: Address;
  sourceMode: BalanceMode;
  requestedAmountIn: bigint;
}) {
  const account = useAccount();
  const { data: signer } = useSigner();
  const enabled =
    !!account &&
    !!signer &&
    !!input.token &&
    !!input.safeAddress &&
    input.requestedAmountIn > 0n;

  const queryKey = useMemo(
    () => [
      'rff',
      'allowance',
      account,
      input.token,
      input.safeAddress,
      input.sourceMode,
    ],
    [account, input.safeAddress, input.sourceMode, input.token]
  );

  const allowance = useQuery({
    queryKey,
    enabled,
    queryFn: async () => {
      if (!account || !signer || !input.token || !input.safeAddress) {
        return 0n;
      }
      if (input.sourceMode === BalanceMode.EXTERNAL) {
        const token = new ethers.Contract(
          input.token,
          ERC20_ALLOWANCE_ABI,
          signer
        );
        const value = await token.allowance(account, input.safeAddress);
        return BigInt(value.toString());
      }
      const beanstalk = new ethers.Contract(
        BEANSTALK_ADDRESS,
        INTERNAL_ALLOWANCE_ABI,
        signer
      );
      const value = await beanstalk.tokenAllowance(
        account,
        input.safeAddress,
        input.token
      );
      return BigInt(value.toString());
    },
  });

  const approval = useMutation({
    mutationFn: async () => {
      if (!signer || !input.token || !input.safeAddress) {
        throw new Error('Connect a wallet to approve this request.');
      }
      const call = buildApprovalCall(
        input.sourceMode,
        input.token,
        input.safeAddress,
        input.requestedAmountIn
      );
      const transaction = await signer.sendTransaction(call);
      const receipt = await transaction.wait();
      await allowance.refetch();
      return receipt;
    },
  });

  return {
    allowance: allowance.data ?? 0n,
    isLoading: allowance.isLoading,
    isApproved: (allowance.data ?? 0n) >= input.requestedAmountIn,
    error: allowance.error ?? approval.error,
    approve: approval.mutateAsync,
    isApproving: approval.isPending,
  };
}
