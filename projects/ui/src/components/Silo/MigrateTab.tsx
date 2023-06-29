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

// import styles from "./MigrateTab.module.scss"

const bip36 = (
  <Link
    href="https://u6wo3spuuhscwolysdwx2vlxsonfwizumz6et6pnxtbepxbih2jq.arweave.net/p6ztyfSh5Cs5eJDtfVV3k5pbIzRmfEn57bzCR9woPpM"
    target="_blank"
  >
    BIP-36
  </Link>
);

export const MigrateTab: FC<{}> = () => {
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

  if (migrationNeeded === undefined) {
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
    <Box sx={{ position: 'relative', overflow: 'hidden' }}>
      {/* <div className={styles.wrap}>
        <div className={styles.topPlane} />
        <div className={styles.bottomPlane} />
      </div> */}
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
                After you migrate, you&apos;ll get access to instant
                withdrawals.
              </Typography>
              <Typography variant="body1">
                No more waiting for a Season to claim your assets — withdrawals
                happen instantly, and you don&apos;t have to run a second
                transaction to claim.
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
                This only applies to the Beans you received during the last
                Sunrise, and helps prevent certain attacks on Beanstalk. See{' '}
                {bip36} for details.
              </Typography>
              <Button variant="contained" size="medium" onClick={nextStep}>
                Next &rarr;
              </Button>
            </Stack>
          )}
          {step === 5 && (
            <Stack textAlign="center" spacing={2} maxWidth={500}>
              <Typography variant="h1">
                The amount of Stalk you earn each Season might change over time.
              </Typography>
              <Typography variant="body1">
                Seeds are dynamic and can be adjusted over time through
                governance or automated mechanisms to help maintain peg and
                incentivize liquidity.
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
                {bip36} reduced the Seeds per BDV of Unripe BEAN and Unripe
                BEAN:3CRV to 0 to help Beanstalk incentivize peg maintenance
                through conversions.
              </Typography>
              <Alert
                variant="outlined"
                severity="success"
                icon={<></>}
                sx={{ textAlign: 'left' }}
              >
                <strong>For Unripe holders:</strong> you won&apos;t lose any
                Stalk. All the Stalk earned up until BIP-36 will remain attached
                to your Deposits.
              </Alert>
              <Button variant="contained" size="medium" onClick={nextStep}>
                Next &rarr;
              </Button>
            </Stack>
          )}
          {step === 7 && (
            <Stack textAlign="center" spacing={2} maxWidth={500}>
              <Typography variant="h1">
                Deposits are now compatible with the ERC-1155 standard.
              </Typography>
              <Typography variant="body1">
                This means they&apos;ll show up as tokens in popular wallets
                like MetaMask, and can be used on platforms like OpenSea. After
                you migrate, you&apos;ll be able to see your Deposits in your
                wallet.
              </Typography>
              <Alert
                variant="outlined"
                severity="warning"
                icon={<></>}
                sx={{ textAlign: 'left' }}
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
                If you&apos;ve still got questions, there&apos;s a community to
                help.
              </Typography>
              <Typography variant="body1">
                Check out the{' '}
                <Link href="https://docs.bean.money" target="_blank">
                  docs
                </Link>{' '}
                or join the{' '}
                <Link href={DISCORD_LINK} target="_blank">
                  Beanstalk community Discord
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
          <Migrate />
        ) : (
          <Centered minHeight="400px">
            <Stack spacing={2} maxWidth={550}>
              <Typography variant="h1" textAlign="center">
                You&apos;re migrated!
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
  );
};
