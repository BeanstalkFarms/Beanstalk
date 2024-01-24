import React, { useState } from 'react';
import {
  Box,
  Link,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { ArrowBackIosNew, ArrowForwardIos } from '@mui/icons-material';
import BigNumber from 'bignumber.js';
import { FC } from '~/types';
import Row from '~/components/Common/Row';
import useTabs from '~/hooks/display/useTabs';
import { displayBN, trimAddress } from '~/util';
import AddressIcon from '~/components/Common/AddressIcon';
import { Proposal } from '~/util/Governance';
import useProposalBlockData from '~/hooks/beanstalk/useProposalBlockData';
import FolderMenu from '~/components/Nav/FolderMenu';

const VotesTable: FC<{
  proposal: Proposal;
  quorum: ReturnType<typeof useProposalBlockData>;
  votes: any;
}> = (props) => {
  const proposal = props.proposal;
  const proposalType = props.quorum.data.type;
  const choices = props.proposal.choices
    ? [...props.proposal.choices]
    : undefined;

  const [tab, handleChangeTab] = useTabs();

  // Bring non-standard choices into For/Abstain/Against format
  if (choices) {
    choices.forEach((choice, index) => {
      if (proposalType === 'BFCP-A') {
        if (choice.startsWith("Don't")) {
          choices[index] = 'Against';
        } else if (choice.startsWith('Add')) {
          choices[index] = 'For';
        }
      } else if (proposalType === 'BFCP-B') {
        if (choice.startsWith('Keep') || choice.startsWith("Don't")) {
          choices[index] = 'Against';
        } else if (choice.startsWith('Remove') || choice.startsWith('Reveal')) {
          choices[index] = 'For';
        }
      } else if (proposalType === 'BFCP-C') {
        const remove1 = choice.replace('Extend ', '');
        const remove2 = remove1.replace("'s term", '');
        const remove3 = remove2.replace("' term", '');
        choices[index] = remove3;
      }
    });
  }

  const votesPerChoice: Array<any[]> = [];

  // Populate votesPerChoice array, each index contains
  // an array of all the votes for that particular choice
  //
  // In multiple-choice proposals, we duplicate votes across
  // choices if necessary
  if (props.votes) {
    props.votes.forEach((vote: any) => {
      if (proposal.type === 'approval') {
        vote.choice.forEach((option: any) => {
          if (!votesPerChoice[option - 1]) {
            votesPerChoice[option - 1] = [vote];
          } else {
            votesPerChoice[option - 1].push(vote);
          }
        });
      } else {
        if (!votesPerChoice[vote.choice - 1]) {
          votesPerChoice[vote.choice - 1] = [vote];
        } else {
          votesPerChoice[vote.choice - 1].push(vote);
        };
      };
    });
  }

  // Pagination
  const votesPerPage = 8;
  const totalVotes = votesPerChoice[tab]?.length || 0;
  const totalPages = Math.ceil(totalVotes / votesPerPage);
  const [currentPage, setCurrentPage] = useState(1);
  const firstVoteOnPage = votesPerPage * currentPage - votesPerPage;
  const lastVoteOnPage = votesPerPage * currentPage - 1;

  return (
    <>
      {props.votes && (
        <Box>
          <Row
            justifyContent="space-between"
            alignItems="center"
            sx={{ p: 2, borderBottom: '0.5px solid', borderColor: 'divider' }}
          >
            <Tabs value={tab} onChange={handleChangeTab} sx={{ minHeight: 0 }}>
              {choices?.map((choice: any) => (
                <Tab label={choice} />
              ))}
            </Tabs>
          </Row>
          <Box sx={{ px: 2, pt: 2, pb: 1, height: '330px' }}>
            {votesPerChoice[tab] && votesPerChoice[tab].length > 0 ? (
              <>
                <Row
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ pb: 2 }}
                >
                  <Box flexGrow={1}>
                    <Typography
                      variant="h4"
                      color="text.secondary"
                      sx={{ fontWeight: 400 }}
                    >
                      Address
                    </Typography>
                  </Box>
                  <Box>
                    <Typography
                      variant="h4"
                      color="text.secondary"
                      sx={{ fontWeight: 400 }}
                    >
                      Votes
                    </Typography>
                  </Box>
                </Row>
                {votesPerChoice[tab].map(
                  (vote: any, index) =>
                    index >= firstVoteOnPage &&
                    index <= lastVoteOnPage && (
                      <Row
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ pb: 1 }}
                      >
                        <Box display="flex" flexDirection="row" flexGrow={1}>
                          <Link
                            href={`https://snapshot.org/#/profile/${vote.voter}`}
                            underline="hover"
                          >
                            <Box display="flex" gap={0.5}>
                              <AddressIcon size={18} address={vote.voter} />
                              <Typography
                                variant="h4"
                                color="text.secondary"
                                sx={{ fontWeight: 400 }}
                              >
                                {trimAddress(vote.voter)}
                              </Typography>
                            </Box>
                          </Link>
                        </Box>
                        <Box>{displayBN(BigNumber(vote.vp))}</Box>
                      </Row>
                    )
                )}
                {totalPages > 1 && (
                  <Row position="absolute" bottom="10px" right="20px" gap={0.5}>
                    <Box
                      sx={{ cursor: 'pointer' }}
                      onClick={() =>
                        setCurrentPage(currentPage > 1 ? currentPage - 1 : 1)
                      }
                    >
                      <ArrowBackIosNew
                        sx={{
                          color:
                            currentPage === 1
                              ? 'text.disabled'
                              : 'text.primary',
                          fontSize: 14,
                        }}
                      />
                    </Box>
                    <Box
                      display="flex"
                      justifyContent="center"
                      sx={{ width: '80px' }}
                    >{`${currentPage} of ${totalPages}`}</Box>
                    <Box
                      sx={{ cursor: 'pointer' }}
                      onClick={() =>
                        setCurrentPage(
                          currentPage < totalPages
                            ? currentPage + 1
                            : totalPages
                        )
                      }
                    >
                      <ArrowForwardIos
                        sx={{
                          color:
                            currentPage === totalPages
                              ? 'text.disabled'
                              : 'text.primary',
                          fontSize: 14,
                        }}
                      />
                    </Box>
                  </Row>
                )}
              </>
            ) : (
              <Box
                height={250}
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Typography color="text.tertiary" align="center">
                  There are no votes for this choice.
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </>
  );
};

const ListOfVotes: FC<{
  proposal: Proposal;
  quorum: ReturnType<typeof useProposalBlockData>;
  votes: any;
}> = (props) => {
  const proposal = props.proposal;
  const quorum = props.quorum;
  const votes = props.votes;

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  return isMobile ? (
    <FolderMenu
      buttonContent={<>See List of Votes</>}
      drawerContent={
        <VotesTable proposal={proposal} quorum={quorum} votes={votes} />
      }
      hotkey=""
      sx={{ width: '100%' }}
    />
  ) : (
    <VotesTable proposal={proposal} quorum={quorum} votes={votes} />
  );
};

export default ListOfVotes;
