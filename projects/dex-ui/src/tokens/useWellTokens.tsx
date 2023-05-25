import { Token } from "@beanstalk/sdk";
import { useQuery } from "@tanstack/react-query";
import { Log } from "src/utils/logger";
import { useWells } from "src/wells/useWells";

export const useWellTokens = () => {
  const { data: wells, error: wellsError } = useWells();
  if (wellsError) {
    Log.module("useWellTokens").log(`useWells() threw an error (it shouldn't have): ${wellsError.message}`);
  }

  // @dev: if we fail to load wells, we still execute the useQuery below (see the `enabled` option), but
  // make useQuery return the error, instead of throwing here and needing the parent to handle two type of errors
  return useQuery<Token[], Error>(
    ["tokens", "wellsError"],
    async () => {
      if (wellsError) {
        Log.module("useWellTokens").log(`No wells found: ${wellsError.message}`);
        return [];
      }
      const tokens: Token[] = [];
      for (const well of wells!) {
        if (well.tokens && Array.isArray(well.tokens)) {
          tokens.push(...well.tokens);
        }
      }
      if (tokens.length === 0) {
        if (wellsError) {
          Log.module("useWellTokens").log(`No tokens in wells`);
          return [];
        }
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
