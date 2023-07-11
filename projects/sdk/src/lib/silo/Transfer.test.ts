import { Token } from "src/classes/Token";
import { TokenValue } from "src/TokenValue";
import { getTestUtils, ACCOUNTS } from "src/utils/TestUtils/provider";
import { Transfer } from "./Transfer";

const { sdk, account, utils } = getTestUtils();

jest.setTimeout(30000);

describe("Silo Transfer", function () {
  beforeAll(async () => {
    await utils.resetFork();
    await utils.setAllBalances(account, "2000");
  });

  const transfer = new Transfer(sdk);
  const whiteListedTokens = Array.from(sdk.tokens.siloWhitelist);
  const testDestination = ACCOUNTS[1][1];

  it("Fails when using a non-whitelisted token", async () => {
    const t = async () => {
      const tx = await transfer.transfer(sdk.tokens.ETH, sdk.tokens.BEAN.amount(3000), testDestination);
    };
    expect(t).rejects.toThrow("Transfer error; token ETH is not a whitelisted asset");
  });

  describe.each(whiteListedTokens)("Transfer", (siloToken: Token) => {
    describe(`Transfer ${siloToken.displayName} sourced from single crate`, () => {
      beforeAll(async () => {
        await siloToken.approveBeanstalk(TokenValue.MAX_UINT256);
        const deposit = await sdk.silo.deposit(siloToken, siloToken, siloToken.amount(500), 0.1);
        await deposit.wait();
      });

      it("Validate starting state", async () => {
        const balance = await sdk.silo.getBalance(siloToken);
        expect(balance.deposits.length).toBe(1);
        expect(balance.amount.eq(siloToken.amount(500))).toBe(true);
      });

      it("Successfully transfers", async () => {
        const tx = await transfer.transfer(siloToken, siloToken.amount(100), testDestination);
        await tx.wait();
        const balance = await sdk.silo.getBalance(siloToken);

        expect(balance.deposits.length).toBe(1);
        expect(balance.amount.eq(siloToken.amount(400))).toBe(true);

        const destinationBalance = await sdk.silo.getBalance(siloToken, testDestination);
        expect(destinationBalance.deposits.length).toBe(1);
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
});
