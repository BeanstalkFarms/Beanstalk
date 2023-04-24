import React from 'react';
import { Card, Stack } from '@mui/material';

import { useSelector } from 'react-redux';
import { BeanstalkPalette } from '~/components/App/muiTheme';
import EmbeddedCard from '~/components/Common/EmbeddedCard';

import useSdk from '~/hooks/sdk';

import { AppState } from '~/state';
import { selectMorning } from '~/state/beanstalk/sun';

import Temperature from '~/components/Analytics/Field/Temperature';
import FieldConditionsHeader from '~/components/Field/FieldConditionsHeader';
import FieldStats from '~/components/Field/FieldStats';
import MorningTemperature from '~/components/Field/Chart';
import FieldInfo from './FieldInfo';

const FieldOverview: React.FC<{
  beanstalkField: AppState['_beanstalk']['field'];
}> = ({ beanstalkField }) => {
  const sdk = useSdk();

  const { isMorning } = useSelector(selectMorning);

  return (
    <Card
      sx={{
        borderColor: isMorning ? BeanstalkPalette.mediumYellow : undefined,
        background: isMorning ? BeanstalkPalette.lightYellow : undefined,
      }}
    >
      <Stack gap={2} p={2} boxSizing="border-box">
        <FieldConditionsHeader />
        <EmbeddedCard>
          <Stack gap={2} p={2}>
            {isMorning ? <MorningTemperature /> : <Temperature />}
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
