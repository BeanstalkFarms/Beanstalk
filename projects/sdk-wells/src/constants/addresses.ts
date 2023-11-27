import { Address } from "@beanstalk/sdk-core";

export const addresses = {
  // Tokens
  BEAN: Address.make("0xbea0000029ad1c77d3d5d23ba2d8893db9d1efab"),
  WETH: Address.make("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"),
  USDC: Address.make("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"),
  DAI: Address.make("0x6b175474e89094c44da98b954eedeac495271d0f"),
  USDT: Address.make("0xdac17f958d2ee523a2206206994597c13d831ec7"),

  // Contracts
  DEPOT: Address.make("0xDEb0f00071497a5cc9b4A6B96068277e57A82Ae2"),
  PIPELINE: Address.make("0xb1bE0000C6B3C62749b5F0c92480146452D15423"),
  WETH9: Address.make("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"),
  JUNCTION: Address.make("0x737cad465b75cdc4c11b3e312eb3fe5bef793d96"),
};
