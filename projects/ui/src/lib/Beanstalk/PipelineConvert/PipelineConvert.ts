/* eslint-disable arrow-body-style */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable class-methods-use-this */
import {
  BeanstalkSDK,
  BasinWell,
  MinimumViableSwapQuote,
  Clipboard,
  ERC20Token,
  TokenValue,
  AdvancedPipeStruct,
  Deposit,
} from '@beanstalk/sdk';
import { ethers } from 'ethers';
import { multicall } from '@wagmi/core';
import { config } from '~/util/wagmi/config';
import { fetch0xWithLimiter } from '~/util/Bottleneck';
import Utils from './utils';
/**
 * @notes Space-bean
 *
 * Ideally we would have this in the SDK, but we need access to wagmi multicall, which is currently not in the SDK.
 */

/**
 * Utility class for constructing pipeline converts
 */
export class PipelineConvert {
  static sdk: BeanstalkSDK;

  constructor(sdk: BeanstalkSDK) {
    PipelineConvert.sdk = sdk;
  }

  /// Remove Equal 2 Add Equal
  // 1. Remove in equal parts from Well 1
  // 2. Swap non-bean token of well 1 for non-bean token of well 2
  // 3. Add in equal parts to well 2

  /**
   * Estimates the result of a Remove Equal 2 Add Equal pipeline convert
   * @param sourceWell Well to remove liquidity from
   * @param targetWell Well to add liquidity to
   * @param siloTokenBalance Silo token balance of the user
   * @param amountIn Amount of sourceWell.lpToken to remove
   * @param slippage Slippage tolerance for swap
   */
  async fetchEq2Eq(
    sourceWell: BasinWell,
    targetWell: BasinWell,
    deposits: Deposit<TokenValue>[],
    amountIn: TokenValue,
    swapSlippage: number,
    addLiquiditySlippage: number
  ) {
    validateWhitelistedWell(PipelineConvert.sdk, sourceWell);
    validateWhitelistedWell(PipelineConvert.sdk, targetWell);
    validateDeposits(deposits);
    validateAmountIn(amountIn);
    validateSlippage(swapSlippage);

    console.debug('[PipelineConvert] estimateRemoveEqual2AddEqual', {
      sourceWell: sourceWell,
      targetWell: targetWell,
      amountIn: amountIn.toHuman(),
      swapSlippage,
    });

    const sourceLP = sourceWell.lpToken;
    const targetLP = targetWell.lpToken;

    const convertDetails =
      PipelineConvert.sdk.silo.siloConvert.calculateConvert(
        sourceLP,
        targetLP,
        amountIn,
        deposits,
        0
      );

    console.debug('[PipelineConvert] convertDetails: ', convertDetails);

    // Remove Liquidity
    const removeLPResult = await PipelineConvert.fetchEq2EqRemoveLiquidityOut(
      sourceWell,
      convertDetails.crates
    );

    const sourceIndexes = sourceWell.getBeanWellTokenIndexes();
    const targetIndexes = targetWell.getBeanWellTokenIndexes();

    // Swap
    const sellToken = sourceWell.tokens[sourceIndexes.nonBean];
    const buyToken = targetWell.tokens[targetIndexes.nonBean];

    const requests = removeLPResult.amountsOut.map((amounts, i) => {
      const nonBeanAmount = amounts[sourceIndexes.nonBean];
      const requestId = convertDetails.crates[i].id.toHexString();

      const request = () =>
        PipelineConvert.fetchSwapQuote(
          buyToken,
          sellToken,
          nonBeanAmount,
          swapSlippage
        );

      return {
        id: requestId,
        request,
      };
    });

    const swapQuotes = await fetch0xWithLimiter(requests);

    // Add Liquidity
    const denominator = removeLPResult.summedAmounts[sourceIndexes.nonBean];
    const depositAmountsIn = removeLPResult.amountsOut.map(
      (tokenAmountsOut, i) => {
        const beanAmountOut = removeLPResult.amountsOut[i][sourceIndexes.bean];
        const nonBeanAmountOut = tokenAmountsOut[sourceIndexes.nonBean];
        const ratio = nonBeanAmountOut.div(denominator);
        const buyAmount = swapQuotes[i].buyAmount;

        const addLiquidityAmountsIn = [beanAmountOut, buyAmount.mul(ratio)];

        if (targetIndexes.bean === 1) {
          addLiquidityAmountsIn.reverse();
        }

        return addLiquidityAmountsIn;
      }
    );

    const addLiquidityResults = await PipelineConvert.fetchEq2EqAddLiquidityOut(
      targetWell,
      depositAmountsIn
    );

    const convertResults = convertDetails.crates.map((deposit, i) => {
      const amountOut = addLiquidityResults.amountsOut[i];
      const advPipeCalls = PipelineConvert.buildEq2EqAdvancedPipe({
        source: {
          well: sourceWell,
          amountIn: deposit.amount,
          minAmountsOut: removeLPResult.amountsOut[i],
        },
        swap: {
          buyToken: buyToken,
          sellToken: sellToken,
          quote: swapQuotes[i].swapQuote,
        },
        target: {
          well: targetWell,
          amountOut: amountOut.subSlippage(addLiquiditySlippage),
        },
      });

      return {
        deposit,
        advPipeCalls,
        amountOut,
      };
    });

    console.debug('[PipelineConvert] convertResults: ', convertResults);

    return {
      convertDetails,
      results: convertResults,
      amountOut: addLiquidityResults.summedAmounts,
    };
  }

