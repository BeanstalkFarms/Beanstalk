import { TokenValue } from "@beanstalk/sdk-core";
import { ContractTransaction, PayableOverrides } from "ethers";
import { ERC20Token, Token } from "src/classes/Token";
import { BeanstalkSDK } from "../BeanstalkSDK";
import { ConvertEncoder } from "./ConvertEncoder";
import { Deposit } from "./types";
import { pickCrates, sortCratesByBDVRatio, sortCratesByStem } from "./utils";

export type ConvertDetails = {
  amount: TokenValue;
  bdv: TokenValue;
  stalk: TokenValue;
  seeds: TokenValue;
  actions: [];
  crates: Deposit[];
};

export class Convert {
  static sdk: BeanstalkSDK;
  Bean: Token;
  BeanCrv3: Token;
  BeanEth: Token;
  beanWstETH: Token;
  urBean: Token;
  urBeanWstETH: Token;
  paths: Map<Token, ERC20Token[]>;

  constructor(sdk: BeanstalkSDK) {
    Convert.sdk = sdk;
    this.Bean = Convert.sdk.tokens.BEAN;
    this.BeanCrv3 = Convert.sdk.tokens.BEAN_CRV3_LP;
    this.BeanEth = Convert.sdk.tokens.BEAN_ETH_WELL_LP;
    this.beanWstETH = Convert.sdk.tokens.BEAN_WSTETH_WELL_LP;
    this.urBean = Convert.sdk.tokens.UNRIPE_BEAN;
    this.urBeanWstETH = Convert.sdk.tokens.UNRIPE_BEAN_WSTETH;

    // TODO: Update me for lambda to lambda converts
    this.paths = new Map<Token, ERC20Token[]>();

    // BEAN<>LP
    this.paths.set(Convert.sdk.tokens.BEAN, [
      // Convert.sdk.tokens.BEAN_CRV3_LP, // Deprecated.
      Convert.sdk.tokens.BEAN_WSTETH_WELL_LP,
      Convert.sdk.tokens.BEAN_ETH_WELL_LP
    ]);
    this.paths.set(Convert.sdk.tokens.BEAN_CRV3_LP, [Convert.sdk.tokens.BEAN]);
    this.paths.set(Convert.sdk.tokens.BEAN_ETH_WELL_LP, [Convert.sdk.tokens.BEAN]);
    this.paths.set(Convert.sdk.tokens.BEAN_WSTETH_WELL_LP, [Convert.sdk.tokens.BEAN]);

    // URBEAN<>(URBEAN_WSTETH_LP & RIPE BEAN)
    this.paths.set(Convert.sdk.tokens.UNRIPE_BEAN, [
      Convert.sdk.tokens.UNRIPE_BEAN_WSTETH,
      Convert.sdk.tokens.BEAN
    ]);
    // URBEAN_WSTETH_LP -> (URBEAN & RIPE BEAN_WSTETH LP)
    this.paths.set(Convert.sdk.tokens.UNRIPE_BEAN_WSTETH, [
      Convert.sdk.tokens.UNRIPE_BEAN,
      Convert.sdk.tokens.BEAN_WSTETH_WELL_LP
    ]);
  }

  async convert(
    fromToken: Token,
    toToken: Token,
    fromAmount: TokenValue,
    slippage: number = 0.1,
    overrides: PayableOverrides = {}
  ): Promise<ContractTransaction> {
    Convert.sdk.debug("silo.convert()", { fromToken, toToken, fromAmount });

    // Get convert estimate and details
    const { minAmountOut, conversion } = await this.convertEstimate(
      fromToken,
      toToken,
      fromAmount,
      slippage
    );

    // encoding
    const encoding = this.calculateEncoding(fromToken, toToken, fromAmount, minAmountOut);

    // format parameters
    const crates = conversion.crates.map((crate) => crate.stem.toString());
    const amounts = conversion.crates.map((crate) => crate.amount.toBlockchain());

    // execute
    return Convert.sdk.contracts.beanstalk.convert(encoding, crates, amounts, overrides);
  }

  async convertEstimate(
    fromToken: Token,
    toToken: Token,
    fromAmount: TokenValue,
    slippage: number = 0.1
  ): Promise<{ minAmountOut: TokenValue; conversion: ConvertDetails }> {
    Convert.sdk.debug("silo.convertEstimate()", { fromToken, toToken, fromAmount });
    await this.validateTokens(fromToken, toToken);

    const balance = await Convert.sdk.silo.getBalance(fromToken);
    Convert.sdk.debug("silo.convertEstimate(): deposited balance", { balance });

    if (balance.amount.lt(fromAmount)) {
      throw new Error("Insufficient balance");
    }

    const currentSeason = await Convert.sdk.sun.getSeason();

    const conversion = this.calculateConvert(
      fromToken,
      toToken,
      fromAmount,
      balance.deposits,
      currentSeason
    );

    const amountOutBN = await Convert.sdk.contracts.beanstalk.getAmountOut(
      fromToken.address,
      toToken.address,
      conversion.amount.toBigNumber()
    );
    const amountOut = toToken.fromBlockchain(amountOutBN);
    const minAmountOut = amountOut.pct(100 - slippage);

    return { minAmountOut, conversion };
  }

