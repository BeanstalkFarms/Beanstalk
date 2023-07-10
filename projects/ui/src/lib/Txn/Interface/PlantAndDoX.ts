import {
  BeanstalkSDK,
  Token,
  TokenSiloBalance,
  TokenValue,
} from '@beanstalk/sdk';
import { ethers } from 'ethers';
import BigNumber from 'bignumber.js';
import { LegacyDepositCrate } from '~/state/farmer/silo';
import { tokenValueToBN } from '~/util';
import { ZERO_BN } from '~/constants';

export default class PlantAndDoX {
  constructor(
    private _sdk: BeanstalkSDK,
    private _earnedBeans: TokenValue,
    private _stem: ethers.BigNumber
  ) {
    this._sdk = _sdk;
    this._earnedBeans = _earnedBeans;
    this._stem = _stem;
  }

  /// Returns whether 'plant' can be called
  canPrependPlant(tokenIn: Token) {
    return this._earnedBeans.gt(0) && tokenIn.equals(this._sdk.tokens.BEAN);
  }

  getAmount() {
    return this._earnedBeans;
  }

  /// creates a DepositCrate of type DepositCrate in the SDK
  makePlantCrate() {
    return PlantAndDoX.makeCrate.tokenValue(
      this._sdk,
      this._earnedBeans,
      this._stem
    );
  }

  /// creates a DepositCrate of type DepositCrate in the UI
  makePlantCrateBN() {
    return PlantAndDoX.makeCrate.bigNumber(
      this._sdk,
      tokenValueToBN(this._earnedBeans),
      this._stem
    );
  }

  static makeCrate = {
    // as DepositCrate from SDK
    tokenValue(
      sdk: BeanstalkSDK,
      earnedBeans: TokenValue,
      stem: ethers.BigNumber
    ) {
      const { STALK, BEAN } = sdk.tokens;

      const stalk = BEAN.getStalk(earnedBeans);
      const seeds = BEAN.getSeeds(earnedBeans);
      // no stalk is grown yet as it is a new deposit from the current season
      const grownStalk = STALK.amount(0);

      // asTV => as DepositCrate<TokenValue> from SDK;
      const crate: TokenSiloBalance['deposits'][number] = {
        stem: stem,
        // season: ethers.BigNumber.from(season),
        amount: earnedBeans,
        bdv: earnedBeans,
        stalk: {
          total: stalk.add(grownStalk),
          base: stalk,
          grown: grownStalk,
        },
        seeds,
      };

      return crate;
    },

    // as DepositCrate from UI;
    bigNumber(
      sdk: BeanstalkSDK,
      earnedBeans: BigNumber,
      stem: ethers.BigNumber
    ): LegacyDepositCrate {
      const { BEAN } = sdk.tokens;
      const earnedTV = BEAN.amount(earnedBeans.toString());

      const stalk = BEAN.getStalk(earnedTV);
      const seeds = BEAN.getSeeds(earnedTV);

      const crate: LegacyDepositCrate = {
        amount: earnedBeans,
        stem: stem,
        bdv: earnedBeans,
        stalk: {
          total: tokenValueToBN(stalk),
          base: tokenValueToBN(stalk),
          grown: ZERO_BN,
        },
        seeds: tokenValueToBN(seeds),
      };

      return crate;
    },
  };
}
