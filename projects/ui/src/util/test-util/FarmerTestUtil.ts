import {
  BeanstalkSDK,
  DataSource,
  Token,
  TokenValue,
  TestUtils,
  FarmFromMode,
  FarmWorkflow,
  StepGenerator,
} from '@beanstalk/sdk';
import { ethers } from 'ethers';

import {
  GetPlotsAtFrontQuery,
  GetPlotsAtFrontDocument,
} from '../../generated/graphql';
import { FertilizerFacet } from '../../generated/protocol/abi/Beanstalk';
import { getTestUtilsWithAccount } from '.';
import FarmerTestCache from './FarmerTestCache';

export default class FarmerTestUtil {
  private sdk: BeanstalkSDK;

  private account: string;

  private chain: TestUtils.BlockchainUtils;

  private cacheMap: { [cacheKey: string]: FarmerTestCache } = {};

  private activeCacheKey: string = 'main';

  cache: FarmerTestCache;

  constructor(
    _sdk: BeanstalkSDK,
    _account: string,
    _chain: TestUtils.BlockchainUtils
  ) {
    this.sdk = _sdk;
    this.account = _account;
    this.chain = _chain;
    this.cacheMap[this.activeCacheKey] = new FarmerTestCache();
    this.cache = this.cacheMap.main;
  }

  /**
   * ------------------------------------------------------------
   * -------------------- CACHE METHODS -------------------------
   */

  private setActiveCache = (key: string) => {
    if (!(key in this.cacheMap)) return;
    this.activeCacheKey = key;
    this.cache = this.cacheMap[key];
  };

  public manageCache = {
    setActive: this.setActiveCache,
    create: (
      cacheKey: string,
      options?: {
        copyFrom?: string;
      }
    ) => {
      if (cacheKey === 'main') return;
      const existingCacheKey = options?.copyFrom;

      this.cacheMap[cacheKey] = existingCacheKey
        ? new FarmerTestCache(this.cacheMap[existingCacheKey].getCache())
        : new FarmerTestCache();

      /// set the active cache to the new one
      this.setActiveCache(cacheKey);
    },
    delete: (cacheKey: string) => {
      if (cacheKey === 'main') return;
      if (cacheKey === this.activeCacheKey) {
        this.setActiveCache('main');
      }
      delete this.cacheMap[cacheKey];
    },
  };

  /**
   * ------------------------------------------------------------
   * -------------------- CONVENIENCE METHODS -------------------
   */

  public getBalance = {
    siloToken: async (tk?: Token, _acc?: string, _source?: DataSource) => {
      const token = tk || this.sdk.tokens.BEAN;
      const source = _source || DataSource.LEDGER;
      const address = _acc || this.account;
      return this.sdk.silo.getBalance(token, address, {
        source,
      });
    },
    siloWhitelist: async (_acc?: string, _source?: DataSource) => {
      const source = _source || DataSource.LEDGER;
      const address = _acc || this.account;
      return this.sdk.silo.getBalances(address, {
        source,
      });
    },
    token: async (tk?: Token, _acc?: string) => {
      const token = tk || this.sdk.tokens.BEAN;
      const address = _acc || this.account;
      return this.sdk.tokens.getBalance(token, address);
    },
    tokens: async (tks?: Token[], _acc?: string) => {
      const address = _acc || this.account;
      const result = await this.sdk.tokens.getBalances(address, tks);
      return result;
    },
    siloAndToken: async (tk?: Token, _acc?: string, _source?: DataSource) => {
      const token = tk || this.sdk.tokens.BEAN;
      const source = _source || DataSource.LEDGER;
      const address = _acc || this.account;

      const [tokenBal, siloBal] = await Promise.all([
        this.sdk.tokens.getBalance(token, address),
        this.sdk.silo.getBalance(token, address, { source }),
      ]);
      return {
        token: tokenBal,
        silo: siloBal,
      };
    },
    fertilized: async (fertilizerIds: string[], _acc?: string) => {
      const fertilizedBN =
        await this.sdk.contracts.beanstalk.balanceOfFertilized(
          _acc || this.account,
          fertilizerIds
        );
      const rinsable = this.sdk.tokens.BEAN.fromBlockchain(fertilizedBN);
      return rinsable;
    },
    earnedBeans: async (_acc?: string) => {
      const earned = await this.sdk.contracts.beanstalk.balanceOfEarnedBeans(
        _acc || this.account
      );
      return this.sdk.tokens.BEAN.fromBlockchain(earned);
    },
    grownStalk: async (_acc?: string) => {
      const grown = await this.sdk.contracts.beanstalk.balanceOfGrownStalk(
        _acc || this.account
      );
      return this.sdk.tokens.BEAN.fromBlockchain(grown);
    },
    earnedStalk: async (_acc?: string) => {
      const earned = await this.sdk.contracts.beanstalk.balanceOfEarnedStalk(
        _acc || this.account
      );
      return this.sdk.tokens.STALK.fromBlockchain(earned);
    },
    earnedSeeds: async (_acc?: string) => {
      const earned = await this.sdk.contracts.beanstalk.balanceOfEarnedSeeds(
        _acc || this.account
      );
      return this.sdk.tokens.SEEDS.fromBlockchain(earned);
    },
  };

