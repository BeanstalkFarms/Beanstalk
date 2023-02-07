import { Address, BigInt } from "@graphprotocol/graph-ts"

export const WELL_ENTITY_TYPE = "Well"
export const SWAP_ENTITY_TYPE = "Swap"
export const ACCOUNT_ENTITY_TYPE = "Account"
export const DEPOSIT_ENTITY_TYPE = "Deposit"
export const WITHDRAW_ENTITY_TYPE = "Withdraw"
export const POSITION_ENTITY_TYPE = "Position"

export const WELL = Address.fromString('0x90767D012E17F8d1D2f7a257ECB951db703D7b3D')
export const AQUIFER = Address.fromString('0xF6a8aD553b265405526030c2102fda2bDcdDC177')
export const AUGER = Address.fromString('0x09120eAED8e4cD86D85a616680151DAA653880F2')
export const WELL_FUNCTION = Address.fromString('0x3E661784267F128e5f706De17Fac1Fc1c9d56f30')
export const PUMP = Address.fromString('0x6732128F9cc0c4344b2d4DC6285BCd516b7E59E6')

export const BEAN_SWAP_AMOUNT = BigInt.fromI32(130 * (10 ** 6))
export const WETH_SWAP_AMOUNT = BigInt.fromI64(<i64>(0.1 * (10 ** 18)))
export const WELL_LP_AMOUNT = BigInt.fromI64(<i64>(10 * (10 ** 18)))

export const SWAP_ACCOUNT = Address.fromString('0x1234567890abcdef1234567890abcdef12345678')

export const POSITION_ID = SWAP_ACCOUNT.toHexString() + '-' + WELL.toHexString()
