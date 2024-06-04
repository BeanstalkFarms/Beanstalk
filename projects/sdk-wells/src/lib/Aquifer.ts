import { Aquifer as AquiferContract, Aquifer__factory } from "src/constants/generated";
import {
  encodeWellImmutableData,
  encodeWellInitFunctionCall,
  getBytesHexString,
  makeCallObject,
  setReadOnly,
  validateAddress,
  validateHasMinTokensForWell
} from "./utils";
import { WellsSDK } from "./WellsSDK";
import { WellFunction } from "./WellFunction";
import { ERC20Token } from "@beanstalk/sdk-core";
import { Pump } from "./Pump";
import { constants } from "ethers";
import { Well } from "./Well";

export class Aquifer {
  public sdk: WellsSDK;
  readonly address: string;
  readonly contract: AquiferContract;

  constructor(sdk: WellsSDK, address: string) {
    if (!address) {
      throw new Error("Address must be provided");
    }

    this.address = address;
    setReadOnly(this, "sdk", sdk, false);
    setReadOnly(this, "contract", Aquifer__factory.connect(address, sdk.providerOrSigner), true);
  }

  /**
   *
   * @param name
   * @param symbol
   * @param tokens
   * @param wellAddress
   * @param wellFunction
   * @param pumps
   * @returns
   */
  async boreWell(
    wellAddress: string,
    tokens: ERC20Token[],
    wellFunction: WellFunction,
    pumps: Pump[],
    _symbol?: string,
    _name?: string,
    salt?: number
  ): Promise<Well> {
    validateHasMinTokensForWell(tokens);
    validateSalt(salt);

    // Prepare Data
    const immutableData = Aquifer.getEncodedWellImmutableData(
      this.address,
      tokens,
      wellFunction,
      pumps
    );
    const { name, symbol } = await getNameAndSymbol(wellFunction, tokens, _name, _symbol);
    const initFunctionCall = await Aquifer.getEncodedWellInitFunctionData(name, symbol);

    // Default salt to 0. salt gt 0 is required for deterministic address
    const saltBytes32 = salt ? getBytesHexString(salt, 32) : constants.HashZero;

    // Bore It
    const deployedWell = await this.contract.boreWell(
      wellAddress,
      immutableData,
      initFunctionCall,
      saltBytes32
    );

    const txn = await deployedWell.wait();

    if (!txn.events) {
      throw new Error("No events found");
    }

    const boredWellAddress = txn.events[0].address;

    return new Well(this.sdk, boredWellAddress);
  }

  async predictWellAddress(
    implementation: string,
    tokens: ERC20Token[],
    wellFunction: WellFunction,
    pumps: Pump[],
    salt?: number
  ) {
    validateHasMinTokensForWell(tokens);
    validateSalt(salt);

    const immutableData = Aquifer.getEncodedWellImmutableData(
      this.address,
      tokens,
      wellFunction,
      pumps
    );
    const saltBytes32 = salt ? getBytesHexString(salt, 32) : constants.HashZero;

    return this.contract.predictWellAddress(implementation, immutableData, saltBytes32);
  }

  // Static Methods

  /**
   * returns pack encoded data (immutableData) to deploy a well via aquifer.boreWell & predict a deterministic well address via aquifer.predictWellAddress
   * @param aquifer
   * @param wellImplementation
   * @param tokens
   * @param wellFunction
   * @param pumps
   * @returns
   */
  static getEncodedWellImmutableData(
    aquifer: string,
    tokens: ERC20Token[],
    wellFunction: WellFunction,
    pumps: Pump[]
  ) {
    validateAddress(wellFunction.address, wellFunction.address);

    if (tokens.length < 2) {
      throw new Error("Well must have at least 2 tokens");
    }

    const pumpCalls = pumps.map((p) => {
      validateAddress(p.address, p.address);
      return makeCallObject(p);
    });
    const wellFunctionCall = makeCallObject(wellFunction);
    const tokensAddresses = tokens.map((t) => t.address);

    return encodeWellImmutableData(aquifer, tokensAddresses, wellFunctionCall, pumpCalls);
  }

  /**
   * Returns pack encoded data (initFunctionCall) to deploy a well via aquifer.boreWell
   * @param name
   * @param symbol
   * @returns
   */
  static async getEncodedWellInitFunctionData(name: string, symbol: string) {
    if (!name) {
      throw new Error("Name must be provided");
    }
    if (!symbol) {
      throw new Error("Symbol must be provided");
    }
    return encodeWellInitFunctionCall(name, symbol);
  }

  /**
   * Deploy a new instance of Aquifer
   * @param sdk
   * @returns
   */
  static async BuildAquifer(sdk: WellsSDK): Promise<Aquifer> {
    const aquiferContract = new Aquifer__factory(sdk.signer);
    const deployedAquifer = await aquiferContract.deploy();
    return new Aquifer(sdk, deployedAquifer.address);
  }
}

function validateSalt(salt?: number) {
  if (!salt) return;
  if (!Number.isInteger(salt)) {
    throw new Error("Salt must be an integer");
  }
  if (salt < 0) {
    throw new Error("Salt must be greater than 0");
  }
}

async function getNameAndSymbol(
  wellFunction: WellFunction,
  tokens: ERC20Token[],
  _name?: string,
  _symbol?: string
) {
  let name = _name ?? "";
  let symbol = _symbol ?? "";

  const symbols = tokens.map((t) => t.symbol);

  // TODO: make this a multicall

  if (!name) {
    const fnName = await wellFunction.getName();
    name = symbols.join(":") + " " + fnName + " Well";
  }

  if (!symbol) {
    const fnSymbol = await wellFunction.getSymbol();
    symbol = symbols.join("") + fnSymbol + "w";
  }

  return { name, symbol };
}
