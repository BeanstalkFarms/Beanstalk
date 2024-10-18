import { useCallback, useMemo } from 'react';
import BigNumber from 'bignumber.js';
import { useAppSelector } from '~/state';
import useTemperature from './useTemperature';

/**
 * Notes: @Bean-Sama
 *
 * When we are above peg, the amount of soil decreases dynamically based on demand.
 *
 * Beanstalk only exposes only 'totalSoil()', which returns the instantaneous amount of soil.
 *
 * 'Beanstalk.totalSoil()' utilizes s.sys.soil (AppState.field.soil) in it's calculation, but
 * this is not exposed.
 *
 * refer to LibDibbler.sol for more information on how Beanstalk calculates 'totalSoil()'
 *
 * We can, however, calculate the soil for the next morning block based on the current soil amount
 * using the following formula:
 *
 *  ==============================================================================
 *  || nextSoil = soil * (100% + currentTemperature) / (100% + nextTemperature) ||
 *  ==============================================================================
 *
 * where
 *  - soil is the current amount of soil in the field.
 *  - currentTemperature is the temperature of the current morning block.
 *  - nextTemperature is the temperature of the next morning block
 *
 * This calculation can occasionally be off by 1e-6 due to rounding errors,
 * so we round down to 6 decimal places to ensure that we don't overestimate
 * the amount of soil.
 *
 * Refer to 'totalSoil()' in 'Beanstalk/protocol/contracts/field/FieldFacet.sol'
 *
 * Additional Notes:
 * - It is recommended to use this hook to read the current amount of soil in the field
 * instead of using the soil stored in the redux store.
 *
 * - We calculate 'nextSoil' instead of 'soil' b/c 'soil' would require us to know the temperature of the
 * previous morning interval.
 *    - If we are at index = 0, we cannot calculate the temperature of the previous interval, whereas if we
 * calculate the soil for the next interval, if we are at interval 25, we can assume 'nextTemperature' is
 * the maxTemperature for the season.
 */

/**
 * @returns soil - the current amount of soil in the field
 * @returns nextSoil - the amount of soil during the next morning block
 * @returns calculate - a function that calculates the max amount of soil for the next morning block
 */
export default function useSoil() {
  /// App State
  const season = useAppSelector((s) => s._beanstalk.sun.season);
  const morning = useAppSelector((s) => s._beanstalk.sun.morning);
  const soil = useAppSelector((s) => s._beanstalk.field.soil);

  /// Hooks
  const [_, { calculate: calculateTemperature }] = useTemperature();

  /// Derived
  const isMorning = morning.isMorning;
  const abovePeg = season.abovePeg;
  const morningIndex = morning.index;

  const calculateNextSoil = useCallback(
    (morningIdx: BigNumber) => {
      if (!season.abovePeg) {
        return soil;
      }
      const currTemp = calculateTemperature(morningIdx);
      const nextTemp = calculateTemperature(morningIdx.plus(1));

      const ratio = currTemp.plus(100).div(nextTemp.plus(100));

      return soil.times(ratio).decimalPlaces(6, BigNumber.ROUND_DOWN);
    },
    [season.abovePeg, soil, calculateTemperature]
  );

  /**
   * soil: the current amount of soil in the field
   * nextSoil: the amount of soil during the next morning block (may be off by 1e-6 due to rounding errors)
   */
  const soilData = useMemo(() => {
    if (!isMorning || !abovePeg)
      return {
        soil,
        nextSoil: soil,
      };

    const nextSoil = calculateNextSoil(morningIndex);

    return {
      soil,
      nextSoil,
    };
  }, [abovePeg, calculateNextSoil, isMorning, soil, morningIndex]);

  return [soilData, { calculate: calculateNextSoil }] as const;
}
