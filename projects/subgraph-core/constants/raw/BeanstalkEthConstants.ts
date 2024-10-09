import { Address, BigInt } from "@graphprotocol/graph-ts";

// Token Addresses
export const BEAN_ERC20_V1 = Address.fromString("0xDC59ac4FeFa32293A95889Dc396682858d52e5Db");
export const BEAN_ERC20 = Address.fromString("0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab");
export const UNRIPE_BEAN = Address.fromString("0x1bea0050e63e05fbb5d8ba2f10cf5800b6224449");
export const UNRIPE_LP = Address.fromString("0x1BEA3CcD22F4EBd3d37d731BA31Eeca95713716D");
export const BEAN_3CRV = Address.fromString("0xc9C32cd16Bf7eFB85Ff14e0c8603cc90F6F2eE49");
export const BEANSTALK_FARMS = Address.fromString("0x21de18b6a8f78ede6d16c50a167f6b222dc08df7");
export const WETH = Address.fromString("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
export const LUSD = Address.fromString("0x5f98805A4E8be255a32880FDeC7F6728C6568bA0");
export const WSTETH = Address.fromString("0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0");

// Protocol Addresses
export const BEANSTALK = Address.fromString("0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5");
export const FERTILIZER = Address.fromString("0x402c84De2Ce49aF88f5e2eF3710ff89bFED36cB6");
export const AQUIFER = Address.fromString("0xBA51AAAA95aeEFc1292515b36D86C51dC7877773");

export const CURVE_PRICE = Address.fromString("0xA57289161FF18D67A68841922264B317170b0b81");
export const BEANSTALK_PRICE_1 = Address.fromString("0xb01CE0008CaD90104651d6A84b6B11e182a9B62A");
export const BEANSTALK_PRICE_2 = Address.fromString("0x4bed6cb142b7d474242d87f4796387deb9e1e1b4");
export const CALCULATIONS_CURVE = Address.fromString("0x25BF7b72815476Dd515044F9650Bf79bAd0Df655");

export const WELL_CP2_1_0 = Address.fromString("0xBA510C20FD2c52E4cb0d23CFC3cCD092F9165a6E");
export const WELL_CP2_1_1 = Address.fromString("0xBA150C2ae0f8450D4B832beeFa3338d4b5982d26");

// LP Addresses
export const BEAN_3CRV_V1 = Address.fromString("0x3a70DfA7d2262988064A2D051dd47521E43c9BdD");
export const CRV3_TOKEN = Address.fromString("0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490");
export const CRV3_POOL = Address.fromString("0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7");
export const BEAN_WETH_V1 = Address.fromString("0x87898263B6C5BABe34b4ec53F22d98430b91e371");
export const WETH_USDC_PAIR = Address.fromString("0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc");
export const BEAN_LUSD_V1 = Address.fromString("0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D");
export const LUSD_3POOL = Address.fromString("0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA");
export const BEAN_WETH_CP2_WELL = Address.fromString("0xBEA0e11282e2bB5893bEcE110cF199501e872bAd");
export const BEAN_WSTETH_CP2_WELL = Address.fromString("0xBeA0000113B0d182f4064C86B71c315389E4715D");

export const REPLANT_SEASON = BigInt.fromU32(6075);

// Milestone blocks
export const BEANSTALK_BLOCK = BigInt.fromU32(12974075);
export const EXPLOIT_BLOCK = BigInt.fromU32(14602790);
export const NEW_BEAN_TOKEN_BLOCK = BigInt.fromU32(15278082);
export const REPLANT_BLOCK = BigInt.fromU32(15278963);
export const REPLANT_SUNRISE_BLOCK = BigInt.fromU32(15289934);
export const BASIN_BLOCK = BigInt.fromU32(17977922);
export const GAUGE_BIP45_BLOCK = BigInt.fromU32(19927634);
// End of Beanstalk on L1, except for farm balances.
export const RESEED_PAUSE_BLOCK = BigInt.fromU32(20921738);

export const BEAN_WETH_CP2_WELL_BLOCK = BigInt.fromU32(17978134);
export const BEAN_WSTETH_CP2_WELL_BLOCK = BigInt.fromU32(20264128);

export const BEAN_WETH_UNRIPE_MIGRATION_BLOCK = BigInt.fromU32(18392690);
export const BEAN_WSTETH_UNRIPE_MIGRATION_BLOCK = BigInt.fromU32(20389706);

export const PRICE_1_BLOCK = BigInt.fromU32(17978222);
export const PRICE_2_BLOCK = BigInt.fromU32(20298142);
