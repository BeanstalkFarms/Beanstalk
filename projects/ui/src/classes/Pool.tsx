import BigNumber from 'bignumber.js';
import {
  CurveMetaPool__factory,
  CurvePlainPool__factory,
  UniswapV2Pair__factory,
} from '~/generated/index';
import { ChainConstant, AddressMap, SupportedChainId } from '~/constants';
import { MinBN } from '~/util/Tokens';
import client from '~/util/Client';
import { CRV3, DAI, USDC, USDT } from '~/constants/tokens';
import { getChainConstant } from '~/util/Chain';
import Token, { ERC20Token } from './Token';

type Reserves = [BigNumber, BigNumber];

/**
 * A Pool is an AMM liquidity pool between at least 2 tokens.
 */
export default abstract class Pool {
  /**
   * The contract address on the chain on which this token lives
   */
  public readonly address: string;

  /**
   * The chain ID on which this currency resides
   */
  public readonly chainId: number;

  /**
   * The liquidity token associated with the pool
   */
  public readonly lpToken: ERC20Token;

  /**
   * The liquidity token associated with the pool
   */
  public readonly tokens: ERC20Token[];

  /**
   * 
   */
  public readonly underlying: ERC20Token[];

  /**
   * The name of the currency, i.e. a descriptive textual non-unique identifier
   */
  public readonly name: string;

  /**
   * The symbol of the currency, i.e. a short textual non-unique identifier
   */
  public readonly symbol: string;

  /**
   * The name of the currency, i.e. a descriptive textual non-unique identifier
   */
  public readonly logo: string;

  public readonly color: string;

  /**
   * @param chainId the chain ID on which this currency resides
   * @param decimals decimals of the currency
   * @param symbol symbol of the currency
   * @param name of the currency
   */
  constructor(
    chainId: SupportedChainId,
    address: AddressMap<string>,
    // dex: Dex,
    lpToken: ChainConstant<ERC20Token>,
    tokens:  ChainConstant<ERC20Token>[],
    metadata: {
      name: string;
      symbol: string;
      logo: string;
      color: string; // ['#ed9f9c', '#549e3f', '#6dcb60', '#3c76af', '#aecde1'];
    }
  ) {
    this.chainId = chainId;
    this.address = getChainConstant(address, chainId).toLowerCase();
    this.lpToken = getChainConstant(lpToken, chainId);
    this.tokens = tokens.map((token) => getChainConstant(token, chainId));
    this.underlying = tokens.reduce<ERC20Token[]>((prev, token) => {
      // CRV3 pools can access the underlying stables [DAI, USDC, USDT].
      if (token === CRV3) {
        // FIXME: hardcoded indices for 3CRV
        prev.push(...[
          getChainConstant(DAI, chainId),
          getChainConstant(USDC, chainId),
          getChainConstant(USDT, chainId),
        ]);
      } else {
        prev.push(getChainConstant(token, chainId));
      }
      return prev;
    }, []);

    this.name = metadata.name;
    this.symbol = metadata.symbol;
    this.logo = metadata.logo;
    this.color = metadata.color;
  }

  /**
   * Returns whether this currency is functionally equivalent to the other currency
   * @param other the other currency
   */
  public equals(other: Token): boolean {
    return this.chainId === other.chainId && this.address === other.address;
  }

  /**
   * Used to calculate how much of an underlying reserve a given amount of LP tokens owns in an LP pool.
   * Ownership of reserve tokens is proportional to ownership of LP tokens.
   *
   * @param amount - the amount of LP tokens the farmer owns
   * @param reserve - the reserve of an asset in the lp pool
   * @param totalLP - the total lp tokens
   * @returns the amount of reserve tokens the farmer owns.
   */
  static tokenForLP = (
    amount: BigNumber,
    reserve: BigNumber,
    totalLP: BigNumber
  ) => amount.multipliedBy(reserve).dividedBy(totalLP);

