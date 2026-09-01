import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { BlockchainUtils } from "./BlockchainUtils";

describe("BlockchainUtils fork configuration", () => {
  const originalForkUrl = process.env.ANVIL_ETHEREUM_FORK_URL;

  afterEach(() => {
    if (originalForkUrl === undefined) {
      delete process.env.ANVIL_ETHEREUM_FORK_URL;
    } else {
      process.env.ANVIL_ETHEREUM_FORK_URL = originalForkUrl;
    }
  });

  const makeUtils = () => {
    let receivedForkUrl: string | undefined;
    const provider = {
      send: jest.fn(
        async (_method: string, params: Array<{ forking?: { jsonRpcUrl?: string } }>) => {
          receivedForkUrl = params[0]?.forking?.jsonRpcUrl;
        }
      )
    };
    const sdk = { provider } as unknown as BeanstalkSDK;

    return {
      getReceivedForkUrl: () => receivedForkUrl,
      utils: new BlockchainUtils(sdk)
    };
  };

  it("refuses to reset when ANVIL_ETHEREUM_FORK_URL is missing", async () => {
    delete process.env.ANVIL_ETHEREUM_FORK_URL;
    const { utils } = makeUtils();

    await expect(utils.resetFork()).rejects.toThrow("ANVIL_ETHEREUM_FORK_URL is required");
  });

  it("uses the runtime-provided Ethereum fork URL", async () => {
    const expectedForkUrl = "https://eth-mainnet.g.alchemy.com/v2/test-runtime-key";
    process.env.ANVIL_ETHEREUM_FORK_URL = expectedForkUrl;
    const { getReceivedForkUrl, utils } = makeUtils();

    await utils.resetFork();

    expect(getReceivedForkUrl() === expectedForkUrl).toBe(true);
  });
});
