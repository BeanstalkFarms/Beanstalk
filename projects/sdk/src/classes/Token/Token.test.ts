import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { setupConnection } from "src/utils/TestUtils";

let sdk: BeanstalkSDK;

beforeAll(async () => {
  const { signer, account: _account } = await setupConnection();
  sdk = new BeanstalkSDK({
    signer: signer
  });
});

describe("Bean", () => {
  it("has correct stalk", () => {
    const stalk = sdk.tokens.BEAN.getStalk(sdk.tokens.BEAN.amount(10));
    expect(stalk.decimals).toBe(sdk.tokens.STALK.decimals);
    expect(stalk.toHuman()).toBe("10");
  });
  it("has correct seeds", () => {
    const seeds = sdk.tokens.BEAN.getSeeds(sdk.tokens.BEAN.amount(10));
    expect(seeds.decimals).toBe(sdk.tokens.SEEDS.decimals);
    expect(seeds.toHuman()).toBe("20");
  });
});
describe("BeanLP", () => {
  it("has correct stalk", () => {
    const stalk = sdk.tokens.BEAN_CRV3_LP.getStalk(sdk.tokens.BEAN.amount(10));
    expect(stalk.decimals).toBe(sdk.tokens.STALK.decimals);
    expect(stalk.toHuman()).toBe("10");
  });
  it("has correct seeds", () => {
    const seeds = sdk.tokens.BEAN_CRV3_LP.getSeeds(sdk.tokens.BEAN.amount(10));
    expect(seeds.decimals).toBe(sdk.tokens.SEEDS.decimals);
    expect(seeds.toHuman()).toBe("40");
  });
});
