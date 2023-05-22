import { Token } from "@beanstalk/sdk-core";
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { WellsSDK } from "../../src/lib/WellsSDK";
import { ACCOUNTS, getProvider } from "./provider";

const WELL_ABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../src/constants/abi/Well.json"), "utf8"));
const AQUIFER_ABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../src/constants/abi/Aquifer.json"), "utf8"));
const MOCK_PUMP_ABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../src/constants/abi/MockPump.json"), "utf8"));
const CONSTANT_PRODUCT_WELL_FUNCTION_ABI = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../../src/constants/abi/ConstantProduct2.json"), "utf8")
);

export interface Call {
  target: string;
  data: Uint8Array;
}

function encodeWellImmutableData(_aquifer: string, _tokens: string[], _wellFunction: Call, _pumps: Call[]): Uint8Array {
  let packedPumps: Uint8Array[] = [];
  for (let i = 0; i < _pumps.length; i++) {
    packedPumps.push(
      ethers.utils.arrayify(
        ethers.utils.solidityPack(["address", "uint256", "bytes"], [_pumps[i].target, _pumps[i].data.length, _pumps[i].data])
      )
    );
  }

  const immutableData = ethers.utils.solidityPack(
    ["address", "uint256", "address", "uint256", "uint256", "address[]", "bytes", "bytes"],
    [
      _aquifer,
      _tokens.length,
      _wellFunction.target,
      _wellFunction.data.length,
      _pumps.length,
      _tokens,
      _wellFunction.data,
      ethers.utils.concat(packedPumps)
    ]
  );

  return ethers.utils.arrayify(immutableData);
}

async function encodeWellInitFunctionCall(
  wellTokens: Token[],
  nameSuffix: string = "Constant Product Well",
  symbolSuffix: string = "w"
): Promise<Uint8Array> {
  if (wellTokens.length < 2) {
    throw new Error("Well must have at least 2 tokens");
  }

  const wellTokenSymbols = wellTokens.map((t) => t.symbol);
  const name = wellTokenSymbols.join(":") + " " + nameSuffix;
  const symbol = wellTokenSymbols.join("") + symbolSuffix;

  const wellInitInterface = new ethers.utils.Interface(["function init(string,string)"]);
  const initFunctionCall = wellInitInterface.encodeFunctionData("init", [name, symbol]);

  return ethers.utils.arrayify(initFunctionCall);
}

export async function deployTestWellInstance(tokens: Token[]) {
  const [privateKey, account] = ACCOUNTS[0];
  const signer = new ethers.Wallet(privateKey, getProvider());
  const wellsSdkInstance = new WellsSDK({
    signer,
    provider: getProvider(),
    rpcUrl: "http://127.0.0.1:8545"
  });

  let wellTokens;

  if (tokens.length === 0) {
    wellTokens = [wellsSdkInstance.tokens.BEAN, wellsSdkInstance.tokens.WETH];
  } else {
    wellTokens = tokens;
  }

  const wellTokensAddresses = wellTokens.map((t) => t.address);

  // ------------------------------ Well dependencies ------------------------------
  // Pump
  const mockPumpContract = new ethers.ContractFactory(MOCK_PUMP_ABI.abi, MOCK_PUMP_ABI.bytecode.object, signer);
  const deployedMockPump = await mockPumpContract.deploy();

  // Well function
  const wellFunctionContract = new ethers.ContractFactory(
    CONSTANT_PRODUCT_WELL_FUNCTION_ABI.abi,
    CONSTANT_PRODUCT_WELL_FUNCTION_ABI.bytecode.object,
    signer
  );
  const deployedWellFunction = await wellFunctionContract.deploy();

  // Aquifer
  const aquiferContract = new ethers.ContractFactory(AQUIFER_ABI.abi, AQUIFER_ABI.bytecode.object, signer);
  const deployedAquifer = await aquiferContract.deploy();

  // Well implementation
  const wellContract = new ethers.ContractFactory(WELL_ABI.abi, WELL_ABI.bytecode.object, signer);
  const deployedWell = await wellContract.deploy();

  // Well immutable data dependencies
  const wellFunctionCall = {
    target: deployedWellFunction.address,
    data: new Uint8Array()
  } as Call;

  const mockPumpCall = {
    target: deployedMockPump.address,
    data: new Uint8Array()
  };

  const immutableData = encodeWellImmutableData(deployedAquifer.address, wellTokensAddresses, wellFunctionCall, [mockPumpCall]);

  // Encode the Init function on the well
  const initFunctionCall = encodeWellInitFunctionCall(wellTokens, "Constant Product Well", "w");

  const saltBytes32 = ethers.constants.HashZero;

  const boredWell = await aquiferContract
    .attach(deployedAquifer.address)
    .boreWell(deployedWell.address, immutableData, initFunctionCall, saltBytes32, { gasLimit: 1000000 });
  await boredWell.wait();

  const eventFilter = deployedAquifer.filters.BoreWell();

  const fromBlock = 17086498;
  const toBlock = "latest";
  const events = await deployedAquifer.queryFilter(eventFilter, fromBlock, toBlock);

  const addresses = events.map((e) => {
    const data = e.decode?.(e.data);
    return data.well;
  });

  return {
    wellsSdkInstance,
    wellAddress: addresses[0]
  };
}
