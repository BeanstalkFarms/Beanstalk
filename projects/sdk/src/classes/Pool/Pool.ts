import { Beanstalk } from "src/constants/generated";
import { BeanstalkSDK } from "../..";
import { ERC20Token } from "../Token/ERC20Token";
import { TokenValue } from "../TokenValue";

export type Reserves = [TokenValue, TokenValue];

/**
 * A Pool is an AMM liquidity pool between at least 2 tokens.
 */
export default abstract class Pool {
  /**
   * Reference to the Beanstalk SDK object
   */
  static sdk: BeanstalkSDK;
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
    sdk: BeanstalkSDK,
    // chainId: SupportedChainId,
    address: string,
    // dex: Dex,
    lpToken: ERC20Token,
    tokens: ERC20Token[],
    metadata: {
      name: string;
      symbol: string;
      logo: string;
      color: string; // ['#ed9f9c', '#549e3f', '#6dcb60', '#3c76af', '#aecde1'];
    }
  ) {
    Pool.sdk = sdk;
    this.chainId = sdk.chainId;
    this.address = address.toLowerCase();
    this.lpToken = lpToken;
    this.tokens = tokens;
    this.underlying = tokens.reduce<ERC20Token[]>((prev, token) => {
      // CRV3 pools can access the underlying stables [DAI, USDC, USDT].
      if (token.equals(sdk.tokens.CRV3)) {
        // FIXME: hardcoded indices for 3CRV
        prev.push(...[sdk.tokens.DAI, sdk.tokens.USDC, sdk.tokens.USDT]);
      } else {
        prev.push(token);
      }
      return prev;
    }, []);

    this.name = metadata.name;
    this.symbol = metadata.symbol;
    this.logo = metadata.logo;
    this.color = metadata.color;
  }

  /**
   * Returns whether this pool is functionally equivalent to the other pool
   * @param other the other pool
   */
  public equals(other: Pool): boolean {
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
  static tokenForLP = (amount: TokenValue, reserve: TokenValue, totalLP: TokenValue) => amount.mul(reserve).div(totalLP);

  /**
   * Used to calcuate the # of reserve tokens owned by a farmer for 2 assets in a pool (e.g. Beans + Eth)
   * Just calls tokenForLP twice.
   */
  static poolForLP = (amount: TokenValue, reserve1: TokenValue, reserve2: TokenValue, totalLP: TokenValue) => {
    if (amount.lte(0) || reserve1.lte(0) || reserve2.lte(0) || totalLP.lte(0)) {
      return [TokenValue.ZERO, TokenValue.ZERO];
    }
    return [Pool.tokenForLP(amount, reserve1, totalLP), Pool.tokenForLP(amount, reserve2, totalLP)];
  };

  /**
   * The opposite of tokenForLP. If a farmer owns/deposits X of reserve asset -> how many LP tokens do they 1 own/get.
   *
   * @param amount - the amount of the reserve asset the farmer has
   * @param reserve - the total amount of the reserve asset
   * @param totalLP - the total amount of the LP token
   * @returns the amount of lp tokens that amount corresponds to.
   */
  static lpForToken = (amount: TokenValue, reserve: TokenValue, totalLP: TokenValue) => amount.mul(totalLP).div(reserve);

  /**
   * The opposite of poolForLP - used to calculate how many LP tokens a farmer gets if they deposit both reserve assets in a 2 asset pool.
   * e.g. if a farmer deposits amount1 of Beans and amount2 of Eth into an LP pool with reserve1 Beans, reserve2 Eth and totalLP LP tokens, it returns how many LP tokens the farmer gets.
   */
  static lpForPool = (amount1: TokenValue, reserve1: TokenValue, amount2: TokenValue, reserve2: TokenValue, totalLP: TokenValue) =>
    TokenValue.min(Pool.lpForToken(amount1, reserve1, totalLP), Pool.lpForToken(amount2, reserve2, totalLP));

  /**
   *
   */
  static getToAmount = (amountIn: TokenValue, reserveIn: TokenValue, reserveOut: TokenValue) => {
    if (amountIn.lte(0) || reserveIn.lte(0) || reserveOut.lte(0)) {
      return TokenValue.ZERO;
    }
    const amountInWithFee = amountIn.mul(997);
    const numerator = amountInWithFee.mul(reserveOut);
    const denominator = reserveIn.mul(1000).add(amountInWithFee);
    return numerator.div(denominator);
  };

  abstract getReserves(): Promise<Reserves>;
}
