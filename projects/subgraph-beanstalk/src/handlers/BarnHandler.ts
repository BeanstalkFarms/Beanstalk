import { Address, log } from "@graphprotocol/graph-ts";
import { ChangeUnderlying, Chop } from "../../generated/Beanstalk-ABIs/Reseed";
import { TransferSingle, TransferBatch } from "../../generated/Beanstalk-ABIs/Fertilizer";
import { loadUnripeToken } from "../entities/Silo";
import { transfer, unripeChopped, updateUnripeStats } from "../utils/Barn";

export function handleTransferSingle(event: TransferSingle): void {
  transfer(event.address, event.params.from, event.params.to, event.params.id, event.params.value);
}

export function handleTransferBatch(event: TransferBatch): void {
  for (let i = 0; i < event.params.ids.length; i++) {
    let id = event.params.ids[i];
    let amount = event.params.values[i];
    transfer(event.address, event.params.from, event.params.to, id, amount);
  }
}

export function handleChangeUnderlying(event: ChangeUnderlying): void {
  const unripe = loadUnripeToken(event.params.token);
  unripe.totalUnderlying = unripe.totalUnderlying.plus(event.params.underlying);
  unripe.save();

  updateUnripeStats(Address.fromBytes(unripe.id), event.address, event.block);
}

export function handleChop(event: Chop): void {
  unripeChopped({
    event,
    type: "chop",
    account: event.params.account,
    unripeToken: event.params.token,
    unripeAmount: event.params.amount,
    underlyingAmount: event.params.underlying
  });
}
