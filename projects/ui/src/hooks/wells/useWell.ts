import { TokenValue } from '@beanstalk/sdk';
import { ERC20Token } from '@beanstalk/sdk-core';
// TODO: wells sdk should export this type
import { Well } from '@beanstalk/wells';
import { useCallback, useEffect, useState } from 'react';
import useSdk from '../sdk';
import useWellLiquidity from './useWellLiquidity';
import useWellSwaps from './useWellSwaps';

export type UIWellDetails = {
  id: string;
  address: string;
  name: string;
  type: string;
  reserves: UIWellReserves | undefined;
};

type UIWellReserves = {
  token1: string;
  token1Amount: number;
  token1Percentage: number;
  token2: string;
  token2Amount: number;
  token2Percentage: number;
  usdTotal: number;
};

const EMPTY_WELL_RESERVES_STATE = {
  token1: '',
  token1Amount: 0,
  token1Percentage: 0,
  token2: '',
  token2Amount: 0,
  token2Percentage: 0,
  usdTotal: 0,
};

const EMPTY_WELL_DETAILS_STATE = {
  id: '',
  address: '',
  name: '',
  type: '',
  reserves: EMPTY_WELL_RESERVES_STATE,
};

export default function useWell(wellId: string) {
  const sdk = useSdk();
  const { swaps } = useWellSwaps(wellId);
  const { deposits, withdraws } = useWellLiquidity(wellId);

  // Possibly move this to app level state
  const [well, setWell] = useState<Well | undefined>();
  const [wellDetails, setWellDetails] = useState<UIWellDetails>(
    EMPTY_WELL_DETAILS_STATE
  );

  // Transient state
  const [loading, setLoading] = useState(true);

  // useCallback
  const loadWellAndReserves = async (wellId: string) => {
    const well = await sdk.wells.getWell(wellId);
    if (!well) return; // TODO: Error?
    setWell(well);
    await well.loadWell();

    const [token1, token2] = well!.tokens!;
    const [reserve1, reserve2] = well!.reserves!;

    const token1Amount = parseInt(reserve1.toHuman());
    const token2Amount = parseInt(reserve2.toHuman());

    const token1Percentage = parseFloat(
      reserve1.div(reserve1.add(reserve2)).mul(100).toHuman()
    );
    const token2Percentage = parseFloat(
      reserve2.div(reserve1.add(reserve2)).mul(100).toHuman()
    );

    setWellDetails({
      id: well.address,
      address: well.address,
      name: well.name || '',
      type: 'Constant Product', // TODO: Wen from SDK?,
      reserves: {
        token1: token1.displayName,
        token1Amount,
        token1Percentage,
        token2: token2.displayName,
        token2Amount,
        token2Percentage,
        usdTotal: 10000,
      },
    });
  };

  const _fetch = useCallback(async () => {
    setLoading(true);
    await loadWellAndReserves(wellId);
    setLoading(false);
  }, [loadWellAndReserves]);

  useEffect(() => {
    if (sdk.providerOrSigner) {
      _fetch();
    }
  }, [sdk.providerOrSigner]);

  return {
    well: wellDetails,
    wellSwaps: swaps,
    wellDeposits: deposits,
    wellWithdraws: withdraws,
    loading,
  };
}
