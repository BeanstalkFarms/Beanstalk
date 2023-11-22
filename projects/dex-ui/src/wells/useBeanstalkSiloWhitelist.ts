import { useCallback, useMemo } from "react";
import { Well } from "@beanstalk/sdk/Wells";

const WHITELIST_MAP = {
  /// BEANWETHCP2w (BEANETH LP)
  "0xbea0e11282e2bb5893bece110cf199501e872bad": {
    address: "0xBEA0e11282e2bB5893bEcE110cF199501e872bAd",
    lpTokenAddress: "0xbea0e11282e2bb5893bece110cf199501e872bad",
    /// Can we make this mapping dynamic?
    seeds: 4.5
  }
};

/// set of wells that are whitelisted for the Beanstalk silo
export const useBeanstalkSiloWhitelist = () => {
  const whitelistedAddresses = useMemo(() => Object.keys(WHITELIST_MAP), []);

  const getIsWhitelisted = useCallback((well: Well | undefined) => {
    if (!well) return false;
    const wellAddress = well.address.toLowerCase();

    return wellAddress in WHITELIST_MAP;
  }, []);

  const getSeedsWithWell = useCallback((well: Well | undefined) => {
    const wellAddress = well?.address.toLowerCase();
    const key = wellAddress as keyof typeof WHITELIST_MAP;
    return WHITELIST_MAP?.[key]?.seeds || undefined;
  }, []);

  return { whitelist: whitelistedAddresses, getIsWhitelisted, getSeedsWithWell } as const;
};
