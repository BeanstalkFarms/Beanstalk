import { Address, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { Chop as ChopEntity } from "../../generated/schema";
import { loadFertilizer, loadFertilizerBalance, loadFertilizerToken } from "../entities/Fertilizer";
import { ADDRESS_ZERO } from "../../../subgraph-core/utils/Constants";
import { loadFarmer } from "../entities/Beanstalk";
import { SeedGauge } from "../../generated/Beanstalk-ABIs/SeedGauge";
import { loadUnripeToken, loadWhitelistTokenSetting } from "../entities/Silo";
import { takeUnripeTokenSnapshots } from "../entities/snapshots/UnripeToken";
import { getUnripeUnderlying } from "./Constants";
import { toDecimal } from "../../../subgraph-core/utils/Decimals";
import { getLatestBdv } from "../entities/snapshots/WhitelistTokenSetting";

class ChopParams {
  event: ethereum.Event;
  type: String;
  account: Address;
  unripeToken: Address;
  unripeAmount: BigInt;
  underlyingAmount: BigInt;
}

export function transfer(fertilizer1155: Address, from: Address, to: Address, id: BigInt, amount: BigInt, blockNumber: BigInt): void {
  let fertilizer = loadFertilizer(fertilizer1155);
  let fertilizerToken = loadFertilizerToken(fertilizer, id, blockNumber);
  if (from != ADDRESS_ZERO) {
    let fromFarmer = loadFarmer(from);
    let fromFertilizerBalance = loadFertilizerBalance(fertilizerToken, fromFarmer);
    fromFertilizerBalance.amount = fromFertilizerBalance.amount.minus(amount);
    fromFertilizerBalance.save();
  } else {
    fertilizerToken.supply = fertilizerToken.supply.plus(amount);
    fertilizer.supply = fertilizer.supply.plus(amount);
    fertilizer.save();
    fertilizerToken.save();
  }

  let toFarmer = loadFarmer(to);
  let toFertilizerBalance = loadFertilizerBalance(fertilizerToken, toFarmer);
  toFertilizerBalance.amount = toFertilizerBalance.amount.plus(amount);
  toFertilizerBalance.save();
}

export function unripeChopped(params: ChopParams): void {
  const unripe = loadUnripeToken(params.unripeToken);
  const unripeBdvOne = getLatestBdv(loadWhitelistTokenSetting(Address.fromBytes(unripe.id)))!;
  const underlyingBdvOne = getLatestBdv(loadWhitelistTokenSetting(Address.fromBytes(unripe.underlyingToken)))!;

  let id = params.type + "-" + params.event.transaction.hash.toHexString() + "-" + params.event.transactionLogIndex.toString();
  let chop = new ChopEntity(id);
  chop.farmer = params.account.toHexString();
  chop.unripeToken = unripe.id;
  chop.unripeAmount = params.unripeAmount;
  chop.unripeBdv = params.unripeAmount.times(unripeBdvOne);
  chop.underlyingToken = unripe.underlyingToken;
  chop.underlyingAmount = params.underlyingAmount;
  chop.underlyingBdv = params.underlyingAmount.times(underlyingBdvOne);
  chop.chopRate = unripe.chopRate;
  chop.hash = params.event.transaction.hash.toHexString();
  chop.blockNumber = params.event.block.number;
  chop.createdAt = params.event.block.timestamp;
  chop.save();

  unripe.totalChoppedAmount = unripe.totalChoppedAmount.plus(chop.unripeAmount);
  unripe.totalChoppedBdv = unripe.totalChoppedBdv.plus(chop.unripeBdv);
  unripe.totalChoppedBdvReceived = unripe.totalChoppedBdvReceived.plus(chop.underlyingBdv);
  unripe.save();

  updateUnripeStats(Address.fromBytes(unripe.id), params.event.address, params.event.block);
}

// Update the status for this unripe token using protocol getters. These values fluctuate without related events.
export function updateUnripeStats(unripe: Address, protocol: Address, block: ethereum.Block): void {
  const beanstalk_call = SeedGauge.bind(protocol);
  let unripeToken = loadUnripeToken(unripe);

  // Contract values
  unripeToken.amountUnderlyingOne = beanstalk_call.getUnderlyingPerUnripeToken(unripe);
  unripeToken.choppableAmountOne = beanstalk_call.getPenalty(unripe);
  unripeToken.chopRate = toDecimal(beanstalk_call.getPercentPenalty(unripe));
  unripeToken.recapPercent = toDecimal(beanstalk_call.getRecapFundedPercent(unripe));

  // Further calculated values
  unripeToken.underlyingToken = getUnripeUnderlying(unripe, block.number);
  const underlyingBdvOne = getLatestBdv(loadWhitelistTokenSetting(Address.fromBytes(unripeToken.underlyingToken)))!;
  unripeToken.bdvUnderlyingOne = unripeToken.amountUnderlyingOne.times(underlyingBdvOne);
  unripeToken.choppableBdvOne = unripeToken.choppableAmountOne.times(underlyingBdvOne);

  takeUnripeTokenSnapshots(unripeToken, protocol, block.timestamp);
  unripeToken.save();
}