  private static async fetchSwapQuote(
    buyToken: ERC20Token,
    sellToken: ERC20Token,
    sellAmount: TokenValue,
    slippage: number
  ) {
    const quote = await PipelineConvert.sdk.zeroX.fetchSwapQuote({
      sellToken: sellToken.address,
      buyToken: buyToken.address,
      sellAmount: sellAmount.blockchainString,
      takerAddress: PipelineConvert.sdk.contracts.pipeline.address,
      shouldSellEntireBalance: true,
      skipValidation: true,
      slippagePercentage: slippage.toString(),
    });

    // prettier-ignore
    console.debug('[PipelineConvert] fetchQuote: ', { 
      buyToken: buyToken, sellToken: sellToken, sellAmount: sellAmount, slippage, quote 
    });

    return {
      swapQuote: quote,
      buyAmount: buyToken.fromBlockchain(quote.buyAmount),
    };
  }

  private static async fetchEq2EqRemoveLiquidityOut(
    well: BasinWell,
    pickedDeposits: Deposit<TokenValue>[]
  ) {
    const [token0, token1] = well.tokens;
    const multicallContracts = Utils.constructMulticall.removeLiquidityEqual(
      well,
      pickedDeposits
    );

    const response = await Promise.all(
      multicallContracts.map((contracts) =>
        multicall(config, { contracts, allowFailure: false })
      )
    );

    const rawResults = response.flat() as bigint[][];
    const amountsOut = rawResults.map(([amountIndex0, amountIndex1]) => [
      token0.fromBlockchain(amountIndex0),
      token1.fromBlockchain(amountIndex1),
    ]);
    const summedAmounts = amountsOut.reduce(
      ([total0, total1], [amount0, amount1]) => [
        total0.add(amount0),
        total1.add(amount1),
      ],
      [token0.fromHuman('0'), token1.fromHuman('0')]
    );

    // prettier-ignore
    console.debug('[PipelineConvert] fetchEq2EqRemoveLiquidityOut: ', {
      well: well.name, wellAddress: well.address, deposits: pickedDeposits, amountsOut, summedAmounts,
    });

    return {
      amountsOut,
      summedAmounts,
    };
  }

