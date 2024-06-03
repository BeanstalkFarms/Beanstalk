import { Aquifer as AquiferContract, Aquifer__factory } from "src/constants/generated";
import {
  encodeWellImmutableData,
  encodeWellInitFunctionCall,
  getBytesHexString,
  makeCallObject,
  setReadOnly,
  validateAddress
} from "./utils";
import { WellsSDK } from "./WellsSDK";
import { WellFunction } from "./WellFunction";
import { ERC20Token } from "@beanstalk/sdk-core";
import { Pump } from "./Pump";
import { Call } from "src/types";
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
    pumps: Pump[]
  ): Promise<Well> {
    if (tokens.length < 2) {
      throw new Error("Well must have at least 2 tokens");
    }

    const tokensAddresses = tokens.map((t) => t.address);

    const wellFunctionCall = {
      target: wellFunction.address,
      data: new Uint8Array()
    } as Call;

    const pumpCalls = pumps.map(
      (p) =>
        ({
          target: p.address,
          data: new Uint8Array()
        }) as Call
    );

    // Prepare Data
    const immutableData = encodeWellImmutableData(
      this.address,
      tokensAddresses,
      wellFunctionCall,
      pumpCalls
    );
    const { name, symbol } = await getNameAndSymbol(wellFunction, tokens);
    const initFunctionCall = await encodeWellInitFunctionCall(name, symbol);
    const saltBytes32 = constants.HashZero;

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

  /**
   *
   * @param params
   * @returns txn & well
   */
  async boreWellWithOptions(params: {
    implementationAddress: string;
    tokens: ERC20Token[];
    wellFunction: WellFunction;
    pumps: Pump[];
    symbol?: string;
    name?: string;
    salt?: number;
  }) {
    const {
      implementationAddress,
      tokens,
      wellFunction,
      pumps,
      salt,
      name: _name,
      symbol: _symbol
    } = params;

    validateAddress(implementationAddress, implementationAddress);
    if (tokens.length < 2) {
      throw new Error("Well must have at least 2 tokens");
    }
    if (salt) {
      if (!Number.isInteger(salt)) {
        throw new Error("Salt must be an integer");
      } else if (salt < 0) {
        throw new Error("Salt must be greater than 0");
      }
    }

    const tokensAddresses = tokens.map((t) => t.address);
    const wellFunctionCall = makeCallObject(wellFunction);
    const pumpCalls = pumps.map((p) => makeCallObject(p));

    const immutableData = encodeWellImmutableData(
      this.address,
      tokensAddresses,
      wellFunctionCall,
      pumpCalls
    );
    const { name, symbol } = await getNameAndSymbol(wellFunction, tokens);
    const initFunctionCall = await encodeWellInitFunctionCall(name, symbol);
    const saltBytes32 = salt ? getBytesHexString(salt, 32) : constants.HashZero;

    // bore well
    const deployedWell = await this.contract.boreWell(
      implementationAddress,
      immutableData,
      initFunctionCall,
      saltBytes32
    );

    const txn = await deployedWell.wait();

    if (!txn.events?.length) {
      throw new Error("No events found");
    }

    const well = new Well(this.sdk, txn.events[0].address);

    return { well, txn };
  }

  static async BuildAquifer(sdk: WellsSDK): Promise<Aquifer> {
    const aquiferContract = new Aquifer__factory(sdk.signer);
    const deployedAquifer = await aquiferContract.deploy();
    return new Aquifer(sdk, deployedAquifer.address);
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

  if (symbol) {
    const fnSymbol = await wellFunction.getSymbol();
    symbol = symbols.join("") + fnSymbol + "w";
  }

  return { name, symbol };
}
