import React from 'react';
import { Accordion, AccordionDetails, Box, Divider, Grid, Stack, Typography } from '@mui/material';
import { SupportedChainId } from '~/constants/chains';
import { BEAN, STALK } from '~/constants/tokens';
import AccordionWrapper from '~/components/Common/Accordion/AccordionWrapper';
import StyledAccordionSummary from '~/components/Common/Accordion/AccordionSummary';
import TokenIcon from '~/components/Common/TokenIcon';
import Row from '~/components/Common/Row';
import { FC } from '~/types';

// ---------------------------------------------------------------

const Stat : FC<{ name: string }> = ({ children, name }) => (
  <Row justifyContent="space-between">
    <Typography variant="h4">{name}</Typography>
    <Typography variant="h4" textAlign="right">{children}</Typography>
  </Row>
);

const StatColumn : FC<{
  title: string;
  icon: JSX.Element
}> = ({
  title,
  icon,
  children
}) => (
  <Grid item xs={6}>
    <Stack gap={1}>
      <Row justifyContent="space-between">
        <Typography variant="h3">{title}</Typography>
        <Row>{icon}</Row>
      </Row>
      {children}
    </Stack>
  </Grid>
);

const NextSeason : FC<{ title: string | JSX.Element }> = ({ title }) => (
  <AccordionWrapper>
    <Accordion>
      <StyledAccordionSummary
        title={title}
        icon={<Typography>⏱</Typography>}
        gradientText={false}
      />
      <AccordionDetails sx={{ p: 0, pb: 2 }}>
        {/* Primary */}
        <Box sx={{ px: 2 }}>
          <Grid container columnSpacing={4}>
            {/* Bean Rewards */}
            <StatColumn title="Bean Rewards" icon={<TokenIcon token={BEAN[SupportedChainId.MAINNET]} />}>
              <Stat name="New Beans">
                730,012
              </Stat>
              <Stat name="% of new Beans allocated to the Silo">
                33.3333%
              </Stat>
              <Stat name="My % Ownership of Stalk">
                0.1012%
              </Stat>
            </StatColumn>
            {/* Stalk Rewards */}
            <StatColumn title="Stalk Rewards" icon={<TokenIcon token={STALK} />}>
              <Stat name="My Seed Balance">
                730,012
              </Stat>
              <Stat name="New Stalk per Seed">
                0.0001
              </Stat>
            </StatColumn>
          </Grid>
        </Box>
        <Divider sx={{ borderColor: 'secondary', my: 2 }} />
        {/* Summary */}
        <Box sx={{ px: 2 }}>
          <Grid container columnSpacing={4}>
            <StatColumn
              title="My New Earned Beans"
              icon={(
                <>
                  <Row gap={0.3}>
                    <TokenIcon token={BEAN[SupportedChainId.MAINNET]} />
                    <Typography variant="h3">
                      244.33
                    </Typography>
                  </Row>
                </>
              )}
            />
            <StatColumn
              title="My New Earned Stalk"
              icon={(
                <>
                  <Row gap={0.3}>
                    <TokenIcon token={STALK} />
                    <Typography variant="h3">
                      244.33
                    </Typography>
                  </Row>
                </>
              )}
            />
          </Grid>
        </Box>
      </AccordionDetails>
    </Accordion>
  </AccordionWrapper>
);

export default NextSeason;
