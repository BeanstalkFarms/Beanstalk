import { Address, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { loadFertilizer, loadFertilizerBalance, loadFertilizerToken } from "../entities/Fertilizer";
import { ADDRESS_ZERO } from "../../../subgraph-core/utils/Constants";
import { loadFarmer } from "../entities/Beanstalk";
import { Convert, SeedGauge } from "../../generated/Beanstalk-ABIs/SeedGauge";
import { loadUnripeToken, loadWhitelistTokenSetting } from "../entities/Silo";
import { takeUnripeTokenSnapshots } from "../entities/snapshots/UnripeToken";
import { getUnripeUnderlying } from "./Constants";
import { toDecimal } from "../../../subgraph-core/utils/Decimals";
import { getLatestBdv } from "../entities/snapshots/WhitelistTokenSetting";

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
// TODO: need to handle chop converts, which emit a different event. here are examples.
// When that is done, the chop entity should be abstracted also.
// https://etherscan.io/tx/0x22a568dcdcb52aa3f2d8a7e2d36fe4e9e25246fe2ebf3ebeee0d4096a0d18313
// https://etherscan.io/tx/0xf40a95f6d7731e00806a24aaae3701a6496c482e5f301af9c7f865805836ea10
export function chopConvert(event: Convert): void {
  //
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
  unripeToken.underlyingToken = getUnripeUnderlying(unripe, block.number).toHexString();
  const underlyingBdvOne = getLatestBdv(loadWhitelistTokenSetting(Address.fromString(unripeToken.underlyingToken)))!;
  unripeToken.bdvUnderlyingOne = unripeToken.amountUnderlyingOne.times(underlyingBdvOne);
  unripeToken.choppableBdvOne = unripeToken.choppableAmountOne.times(underlyingBdvOne);

  takeUnripeTokenSnapshots(unripeToken, protocol, block.timestamp);
  unripeToken.save();
}
