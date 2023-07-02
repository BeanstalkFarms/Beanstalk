import React, { useCallback, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { LoadingButton } from '@mui/lab';
import { FC } from '~/types';
import Row from '~/components/Common/Row';
import Deposits from '~/components/Silo/Actions/Deposits';

import useAccount from '~/hooks/ledger/useAccount';
import useFarmerSiloBalances from '~/hooks/farmer/useFarmerSiloBalances';
import useSdk, { getNewToOldToken } from '~/hooks/sdk';
import TokenIcon from '~/components/Common/TokenIcon';
import { BeanstalkPalette, IconSize } from '~/components/App/muiTheme';
import { displayFullBN } from '~/util';
import { fetchMigrationData } from '~/state/farmer/silo/updater';

const getMigrationParams = async (account: string) => {
  const data = await fetchMigrationData(account);

  const tokens = Object.keys(data.deposits); // token addresses
  const seasons: string[][] = [];
  const amounts: string[][] = [];

  tokens.forEach((token) => {
    const crates = data.deposits[token];

    const _seasons = Object.keys(crates);
    const _amounts = Object.values(crates).map((crate) => crate.amount);

    seasons.push(_seasons);
    amounts.push(_amounts);
  });

  return {
    tokens,
    seasons,
    amounts,
    stalkDiff: data.merkle?.stalk ?? '0',
    seedsDiff: data.merkle?.seeds ?? '0',
    proof: data.merkle.proof ?? [],
  };
};

export const Migrate: FC<{}> = () => {
  const account = useAccount();
  const siloBalance = useFarmerSiloBalances();
  const sdk = useSdk();

  const [migrating, setMigrating] = useState(false);

  const migrate = useCallback(() => {
    (async () => {
      if (!account) return;
      setMigrating(true);

      const params = await getMigrationParams(account);
      console.log(`Migrating...`, params);

      try {
        if (params.tokens.length === 0) {
          await sdk.contracts.beanstalk.mowAndMigrateNoDeposits(account);
        } else {
          await sdk.contracts.beanstalk.mowAndMigrate(
            account,
            params.tokens,
            params.seasons,
            params.amounts,
            params.stalkDiff,
            params.seedsDiff,
            params.proof
          );
        }
      } catch (e) {
        console.error(e);
      } finally {
        setMigrating(false);
      }
    })();
  }, [account, sdk.contracts.beanstalk]);

  return (
    <Row p={2} spacing={2} alignItems="start">
      <Box flex={3}>
        <Stack spacing={1}>
          <Typography variant="h3" textAlign="left">
            Preview migration
          </Typography>
          <Box
            sx={{
              borderColor: BeanstalkPalette.lightestGrey,
              borderWidth: 1,
              borderStyle: 'solid',
              borderRadius: 1,
            }}
          >
            {[...sdk.tokens.siloWhitelist].map((token) => {
              const oldToken = getNewToOldToken(token);
              const oldBalance = siloBalance[oldToken.address.toLowerCase()];
              if (!oldBalance) return null;

              return (
                <Accordion
                  variant="elevation"
                  key={token.address}
                  sx={{
                    '::before': { display: 'none' },
                    borderBottom: `1px solid ${BeanstalkPalette.lightestGrey}`,
                    ':last-child': { borderBottom: 'none' },
                  }}
                >
                  <AccordionSummary
                    expandIcon={
                      <ExpandMoreIcon
                        sx={{
                          color: 'primary.main',
                          fontSize: IconSize.xs,
                        }}
                      />
                    }
                  >
                    <Row spacing={1} width="100%">
                      <TokenIcon token={token} />
                      <Typography color="text.primary">
                        {token.displayName}
                        <Typography color="text.secondary">{`${
                          oldBalance.deposited.crates.length
                        } Deposit${
                          oldBalance.deposited.crates.length > 1 ? 's' : ''
                        }`}</Typography>
                      </Typography>
                      <Box sx={{ flex: 1, textAlign: 'right', pr: 1 }}>
                        <Chip
                          label={`${displayFullBN(
                            oldBalance.deposited.amount
                          )} ${oldToken.symbol}`}
                          size="medium"
                          color="primary"
                        />
                      </Box>
                    </Row>
                  </AccordionSummary>
                  <AccordionDetails sx={{ py: 0, px: 1.5 }}>
                    <Deposits
                      token={oldToken}
                      siloBalance={oldBalance}
                      maxRows={100}
                      onlyTable
                      hideFooter
                    />
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>
          <LoadingButton
            loading={migrating}
            variant="contained"
            color="primary"
            fullWidth
            size="large"
            onClick={migrate}
          >
            Migrate
          </LoadingButton>
        </Stack>
      </Box>
      <Box flex={2} />
    </Row>
  );
};
