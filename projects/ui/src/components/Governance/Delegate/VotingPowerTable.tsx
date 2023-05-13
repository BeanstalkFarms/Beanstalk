import React from 'react';
import { Box, Stack, Typography, Link } from '@mui/material';
import BigNumber from 'bignumber.js';
import { GovSpace } from '~/lib/Beanstalk/Governance';
import { STALK } from '~/constants/tokens';
import { displayBN, displayFullBN, trimAddress } from '~/util';
import { BeanstalkPalette, IconSize } from '~/components/App/muiTheme';
import Row from '~/components/Common/Row';
import TokenIcon from '~/components/Common/TokenIcon';
import useAccount from '~/hooks/ledger/useAccount';
import AddressIcon from '~/components/Common/AddressIcon';
import beanNFTIconDark from '~/img/tokens/beanft-dark-logo.svg';
import useFarmerVotingPower from '~/hooks/farmer/useFarmerVotingPower';

const FarmerRow: React.FC<{
  address: string;
  amount: BigNumber;
  isNFT?: boolean;
}> = ({ address, amount, isNFT = false }) => (
  <Row gap={0.5} width="100%" justifyContent="space-between">
    <Row gap={0.3}>
      <AddressIcon address={address} size={IconSize.xs} />
      <Link
        component="a"
        variant="body1"
        href={`https://snapshot.org/#/profile/${address}`}
        target="_blank"
        rel="noreferrer"
        color="inherit"
      >
        {trimAddress(address)}
      </Link>
    </Row>
    {isNFT ? (
      <Row gap={0.3}>
        <img
          src={beanNFTIconDark}
          alt="beanft"
          width={IconSize.xs}
          css={{
            height: IconSize.xs,
            marginBottom: '2px',
          }}
        />
        <Typography>{displayBN(amount)} BEANFT</Typography>
      </Row>
    ) : (
      <Row gap={0.3}>
        <TokenIcon token={STALK} css={{ height: IconSize.xs }} />
        <Typography>{displayBN(amount)} STALK</Typography>
      </Row>
    )}
  </Row>
);

const VotingPowerTable: React.FC<{ space: GovSpace }> = ({ space }) => {
  const { votingPower, delegators } = useFarmerVotingPower(space);
  const account = useAccount();

  const isNFT = space === GovSpace.BeanNFT;

  return (
    <Stack gap={2}>
      <Stack gap={1}>
        <Typography variant="h4">{space.toString()}</Typography>
        <Typography color="text.secondary">
          {`Your total number of votes includes your own ${
            isNFT ? 'BeaNFTs' : 'Stalk'
          } and any ${isNFT ? 'BeaNFTs' : 'Stalk'} that ${
            isNFT ? 'have' : 'has'
          } been delegated to you.`}
        </Typography>
        {space !== GovSpace.BeanNFT ? (
          <Row gap={0.5}>
            <TokenIcon token={STALK} css={{ height: IconSize.small }} />
            <Typography variant="bodyLarge">
              {displayFullBN(votingPower.farmer, 0)} STALK
            </Typography>
          </Row>
        ) : (
          <Row gap={0.3}>
            <img
              src={beanNFTIconDark}
              alt="beanft"
              css={{
                width: IconSize.small,
                height: IconSize.small,
                marginBottom: '2px',
              }}
            />
            <Typography variant="bodyLarge">
              {displayFullBN(votingPower.farmer, 0)} BEANFT
            </Typography>
          </Row>
        )}
      </Stack>
      <>
        <Box
          sx={{
            width: '100%',
            borderBottom: '0.5px solid',
            borderColor: BeanstalkPalette.blue,
          }}
        />
        <Stack gap={2}>
          <Stack gap={2}>
            <Typography color="text.secondary" variant="subtitle2">
              My {!isNFT ? 'Stalk' : 'BeaNFTs'}
            </Typography>
            {account ? (
              <FarmerRow
                amount={votingPower.farmer}
                address={account}
                isNFT={space === GovSpace.BeanNFT}
              />
            ) : (
              <Row />
            )}
          </Stack>
          {delegators.length > 0 ? (
            <Stack gap={2}>
              <Typography color="text.secondary" variant="subtitle2">
                My Delegators
              </Typography>
              <Stack gap={1}>
                {delegators.map(({ address, amount }, i) => (
                  <FarmerRow
                    key={`${address}-${i}`}
                    address={address}
                    amount={amount}
                    isNFT={space === GovSpace.BeanNFT}
                  />
                ))}
              </Stack>
            </Stack>
          ) : (
            <Stack alignSelf="flex-start">
              <Link
                color="primary.main"
                variant="subtitle2"
                component="a"
                href="https://discord.com/channels/880413392916054098/1092912362295668828"
                rel="noreferrer"
                target="_blank"
              >
                Apply to be a delegate
              </Link>
            </Stack>
          )}
        </Stack>
      </>
    </Stack>
  );
};

export default VotingPowerTable;
