import { Well } from "../src/lib/Well";
import { getTestUtils } from "./TestUtils/provider";
import { BlockchainUtils, deployTestWellInstance } from "./TestUtils";
import { Token } from "@beanstalk/sdk-core";

jest.setTimeout(30000);

let testWell: Well;
let testHelper: BlockchainUtils;
let BEAN: Token;
let WETH: Token;

beforeAll(async () => {
  const { wellsSdk: wellsSdkInstance } = getTestUtils();
  BEAN = wellsSdkInstance.tokens.BEAN;
  WETH = wellsSdkInstance.tokens.WETH;
  const wellTokens = [BEAN, WETH];
  
  // Deploy test well
  const deployment = await deployTestWellInstance(wellTokens);
  testHelper = new BlockchainUtils(wellsSdkInstance);
  testWell = new Well(wellsSdkInstance, deployment.wellAddress);
});

afterAll(async () => {
  await testHelper.resetFork();
});

describe("Well", function () {

  // TODO: Will add other methods here such as getWell, getTokens, etc.

  // describe("getWell", () => {
  //   it.todo("returns the well object");
  // });

  describe("getName", () => {
    describe("on first call", () => {
      it("name property is undefined", async () => {
        expect(testWell.name).toBeUndefined();
      });
      it("returns the name from the contract", async () => {
        const name = await testWell.getName();
        expect(name).toBe("BEAN:WETH Constant Product Well");
      });
    });

    describe("on subsequent calls", () => {
      it("name property is cached", async () => {
        expect(testWell.name).toBe("BEAN:WETH Constant Product Well");
      });
    });
  });

  describe("getLPToken", () => {
    describe("on first call", () => {
      it("lpToken property is undefined", async () => {
        expect(testWell.lpToken).toBeUndefined();
      });
      it("returns the lpToken from the contract", async () => {
        const lpToken = await testWell.getLPToken();
        expect(lpToken.address).toBe(testWell.address.toLowerCase());
        expect(lpToken.decimals).toBe(18);
        expect(lpToken.symbol).toBe("BEANWETHw");
      });
    });

    describe("on subsequent calls", () => {
      it("lpToken property is cached", async () => {
        const lpToken = await testWell.lpToken;
        expect(lpToken!.address).toBe(testWell.address.toLowerCase());
        expect(lpToken!.decimals).toBe(18);
        expect(lpToken!.symbol).toBe("BEANWETHw");
      });
    });
  });

  describe("getTokens", () => {
    describe("on first call", () => {
      it("tokens property is undefined", async () => {
        expect(testWell.tokens).toBeUndefined();
      });
    });
    describe("on subsequent calls", () => {
      it("returns the tokens from the contract", async () => {
        const tokens = await testWell.getTokens();
        expect(tokens.length).toBe(2);
        expect(tokens[0].address).toBe(BEAN.address);
        expect(tokens[0].decimals).toBe(6);
        expect(tokens[0].symbol).toBe("BEAN");
        expect(tokens[1].address).toBe(WETH.address);
        expect(tokens[1].decimals).toBe(18);
        expect(tokens[1].symbol).toBe("WETH");
      });
    });
  });

  // TODO: Similar approach to the other methods

});
