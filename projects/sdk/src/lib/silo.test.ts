import { expect } from "chai";
import { DataSource } from "src/lib/BeanstalkSDK";
import { getTestUtils, setupConnection } from "../utils/TestUtils/provider";

import { BeanstalkSDK } from "./BeanstalkSDK";
import { Token } from "../classes/Token";
import { TokenSiloBalance } from "./silo/types";
import { calculateGrownStalk, parseWithdrawalCrates } from "./silo/utils";
import { BigNumber, ethers } from "ethers";
import { TokenValue } from "../classes/TokenValue";
import { BF_MULTISIG } from "src/utils/TestUtils/addresses";

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
const account2 = "0x0"; // zero addy

/// Setup
const { sdk, account, utils } = getTestUtils();

describe("Utilities", function () {
  it("Splits raw withdrawals into Withdrawn and Claimable", () => {
    const crate1 = { amount: ethers.BigNumber.from(1000 * 1e6) };
    const crate2 = { amount: ethers.BigNumber.from(2000 * 1e6) };
    const crate3 = { amount: ethers.BigNumber.from(3000 * 1e6) };
    const result = parseWithdrawalCrates(
      sdk.tokens.BEAN,
      {
        "6074": crate1, // => claimable
        "6075": crate2, // => withdrawn
        "6076": crate3 // => withdrawn
      },
      BigNumber.from(6074)
    );
    expect(result.claimable.amount).to.be.instanceOf(TokenValue);
    expect(result.withdrawn.amount).to.be.instanceOf(TokenValue);

    // expect(result.claimable.amount.toBlockchain()).to.be.eq(BigNumber.from(1000 * 1e6).toString());
    // expect(result.withdrawn.amount.toBlockchain()).to.be.eq(BigNumber.from((2000 + 3000) * 1e6).toString());
    expect(result.claimable.amount.eq(TokenValue.fromHuman(1000, 6))).to.be.true;
    expect(result.withdrawn.amount.eq(TokenValue.fromHuman(5000, 6))).to.be.true;

    expect(result.claimable.crates.length).to.be.eq(1);
    expect(result.withdrawn.crates.length).to.be.eq(2);
  });
});