  private static async fetchEq2EqAddLiquidityOut(
    well: BasinWell,
    amountsIn: TokenValue[][]
  ) {
    const results = await Promise.all(
      Utils.constructMulticall
        .addLiquidity(well, amountsIn)
        .map((contracts) =>
          multicall(config, { contracts, allowFailure: false })
        )
    );
    const rawResults = results.flat() as bigint[];
    const amountsOut = rawResults.map((r) => well.lpToken.fromBlockchain(r));

    const summedAmounts = amountsOut.reduce<TokenValue>(
      (prev, curr) => prev.add(curr),
      well.lpToken.fromHuman(0)
    );

    // prettier-ignore
    console.debug('[PipelineConvert] fetchEq2EqAddLiquidityOut: ', {
      well: well.name, wellAddress: well.address, amountsIn, amountsOut, summedAmounts,
    });

    return {
      amountsOut,
      summedAmounts,
    };
  }

  /**
   * Builds the advanced pipe calls for a Remove Equal 2 Add Equal pipeline convert
   */
  public static buildEq2EqAdvancedPipe(params: {
    source: {
      well: BasinWell;
      amountIn: TokenValue;
      minAmountsOut: TokenValue[];
    };
    swap: {
      buyToken: ERC20Token;
      sellToken: ERC20Token;
      quote: MinimumViableSwapQuote;
    };
    target: {
      well: BasinWell;
      amountOut: TokenValue;
    };
  }) {
    const { source, swap, target } = params;

    const sellTokenIndex = source.well.tokens.findIndex(
      (t) => t.address.toLowerCase() === swap.sellToken.address.toLowerCase()
    );

    const pipe: AdvancedPipeStruct[] = [];

    // 0: approve from.well.lpToken to use from.well.lpToken
    pipe.push(
      PipelineConvert.snippets.erc20Approve(
        source.well.lpToken,
        source.well.address
      )
    );

    // 1: remove liquidity from from.well
    pipe.push(
      PipelineConvert.snippets.removeLiquidity(
        source.well,
        source.amountIn,
        source.minAmountsOut,
        PipelineConvert.sdk.contracts.pipeline.address
      )
    );

    // 2: Approve swap contract to spend sellToken
    pipe.push(
      PipelineConvert.snippets.erc20Approve(
        swap.sellToken,
        swap.quote.allowanceTarget
      )
    );

    // 3: Swap non-bean token of well 1 for non-bean token of well 2
    pipe.push({
      target: swap.quote.to,
      callData: swap.quote.data,
      clipboard: Clipboard.encode([]),
    });

    // 4: transfer swap result to target well
    pipe.push(
      PipelineConvert.snippets.erc20Transfer(
        swap.buyToken,
        target.well.address,
        TokenValue.ZERO, // overriden w/ clipboard
        Clipboard.encodeSlot(3, 0, 1)
      )
    );

    // 5: transfer from from.well.tokens[non-bean index] to target well
    pipe.push(
      PipelineConvert.snippets.erc20Transfer(
        source.well.tokens[sellTokenIndex === 1 ? 0 : 1],
        target.well.address,
        TokenValue.MAX_UINT256, // overriden w/ clipboard
        Clipboard.encodeSlot(1, 2, 1)
      )
    );

    // 6. Call Sync on target well
    pipe.push(
      PipelineConvert.snippets.wellSync(
        target.well,
        PipelineConvert.sdk.contracts.pipeline.address, // set recipient to pipeline
        target.amountOut // min LP Out
      )
    );

    return pipe;
  }

