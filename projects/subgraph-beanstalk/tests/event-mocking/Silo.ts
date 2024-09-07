import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  AddDeposit as AddDepositV2,
  RemoveDeposit as RemoveDepositV2,
  RemoveDeposits as RemoveDepositsV2,
  AddWithdrawal,
  RemoveWithdrawal,
  RemoveWithdrawals
} from "../../generated/Beanstalk-ABIs/Replanted";
import { mockBeanstalkEvent } from "../../../subgraph-core/tests/event-mocking/Util";
import {
  AddDeposit,
  RemoveDeposits,
  RemoveDeposit,
  SeedsBalanceChanged,
  StalkBalanceChanged,
  Plant
} from "../../generated/Beanstalk-ABIs/SeedGauge";
export function createAddDepositV2Event(
  account: string,
  token: string,
  season: i32,
  amount: i32,
  tokenDecimals: i32,
  bdv: i32
): AddDepositV2 {
  let addDepositEvent = changetype<AddDepositV2>(mockBeanstalkEvent());
  addDepositEvent.parameters = new Array();
  let accountParam = new ethereum.EventParam("account", ethereum.Value.fromAddress(Address.fromString(account)));
  let tokenParam = new ethereum.EventParam("token", ethereum.Value.fromAddress(Address.fromString(token)));
  let seasonParam = new ethereum.EventParam("season", ethereum.Value.fromI32(season));
  let amountParam = new ethereum.EventParam(
    "amount",
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(amount).times(BigInt.fromI32(10 ** tokenDecimals)))
  );
  let bdvParam = new ethereum.EventParam("bdv", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(bdv).times(BigInt.fromI32(10 ** 6))));

  addDepositEvent.parameters.push(accountParam);
  addDepositEvent.parameters.push(tokenParam);
  addDepositEvent.parameters.push(seasonParam);
  addDepositEvent.parameters.push(amountParam);
  addDepositEvent.parameters.push(bdvParam);

  return addDepositEvent as AddDepositV2;
}

export function createAddDepositV3Event(
  account: string,
  token: string,
  stem: BigInt,
  amount: i32,
  tokenDecimals: i32,
  bdv: i32
): AddDeposit {
  let addDepositEvent = changetype<AddDeposit>(mockBeanstalkEvent());
  addDepositEvent.parameters = new Array();
  let accountParam = new ethereum.EventParam("account", ethereum.Value.fromAddress(Address.fromString(account)));
  let tokenParam = new ethereum.EventParam("token", ethereum.Value.fromAddress(Address.fromString(token)));
  let stemParam = new ethereum.EventParam("stem", ethereum.Value.fromSignedBigInt(stem));
  let amountParam = new ethereum.EventParam(
    "amount",
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(amount).times(BigInt.fromI32(10 ** tokenDecimals)))
  );
  let bdvParam = new ethereum.EventParam("bdv", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(bdv).times(BigInt.fromI32(10 ** 6))));

  addDepositEvent.parameters.push(accountParam);
  addDepositEvent.parameters.push(tokenParam);
  addDepositEvent.parameters.push(stemParam);
  addDepositEvent.parameters.push(amountParam);
  addDepositEvent.parameters.push(bdvParam);

  return addDepositEvent as AddDeposit;
}

export function createRemoveDepositV2Event(account: string, token: string, season: i32, amount: BigInt): RemoveDepositV2 {
  let removeDepositEvent = changetype<RemoveDepositV2>(mockBeanstalkEvent());
  removeDepositEvent.parameters = new Array();
  let accountParam = new ethereum.EventParam("account", ethereum.Value.fromAddress(Address.fromString(account)));
  let tokenParam = new ethereum.EventParam("token", ethereum.Value.fromAddress(Address.fromString(token)));
  let seasonParam = new ethereum.EventParam("season", ethereum.Value.fromI32(season));
  let amountParam = new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount));

  removeDepositEvent.parameters.push(accountParam);
  removeDepositEvent.parameters.push(tokenParam);
  removeDepositEvent.parameters.push(seasonParam);
  removeDepositEvent.parameters.push(amountParam);

  return removeDepositEvent as RemoveDepositV2;
}

export function createRemoveDepositV3Event(account: string, token: string, stem: BigInt, amount: BigInt, bdv: BigInt): RemoveDeposit {
  let removeDepositEvent = changetype<RemoveDeposit>(mockBeanstalkEvent());
  removeDepositEvent.parameters = new Array();
  let accountParam = new ethereum.EventParam("account", ethereum.Value.fromAddress(Address.fromString(account)));
  let tokenParam = new ethereum.EventParam("token", ethereum.Value.fromAddress(Address.fromString(token)));
  let stemParam = new ethereum.EventParam("stem", ethereum.Value.fromSignedBigInt(stem));
  let amountParam = new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount));
  let bdvParam = new ethereum.EventParam("bdv", ethereum.Value.fromUnsignedBigInt(bdv));

  removeDepositEvent.parameters.push(accountParam);
  removeDepositEvent.parameters.push(tokenParam);
  removeDepositEvent.parameters.push(stemParam);
  removeDepositEvent.parameters.push(amountParam);
  removeDepositEvent.parameters.push(bdvParam);

  return removeDepositEvent as RemoveDeposit;
}

