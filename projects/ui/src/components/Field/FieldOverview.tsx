import React, { useEffect } from 'react';
import { Card, Stack } from '@mui/material';

import { BeanstalkPalette } from '~/components/App/muiTheme';
import EmbeddedCard from '~/components/Common/EmbeddedCard';

import { useAppSelector } from '~/state';

import Temperature from '~/components/Analytics/Field/Temperature';
import FieldConditionsHeader from '~/components/Field/FieldConditionsHeader';
import FieldStats from '~/components/Field/FieldStats';
import MorningTemperature from '~/components/Field/Chart';
import FieldInfo from '~/components/Field/FieldInfo';
import useToggle from '~/hooks/display/useToggle';

const CHART_HEIGHT = '200px';

const getSx = (isMorning: boolean) => ({
  borderColor: isMorning ? BeanstalkPalette.mediumYellow : undefined,
  background: isMorning ? BeanstalkPalette.lightYellow : undefined,
});

const FieldOverview: React.FC<{}> = () => {
  const [open, show, hide] = useToggle();

  const isMorning = useAppSelector((s) => s._beanstalk.sun.morning.isMorning);

  const toggle = () => {
    if (isMorning) return;
    if (open) {
      hide();
    } else {
      show();
    }
  };

  useEffect(() => {
    if (isMorning && open) {
      hide();
    }
  }, [hide, isMorning, open]);

  return (
    <Card sx={getSx(isMorning || open)}>
      <Stack gap={2} p={2} boxSizing="border-box">
        <FieldConditionsHeader toggled={open} toggleMorning={toggle} />
        <EmbeddedCard>
          <Stack gap={2} p={2}>
            {isMorning || open ? (
              <MorningTemperature show={open} height={CHART_HEIGHT} />
            ) : (
              <Temperature height={CHART_HEIGHT} statsRowFullWidth />
            )}
            <FieldStats />
          </Stack>
        </EmbeddedCard>
        <FieldInfo />
      </Stack>
    </Card>
  );
};

export default FieldOverview;
