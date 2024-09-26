import { Address, BigDecimal, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { dayFromTimestamp, hourFromTimestamp } from "../../../subgraph-core/utils/Dates";
import { BI_10, emptyBigDecimalArray, getBigDecimalArrayTotal, ONE_BI, toDecimal, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { loadWell, takeWellDailySnapshot, takeWellHourlySnapshot } from "../entities/Well";
import { getTokenDecimals, updateTokenUSD } from "./Token";
import { getProtocolToken, isStable2WellFn, wellFnSupportsRate } from "../../../subgraph-core/constants/RuntimeConstants";
import { v } from "./constants/Version";
import { loadToken } from "../entities/Token";
import { Well } from "../../generated/schema";
import { WellFunction } from "../../generated/Basin-ABIs/WellFunction";
import { toAddress } from "../../../subgraph-core/utils/Bytes";
import { calcRates } from "./legacy/CP2";

export function getCalculatedReserveUSDValues(tokens: Bytes[], reserves: BigInt[]): BigDecimal[] {
  let results = emptyBigDecimalArray(tokens.length);
  for (let i = 0; i < tokens.length; i++) {
    let token = loadToken(toAddress(tokens[i]));
    results[i] = toDecimal(reserves[i], token.decimals).times(token.lastPriceUSD);
  }
  return results;
}

export function updateWellTokenUSDPrices(wellAddress: Address, blockNumber: BigInt): void {
  let well = loadWell(wellAddress);

  // Update the BEAN price first as it is the reference for other USD calculations
  const beanToken = getProtocolToken(v(), blockNumber);
  updateTokenUSD(beanToken, blockNumber, BigDecimal.fromString("1"));
  let beanIndex = well.tokens.indexOf(beanToken);
  // Curretly only supporting USD values for Wells with BEAN as a token.
  if (beanIndex == -1) {
    return;
  }
  let currentBeans = toDecimal(well.reserves[beanIndex]);

  for (let i = 0; i < well.tokens.length; i++) {
    if (i == beanIndex) {
      continue;
    }
    let tokenAddress = toAddress(well.tokens[i]);
    if (well.reserves[i].gt(ZERO_BI)) {
      updateTokenUSD(tokenAddress, blockNumber, currentBeans.div(toDecimal(well.reserves[i], getTokenDecimals(tokenAddress))));
    }
  }

  well.reservesUSD = getCalculatedReserveUSDValues(well.tokens, well.reserves);
  well.totalLiquidityUSD = getBigDecimalArrayTotal(well.reservesUSD);
  well.save();
}

export function getTokenPrices(well: Well): BigInt[] {
  const wellFn = well.wellFunction.load()[0];
  const wellFnAddress = toAddress(wellFn.target);
  const wellFnContract = WellFunction.bind(wellFnAddress);

  let rates: BigInt[] = [];
  if (wellFnSupportsRate(v(), wellFnAddress)) {
    rates = [
      wellFnContract.calcRate(well.reserves, ZERO_BI, ONE_BI, wellFn.data),
      wellFnContract.calcRate(well.reserves, ONE_BI, ZERO_BI, wellFn.data)
    ];
    // Stable2 does not require transforming rates. Otherwise, the rates are given with this precision:
    // quoteToken + 18 - baseToken
    if (!isStable2WellFn(v(), wellFnAddress)) {
      const decimalsToRemove = [18 - getTokenDecimals(toAddress(well.tokens[1])), 18 - getTokenDecimals(toAddress(well.tokens[0]))];
      rates[0] = rates[0].div(BI_10.pow(<u8>decimalsToRemove[0]));
      rates[1] = rates[1].div(BI_10.pow(<u8>decimalsToRemove[1]));
    }
  } else {
    // In practice only the original constant product well does not support calcRate
    rates = calcRates(well.reserves, [getTokenDecimals(toAddress(well.tokens[0])), getTokenDecimals(toAddress(well.tokens[1]))]);
  }
  return rates;
}

export function checkForSnapshot(wellAddress: Address, block: ethereum.Block): void {
  // We check for the prior period snapshot and then take one if needed
  // Schedule the "day" to begin at 9am PT/12pm ET.
  // Future work could include properly adjusting this when DST occurs.
  let dayID = dayFromTimestamp(block.timestamp, 8 * 60 * 60) - 1;
  let hourID = hourFromTimestamp(block.timestamp) - 1;

  let well = loadWell(wellAddress);

  if (dayID > well.lastSnapshotDayID) {
    takeWellDailySnapshot(wellAddress, dayID, block);
  }
  if (hourID > well.lastSnapshotHourID) {
    takeWellHourlySnapshot(wellAddress, hourID, block);
  }
}
