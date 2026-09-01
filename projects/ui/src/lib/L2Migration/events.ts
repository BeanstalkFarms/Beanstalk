import { ethers } from 'ethers';

export const L2_MIGRATION_EVENT_FROM_BLOCK = 4_365_627;

const MIGRATION_EVENT_SIGNATURES = [
  'ReceiverApproved(address,address)',
  'L1DepositsMigrated(address,address,uint256[],uint256[],uint256[])',
  'L1PlotsMigrated(address,address,uint256[],uint256[])',
  'L1InternalBalancesMigrated(address,address,address[],uint256[])',
  'L1FertilizerMigrated(address,address,uint256[],uint128[],uint128)',
] as const;

type MigrationEventContract = {
  address: string;
  interface: ethers.utils.Interface;
  provider: Pick<ethers.providers.Provider, 'getLogs'>;
};

type ReceiverApprovalLog = {
  args?: {
    owner?: unknown;
    receiver?: unknown;
  };
};

export type MigrationEventState = {
  receiver?: string;
  depositsClaimed: boolean;
  plotsClaimed: boolean;
  internalBalancesClaimed: boolean;
  fertilizerClaimed: boolean;
};

const isAddress = (value: unknown): value is string =>
  typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value);

const addressesEqual = (left: unknown, right: unknown) =>
  isAddress(left) &&
  isAddress(right) &&
  left.toLowerCase() === right.toLowerCase();

export const readCachedMigrationSource = (
  serializedMigration: string | null,
  receiver?: string
) => {
  if (!serializedMigration || !isAddress(receiver)) return undefined;

  try {
    const migration = JSON.parse(serializedMigration) as {
      source?: unknown;
      destination?: unknown;
    };

    if (
      isAddress(migration.source) &&
      addressesEqual(migration.destination, receiver)
    ) {
      return migration.source;
    }
  } catch {
    // Invalid or obsolete local migration data should fall back to the chain.
  }

  return undefined;
};

export const findLatestReceiverApproval = (
  logs: ReceiverApprovalLog[],
  receiver: string
) => {
  for (let index = logs.length - 1; index >= 0; index -= 1) {
    const { owner, receiver: approvedReceiver } = logs[index].args ?? {};
    if (isAddress(owner) && addressesEqual(approvedReceiver, receiver)) {
      return owner;
    }
  }

  return undefined;
};

export const fetchMigrationEventState = async (
  contract: MigrationEventContract,
  sourceAccount: string
): Promise<MigrationEventState> => {
  const topics = MIGRATION_EVENT_SIGNATURES.map((signature) =>
    contract.interface.getEventTopic(signature)
  );
  const logs = await contract.provider.getLogs({
    address: contract.address,
    fromBlock: L2_MIGRATION_EVENT_FROM_BLOCK,
    toBlock: 'latest',
    topics: [topics, ethers.utils.hexZeroPad(sourceAccount, 32)],
  });
  const state: MigrationEventState = {
    depositsClaimed: false,
    plotsClaimed: false,
    internalBalancesClaimed: false,
    fertilizerClaimed: false,
  };

  logs.forEach((log) => {
    const event = contract.interface.parseLog(log);
    switch (event.name) {
      case 'ReceiverApproved':
        state.receiver = event.args.receiver;
        break;
      case 'L1DepositsMigrated':
        state.depositsClaimed = true;
        break;
      case 'L1PlotsMigrated':
        state.plotsClaimed = true;
        break;
      case 'L1InternalBalancesMigrated':
        state.internalBalancesClaimed = true;
        break;
      case 'L1FertilizerMigrated':
        state.fertilizerClaimed = true;
        break;
      default:
        break;
    }
  });

  return state;
};
