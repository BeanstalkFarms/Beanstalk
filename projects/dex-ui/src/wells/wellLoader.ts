import { multicall } from "@wagmi/core";
import { BigNumber } from "ethers";
import memoize from "lodash/memoize";
import { ContractFunctionParameters, erc20Abi } from "viem";

import { BeanstalkSDK, ChainId } from "@beanstalk/sdk";
import { ChainResolver, ERC20Token } from "@beanstalk/sdk-core";
import { Aquifer, Well } from "@beanstalk/sdk-wells";

import { GetWellAddressesDocument } from "src/generated/graph/graphql";
import { Settings } from "src/settings";
import { chunkArray } from "src/utils/array";
import { Log } from "src/utils/logger";
import { config } from "src/utils/wagmi/config";

import { fetchFromSubgraphRequest } from "./subgraphFetch";

type WellAddresses = string[];

const WELL_BLACKLIST: Record<number, WellAddresses> = {
  [ChainId.ETH_MAINNET]: [
    "0x875b1da8dcba757398db2bc35043a72b4b62195d".toLowerCase(),
    "0xBea0061680A2DEeBFA59076d77e0b6c769660595".toLowerCase(), // bean:wstETH duplicate
    "0xbEa00022Ee2F7E2eb222f75fE79eFE4871E655ca".toLowerCase(), // bean:wstETH duplicate
    "0xbea0009b5b96D87643DFB7392293f18af7C041F4".toLowerCase(), // bean:wstETH duplicate
    "0x5997111CbBAA0f4C613Ae678Ba4803e764140266".toLowerCase() // usdc:frax duplicate
  ],
  [ChainId.ARBITRUM_MAINNET]: [
    "0x0adf75da6980fee8f848d52a7af1f8d6f34a8169".toLowerCase(), // bean:WETH duplicate,
    "0xb968de36ce9c61371a82a78b715af660c2209d11".toLowerCase(), // bean:wstETH duplicate
    "0x8d74ff8e729b4e78898488775b619c05d1ecb5e5".toLowerCase(), // bean:weETH duplicate
    "0x370062BE2d6Fc8d02948fEA75fAfe471F74854CF".toLowerCase(), // bean:WBTC duplicate
    "0x157219b5D112F2D8aaFD3c7F3bA5D4c73343cc96".toLowerCase(), // bean:USDC duplicate
    "0xF3e4FC5c53D5500989e68F81d070094525caC240".toLowerCase() // bean:USDT duplicate
  ]
};

const loadFromChain = async (sdk: BeanstalkSDK, aquifer: Aquifer): Promise<WellAddresses> => {
  try {
    const chainId = ChainResolver.resolveToMainnetChainId(sdk.chainId);

    const contract = aquifer.contract;
    const eventFilter = contract.filters.BoreWell();

    const fromBlock = Number(Settings.WELLS_ORIGIN_BLOCK);
    const toBlock = "latest";
    const events = await contract.queryFilter(eventFilter, fromBlock, toBlock);
    const blacklist = WELL_BLACKLIST[chainId];

    const addresses = events
      .map((e) => {
        const data = e.decode?.(e.data);
        return data.well;
      })
      .filter((addr) => !blacklist.includes(addr.toLowerCase()));

    return addresses;
  } catch (e) {
    console.error("error loading wells from chain: ", e);
    return [];
  }
};

const loadFromGraph = async (_chainId: ChainId): Promise<WellAddresses> => {
  const data = await fetchFromSubgraphRequest(GetWellAddressesDocument, undefined);
  const results = await data();

  const chainId = ChainResolver.resolveToMainnetChainId(_chainId);
  const blacklist = WELL_BLACKLIST[chainId];

  return results.wells.map((w) => w.id).filter((addr) => !blacklist.includes(addr.toLowerCase()));
};

// ---------- Fetch Well Addresses ----------

