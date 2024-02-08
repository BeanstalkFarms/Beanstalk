import React, { useCallback, useEffect, useState } from 'react';
import { Box, Link } from '@mui/material';
import { useProposalsQuery } from '~/generated/graphql';
import useTabs from '~/hooks/display/useTabs';
import { GovSpace, SNAPSHOT_SPACES } from '~/lib/Beanstalk/Governance';
import {
  GOV_SLUGS,
  GOV_SLUGS_TAB_MAP,
  Proposal,
  getGovSpaceLabel,
  getGovSpaceWithTab,
} from '~/util/Governance';
import { Module, ModuleTabs, ModuleContent } from '../Common/Module';
import { StyledTab, ChipLabel } from '~/components/Common/Tabs';
import ProposalList from './Proposals/ProposalList';
import { useAppSelector } from '~/state';
import useFarmerVotingPower from '~/hooks/farmer/useFarmerVotingPower';

const GovernanceSpaces: React.FC<{}> = () => {
  const [tab, handleChange] = useTabs(GOV_SLUGS, 'type');
  const farmerDelegations = useAppSelector((s) => s._farmer.delegations);
  const votingPower = useFarmerVotingPower(getGovSpaceWithTab(tab));

  // Query Proposals
  const { loading, data } = useProposalsQuery({
    variables: { space_in: SNAPSHOT_SPACES },
    fetchPolicy: 'cache-and-network',
    context: { subgraph: 'snapshot' },
  });

  const [oldBips, setOldBips] = useState<Proposal[]>([]);
  const [ebips, setEbips] = useState<Proposal[]>([]);
  const [loadingOtherBips, setLoadingOtherBips] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const getOldBips = await fetch(`/.netlify/functions/oldbipdata?getOldBip=all`)
          .then((response) => response.json())
        const getEbips = await fetch(`/.netlify/functions/ebipdata?getEbip=all`)
          .then((response) => response.json())
        setOldBips(getOldBips);
        setEbips(getEbips);
        setLoadingOtherBips(false);
      } catch (err) {
        console.error(err);
      };
    })();
  }, []);

  /// Helpers
  const filterBySpace = useCallback(
    (t: number) => {
      if (!loading && data?.proposals) {
        if (t < 999) {
          const output = data.proposals.filter(
            (p) =>
              p !== null &&
              p?.space?.id === SNAPSHOT_SPACES[t] &&
              (((p.title.startsWith('BIP') || p.title.startsWith('BOP')) &&
                p.space.id === 'beanstalkdao.eth') ||
                ((p.title.startsWith('Temp-Check') ||
                  p.title.startsWith('BFCP')) &&
                  p.space.id === 'beanstalkfarms.eth') ||
                (p.title.startsWith('BSP') &&
                  p.space.id === 'wearebeansprout.eth') ||
                (p.title.startsWith('BNP') && p.space.id === 'beanft.eth') ||
                (p.title.startsWith('BFBP') && p.space.id === 'beanstalkfarmsbudget.eth') ||
                (p.title.startsWith('BIR') && p.space.id === 'beanstalkbugbounty.eth'))
          );

          if (t === 0 && oldBips) {
            const onchainBips = [...oldBips];
            onchainBips.reverse();
            const withOldBips = output.concat(onchainBips);

            return withOldBips as Proposal[];
          };

          if (t === 99 && ebips) {
            const ebipList = [...ebips];
            ebipList.reverse();
            return ebipList as Proposal[];
          };

          return output as Proposal[];
        }

        if (t === 999) {
          return data.proposals.filter(
            (p) =>
              p !== null &&
              !p.title.startsWith('BIP') &&
              !p.title.startsWith('BOP') &&
              !p.title.startsWith('BFCP') &&
              !p.title.startsWith('Temp-Check') &&
              !p.title.startsWith('BNP') &&
              !p.title.startsWith('BFBP') &&
              !p.title.startsWith('BIR')
          ) as Proposal[];
        }
      }
      return [];
    },
    [data, oldBips, ebips, loading]
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

  const getSnapshotLink = () => {
    const space =
      GOV_SLUGS_TAB_MAP[tab as keyof typeof GOV_SLUGS_TAB_MAP].toString();
    return `https://snapshot.org/#/${space}`;
  };

  const daoProposals = filterProposals(0);
  const beanstalkFarmsProposals = filterProposals(1);
  const beaNFTDaoProposals = filterProposals(3);
  const budgetProposals = filterProposals(4);
  const bugBountyProposals = filterProposals(5);
  const ebipProposals = filterProposals(99);
  const archiveProposals = filterProposals(999);

  return (
    <Module>
      <ModuleTabs value={tab} onChange={handleChange} sx={{ minHeight: 0 }}>
        <StyledTab
          label={
            <ChipLabel name={getGovSpaceLabel(GovSpace.BeanstalkDAO)}>
              {daoProposals.activeProposals || null}
            </ChipLabel>
          }
        />
        <StyledTab
          label={
            <ChipLabel name={getGovSpaceLabel(GovSpace.BeanstalkFarms)}>
              {beanstalkFarmsProposals.activeProposals || null}
            </ChipLabel>
          }
        />
        <StyledTab
          label={
            <ChipLabel name={getGovSpaceLabel(GovSpace.BeanNFT)}>
              {beaNFTDaoProposals.activeProposals || null}
            </ChipLabel>
          }
        />
        <StyledTab
          label={
            <ChipLabel name={getGovSpaceLabel(GovSpace.BeanstalkFarmsBudget)}>
              {null}
            </ChipLabel>
          }
        />
        <StyledTab
          label={
            <ChipLabel name={getGovSpaceLabel(GovSpace.BeanstalkBugBounty)}>
              {null}
            </ChipLabel>
          }
        />
        <StyledTab
          label={
            <ChipLabel name="EBIP">
              {null}
            </ChipLabel>
          }
        />
        <StyledTab
          label={
            <ChipLabel name="Archive">
              {null}
            </ChipLabel>
          }
        />
      </ModuleTabs>
      {tab !== 5 && (
        <Box
          sx={({ breakpoints: bp }) => ({
            position: 'absolute',
            top: '15px',
            right: '20px',
            [bp.down('md')]: {
              display: 'none',
            },
          })}
        >
          <Link
            component="a"
            variant="subtitle1"
            href={getSnapshotLink()}
            target="_blank"
            rel="noreferrer"
          >
            View on Snapshot
          </Link>
        </Box>
      )}
      <ModuleContent>
        {tab === 0 && (
          <ProposalList
            tab={0}
            votingPower={votingPower.votingPower}
            farmerDelegations={farmerDelegations}
            proposals={daoProposals.allProposals}
            isLoading={loading || loadingOtherBips}
          />
        )}
        {tab === 1 && (
          <ProposalList
            tab={1}
            votingPower={votingPower.votingPower}
            farmerDelegations={farmerDelegations}
            proposals={beanstalkFarmsProposals.allProposals}
            isLoading={loading || loadingOtherBips}
          />
        )}
        {tab === 2 && (
          <ProposalList
            tab={2}
            votingPower={votingPower.votingPower}
            farmerDelegations={farmerDelegations}
            proposals={beaNFTDaoProposals.allProposals}
            isLoading={loading || loadingOtherBips}
          />
        )}
        {tab === 3 && (
          <ProposalList
            tab={3}
            proposals={budgetProposals.allProposals}
            isLoading={loading || loadingOtherBips}
          />
        )}
        {tab === 4 && (
          <ProposalList
            tab={4}
            proposals={bugBountyProposals.allProposals}
            isLoading={loading || loadingOtherBips}
          />
        )}
        {tab === 5 && (
          <ProposalList
            tab={5}
            proposals={ebipProposals.allProposals}
            isLoading={loading || loadingOtherBips}
          />
        )}
        {tab === 6 && (
          <ProposalList
            tab={6}
            proposals={archiveProposals.allProposals}
            isLoading={loading || loadingOtherBips}
          />
        )}
      </ModuleContent>
    </Module>
  );
};

export default GovernanceSpaces;
