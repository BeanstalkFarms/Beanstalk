import { ethers } from "ethers";
import { setupConnection } from "../utils/TestUtils/provider";
import { BeanstalkSDK } from "./BeanstalkSDK";

/// Utilities
const RUN_TIMER = false;
const timer = async (fn: Promise<any>, label: string) => {
  if (RUN_TIMER) console.time(label);
  const r = await fn;
  if (RUN_TIMER) console.timeEnd(label);
  return r;
};

/// Constants
const account1 = "0x9a00beffa3fc064104b71f6b7ea93babdc44d9da"; // whale

/// Setup
let sdk: BeanstalkSDK;
let account: string;

beforeAll(async () => {
  const { signer, provider, account: _account } = await setupConnection();
  sdk = new BeanstalkSDK({
    provider,
    signer,
    subgraphUrl: "https://graph.node.bean.money/subgraphs/name/beanstalk-testing"
  });
  account = _account;
});

describe("Token Library", function () {
  describe("returns correct STALK and SEED amounts for whitelisted tokens", () => {
    it("works: BEAN", () => {
      // No BDV provided, assume 1 BDV
      expect(sdk.tokens.BEAN.getStalk().toHuman()).toBe("1");
      expect(sdk.tokens.BEAN.getStalk().toBlockchain()).toBe((1_0000000000).toString());
      expect(sdk.tokens.BEAN.getSeeds().toHuman()).toBe("2");
      expect(sdk.tokens.BEAN.getSeeds().toBlockchain()).toBe((2_000000).toString());

      // BDV < 1
      expect(sdk.tokens.BEAN.getStalk(sdk.tokens.BEAN.amount(0.5)).toHuman()).toBe("0.5");
      expect(sdk.tokens.BEAN.getStalk(sdk.tokens.BEAN.amount(0.5)).toBlockchain()).toBe((5_000000000).toString());
      expect(sdk.tokens.BEAN.getSeeds(sdk.tokens.BEAN.amount(0.5)).toHuman()).toBe("1");
      expect(sdk.tokens.BEAN.getSeeds(sdk.tokens.BEAN.amount(0.5)).toBlockchain()).toBe((1_000000).toString());

      // BDV > 1
      // 100 BEAN (1E6) => 100 STALK (1E10)       decimal notation
      // 100_000000 BEAN => 100_0000000000 STALK  integer notation
      // therefore: 100E10 / 100E6 = 10_000 = 1E4 STALK per BEAN
      expect(sdk.tokens.BEAN.getStalk(sdk.tokens.BEAN.amount(100)).toHuman()).toBe("100");
      expect(sdk.tokens.BEAN.getStalk(sdk.tokens.BEAN.amount(100)).toBlockchain()).toBe((100_0000000000).toString());
      expect(sdk.tokens.BEAN.getSeeds(sdk.tokens.BEAN.amount(100)).toHuman()).toBe("200");
      expect(sdk.tokens.BEAN.getSeeds(sdk.tokens.BEAN.amount(100)).toBlockchain()).toBe((200_000000).toString());
    });
  });
});


describe("Utilities", function () {
  it("creates a correct TokenBalance struct", () => {
    // @ts-ignore testing private method
    const balance = sdk.tokens.makeTokenBalance(sdk.tokens.BEAN, {
      internalBalance: ethers.BigNumber.from(1000_000000),
      externalBalance: ethers.BigNumber.from(5000_000000),
      totalBalance: ethers.BigNumber.from(6000_000000)
    });
    expect(balance.internal.eq(sdk.tokens.BEAN.amount(1000))).toBe(true);
    expect(balance.external.eq(sdk.tokens.BEAN.amount(5000))).toBe(true);
    expect(balance.total.eq(sdk.tokens.BEAN.amount(6000))).toBe(true);
    expect(balance.internal.toHuman()).toBe("1000");
    expect(balance.external.toHuman()).toBe("5000");
    expect(balance.total.toHuman()).toBe("6000");
  });
});

describe("Function: getBalance", function () {
  it("returns a TokenBalance struct when the token is ETH", async () => {
    const balance = await sdk.tokens.getBalance(sdk.tokens.ETH, sdk.tokens.WETH.address);
    expect(balance.internal.eq(0)).toBe(true);
    expect(balance.external.gt(0)).toBe(true);
    expect(balance.external.toBlockchain()).toBe(balance.total.toBlockchain());
  });
});

describe("Function: getBalances", function () {
  // it('throws without account or signer', async () => {
  //   await expect(sdk.tokens.getBalances()).rejects.toThrow();
  // });
  it("throws if a provided address is not a valid address", async () => {
    await expect(sdk.tokens.getBalances(account1, ["foo"])).rejects.toThrow();
  });
  it("throws if a provided address is not a token", async () => {
    // beanstalk.getAllBalances will revert if any of the requested tokens aren't actually tokens
    await expect(sdk.tokens.getBalances(account1, [account1])).rejects.toThrow("call revert exception");
  });
  it("accepts string for _tokens", async () => {
    const BEAN = sdk.tokens.BEAN.address;
    const result = await sdk.tokens.getBalances(account1, [BEAN]);
    expect(result.has(sdk.tokens.BEAN)).toBe(true);
  });
  it("accepts Token instance for _tokens", async () => {
    const result = await sdk.tokens.getBalances(account1, [sdk.tokens.BEAN]);
    expect(result.has(sdk.tokens.BEAN)).toBe(true);
  });
  it("returns a balance struct for each provided token", async () => {
    const result = await sdk.tokens.getBalances(account1, [sdk.tokens.BEAN, sdk.tokens.DAI]);
    expect(result.has(sdk.tokens.BEAN)).toBe(true);
    expect(result.has(sdk.tokens.DAI)).toBe(true);
    expect(result.has(sdk.tokens.BEAN_CRV3_LP)).toBe(false);
  });
});

describe("Permits", function () {
  it("submits an ERC-2636 permit directly", async () => {
    const token = sdk.tokens.BEAN;
    const owner = account;
    const spender = sdk.contracts.beanstalk.address;
    const amount = token.amount("1000");
    const contract = token.getContract();

    // Sign permit
    const permitData = await sdk.permit.sign(account, sdk.tokens.permitERC2612(owner, spender, token, amount.toBlockchain()));

    // Execute permit
    await contract
      .permit(
        account,
        permitData.typedData.message.spender,
        permitData.typedData.message.value,
        permitData.typedData.message.deadline,
        permitData.split.v,
        permitData.split.r,
        permitData.split.s
      )
      .then((r) => r.wait());

    // Verify allowance is set correctly
    const newAllowance = (await contract.allowance(owner, spender)).toString();
    expect(newAllowance).toEqual(amount.toBlockchain());
  });
});
