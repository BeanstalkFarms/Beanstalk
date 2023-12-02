import { provider, signer } from "../setup";
import { WellsSDK, Well, Aquifer, WellFunction } from "@beanstalk/sdk-wells";

const DEPLOYED_AQUIFER_ADDRESS = "0xBA51AAAA95aeEFc1292515b36D86C51dC7877773";

main().catch((e) => {
  console.log("[ERROR]:", e);
});

async function main() {
  const wellsSDK = new WellsSDK({ provider, signer });

  const wellTokens = [wellsSDK.tokens.BEAN, wellsSDK.tokens.WETH];

  const aquifer = new Aquifer(wellsSDK, DEPLOYED_AQUIFER_ADDRESS);

  console.log("Building Well w/ Constant Product Well Function...");
  const wellFunction = await WellFunction.BuildConstantProduct(wellsSDK);

  console.log("Deploying Well with Aquifer: ", aquifer.address);
  const well = await Well.DeployViaAquifer(wellsSDK, aquifer, wellTokens, wellFunction, []);

  console.log("[DEPLOYED WELL/address]", well.address);
}
