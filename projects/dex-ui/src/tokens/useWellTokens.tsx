import { Token } from "@beanstalk/sdk";
import { useQuery } from "@tanstack/react-query";
import useSdk from "src/utils/sdk/useSdk";
import { useWells } from "src/wells/useWells";

export const useWellTokens = () => {
  const sdk = useSdk();
  const { data: wells } = useWells();
  return useQuery<Token[], Error>(
    ["tokens"],
    () => {
      console.log("Query: Loading tokens");
      const tokens: Token[] = [];
      for (const well of wells!) {
        if (well.tokens && Array.isArray(well.tokens)) {
          tokens.push(...well.tokens);
        }
      }

      return tokens;
    },
    {
      // initialData: [sdk.tokens.BEAN, sdk.tokens.WETH],
      enabled: Array.isArray(wells)
    }
  );
};
