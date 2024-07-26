import { Box, Card, Grid, Stack, Typography } from '@mui/material';
import React, { useMemo, useState } from 'react';
import DropdownIcon from '~/components/Common/DropdownIcon';
import useSeedGauge, {
  TokenSeedGaugeInfo,
} from '~/hooks/beanstalk/useSeedGauge';
import { displayFullBN } from '~/util';
import { ZERO_BN } from '~/constants';
import useSdk from '~/hooks/sdk';
import { Token } from '@beanstalk/sdk';
import BeanProgressIcon from '~/components/Common/BeanProgressIcon';
import SeasonsToCatchUpInfo from './SeasonsToCatchUpInfo';
import SeedGaugeTable from './SeedGaugeTable';
import Bean2MaxLPRatio from './Bean2MaxLPRatio';

const TARGET_SEASONS_TO_CATCH_UP = 4320;
const MONTHS_TO_CATCH_UP = 6;

interface ISeedGaugeCardInfo {
  title: string;
  subtitle: string | JSX.Element;
}

interface ISeedGaugeInfoCardProps extends ISeedGaugeCardInfo {
  active: boolean;
  loading?: boolean;
  setActive: () => void;
}

const SeedGaugeInfoCard = ({
  title,
  subtitle,
  active,
  loading,
  setActive,
}: ISeedGaugeInfoCardProps) => (
  <Card
    onClick={!loading ? setActive : () => {}}
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
        {loading ? (
          <BeanProgressIcon size={10} enabled variant="indeterminate" />
        ) : (
          <DropdownIcon open={active} sx={{ fontSize: '1.25rem' }} />
        )}
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

  const handleSetActiveIndex = (index: number) => {
    const newIndex = activeIndex === index ? -1 : index;
    setActiveIndex(newIndex);
  };

  const cardData = useMemo(() => {
    const arr: ISeedGaugeCardInfo[] = [];

    arr.push({
      title: 'Target Seasons to Catch Up',
      subtitle: (
        <Typography color="text.primary">
          {TARGET_SEASONS_TO_CATCH_UP} Seasons, ~{MONTHS_TO_CATCH_UP} months
        </Typography>
      ),
    });

    arr.push({
      title: 'Bean to Max LP Ratio',
      subtitle: (
        <Typography color="text.secondary">
          <Typography component="span" color="text.primary">
            {data?.maxBean2LPRatio
              ? displayFullBN(data?.maxBean2LPRatio || ZERO_BN, 0)
              : '--'}
            %
          </Typography>{' '}
          Seed reward for Beans vs. the Max LP token
        </Typography>
      ),
    });

    type TokenWithGP = {
      token: Token;
    } & TokenSeedGaugeInfo;

    const tokensWithGP: TokenWithGP[] = [];

    if (data?.gaugeData) {
      // filter out tokens with 0 optimalPercentDepositedBdv
      for (const token of [...sdk.tokens.siloWhitelist]) {
        const setting = data.gaugeData[token.address];
        if (setting?.optimalPctDepositedBdv?.gt(0)) {
          tokensWithGP.push({ token: token, ...setting });
        }
      }
      // sort by optimalPercentDepositedBdv
      tokensWithGP.sort(
        (a, b) =>
          b.optimalPctDepositedBdv
            ?.minus(a.optimalPctDepositedBdv || ZERO_BN)
            .toNumber() || 0
      );
    }

    arr.push({
      title: 'Optimal Distribution of LP',
      subtitle: (
        <Typography color="text.secondary">
          {tokensWithGP.length
            ? tokensWithGP.map((datum, i) => {
                const symbol = datum.token.symbol;
                const pct = datum.optimalPctDepositedBdv;

                return (
                  <React.Fragment key={`gp-text-${i}`}>
                    {symbol}{' '}
                    <Typography component="span" color="text.primary">
                      {pct ? displayFullBN(pct, 0) : '-'}%
                    </Typography>
                    {i !== tokensWithGP.length - 1 ? ', ' : ''}
                  </React.Fragment>
                );
              })
            : '--'}
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
            setActive={() => handleSetActiveIndex(i)}
            loading={isLoading}
            {...info}
          />
        </Grid>
      ))}
    </Grid>
  );
};

const SeedGaugeInfoSelected = ({
  activeIndex,
  data,
}: {
  activeIndex: number;
  data: ReturnType<typeof useSeedGauge>['data'];
}) => {
  if (activeIndex === -1) return null;

  return (
    <Card>
      {activeIndex === 0 ? <SeasonsToCatchUpInfo /> : null}
      {activeIndex === 1 ? <Bean2MaxLPRatio data={data} /> : null}
      {activeIndex === 2 ? <SeedGaugeTable data={data} /> : null}
    </Card>
  );
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
      <SeedGaugeInfoSelected activeIndex={activeIndex} data={query.data} />
    </Stack>
  );
};

export default SeedGaugeInfo;
