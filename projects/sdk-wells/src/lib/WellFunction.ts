import { ConstantProduct2__factory, ConstantProduct__factory } from "src/constants/generated";
import { WellsSDK } from "./WellsSDK";

export class WellFunction {
  constructor(public readonly address: string, public readonly data: string) {}

  static async BuildConstantProduct(sdk: WellsSDK): Promise<WellFunction> {
    const constantProductConstract = new ConstantProduct__factory(sdk.signer);
    const deployedWellFunction = await constantProductConstract.deploy();
    return new WellFunction(deployedWellFunction.address, "0x");
  }

  static async BuildConstantProduct2(sdk: WellsSDK): Promise<WellFunction> {
    const constantProduct2Constract = new ConstantProduct2__factory(sdk.signer);
    const deployedWellFunction = await constantProduct2Constract.deploy();
    return new WellFunction(deployedWellFunction.address, "0x");
  }
}
