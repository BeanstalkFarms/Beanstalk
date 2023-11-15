import { useMemo } from "react";
import { Well } from "@beanstalk/sdk/Wells";

const WHITELIST_MAP = {
  /// BEANWETHCP2w (BEANETH LP)
  "0xBEA0e11282e2bB5893bEcE110cF199501e872bAd": {
    address: "0xBEA0e11282e2bB5893bEcE110cF199501e872bAd",
    lpTokenAddress: "0xbea0e11282e2bb5893bece110cf199501e872bad"
  }
};

/// set of wells that are whitelisted for the Beanstalk silo
export const useBeanstalkSiloWhitelist = () => {
  const whitelistedAddresses = useMemo(() => Object.keys(WHITELIST_MAP).map((item) => item.toLowerCase()), []);

  const getIsWhitelisted = (well: Well | undefined) => {
    if (!well) return false;
    const wellAddress = well.address;

    return wellAddress in WHITELIST_MAP;
  };

  return { whitelist: whitelistedAddresses, getIsWhitelisted } as const;
};