  calculateConvert(
    fromToken: Token,
    toToken: Token,
    fromAmount: TokenValue,
    deposits: Deposit[],
    currentSeason: number
  ): ConvertDetails {
    if (deposits.length === 0) throw new Error("No crates to withdraw from");
    const sortedCrates = toToken.isLP
      ? /// BEAN -> LP: oldest crates are best. Grown stalk is equivalent
        /// on both sides of the convert, but having more seeds in older crates
        /// allows you to accrue stalk faster after convert.
        /// Note that during this convert, BDV is approx. equal after the convert.
        sortCratesByStem(deposits, "asc")
      : /// LP -> BEAN: use the crates with the lowest [BDV/Amount] ratio first.
        /// Since LP deposits can have varying BDV, the best option for the Farmer
        /// is to increase the BDV of their existing lowest-BDV crates.
        sortCratesByBDVRatio(deposits, "asc");

    const pickedCrates = pickCrates(sortedCrates, fromAmount, fromToken, currentSeason);

    return {
      amount: pickedCrates.totalAmount,
      bdv: pickedCrates.totalBDV,
      stalk: pickedCrates.totalStalk,
      seeds: fromToken.getSeeds(pickedCrates.totalBDV),
      actions: [],
      crates: pickedCrates.crates
    };
  }

  // TODO: use this.paths to determine encoding
  calculateEncoding(
    fromToken: Token,
    toToken: Token,
    amountIn: TokenValue,
    minAmountOut: TokenValue
  ) {
    let encoding;

    const tks = Convert.sdk.tokens;

    const whitelistedWellLPs = new Set([
      Convert.sdk.tokens.BEAN_ETH_WELL_LP.address.toLowerCase(),
      Convert.sdk.tokens.BEAN_WSTETH_WELL_LP.address.toLowerCase()
    ]);
    const isFromWlLP = Boolean(whitelistedWellLPs.has(fromToken.address.toLowerCase()));
    const isToWlLP = Boolean(whitelistedWellLPs.has(toToken.address.toLowerCase()));

    if (
      fromToken.address === tks.UNRIPE_BEAN.address &&
      toToken.address === tks.UNRIPE_BEAN_WSTETH.address
    ) {
      encoding = ConvertEncoder.unripeBeansToLP(
        amountIn.toBlockchain(), // amountBeans
        minAmountOut.toBlockchain() // minLP
      );
    } else if (
      fromToken.address === tks.UNRIPE_BEAN_WSTETH.address &&
      toToken.address === tks.UNRIPE_BEAN.address
    ) {
      encoding = ConvertEncoder.unripeLPToBeans(
        amountIn.toBlockchain(), // amountLP
        minAmountOut.toBlockchain() // minBeans
      );
    } else if (
      fromToken.address === tks.BEAN.address &&
      toToken.address === tks.BEAN_CRV3_LP.address
    ) {
      encoding = ConvertEncoder.beansToCurveLP(
        amountIn.toBlockchain(), // amountBeans
        minAmountOut.toBlockchain(), // minLP
        toToken.address // output token address = pool address
      );
    } else if (
      fromToken.address === tks.BEAN_CRV3_LP.address &&
      toToken.address === tks.BEAN.address
    ) {
      encoding = ConvertEncoder.curveLPToBeans(
        amountIn.toBlockchain(), // amountLP
        minAmountOut.toBlockchain(), // minBeans
        fromToken.address // output token address = pool address
      );
    } else if (fromToken.address === tks.BEAN.address && isToWlLP) {
      encoding = ConvertEncoder.beansToWellLP(
        amountIn.toBlockchain(), // amountBeans
        minAmountOut.toBlockchain(), // minLP
        toToken.address // output token address = pool address
      );
    } else if (isFromWlLP && toToken.address === tks.BEAN.address) {
      encoding = ConvertEncoder.wellLPToBeans(
        amountIn.toBlockchain(), // amountLP
        minAmountOut.toBlockchain(), // minBeans
        fromToken.address // output token address = pool address
      );
    } else if (
      fromToken.address === tks.UNRIPE_BEAN.address &&
      toToken.address === tks.BEAN.address
    ) {
      encoding = ConvertEncoder.unripeToRipe(
        amountIn.toBlockchain(), // unRipe Amount
        fromToken.address // unRipe Token
      );
    } else if (
      fromToken.address === tks.UNRIPE_BEAN_WSTETH.address &&
      toToken.address === tks.BEAN_WSTETH_WELL_LP.address
    ) {
      encoding = ConvertEncoder.unripeToRipe(
        amountIn.toBlockchain(), // unRipe Amount
        fromToken.address // unRipe Token
      );
    } else {
      throw new Error("SDK: Unknown conversion pathway");
    }

    return encoding;
  }

  async validateTokens(fromToken: Token, toToken: Token) {
    if (!Convert.sdk.tokens.isWhitelisted(fromToken)) {
      throw new Error("fromToken is not whitelisted");
    }

    if (!Convert.sdk.tokens.isWhitelisted(toToken)) {
      throw new Error("toToken is not whitelisted");
    }

    if (fromToken.equals(toToken)) {
      throw new Error("Cannot convert between the same token");
    }

    const path = this.getConversionPaths(fromToken as ERC20Token);
    const found = path.find((tk) => tk.address.toLowerCase() === toToken.address.toLowerCase());

    if (!found) {
      throw new Error("No conversion path found");
    }
  }

  getConversionPaths(fromToken: ERC20Token): ERC20Token[] {
    const token = Convert.sdk.tokens.findByAddress(fromToken.address);
    return token ? this.paths.get(token) || [] : [];
  }

}
