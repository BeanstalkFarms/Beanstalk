import {
  Alert,
  Box,
  Button,
  Chip,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import BeanProgressIcon from '~/components/Common/BeanProgressIcon';
import Row from '~/components/Common/Row';
import Centered from '~/components/Common/ZeroState/Centered';
import { Migrate } from '~/components/Silo/Actions/Migrate';
import { DISCORD_LINK } from '~/constants';

import useMigrationNeeded from '~/hooks/farmer/useMigrationNeeded';
import { FC } from '~/types';

import styles from './MigrateTab.module.scss';
import useSdk from '~/hooks/sdk';
import useAccount from '~/hooks/ledger/useAccount';

const bip36 = (
  <Link
    href="https://u6wo3spuuhscwolysdwx2vlxsonfwizumz6et6pnxtbepxbih2jq.arweave.net/p6ztyfSh5Cs5eJDtfVV3k5pbIzRmfEn57bzCR9woPpM"
    target="_blank"
  >
    BIP-36
  </Link>
);

export const MigrateTab: FC<{}> = () => {
  const sdk = useSdk();
  const account = useAccount();
  const migrationNeeded = useMigrationNeeded();

  const [step, setStep] = useState<number>(migrationNeeded ? 1 : 9);
  const nextStep = () => setStep(step + 1);

  useEffect(() => {
    if (migrationNeeded === true) {
      setStep(1);
    } else if (migrationNeeded === false) {
      setStep(9);
    }
  }, [migrationNeeded]);

  if (!account) {
    return (
      <Centered minHeight="400px">
        <Typography variant="body1" textAlign="center">
          Connect your wallet to check migration status
        </Typography>
      </Centered>
    );
  }

  if (account && migrationNeeded === undefined) {
    return (
      <Centered minHeight="400px">
        <BeanProgressIcon size={50} enabled variant="indeterminate" />
        <Typography sx={{ mt: 2 }}>
          Checking your migration status...
        </Typography>
      </Centered>
    );
  }

  return (
    <Box position="relative" overflow="hidden">
      <div className={styles.wrap}>
        <div className={styles.topPlane} />
      </div>
      <Box position="relative" zIndex={2}>
        {step < 9 ? (
          <Centered minHeight="400px">
            {step === 1 && (
              <Stack spacing={2} maxWidth={550}>
                <Typography variant="h1" textAlign="center">
                  Migrate to Silo V3
                </Typography>
                <Row spacing={1}>
                  {[
                    'Instant withdrawals',
                    'Dynamic rewards for deposits',
                    'ERC-1155 tokens',
                  ].map((feature, i) => (
                    <Chip
                      key={i}
                      label={feature}
                      size="medium"
                      color="primary"
                      sx={{ fontWeight: 600 }}
                    />
                  ))}
                </Row>
                <Button variant="contained" size="medium" onClick={nextStep}>
                  Get started
                </Button>
              </Stack>
            )}
            {step === 2 && (
              <Stack textAlign="center" spacing={2} maxWidth={400}>
                <Typography variant="h1">
                  To use the Silo, you need to migrate.
                </Typography>
                <Typography variant="body1">
                  Migrating allows you to use the latest Silo features.
                  You&apos;ll need to pay a one-time transaction fee to perform
                  the migration.
                </Typography>
                <Button variant="contained" size="medium" onClick={nextStep}>
                  Next &rarr;
                </Button>
              </Stack>
            )}
            {step === 3 && (
              <Stack textAlign="center" spacing={2} maxWidth={480}>
                <Typography variant="h1">
                  After you Migrate, you&apos;ll get access to instant Withdrawals.
                </Typography>
                <Typography variant="body1">
                  No more waiting until the end of the Season to claim your assets — Withdrawals happen 
                  instantly and you don&apos;t have to execute a second transaction to claim.
                </Typography>
                <Button variant="contained" size="medium" onClick={nextStep}>
                  Next &rarr;
                </Button>
              </Stack>
            )}
            {step === 4 && (
              <Stack textAlign="center" spacing={2} maxWidth={480}>
                <Typography variant="h1">
                  When you receive new Earned Beans, there&apos;s a short delay
                  before you can claim them.
                </Typography>
                <Typography variant="body1">
                  This only applies to Beans you earned during the last <Typography paddingX={1} sx={{ display:"inline", backgroundColor:"#E9F5EB" }}>gm</Typography> call, which makes Beanstalk more manipulation resistant. 
                  See{' '}{bip36} for details.
                </Typography>
                <Button variant="contained" size="medium" onClick={nextStep}>
                  Next &rarr;
                </Button>
              </Stack>
            )}
            {step === 5 && (
              <Stack textAlign="center" spacing={2} maxWidth={500}>
                <Typography variant="h1">
                  The amount of Grown Stalk you earn each Season is subject to change.
                  {/* The number of Seeds earned for Depositing can change over time. */}
                </Typography>
                <Typography variant="body1">
                  Seeds per BDV for whitelisted assets can now be changed through governance or 
                  automated mechanisms to bolster peg maintenance.
                </Typography>
                <Button variant="contained" size="medium" onClick={nextStep}>
                  Next &rarr;
                </Button>
              </Stack>
            )}
            {step === 6 && (
              <Stack textAlign="center" spacing={2} maxWidth={500}>
                <Typography variant="h1">
                  Unripe Deposits no longer earn Grown Stalk each Season.
                </Typography>
                <Typography variant="body1">
                  {bip36} reduced the Seeds per BDV of urBEAN and urBEAN3CRV to 0 to dramatically reduce the 
                  incentive to not Convert urBEAN3CRV to urBEAN. The change went into effect in Season 14210.
                  <br />
                </Typography>
                <Alert
                  variant="outlined"
                  severity="success"
                  icon={<></>}
                  sx={{ textAlign: 'left', background: 'white' }}
                >
                  <strong>For Unripe holders:</strong> Unripe Depositors haven&apos;t lost any Stalk. 
                  All Stalk earned up to Season 14210 remains.
                </Alert>
                <Button variant="contained" size="medium" onClick={nextStep}>
                  Next &rarr;
                </Button>
              </Stack>
            )}
            {step === 7 && (
              <Stack textAlign="center" spacing={2} maxWidth={500}>
                <Typography variant="h1">
                  Deposits now implement the ERC-1155 standard.
                </Typography>
                <Typography variant="body1">
                  This means Deposits will show up as tokens in popular wallets like 
                  MetaMask and on platforms like OpenSea. After you Migrate, the ERC-1155s 
                  representing your Deposits will be minted directly to your address.
                </Typography>
                <Alert
                  variant="outlined"
                  severity="warning"
                  icon={<></>}
                  sx={{ textAlign: 'left', background: 'white' }}
                >
                  <strong>Heads up!</strong> Sending the Deposit to another
                  address via your wallet means you&apos;ll send the Stalk and
                  Seeds too, just like a Deposit transfer.
                </Alert>
                <Button variant="contained" size="medium" onClick={nextStep}>
                  Next &rarr;
                </Button>
              </Stack>
            )}
            {step === 8 && (
              <Stack textAlign="center" spacing={2} maxWidth={500}>
                <Typography variant="h1">
                  There&apos;s a community to help answer questions.
                </Typography>
                <Typography variant="body1">
                  Check out the{' '}
                  <Link href="https://docs.bean.money" target="_blank">
                    docs
                  </Link>{' '}
                  or join the{' '}
                  <Link href={DISCORD_LINK} target="_blank">
                    Beanstalk Discord
                  </Link>
                  .
                </Typography>
                <Stack spacing={0.5}>
                  <Button variant="contained" size="medium" onClick={nextStep}>
                    Preview migration &rarr;
                  </Button>
                  <Button
                    variant="outlined-secondary"
                    size="medium"
                    onClick={() => setStep(2)}
                  >
                    Start over
                  </Button>
                </Stack>
              </Stack>
            )}
          </Centered>
        ) : null}
        {step === 9 &&
          (migrationNeeded ? (
            <Box minHeight="400px">
              <Migrate />
            </Box>
          ) : (
            <Centered minHeight="400px">
              <Stack spacing={2} maxWidth={550}>
                <Typography variant="h1" textAlign="center">
                  You&apos;ve migrated!
                </Typography>
                <Button
                  variant="contained"
                  size="medium"
                  onClick={() => setStep(2)}
                >
                  Replay onboarding
                </Button>
              </Stack>
            </Centered>
          ))}
      </Box>
    </Box>
  );
};
