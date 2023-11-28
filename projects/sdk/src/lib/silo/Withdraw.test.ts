import { Source } from "graphql";
import { sum } from "lodash";
import { Token } from "src/classes/Token";
import { TokenValue } from "src/TokenValue";
import { getTestUtils } from "src/utils/TestUtils/provider";
import { Withdraw } from "./Withdraw";

const { sdk, account, utils } = getTestUtils();

jest.setTimeout(30000);

describe("Silo Withdrawl", function () {
  const withdraw = new Withdraw(sdk);
  const token = sdk.tokens.BEAN;

  beforeAll(async () => {
    await utils.resetFork();

    // make a deposit
    await token.approveBeanstalk(TokenValue.MAX_UINT256);
    await utils.setBEANBalance(account, token.amount(1000));
    const deposit = sdk.silo.buildDeposit(token, account);
    deposit.setInputToken(token);
    const tx1 = await deposit.execute(token.amount(500), 0.1);
    await tx1.wait();
  });

  it("Validate starting state", async () => {
    const balance = await sdk.silo.getBalance(token);
    expect(balance.deposits.length).toBe(1);
    expect(balance.amount.eq(token.amount(500))).toBe(true);
  });

  it("Successfully withdraws", async () => {
    const tx = await withdraw.withdraw(token, token.amount(150));
    await tx.wait();
    const balance = await sdk.silo.getBalance(token);

    expect(balance.deposits.length).toBe(1);
    expect(balance.amount.eq(token.amount(350))).toBe(true);
  });

  it("Fails when withdrawing too much", async () => {
    const t = async () => {
      const tx = await withdraw.withdraw(token, token.amount(3000));
    };
    expect(t).rejects.toThrow("Insufficient balance");
  });

  it.only("Calculates crates correctly", async () => {
    const currentSeason = 10_000;
    const c1 = utils.mockDepositCrate(token, 900, "200", currentSeason);
    const c2 = utils.mockDepositCrate(token, 800, "500", currentSeason);
    const c3 = utils.mockDepositCrate(token, 700, "1000", currentSeason);

    // random order
    const crates = [c3, c1, c2];

    const calc1 = withdraw.calculateWithdraw(token, token.amount(1000), crates, currentSeason);
    expect(calc1.crates.length).toEqual(1);
    expect(calc1.crates[0].amount.toHuman()).toEqual("1000"); // takes full amount from c1
    expect(calc1.crates[0].stem.toString()).toEqual("10000"); // confirm this is c1
    expect(calc1.seeds.toHuman()).toEqual("3000");

    const calc2 = withdraw.calculateWithdraw(token, token.amount(120), crates, currentSeason);
    expect(calc2.crates.length).toEqual(1);
    expect(calc2.crates[0].amount.toHuman()).toEqual("120"); // takes full amount from c1
    expect(calc1.crates[0].stem.toString()).toEqual("10000"); // confirm this is c3
    expect(calc2.seeds.toHuman()).toEqual("360");
    expect(calc2.stalk.toHuman()).toEqual("120");
  });
});
