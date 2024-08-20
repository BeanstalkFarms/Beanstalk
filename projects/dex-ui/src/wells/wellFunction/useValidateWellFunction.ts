import { multicall } from "@wagmi/core";
import { useCallback } from "react";
import { useWellFunctions } from "./useWellFunctions";
import { WellFunction } from "@beanstalk/sdk-wells";
import useSdk from "src/utils/sdk/useSdk";
import { config } from "src/utils/wagmi/config";
import { BigNumber } from "ethers";
import { BeanstalkSDK } from "@beanstalk/sdk";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "src/utils/query/queryKeys";

const getWellFunctionCalls = (wellFunction: WellFunction) => {
  const address = wellFunction.address as `0x${string}`;
  const bn = BigNumber.from(100); // random big number
  const abi = WellFunction.abi;

  return [
    {
      address,
      abi,
      functionName: "calcLPTokenUnderlying",
      args: [bn, [bn, bn], bn, wellFunction.data]
    },
    { address, abi, functionName: "calcLpTokenSupply", args: [[bn, bn], wellFunction.data] },
    // { // might be flaky
    //   address,
    //   abi,
    //   functionName: "calcReserve",
    //   args: [
    //     [bn, bn],
    //     one,
    //     bn,
    //     wellFunction.data
    //   ]
    // },
    { address, abi, functionName: "name", args: [] },
    { address, abi, functionName: "symbol", args: [] }
  ];
};

const validateWellFunction = async (
  sdk: BeanstalkSDK,
  knownWellFunctions: WellFunction[],
  params: {
    address?: string;
    data?: string;
    wellFunction?: WellFunction;
  }
) => {
  const { address, data, wellFunction: wellFn } = params;

  if (!wellFn && !address && !data) return undefined;

  const foundWellFunction =
    address && knownWellFunctions.find((wf) => wf.address.toLowerCase() === address.toLowerCase());
  if (foundWellFunction) return foundWellFunction;

  const wellFunction = wellFn || (data && address && new WellFunction(sdk.wells, address, data));
  if (!wellFunction) return undefined;

  const calls = await multicall(config, { contracts: getWellFunctionCalls(wellFunction) });
  const allValid = calls.filter((call) => !call.error);

  return allValid.length === calls.length ? wellFunction : undefined;
};

type ValidateWellFunctionParams = {
  address?: string;
  data?: string;
  wellFunction?: WellFunction;
};

type CachedWellFunctionData = WellFunction | string | undefined;

// why set the invalidWellFunctionData to a string?
// react-query doesn't cache undefined values, so we need to set it to a string
const invalidWellFunctionData = "invalid-well-function";

export const useValidateWellFunction = () => {
  const wellFunctions = useWellFunctions();
  const sdk = useSdk();

  const queryClient = useQueryClient();

  const validate = useCallback(
    async ({ address, data, wellFunction }: ValidateWellFunctionParams) => {
      const queryKey = queryKeys.wellFunctionValid(address || "no-address", data || "no-data");
      try {
        // check the queryClientCache first
        const cachedWellFunction = queryClient.getQueryData(queryKey) as CachedWellFunctionData;
        if (cachedWellFunction) {
          if (typeof cachedWellFunction === "string") return undefined;
          return cachedWellFunction;
        }

        const result = await validateWellFunction(sdk, wellFunctions, {
          address,
          data,
          wellFunction
        });

        // set the queryClientCache for future use.
        queryClient.setQueryData(queryKey, result || invalidWellFunctionData);
        return result;
      } catch (e) {
        // set the queryClientCache for future use.
        queryClient.setQueryData(queryKey, invalidWellFunctionData);
        return undefined;
      }
    },
    [wellFunctions, sdk, queryClient]
  );

  return [validate] as const;
};
