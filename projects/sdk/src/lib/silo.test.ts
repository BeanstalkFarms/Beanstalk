import { expect as chaiExpect } from "chai";
import { DataSource } from "src/lib/BeanstalkSDK";
import { getTestUtils } from "../utils/TestUtils/provider";

import { Token } from "../classes/Token";
import { TokenSiloBalance } from "./silo/types";
import { TokenValue } from "@beanstalk/sdk-core";
import { BF_MULTISIG } from "src/utils/TestUtils/addresses";
import { Silo } from "src/lib/silo";

/// Utilities
const RUN_TIMER = false;
const timer = async (fn: Promise<any>, label: string) => {
  if (RUN_TIMER) console.time(label);
  const r = await fn;
  if (RUN_TIMER) console.timeEnd(label);
  return r;
};

/// Constants
// const account1 = "0x9a00beffa3fc064104b71f6b7ea93babdc44d9da"; // whale
const account2 = "0x0000000000000000000000000000000000000000"; // zero addy

/// Setup
const { sdk, account, utils } = getTestUtils();

/// Tests
beforeAll(async () => {
  // await utils.resetFork();
  const amount = sdk.tokens.BEAN.amount("100000");
  await utils.setBalance(sdk.tokens.BEAN, account, amount);
  await sdk.tokens.BEAN.approveBeanstalk(amount);

  await sdk.silo.deposit(sdk.tokens.BEAN, sdk.tokens.BEAN, amount, 0.1, account);
});
describe("Silo Balance loading", () => {
  describe("getBalance", function () {
    it("returns an empty object", async () => {
      const balance = await sdk.silo.getBalance(sdk.tokens.BEAN, account2, { source: DataSource.LEDGER });
      chaiExpect(balance.amount.eq(0)).to.be.true;
    });
    it("loads an account with deposits (fuzzy)", async () => {
      const balance = await sdk.silo.getBalance(sdk.tokens.BEAN, account, { source: DataSource.LEDGER });
      console.log(balance);
      chaiExpect(balance.amount.toHuman()).to.eq("100000");
    });

    // FIX: discrepancy in graph results
    it.skip("source: ledger === subgraph", async function () {
      const [ledger, subgraph]: TokenSiloBalance[] = await Promise.all([
        timer(sdk.silo.getBalance(sdk.tokens.BEAN, account, { source: DataSource.LEDGER }), "Ledger result time"),
        timer(sdk.silo.getBalance(sdk.tokens.BEAN, account, { source: DataSource.SUBGRAPH }), "Subgraph result time")
      ]);

      // We cannot compare .deposited.bdv as the ledger results come from prod
      // and the bdv value there can differ from l
      chaiExpect(ledger.amount).to.deep.eq(subgraph.amount);
      chaiExpect(ledger.deposits).to.deep.eq(subgraph.deposits);
    });
  });

  describe("getBalances", function () {
    let ledger: Map<Token, TokenSiloBalance>;
    let subgraph: Map<Token, TokenSiloBalance>;

    // Pulled an account with some large positions for testing
    // @todo pick several accounts and loop
    beforeAll(async () => {
      [ledger, subgraph] = await Promise.all([
        timer(sdk.silo.getBalances(account, { source: DataSource.LEDGER }), "Ledger result time"),
        timer(sdk.silo.getBalances(account, { source: DataSource.SUBGRAPH }), "Subgraph result time")
      ]);
    });

    // FIX: Discrepancy in graph results.
    it.skip("source: ledger === subgraph", async function () {
      for (let [token, value] of ledger.entries()) {
        chaiExpect(subgraph.has(token)).to.be.true;
        try {
          // received                         expected
          chaiExpect(value.amount).to.deep.eq(subgraph.get(token)?.amount);
          chaiExpect(value.deposits).to.deep.eq(subgraph.get(token)?.deposits);
        } catch (e) {
          console.log(`Token: ${token.name}`);
          console.log(`Expected (subgraph):`, subgraph.get(token));
          console.log(`Received (ledger):`, value);
          throw e;
        }
      }
    });
  });

  describe("stalk calculations for each crate", () => {
    let balance: TokenSiloBalance;
    beforeAll(async () => {
      balance = await sdk.silo.getBalance(sdk.tokens.BEAN, BF_MULTISIG, { source: DataSource.SUBGRAPH });
    });

    it("stalk = baseStalk + grownStalk", () => {
      // Note that this does not verify that the stalk values themselves
      // are as expected, just that their additive properties hold.
      balance.deposits.forEach((deposit) => {
        chaiExpect(deposit.stalk.base.add(deposit.stalk.grown).eq(deposit.stalk.total)).to.be.true;
      });
    });

    it("correctly instantiates baseStalk using getStalk()", () => {
      // Note that this does not verify that `getStalk()` itself is correct;
      // this is the responsibility of Tokens.test.
      balance.deposits.forEach((deposit) => {
        chaiExpect(deposit.stalk.base.eq(sdk.tokens.BEAN.getStalk(deposit.bdv))).to.be.true;
      });
    });
  });

  describe("balanceOfStalk", () => {
    it("Returns a TokenValue with STALK decimals", async () => {
      const result = await sdk.silo.getStalk(BF_MULTISIG);
      chaiExpect(result).to.be.instanceOf(TokenValue);
      chaiExpect(result.decimals).to.eq(10);
    });
    it.todo("Adds grown stalk when requested");
  });

  describe("balanceOfSeeds", () => {
    it("Returns a TokenValue with SEEDS decimals", async () => {
      const result = await sdk.silo.getSeeds(BF_MULTISIG);
      chaiExpect(result).to.be.instanceOf(TokenValue);
      chaiExpect(result.decimals).to.eq(6);
    });
  });
});

