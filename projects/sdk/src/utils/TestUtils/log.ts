import { ethers } from "ethers";
import { TokenSiloBalance } from "src/index";

export const logSiloBalance = (address: string, balance: TokenSiloBalance) => {
  console.log(`Address ${address} has ${balance.amount.toHuman()} BEAN deposited in the Silo.`);
  balance.deposits.forEach((crate, i) => console.log(`  | ${i}: ${crate.stem.toString()} = ${crate.amount.toString()}`));
};

export class Logger {
  static printLogs(desc: ethers.utils.LogDescription) {
    Object.entries(desc.args).forEach(([k, v], i) => {
      if (!parseInt(k) && parseInt(k) !== 0) {
        console.log(`${i.toString().padEnd(4, " ")}${k.toString().padEnd(12, " ")}${v}`);
      }
    });
  }

  static printReceipt(contracts: ethers.Contract[], receipt: ethers.ContractReceipt) {
    const map = contracts.reduce<{ [address: string]: ethers.Contract }>((prev, curr) => {
      prev[curr.address.toLowerCase()] = curr;
      return prev;
    }, {});

    const header = `TRANSCATION RECEIPT`;
    const len = receipt.transactionHash.length;
    console.log("".padEnd(len, "-"));
    console.log(header);
    console.log(receipt.transactionHash);
    console.log("");
    console.log("Block: ".padEnd(12, " "), receipt.blockNumber.toString());
    console.log("Gas used: ".padEnd(12, " "), receipt.gasUsed.toString());
    console.log("Gas price: ".padEnd(12, " "), receipt.effectiveGasPrice.toString());
    console.log("".padEnd(len, "-"));

    receipt.logs.forEach((log) => {
      const contract = map[log.address.toLowerCase()];
      if (contract) {
        console.log(`\n${`Log #${log.logIndex}:`} ${contract.interface.getEvent(log.topics[0]).name} ${contract.address.substring(0, 8)}`);
        Logger.printLogs(contract.interface.parseLog(log));
      }
    });

    console.log("");
    console.log("".padEnd(len, "-"));
  }
}