  /**
   * ------------------------------------------------------------
   * ------------------------ TEST SETUP ------------------------
   */

  steps = {
    /// requires user to have USDC in their EXTERNAL balance
    mintFert: (usdcAmount: number, fromMode?: FarmFromMode) => {
      const { beanstalk, curve } = this.sdk.contracts;
      const { USDC } = this.sdk.tokens;
      const amount = USDC.amount(usdcAmount);

      const step: StepGenerator = async (_amountInStep) => {
        const minLP = await curve.zap.callStatic.calc_token_amount(
          curve.pools.beanCrv3.address,
          [
            amount.mul(0.866616).blockchainString,
            0,
            amount.blockchainString,
            0,
          ],
          true, // _is_deposit
          { gasLimit: 10000000 }
        );

        return {
          name: 'mintFertilizer',
          amountOut: _amountInStep,
          prepare: () => ({
            target: beanstalk.address,
            callData: beanstalk.interface.encodeFunctionData('mintFertilizer', [
              usdcAmount.toFixed(0),
              FarmWorkflow.slip(minLP, 0.1),
              fromMode ?? FarmFromMode.EXTERNAL,
            ]),
          }),
          decode: (data: string) =>
            beanstalk.interface.decodeFunctionData('mintFertilizer', data),
          decodeResult: (result: string) =>
            beanstalk.interface.decodeFunctionResult('mintFertilizer', result),
        };
      };

      return [step];
    },
    localOnly: (name: string, amount: TokenValue) => async () => ({
      name: name,
      amountOut: amount.toBigNumber(),
      prepare: () => ({
        target: '',
        callData: '',
      }),
      decode: () => undefined,
      decodeResult: () => undefined,
    }),
  };

  async prepareSiloAndFertilizer(_amount: number) {
    const approveAmount = TokenValue.MAX_UINT256.toBigNumber();
    const { BEAN, BEAN_CRV3_LP, UNRIPE_BEAN, UNRIPE_BEAN_CRV3, USDC } =
      this.sdk.tokens;

    const { chain: c, account: a } = this;

    await Promise.all([
      await c.seturBEAN3CRVBalance(a, UNRIPE_BEAN_CRV3.amount(_amount)),
      await c.seturBEANBalance(a, UNRIPE_BEAN.amount(_amount)),
      await c.setBEANBalance(a, BEAN.amount(_amount)),
      await c.setBEAN3CRVBalance(a, BEAN_CRV3_LP.amount(_amount)),
      await c.setUSDCBalance(a, USDC.amount(_amount)),
      await UNRIPE_BEAN_CRV3.approveBeanstalk(approveAmount),
      await UNRIPE_BEAN.approveBeanstalk(approveAmount),
      await BEAN.approveBeanstalk(approveAmount),
      await BEAN_CRV3_LP.approveBeanstalk(approveAmount),
      await USDC.approveBeanstalk(approveAmount),
    ]);
  }

