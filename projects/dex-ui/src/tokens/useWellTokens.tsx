import { Token } from "@beanstalk/sdk";
import { useQuery } from "@tanstack/react-query";
// import useSdk from "src/utils/sdk/useSdk";
import { useWells } from "src/wells/useWells";

export const useWellTokens = () => {
  const { data: wells, error: wellsError } = useWells();
  // @dev: if we fail to load wells, we still execute the useQuery below (see the `enabled` option), but
  // make useQuery return the error, instead of throwing here and needing the parent to handle two type of errors
  return useQuery<Token[], Error>(
    ["tokens", wellsError],
    () => {
      if (wellsError) throw wellsError;
      const tokens: Token[] = [];
      for (const well of wells!) {
        if (well.tokens && Array.isArray(well.tokens)) {
          tokens.push(...well.tokens);
        }
      }
      if (tokens.length === 0) {
        throw new Error("No tokens found in wells");
      }
      return tokens;
    },
    {
      enabled: Array.isArray(wells) || !!wellsError,
      refetchOnWindowFocus: false,
      retry: false
    }
  );
};
