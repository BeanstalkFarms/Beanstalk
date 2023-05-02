import React, { useCallback } from 'react';
import { Grid, Stack } from '@mui/material';
import { useProposalsQuery } from '~/generated/graphql';
import useTabs from '~/hooks/display/useTabs';
import { GovSpace, SNAPSHOT_SPACES } from '~/lib/Beanstalk/Governance';
import { Proposal } from '~/util/Governance';
import { Module, ModuleTabs, ModuleContent } from '../Common/Module';
import { StyledTab, ChipLabel } from '../Common/Tabs';
import ProposalList from './Proposals/ProposalList';
import useToggle from '~/hooks/display/useToggle';
import DelegatesCard from './Delegate/DelegatesCard';
import DelegatorsCard from './Delegate/DelegatorsCard';
import VotingPowerCard from './VotingPowerCard';

/// Variables
export const GOV_SLUGS = ['dao', 'beanstalk-farms', 'bean-sprout', 'beanft'];

export const GOV_SLUGS_TAB_MAP = {
  0: GovSpace.BeanstalkDAO,
  1: GovSpace.BeanstalkFarms,
  2: GovSpace.BeanSprout,
  3: GovSpace.BeanNFT,
};

const GovernanceSpaces: React.FC<{}> = () => {
  const [tab, handleChange] = useTabs(GOV_SLUGS, 'type');
  const [open, show, hide] = useToggle();

  // Query Proposals
  const { loading, data } = useProposalsQuery({
    variables: { space_in: SNAPSHOT_SPACES },
    fetchPolicy: 'cache-and-network',
    context: { subgraph: 'snapshot' },
  });

  /// Helpers
  const filterBySpace = useCallback(
    (t: number) => {
      if (!loading && data?.proposals) {
        return data.proposals.filter(
          (p) => p !== null && p?.space?.id === SNAPSHOT_SPACES[t]
        ) as Proposal[];
      }
      return [];
    },
    [data, loading]
  );

  const hasActive = (proposals: Proposal[]) => {
    // true if any proposals are active
    if (proposals) {
      return proposals.filter((p) => p?.state === 'active').length > 0;
    }
    return false;
  };

  const numActive = (proposals: Proposal[]) => {
    // number of active proposals
    if (proposals) {
      return proposals.filter((p) => p?.state === 'active').length;
    }
    return 0;
  };

  // Filter proposals & check if there are any active ones
  const filterProposals = useCallback(
    (t: number) => {
      // All proposals for a given space
      const allProposals = filterBySpace(t);
      // Number of active proposals in this space
      const activeProposals: number = numActive(allProposals);
      // True if there are any active proposals
      const hasActiveProposals = hasActive(allProposals);

      return { allProposals, activeProposals, hasActiveProposals } as const;
    },
    [filterBySpace]
  );

  const daoProposals = filterProposals(0);
  const beanstalkFarmsProposals = filterProposals(1);
  const beanSproutProposals = filterProposals(2);
  const beaNFTDaoProposals = filterProposals(3);

  return (
    <>
      <Grid container direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Grid item xs={12} lg={3.5}>
          <Stack gap={1}>
            <VotingPowerCard tab={tab} />
            <DelegatesCard tab={tab} />
            <DelegatorsCard tab={tab} />
          </Stack>
        </Grid>
        <Grid item xs={12} lg={8.5}>
          <Module>
            <ModuleTabs
              value={tab}
              onChange={handleChange}
              sx={{ minHeight: 0 }}
            >
              <StyledTab
                label={
                  <ChipLabel name="DAO">
                    {daoProposals.activeProposals || null}
                  </ChipLabel>
                }
              />
              <StyledTab
                label={
                  <ChipLabel name="Beanstalk Farms">
                    {beanstalkFarmsProposals.activeProposals || null}
                  </ChipLabel>
                }
              />
              <StyledTab
                label={
                  <ChipLabel name="Bean Sprout">
                    {beanSproutProposals.activeProposals || null}
                  </ChipLabel>
                }
              />
              <StyledTab
                label={
                  <ChipLabel name="BeanNFT DAO">
                    {beaNFTDaoProposals.activeProposals || null}
                  </ChipLabel>
                }
              />
            </ModuleTabs>
            <ModuleContent>
              {tab === 0 && (
                <ProposalList proposals={daoProposals.allProposals} />
              )}
              {tab === 1 && (
                <ProposalList
                  proposals={beanstalkFarmsProposals.allProposals}
                />
              )}
              {tab === 2 && (
                <ProposalList proposals={beanSproutProposals.allProposals} />
              )}
              {tab === 3 && (
                <ProposalList proposals={beaNFTDaoProposals.allProposals} />
              )}
            </ModuleContent>
          </Module>
        </Grid>
      </Grid>
    </>
  );
};

export default GovernanceSpaces;
