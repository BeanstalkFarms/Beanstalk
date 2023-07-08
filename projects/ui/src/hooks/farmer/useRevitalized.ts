import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Token, TokenValue } from '@beanstalk/sdk';
import { MaxBN, transform } from '~/util';
import { BEAN_TO_STALK, ZERO_BN } from '~/constants';
import { AppState } from '~/state';
import useFarmerSiloBalances from './useFarmerSiloBalances';
import useSdk from '~/hooks/sdk';

/**
 * Calculates the amount of new Stalk & Seeds the Farmer will receive if they
 * "enroot" their deposits.
 *
 * How Revitalized Stalk and Seeds work
 * ------------------------------------
 *
 * Pretend I have an Unripe BEAN Deposit in Season 1: { season: 1, amount: 100, bdv: 25 }
 * It's now Season 10, and Beanstalk values 1 Unripe Bean at 0.4 BDV.
 *
 * Beanstalk will now give me more stalk & seeds for the same `amount` in my deposit.
 * Enrooting is the process of "updating" that BDV value to claim these stalk and seeds.
 *
 *
 * How to calculate revitalized stalk and seeds
 * --------------------------------------------
 *
 * In the above example, "enrooting" the deposit would shift it between these states:
 *
 * { season: 1, amount: 100, bdv: 25 } -> { season: 1, amount: 100, bdv: 40 }
 *
 * (Note that the `season` did not change, only the BDV)
 *
 * In this case, the Deposit has received Stalk from two new sources:
 * - The addition of 15 BDV grants 15 STALK, since 1 BDV = 1 STALK.
 * - Since that 15 BDV is deposited in Season 1, and it's now Season 10, it has
 *   "retroactively" grown stalk for 9 seasons. The act of enrooting also "mows"
 *   that grown stalk.
 *
 * The Deposit has also received Seeds from the 15 BDV, since 1 BDV = 2 SEEDS.
 *
 * Note that after Silo V3, "season" is replaced semantically by "stem", and the
 * number of Seeds per BDV is now variable, however the Base Stalk per BDV is not.
 */
export default function useRevitalized() {
  const balances = useFarmerSiloBalances();
  const beanstalkSilo = useSelector<AppState, AppState['_beanstalk']['silo']>(
    (state) => state._beanstalk.silo
  );
  const sdk = useSdk();

  return useMemo(() => {
    let revitalizedBDV = ZERO_BN;
    let revitalizedStalk = ZERO_BN;
    let revitalizedSeeds = ZERO_BN;

    // The amount of BDV this Deposit should have based on the formula:
    // amount * bdvPerToken
    // The latter value flucatuates over time as more Fertilizer is purchased.
    const getExpectedBDV = (token: Token) =>
      (balances[token.address]?.deposited.amount || ZERO_BN).times(
        beanstalkSilo.balances[token.address]?.bdvPerToken || ZERO_BN
      );

    // The on-chain `bdv` value stored with the deposit.
    const getActualBDV = (token: Token) =>
      balances[token.address]?.deposited.bdv || ZERO_BN;

    const getGrownStalk = (token: Token, expected: boolean) =>
      balances[token.address]
        ? transform(
            balances[token.address].deposited.crates.reduce(
              (acc, crate) =>
                acc.add(
                  token.getStalk(
                    sdk.tokens.BEAN.fromHuman(
                      expected
                        ? // Get the amount of BDV this Deposit should have...
                          // amount * current bdvPerToken
                          crate.amount
                            .times(
                              beanstalkSilo.balances[token.address]
                                ?.bdvPerToken || ZERO_BN
                            )
                            .toString()
                        : // Get the amount of BDV this Deposit actually has...
                          crate.bdv.toString()
                    )
                  )
                ),
              TokenValue.ZERO
            ),
            'bnjs',
            sdk.tokens.STALK
          )
        : ZERO_BN;

    sdk.tokens.unripeTokens.forEach((token) => {
      const expectedBDV = getExpectedBDV(token);
      const actualBDV = getActualBDV(token);

      const expectedGrownStalk = getGrownStalk(token, true);
      const actualGrownStalk = getGrownStalk(token, false);

      const deltaBDV = MaxBN(expectedBDV.minus(actualBDV), ZERO_BN);
      const deltaGrownStalk = MaxBN(
        expectedGrownStalk.minus(actualGrownStalk),
        ZERO_BN
      );

      revitalizedBDV = revitalizedBDV.plus(deltaBDV);

      const newRevitalizedSeeds = transform(
        // how many seeds are associated with the BDV we're adding
        // formula: bdv * seedsPerBDV
        token.getSeeds(
          // how many BDV are we adding
          sdk.tokens.BEAN.fromHuman(deltaBDV.toString())
        ),
        'bnjs'
      );

      const newRevitalizedStalk =
        // stalk that comes with the base bdv
        // hack: simplify and skip transformation since 1 BEAN = 1 BDV = 1 STALK
        deltaBDV
          .times(BEAN_TO_STALK)
          // stalk that comes with the fact that we have new bdv which has been deposited for longer
          .plus(deltaGrownStalk);

      // console.log("Revitalized for", token.name, {
      //   expectedBDV: expectedBDV.toString(),
      //   actualBDV: actualBDV.toString(),
      //   expectedGrownStalk: expectedGrownStalk.toString(),
      //   actualGrownStalk: actualGrownStalk.toString(),
      //   deltaBDV: deltaBDV.toString(),
      //   deltaGrownStalk: deltaGrownStalk.toString(),
      //   newRevitalizedSeeds: newRevitalizedSeeds.toString(),
      //   newRevitalizedStalk: newRevitalizedStalk.toString(),
      // })

      revitalizedStalk = revitalizedStalk.plus(newRevitalizedStalk);
      revitalizedSeeds = revitalizedSeeds.plus(newRevitalizedSeeds);
    });

    // Since we're manually recalculating these values in BigNumberJS-land,
    // we might get numbers smaller than the precision that BDV is measured to.
    if (revitalizedBDV.lt(1 * 10 ** -sdk.tokens.BEAN.decimals)) {
      revitalizedBDV = ZERO_BN;
      revitalizedStalk = ZERO_BN;
      revitalizedSeeds = ZERO_BN;
    }

    return {
      revitalizedStalk,
      revitalizedSeeds,
    };
  }, [
    balances,
    beanstalkSilo.balances,
    sdk.tokens.BEAN,
    sdk.tokens.STALK,
    sdk.tokens.unripeTokens,
  ]);
}
