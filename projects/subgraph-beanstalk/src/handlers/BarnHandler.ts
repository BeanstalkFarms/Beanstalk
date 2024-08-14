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

// TODO: need to handle chop converts, which emit a different event. here are examples.
// When that is done, the chop entity should be abstracted also.
// https://etherscan.io/tx/0x22a568dcdcb52aa3f2d8a7e2d36fe4e9e25246fe2ebf3ebeee0d4096a0d18313
// https://etherscan.io/tx/0xf40a95f6d7731e00806a24aaae3701a6496c482e5f301af9c7f865805836ea10
export function handleChop(event: Chop): void {
  const unripe = loadUnripeToken(event.params.token);
  const unripeBdv = getLatestBdv(loadWhitelistTokenSetting(unripe.id))!;
  const underlyingBdv = getLatestBdv(loadWhitelistTokenSetting(Address.fromString(unripe.underlyingToken)))!;
  unripe.totalChoppedAmount = unripe.totalChoppedAmount.plus(event.params.amount);
  unripe.totalChoppedBdv = unripe.totalChoppedBdv.plus(event.params.amount.times(unripeBdv));
  unripe.totalChoppedBdvReceived = unripe.totalChoppedBdvReceived.plus(event.params.underlying.times(underlyingBdv));
  unripe.save();

  updateUnripeStats(unripe.id, event.address, event.block);

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
