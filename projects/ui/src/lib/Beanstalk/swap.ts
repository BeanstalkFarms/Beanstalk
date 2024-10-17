import { tokenIshEqual } from '~/util';
import {
  BeanSwapNodeQuote,
  BeanSwapOperation,
  ERC20Token,
  FarmFromMode,
  FarmToMode,
  NativeToken,
} from '@beanstalk/sdk';
import BigNumber from 'bignumber.js';

export function getBeanSwapOperationWithQuote(
  quote: BeanSwapNodeQuote | undefined,
  sellToken: ERC20Token | NativeToken,
  buyToken: ERC20Token | NativeToken,
  sellAmount: BigNumber,
  buyAmount: BigNumber,
  slippage: number,
  account: string,
  fromMode?: FarmFromMode,
  toMode?: FarmToMode
): BeanSwapOperation | undefined {
  if (tokenIshEqual(buyToken, sellToken)) {
    return;
  }
  if (!quote || !quote.nodes.length) {
    throw new Error('No quote found');
  }

  const firstNode = quote.nodes[0];
  const lastNode = quote.nodes[quote.nodes.length - 1];
  if (!tokenIshEqual(sellToken, firstNode.sellToken)) {
    throw new Error(
      `Token input mismatch. Expected: ${sellToken} Got: ${firstNode.sellToken}`
    );
  }
  if (!tokenIshEqual(buyToken, lastNode.buyToken)) {
    throw new Error(
      `Token input mismatch. Expected: ${buyToken} Got: ${lastNode.buyToken}`
    );
  }
  if (quote.sellAmount.toHuman() !== sellAmount.toString()) {
    throw new Error(`Error building swap. Sell amount mismatch.`);
  }
  if (quote.buyAmount.toHuman() !== buyAmount.toString()) {
    throw new Error(`Error building swap. Buy amount mismatch.`);
  }
  if (slippage !== quote.slippage) {
    throw new Error(
      `Slippage mismatch. Expected: ${quote.slippage} Got: ${slippage}`
    );
  }

  const operation = BeanSwapOperation.buildWithQuote(
    quote,
    account,
    account,
    fromMode ?? FarmFromMode.INTERNAL_EXTERNAL,
    toMode ?? FarmToMode.INTERNAL
  );

  return operation;
}
