import { BeanstalkSDK } from '@beanstalk/sdk';
import BigNumber from 'bignumber.js';
import Token from '~/classes/Token';
import { TokenMap } from '~/constants';
import { Beanstalk } from '~/generated';
import useBDV from '~/hooks/beanstalk/useBDV';
import { LegacyDepositCrate, FarmerSiloBalance } from '~/state/farmer/silo';
import { transform } from '~/util';

/**
 * @deprecated TOOD: Remove this
 */
export const STALK_PER_SEED_PER_SEASON = 1 / 10_000;

/**
 * @deprecated TODO: Refactor this to a selector, use the SDK
 */
export const selectCratesForEnroot = (
  beanstalk: Beanstalk,
  unripeTokens: TokenMap<Token>,
  siloBalances: TokenMap<FarmerSiloBalance>,
  getBDV: (_token: Token) => BigNumber
) =>
  Object.keys(unripeTokens).reduce<{
    [addr: string]: { crates: LegacyDepositCrate[]; encoded: string };
  }>((prev, addr) => {
    const crates = siloBalances[addr]?.deposited.crates.filter((crate) =>
      /// only select crates where BDV would stay the same or increase
      /// solves bug where fluctuations in unripe bdv cause enroots
      /// to fail in certain conditions.
      new BigNumber(
        getBDV(unripeTokens[addr]).times(crate.amount).toFixed(6, 1)
      ).gt(crate.bdv)
    );

    if (crates && crates.length > 0) {
      if (crates.length === 1) {
        prev[addr] = {
          crates,
          encoded: beanstalk.interface.encodeFunctionData('enrootDeposit', [
            addr,
            crates[0].stem.toString(),
            unripeTokens[addr].stringify(crates[0].amount), // amount
          ]),
        };
      } else {
        prev[addr] = {
          crates,
          encoded: beanstalk.interface.encodeFunctionData('enrootDeposits', [
            addr,
            crates.map((crate) => crate.stem.toString()),
            crates.map((crate) => unripeTokens[addr].stringify(crate.amount)), // amounts
          ]),
        };
      }
    }
    return prev;
  }, {});

/**
 * @deprecated TODO: Refactor this to a selector, use the SDK
 */
export const selectCratesForEnrootNew = (
  sdk: BeanstalkSDK,
  siloBalances: TokenMap<FarmerSiloBalance>,
  getBDV: ReturnType<typeof useBDV>
) =>
  [...sdk.tokens.unripeTokens].reduce<{
    [addr: string]: { crates: LegacyDepositCrate[]; encoded: string };
  }>((prev, token) => {
    const crates = siloBalances[token.address]?.deposited.crates.filter(
      (crate) =>
        /// only select crates where BDV would stay the same or increase
        /// solves bug where fluctuations in unripe bdv cause enroots
        /// to fail in certain conditions.
        new BigNumber(getBDV(token).times(crate.amount).toFixed(6, 1)).gt(
          crate.bdv
        )
    );

    if (crates && crates.length > 0) {
      if (crates.length === 1) {
        prev[token.address] = {
          crates,
          encoded: sdk.contracts.beanstalk.interface.encodeFunctionData(
            'enrootDeposit',
            [
              token.address,
              crates[0].stem.toString(),
              transform(crates[0].amount, 'tokenValue', token).toBigNumber(),
              // unripeTokens[token.address].stringify(crates[0].amount), // amount
            ]
          ),
        };
      } else {
        prev[token.address] = {
          crates,
          encoded: sdk.contracts.beanstalk.interface.encodeFunctionData(
            'enrootDeposits',
            [
              token.address,
              crates.map((crate) => crate.stem.toString()),
              crates.map((crate) =>
                transform(crate.amount, 'tokenValue', token).toBigNumber()
                // unripeTokens[token].stringify(crate.amount)
              ), // amounts
            ]
          ),
        };
      }
    }
    return prev;
  }, {});