export const findWells = memoize(
  async (sdk: BeanstalkSDK, aquifer: Aquifer): Promise<WellAddresses> => {
    const result = await Promise.any([
      loadFromChain(sdk, aquifer)
        .then((res) => {
          Log.module("wells").debug("Used blockchain to load wells");
          return res;
        })
        .catch((err) => {
          Log.module("wells").error("Error loading wells from blockchain: ", err);
          throw err;
        })

      // BS3TODO: Fix me when subgraph endpoints are updated
      // loadFromGraph(sdk.chainId)
      //   .then((res) => {
      //     Log.module("wells").debug("Used subgraph to load wells");
      //     return res;
      //   })
      //   .catch((err) => {
      //     Log.module("wells").warn("Error loading wells from subgraph: ", err);
      //     throw err;
      //   })
    ]);

    const wellLPAddresses = sdk.pools.getWells().map((w) => w.address.toLowerCase());
    const resultAddresses = result.map((r) => r.toLowerCase());
    const addresses = new Set([...wellLPAddresses, ...resultAddresses]);

    if (!addresses.size) {
      throw new Error("No deployed wells found");
    }

    console.log("addresses: ", addresses);

    return [...addresses];
  },
  // Override the default memoize caching with just a '1'
  // so it always caches, regardless of parameter passed
  (sdk) => sdk.chainId?.toString() || "no-chain-id"
);

// ---------- Fetch Wells ----------

const MAX_PER_CALL = 21;

type CallResult = {
  target: string;
  data: string;
};

type WellsMultiCallResult = [name: string, well: WellCallResult, reserves: bigint[]];

type WellCallResult = [
  tokens: string[],
  wellFunction: CallResult,
  pumps: CallResult[],
  wellData: string,
  aquifer: string
];

type TokenCallResult = [name: string, symbol: string, decimals: number];

export const fetchWellsWithAddresses = async (
  { wells: sdk }: BeanstalkSDK,
  addresses: string[]
) => {
  const toLower = addresses.map((a) => a.toLowerCase());
  const wellAddresses = new Set([...toLower]);
  const tokenSet = new Set<string>([...toLower]);

  const wellCalls = makeWellContractCalls(addresses);

  const wellResults = await Promise.all(
    wellCalls.contractCalls.map((contracts) =>
      multicall(config, { contracts: contracts, allowFailure: true })
    )
  ).then((results) => {
    const chunked = chunkArray(results.flat(), wellCalls.chunkSize).map((chunk, i) => {
      const [name, wellData, reserves] = chunk;
      if (name.error || wellData.error || reserves.error)
        return {
          data: null,
          address: addresses[i].toLowerCase()
        };
      return {
        data: [name.result, wellData.result, reserves.result] as WellsMultiCallResult,
        address: addresses[i].toLowerCase()
      };
    });

    // const chunked = chunkArray(results.flat(), wellCalls.chunkSize) as WellsMultiCallResult[];
    // console.log("chunked: ", chunked);
    Log.module("wells").debug("Well Multicall : ", chunked);

    chunked.forEach(({ data }) => {
      if (data) {
        const wellDatas = data[1];
        // If token is not defined in WellsSDK. We need to fetch it from on Chain.
        for (const token of wellDatas[0]) {
          if (sdk.tokens.findByAddress(token)) continue;
          tokenSet.add(token.toLowerCase());
        }
      }
    });

    return chunked;
  });

  console.log("wellResults: ", wellResults);
  console.log("tokenset: ", tokenSet);

  const tokenAddresses = [...tokenSet];
  const tokensCalls = makeTokensContractCall(tokenAddresses);

  const tokenMap = await Promise.all(
    tokensCalls.contractCalls.map((contracts) =>
      multicall(config, { contracts: contracts, allowFailure: false })
    )
  )
    .then((r) => {
      console.log("r: ", r);
      const chunked = chunkArray(r.flat(), tokensCalls.chunkSize) as TokenCallResult[];
      Log.module("wells").debug("Tokens Multicall : ", chunked);

      return chunked.reduce<Record<string, ERC20Token>>((prev, [name, symbol, decimals], i) => {
        const tokenAddress = tokenAddresses[i]?.toLowerCase();
        if (!tokenAddress) return prev;

        prev[tokenAddress] = new ERC20Token(
          sdk.chainId,
          tokenAddress,
          decimals,
          symbol,
          { name: name, displayDecimals: 2, isLP: wellAddresses.has(tokenAddress) },
          sdk.providerOrSigner
        );
        return prev;
      }, {});
    })
    .catch((t) => {
      console.log("t: ", t);
      return {};
    });

  console.log("tokenMap: ", tokenMap);

  const wells: Well[] = [];

  wellResults.forEach(({ data, address }) => {
    if (!data) return;
    const [name, wellResult, reserves] = data;
    const [tokens, wellFunction, pumps, wellData, aquifer] = wellResult;

    const wellTokens = tokens.map((t) => {
      const tokenAddress = t.toString().toLowerCase();
      return sdk.tokens.erc20Tokens.get(tokenAddress) || tokenMap[tokenAddress];
    });
    const wellReserves = reserves.map(BigNumber.from);
    const wellLPToken = sdk.tokens.erc20Tokens.get(address) || tokenMap[address];

    const well = Well.createWithParams(sdk, {
      address: address,
      name,
      wellFunction,
      pumps,
      wellData,
      aquifer,
      lpToken: wellLPToken,
      tokens: wellTokens,
      reserves: wellReserves
    });

    wells.push(well);
  });

  return wells;
};