  /**
   * sets up test account with silo deposits and fertilizer.
   * @param _amount - amount of each silo whitelist token to deposit
   * NOTE: If amount exceeds token balance, this will fail
   */
  async setupSiloAndFertilizer({
    amount: _amount,
    options,
  }: {
    amount: number;
    options?: {
      noDeposit?: boolean;
      noFertilizer?: boolean;
      noWithdrawal?: boolean;
    };
  }) {
    const { BEAN } = this.sdk.tokens;

    const whitelisted = this.sdk.tokens.siloWhitelist;
    const amountIn = BEAN.amount(_amount);

    const workflow = this.sdk.farm.create();
    const seasonOfDeposit = await this.sdk.sun.getSeason();

    if (!options?.noDeposit) {
      [...whitelisted].forEach((tk) => {
        const amount = tk.amount(_amount);
        workflow.add(this.steps.localOnly(`pre-deposit-${tk.symbol}`, amount), {
          onlyLocal: true,
        });
        workflow.add(
          new this.sdk.farm.actions.Deposit(tk, FarmFromMode.EXTERNAL)
        );

        if (!options?.noWithdrawal) {
          if (tk.equals(BEAN)) {
            workflow.add(
              new this.sdk.farm.actions.WithdrawDeposits(
                BEAN.address,
                [seasonOfDeposit.toString()],
                [amountIn.toBlockchain()]
              )
            );
          }
        }
      });
    }

    if (!options?.noFertilizer) {
      workflow.add(this.steps.mintFert(_amount));
    }

    await workflow.estimate(amountIn);
    const tx = await workflow.execute(amountIn, { slippage: 0.1 });
    await tx.wait();
  }

  /**
   * @param _options -
   * - first: number of plots to retrieve from subgraph (default 5),
   * - min: minimum number of pods to be transferred (default 1)
   * @returns plot ids transferred to account and sum of pods transferred
   */
  async receiveNextHarvestablePlots(_options?: {
    first?: number;
    min?: number;
  }) {
    const plotInfo = await this.sdk.graphql.request<GetPlotsAtFrontQuery>(
      GetPlotsAtFrontDocument,
      { first: _options?.first || 5 }
    );

    if (!plotInfo || !plotInfo.plots.length) {
      throw new Error('Plot data could not be successfully retrieved');
    }

    const min = ethers.BigNumber.from(_options?.min || 1);

    const plotsToTransfer = plotInfo.plots.reduce<{
      plots: GetPlotsAtFrontQuery['plots'][number][];
      amount: TokenValue;
    }>(
      (memo, plot) => {
        if (memo.amount.gte(min)) return memo;
        return {
          plots: [...memo.plots, plot],
          amount: memo.amount.add(plot.pods),
        };
      },
      { plots: [], amount: TokenValue.ZERO }
    );

    const { ETH } = this.sdk.tokens;

    const plotIds: ethers.BigNumber[] = [];

    for (const plot of plotsToTransfer.plots) {
      const accUtil = await getTestUtilsWithAccount(plot.farmer.id);
      await accUtil.util.setETHBalance(plot.farmer.id, ETH.amount(1));

      const tx = await accUtil.sdk.contracts.beanstalk.transferPlot(
        plot.farmer.id,
        this.account,
        plot.index,
        '0',
        plot.pods
      );
      await tx.wait();
      await accUtil.stop();
      plotIds.push(ethers.BigNumber.from(plot.id));
    }

    return plotIds;
  }

  /**
   * ------------------------------------------------------------
   * ----------------------- FARMER BARN ------------------------
   */

  /**
   * Compares fertilizerIds between the current state and a prior state
   * and returns the fertilizer IDs where the supply has increased.
   * Used to determine which fertilizerIds will be used when rinsing sprouts ('claimFertilized')
   */
  async getAndParseFertilizerIds(
    _prev: FertilizerFacet.SupplyStructOutput[],
    _curr?: FertilizerFacet.SupplyStructOutput[]
  ) {
    const { beanstalk } = this.sdk.contracts;
    const fertilizerIds: string[] = [];

    const prev = new Map(_prev.map((f) => [f.endBpf.toString(), f.supply]));

    const getCurr = async () => _curr || beanstalk.getFertilizers();

    const curr = await getCurr();
    curr.forEach((f) => {
      const id = f.endBpf.toString();
      const prevSupply = prev.get(id);
      if (!prevSupply) {
        fertilizerIds.push(id);
      } else if (f.supply.gt(prevSupply)) {
        fertilizerIds.push(id);
      }
    });

    return fertilizerIds;
  }
}
