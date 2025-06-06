import { useCallback } from 'react';
import BigNumber from 'bignumber.js';
import { MaxBN } from '~/util/Tokens';
import { SupportedChainId } from '~/constants/chains';
import { REPLANT_SEASON, ZERO_BN } from '~/constants';
import useSeason from './useSeason';

// ----------------------------------------

export const INITIAL_HUMIDITY = new BigNumber(5);
export const RESTART_HUMIDITY = new BigNumber(2.5);
export const MIN_HUMIDITY = new BigNumber(0.2);
export const HUMIDITY_DECREASE_AT_REPLANT = new BigNumber(2.5);
export const HUMIDITY_DECREASE_PER_SEASON = new BigNumber(0.005);

const replantSeasonBN = new BigNumber(REPLANT_SEASON);

export const REPLANT_INITIAL_ID: { [key: number]: BigNumber } = {
  [SupportedChainId.ETH_MAINNET]: new BigNumber(6_000_000),
  [SupportedChainId.ARBITRUM_MAINNET]: new BigNumber(6_000_000),
};

// ----------------------------------------s

const endDecreaseSeason = replantSeasonBN.plus(461);
// FIXME:
// Technically don't need to run all of this math, we could
// pre-calculate the humidity at each season since it's
// deterministic. Leaving this for now to save time but
// will circle back later! -Silo Chad
export const useHumidityAtSeason = () => 
  // Until the end of the first Season after Unpause, the Humidity stays at 500%.

  // Decrease by 0.5% every season until 20%
   useCallback(
    (season: BigNumber) => {
      // MaxBN provides a constraint on Ropsten because the actual season is 564-ish
      // but we need to pass a REPLANT_SEASON of 6074 to the contract to get the user's balance
      const seasonsAfterReplant = MaxBN(season.minus(REPLANT_SEASON), ZERO_BN);
      if (season.lt(REPLANT_SEASON))
        return [INITIAL_HUMIDITY, HUMIDITY_DECREASE_AT_REPLANT] as const;
      if (season.gte(endDecreaseSeason))
        return [MIN_HUMIDITY, ZERO_BN] as const;
      const humidityDecrease = seasonsAfterReplant.multipliedBy(
        HUMIDITY_DECREASE_PER_SEASON
      );
      return [
        RESTART_HUMIDITY.minus(humidityDecrease),
        HUMIDITY_DECREASE_PER_SEASON,
      ] as const;
    },
    []
  )
;

// ----------------------------------------

export default function useHumidity() {
  const season = useSeason();
  const humidityAt = useHumidityAtSeason();
  return humidityAt(season);
}
