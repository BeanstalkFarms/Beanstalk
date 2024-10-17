import { Address, BigInt } from "@graphprotocol/graph-ts";

// Protocol tokens
export const BEAN_ERC20 = Address.fromString("0xBEA0005B8599265D41256905A9B3073D397812E4");
export const UNRIPE_BEAN = Address.fromString("0x1BEA054dddBca12889e07B3E076f511Bf1d27543");
export const UNRIPE_LP = Address.fromString("0x1BEA059c3Ea15F6C10be1c53d70C75fD1266D788");
export const BEAN_WETH = Address.fromString("0xBeA00Aa8130aCaD047E137ec68693C005f8736Ce");
export const BEAN_WSTETH = Address.fromString("0xBEa00BbE8b5da39a3F57824a1a13Ec2a8848D74F");
export const BEAN_WEETH = Address.fromString("0xBeA00Cc9F93E9a8aC0DFdfF2D64Ba38eb9C2e48c");
export const BEAN_WBTC = Address.fromString("0xBea00DDe4b34ACDcB1a30442bD2B39CA8Be1b09c");
export const BEAN_USDC = Address.fromString("0xBea00ee04D8289aEd04f92EA122a96dC76A91bd7");
export const BEAN_USDT = Address.fromString("0xbEA00fF437ca7E8354B174339643B4d1814bED33");

// External tokens
export const ARB = Address.fromString("0x912CE59144191C1204E64559FE8253a0e49E6548");
export const WETH = Address.fromString("0x82aF49447D8a07e3bd95BD0d56f35241523fBab1");
export const WSTETH = Address.fromString("0x5979D7b546E38E414F7E9822514be443A4800529");
export const WEETH = Address.fromString("0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe");
export const WBTC = Address.fromString("0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f");
export const USDC = Address.fromString("0xaf88d065e77c8cC2239327C5EDb3A432268e5831");
export const USDT = Address.fromString("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9");

// Contracts
export const BEANSTALK = Address.fromString("0xD1A0060ba708BC4BCD3DA6C37EFa8deDF015FB70");
export const FERTILIZER = Address.fromString("0xFEFEFECA5375630d6950F40e564A27f6074845B5");
export const BEANSTALK_PRICE = Address.fromString("0xC218F5a782b0913931DCF502FA2aA959b36Ac9E7");
export const AQUIFER = Address.fromString("0xBA51AAAa8C2f911AE672e783707Ceb2dA6E97521");
export const WELL_CP2 = Address.fromString("0xbA1500c28C8965521f47F17Fc21A7829D6E1343e");
export const WELL_STABLE2 = Address.fromString("0xba150052e11591D0648b17A0E608511874921CBC");
export const WELL_CP2_121 = Address.fromString("0xBA15000450Bf6d48ec50BD6327A9403E401b72b4");
export const WELL_STABLE2_121 = Address.fromString("0xba150052e11591D0648b17A0E608511874921CBC");

// Milestone

// First season to execute on L2
export const RESEED_SEASON = BigInt.fromU32(25130);
export const RESEED_BLOCK = BigInt.fromU64(261772156);

// In practice no wells were deployed for months following Aquifer's initial deployment.
// Therefore there is no need to start indexing from the initial block. The selected block
// number is arbitrary and slightly prior to the reseed.
export const BASIN_BLOCK = BigInt.fromU64(261000000);
