import BigNumber from 'bignumber.js';
import { DateTime } from 'luxon';
import { GovSpace } from '~/lib/Beanstalk/Governance';

export type GovSpaceMap<T> = {
  [key in GovSpace]: T;
};

export type FarmerDelegation = {
  delegators: Partial<{
    [key in GovSpace]?: {
      [k: string]: {
        address: string;
        timestamp: DateTime;
      };
    };
  }>;
  delegates: Partial<{
    [key in GovSpace]?: {
      address: string;
      timestamp: DateTime;
      votes: {
        [proposal_id: string]: any;
      };
    };
  }>;
  delegatorVotingPower: { [k: string]: BigNumber };
  updated: {
    delegators: DateTime | undefined;
    delegates: DateTime | undefined;
  };
};
