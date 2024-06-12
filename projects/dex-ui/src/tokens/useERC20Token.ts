import { BEANETH_ADDRESS, getIsValidEthereumAddress } from "../utils/addresses";
import useSdk from "../utils/sdk/useSdk";
import { ERC20Token } from "@beanstalk/sdk";
import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "src/utils/query/queryKeys";
import { erc20Abi as abi } from "viem";
import { multicall } from "@wagmi/core";
import { useWells } from "src/wells/useWells";
import { images } from "src/assets/images/tokens";
import { alchemy } from "src/utils/alchemy";
import { config } from "src/utils/wagmi/config";

export const USE_ERC20_TOKEN_ERRORS = {
  notERC20Ish: "Invalid ERC20 Token Address"
} as const;

const getERC20Data = async (_address: string) => {
  const address = _address as `0x{string}`;
  const args: any[] = [];

  const calls: any[] = [
    { address, abi, functionName: "decimals", args },
    { address, abi, functionName: "totalSupply", args }
  ];

  return multicall(config, { contracts: calls });
};

export const useERC20TokenWithAddress = (_address: string | undefined = "") => {
  const address = _address.toLowerCase();

  const { data: wells = [] } = useWells();
  const sdk = useSdk();

  const lpTokens = wells.map((w) => w.lpToken).filter(Boolean) as ERC20Token[];
  const isValidAddress = getIsValidEthereumAddress(address);
  const sdkToken = sdk.tokens.findByAddress(address);

  const {
    data: tokenMetadata,
    refetch: refetchTokenMetadata,
    ...tokenMetadataQuery
  } = useQuery({
    queryKey: queryKeys.tokenMetadata(isValidAddress ? address : "invalid"),
    queryFn: async () => {
      console.debug("[useERC20Token] fetching: ", address);
      const multiCallResponse = await getERC20Data(address);

      // Validate as much as we can that this is an ERC20 token
      if (multiCallResponse[0]?.error || multiCallResponse[1]?.error) {
        throw new Error(USE_ERC20_TOKEN_ERRORS.notERC20Ish);
      }
      console.debug("[useERC20Token] erc20 multicall response: ", multiCallResponse);

      const metadata = await alchemy.core.getTokenMetadata(address);

      console.debug("[useERC20Token] token metadata: ", metadata);

      return {
        name: metadata?.name ?? "",
        symbol: metadata?.symbol ?? "",
        decimals: metadata?.decimals ?? undefined,
        logo: metadata?.logo ?? images.DEFAULT
      };
    },
    enabled: isValidAddress && !sdkToken,
    // We never need to refetch this data
    staleTime: Infinity,
    refetchOnMount: false,
    retry: false
  });

  const getTokenLogo = async (token: ERC20Token) => {
    let logo: string | undefined = token.logo ?? images[token.symbol];
    if (logo) return logo;

    if (tokenMetadata) {
      logo = tokenMetadata.logo;
    } else {
      const tokenMetadata = await refetchTokenMetadata();
      logo = tokenMetadata?.data?.logo ?? undefined;
    }

    return logo ?? images.DEFAULT;
  };

  const handleIsLPToken = async () => {
    const lpToken = lpTokens.find((lp) => lp.address.toLowerCase() === address.toLowerCase());
    if (!lpToken) return undefined;

    if (!lpToken.logo) {
      const logo = await getTokenLogo(lpToken);
      lpToken.setMetadata({ logo: logo });
    }
    return lpToken;
  };

  const handleIsSdkERC20Token = async () => {
    let token = sdk.tokens.findByAddress(address);
    if (!token) return undefined;

    if (!(token instanceof ERC20Token)) {
      return Promise.reject(new Error(USE_ERC20_TOKEN_ERRORS.notERC20Ish));
    }

    if (!token.logo) {
      const logo = await getTokenLogo(token);
      token.setMetadata({ logo: logo });
    }
    return token;
  };

  const shouldRunWhenNonSdkToken = Boolean(!sdkToken && isValidAddress && tokenMetadata);
  const shouldRunWhenSdkToken = Boolean(sdkToken && isValidAddress && lpTokens.length);

  const erc20Query = useQuery({
    queryKey: queryKeys.erc20TokenWithAddress(isValidAddress ? address : "invalid"),
    queryFn: async () => {
      let token: ERC20Token | undefined = undefined;
      token = await handleIsLPToken();
      if (token) return token;

      token = await handleIsSdkERC20Token();
      if (token) return token;

      // The query have run if this we get to this point
      const { decimals = 0, name = "", symbol = "", logo } = tokenMetadata ?? {};

      if (!decimals || !name || !symbol) {
        return undefined;
      }

      const erc20 = new ERC20Token(
        sdk.chainId,
        address.toLowerCase(),
        decimals,
        symbol.toString() ?? "",
        {
          name: name,
          logo: logo,
          displayName: name
        },
        sdk.providerOrSigner
      );

      return erc20;
    },
    enabled: shouldRunWhenNonSdkToken || shouldRunWhenSdkToken,
    staleTime: Infinity
  });

  return {
    ...erc20Query,
    error: erc20Query.error || tokenMetadataQuery.error,
    isError: erc20Query.isError || tokenMetadataQuery.isError,
    isLoading: erc20Query.isLoading || tokenMetadataQuery.isLoading
  };
};
