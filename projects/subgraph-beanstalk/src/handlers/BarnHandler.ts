import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import { Chop as ChopEntity } from "../../generated/schema";
import { ChangeUnderlying, Chop } from "../../generated/Beanstalk-ABIs/SeedGauge";
import { TransferSingle, TransferBatch } from "../../generated/Beanstalk-ABIs/Fertilizer";
import { loadUnripeToken, loadWhitelistTokenSetting } from "../entities/Silo";
import { takeUnripeTokenSnapshots } from "../entities/snapshots/UnripeToken";
import { transfer, updateUnripeStats } from "../utils/Barn";
import { getLatestBdv } from "../entities/snapshots/WhitelistTokenSetting";

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
  unripe.save();

  updateUnripeStats(unripe.id, event.address, event.block);
}

export function handleChop(event: Chop): void {
  const unripe = loadUnripeToken(event.params.token);
  const unripeBdvOne = getLatestBdv(loadWhitelistTokenSetting(unripe.id))!;
  const underlyingBdvOne = getLatestBdv(loadWhitelistTokenSetting(unripe.underlyingToken))!;

  let id = "chop-" + event.transaction.hash.toHexString() + "-" + event.transactionLogIndex.toString();
  let chop = new ChopEntity(id);
  chop.farmer = event.params.account.toHexString();
  chop.unripeToken = unripe.id;
  chop.unripeAmount = event.params.amount;
  chop.unripeBdv = event.params.amount.times(unripeBdvOne);
  chop.underlyingToken = unripe.underlyingToken;
  chop.underlyingAmount = event.params.underlying;
  chop.underlyingBdv = event.params.underlying.times(underlyingBdvOne);
  chop.chopRate = unripe.chopRate;
  chop.hash = event.transaction.hash.toHexString();
  chop.blockNumber = event.block.number;
  chop.createdAt = event.block.timestamp;
  chop.save();

  unripe.totalChoppedAmount = unripe.totalChoppedAmount.plus(chop.unripeAmount);
  unripe.totalChoppedBdv = unripe.totalChoppedBdv.plus(chop.unripeBdv);
  unripe.totalChoppedBdvReceived = unripe.totalChoppedBdvReceived.plus(chop.underlyingBdv);
  unripe.save();

  updateUnripeStats(unripe.id, event.address, event.block);
}
