import { assert } from "src/utils";
import { FarmWorkflow } from "./farm";
import { setupConnection } from "src/utils/TestUtils/provider";
import { BeanstalkSDK, DataSource } from "src/lib/BeanstalkSDK";
import { BlockchainUtils } from "src/utils/TestUtils";
import { Crate } from "src/lib/silo";
import { TokenValue } from "src/TokenValue";

import { FarmToMode, FarmFromMode, Token } from "src/index";

jest.setTimeout(600000);

let sdk: BeanstalkSDK;
let account: string;
let test: BlockchainUtils;
let crates: Crate<TokenValue>[];
let depositValue: TokenValue;

const DEPOSIT_AMOUNT = 1_000;

beforeAll(async () => {
  const { signer, provider, account: _account } = await setupConnection();
  sdk = new BeanstalkSDK({
    provider: provider,
    signer: signer
  });
  account = _account;
  test = new BlockchainUtils(sdk);
  depositValue = sdk.tokens.BEAN.fromHuman(1_000);

  await test.resetFork();
  await test.setBEANBalance(account, sdk.tokens.BEAN.fromHuman(10_000));

  const currentSeason = await sdk.sun.getSeason();

  const deposit = sdk.silo.buildDeposit(sdk.tokens.BEAN, account);
  deposit.setInputToken(sdk.tokens.BEAN);
  deposit.workflow.add(new sdk.farm.actions.WithdrawDeposits(
    sdk.tokens.BEAN.address,
    [currentSeason.toString()],
    [depositValue.blockchainString]
  ));
    
  await deposit
    .estimate(depositValue)
    .then(() => sdk.tokens.BEAN.approveBeanstalk(depositValue)).then((r) => r.wait())
    .then(() => deposit.execute(depositValue, 0.1)).then((r) => r.wait());

  const balance = await sdk.silo.getBalance(sdk.tokens.BEAN, account, { source: DataSource.LEDGER });
  crates = balance.withdrawn.crates;

  await test.sunrise(true);

  const newSeason = await sdk.sun.getSeason();
  expect(newSeason.toString()).toEqual(crates[0].season.toString());
});

