import { ethereum } from "@graphprotocol/graph-ts";
// schema imports
import { Transaction } from "../../generated/schema";

export function loadTransaction(eth_transaction: ethereum.Transaction, eth_block: ethereum.Block): Transaction {
  let transaction = Transaction.load(eth_transaction.hash.toHex());
  if (transaction == null) {
    transaction = new Transaction(eth_transaction.hash.toHex());
    transaction.timestamp = eth_block.timestamp;
    transaction.blockNumber = eth_block.number;
    transaction.from = eth_transaction.from;
    transaction.to = eth_transaction.to;
    transaction.save();
  }
  return transaction as Transaction;
}
