import React from "react";

export type FC<T extends any> = React.FC<React.PropsWithChildren<T>>;

export type Address = `0x${string}`;

export type BasinAPIResponse = {
  ticker_id: `${Address}_${Address}`;
  base_currency: Address;
  target_currency: Address;
  pool_id: Address;
  last_price: number;
  base_volume: number;
  target_volume: number;
  liquidity_in_usd: number;
  high: number;
  low: number;
};

// Primitives
export type MayArray<T> = T | T[];

// Objects
export type AddressMap<T> = Record<string, T>;

/// JSON objects
export type TokenMetadataMap = AddressMap<{
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string;
  displayName?: string;
  displayDecimals?: number;
}>;

