import { Address } from "@beanstalk/sdk-core";

export const addresses = {
  // Tokens
  BEAN: Address.make("0xbea0000029ad1c77d3d5d23ba2d8893db9d1efab"),
  WETH: Address.make("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"),
  USDC: Address.make("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"),
  DAI: Address.make("0x6b175474e89094c44da98b954eedeac495271d0f"),
  USDT: Address.make("0xdac17f958d2ee523a2206206994597c13d831ec7"),

  // Contracts
  DEPOT: Address.make("0xdeb0f000082fd56c10f449d4f8497682494da84d"),
  PIPELINE: Address.make("0xb1be0000bfdcddc92a8290202830c4ef689dceaa"),
  WETH9: Address.make("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2")
};