  /**
   * Used to calcuate the # of reserve tokens owned by a farmer for 2 assets in a pool (e.g. Beans + Eth)
   * Just calls tokenForLP twice.
   */
  static poolForLP = (
    amount: BigNumber,
    reserve1: BigNumber,
    reserve2: BigNumber,
    totalLP: BigNumber
  ) => {
    if (
      amount.isLessThanOrEqualTo(0) ||
      reserve1.isLessThanOrEqualTo(0) ||
      reserve2.isLessThanOrEqualTo(0) ||
      totalLP.isLessThanOrEqualTo(0)
    ) {
      return [new BigNumber(0), new BigNumber(0)];
    }
    return [
      Pool.tokenForLP(amount, reserve1, totalLP),
      Pool.tokenForLP(amount, reserve2, totalLP),
    ];
  };

  /**
   * The opposite of tokenForLP. If a farmer owns/deposits X of reserve asset -> how many LP tokens do they 1 own/get.
   *
   * @param amount - the amount of the reserve asset the farmer has
   * @param reserve - the total amount of the reserve asset
   * @param totalLP - the total amount of the LP token
   * @returns the amount of lp tokens that amount corresponds to.
   */
  static lpForToken = (
    amount: BigNumber,
    reserve: BigNumber,
    totalLP: BigNumber
  ) => amount.multipliedBy(totalLP).dividedBy(reserve);

  /**
   * The opposite of poolForLP - used to calculate how many LP tokens a farmer gets if they deposit both reserve assets in a 2 asset pool.
   * e.g. if a farmer deposits amount1 of Beans and amount2 of Eth into an LP pool with reserve1 Beans, reserve2 Eth and totalLP LP tokens, it returns how many LP tokens the farmer gets.
   */
  static lpForPool = (
    amount1: BigNumber,
    reserve1: BigNumber,
    amount2: BigNumber,
    reserve2: BigNumber,
    totalLP: BigNumber
  ) =>
    MinBN(
      Pool.lpForToken(amount1, reserve1, totalLP),
      Pool.lpForToken(amount2, reserve2, totalLP)
    );

  /**
   *
   */
  static getToAmount = (
    amountIn: BigNumber,
    reserveIn: BigNumber,
    reserveOut: BigNumber
  ) => {
    if (
      amountIn.isLessThanOrEqualTo(0) ||
      reserveIn.isLessThanOrEqualTo(0) ||
      reserveOut.isLessThanOrEqualTo(0)
    ) {
      return new BigNumber(0);
    }
    const amountInWithFee = amountIn.multipliedBy(997);
    const numerator = amountInWithFee.multipliedBy(reserveOut);
    const denominator = reserveIn.multipliedBy(1000).plus(amountInWithFee);
    return numerator.dividedBy(denominator);
  };

  abstract getReserves(): Promise<Reserves>;
}

// ------------------------------------
// Uniswap V2 Pool
// ------------------------------------
export class UniswapV2Pool extends Pool {
  public getContract() {
    return UniswapV2Pair__factory.connect(this.address, client.provider);
  }

  public getReserves() {
    console.debug(
      `[UniswapV2Pool] getReserves: ${this.address} ${this.name} on chain ${client.provider._network.chainId}`
    );
    return this.getContract()
      .getReserves()
      .then(
        (result) =>
          [
            new BigNumber(result._reserve0.toString()),
            new BigNumber(result._reserve1.toString()),
          ] as Reserves
      );
  }
}

// ------------------------------------
// Curve MetaPool
// ------------------------------------
export class CurveMetaPool extends Pool {
  public getContract() {
    return CurveMetaPool__factory.connect(this.address, client.provider);
  }

  public getReserves(): Promise<Reserves> {
    return this.getContract()
      .get_balances()
      .then(
        (result) =>
          [
            new BigNumber(result[0].toString()),
            new BigNumber(result[1].toString()),
          ] as Reserves
      );
  }
}

// ------------------------------------
// Curve Plain Pool
// ------------------------------------
export class CurvePlainPool extends Pool {
  public getContract() {
    return CurvePlainPool__factory.connect(this.address, client.provider);
  }

  public getReserves(): Promise<Reserves> {
    return this.getContract()
      .get_balances()
      .then(
        (result) =>
          [
            new BigNumber(result[0].toString()),
            new BigNumber(result[1].toString()),
          ] as Reserves
      );
  }
}
