import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts"
import {
  UniswapV2Pair,
  Approval,
  Burn,
  Mint,
  Swap,
  Sync,
  Transfer
} from "../generated/BeanUniswapV2Pair/UniswapV2Pair"
import { Pair, Bean, Supply, Price, DayData, HourData, Cross } from "../generated/schema"
import { ADDRESS_ZERO, ZERO_BI, ONE_BI, ZERO_BD, ONE_BD, BI_6, BI_18, convertTokenToDecimal, exponentToBigDecimal } from "./helpers"

let beanAddress = Address.fromString('0xdc59ac4fefa32293a95889dc396682858d52e5db')
let beanPairAddress = Address.fromString('0x87898263b6c5babe34b4ec53f22d98430b91e371')
let usdcPairAddress = Address.fromString('0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc')

export function handleApproval(event: Approval): void {}

export function handleBurn(event: Burn): void {}

export function handleMint(event: Mint): void {}

export function handleSwap(event: Swap): void {}

export function handleSync(event: Sync): void {
  let pair = Pair.load(event.address.toHex())
  if (pair == null) pair = initializePair(event.address)

  pair.reserve0 = convertTokenToDecimal(event.params.reserve0, pair.decimals0)
  pair.reserve1 = convertTokenToDecimal(event.params.reserve1, pair.decimals1)

  pair.save()

  let beanPair = Pair.load(beanPairAddress.toHex())
  let usdcPair = Pair.load(usdcPairAddress.toHex())

  let bean = getBean(event.block.timestamp)
  if (bean.lastCross == ZERO_BI) bean.lastCross = event.block.timestamp

  if (beanPair != null && usdcPair != null) {

    let timestamp = event.block.timestamp.toI32()
    let dayId = timestamp / 86400
    let dayData = getDayData(dayId, bean!)

    let hourId = timestamp / 3600
    let hourData = getHourData(hourId, bean!)

    let price = beanPair.reserve0 / beanPair.reserve1 * usdcPair.reserve0 / usdcPair.reserve1
    if ((bean.price.le(ONE_BD) && price.ge(ONE_BD)) ||
        (bean.price.ge(ONE_BD) && price.le(ONE_BD))) {

        let timestamp = event.block.timestamp.toI32()

        createCross(bean.totalCrosses, timestamp, bean.lastCross.toI32(), dayData.id, hourData.id, price.ge(ONE_BD))
        // dayData = updateDayDataWithCross(bean!, dayData, timestamp)
        // hourData = updateHourDataWithCross(bean!, hourData!, timestamp)
        
        hourData.newCrosses = hourData.newCrosses + 1
        hourData.totalCrosses = hourData.totalCrosses + 1

        dayData.newCrosses = dayData.newCrosses + 1
        dayData.totalCrosses = dayData.totalCrosses + 1
        
        bean.totalCrosses = bean.totalCrosses + 1

        let timeSinceLastCross = event.block.timestamp.minus(bean.lastCross)
        hourData.totalTimeSinceCross = hourData.totalTimeSinceCross.plus(timeSinceLastCross)
        dayData.totalTimeSinceCross = hourData.totalTimeSinceCross.plus(timeSinceLastCross)
        bean.totalTimeSinceCross = bean.totalTimeSinceCross.plus(timeSinceLastCross)

        bean.lastCross = event.block.timestamp
    }
    bean.price = price
    bean.save()

    let priceId = event.block.timestamp.toString()
    let timestampPrice = Price.load(priceId)
    if (timestampPrice === null) {
      timestampPrice = new Price(priceId)
      timestampPrice.bean = bean.id
      timestampPrice.timestamp = event.block.timestamp
      timestampPrice.price = bean.price
    }
    timestampPrice.save()

    dayData.price = bean.price
    dayData.save()

    hourData.price = bean.price
    hourData.save()
  }

}

