import React, { useCallback, useEffect, useState } from 'react';
import { Form, Formik, FormikProps } from 'formik';
import { LoadingButton } from '@mui/lab';
import { Box, Dialog, Divider, Link, Stack, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import BigNumber from 'bignumber.js';
import { useSelector } from 'react-redux';
import { useSigner } from '~/hooks/ledger/useSigner';
import SunriseCountdown from '~/components/Sun/SunriseCountdown';
import useToggle from '~/hooks/display/useToggle';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import TransactionToast from '~/components/Common/TxnToast';
import { StyledDialogContent, StyledDialogTitle } from '~/components/Common/Dialog';
import { BeanstalkPalette, IconSize } from '~/components/App/muiTheme';
import sunIcon from '~/img/beanstalk/sun/sun-icon.svg';
import { ZERO_BN } from '~/constants';
import { displayBN } from '~/util';
import TokenIcon from '~/components/Common/TokenIcon';
import { BEAN } from '~/constants/tokens';
import { AppState } from '~/state';
import Row from '~/components/Common/Row';

import { FC } from '~/types';

function getSunriseReward(now: DateTime) {
  return new BigNumber(100 * (1.01 ** (Math.min((now.minute * 60) + now.second, 300))));
}

const SunriseButton : FC<{}> = () => {
  /// Ledger
  const { data: signer }  = useSigner();
  const beanstalk         = useBeanstalkContract(signer);

  /// State
  const [open, show, hide]  = useToggle();
  const [now, setNow]       = useState(DateTime.now());
  const [reward, setReward] = useState(ZERO_BN);
  const awaiting = useSelector<AppState, AppState['_beanstalk']['sun']['sunrise']['awaiting']>((state) => state._beanstalk.sun.sunrise.awaiting);

  useEffect(() => {
    if (awaiting) {
      const i = setInterval(() => {
        const _now = DateTime.now();
        setNow(_now);
        setReward(getSunriseReward(_now));
      }, 1000);
      return () => {
        clearInterval(i);
      };
    }
  }, [awaiting]);

  /// Handlers
  const onSubmit = useCallback(() => {
    const txToast = new TransactionToast({
      loading: 'Calling Sunrise...',
      success: 'The Sun has risen.',
    });
    beanstalk.sunrise()
      .then((txn) => {
        txToast.confirming(txn);
        return txn.wait();
      })
      .then((receipt) => {
        txToast.success(receipt);
        // formActions.resetForm();
      })
      .catch((err) => {
        console.error(txToast.error(err.error || err));
      });
  }, [beanstalk]);

  return (
    <>
      <Formik initialValues={{}} onSubmit={onSubmit}>
        {(formikProps: FormikProps<{}>) => {
          const disabled = formikProps.isSubmitting || !awaiting;
          return (
            <Form autoComplete="off">
              <Dialog
                onClose={hide}
                open={open}
                PaperProps={{
                  sx: {
                    maxWidth: '350px'
                  }
                }}
              >
                <StyledDialogTitle onClose={hide}>
                  Call Sunrise
                </StyledDialogTitle>
                <StyledDialogContent sx={{ p: 1 }}>
                  <Stack gap={2}>
                    <Stack justifyContent="center" gap={2} py={2}>
                      <img src={sunIcon} alt="Sunrise" css={{ height: IconSize.large }} />
                      <Stack gap={1}>
                        {awaiting ? (
                          <Row justifyContent="center">
                            <Typography variant="body1">Sunrise has been available for: {now.minute < 10 ? `0${now.minute}` : now.minute}:{now.second < 10 ? `0${now.second}` : now.second}</Typography>
                          </Row>
                        ) : (
                          <Row justifyContent="center">
                            <Typography textAlign="center" variant="body1">Sunrise available&nbsp;<span css={{ display: 'inline' }}><SunriseCountdown /></span>.</Typography>
                          </Row>
                        )}
                        <Row justifyContent="center">
                          <Typography variant="body1">Reward for calling <Box display="inline" sx={{ backgroundColor: BeanstalkPalette.lightYellow, borderRadius: 0.4, px: 0.4 }}><strong><Link color="text.primary" underline="none" href="https://docs.bean.money/almanac/protocol/glossary#sunrise" target="_blank" rel="noreferrer">sunrise()</Link></strong></Box>: <TokenIcon token={BEAN[1]} />&nbsp;{displayBN(reward)}</Typography>
                        </Row>
                      </Stack>
                    </Stack>
                    <Divider />
                    <Typography sx={{ mx: 0 }} textAlign="center" variant="body1" color={BeanstalkPalette.washedRed}>Calling this function from the app is strongly discouraged because there is a high likelihood that your transaction will get front-run by bots.</Typography>
                    <LoadingButton
                      type="submit"
                      variant="contained"
                      onClick={onSubmit}
                      loading={formikProps.isSubmitting}
                      disabled={disabled}
                      sx={{
                        backgroundColor: BeanstalkPalette.washedRed,
                        height: { xs: '60px', md: '45px' },
                        color:  BeanstalkPalette.white,
                        '&:hover': {
                          backgroundColor: `${BeanstalkPalette.washedRed} !important`,
                          opacity: 0.9
                        }
                      }}
                    >
                      Sunrise
                    </LoadingButton>
                  </Stack>
                </StyledDialogContent>
              </Dialog>
              <LoadingButton
                loading={formikProps.isSubmitting}
                disabled={disabled}
                variant="contained"
                onClick={show}
                sx={{
                  backgroundColor: '#FBF2B9',
                  borderColor: '#F7CF2D',
                  height: { xs: '60px', md: '45px' },
                  color: 'text.primary',
                  '&:hover': {
                    backgroundColor: '#FBF2B9 !important',
                    opacity: 0.9
                  }
                }}
                fullWidth
              >
                {!disabled ? (
                  <>
                    <img src={sunIcon} alt="" css={{ height: 28 }} />&nbsp;
                    Sunrise
                  </>
                ) : (
                  <>Sunrise available&nbsp;<span css={{ display: 'inline' }}><SunriseCountdown /></span></>
                )}
              </LoadingButton>
            </Form>
          );
        }}
      </Formik>
    </>

  );
};

export default SunriseButton;
