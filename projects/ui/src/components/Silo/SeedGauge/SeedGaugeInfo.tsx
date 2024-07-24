import { Box, Card, Grid, Stack, Typography } from '@mui/material';
import React, { useMemo, useState } from 'react';
import DropdownIcon from '~/components/Common/DropdownIcon';
import useSeedGauge, { TokenSettingMap } from '~/hooks/beanstalk/useSeedGauge';
import { displayFullBN } from '~/util';
import { ZERO_BN } from '~/constants';
import useSdk from '~/hooks/sdk';
import { Token } from '@beanstalk/sdk';
import SeasonsToCatchUpInfo from './SeasonsToCatchUpInfo';

interface ISeedGaugeCardInfo {
  title: string;
  subtitle: string | JSX.Element;
}

interface ISeedGaugeInfoCardProps extends ISeedGaugeCardInfo {
  active: boolean;
  setActive: () => void;
}
const SeedGaugeInfoCard = ({
  title,
  subtitle,
  active,
  setActive,
}: ISeedGaugeInfoCardProps) => (
  <Card
    onClick={setActive}
    sx={({ breakpoints }) => ({
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      cursor: 'pointer',
      borderColor: active && 'primary.main',
      ':hover': {
        borderColor: 'primary.main',
      },
      [breakpoints.down('md')]: {
        backgroundColor: 'light.main',
      },
    })}
  >
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      py={{ xs: 1, md: 2 }}
      px={{ xs: 1, md: 1.5 }}
      height="100%"
    >
      <Stack gap={0.5} alignSelf="flex-start">
        <Typography variant="h4">{title}</Typography>
        {typeof subtitle === 'string' ? (
          <Typography>{subtitle}</Typography>
        ) : (
          subtitle
        )}
      </Stack>

      <Box alignSelf="center">
        <DropdownIcon open={active} sx={{ fontSize: '1.25rem' }} />
      </Box>
    </Stack>
  </Card>
);

const SeedGaugeSelect = ({
  gaugeQuery: { data, isLoading },
  activeIndex,
  setActiveIndex,
}: {
  gaugeQuery: ReturnType<typeof useSeedGauge>;
  activeIndex: number;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
}) => {
  const sdk = useSdk();

  const hastSetActiveIndex = (index: number) => {
    const newIndex = activeIndex === index ? -1 : index;
    setActiveIndex(newIndex);
  };

  const cardData = useMemo(() => {
    const arr: ISeedGaugeCardInfo[] = [];

    arr.push({
      title: 'Target Seasons to Catch Up',
      subtitle: (
        <Typography color="text.primary">4320 Seasons, ~6 months</Typography>
      ),
    });

    arr.push({
      title: 'Bean to Max LP Ratio',
      subtitle: (
        <Typography color="text.secondary">
          <Typography component="span" color="text.primary">
            {displayFullBN(data?.maxBean2LPRatio || ZERO_BN, 0)}%
          </Typography>{' '}
          Seed reward for Beans vs. the Max LP token
        </Typography>
      ),
    });

    type TokenWithGP = {
      token: Token;
    } & TokenSettingMap[string];

    const tokensWithGp: TokenWithGP[] = [];

    if (data?.tokenSettings) {
      for (const token of [...sdk.tokens.siloWhitelist]) {
        const setting = data.tokenSettings[token.address];
        if (setting?.optimalPercentDepositedBdv.gt(0)) {
          tokensWithGp.push({ token: token, ...setting });
        }
      }
    }

    const sortedTokensWithGP = tokensWithGp.sort((a, b) =>
      Number(
        b.optimalPercentDepositedBdv
          .minus(a.optimalPercentDepositedBdv)
          .toString()
      )
    );

    arr.push({
      title: 'Optimal Distribution of LP',
      subtitle: (
        <Typography color="text.secondary">
          {sortedTokensWithGP.map((datum, i) => {
            const symbol = datum.token.symbol;
            const pct = datum.optimalPercentDepositedBdv;

            return (
              <React.Fragment key={`gp-text-${i}`}>
                {symbol}{' '}
                <Typography component="span" color="text.primary">
                  {displayFullBN(pct, 0)}%
                </Typography>
                {i !== sortedTokensWithGP.length - 1 ? ', ' : ''}
              </React.Fragment>
            );
          })}
        </Typography>
      ),
    });
    return arr;
  }, [sdk, data]);

  return (
    <Grid container direction={{ xs: 'column', md: 'row' }} spacing={2}>
      {cardData.map((info, i) => (
        <Grid item xs={12} md={4} key={`sgi-${i}`}>
          <SeedGaugeInfoCard
            active={activeIndex === i}
            setActive={() => hastSetActiveIndex(i)}
            {...info}
          />
        </Grid>
      ))}
    </Grid>
  );
};

const SeedGaugeInfoSelected = ({ activeIndex }: { activeIndex: number }) => {
  if (activeIndex === -1) return null;

  return <Card>{activeIndex === 0 ? <SeasonsToCatchUpInfo /> : null}</Card>;
};

const SeedGaugeInfo = () => {
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const query = useSeedGauge();

  return (
    <Stack gap={2}>
      <SeedGaugeSelect
        key="seed-gauge-select"
        activeIndex={activeIndex}
        gaugeQuery={query}
        setActiveIndex={setActiveIndex}
      />
      <SeedGaugeInfoSelected activeIndex={activeIndex} />
    </Stack>
  );
};

export default SeedGaugeInfo;
