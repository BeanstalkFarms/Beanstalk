import { BasinWell__factory } from "src/constants/generated";
import { TokenValue } from "src/TokenValue";
import Pool, { Reserves } from "./Pool";
import { ERC20Token } from "../Token";

export class BasinWell extends Pool {
  public getContract() {
    return BasinWell__factory.connect(this.address, Pool.sdk.providerOrSigner);
  }

  public getReserves() {
    Pool.sdk.debug(
      `BasinWell.getReserves(): ${this.address} ${this.name} on chain ${this.chainId}`
    );

    return this.getContract()
      .getReserves()
      .then(
        (result) =>
          [
            TokenValue.fromBlockchain(result[0], 0),
            TokenValue.fromBlockchain(result[1], 0)
          ] as Reserves
      );
  }

  async getAddLiquidityOut(amounts: TokenValue[]) {
    return this.getContract()
      .getAddLiquidityOut(amounts.map((a) => a.toBigNumber()))
      .then((result) => this.lpToken.fromBlockchain(result));
  }

  async getRemoveLiquidityOutEqual(amount: TokenValue) {
    return this.getContract()
      .getRemoveLiquidityOut(amount.toBigNumber())
      .then((result) => this.tokens.map((token, i) => token.fromBlockchain(result[i])));
  }

  async getRemoveLiquidityOutOneToken(lpAmountIn: TokenValue, tokenOut: ERC20Token) {
    const tokenIndex = this.tokens.findIndex((token) => token.equals(tokenOut));
    if (tokenIndex < 0) {
      throw new Error(`Unable to determine token index of ${tokenOut.symbol} in ${this.tokens}`);
    }

    return this.getContract()
      .getRemoveLiquidityOneTokenOut(lpAmountIn.toBigNumber(), tokenOut.address)
      .then((result) => {
        const underlying = [
          tokenOut.fromBlockchain(result),
          this.tokens[tokenIndex === 0 ? 1 : 0].fromHuman(0)
        ];
        // If the specified token out index === 1, reverse the result
        if (tokenIndex === 1) return underlying.reverse();
        return underlying;
      });
  }

  /**
   * Get the @wagmi/core multicall params for removing liquidity
   * @param lpAmountIn The amount of LP tokens to remove
   * @returns @wagmi/core multicall calls for
   * - removing equal amounts of liquidity
   * - removing single sided liquidity as well.tokens[0]
   * - removing single sided liquidity as well.tokens[1]
   */
  static getRemoveLiquidityOutMulticallParams(well: BasinWell, lpAmountIn: TokenValue) {
    const contract = {
      address: well.address as `0x${string}`,
      abi: removeLiquidityPartialABI
    };

    const removeEqual = {
      ...contract,
      method: "getRemoveLiquidityOut",
      args: [lpAmountIn.toBigNumber()]
    };

    const removeSingleSided0 = {
      ...contract,
      method: "getRemoveLiquidityOneTokenOut",
      args: [lpAmountIn.toBigNumber(), well.tokens[0].address as `0x${string}`]
    };

    const removeSingleSided1 = {
      ...contract,
      method: "getRemoveLiquidityOneTokenOut",
      args: [lpAmountIn.toBigNumber(), well.tokens[1].address as `0x${string}`]
    };

    return {
      equal: removeEqual,
      side0: removeSingleSided0,
      side1: removeSingleSided1
    };
  }
}

const removeLiquidityPartialABI = [
  {
    inputs: [
      { internalType: "uint256", name: "lpAmountIn", type: "uint256" },
      { internalType: "contract IERC20", name: "tokenOut", type: "address" }
    ],
    name: "getRemoveLiquidityOneTokenOut",
    outputs: [{ internalType: "uint256", name: "tokenAmountOut", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "lpAmountIn", type: "uint256" }],
    name: "getRemoveLiquidityOut",
    outputs: [{ internalType: "uint256[]", name: "tokenAmountsOut", type: "uint256[]" }],
    stateMutability: "view",
    type: "function"
  }
] as const;
