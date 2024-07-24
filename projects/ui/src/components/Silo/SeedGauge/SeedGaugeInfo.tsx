import { Box, Card, Grid, Stack, Typography } from '@mui/material';
import React, { useMemo, useState } from 'react';
import { BeanstalkPalette as Palette } from '~/components/App/muiTheme';
import DropdownIcon from '~/components/Common/DropdownIcon';

type ISeedGuageCardInfo = {
  title: string;
  subtitle: string | JSX.Element;
};

type SeedGaugeInfoCardProps = {
  title: string;
  subtitle: string | JSX.Element;
  active: boolean;
  setActive: () => void;
};
const SeedGaugeInfoCard = ({
  title,
  subtitle,
  active,
  setActive,
}: SeedGaugeInfoCardProps) => (
  <Card
    onClick={setActive}
    sx={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      // justifyContent: 'flex-start',
      cursor: 'pointer',
      borderColor: active ? Palette.logoGreen : Palette.skyBlue,
      ':hover': {
        borderColor: Palette.logoGreen,
      },
    }}
  >
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      py={2}
      px={1.5}
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

      <Box sx={{ alignSelf: 'center' }}>
        <DropdownIcon open={active} sx={{ fontSize: '1.25rem' }} />
      </Box>
    </Stack>
  </Card>
);

const SeedGaugeCards = ({
  activeIndex,
  setActiveIndex,
}: {
  activeIndex: number;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
}) => {
  const hastSetActiveIndex = (index: number) => {
    const newIndex = activeIndex === index ? -1 : index;
    setActiveIndex(newIndex);
  };

  const data = useMemo(() => {
    const datas: ISeedGuageCardInfo[] = [
      {
        title: 'Target Seasons to Catch Up',
        subtitle: (
          <Typography color="text.primary">4320 Seasons, ~6 months</Typography>
        ),
      },
      {
        title: 'Bean to Max LP Ratio',
        subtitle: (
          <Typography color="text.secondary">
            <Typography component="span" color="text.primary">
              60%
            </Typography>{' '}
            Seed reward for Beans vs. the Max LP token
          </Typography>
        ),
      },
      {
        title: 'Optimal Distribution of LP',
        subtitle: (
          <Typography color="text.secondary">
            BEAN:ETH{' '}
            <Typography component="span" color="text.primary">
              100%
            </Typography>
          </Typography>
        ),
      },
    ];
    return datas;
  }, []);

  return (
    <Grid container direction={{ xs: 'column', md: 'row' }} spacing={2}>
      {data.map((info, i) => (
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

const SeedGaugeInfo = () => {
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  return (
    <Stack gap={2}>
      <SeedGaugeCards
        activeIndex={activeIndex}
        setActiveIndex={setActiveIndex}
      />
    </Stack>
  );
};

export default SeedGaugeInfo;
