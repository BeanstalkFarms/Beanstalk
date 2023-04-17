import {
  BeanstalkSDK,
  Token,
  TokenSiloBalance,
  TokenValue,
} from '@beanstalk/sdk';
import { ethers } from 'ethers';
import BigNumber from 'bignumber.js';
import { DepositCrate } from '~/state/farmer/silo';
import { tokenValueToBN } from '~/util';

export default class PlantAndDoX {
  constructor(
    private _sdk: BeanstalkSDK,
    private _earnedBeans: TokenValue,
    private _season: number
  ) {
    this._earnedBeans = _earnedBeans;
    this._season = _season;
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
      this._season
    );
  }

  /// creates a DepositCrate of type DepositCrate in the UI
  makePlantCrateBN() {
    return PlantAndDoX.makeCrate.bigNumber(
      this._sdk,
      tokenValueToBN(this._earnedBeans),
      new BigNumber(this._season),
    );
  }

  static makeCrate = {
    // as DepositCrate from SDK
    tokenValue(
      sdk: BeanstalkSDK,
      earnedBeans: TokenValue,
      _season: number | BigNumber
    ) {
      const season = BigNumber.isBigNumber(_season)
        ? _season.toNumber()
        : _season;

      const { STALK, BEAN } = sdk.tokens;

      const stalk = BEAN.getStalk(earnedBeans);
      const seeds = BEAN.getSeeds(earnedBeans);
      // no stalk is grown yet as it is a new deposit from the current season
      const grownStalk = STALK.amount(0);

      // asTV => as DepositCrate<TokenValue> from SDK;
      const crate: TokenSiloBalance['deposited']['crates'][number] = {
        season: ethers.BigNumber.from(season),
        amount: earnedBeans,
        bdv: earnedBeans,
        stalk,
        baseStalk: stalk,
        grownStalk,
        seeds,
      };

      return crate;
    },
    // as DepositCrate from UI;
    bigNumber(
      sdk: BeanstalkSDK,
      earnedBeans: BigNumber,
      season: BigNumber
    ): DepositCrate {
      const { BEAN } = sdk.tokens;
      const earnedTV = BEAN.amount(earnedBeans.toString());

      const stalk = BEAN.getStalk(earnedTV);
      const seeds = BEAN.getSeeds(earnedTV);

      const crate: DepositCrate = {
        season,
        amount: earnedBeans,
        bdv: earnedBeans,
        stalk: tokenValueToBN(stalk),
        seeds: tokenValueToBN(seeds),
      };

      return crate;
    },
  };
}