  // ---------- static methods ----------
  private static snippets = {
    // ERC20 Token Methods
    erc20Approve: (
      token: ERC20Token,
      spender: string,
      amount: TokenValue = TokenValue.MAX_UINT256,
      clipboard: string = Clipboard.encode([])
    ): AdvancedPipeStruct => {
      return {
        target: token.address,
        callData: token
          .getContract()
          .interface.encodeFunctionData('approve', [
            spender,
            amount.toBigNumber(),
          ]),
        clipboard,
      };
    },
    erc20Transfer: (
      token: ERC20Token,
      recipient: string,
      amount: TokenValue,
      clipboard: string = Clipboard.encode([])
    ): AdvancedPipeStruct => {
      return {
        target: token.address,
        callData: token
          .getContract()
          .interface.encodeFunctionData('transfer', [
            recipient,
            amount.toBigNumber(),
          ]),
        clipboard,
      };
    },
    // // Well Methods
    removeLiquidity: (
      well: BasinWell,
      amountIn: TokenValue,
      minAmountsOut: TokenValue[],
      recipient: string,
      clipboard: string = Clipboard.encode([])
    ): AdvancedPipeStruct => {
      return {
        target: well.address,
        callData: well
          .getContract()
          .interface.encodeFunctionData('removeLiquidity', [
            amountIn.toBigNumber(),
            minAmountsOut.map((v) => v.toBigNumber()),
            recipient,
            ethers.constants.MaxUint256,
          ]),
        clipboard: clipboard,
      };
    },
    wellSync: (
      well: BasinWell,
      recipient: string,
      amount: TokenValue,
      clipboard: string = Clipboard.encode([])
    ): AdvancedPipeStruct => {
      return {
        target: well.address,
        callData: well
          .getContract()
          .interface.encodeFunctionData('sync', [
            recipient,
            amount.toBigNumber(),
          ]),
        clipboard,
      };
    },
    // Junction methods
    gte: (
      value: TokenValue,
      compareTo: TokenValue,
      clipboard: string = Clipboard.encode([])
    ): AdvancedPipeStruct => {
      return {
        target: PipelineConvert.sdk.contracts.junction.address,
        // value >= compare
        callData:
          PipelineConvert.sdk.contracts.junction.interface.encodeFunctionData(
            'gte',
            [value.toBigNumber(), compareTo.toBigNumber()]
          ),
        clipboard,
      };
    },
    check: (
      // index of the math or logic operation in the pipe
      index: number
    ): AdvancedPipeStruct => {
      return {
        target: PipelineConvert.sdk.contracts.junction.address,
        callData:
          PipelineConvert.sdk.contracts.junction.interface.encodeFunctionData(
            'check',
            [false]
          ),
        clipboard: Clipboard.encodeSlot(index, 0, 0),
      };
    },
  };

  static decodeStaticResults(results: string[]) {
    try {
      const data = results.map((result) => {
        const decoded =
          PipelineConvert.sdk.contracts.beanstalk.interface.decodeFunctionResult(
            'pipelineConvert',
            result
          );
        return {
          fromAmount: decoded.fromAmount as ethers.BigNumber,
          toAmount: decoded.toAmount as ethers.BigNumber,
          fromBdv: decoded.fromBdv as ethers.BigNumber,
          toBdv: decoded.toBdv as ethers.BigNumber,
          toStem: decoded.toStem as ethers.BigNumber,
        };
      });

      return data;
    } catch (e) {
      console.error('[PipelineConvert/decodeStaticResult] FAILED: ', e);
      throw e;
    }
  }
}

// validation

function validateWhitelistedWell(sdk: BeanstalkSDK, well: BasinWell) {
  if (!sdk.pools.whitelistedPools.has(well.address)) {
    throw new Error(`${well.name} is not a whitelisted well`);
  }
}

function validateAmountIn(amountIn: TokenValue) {
  if (amountIn.lte(0)) {
    throw new Error('Cannot convert 0 or less tokens');
  }
}

function validateDeposits(deposits: Deposit<TokenValue>[]) {
  if (!deposits.length) {
    throw new Error('No convertible deposits');
  }
}

function validateSlippage(slippage: number) {
  if (slippage < 0) {
    throw new Error('Invalid slippage');
  }
}
