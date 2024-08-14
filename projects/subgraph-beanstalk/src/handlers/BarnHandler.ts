import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import { Chop as ChopEntity } from "../../generated/schema";
import { ChangeUnderlying, Chop } from "../../generated/Beanstalk-ABIs/SeedGauge";
import { TransferSingle, TransferBatch } from "../../generated/Beanstalk-ABIs/Fertilizer";
import { loadUnripeToken } from "../entities/Silo";
import { takeUnripeTokenSnapshots } from "../entities/snapshots/UnripeToken";
import { transfer, updateUnripeStats } from "../utils/Barn";

export function handleTransferSingle(event: TransferSingle): void {
  transfer(event.address, event.params.from, event.params.to, event.params.id, event.params.value, event.block.number);
}

export function handleTransferBatch(event: TransferBatch): void {
  for (let i = 0; i < event.params.ids.length; i++) {
    let id = event.params.ids[i];
    let amount = event.params.values[i];
    transfer(event.address, event.params.from, event.params.to, id, amount, event.block.number);
  }
}

export function handleChangeUnderlying(event: ChangeUnderlying): void {
  const unripe = loadUnripeToken(event.params.token);
  unripe.totalUnderlying = unripe.totalUnderlying.plus(event.params.underlying);
  // Snapshots are taken in the below method, updateUnripeStats
  unripe.save();

  // Update other stats using protocol getters
  updateUnripeStats(unripe.id, event.address, event.block);
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
