import { ethers } from 'ethers';

import {
  findLatestReceiverApproval,
  fetchMigrationEventState,
  readCachedMigrationSource,
} from './events';

const BEANSTALK = '0x000000000000000000000000000000000000BEEF';
const SOURCE = '0x1111111111111111111111111111111111111111';
const RECEIVER = '0x2222222222222222222222222222222222222222';

const eventInterface = new ethers.utils.Interface([
  'event ReceiverApproved(address indexed owner, address receiver)',
  'event L1DepositsMigrated(address indexed owner, address indexed receiver, uint256[] depositIds, uint256[] amounts, uint256[] bdvs)',
  'event L1PlotsMigrated(address indexed owner, address indexed receiver, uint256[] index, uint256[] pods)',
  'event L1InternalBalancesMigrated(address indexed owner, address indexed receiver, address[] tokens, uint256[] amounts)',
  'event L1FertilizerMigrated(address indexed owner, address indexed receiver, uint256[] fertIds, uint128[] amounts, uint128 lastBpf)',
]);

const makeLog = (eventName: string, args: unknown[]) => {
  const encoded = eventInterface.encodeEventLog(
    eventInterface.getEvent(eventName),
    args
  );

  return {
    address: BEANSTALK,
    blockHash: `0x${'a'.repeat(64)}`,
    blockNumber: 4_365_700,
    data: encoded.data,
    logIndex: 0,
    removed: false,
    topics: encoded.topics,
    transactionHash: `0x${'b'.repeat(64)}`,
    transactionIndex: 0,
  };
};

describe('L2 migration event reads', () => {
  it('loads all owner migration statuses with one filtered log request', async () => {
    const requestedFilters: ethers.providers.Filter[] = [];
    const logs = [
      makeLog('ReceiverApproved', [SOURCE, RECEIVER]),
      makeLog('L1DepositsMigrated', [SOURCE, RECEIVER, [1], [2], [3]]),
      makeLog('L1PlotsMigrated', [SOURCE, RECEIVER, [4], [5]]),
    ];
    const contract = {
      address: BEANSTALK,
      interface: eventInterface,
      provider: {
        getLogs: async (filter: ethers.providers.Filter) => {
          requestedFilters.push(filter);
          return logs;
        },
      },
    };

    const state = await fetchMigrationEventState(contract, SOURCE);

    expect(requestedFilters).toHaveLength(1);
    expect(requestedFilters[0]).toMatchObject({
      address: BEANSTALK,
      fromBlock: 4_365_627,
      toBlock: 'latest',
    });
    expect(requestedFilters[0].topics?.[0]).toHaveLength(5);
    expect(requestedFilters[0].topics?.[1]).toBe(
      ethers.utils.hexZeroPad(SOURCE, 32)
    );
    expect(state).toEqual({
      receiver: RECEIVER,
      depositsClaimed: true,
      plotsClaimed: true,
      internalBalancesClaimed: false,
      fertilizerClaimed: false,
    });
  });
});

describe('L2 migration source resolution', () => {
  it('uses a cached source when its destination matches the connected account', () => {
    expect(
      readCachedMigrationSource(
        JSON.stringify({ source: SOURCE, destination: RECEIVER.toUpperCase() }),
        RECEIVER
      )
    ).toBe(SOURCE);
  });

  it('ignores cached migration data for another receiver or malformed JSON', () => {
    expect(
      readCachedMigrationSource(
        JSON.stringify({ source: SOURCE, destination: SOURCE }),
        RECEIVER
      )
    ).toBeUndefined();
    expect(readCachedMigrationSource('{bad json', RECEIVER)).toBeUndefined();
  });

  it('selects the latest approval for the connected receiver case-insensitively', () => {
    const olderSource = '0x3333333333333333333333333333333333333333';

    expect(
      findLatestReceiverApproval(
        [
          { args: { owner: olderSource, receiver: RECEIVER } },
          { args: { owner: SOURCE, receiver: RECEIVER.toUpperCase() } },
        ],
        RECEIVER
      )
    ).toBe(SOURCE);
  });
});