type WellContractCall = ContractFunctionParameters<typeof wellsABI>;
type ERC20ContractCall = ContractFunctionParameters<typeof erc20Abi>;

const makeTokensContractCall = (addresses: string[]) => {
  const contractCalls: ERC20ContractCall[][] = [];

  // calls per well address
  const chunkSize = 3;

  let callBucket: ERC20ContractCall[] = [];
  addresses.forEach((address) => {
    const contract = {
      address: address as `0x{string}`,
      abi: erc20Abi
    };

    const nameCall: ERC20ContractCall = {
      ...contract,
      functionName: "name",
      args: []
    };
    const symbolCall: ERC20ContractCall = {
      ...contract,
      functionName: "symbol",
      args: []
    };
    const decimalsCall: ERC20ContractCall = {
      ...contract,
      functionName: "decimals",
      args: []
    };

    callBucket.push(nameCall, symbolCall, decimalsCall);

    if (callBucket.length === MAX_PER_CALL) {
      contractCalls.push([...callBucket]);
      callBucket = [];
    }
  });

  if (callBucket.length) {
    contractCalls.push(callBucket);
  }

  return {
    contractCalls,
    chunkSize
  };
};

const makeWellContractCalls = (addresses: string[]) => {
  const contractCalls: WellContractCall[][] = [];
  // calls per token
  const chunkSize = 3;

  let callBucket: WellContractCall[] = [];
  addresses.forEach((_address) => {
    const contract = {
      address: _address as `0x{string}`,
      abi: wellsABI
    };
    const nameCall: WellContractCall = {
      ...contract,
      functionName: "name",
      args: []
    };
    const wellCall: WellContractCall = {
      ...contract,
      functionName: "well",
      args: []
    };
    const reservesCall: WellContractCall = {
      ...contract,
      functionName: "getReserves",
      args: []
    };

    callBucket.push(nameCall, wellCall, reservesCall);

    if (callBucket.length === MAX_PER_CALL) {
      contractCalls.push([...callBucket]);
      callBucket = [];
    }
  });

  if (callBucket.length) {
    contractCalls.push(callBucket);
  }

  return {
    contractCalls,
    chunkSize
  };
};

const wellsABI = [
  {
    inputs: [],
    name: "name",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "well",
    outputs: [
      {
        internalType: "contract IERC20[]",
        name: "_tokens",
        type: "address[]"
      },
      {
        components: [
          {
            internalType: "address",
            name: "target",
            type: "address"
          },
          {
            internalType: "bytes",
            name: "data",
            type: "bytes"
          }
        ],
        internalType: "struct Call",
        name: "_wellFunction",
        type: "tuple"
      },
      {
        components: [
          {
            internalType: "address",
            name: "target",
            type: "address"
          },
          {
            internalType: "bytes",
            name: "data",
            type: "bytes"
          }
        ],
        internalType: "struct Call[]",
        name: "_pumps",
        type: "tuple[]"
      },
      {
        internalType: "bytes",
        name: "_wellData",
        type: "bytes"
      },
      {
        internalType: "address",
        name: "_aquifer",
        type: "address"
      }
    ],
    stateMutability: "pure",
    type: "function"
  },
  {
    inputs: [],
    name: "getReserves",
    outputs: [
      {
        internalType: "uint256[]",
        name: "reserves",
        type: "uint256[]"
      }
    ],
    stateMutability: "view",
    type: "function"
  }
] as const;
