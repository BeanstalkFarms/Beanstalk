import { BigNumber as EBN } from 'ethers';
import BigNumber from 'bignumber.js';
import { AddDepositEvent, AddWithdrawalEvent, PlotTransferEvent, RemoveDepositEvent, RemoveWithdrawalEvent, RemoveWithdrawalsEvent, SowEvent , HarvestEvent } from '~/generated/Beanstalk/Beanstalk';

import { BEAN, BEAN_CRV3_LP, SILO_WHITELIST } from '~/constants/tokens';
import { TokenMap } from '~/constants';
import EventProcessor, { BN, EventProcessingParameters } from './EventProcessor';

// ------------------------------------------

const Bean = BEAN[1];
const BeanCrv3 = BEAN_CRV3_LP[1];
const account = '0xFARMER';
const epp : EventProcessingParameters = {
  season: BN(6074),
  whitelist: SILO_WHITELIST.reduce<TokenMap>((prev, curr) => {
    prev[curr[1].address] = curr[1];
    return prev;
  }, {}),
};

// ------------------------------------------

/**
 * When parsing event data, ethers returns an array
 * that also has named properties. This recreates
 * the same array, assuming that the keys in the 
 * provided object are ordered. 
 * @note downstream SDK functions used the named keys
 * and not the indices; this is more for consistency.
 */
const propArray = (o: { [key: string] : any }) => 
  Object.keys(o).reduce((prev, key) => { 
    prev[prev.length] = o[key];
    prev[key] = o[key];
    return prev;
  }, [] as ((keyof typeof o)[] & typeof o));

const mockProcessor = () => new EventProcessor(account, epp);

// ------------------------------------------

describe('utilities', () => {
  it('builds an array with numerical and string keys', () => {
    const a = propArray({ index: 0, pods: 10 });
    expect(a[0]).toEqual(0);
    expect(a.index).toEqual(0);
    expect(a[1]).toEqual(10);
    expect(a.pods).toEqual(10);
  });
  it('converts ethers.BigNumber to BigNumber.js', () => {
    expect(BN(EBN.from(10))).toStrictEqual(new BigNumber(10));
  });
});

// ------------------------------------------

describe('the Field', () => {
  // 1.
  it('adds a single Plot', () => {
    const p = mockProcessor();
    p.ingest({
      event: 'Sow',
      args: propArray({
        index: EBN.from(10 * 10 ** Bean.decimals),
        pods:  EBN.from(42 * 10 ** Bean.decimals)
      })
    } as SowEvent);

    expect(Object.keys(p.plots).length === 1);
    expect(p.plots['10']).toStrictEqual(new BigNumber(42));
  });

  // 2.
  it('adds a single Plot and Harvests', () => {
    const p = mockProcessor();
    p.ingest({
      event: 'Sow',
      args: propArray({
        index: EBN.from(10 * 10 ** Bean.decimals),
        pods:  EBN.from(42 * 10 ** Bean.decimals)
      })
    } as SowEvent);
    p.ingest({
      event: 'Harvest',
      args: propArray({
        beans: EBN.from(5 * 10 ** Bean.decimals),
        plots: [EBN.from(10 * 10 ** Bean.decimals)]
      })
    } as HarvestEvent);

    expect(Object.keys(p.plots).length === 1);
    expect(p.plots['10']).toBeUndefined();
    expect(p.plots['15']).toStrictEqual(new BigNumber(42 - 5));

    p.ingest({
      event: 'Harvest',
      args: propArray({
        beans: EBN.from(37 * 10 ** Bean.decimals),
        plots: [EBN.from(15 * 10 ** Bean.decimals)]
      })
    } as HarvestEvent);

    expect(Object.keys(p.plots).length === 0);
    expect(p.plots['10']).toBeUndefined();
    expect(p.plots['15']).toBeUndefined();
  });

  // 3.
  it('sends a single Plot, full', () => {
    const p = mockProcessor();
    p.ingest({
      event: 'Sow',
      args: propArray({
        index: EBN.from(10 * 10 ** Bean.decimals),
        pods:  EBN.from(42 * 10 ** Bean.decimals)
      })
    } as SowEvent);
    p.ingest({
      event: 'PlotTransfer',
      args: propArray({
        from: '0xFARMER',
        to: '0xPUBLIUS',
        id: EBN.from(10 * 10 ** Bean.decimals),
        pods: EBN.from(42 * 10 ** Bean.decimals)
      })
    } as PlotTransferEvent);

    expect(Object.keys(p.plots).length).toBe(0);
  });

  // 4.
  it('sends a single Plot, partial (indexed from the front)', () => {
    const p = mockProcessor();
    p.ingest({
      event: 'Sow',
      args: propArray({
        index: EBN.from(10 * 10 ** Bean.decimals),
        pods:  EBN.from(42 * 10 ** Bean.decimals)
      })
    } as SowEvent);
    p.ingest({
      event: 'PlotTransfer',
      args: propArray({
        from: '0xFARMER',
        to:   '0xPUBLIUS',
        id:   EBN.from(10 * 10 ** Bean.decimals), // front of the Plot
        pods: EBN.from(22 * 10 ** Bean.decimals)  // don't send the whole Plot
      })
    } as PlotTransferEvent);

    // Since the Plot is sent from the front, index starts at 10 + 22 = 32.
    expect(Object.keys(p.plots).length).toBe(1);
    expect(p.plots[(10 + 22).toString()]).toStrictEqual(new BigNumber(42 - 22));
  });

  // 5.
  it('works with large-index plots', () => {
    const p = mockProcessor();
    p.ingest({
      event: 'Sow',
      args: propArray({
        index: EBN.from('737663715081254'),
        pods:  EBN.from('57980000'),
      })
    } as SowEvent);

    expect(p.plots['737663715.081254']).toBeDefined();
    expect(p.plots['737663715.081254'].eq(57.980000)).toBe(true);
  });
});

