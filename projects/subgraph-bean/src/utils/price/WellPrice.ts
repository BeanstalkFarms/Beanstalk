import { Bytes, BigInt, Address, BigDecimal, log } from "@graphprotocol/graph-ts";
import { getTWAPrices, loadOrCreateTwaOracle } from "./TwaOracle";
import { ABDK_toUInt, pow2toX } from "../../../../subgraph-core/utils/ABDKMathQuad";
import { DeltaBAndPrice, TWAType } from "./Types";
import { setPoolTwa } from "../Pool";
import { constantProductPrice } from "./UniswapPrice";
import { ONE_BI, pow, toDecimal, ZERO_BD, ZERO_BI } from "../../../../subgraph-core/utils/Decimals";

// Cumulative Well reserves are abi encoded as a bytes16[]. This decodes into BigInt[] in uint format
export function decodeCumulativeWellReserves(data: Bytes): BigInt[] {
  let dataString = data.toHexString().substring(2);

  let dataStartOffset = <i32>parseInt(dataString.substring(0, <i32>64), 16) * 2;
  let arrayLength = <i32>parseInt(dataString.substring(dataStartOffset, dataStartOffset + <i32>64), 16);
  let cumulativeReserves: BigInt[] = new Array<BigInt>(arrayLength);
  let dataOffset = dataStartOffset + <i32>64;

  for (let i = 0; i < arrayLength; i++) {
    let elementOffset = dataOffset + i * 64;
    let littleEndian = Bytes.fromHexString("0x" + dataString.substring(elementOffset, elementOffset + 32)).reverse();
    let element = BigInt.fromUnsignedBytes(Bytes.fromUint8Array(littleEndian));
    // Convert from ABDK format
    cumulativeReserves[i] = ABDK_toUInt(element);
  }

  return cumulativeReserves;
}

// This gets set from WellOracle event
export function wellCumulativePrices(pool: Address, timestamp: BigInt): BigInt[] {
  let twaOracle = loadOrCreateTwaOracle(pool.toHexString());
  if (twaOracle.lastUpdated != timestamp) {
    // If this becomes an issue, could call into the pump
    throw new Error("Attempted to access updated Well cumulative prices when they were not available.");
  }
  return twaOracle.priceCumulativeLast;
}

export function wellTwaReserves(currentReserves: BigInt[], pastReserves: BigInt[], timeElapsed: BigDecimal): BigInt[] {
  if (pastReserves[0] == ZERO_BI) {
    return [ONE_BI, ONE_BI];
  }
  return [
    pow2toX(new BigDecimal(currentReserves[0].minus(pastReserves[0])).div(timeElapsed)),
    pow2toX(new BigDecimal(currentReserves[1].minus(pastReserves[1])).div(timeElapsed))
  ];
}

export function setWellTwa(wellAddress: string, twaDeltaB: BigInt, timestamp: BigInt, blockNumber: BigInt): void {
  const twaBalances = getTWAPrices(wellAddress, TWAType.WELL_PUMP, timestamp);
  const twaResult = wellTwaDeltaBAndPrice(twaBalances, twaDeltaB);

  setPoolTwa(wellAddress, twaResult, timestamp, blockNumber);
}

function wellTwaDeltaBAndPrice(twaBalances: BigInt[], twaDeltaB: BigInt): DeltaBAndPrice {
  // Use known twaDeltaB to infer the twa eth price
  // This approach of determining price/token2Price is technically "incorrect", in that it is affected
  // by the issue resolved in EBIP-11 https://github.com/BeanstalkFarms/Beanstalk-Governance-Proposals/blob/master/bip/ebip/ebip-11-upgrade-eth-usd-minting-oracle.md
  // However, these were the values reported by the contract at the time, so we use those twa deltas/prices.
  const twaEthPrice = cpToken2PriceFromDeltaB(toDecimal(twaBalances[0]), toDecimal(twaBalances[1], 18), toDecimal(twaDeltaB));

  return {
    deltaB: twaDeltaB,
    price: constantProductPrice(toDecimal(twaBalances[0]), toDecimal(twaBalances[1], 18), twaEthPrice),
    token2Price: twaEthPrice
  };
}

// Calculates the price of the non-bean token in a constant product pool, when only the deltaB is known
function cpToken2PriceFromDeltaB(beanReserves: BigDecimal, token2Reserves: BigDecimal, deltaB: BigDecimal): BigDecimal {
  const constantProduct = beanReserves.times(token2Reserves);
  const token2Price = pow(deltaB.plus(beanReserves), 2).div(constantProduct);
  return token2Price;
}