export function handleTransfer(event: Transfer): void {

  if(event.address.toHexString() != beanAddress.toHexString()) return

  if (event.params.from.toHexString() == ADDRESS_ZERO || event.params.to.toHexString() == ADDRESS_ZERO) {
    let bean = getBean(event.block.timestamp)

    let value = convertTokenToDecimal(event.params.value, BI_6)

    if (event.params.from.toHexString() == ADDRESS_ZERO) bean.totalSupply = bean.totalSupply.plus(value)
    else if (event.params.to.toHexString() == ADDRESS_ZERO) bean.totalSupply = bean.totalSupply.minus(value)

    bean.totalSupplyUSD = bean.totalSupply.times(bean.price)

    bean.save()

    let supplyId = event.block.timestamp.toString()
    let supply = Supply.load(supplyId)
    if (supply === null) {
      supply = new Supply(supplyId)
      supply.bean = bean.id
      supply.timestamp = event.block.timestamp
    }
    supply.totalSupply = bean.totalSupply
    supply.totalSupplyUSD = bean.totalSupplyUSD
    supply.save()

    let timestamp = event.block.timestamp.toI32()

    let dayId = timestamp / 86400
    let dayData = DayData.load(dayId.toString())
    if (dayData === null) dayData = initializeDayData(dayId, bean!)
    dayData.totalSupply = bean.totalSupply
    dayData.totalSupplyUSD = bean.totalSupplyUSD
    dayData.save()

    let hourId = timestamp / 3600
    let hourData = HourData.load(hourId.toString())
    if (hourData === null) hourData = initializeHourData(hourId, bean!)
    hourData.totalSupply = bean.totalSupply
    hourData.totalSupplyUSD = bean.totalSupplyUSD
    hourData.save()
  }
}

function initializePair(address: Address): Pair {
  let pair = new Pair(address.toHex())
  if (address.toHexString() == beanPairAddress.toHexString()) {
    pair.decimals0 = BI_18
    pair.decimals1 = BI_6
  } else {
    pair.decimals1 = BI_18
    pair.decimals0 = BI_6
  }
  return pair
}

function getBean(timestamp: BigInt) : Bean {
  let bean = Bean.load(beanAddress.toHex())
  if (bean == null) return initializeBean(timestamp)
  return bean as Bean!
}

function initializeBean(timestamp: BigInt) : Bean {
  let bean = new Bean(beanAddress.toHex())
  bean.decimals = BI_6
  bean.lastCross = timestamp
  bean.price = ZERO_BD
  bean.totalSupply = ZERO_BD
  bean.totalSupplyUSD = ZERO_BD
  bean.totalCrosses = 0
  bean.totalTimeSinceCross = ZERO_BI
  bean.startTime = timestamp.toI32()
  return bean
}

function getDayData(dayId : i32, bean : Bean) : DayData {
  let dayData = DayData.load(dayId.toString())
  if (dayData === null) dayData = initializeDayData(dayId, bean!)
  return dayData as DayData!
}

function initializeDayData(dayId : i32, bean : Bean) : DayData {
  let dayStartTimestamp = dayId * 86400
  let dayData = new DayData(dayId.toString())
  dayData.bean = bean.id
  dayData.dayTimestamp = dayStartTimestamp
  dayData.totalSupply = bean.totalSupply
  dayData.totalSupplyUSD = bean.totalSupplyUSD
  dayData.price = bean.price
  dayData.newCrosses = 0
  dayData.totalCrosses = bean.totalCrosses
  dayData.totalTimeSinceCross = bean.totalTimeSinceCross
  let previousDayId = dayId - 1
  // let lastDayData = DayData.load(previousDayId.toString())
  // if (lastDayData != null) {
  //   lastDayData = updateDayDataWithCross(bean!, lastDayData!, dayStartTimestamp)
  //   dayData.averageTime7Day = lastDayData.averageTime7Day
  //   dayData.averageTime30Day = lastDayData.averageTime30Day
  //   lastDayData.save()
  // } else {
  //   dayData.averageTime7Day = 0
  //   dayData.averageTime30Day = 0

  // }
  return dayData
}

function getHourData(hourId: i32, bean: Bean) : HourData {
  let hourData = HourData.load(hourId.toString())
  if (hourData === null) hourData = initializeHourData(hourId, bean!)
  return hourData as HourData!
}

