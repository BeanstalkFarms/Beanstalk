import { Token } from "src/classes/Token";
import { TokenValue } from "src/TokenValue";
import { getTestUtils, ACCOUNTS } from "src/utils/TestUtils/provider";
import { Transfer } from "./Transfer";

const { sdk, account, utils } = getTestUtils();

jest.setTimeout(30000);

describe("Silo Transfer", function () {
  const transfer = new Transfer(sdk);

  const SUPPORTED_TOKENS = [sdk.tokens.BEAN, sdk.tokens.BEAN_CRV3_LP, sdk.tokens.UNRIPE_BEAN, sdk.tokens.UNRIPE_BEAN_CRV3];

  const testDestination = ACCOUNTS[1][1];

  it("Fails when using a non-whitelisted token", async () => {
    const t = async () => {
      const tx = await transfer.transfer(sdk.tokens.ETH, sdk.tokens.BEAN.amount(3000), testDestination);
    };
    expect(t).rejects.toThrow("Transfer error; token ETH is not a whitelisted asset");
  });

  describe.each(SUPPORTED_TOKENS)("Transfer", (siloToken: Token) => {
    describe(`Transfer ${siloToken.displayName} sourced from single crate`, () => {
      beforeAll(async () => {
        await utils.resetFork();

        // make a deposit
        await siloToken.approveBeanstalk(TokenValue.MAX_UINT256);
        await utils.setBalance(siloToken, account, 2000);
        const deposit = await sdk.silo.deposit(siloToken, siloToken, siloToken.amount(500), 0.1);
        await deposit.wait();
      });

      it("Validate starting state", async () => {
        const { deposited } = await sdk.silo.getBalance(siloToken);
        expect(deposited.crates.length).toBe(1);
        expect(deposited.amount.eq(siloToken.amount(500))).toBe(true);
      });

      it("Successfully transfers", async () => {
        const tx = await transfer.transfer(siloToken, siloToken.amount(100), testDestination);
        await tx.wait();
        const { deposited } = await sdk.silo.getBalance(siloToken);

        expect(deposited.crates.length).toBe(1);
        expect(deposited.amount.eq(siloToken.amount(400))).toBe(true);

        const { deposited: destinationBalance } = await sdk.silo.getBalance(siloToken, testDestination);
        expect(destinationBalance.crates.length).toBe(1);
        expect(destinationBalance.amount.eq(siloToken.amount(100))).toBe(true);
      });

      it("Fails when transfer amount exceeds balance", async () => {
        const t = async () => {
          const tx = await transfer.transfer(siloToken, siloToken.amount(3000), testDestination);
        };
        expect(t).rejects.toThrow("Insufficient balance");
      });
    });
  });

  describe("Transfer BEAN sourced from multiple crates", () => {
    beforeAll(async () => {
      await utils.resetFork();

      // make a deposit
      await sdk.tokens.BEAN.approveBeanstalk(TokenValue.MAX_UINT256);
      await utils.setBalance(sdk.tokens.BEAN, account, 2000);

      let deposit = await sdk.silo.deposit(sdk.tokens.BEAN, sdk.tokens.BEAN, sdk.tokens.BEAN.amount(500), 0.1);
      await deposit.wait();

      // go to next season
      await utils.sunriseForward();

      // make another deposit
      deposit = await sdk.silo.deposit(sdk.tokens.BEAN, sdk.tokens.BEAN, sdk.tokens.BEAN.amount(100), 0.1);
      await deposit.wait();
    });

    it("Validate starting state", async () => {
      const { deposited } = await sdk.silo.getBalance(sdk.tokens.BEAN);
      expect(deposited.crates.length).toBe(2);
      expect(deposited.amount.eq(sdk.tokens.BEAN.amount(600))).toBe(true);
    });

    it("Successfully transfers", async () => {
      const tx = await transfer.transfer(sdk.tokens.BEAN, sdk.tokens.BEAN.amount(150), testDestination);
      await tx.wait();
      const { deposited } = await sdk.silo.getBalance(sdk.tokens.BEAN);

      expect(deposited.crates.length).toBe(1);
      expect(deposited.amount.eq(sdk.tokens.BEAN.amount(450))).toBe(true);

      const { deposited: destinationBalance } = await sdk.silo.getBalance(sdk.tokens.BEAN, testDestination);
      expect(destinationBalance.crates.length).toBe(2);
      expect(destinationBalance.amount.eq(sdk.tokens.BEAN.amount(150))).toBe(true);
    });

    it("Fails when transfer amount exceeds balance", async () => {
      const t = async () => {
        const tx = await transfer.transfer(sdk.tokens.BEAN, sdk.tokens.BEAN.amount(3000), testDestination);
      };
      expect(t).rejects.toThrow("Insufficient balance");
    });
  });
});
