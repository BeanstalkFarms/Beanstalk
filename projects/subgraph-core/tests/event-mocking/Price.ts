import { BigInt, ethereum, Address } from "@graphprotocol/graph-ts";
import { createMockedFunction } from "matchstick-as/assembly/index";
import { BEAN_3CRV, BEAN_ERC20, BEAN_WETH_CP2_WELL, BEANSTALK_PRICE, CURVE_PRICE, WETH } from "../../utils/Constants";

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
