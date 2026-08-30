import type { Well } from "../Well";
import type { WellsSDK } from "../WellsSDK";
import { Router } from "./Router";

type TestToken = {
  chainId: number;
  address: string;
  symbol: string;
  setSignerOrProvider: jest.Mock;
  equals: (other: TestToken) => boolean;
};

const makeToken = (address: string, symbol: string): TestToken => {
  const token = {
    chainId: 1,
    address: address.toLowerCase(),
    symbol,
    setSignerOrProvider: jest.fn(),
    equals(other: TestToken) {
      return this.chainId === other.chainId && this.address === other.address;
    }
  };
  return token;
};

const makeWell = (address: string, tokens: TestToken[]) =>
  ({
    address,
    getTokens: jest.fn().mockResolvedValue(tokens)
  }) as unknown as Well;

describe("Router", () => {
  it("does not replace an allowlisted route with a later unlisted Well using the same tokens", async () => {
    const bean = makeToken("0x0000000000000000000000000000000000000001", "BEAN");
    const weth = makeToken("0x0000000000000000000000000000000000000002", "WETH");
    const trustedWell = makeWell("0x0000000000000000000000000000000000000010", [bean, weth]);
    const unlistedWell = makeWell("0x0000000000000000000000000000000000000011", [bean, weth]);
    const sdk = {
      providerOrSigner: {},
      tokens: {
        ETH: makeToken("", "ETH"),
        WETH: weth
      }
    } as unknown as WellsSDK;
    const router = new Router(sdk, [trustedWell.address]);

    await router.addWell(trustedWell);
    await router.addWell(unlistedWell);
    const route = router.getRoute(bean as any, weth as any);

    expect(route.length).toBe(1);
    expect(route.getStep(0).well.address).toBe(trustedWell.address);
  });

  it("does not route through a token that only matches the destination symbol", async () => {
    const bean = makeToken("0x0000000000000000000000000000000000000001", "BEAN");
    const realWeth = makeToken("0x0000000000000000000000000000000000000002", "WETH");
    const fakeWeth = makeToken("0x0000000000000000000000000000000000000003", "WETH");
    const well = makeWell("0x0000000000000000000000000000000000000010", [bean, fakeWeth]);
    const sdk = {
      providerOrSigner: {},
      tokens: {
        ETH: makeToken("", "ETH"),
        WETH: realWeth
      }
    } as unknown as WellsSDK;
    const router = new Router(sdk);

    await router.addWell(well);
    const route = router.getRoute(bean as any, realWeth as any);

    expect(route.length).toBe(0);
  });
});
