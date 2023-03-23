/**
 * We are hardcoding Well addresses to start with.
 * Once we have a registry, we can switch to polling that for Wells.
 *
 * Note: Until we have actual wells deployed on Mainnet, each dev
 * will have to deploy them locally, thus getting different addresses.
 * To make this easier, we will also load Well addresses from the .env vars.
 * This should go away once we deploy and have real wells in the fork.
 *
 *  */

const localWells = (import.meta.env.VITE_WELLS ?? "").toLowerCase().split(",");

export const WELL_ADDRESSES = [
  // BEAN <> WETH
  // "address",
  ...localWells
];
