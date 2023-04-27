import React from 'react';
import { Card, Stack } from '@mui/material';

import { useSelector } from 'react-redux';
import { BeanstalkPalette } from '~/components/App/muiTheme';
import EmbeddedCard from '~/components/Common/EmbeddedCard';

import useSdk from '~/hooks/sdk';

import { selectMorning } from '~/state/beanstalk/sun';

import Temperature from '~/components/Analytics/Field/Temperature';
import FieldConditionsHeader from '~/components/Field/FieldConditionsHeader';
import FieldStats from '~/components/Field/FieldStats';
import MorningTemperature from '~/components/Field/Chart';
import FieldInfo from '~/components/Field/FieldInfo';
import { BeanstalkField } from '~/state/beanstalk/field';

const CHART_HEIGHT = '200px';

const FieldOverview: React.FC<{
  beanstalkField: BeanstalkField;
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