describe("Workflow: Claim and Do X", () => {
  let work: FarmWorkflow;
  let snapshot: number;

  beforeEach(async () => {
    snapshot = await test.snapshot();
    work = sdk.farm.create();
  });

  afterEach(async () => {
    await test.revert(snapshot);
  });

  it("should claim withdrawable beans", async () => {
    work.add(new sdk.farm.actions.ClaimWithdrawals(
      sdk.tokens.BEAN.address,
      crates.map((c) => c.season.toString()),
      FarmToMode.INTERNAL
    ));

    await work
      .estimate(depositValue)
      .then(() => work.execute(depositValue, { slippage: 0.1 }))
      .then((r) => r.wait());

    const { farmBalance } = await getTokenBalances(sdk, account, sdk.tokens.BEAN);

    expect(farmBalance.eq(depositValue)).toBe(true);
  });

  it("should claim and deposit all in silo", async () => {
    const balancesBefore = await sdk.silo.getBalance(sdk.tokens.BEAN, account, { source: DataSource.LEDGER });

    expect(balancesBefore.claimable.crates.length).toBeGreaterThan(0);
    expect(balancesBefore.claimable.crates[0].amount.eq(depositValue)).toBe(true);

    work.add(new sdk.farm.actions.ClaimWithdrawals(
      sdk.tokens.BEAN.address,
      crates.map((c) => c.season.toString()),
      FarmToMode.INTERNAL
    ));

    const deposit = sdk.silo.buildDeposit(sdk.tokens.BEAN, account);
    deposit.setInputToken(sdk.tokens.BEAN);
    deposit.fromMode = FarmFromMode.INTERNAL;
    await deposit.estimate(depositValue);
    
    work.add(createLocalOnlyStep("pre-deposit", depositValue), { onlyLocal: true });
    work.add([...deposit.workflow.generators]);
    
    await work
      .estimate(sdk.tokens.BEAN.fromHuman(0))
      .then(() => sdk.tokens.BEAN.approveBeanstalk(depositValue))
      .then((r) => r.wait())
      .then(() => work.execute(sdk.tokens.BEAN.fromHuman(0), { slippage: 0.1 }))
      .then((r) => r.wait());
    
    const balancesAfter = await sdk.silo.getBalance(sdk.tokens.BEAN, account, { source: DataSource.LEDGER });
    
    expect(balancesAfter.claimable.crates.length).toEqual(0);
    expect(balancesAfter.deposited.crates.length).toBeGreaterThan(0);
    expect(balancesAfter.deposited.crates[0].amount.eq(depositValue)).toBe(true);
  })

  it("should claim and deposit all + some in silo", async ()  => {
    const balancesBefore = await sdk.silo.getBalance(sdk.tokens.BEAN, account, { source: DataSource.LEDGER });

    expect(balancesBefore.claimable.crates.length).toBeGreaterThan(0);
    expect(balancesBefore.claimable.crates[0].amount.eq(depositValue)).toBe(true);

    work.add(new sdk.farm.actions.ClaimWithdrawals(
      sdk.tokens.BEAN.address,
      crates.map((c) => c.season.toString()),
      FarmToMode.INTERNAL
    ));

    const deposit = sdk.silo.buildDeposit(sdk.tokens.BEAN, account);
    deposit.setInputToken(sdk.tokens.BEAN);
    deposit.fromMode = FarmFromMode.INTERNAL_TOLERANT;
    await deposit.estimate(depositValue);

    const totalAmount = depositValue.add(1_000);

    work.add(createLocalOnlyStep("pre-deposit", totalAmount), { onlyLocal: true });
    work.add([...deposit.workflow.generators]);

    await work
      .estimate(sdk.tokens.BEAN.fromHuman(0))
      .then(() => sdk.tokens.BEAN.approveBeanstalk(depositValue))
      .then((r) => r.wait())
      .then(() => work.execute(sdk.tokens.BEAN.fromHuman(0), { slippage: 0.1 }))
      .then((r) => r.wait());
  
    const balancesAfter = await sdk.silo.getBalance(sdk.tokens.BEAN, account, { source: DataSource.LEDGER });
    
    expect(balancesAfter.claimable.crates.length).toEqual(0);
    expect(balancesAfter.deposited.crates.length).toBeGreaterThan(0);
    expect(balancesAfter.deposited.crates[0].amount.eq(totalAmount)).toBe(true);
  })

  it("should claim and deposit half + some -> transfer surplus to EOA", async () => {
    const siloBalancesBefore = await sdk.silo.getBalance(sdk.tokens.BEAN, account, { source: DataSource.LEDGER });
    const accBalancesBefore = await getTokenBalances(sdk, account, sdk.tokens.BEAN);

    expect(siloBalancesBefore.claimable.crates.length).toBeGreaterThan(0);
    expect(siloBalancesBefore.claimable.crates[0].amount.eq(depositValue)).toBe(true);

    work.add(new sdk.farm.actions.ClaimWithdrawals(
      sdk.tokens.BEAN.address,
      crates.map((c) => c.season.toString()),
      FarmToMode.INTERNAL
    ));
    
    const totalAmount = depositValue.div(2); // 500
    work.add(createLocalOnlyStep("pre-transfer", totalAmount), { onlyLocal: true });
    work.add(new sdk.farm.actions.TransferToken(
      sdk.tokens.BEAN.address,
      account,
      FarmFromMode.INTERNAL,
      FarmToMode.EXTERNAL
    ));

    const deposit = sdk.silo.buildDeposit(sdk.tokens.BEAN, account);
    deposit.setInputToken(sdk.tokens.BEAN);
    deposit.fromMode = FarmFromMode.INTERNAL_TOLERANT;
    await deposit.estimate(depositValue);

    work.add(createLocalOnlyStep("pre-deposit", totalAmount), { onlyLocal: true });
    work.add([...deposit.workflow.generators]);

    await work
      .estimate(sdk.tokens.BEAN.fromHuman(0))
      .then(() => sdk.tokens.BEAN.approveBeanstalk(depositValue))
      .then((r) => r.wait())
      .then(() => work.execute(sdk.tokens.BEAN.fromHuman(0), { slippage: 0.1 }))
      .then((r) => r.wait());
  
    const siloBalancesAfter = await sdk.silo.getBalance(sdk.tokens.BEAN, account, { source: DataSource.LEDGER });
    
    expect(siloBalancesAfter.claimable.crates.length).toEqual(0);
    expect(siloBalancesAfter.deposited.crates.length).toBeGreaterThan(0);
    expect(siloBalancesAfter.deposited.crates[0].amount.eq(totalAmount)).toBe(true);

    const accBalancesAfter = await getTokenBalances(sdk, account, sdk.tokens.BEAN);
    expect(accBalancesBefore.farmBalance
      .eq(accBalancesAfter.farmBalance))
      .toBe(true);

    expect(accBalancesBefore.circulatingBalance.add(totalAmount)
      .eq(accBalancesAfter.circulatingBalance))
      .toBe(true);
  })
});

async function getTokenBalances(sdk: BeanstalkSDK, account: string, token: Token) {
  const balances = await sdk.contracts.beanstalk.getAllBalance(account, token.address);
  return {
    farmBalance: token.fromBlockchain(balances.internalBalance),
    circulatingBalance: token.fromBlockchain(balances.externalBalance),
    totalBalance: token.fromBlockchain(balances.totalBalance),
  }
}

function createLocalOnlyStep(name: string, amount: TokenValue) {
  const step = async () => ({
    name: name,
    amountOut: amount.toBigNumber(),
    prepare: () => ({
      target: '',
      callData: '',
    }),
    decode: () => undefined,
    decodeResult: () => undefined,
  });

  return step;
}
