import { Well } from "../src/lib/Well";
import { getTestUtils } from "./TestUtils/provider";
import { BlockchainUtils, deployTestWellInstance } from "./TestUtils";
import { Token } from "@beanstalk/sdk-core";
import { WellsSDK } from "../src/lib/WellsSDK";

jest.setTimeout(30000);

let testWell: Well;
let testHelper: BlockchainUtils;
let BEAN: Token;
let WETH: Token;
let deployment: {
    wellsSdkInstance: WellsSDK;
    wellAddress: string;
}
let wellsSdkInstance: WellsSDK

beforeAll(async () => {
  const { wellsSdk } = getTestUtils();
  wellsSdkInstance = wellsSdk;
  BEAN = wellsSdkInstance.tokens.BEAN;
  WETH = wellsSdkInstance.tokens.WETH;
  const wellTokens = [BEAN, WETH];
  
  // Deploy test well
  deployment = await deployTestWellInstance(wellTokens);
  testHelper = new BlockchainUtils(wellsSdkInstance);
});

afterAll(async () => {
  await testHelper.resetFork();
});

describe("Well", function () {
  beforeEach(() => {
    testWell = new Well(wellsSdkInstance, deployment.wellAddress);
  });

  describe('loadWell', () => {
    beforeEach(() => {
      testWell = new Well(wellsSdkInstance, deployment.wellAddress);
    });
  
    it('should load all properties by default', async () => {
      await testWell.loadWell();

      expect(testWell.name).toBeDefined();
      expect(testWell.lpToken).toBeDefined();
      expect(testWell.wellFunction).toBeDefined();
      expect(testWell.pumps).toBeDefined();
      expect(testWell.aquifer).toBeDefined();
      expect(testWell.tokens).toBeDefined();
      expect(testWell.reserves).toBeDefined();
    });

    it('should load only specified properties', async () => {
      await testWell.loadWell({
        name: true,
        lpToken: true,
      });

      expect(testWell.name).toBeDefined();
      expect(testWell.lpToken).toBeDefined();
      expect(testWell.wellFunction).toBeUndefined();
      expect(testWell.pumps).toBeUndefined();
      expect(testWell.aquifer).toBeUndefined();
      expect(testWell.tokens).toBeUndefined();
      expect(testWell.reserves).toBeUndefined();
    });
  });

  describe('getWell', () => {
    it('should return the tokens, Well function, pumps, and aquifer associated with the well', async () => {
      const wellDetails = await testWell.getWell();
      expect(wellDetails.tokens).toBeDefined();
      expect(wellDetails.wellFunction).toBeDefined();
      expect(wellDetails.pumps).toBeDefined();
      expect(wellDetails.aquifer).toBeDefined();
    });

    it('should set the tokens if they are not already set', async () => {
      testWell.tokens = undefined;
      await testWell.getWell();
      expect(testWell.tokens).toBeDefined();
    });

    it('should set the Well function if it is not already set', async () => {
      testWell.wellFunction = undefined;
      await testWell.getWell();
      expect(testWell.wellFunction).toBeDefined();
    });

    it('should set the pumps if they are not already set', async () => {
      testWell.pumps = undefined;
      await testWell.getWell();
      expect(testWell.pumps).toBeDefined();
    });

    it('should set the aquifer if it is not already set', async () => {
      testWell.aquifer = undefined;
      await testWell.getWell();
      expect(testWell.aquifer).toBeDefined();
    });
  });

  describe('getName', () => {
    it('should return the name and cache the value after the first call', async () => {
      expect(testWell.name).toBeUndefined();
      const name = await testWell.getName();
      expect(name).toBeDefined();
      expect(testWell.name).toBeDefined();
    });
  });

  describe('getTokens', () => {
    it('should return the tokens and cache the value after the first call', async () => {
      expect(testWell.tokens).toBeUndefined();
      const tokens = await testWell.getTokens();
      expect(tokens).toBeDefined();
      expect(testWell.tokens).toBeDefined();
    });
  });

  describe('getWellFunction', () => {
    it('should return the pumps and cache the value after the first call', async () => {
      expect(testWell.wellFunction).toBeUndefined();
      const wellFunction = await testWell.getWellFunction();
      expect(wellFunction).toBeDefined();
      expect(testWell.wellFunction).toBeDefined();
    });
  });

  describe('getPumps', () => {
    it('should return the pumps and cache the value after the first call', async () => {
      expect(testWell.pumps).toBeUndefined();
      const pumps = await testWell.getPumps();
      expect(pumps).toBeDefined();
      expect(testWell.pumps).toBeDefined();
    });
  });

  describe('getAquifer', () => {
    it('should return the aquifer and cache the value after the first call', async () => {
      expect(testWell.aquifer).toBeUndefined();
      const aquifer = await testWell.getAquifer();
      expect(aquifer).toBeDefined();
      expect(testWell.aquifer).toBeDefined();
    });
  });

  describe('getReserves', () => {
    it('should return the reserves and cache the value after the first call', async () => {
      expect(testWell.reserves).toBeUndefined();
      const reserves = await testWell.getReserves();
      expect(reserves).toBeDefined();
      expect(testWell.reserves).toBeDefined();
    });
  });
});

