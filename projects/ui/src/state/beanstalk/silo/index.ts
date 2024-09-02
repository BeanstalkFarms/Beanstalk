import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { createSelector } from '@reduxjs/toolkit';
import { TokenMap, ZERO_BN } from '~/constants';

/**
 * A "Silo Balance" provides all information
 * about a Farmer's ownership of a Whitelisted Silo Token.
 */
export type BeanstalkSiloBalance = {
  stemTip: ethers.BigNumber;
  bdvPerToken: BigNumber;
  deposited: {
    /** The total amount of this Token currently in the Deposited state. */
    amount: BigNumber;
  };
  /** the total amount of this Token currently germinating in the Deposited state. */
  germinating: {
    amount: BigNumber;
  };
  /** the total amount of this Token that is deposited (deposited & germinating)  */
  TVD: BigNumber;
  /** @deprecated */
  withdrawn?: {
    /** The total amount of this Token currently in the Withdrawn state. */
    amount: BigNumber;
  };
};

/**
 * "Silo Balances" track the detailed balances of
 * all whitelisted Silo tokens, including the amount
 * of each token deposited, claimable, withdrawn, and circulating.
 *
 * FIXME: enforce that `address` is a key of whitelisted tokens?
 */
export type BeanstalkSiloBalances = {
  balances: TokenMap<BeanstalkSiloBalance>;
};

/**
 * "Silo Assets" are rewards earned for holding tokens in the Silo.
 */
export type BeanstalkSiloAssets = {
  beans: {
    earned: BigNumber;
    total: BigNumber;
  };
  stalk: {
    total: BigNumber;
    active: BigNumber;
    earned: BigNumber;
    grown: BigNumber;
  };
  seeds: {
    total: BigNumber;
    active: BigNumber;
    // FIXME: earned -> plantable
    earned: BigNumber;
  };
  roots: {
    total: BigNumber;
  };
};

export type BeanstalkSilo = BeanstalkSiloBalances &
  BeanstalkSiloAssets & { withdrawSeasons: BigNumber };

export const selectBeanstalkSilo = (state: {
  _beanstalk: { silo: BeanstalkSilo };
}) => state._beanstalk.silo;

export const selectBdvPerToken = (address: string) =>
  createSelector(
    selectBeanstalkSilo,
    (silo) => silo.balances[address]?.bdvPerToken || ZERO_BN
  );
