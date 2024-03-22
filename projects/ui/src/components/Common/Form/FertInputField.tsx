import React, { useMemo } from 'react';
import { useFormikContext } from 'formik';
import useToggle from '~/hooks/display/useToggle';
import { FC } from '~/types';
import useAccount from '~/hooks/ledger/useAccount';
import { FullFertilizerBalance } from '~/components/Barn/Actions/Transfer';
import FertilizerSelectDialog from '~/components/Barn/FertilizerSelectDialog';
import { Box, Button, Grid, Typography } from '@mui/material';
import humidityIcon from '~/img/beanstalk/humidity-icon.svg';
import FertilizerImage, { FertilizerState } from '~/components/Barn/FertilizerImage';
import BigNumber from 'bignumber.js';
import { SPROUTS } from '~/constants/tokens';
import { displayBN } from '~/util';
import TokenIcon from '../TokenIcon';

const FertInputField: FC<
  {
    /** A farmer's fertilizers */
    fertilizers: FullFertilizerBalance[];
  }
> = ({ fertilizers }) => {
  /// Form state
  const { values, setFieldValue } = useFormikContext<{
    /// These fields are required in the parent's Formik state
    fertilizerIds: any[];
    amounts: any[];
    totalSelected: number;
  }>();

  /// Local state
  const [dialogOpen, showDialog, hideDialog] = useToggle();

  /// Account
  const account = useAccount();

  useMemo(() => {
    setFieldValue('fertilizerIds', []);
    setFieldValue('amounts', []);
    setFieldValue('totalSelected', 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  const fertIndexesToRender: number[] = [];

  for (let i = 0; i < values.fertilizerIds.length; i += 1) {
    if (values.fertilizerIds[i]) {
      fertIndexesToRender.push(i);
    };
  };

  return (
    <>
      <FertilizerSelectDialog
        fertilizers={fertilizers}
        handleClose={hideDialog}
        open={dialogOpen}
      />
      <Button 
        onClick={showDialog}
        variant='outlined-secondary'
        color='secondary'
        sx={{
          paddingY: 4,
          fontWeight: 'normal',
          color: 'text.primary',
        }}
      >
        {values.totalSelected === 0 
          ? <>Select Fertilizers to Transfer</>
          : <Grid container gridTemplateColumns={4} justifyContent='space-evenly' marginLeft={0}>
              {fertIndexesToRender.map((index, renderIndex) => {
                if (!values.fertilizerIds[index]) return null
                if (values.totalSelected > 4 && renderIndex > 3) return null

                const pctRatio = BigNumber(values.amounts[index]).div(fertilizers[index].amount);
                const sprouts = fertilizers[index].sprouts.multipliedBy(pctRatio);

                if (values.totalSelected > 4 && renderIndex === 3) {
                  return (
                    <Grid key='selectedFertIDOverflow' item>
                      <Box
                        width={100}
                        height={65}
                        alignItems='center'
                        justifyContent='center'
                        display='flex'
                        sx={{
                          borderColor: 'divider',
                          borderWidth: 1,
                          borderStyle: 'solid',
                          borderRadius: 1,
                          fontSize: 28
                        }}
                      >
                        {`+${values.totalSelected - 3}`}
                      </Box>
                    </Grid>
                  )
                }

                return (
                  <Grid key={`selectedFertID${values.fertilizerIds[index]}`} item>
                    <Box display='flex' flexDirection='row' gap={0.25} width={100}>
                      <FertilizerImage 
                        isNew={false} 
                        state={fertilizers[index].status as FertilizerState} 
                        progress={fertilizers[index].pctRepaid.toNumber()} 
                        id={fertilizers[index].token.id}
                        noOpenseaLink
                        verySmallIdStyling
                      />
                      <Box display='flex' flexDirection='column' justifyContent='space-between'>
                        <Box display='flex' flexDirection='row' flexGrow={1} >
                          <Typography textAlign='start' fontSize={12}>{`x${values.amounts[index] || 0}`}</Typography>
                        </Box>
                        <Box display='flex' flexDirection='row' flexGrow={1} alignItems='center' gap={0.1} >
                          <img alt="" src={humidityIcon} height="11px" />
                          <Typography textAlign='start' fontSize={12}>{`${fertilizers[index].humidity}%`}</Typography>
                        </Box>
                        <Box display='flex' flexDirection='row' flexGrow={1} >
                          <TokenIcon token={SPROUTS} css={{ width: '10px' }} />
                          <Typography textAlign='start' fontSize={12}>{`${displayBN(sprouts)}`}</Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Grid>   
              )})}
            </Grid>
        }
      </Button>
    </>
  );
};

export default FertInputField;
