import {
  GenericWellFunction,
  ConstantProduct2__factory,
  ConstantProduct__factory,
  GenericWellFunction__factory
} from "src/constants/generated";
import { WellsSDK } from "./WellsSDK";

export class WellFunction {
  contract: GenericWellFunction;

  constructor(public readonly sdk: WellsSDK, public readonly address: string, public readonly data: string) {
    this.sdk = sdk;
    this.contract = GenericWellFunction__factory.connect(address, sdk.providerOrSigner);
  }

  // TODO: provide these as multicalls
  async getName(): Promise<string> {
    return this.contract.name();
  }

  async getSymbol(): Promise<string> {
    return this.contract.symbol();
  }

  static async BuildConstantProduct(sdk: WellsSDK): Promise<WellFunction> {
    const constantProductConstract = new ConstantProduct__factory(sdk.signer);
    const deployedWellFunction = await constantProductConstract.deploy();
    return new WellFunction(sdk, deployedWellFunction.address, "0x");
  }

  static async BuildConstantProduct2(sdk: WellsSDK): Promise<WellFunction> {
    const constantProduct2Constract = new ConstantProduct2__factory(sdk.signer);
    const deployedWellFunction = await constantProduct2Constract.deploy();
    return new WellFunction(sdk, deployedWellFunction.address, "0x");
  }
}
