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

// Other Constants
export const BEAN_DECIMALS = 6;

export const INITIAL_HUMIDITY = BigDecimal.fromString("500");
export const MIN_HUMIDITY = BigDecimal.fromString("500");
export const DELTA_HUMIDITY = BigDecimal.fromString("0.5");
