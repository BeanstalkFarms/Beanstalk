import {
  ConstantProduct__factory,
  ConstantProduct2__factory,
  IWellFunction,
  IWellFunction__factory
} from "src/constants/generated";
import { WellsSDK } from "./WellsSDK";
import { setReadOnly } from "./utils";

export class WellFunction {
  contract: IWellFunction;
  name: string | undefined;
  symbol: string | undefined;

  constructor(
    public readonly sdk: WellsSDK,
    public readonly address: string,
    public readonly data: string
  ) {
    this.sdk = sdk;
    this.contract = IWellFunction__factory.connect(address, sdk.providerOrSigner);
  }

  // TODO: provide these as multicalls
  async getName(): Promise<string> {
    if (!this.name) {
      this.name = await this.contract.name();
      setReadOnly(this, "name", this.name, true);
    }
    return this.name;
  }

  async getSymbol(): Promise<string> {
    if (!this.symbol) {
      this.symbol = await this.contract.symbol();
      setReadOnly(this, "symbol", this.symbol, true);
    }
    return this.symbol;
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
