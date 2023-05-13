import React from 'react';
import { Card, Stack } from '@mui/material';

import { useSelector } from 'react-redux';
import { BeanstalkPalette } from '~/components/App/muiTheme';
import EmbeddedCard from '~/components/Common/EmbeddedCard';

import useSdk from '~/hooks/sdk';

import { AppState } from '~/state';
import { BeanstalkField } from '~/state/beanstalk/field';
import { Sun } from '~/state/beanstalk/sun';

import Temperature from '~/components/Analytics/Field/Temperature';
import FieldConditionsHeader from '~/components/Field/FieldConditionsHeader';
import FieldStats from '~/components/Field/FieldStats';
import MorningTemperature from '~/components/Field/Chart';
import FieldInfo from '~/components/Field/FieldInfo';

const CHART_HEIGHT = '200px';

const getSx = (isMorning: boolean) => ({
  borderColor: isMorning ? BeanstalkPalette.mediumYellow : undefined,
  background: isMorning ? BeanstalkPalette.lightYellow : undefined,
});

const FieldOverview: React.FC<{
  beanstalkField: BeanstalkField;
}> = ({ beanstalkField }) => {
  const sdk = useSdk();

  const morning = useSelector<AppState, Sun['morning']>(
    (state) => state._beanstalk.sun.morning
  );
  const isMorning = morning.isMorning;

  return (
    <Card sx={getSx(isMorning)}>
      <Stack gap={2} p={2} boxSizing="border-box">
        <FieldConditionsHeader />
        <EmbeddedCard>
          <Stack gap={2} p={2}>
            {isMorning ? (
              <MorningTemperature height={CHART_HEIGHT} />
            ) : (
              <Temperature height={CHART_HEIGHT} statsRowFullWidth />
            )}
            <FieldStats beanstalkField={beanstalkField} />
          </Stack>
        </EmbeddedCard>
        <FieldInfo
          harvestableIndex={beanstalkField.harvestableIndex}
          PODS={sdk.tokens.PODS}
        />
      </Stack>
    </Card>
  );
};

export default FieldOverview;