export function createRemoveDepositsV2Event(
  account: string,
  token: string,
  seasons: i32[],
  amounts: BigInt[],
  amount: BigInt
): RemoveDepositsV2 {
  let event = changetype<RemoveDepositsV2>(mockBeanstalkEvent());
  event.parameters = new Array();

  let seasonsArray: ethereum.Value[] = [];
  for (let i = 0; i < seasons.length; ++i) {
    seasonsArray.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(seasons[i])));
  }

  let amountsArray: ethereum.Value[] = [];
  for (let i = 0; i < amounts.length; ++i) {
    amountsArray.push(ethereum.Value.fromUnsignedBigInt(amounts[i]));
  }

  let param1 = new ethereum.EventParam("account", ethereum.Value.fromAddress(Address.fromString(account)));
  let param2 = new ethereum.EventParam("token", ethereum.Value.fromAddress(Address.fromString(token)));
  let param3 = new ethereum.EventParam("seasons", ethereum.Value.fromArray(seasonsArray));
  let param4 = new ethereum.EventParam("amounts", ethereum.Value.fromArray(amountsArray));
  let param5 = new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount));

  event.parameters.push(param1);
  event.parameters.push(param2);
  event.parameters.push(param3);
  event.parameters.push(param4);
  event.parameters.push(param5);

  return event as RemoveDepositsV2;
}

export function createRemoveDepositsV3Event(
  account: string,
  token: string,
  stems: BigInt[],
  amounts: BigInt[],
  amount: BigInt,
  bdvs: BigInt[]
): RemoveDeposits {
  let event = changetype<RemoveDeposits>(mockBeanstalkEvent());
  event.parameters = new Array();

  let stemsArray: ethereum.Value[] = [];
  for (let i = 0; i < stems.length; ++i) {
    stemsArray.push(ethereum.Value.fromSignedBigInt(stems[i]));
  }

  let amountsArray: ethereum.Value[] = [];
  for (let i = 0; i < amounts.length; ++i) {
    amountsArray.push(ethereum.Value.fromUnsignedBigInt(amounts[i]));
  }

  let bdvsArray: ethereum.Value[] = [];
  for (let i = 0; i < bdvs.length; ++i) {
    bdvsArray.push(ethereum.Value.fromUnsignedBigInt(bdvs[i]));
  }

  let param1 = new ethereum.EventParam("account", ethereum.Value.fromAddress(Address.fromString(account)));
  let param2 = new ethereum.EventParam("token", ethereum.Value.fromAddress(Address.fromString(token)));
  let param3 = new ethereum.EventParam("stems", ethereum.Value.fromArray(stemsArray));
  let param4 = new ethereum.EventParam("amounts", ethereum.Value.fromArray(amountsArray));
  let param5 = new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount));
  let param6 = new ethereum.EventParam("bdvs", ethereum.Value.fromArray(bdvsArray));

  event.parameters.push(param1);
  event.parameters.push(param2);
  event.parameters.push(param3);
  event.parameters.push(param4);
  event.parameters.push(param5);
  event.parameters.push(param6);

  return event as RemoveDeposits;
}

export function createAddWithdrawalEvent(account: string, token: string, season: i32, amount: BigInt): AddWithdrawal {
  let event = changetype<AddWithdrawal>(mockBeanstalkEvent());
  event.parameters = new Array();
  return event as AddWithdrawal;
}

export function createRemoveWithdrawalEvent(account: string, token: string, season: i32, amount: BigInt): RemoveWithdrawal {
  let event = changetype<RemoveWithdrawal>(mockBeanstalkEvent());
  event.parameters = new Array();
  return event as RemoveWithdrawal;
}

export function createRemoveWithdrawalsEvent(account: string, token: string, seasons: i32[], amount: BigInt): RemoveWithdrawals {
  let event = changetype<RemoveWithdrawals>(mockBeanstalkEvent());
  event.parameters = new Array();
  return event as RemoveWithdrawals;
}

export function createSeedsBalanceChangedEvent(account: string, delta: BigInt): SeedsBalanceChanged {
  let event = changetype<SeedsBalanceChanged>(mockBeanstalkEvent());
  event.parameters = new Array();
  return event as SeedsBalanceChanged;
}

export function createStalkBalanceChangedEvent(account: string, delta: BigInt, rootDelta: BigInt): StalkBalanceChanged {
  let event = changetype<StalkBalanceChanged>(mockBeanstalkEvent());
  event.parameters = new Array();
  return event as StalkBalanceChanged;
}

export function createPlantEvent(account: string, amount: BigInt): Plant {
  let event = changetype<Plant>(mockBeanstalkEvent());
  event.parameters = new Array();
  return event as Plant;
}

export function createWhitelistTokenEvent(token: string, selector: Bytes, seeds: BigInt, stalk: BigInt): WhitelistToken {
  let event = changetype<WhitelistToken>(mockBeanstalkEvent());
  event.parameters = new Array();
  return event as WhitelistToken;
}

export function createDewhitelistTokenEvent(token: string): DewhitelistToken {
  let event = changetype<DewhitelistToken>(mockBeanstalkEvent());
  event.parameters = new Array();
  let param1 = new ethereum.EventParam("token", ethereum.Value.fromAddress(Address.fromString(token)));
  event.parameters.push(param1);
  return event as DewhitelistToken;
}
