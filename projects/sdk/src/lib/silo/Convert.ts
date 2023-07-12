import { TokenValue } from "@beanstalk/sdk-core";
import { ContractTransaction } from "ethers";
import { Token } from "src/classes/Token";
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
  urBean: Token;
  urBeanCrv3: Token;
  paths: Map<Token, Token>;

  constructor(sdk: BeanstalkSDK) {
    Convert.sdk = sdk;
    this.Bean = Convert.sdk.tokens.BEAN;
    this.BeanCrv3 = Convert.sdk.tokens.BEAN_CRV3_LP;
    this.urBean = Convert.sdk.tokens.UNRIPE_BEAN;
    this.urBeanCrv3 = Convert.sdk.tokens.UNRIPE_BEAN_CRV3;

    this.paths = new Map<Token, Token>();
    this.paths.set(this.Bean, this.BeanCrv3);
    this.paths.set(this.BeanCrv3, this.Bean);
    this.paths.set(this.urBean, this.urBeanCrv3);
    this.paths.set(this.urBeanCrv3, this.urBean);
  }

  async convert(fromToken: Token, toToken: Token, fromAmount: TokenValue, slippage: number = 0.1): Promise<ContractTransaction> {
    Convert.sdk.debug("silo.convert()", { fromToken, toToken, fromAmount });

    // Get convert estimate and details
    const { minAmountOut, conversion } = await this.convertEstimate(fromToken, toToken, fromAmount, slippage);

    // encoding
    const encoding = this.calculateEncoding(fromToken, toToken, fromAmount, minAmountOut);

    // format parameters
    const crates = conversion.crates.map((crate) => crate.stem.toString());
    const amounts = conversion.crates.map((crate) => crate.amount.toBlockchain());

    // execute
    return Convert.sdk.contracts.beanstalk.convert(encoding, crates, amounts);
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

    const conversion = this.calculateConvert(fromToken, toToken, fromAmount, balance.deposits, currentSeason);

    const amountOutBN = await Convert.sdk.contracts.beanstalk.getAmountOut(
      fromToken.address,
      toToken.address,
      conversion.amount.toBigNumber()
    );
    const amountOut = toToken.fromBlockchain(amountOutBN);
    const minAmountOut = amountOut.pct(100 - slippage);

    return { minAmountOut, conversion };
  }

  calculateConvert(fromToken: Token, toToken: Token, fromAmount: TokenValue, deposits: Deposit[], currentSeason: number): ConvertDetails {
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

  calculateEncoding(fromToken: Token, toToken: Token, amountIn: TokenValue, minAmountOut: TokenValue) {
    let encoding;

    if (fromToken.address === this.urBean.address && toToken.address === this.urBeanCrv3.address) {
      encoding = ConvertEncoder.unripeBeansToLP(
        amountIn.toBlockchain(), // amountBeans
        minAmountOut.toBlockchain() // minLP
      );
    } else if (fromToken.address === this.urBeanCrv3.address && toToken.address === this.urBean.address) {
      encoding = ConvertEncoder.unripeLPToBeans(
        amountIn.toBlockchain(), // amountLP
        minAmountOut.toBlockchain() // minBeans
      );
    } else if (fromToken.address === this.Bean.address && toToken.address === this.BeanCrv3.address) {
      encoding = ConvertEncoder.beansToCurveLP(
        amountIn.toBlockchain(), // amountBeans
        minAmountOut.toBlockchain(), // minLP
        toToken.address // output token address = pool address
      );
    } else if (fromToken.address === this.BeanCrv3.address && toToken.address === this.Bean.address) {
      encoding = ConvertEncoder.curveLPToBeans(
        amountIn.toBlockchain(), // amountLP
        minAmountOut.toBlockchain(), // minBeans
        fromToken.address // output token address = pool address
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

    if (!this.paths.get(fromToken)?.equals(toToken)) {
      throw new Error("Cannot convert between these tokens");
    }

    const deltaB = await Convert.sdk.bean.getDeltaB();

    if (deltaB.gte(TokenValue.ZERO)) {
      if (fromToken.equals(this.BeanCrv3) || fromToken.equals(this.urBeanCrv3)) {
        throw new Error("Cannot convert this token when deltaB is >= 0");
      }
    } else if (deltaB.lt(TokenValue.ZERO)) {
      if (fromToken.equals(this.Bean) || fromToken.equals(this.urBean)) {
        throw new Error("Cannot convert this token when deltaB is < 0");
      }
    }
  }
}
