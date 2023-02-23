import { PlotTransfer } from "../../generated/Field/Beanstalk";
import { PodTransfer } from "../../generated/schema";

export function savePodTransfer(event: PlotTransfer): void {
  let id = "podtransfer" + "-" + event.transaction.hash.toHexString() + "-" + event.transactionLogIndex.toString();
  let transfer = new PodTransfer(id);
  transfer.hash = event.transaction.hash.toHexString();
  transfer.logIndex = event.transactionLogIndex.toI32();
  transfer.protocol = event.address.toHexString();
  transfer.to = event.params.to.toHexString();
  transfer.from = event.params.from.toHexString();
  transfer.index = event.params.id;
  transfer.pods = event.params.pods;
  transfer.blockNumber = event.block.number;
  transfer.createdAt = event.block.timestamp;
  transfer.save();
}
