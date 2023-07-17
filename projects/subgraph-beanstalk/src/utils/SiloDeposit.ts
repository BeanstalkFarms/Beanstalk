import { Address, BigInt } from "@graphprotocol/graph-ts";
import { SiloDeposit } from "../../generated/schema";
import { ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { loadBeanstalk } from "./Beanstalk";
import { BEANSTALK } from "../../../subgraph-core/utils/Constants";

export function loadSiloDeposit(account: Address, token: Address, season: BigInt): SiloDeposit {
  let id = account.toHexString() + "-" + token.toHexString() + "-" + season.toString();
  let deposit = SiloDeposit.load(id);
  if (deposit == null) {
    deposit = new SiloDeposit(id);
    deposit.farmer = account.toHexString();
    deposit.token = token.toHexString();
    deposit.season = season.toI32();
    deposit.amount = ZERO_BI;
    deposit.depositedAmount = ZERO_BI;
    deposit.withdrawnAmount = ZERO_BI;
    deposit.bdv = ZERO_BI;
    deposit.depositedBDV = ZERO_BI;
    deposit.withdrawnBDV = ZERO_BI;
    deposit.hashes = [];
    deposit.createdAt = ZERO_BI;
    deposit.updatedAt = ZERO_BI;
    deposit.save();
  }
  return deposit;
}

export function loadSiloDepositV3(account: Address, token: Address, stem: BigInt): SiloDeposit {
  let id = account.toHexString() + "-" + token.toHexString() + "-" + stem.toString();
  let deposit = SiloDeposit.load(id);
  if (deposit == null) {
    let beanstalk = loadBeanstalk(BEANSTALK);
    deposit = new SiloDeposit(id);
    deposit.farmer = account.toHexString();
    deposit.token = token.toHexString();
    deposit.season = beanstalk.lastSeason;
    deposit.stem = stem;
    deposit.amount = ZERO_BI;
    deposit.depositedAmount = ZERO_BI;
    deposit.withdrawnAmount = ZERO_BI;
    deposit.bdv = ZERO_BI;
    deposit.depositedBDV = ZERO_BI;
    deposit.withdrawnBDV = ZERO_BI;
    deposit.hashes = [];
    deposit.createdAt = ZERO_BI;
    deposit.updatedAt = ZERO_BI;
    deposit.save();
  }
  return deposit;
}
