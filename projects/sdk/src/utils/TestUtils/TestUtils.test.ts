import { getTestUtils } from "./provider";

const { sdk, account, utils } = getTestUtils();

// For some reason we need to add a tiny delay between writing and reading the
// memory, otherwise these tests randomly fail
const DELAY = 10;

describe("TestUtils", () => {
  beforeAll(async () => {
    await utils.resetFork();
  });
  it("Hack DAI balance", async () => {
    const DAI = sdk.tokens.DAI;
    await utils.setDAIBalance(account, DAI.amount(30000));
    await pause(DELAY);
    const bal = await DAI.getBalance(account);
    expect(bal.toHuman()).toBe("30000");
  });
  it("Hack USDC balance", async () => {
    const USDC = sdk.tokens.USDC;
    await utils.setUSDCBalance(account, USDC.amount(30000));
    await pause(DELAY);
    const bal = await USDC.getBalance(account);
    expect(bal.toHuman()).toBe("30000");
  });
  it("Hack USDT balance", async () => {
    const USDT = sdk.tokens.USDT;
    await utils.setUSDTBalance(account, USDT.amount(30000));
    await pause(DELAY);
    const bal = await USDT.getBalance(account);
    expect(bal.toHuman()).toBe("30000");
  });
  it("Hack WETH balance", async () => {
    const WETH = sdk.tokens.WETH;
    await utils.setWETHBalance(account, WETH.amount(30000));
    await pause(DELAY);
    const bal = await WETH.getBalance(account);
    expect(bal.toHuman()).toBe("30000");
  });
  it("Hack BEAN balance", async () => {
    const BEAN = sdk.tokens.BEAN;
    await utils.setBEANBalance(account, BEAN.amount(30000));
    await pause(DELAY);
    const bal = await BEAN.getBalance(account);
    expect(bal.toHuman()).toBe("30000");
  });
});

const pause = (ms: number) => new Promise((res) => setTimeout(res, ms));
