import React, { useMemo, useState } from 'react';
import { FC } from '~/types';
import { Box, Button, Card, CircularProgress } from '@mui/material';
import useSeasonsQuery from '~/hooks/beanstalk/useSeasonsQuery';
import useTimeTabState from '~/hooks/app/useTimeTabState';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import useToggle from '~/hooks/display/useToggle';
import { getFormattedAndExtraData } from './formatters';
import ChartV2 from './ChartV2';
import TimeTabs from '../Common/Charts/TimeTabs';
import DropdownIcon from '../Common/DropdownIcon';
import SelectDialog from './SelectDialog';
import { useChartSetupData } from './useChartSetupData';

const MegaChart: FC<{}> = () => {

  const chartSetupData = useChartSetupData();

  const timeTabParams = useTimeTabState();
  const selectedTimePeriod = timeTabParams[0][1];

  const [dialogOpen, showDialog, hideDialog] = useToggle();
  const [selectedCharts, setSelectedCharts] = useState([0]);

  const query0Config = useMemo(() => ( chartSetupData[selectedCharts[0]]?.queryConfig ), [selectedCharts, chartSetupData]);
  const query1Config = useMemo(() => ( chartSetupData[selectedCharts[1]]?.queryConfig ), [selectedCharts, chartSetupData]);
  const query2Config = useMemo(() => ( chartSetupData[selectedCharts[2]]?.queryConfig ), [selectedCharts, chartSetupData]);

  // Subgraph queries
  const query0 = useSeasonsQuery(chartSetupData[selectedCharts[0]]?.document, selectedTimePeriod, query0Config);
  const query1 = useSeasonsQuery(chartSetupData[selectedCharts[1]]?.document, selectedTimePeriod, query1Config);
  const query2 = useSeasonsQuery(chartSetupData[selectedCharts[2]]?.document, selectedTimePeriod, query2Config);

  // Formatting data
  const { formattedData: priceFormattedData, extraData } = getFormattedAndExtraData(
    [query0, query1, query2],
    selectedCharts,
    chartSetupData
  );

  const loading = query0.loading && query1.loading && query2.loading;

  return (
    <>
      <Box display='flex' flexDirection='row' gap={2}>
        <Card sx={{ position: 'relative', width: '100%', height: 400 }}>
          <Card sx={{ position: 'absolute', left: (dialogOpen ? '0%' : '-100%'), width: 600, zIndex: 4, height: 400, transition: 'left 0.3s' }}>
            <SelectDialog
              handleClose={hideDialog}
              selected={selectedCharts}
              setSelected={setSelectedCharts}
            />
          </Card>
        <Box p={1.5} sx={{ borderBottom: '0.5px', borderColor: 'divider', borderBottomStyle: 'solid', display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {selectedCharts.map((selection, index) =>(
            <Button
              variant='outlined-secondary'
              color='secondary'
              size='small'
              key={`selectedChartsButton${index}`}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                cursor: 'pointer',
                border: '0.5px solid',
                borderColor: 'divider',
                fontWeight: 'normal',
                color: 'text.primary',
                boxSizing: 'border-box',
                paddingY: 0.25,
                paddingX: 0.75,
              }}
              endIcon={<DropdownIcon open={false} sx={{ fontSize: 20 }} />}
              onClick={showDialog}
            >
              {chartSetupData[selection].name}
            </Button>
            ))}
            {selectedCharts.length < 6 && (
              <Button
                variant='contained'
                color='primary'
                size='small'
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontWeight: 'normal',
                  color: 'primary.main',
                  backgroundColor: 'secondary.main',
                  boxSizing: 'border-box',
                  paddingY: 0.25,
                  paddingX: 0.75,
                  '&:hover': {
                    color: 'primary.contrastText',
                  },
                }}
                endIcon={<AddRoundedIcon fontSize="small" color="inherit" />}
                onClick={showDialog}
              >
                Add another
              </Button>
            )}
          </Box>
          <TimeTabs
            state={timeTabParams[0]}
            setState={timeTabParams[1]}
            aggregation={false}
            useExpandedWindows
          />
        </Box>
        {loading ? (
          <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress variant="indeterminate" />
          </Box>
        ) : (
          <ChartV2
            tooltipTitle={chartSetupData[selectedCharts[0]].tooltipTitle}
            tooltipHoverText={chartSetupData[selectedCharts[0]].tooltipHoverText}
            formattedData={priceFormattedData}
            extraData={extraData}
            selected={selectedCharts}
            drawPegLine
            containerHeight={345}
          />
        )}
        </Card>
      </Box>
    </>
  );
};

export default MegaChart;
