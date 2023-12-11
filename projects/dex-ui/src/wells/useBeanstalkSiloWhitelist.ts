import { useMemo } from "react";
import { Well } from "@beanstalk/sdk/Wells";
import { BEANETH_ADDRESS } from "src/utils/addresses";

const WHITELIST_MAP = {
  /// BEANWETHCP2w (BEANETH LP)
  [`${BEANETH_ADDRESS}`]: {
    address: "0xBEA0e11282e2bB5893bEcE110cF199501e872bAd",
    /// better way to do this?
    isMultiFlowPump: true,
    /// Can we make this mapping dynamic?
    seeds: 4.5
  }
};

const getIsWhitelisted = (well: Well | undefined) => {
  if (!well) return false;
  const wellAddress = well.address.toLowerCase();

  return wellAddress in WHITELIST_MAP;
};

const getSeedsWithWell = (well: Well | undefined) => {
  const wellAddress = well?.address.toLowerCase();
  const key = wellAddress as keyof typeof WHITELIST_MAP;
  return WHITELIST_MAP?.[key]?.seeds || undefined;
};

const getIsMultiPumpWell = (well: Well | undefined) => {
  if (well) {
    const wellAddress = well.address.toLowerCase();
    const key = wellAddress as keyof typeof WHITELIST_MAP;
    return WHITELIST_MAP?.[key]?.isMultiFlowPump || false;
  }
  return false;
};

/// set of wells that are whitelisted for the Beanstalk silo
export const useBeanstalkSiloWhitelist = () => {
  const whitelistedAddresses = useMemo(() => Object.keys(WHITELIST_MAP), []);

  return {
    whitelist: whitelistedAddresses,
    getIsWhitelisted,
    getSeedsWithWell,
    getIsMultiPumpWell
  } as const;
};
