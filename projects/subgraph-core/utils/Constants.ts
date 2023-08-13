import { Address, BigDecimal } from "@graphprotocol/graph-ts";

// Standard Addresses
export const ADDRESS_ZERO = Address.fromString("0x0000000000000000000000000000000000000000");

// Token Addresses
export const BEAN_ERC20_V1 = Address.fromString("0xDC59ac4FeFa32293A95889Dc396682858d52e5Db");
export const BEAN_ERC20 = Address.fromString("0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab");
export const UNRIPE_BEAN = Address.fromString("0x1bea0050e63e05fbb5d8ba2f10cf5800b6224449");
export const BEAN_3CRV = Address.fromString("0xc9C32cd16Bf7eFB85Ff14e0c8603cc90F6F2eE49");
export const UNRIPE_BEAN_3CRV = Address.fromString("0x1BEA3CcD22F4EBd3d37d731BA31Eeca95713716D");
export const BEANSTALK_FARMS = Address.fromString("0x21de18b6a8f78ede6d16c50a167f6b222dc08df7");
export const WETH = Address.fromString("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");

// Protocol Addresses
export const BEANSTALK = Address.fromString("0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5");
export const CURVE_PRICE = Address.fromString("0xA57289161FF18D67A68841922264B317170b0b81");
export const FERTILIZER = Address.fromString("0x402c84De2Ce49aF88f5e2eF3710ff89bFED36cB6");
export const AQUIFER = Address.fromString("0xF6a8aD553b265405526030c2102fda2bDcdDC177");

// LP Addresses
export const BEAN_3CRV_V1 = Address.fromString("0x3a70DfA7d2262988064A2D051dd47521E43c9BdD");
export const CRV3_POOL_V1 = Address.fromString("0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490");
export const CRV3_POOL = Address.fromString("0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7");
export const BEAN_WETH_V1 = Address.fromString("0x87898263B6C5BABe34b4ec53F22d98430b91e371");
export const WETH_USDC_PAIR = Address.fromString("0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc");
export const BEAN_LUSD_V1 = Address.fromString("0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D");
export const LUSD_3POOL = Address.fromString("0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA");
export const BEAN_WETH_CP2_WELL = Address.fromString("0xBEA0e11282e2bB5893bEcE110cF199501e872bAd");

// Other Constants
export const BEAN_DECIMALS = 6;

export const INITIAL_HUMIDITY = BigDecimal.fromString("500");
export const MIN_HUMIDITY = BigDecimal.fromString("500");
export const DELTA_HUMIDITY = BigDecimal.fromString("0.5");

export const CALCULATIONS_CURVE = Address.fromString("0x25BF7b72815476Dd515044F9650Bf79bAd0Df655");