describe("Silo Balance loading", () => {
  describe("getBalance", function () {
    it("returns an empty object", async () => {
      const balance = await sdk.silo.getBalance(sdk.tokens.BEAN, account2, { source: DataSource.SUBGRAPH });
      expect(balance.deposited.amount.eq(0)).to.be.true;
      expect(balance.withdrawn.amount.eq(0)).to.be.true;
      expect(balance.claimable.amount.eq(0)).to.be.true;
    });
    it("loads an account with deposits (fuzzy)", async () => {
      const balance = await sdk.silo.getBalance(sdk.tokens.BEAN, BF_MULTISIG, { source: DataSource.SUBGRAPH });
      expect(balance.deposited.amount.gt(10_000)).to.be.true; // FIXME
      expect(balance.withdrawn.amount.eq(0)).to.be.true;
      expect(balance.claimable.amount.eq(0)).to.be.true;
    });

    // FIX: discrepancy in graph results
    it.skip("source: ledger === subgraph", async function () {
      const [ledger, subgraph]: TokenSiloBalance[] = await Promise.all([
        timer(sdk.silo.getBalance(sdk.tokens.BEAN, account1, { source: DataSource.LEDGER }), "Ledger result time"),
        timer(sdk.silo.getBalance(sdk.tokens.BEAN, account1, { source: DataSource.SUBGRAPH }), "Subgraph result time")
      ]);

      // We cannot compare .deposited.bdv as the ledger results come from prod
      // and the bdv value there can differ from l
      expect(ledger.deposited.amount).to.deep.eq(subgraph.deposited.amount);
      expect(ledger.deposited.crates).to.deep.eq(subgraph.deposited.crates);
    });
  });

  describe("getBalances", function () {
    let ledger: Map<Token, TokenSiloBalance>;
    let subgraph: Map<Token, TokenSiloBalance>;

    // Pulled an account with some large positions for testing
    // @todo pick several accounts and loop
    beforeAll(async () => {
      [ledger, subgraph] = await Promise.all([
        timer(sdk.silo.getBalances(account1, { source: DataSource.LEDGER }), "Ledger result time"),
        timer(sdk.silo.getBalances(account1, { source: DataSource.SUBGRAPH }), "Subgraph result time")
      ]);
    });

    // FIX: Discrepancy in graph results.
    it.skip("source: ledger === subgraph", async function () {
      for (let [token, value] of ledger.entries()) {
        expect(subgraph.has(token)).to.be.true;
        try {
          // received              expected
          expect(value.deposited.amount).to.deep.eq(subgraph.get(token)?.deposited.amount);
          expect(value.deposited.crates).to.deep.eq(subgraph.get(token)?.deposited.crates);
          expect(value.claimable.amount).to.deep.eq(subgraph.get(token)?.claimable.amount);
          expect(value.claimable.crates).to.deep.eq(subgraph.get(token)?.deposited.crates);
          expect(value.withdrawn.amount).to.deep.eq(subgraph.get(token)?.withdrawn.amount);
          expect(value.withdrawn.crates).to.deep.eq(subgraph.get(token)?.deposited.crates);
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
      balance.deposited.crates.forEach((crate) => {
        expect(crate.baseStalk.add(crate.grownStalk).eq(crate.stalk)).to.be.true;
      });
    });

    it("correctly instantiates baseStalk using getStalk()", () => {
      // Note that this does not verify that `getStalk()` itself is correct;
      // this is the responsibility of Tokens.test.
      balance.deposited.crates.forEach((crate) => {
        expect(crate.baseStalk.eq(sdk.tokens.BEAN.getStalk(crate.bdv))).to.be.true;
      });
    });
  });

  describe("balanceOfStalk", () => {
    it("Returns a TokenValue with STALK decimals", async () => {
      const result = await sdk.silo.getStalk(BF_MULTISIG);
      expect(result).to.be.instanceOf(TokenValue);
      expect(result.decimals).to.eq(10);
    });
    it.todo("Adds grown stalk when requested");
  });

  describe("balanceOfSeeds", () => {
    it("Returns a TokenValue with SEEDS decimals", async () => {
      const result = await sdk.silo.getSeeds(BF_MULTISIG);
      expect(result).to.be.instanceOf(TokenValue);
      expect(result.decimals).to.eq(6);
    });
  });

  describe("Grown Stalk calculations", () => {
    const seeds = sdk.tokens.SEEDS.amount(1);
    it("returns zero when deltaSeasons = 0", () => {
      expect(calculateGrownStalk(6074, 6074, seeds).toHuman()).to.eq("0");
    });
    it("throws if currentSeason < depositSeason", () => {
      expect(() => calculateGrownStalk(5000, 6074, seeds).toHuman()).to.throw();
    });
    it("works when deltaSeasons > 0", () => {
      // 1 seed grows 1/10_000 STALK per Season
      expect(calculateGrownStalk(6075, 6074, seeds).toHuman()).to.eq((1 / 10_000).toString());
      expect(calculateGrownStalk(6075, 6074, seeds.mul(10)).toHuman()).to.eq((10 / 10_000).toString());
      expect(calculateGrownStalk(6076, 6074, seeds).toHuman()).to.eq((2 / 10_000).toString());
      expect(calculateGrownStalk(6076, 6074, seeds.mul(10)).toHuman()).to.eq((20 / 10_000).toString());
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
    expect(allowance.toString()).to.be.eq(amount);
  });
});

///
// describe('Contract aliases', function () {
//   it('calls aliased $ methods properly', async () => {
//     expect(await sdk.silo.$lastUpdate(account1)).to.be.greaterThan(0);
//   });
// })