// --------------------------------

describe('the Silo', () => {
  it('throws when processing unknown tokens', () => {
    const p = mockProcessor();
    expect(() => p.ingest({
      event: 'AddDeposit',
      args: propArray({
        token: '0xUNKNOWN',
      })
    } as AddDepositEvent)).toThrow();
  });

  it('runs a simple deposit sequence (three deposits, two tokens, two seasons)', () => {
    const p = mockProcessor();
    const t1 = Bean.address.toLowerCase();
    const t2 = BeanCrv3.address.toLowerCase();

    // Deposit: 1000 Bean, Season 6074
    p.ingest({
      event: 'AddDeposit',
      args: propArray({
        account,
        token:  t1,
        season: EBN.from(6074),
        amount: EBN.from(1000 * 10 ** Bean.decimals), // Deposited 1,000 Bean
        bdv:    EBN.from(1000 * 10 ** Bean.decimals), 
      }),
    } as AddDepositEvent);

    expect(p.deposits[t1]['6074']).toStrictEqual({
      amount: BN(1000),
      bdv:    BN(1000),
    });

    // Deposit: 500 Bean, Season 6074
    p.ingest({
      event: 'AddDeposit',
      args: propArray({
        account,
        token:  t1,
        season: EBN.from(6074),
        amount: EBN.from(500 * 10 ** Bean.decimals), // Deposited 500 Bean
        bdv:    EBN.from(500 * 10 ** Bean.decimals), 
      }),
    } as AddDepositEvent);

    expect(p.deposits[t1]['6074']).toStrictEqual({
      amount: BN(1500),
      bdv:    BN(1500),
    });

    // Deposit: 1000 Bean:CRV3 LP, Season 6100
    p.ingest({
      event: 'AddDeposit',
      args: propArray({
        account,
        token:  t2,
        season: EBN.from(6100),
        amount: EBN.from(1000).mul(EBN.from(10).pow(BeanCrv3.decimals)), // Deposited 1,000 Bean:CRV3
        bdv:    EBN.from(900).mul(EBN.from(10).pow(Bean.decimals))
      }),
    } as AddDepositEvent);

    expect(p.deposits[t2]['6100']).toStrictEqual({
      amount: BN(1000),
      bdv:    BN(900),
    });
  });

  it('adds withdrawals', () => {
    const p = mockProcessor();
    const t1 = Bean.address.toLowerCase();
    const t2 = BeanCrv3.address.toLowerCase();

    // Withdrawal: 1000 Bean, Season 6074
    p.ingest({
      event: 'AddWithdrawal',
      args: propArray({
        account,
        token:  t1,
        season: EBN.from(6074),
        amount: EBN.from(1000 * 10 ** Bean.decimals), // Withdrew 1,000 Bean
      }),
    } as AddWithdrawalEvent);

    expect(p.withdrawals[t1]['6074']).toStrictEqual({
      amount: BN(1000),
    });

    // Withdrawal: 500 Bean, Season 6074
    p.ingest({
      event: 'AddWithdrawal',
      args: propArray({
        account,
        token:  t1,
        season: EBN.from(6074),
        amount: EBN.from(500 * 10 ** Bean.decimals), // Withdrew 500 Bean
      }),
    } as AddWithdrawalEvent);

    expect(p.withdrawals[t1]['6074']).toStrictEqual({
      amount: BN(1500),
    });

    // Deposit: 1000 Bean:CRV3 LP, Season 6100
    p.ingest({
      event: 'AddWithdrawal',
      args: propArray({
        account,
        token:  t2,
        season: EBN.from(6100),
        amount: EBN.from(1000).mul(EBN.from(10).pow(BeanCrv3.decimals)), // Deposited 1,000 Bean:CRV3
      }),
    } as AddWithdrawalEvent);

    expect(p.withdrawals[t2]['6100']).toStrictEqual({
      amount: BN(1000),
    });
  });

  it('removes a single deposit, partial -> full', () => {
    const p = mockProcessor();
    const t1 = Bean.address.toLowerCase();

    // Deposit: 1000 Bean, Season 6074
    p.ingest({
      event: 'AddDeposit',
      args: propArray({
        account,
        token:  t1,
        season: EBN.from(6074),
        amount: EBN.from(1000 * 10 ** Bean.decimals), // Deposited 1,000 Bean
        bdv:    EBN.from(1000 * 10 ** Bean.decimals), 
      }),
    } as AddDepositEvent);

    p.ingest({
      event: 'RemoveDeposit',
      args: propArray({
        account,
        token:  t1,
        season: EBN.from(6074),
        amount: EBN.from(600 * 10 ** Bean.decimals),
        bdv:    EBN.from(600 * 10 ** Bean.decimals),
      })
    } as RemoveDepositEvent);

    expect(p.deposits[t1]['6074']).toStrictEqual({
      amount: BN(400),
      bdv: BN(400),
    });

    p.ingest({
      event: 'RemoveDeposit',
      args: propArray({
        account,
        token:  t1,
        season: EBN.from(6074),
        amount: EBN.from(400 * 10 ** Bean.decimals),
        bdv:    EBN.from(400 * 10 ** Bean.decimals),
      })
    } as RemoveDepositEvent);

    expect(p.deposits[t1]['6074']).toBeUndefined();
  });

  it('removes a single withdrawal', () => {
    const p = mockProcessor();
    const t1 = Bean.address.toLowerCase();

    // Withdraw: 1000 Bean in Season 6074
    p.ingest({
      event: 'AddWithdrawal',
      args: propArray({
        account,
        token:  t1,
        season: EBN.from(6074),
        amount: EBN.from(1000 * 10 ** Bean.decimals), // Deposited 1,000 Bean
      }),
    } as AddWithdrawalEvent);

    // Claim: 600 Bean from Withdrawal in Season 6074
    p.ingest({
      event: 'RemoveWithdrawal',
      args: propArray({
        account,
        token:  t1,
        season: EBN.from(6074),
        amount: EBN.from(1000 * 10 ** Bean.decimals),
      }),
    } as RemoveWithdrawalEvent);

    // withdrawal should be deleted
    expect(p.withdrawals[t1]['6074']).toBeUndefined();
  });

  it('removes multiple withdrawals, full', () => {
    const p = mockProcessor();
    const t1 = Bean.address.toLowerCase();

    // Withdraw: 1000 Bean in Season 6074
    p.ingest({
      event: 'AddWithdrawal',
      args: propArray({
        account,
        token:  t1,
        season: EBN.from(6074),
        amount: EBN.from(1000 * 10 ** Bean.decimals), // Withdraw 1,000 Bean
      }),
    } as AddWithdrawalEvent);

    expect(p.withdrawals[t1]['6074']).toStrictEqual({
      amount: BN(1000),
    });

    // Withdraw: 5000 Bean in Season 6100
    p.ingest({
      event: 'AddWithdrawal',
      args: propArray({
        account,
        token:  t1,
        season: EBN.from(6100),
        amount: EBN.from(5000 * 10 ** Bean.decimals), // Withdraw 1,000 Bean
      }),
    } as AddWithdrawalEvent);

    expect(p.withdrawals[t1]['6100']).toStrictEqual({
      amount: BN(5000),
    });

    // Claim: 
    p.ingest({
      event: 'RemoveWithdrawals',
      args: propArray({
        account,
        token:  t1,
        seasons: ['6074', '6100'],
        amount: EBN.from(6000 * 10 ** Bean.decimals), // Claim 2000 Bean
      }),
    } as RemoveWithdrawalsEvent);

    expect(p.withdrawals[t1]['6074']).toBeUndefined();
    expect(p.withdrawals[t1]['6100']).toBeUndefined();
  });

  it('ignores empty RemoveWithdrawal events', () => {
    const p = mockProcessor();
    const t1 = Bean.address.toLowerCase();

    expect(() => p.ingest({
      event: 'RemoveWithdrawal',
      args: propArray({
        account,
        token:  t1,
        season: EBN.from(6074),
        amount: EBN.from(0), // amount is empty is Withdrawal couldn't be processed
      }),
    } as RemoveWithdrawalEvent)).not.toThrow();

    // No deposit made in t1
    expect(p.withdrawals[t1]).toStrictEqual({});
  });
});