function initializeHourData(hourId : i32, bean : Bean) : HourData {
  let hourStartTimestamp = hourId * 3600
  let hourData = new HourData(hourId.toString())
  hourData.bean = bean.id
  hourData.hourTimestamp = hourStartTimestamp
  hourData.totalSupply = bean.totalSupply
  hourData.totalSupplyUSD = bean.totalSupplyUSD
  hourData.price = bean.price
  hourData.newCrosses = 0
  hourData.totalCrosses = bean.totalCrosses
  hourData.totalTimeSinceCross = bean.totalTimeSinceCross
  let previousHourId = hourId - 1
  // let lastHourData = HourData.load((previousHourId).toString())
  // if (lastHourData != null) {
  //   lastHourData = updateHourDataWithCross(bean!, lastHourData!, hourStartTimestamp)
  //   hourData.averageTime7Day = lastHourData.averageTime7Day
  //   hourData.averageTime30Day = lastHourData.averageTime30Day
  //   lastHourData.save()
  // } else {
  //   hourData.averageTime7Day = 0
  //   hourData.averageTime30Day = 0
  // }

  return hourData
}

function createCross(id: i32, timestamp: i32, lastCross: i32, dayData: string, hourData: string, crossAbove: bool): void {
  let cross = new Cross(id.toString())
  cross.timestamp = timestamp
  cross.timeSinceLastCross = timestamp - lastCross
  cross.above = crossAbove
  cross.dayData = dayData
  cross.hourData = hourData
  cross.save()
}

function updateDayDataWithCross(bean: Bean, dayData: DayData, timestamp: i32): DayData { 
  let dayId = parseInt(dayData.id)
  let previousDayId = dayId - 7
  let pastDayData = DayData.load((previousDayId).toString())
  if (pastDayData == null) dayData.averageTime7Day = getAverageTime(bean.startTime, timestamp, 0, dayData.totalCrosses);
  else dayData.averageTime7Day = getDayAverageTime(pastDayData!, dayData.totalCrosses, timestamp);
  previousDayId = dayId - 30
  pastDayData = DayData.load((previousDayId).toString())
  if (pastDayData == null) dayData.averageTime30Day = getAverageTime(bean.startTime, timestamp, 0, dayData.totalCrosses);
  else dayData.averageTime30Day = getDayAverageTime(pastDayData!, dayData.totalCrosses, timestamp);
  return dayData;
}

function updateHourDataWithCross(bean: Bean, hourData: HourData, timestamp: i32): HourData {
  let hourId = parseInt(hourData.id)
  let previousHourId = hourId - 168
  let pastHourData = HourData.load((previousHourId).toString())
  if (pastHourData == null) hourData.averageTime7Day = getAverageTime(bean.startTime, timestamp, 0, hourData.totalCrosses);
  else hourData.averageTime7Day = getHourAverageTime(pastHourData!, hourData.totalCrosses, timestamp);
  
  previousHourId = hourId - 720
  pastHourData = HourData.load((previousHourId).toString())
  if (pastHourData == null) hourData.averageTime30Day = getAverageTime(bean.startTime, timestamp, 0, hourData.totalCrosses);
  else hourData.averageTime30Day = getHourAverageTime(pastHourData!, hourData.totalCrosses, timestamp);
  return hourData;
}

function getHourAverageTime(ph: HourData, crosses: i32, timestamp: i32): i32 {
  let prevTimestamp = ph.hourTimestamp + 3600
  return getAverageTime(prevTimestamp, timestamp, ph.totalCrosses, crosses)
}

function getDayAverageTime(ph: DayData, crosses: i32, timestamp: i32): i32 {
  let prevTimestamp = ph.dayTimestamp + 86400
  return getAverageTime(prevTimestamp, timestamp, ph.totalCrosses, crosses)
}

function getAverageTime(pt: i32, nt: i32, pc: i32, nc: i32): i32 {
  if (nc == pc) return 0;
  return (nt - pt) / (nc - pc);
}