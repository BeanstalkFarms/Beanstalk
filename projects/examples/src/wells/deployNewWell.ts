import { provider, signer } from "../setup";
import { WellsSDK, Well, Aquifer, WellFunction } from "@beanstalk/sdk-wells";

const ACCOUNTS = [
  ["0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"],
  ["0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", "0x70997970c51812dc3a010c7d01b50e0d17dc79c8"]
];

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
