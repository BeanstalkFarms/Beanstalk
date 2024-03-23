import React, { useMemo } from 'react';
import { useFormikContext } from 'formik';
import useToggle from '~/hooks/display/useToggle';
import { FC } from '~/types';
import useAccount from '~/hooks/ledger/useAccount';
import { FullFertilizerBalance } from '~/components/Barn/Actions/Transfer';
import FertilizerSelectDialog from '~/components/Barn/FertilizerSelectDialog';
import { Box, Button, Typography } from '@mui/material';
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
          paddingY: 4.5,
          fontWeight: 'normal',
          color: 'text.primary',
        }}
      >
        {values.totalSelected === 0 
          ? <>Select Fertilizers to Transfer</>
          : <Box 
              display='flex' 
              flexDirection='row'
              gap={2}
              width='100%'
              justifyContent={values.totalSelected < 5 ? 'center' : undefined}
              marginTop={values.totalSelected > 4 ? '10px' : '0px'}
              sx={{ 
                overflowX: values.totalSelected > 4 ? 'auto' : 'hidden',
                overflowY: 'hidden', 
                scrollbarWidth: 'thin',
                '@media (pointer:coarse)': {
                  marginTop: '0px',
                },
              }}
            >
              {values.fertilizerIds.map((fertilizer, index) => {
                if (!fertilizer) return null

                const pctRatio = BigNumber(values.amounts[index]).div(fertilizers[index].amount);
                const sprouts = fertilizers[index].sprouts.multipliedBy(pctRatio);

                return (
                  <Box key={`selectedFertID${values.fertilizerIds[index]}`} width={100}>
                    <Box display='flex' flexDirection='row' gap={0.25}>
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
                          <Typography textAlign='start' fontSize={12} marginTop={0.1}>{`${fertilizers[index].humidity}%`}</Typography>
                        </Box>
                        <Box display='flex' flexDirection='row' flexGrow={1} alignItems='center'>
                          <TokenIcon token={SPROUTS} css={{ width: '10px' }} />
                          <Typography textAlign='start' fontSize={12}>{`${displayBN(sprouts)}`}</Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Box>   
              )})}
            </Box>
        }
      </Button>
    </>
  );
};

export default FertInputField;
