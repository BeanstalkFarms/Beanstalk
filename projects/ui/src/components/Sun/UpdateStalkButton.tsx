import React, { useCallback, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Form, Formik, FormikProps } from 'formik';
import { LoadingButton } from '@mui/lab';
import { Dialog, Divider, Stack, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { useSigner } from '~/hooks/ledger/useSigner';
import useToggle from '~/hooks/display/useToggle';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import TransactionToast from '~/components/Common/TxnToast';
import {
  StyledDialogContent,
  StyledDialogTitle,
} from '~/components/Common/Dialog';
import { BeanstalkPalette } from '~/components/App/muiTheme';
import Row from '~/components/Common/Row';

import { FC } from '~/types';
import { AppState } from '~/state';

const UpdateStalkButton: FC<{}> = () => {
  /// Ledger
  const { data: signer } = useSigner();
  const beanstalk = useBeanstalkContract(signer);
  const d = new Date();
  d.setDate(d.getDate() - 7);

  /// State
  const [open, show, hide] = useToggle();
  const { current } = useSelector<
    AppState,
    AppState['_beanstalk']['sun']['season']
  >((state) => state._beanstalk.sun.season);
  const [nextUpdate, setNextUpdate] = React.useState<number>(
    current.toNumber() + 7 * 24
  );

  useEffect(() => {
    const run = async () => {
      const next = await beanstalk.getNextStalkGrowthRateUpdate();
      setNextUpdate(next.toNumber());
    };

    run();
  }, [beanstalk]);

  /// Handlers
  const onSubmit = useCallback(() => {
    const txToast = new TransactionToast({
      loading: 'Updating Stalk Inflation Rate...',
      success: 'Successfully updated!',
    });
    beanstalk
      .updateAverageStalkPerBdvPerSeason()
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

  const getDiff = useMemo(() => {
    const end = DateTime.now().plus({ hours: nextUpdate - current.toNumber() });

    return end.toRelative();
  }, [current, nextUpdate]);

  return (
    <>
      <Formik initialValues={{}} onSubmit={onSubmit}>
        {(formikProps: FormikProps<{}>) => {
          const disabled = formikProps.isSubmitting;
          return (
            <Form autoComplete="off">
              <Dialog
                onClose={hide}
                open={open}
                PaperProps={{
                  sx: {
                    maxWidth: '350px',
                  },
                }}
              >
                <StyledDialogTitle onClose={hide}>
                  Update Stalk Inflation Rate
                </StyledDialogTitle>
                <StyledDialogContent sx={{ p: 1 }}>
                  <Stack gap={2}>
                    <Stack justifyContent="center" gap={2} py={2}>
                      <Stack gap={1}>
                        <Row justifyContent="center">
                          <Typography variant="body1" textAlign="left">
                            Beanstalk automatically calls this once a week on
                            sunrise. Next update will take place{' '}
                            <strong>
                              {getDiff} (Season {nextUpdate.toString()})
                            </strong>
                            . If you want to call it manually, you can do so at
                            any time.
                          </Typography>
                        </Row>
                        <Row justifyContent="center">
                          <Typography variant="body1" textAlign="left">
                            Please see the Docs for more information on what
                            this does.
                          </Typography>
                        </Row>
                      </Stack>
                    </Stack>
                    <Divider />

                    <LoadingButton
                      type="submit"
                      variant="contained"
                      onClick={onSubmit}
                      loading={formikProps.isSubmitting}
                      disabled={disabled}
                      sx={{
                        backgroundColor: BeanstalkPalette.logoGreen,
                        height: { xs: '60px', md: '45px' },
                        color: BeanstalkPalette.white,
                        '&:hover': {
                          backgroundColor: `${BeanstalkPalette.logoGreen} !important`,
                          opacity: 0.9,
                        },
                      }}
                    >
                      Update Stalk Per BDV Per Season
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
                  backgroundColor: BeanstalkPalette.logoGreen,
                  borderColor: '#708e11',
                  height: { xs: '60px', md: '45px' },
                  color: 'text.primary',
                  '&:hover': {
                    backgroundColor: BeanstalkPalette.mediumGreen,
                    opacity: 0.9,
                  },
                }}
                fullWidth
              >
                Update Stalk Inflation Rate
              </LoadingButton>
            </Form>
          );
        }}
      </Formik>
    </>
  );
};

export default UpdateStalkButton;