describe("Deposit Permits", function () {
  it("permits", async () => {
    const owner = account;
    const spender = sdk.contracts.root.address;
    const token = sdk.tokens.BEAN.address;
    const amount = sdk.tokens.BEAN.amount("100").toString();

    // const startAllowance = await sdk.contracts.beanstalk.depositAllowance(owner, spender, token);
    // const depositPermitNonces = await sdk.contracts.beanstalk.depositPermitNonces(owner);
    // console.log("Initial allowance: ", startAllowance.toString())
    // console.log("Nonce: ", depositPermitNonces.toString())

    // Get permit
    const permitData = await sdk.silo.permitDepositToken(
      owner,
      spender,
      token,
      amount,
      undefined, // nonce
      undefined // deadline
    );

    const sig = await sdk.permit.sign(owner, permitData);

    // console.log("Signed permit", permitData, sig)

    // Send permit
    await sdk.contracts.beanstalk
      .permitDeposit(
        owner,
        spender,
        permitData.message.token,
        permitData.message.value,
        permitData.message.deadline,
        sig.split.v,
        sig.split.r,
        sig.split.s
      )
      .then((txn) => txn.wait());

    // Verify
    const allowance = await sdk.contracts.beanstalk.depositAllowance(owner, spender, token);
    chaiExpect(allowance.toString()).to.be.eq(amount);
  });
});

describe("Silo mowMultiple", () => {
  const whitelistedToken = sdk.tokens.BEAN;
  const whitelistedToken2 = sdk.tokens.BEAN_CRV3_LP;
  const nonWhitelistedToken = sdk.tokens.DAI;
  const whitelistedTokenAddresses = Array.from(sdk.tokens.siloWhitelist.values()).map((token) => token.address);

  beforeEach(() => {
    // We mock the methods used in mowMultiple
    // jest.spyOn(Silo.sdk, 'getAccount').mockResolvedValue(account);
    // jest.spyOn(Silo.sdk.tokens, 'isWhitelisted').mockImplementation((token) => token === whitelistedToken);
    // jest.spyOn(Silo.sdk.tokens, 'siloWhitelist').mockReturnValue(new Set([whitelistedToken]));
    // jest.spyOn(Silo.sdk.contracts.beanstalk, "mowMultiple").mockImplementation(() => "mockedTransaction" as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("throws when no tokens provided", async () => {
    expect(sdk.silo.mowMultiple(account, [])).rejects.toThrow("No tokens provided");
  });

  it("throws when non-whitelisted token provided", async () => {
    await expect(sdk.silo.mowMultiple(account, [nonWhitelistedToken])).rejects.toThrow(`${nonWhitelistedToken.symbol} is not whitelisted`);
  });

  it.skip("warns when single token provided", async () => {
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    await sdk.silo.mowMultiple(account, [whitelistedToken]);
    expect(consoleSpy).toHaveBeenCalledWith("Optimization: use `mow()` instead of `mowMultiple()` for a single token");
    consoleSpy.mockRestore();
  });

  it.skip("mows multiple tokens", async () => {
    const transaction = await sdk.silo.mowMultiple(account, [whitelistedToken, whitelistedToken2]);
    expect(transaction).toBe("mockedTransaction");
    expect(Silo.sdk.contracts.beanstalk.mowMultiple).toHaveBeenCalledWith(account, [whitelistedToken.address, whitelistedToken2.address]);
  });

  it.skip("mows all whitelisted tokens when no specific tokens provided", async () => {
    const transaction = await sdk.silo.mowMultiple(account);
    expect(transaction).toBe("mockedTransaction");
    expect(Silo.sdk.contracts.beanstalk.mowMultiple).toHaveBeenCalledWith(account, whitelistedTokenAddresses);
  });

  it.todo("throws when there are duplicate tokens provided");
});
