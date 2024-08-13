import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import { Chop as ChopEntity } from "../../generated/schema";
import { ChangeUnderlying, Chop } from "../../generated/Beanstalk-ABIs/SeedGauge";
import { TransferSingle, TransferBatch } from "../../generated/Beanstalk-ABIs/Fertilizer";
import { ADDRESS_ZERO } from "../../../subgraph-core/utils/Constants";
import { loadFertilizer, loadFertilizerBalance, loadFertilizerToken } from "../entities/Fertilizer";
import { loadFarmer } from "../entities/Beanstalk";
import { loadUnripeToken } from "../entities/Silo";

export function handleTransferSingle(event: TransferSingle): void {
  handleTransfer(event.address, event.params.from, event.params.to, event.params.id, event.params.value, event.block.number);
}

export function handleTransferBatch(event: TransferBatch): void {
  for (let i = 0; i < event.params.ids.length; i++) {
    let id = event.params.ids[i];
    let amount = event.params.values[i];
    handleTransfer(event.address, event.params.from, event.params.to, id, amount, event.block.number);
  }
}

export function handleChangeUnderlying(event: ChangeUnderlying): void {
  const unripe = loadUnripeToken(event.params.token);
  unripe.totalUnderlying = unripe.totalUnderlying.plus(event.params.underlying);
  // TODO: investigate whether other things need to get calculated, such as recap/bdv/choppable etc.
  // TODO: snapshot here
  unripe.save();
}

export function handleChop(event: Chop): void {
  let id = "chop-" + event.transaction.hash.toHexString() + "-" + event.transactionLogIndex.toString();
  let chop = new ChopEntity(id);
  chop.hash = event.transaction.hash.toHexString();
  chop.logIndex = event.transactionLogIndex.toI32();
  chop.protocol = event.address.toHexString();
  chop.farmer = event.params.account.toHexString();
  chop.unripe = event.params.token.toHexString();
  chop.amount = event.params.amount;
  chop.underlying = event.params.underlying.toHexString();
  chop.blockNumber = event.block.number;
  chop.createdAt = event.block.timestamp;
  chop.save();
}

function handleTransfer(fertilizer1155: Address, from: Address, to: Address, id: BigInt, amount: BigInt, blockNumber: BigInt): void {
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
