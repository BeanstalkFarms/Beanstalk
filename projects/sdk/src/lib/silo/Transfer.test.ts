import { TokenValue } from "src/TokenValue";
import { getTestUtils, ACCOUNTS } from "src/utils/TestUtils/provider";
import { Transfer } from "./Transfer";

const { sdk, account, utils } = getTestUtils();

jest.setTimeout(30000);

describe("Silo Transfer", function () {
  const transfer = new Transfer(sdk);
  const BEAN_TOKEN = sdk.tokens.BEAN;

  const testDestination = ACCOUNTS[1][1];

  it("Fails when using a non-whitelisted token", async () => {
    const t = async () => {
      const tx = await transfer.transfer(sdk.tokens.ETH, BEAN_TOKEN.amount(3000), testDestination);
    };
    expect(t).rejects.toThrow("Transfer error; token ETH is not a whitelisted asset");
  });

  describe("Transfer sourced from single crate", () => {
    beforeAll(async () => {
      await utils.resetFork();

      // make a deposit
      await BEAN_TOKEN.approveBeanstalk(TokenValue.MAX_UINT256);
      await utils.setBEANBalance(account, BEAN_TOKEN.amount(2000));
      const deposit = await sdk.silo.deposit(BEAN_TOKEN, BEAN_TOKEN, BEAN_TOKEN.amount(500), 0.1);
      await deposit.wait();
    });

    it("Validate starting state", async () => {
      const { deposited } = await sdk.silo.getBalance(BEAN_TOKEN);
      expect(deposited.crates.length).toBe(1);
      expect(deposited.amount.eq(BEAN_TOKEN.amount(500))).toBe(true);
    });

    it("Successfully transfers", async () => {
      const tx = await transfer.transfer(BEAN_TOKEN, BEAN_TOKEN.amount(100), testDestination);
      await tx.wait();
      const { deposited } = await sdk.silo.getBalance(BEAN_TOKEN);

      expect(deposited.crates.length).toBe(1);
      expect(deposited.amount.eq(BEAN_TOKEN.amount(400))).toBe(true);

      const { deposited: destinationBalance } = await sdk.silo.getBalance(BEAN_TOKEN, testDestination);
      expect(destinationBalance.crates.length).toBe(1);
      expect(destinationBalance.amount.eq(BEAN_TOKEN.amount(100))).toBe(true);
    });

    it("Fails when transfer amount exceeds balance", async () => {
      const t = async () => {
        const tx = await transfer.transfer(BEAN_TOKEN, BEAN_TOKEN.amount(3000), testDestination);
      };
      expect(t).rejects.toThrow("Insufficient balance");
    });
  });

  describe("Transfer sourced from multiple crates", () => {
    beforeAll(async () => {
      await utils.resetFork();

      // make a deposit
      await BEAN_TOKEN.approveBeanstalk(TokenValue.MAX_UINT256);
      await utils.setBEANBalance(account, BEAN_TOKEN.amount(1000));
      let deposit = await sdk.silo.deposit(BEAN_TOKEN, BEAN_TOKEN, BEAN_TOKEN.amount(500), 0.1);
      await deposit.wait();

      // go to next season
      await utils.sunriseForward();

      // make another deposit
      deposit = await sdk.silo.deposit(BEAN_TOKEN, BEAN_TOKEN, BEAN_TOKEN.amount(100), 0.1);
      await deposit.wait();
    });

    it("Validate starting state", async () => {
      const { deposited } = await sdk.silo.getBalance(BEAN_TOKEN);
      expect(deposited.crates.length).toBe(2);
      expect(deposited.amount.eq(BEAN_TOKEN.amount(600))).toBe(true);
    });

    it("Successfully transfers", async () => {
      const tx = await transfer.transfer(BEAN_TOKEN, BEAN_TOKEN.amount(150), testDestination);
      await tx.wait();
      const { deposited } = await sdk.silo.getBalance(BEAN_TOKEN);

      expect(deposited.crates.length).toBe(1);
      expect(deposited.amount.eq(BEAN_TOKEN.amount(450))).toBe(true);

      const { deposited: destinationBalance } = await sdk.silo.getBalance(BEAN_TOKEN, testDestination);
      expect(destinationBalance.crates.length).toBe(2);
      expect(destinationBalance.amount.eq(BEAN_TOKEN.amount(150))).toBe(true);
    });

    it("Fails when transfer amount exceeds balance", async () => {
      const t = async () => {
        const tx = await transfer.transfer(BEAN_TOKEN, BEAN_TOKEN.amount(3000), testDestination);
      };
      expect(t).rejects.toThrow("Insufficient balance");
    });
  });
});
