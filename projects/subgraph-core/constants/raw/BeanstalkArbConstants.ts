import { Address, BigInt } from "@graphprotocol/graph-ts";

// Protocol tokens
export const BEAN_ERC20 = Address.fromString("0xBEA0005B8599265D41256905A9B3073D397812E4");
export const UNRIPE_BEAN = Address.fromString("0x1BEA054dddBca12889e07B3E076f511Bf1d27543");
export const UNRIPE_LP = Address.fromString("0x1BEA059c3Ea15F6C10be1c53d70C75fD1266D788");
export const BEAN_WETH = Address.fromString("0xBEA00A3F7aaF99476862533Fe7DcA4b50f6158cB");
export const BEAN_WSTETH = Address.fromString("0xBEA0093f626Ce32dd6dA19617ba4e7aA0c3228e8");
export const BEAN_WEETH = Address.fromString("0xBEA00865405A02215B44eaADB853d0d2192Fc29D");
export const BEAN_WBTC = Address.fromString("0xBEA008aC57c2bEfe82E87d1D8Fb9f4784d0B73cA");
export const BEAN_USDC = Address.fromString("0xBEA00dAf62D5549D265c5cA6D6BE87eF17881279");
export const BEAN_USDT = Address.fromString("0xBEA00bE150FEF7560A8ff3C68D07387693Ddfd0b");

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
////// TODO: These are subject to change
export const FERTILIZER = Address.fromString("0x2D5E484Dd7D43dFE32BF1Ed9fE6517b64F13Ea51");
export const BEANSTALK_PRICE = Address.fromString("0xEfE94bE746681ed73DfD15F932f9a8e8ffDdEE56");
//////
export const AQUIFER = Address.fromString("0xBA51AAAa8C2f911AE672e783707Ceb2dA6E97521");

// Milestone
////// TODO: Set this upon deployment
export const RESEED_SEASON = BigInt.fromU32(30000);
export const RESEED_BLOCK = BigInt.fromU32(585858585858);
export const BASIN_BLOCK = BigInt.fromU32(585858585858);
//////
