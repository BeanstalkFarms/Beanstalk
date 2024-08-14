import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import { loadFertilizer, loadFertilizerBalance, loadFertilizerToken } from "../entities/Fertilizer";
import { ADDRESS_ZERO } from "../../../subgraph-core/utils/Constants";
import { loadFarmer } from "../entities/Beanstalk";

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
