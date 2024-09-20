import { ethers } from 'ethers';
import {
  BeanstalkSDK,
  BasinWell,
  TokenValue,
  AdvancedPipeStruct,
  ERC20Token,
  Clipboard,
  ZeroExQuoteResponse,
} from '@beanstalk/sdk';

/**
 * Parameters needed for PipelineConvert for the equal<->equal
 * equal<>equal refering to
 * - remove liquidity in equal proportions from source Well
 * - add liquidity in equal proportions to target Well
 */
export interface BuildPipeCallArgsEqual {
  sdk: BeanstalkSDK;
  source: {
    well: BasinWell;
    lpAmountIn: TokenValue;
    beanAmountOut: TokenValue;
    nonBeanAmountOut: TokenValue;
  };
  swap: {
    buyToken: ERC20Token;
    sellToken: ERC20Token;
    // amount from 0xQuote.buyAmount
    buyAmount: TokenValue;
    // 0x quote.allowanceTarget
    quote: ZeroExQuoteResponse;
  };
  target: {
    well: BasinWell;
    amountOut: TokenValue;
  };
  slippage: number;
}

export class PipelineConvert {
  private static erc20Approve(
    token: ERC20Token,
    spender: string,
    amount: ethers.BigNumberish = ethers.constants.MaxUint256,
    clipboard: string = ethers.constants.HashZero
  ): AdvancedPipeStruct {
    return {
      target: token.address,
      callData: token
        .getContract()
        .interface.encodeFunctionData('approve', [spender, amount]),
      clipboard,
    };
  }

  private static getRemoveLiquidityEqual(
    sourceWell: BasinWell,
    amountIn: TokenValue,
    minAmountsOut: TokenValue[],
    recipient: string,
    clipboard: string = ethers.constants.HashZero
  ): AdvancedPipeStruct {
    return {
      target: sourceWell.address,
      callData: sourceWell
        .getContract()
        .interface.encodeFunctionData('removeLiquidity', [
          amountIn.toBigNumber(),
          minAmountsOut.map((a) => a.toBigNumber()),
          recipient,
          ethers.constants.MaxUint256,
        ]),
      clipboard,
    };
  }

  private static wellSync(
    well: BasinWell,
    recipient: string,
    amount: ethers.BigNumberish,
    clipboard: string = ethers.constants.HashZero
  ): AdvancedPipeStruct {
    return {
      target: well.address,
      callData: well
        .getContract()
        .interface.encodeFunctionData('sync', [recipient, amount]),
      clipboard,
    };
  }

  private static transferToken(
    token: ERC20Token,
    recipient: string,
    amount: ethers.BigNumberish,
    clipboard: string = ethers.constants.HashZero
  ): AdvancedPipeStruct {
    return {
      target: token.address,
      callData: token
        .getContract()
        .interface.encodeFunctionData('transfer', [recipient, amount]),
      clipboard,
    };
  }

  private static junctionGte(
    junction: BeanstalkSDK['contracts']['junction'],
    left: ethers.BigNumberish,
    right: ethers.BigNumberish,
    clipboard: string = ethers.constants.HashZero
  ): AdvancedPipeStruct {
    return {
      target: junction.address,
      callData: junction.interface.encodeFunctionData('gte', [left, right]),
      clipboard: clipboard,
    };
  }

  private static junctionCheck(
    junction: BeanstalkSDK['contracts']['junction'],
    value: boolean,
    clipboard: string = ethers.constants.HashZero
  ): AdvancedPipeStruct {
    return {
      target: junction.address,
      callData: junction.interface.encodeFunctionData('check', [value]),
      clipboard,
    };
  }

  static buildEqual2Equal({
    sdk,
    source,
    swap,
    target,
    slippage,
  }: BuildPipeCallArgsEqual): AdvancedPipeStruct[] {
    if (
      swap.quote.from.toLowerCase() !==
      sdk.contracts.pipeline.address.toLowerCase()
    ) {
      throw new Error('Swap quote from address must be pipeline');
    }

    const pipe: AdvancedPipeStruct[] = [];

    const sourceWellAmountsOut = [
      source.beanAmountOut,
      source.nonBeanAmountOut,
    ];
    if (!source.well.tokens[0].equals(sdk.tokens.BEAN)) {
      sourceWellAmountsOut.reverse();
    }

    // 0. Approve source well to spend LP tokens
    pipe.push(
      PipelineConvert.erc20Approve(source.well.lpToken, source.well.address)
    );

    // 1. Remove liquidity from source well & set recipient to pipeline
    pipe.push(
      PipelineConvert.getRemoveLiquidityEqual(
        source.well,
        source.lpAmountIn,
        sourceWellAmountsOut.map((a) => a.subSlippage(slippage)),
        sdk.contracts.pipeline.address
      )
    );

    // 2. Approve 0x
    pipe.push(
      PipelineConvert.erc20Approve(swap.sellToken, swap.quote.allowanceTarget)
    );

    // 3. Swap nonBeanToken1 for nonBeanToken2. recipient MUST be Pipeline or this will fail.
    pipe.push({
      target: swap.quote.to,
      callData: swap.quote.data,
      clipboard: Clipboard.encode([]),
    });

    // 4. transfer BuyToken to target well
    pipe.push(
      PipelineConvert.transferToken(
        swap.buyToken,
        target.well.address,
        ethers.constants.Zero,
        Clipboard.encodeSlot(3, 0, 1)
      )
    );

    // 5. Transfer well.tokens[0] to target well
    pipe.push(
      PipelineConvert.transferToken(
        sdk.tokens.BEAN,
        target.well.address,
        ethers.constants.Zero,
        Clipboard.encodeSlot(1, 3, 1)
      )
    );

    const minLPOut = target.amountOut.subSlippage(slippage).toBigNumber();

    // 6. Call Sync on target well
    pipe.push(
      PipelineConvert.wellSync(
        target.well,
        sdk.contracts.pipeline.address,
        minLPOut
      )
    );

    // 7. Check if amount receieved from sync >= minLPOut
    pipe.push(
      PipelineConvert.junctionGte(
        sdk.contracts.junction,
        ethers.constants.Zero,
        minLPOut,
        Clipboard.encodeSlot(6, 0, 0)
      )
    );

    // 8. Check 7 is true
    pipe.push(
      PipelineConvert.junctionCheck(
        sdk.contracts.junction,
        true,
        Clipboard.encodeSlot(7, 0, 0)
      )
    );

    return pipe;
  }
}
