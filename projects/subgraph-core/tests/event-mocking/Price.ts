import { BigInt, BigDecimal, ethereum, Address, log } from "@graphprotocol/graph-ts";
import { createMockedFunction } from "matchstick-as/assembly/index";
import {
  BEAN_3CRV,
  BEAN_ERC20,
  BEAN_WETH_CP2_WELL,
  BEAN_WETH_V1,
  BEANSTALK_PRICE,
  CURVE_PRICE,
  WETH,
  WETH_USDC_PAIR
} from "../../utils/Constants";
import { BD_10, BI_10, pow, toDecimal, ZERO_BI } from "../../utils/Decimals";

// These 2 classes are analagous to structs used by BeanstalkPrice contract
class Prices {
  price: BigInt;
  liquidity: BigInt;
  deltaB: BigInt;
  ps: Pool[];
}

class Pool {
  contract: Address;
  tokens: Address[];
  balances: BigInt[];
  price: BigInt;
  liquidity: BigInt;
  deltaB: BigInt;
  lpUsd: BigInt;
  lpBdv: BigInt;
}

/**
 * Mocks the return values from BeanstalkPrice contract
 * @param prices - the Prices struct that the contract will return
 * @param mockPools - when true, mocks the return values from the individual pools' price call also
 */
export function setMockBeanPrice(prices: Prices, mockPools: boolean = true): void {
  const pricesReturn = toPricesStruct(prices);

  createMockedFunction(
    BEANSTALK_PRICE,
    "price",
    "price():((uint256,uint256,int256,(address,address[2],uint256[2],uint256,uint256,int256,uint256,uint256)[]))"
  )
    // @ts-expect-error:2322
    .returns([ethereum.Value.fromTuple(pricesReturn)]);

  if (mockPools) {
    for (let i = 0; i < prices.ps.length; ++i) {
      if (prices.ps[i].contract == BEAN_3CRV) {
        setMockCurvePrice(prices.ps[i]);
      } else {
        setMockWellPrice(prices.ps[i]);
      }
    }
  }
}

export function setMockCurvePrice(pool: Pool): void {
  const curvePriceReturn = toPoolStruct(pool);

  createMockedFunction(CURVE_PRICE, "getCurve", "getCurve():((address,address[2],uint256[2],uint256,uint256,int256,uint256,uint256))")
    .withArgs([])
    .returns([ethereum.Value.fromTuple(curvePriceReturn)]);
}

export function setMockWellPrice(pool: Pool): void {
  const wellPriceReturn = toPoolStruct(pool);

  createMockedFunction(
    BEANSTALK_PRICE,
    "getConstantProductWell",
    "getConstantProductWell(address):((address,address[2],uint256[2],uint256,uint256,int256,uint256,uint256))"
  )
    .withArgs([ethereum.Value.fromAddress(pool.contract)])
    .returns([ethereum.Value.fromTuple(wellPriceReturn)]);
}

const price = (p: number): BigInt => BigInt.fromU32(<u32>(p * Math.pow(10, 6)));

export const simpleMockPrice = (overall: number, beanEth: number): void => {
  setMockBeanPrice({
    price: price(overall),
    liquidity: BigInt.zero(),
    deltaB: BigInt.zero(),
    ps: [
      {
        contract: BEAN_WETH_CP2_WELL,
        tokens: [BEAN_ERC20, WETH],
        balances: [BigInt.fromString("10"), BigInt.fromString("10")],
        price: price(beanEth),
        liquidity: BigInt.fromString("10"),
        deltaB: BigInt.fromString("10"),
        lpUsd: BigInt.fromString("10"),
        lpBdv: BigInt.fromString("10")
      }
    ]
  });
};

function toPricesStruct(prices: Prices): ethereum.Tuple {
  let retval = new ethereum.Tuple();

  retval.push(ethereum.Value.fromUnsignedBigInt(prices.price));
  retval.push(ethereum.Value.fromUnsignedBigInt(prices.liquidity));
  retval.push(ethereum.Value.fromSignedBigInt(prices.deltaB));

  const pools: ethereum.Tuple[] = [];
  for (let i = 0; i < prices.ps.length; ++i) {
    pools.push(toPoolStruct(prices.ps[i]));
  }
  retval.push(ethereum.Value.fromTupleArray(pools));

  return retval;
}

function toPoolStruct(pool: Pool): ethereum.Tuple {
  const ethereumTokens: ethereum.Value[] = [];
  for (let i = 0; i < pool.tokens.length; ++i) {
    ethereumTokens.push(ethereum.Value.fromAddress(pool.tokens[i]));
  }

  let retval = new ethereum.Tuple();

  retval.push(ethereum.Value.fromAddress(pool.contract));
  retval.push(ethereum.Value.fromArray(ethereumTokens));
  retval.push(ethereum.Value.fromUnsignedBigIntArray(pool.balances));
  retval.push(ethereum.Value.fromUnsignedBigInt(pool.price));
  retval.push(ethereum.Value.fromUnsignedBigInt(pool.liquidity));
  retval.push(ethereum.Value.fromSignedBigInt(pool.deltaB));
  retval.push(ethereum.Value.fromUnsignedBigInt(pool.lpUsd));
  retval.push(ethereum.Value.fromUnsignedBigInt(pool.lpBdv));

  return retval;
}

export function mockPreReplantBeanEthPriceAndLiquidity(
  price: BigDecimal,
  liquidity: BigDecimal = BigDecimal.fromString("5000000")
): BigInt[] {
  // Fix eth to $3000
  const ethPrice = BigDecimal.fromString("3000");
  mockPreReplantETHPrice(ethPrice);

  // price = wethReserves.times(wethPrice).div(beanReserves)

  // Fix weth reserves according to requested liquidity
  const wethReserves = BigInt.fromString(
    liquidity.div(ethPrice).div(BigDecimal.fromString("2")).times(pow(BD_10, 18)).truncate(0).toString()
  );
  const beanReserves = BigInt.fromString(
    toDecimal(wethReserves, 18).times(ethPrice).div(price).times(BigDecimal.fromString("1000000")).truncate(0).toString()
  );
  mockUniswapV2Reserves(BEAN_WETH_V1, wethReserves, beanReserves);
  return [wethReserves, beanReserves];
}

export function mockPreReplantETHPrice(price: BigDecimal): void {
  // price = toDecimal(reserves[0]).div(toDecimal(reserves[1], 18));
  // Fix reserves[1] as 100k weth.
  const wethReserves = BigInt.fromI32(100000).times(BI_10.pow(18));
  const usdcReserves = BigInt.fromString(
    price.times(toDecimal(wethReserves, 18)).times(BigDecimal.fromString("1000000")).truncate(0).toString()
  );
  mockUniswapV2Reserves(WETH_USDC_PAIR, usdcReserves, wethReserves);
}

export function mockUniswapV2Reserves(contract: Address, reserve0: BigInt, reserve1: BigInt): void {
  createMockedFunction(contract, "getReserves", "getReserves():(uint112,uint112,uint32)")
    .withArgs([])
    // Ignoring third return value (last updated time?) for now
    .returns([ethereum.Value.fromUnsignedBigInt(reserve0), ethereum.Value.fromUnsignedBigInt(reserve1), ethereum.Value.fromI32(0)]);
}
