import {
  Button,
  FormControlLabel,
  Radio,
  Stack,
  Typography,
  Link,
} from '@mui/material';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import React, { useCallback, useEffect, useMemo } from 'react';
import {
  StyledDialog,
  StyledDialogContent,
  StyledDialogTitle,
} from '~/components/Common/Dialog';
import AddressInputField, {
  validateAddress,
} from '~/components/Common/Form/AddressInputField';
import TransactionToast from '~/components/Common/TxnToast';
import { useDelegatesRegistryContract } from '~/hooks/ledger/useContract';
import {
  GOV_SPACE_BY_ID,
  useFetchFarmerDelegations,
} from '~/state/farmer/delegations/updater';

import { GovSpace, SNAPSHOT_SPACES } from '~/lib/Beanstalk/Governance';
import { GOV_SLUGS } from '../GovernanceSpaces';
import useAccount from '~/hooks/ledger/useAccount';
import { useSigner } from '~/hooks/ledger/useSigner';
import { FarmerDelegation } from '~/state/farmer/delegations';
import { SmartSubmitButton } from '~/components/Common/Form';
import { DelegateRegistry } from '~/generated';
import useFarmerDelegations from '~/hooks/farmer/useFarmerDelegations';

type DelegateVotesDialogProps = Props & {
  delegates: FarmerDelegation['delegates'];
  contract: DelegateRegistry;
  fetchDelegates: ReturnType<typeof useFetchFarmerDelegations>[0];
};

type Props = {
  open: boolean;
  onClose: () => void;
};

type DelegateValues = {
  delegate: string;
  space: GovSpace | undefined;
};

const DialogContent: React.FC<
  FormikProps<DelegateValues> & DelegateVotesDialogProps
> = ({
  /// formik
  isSubmitting,
  values,
  setFieldValue,
  setSubmitting,
  resetForm,
  /// custom
  delegates,
  open,
  onClose,
  contract,
  fetchDelegates,
}) => {
  const account = useAccount();

  const selectedSpace = values.space;

  const setGovSpace = useCallback(
    (space: GovSpace) => {
      setFieldValue('space', space);
    },
    [setFieldValue]
  );

  const handleClearDelegate = useCallback(async () => {
    let txToast;
    try {
      const space = values.space;
      if (!space) throw new Error('No space selected');
      if (!account) {
        throw new Error('Signer required');
      }
      const delegate = delegates[space];
      if (!delegate) throw new Error('No delegate found');
      setSubmitting(true);

      txToast = new TransactionToast({
        loading: `Removing ${delegate.address} as delegate for ${space}...`,
        success: 'Successfully removed delegate',
      });

      const tx = await contract.clearDelegate(GOV_SPACE_BY_ID[space]);
      txToast.confirming(tx);

      const receipt = await tx.wait();
      await fetchDelegates(account);
      txToast.success(receipt);
      resetForm();
    } catch (err) {
      if (txToast) {
        txToast.error(err);
      } else {
        const errorToast = new TransactionToast({});
        errorToast.error(err);
      }
      console.error(err);
    }
  }, [
    account,
    values.space,
    delegates,
    contract,
    setSubmitting,
    fetchDelegates,
    resetForm,
  ]);

  const isInvalidInput = useMemo(() => {
    const _delegate = values.space
      ? delegates[values.space]?.address
      : undefined;
    const validateSelf = validateAddress(account, false);
    const validateExisting = validateAddress(_delegate, false);

    const checkSelf = validateSelf(values.delegate) === undefined;
    const checkExisting = validateExisting(values.delegate) === undefined;

    return !checkSelf || !checkExisting;
  }, [account, delegates, values.delegate, values.space]);

  const canRemoveDelegate = Boolean(values.space && delegates[values.space]);

  /// Set delegate address when space is changed
  useEffect(() => {
    if (selectedSpace) {
      const delegate = delegates[selectedSpace];
      setFieldValue('delegate', delegate?.address || '');
    }
  }, [delegates, selectedSpace, setFieldValue]);

  return (
    <StyledDialog open={open}>
      <StyledDialogTitle onClose={onClose}>Delegate</StyledDialogTitle>
      <StyledDialogContent
        sx={{
          px: 2,
          width: '100%',
          maxWidth: '500px',
        }}
      >
        <Form autoComplete="off" noValidate>
          <Stack gap={2}>
            <Stack gap={1}>
              <Typography color="text.secondary">
                Delegate your voting power to another address. This will allow
                the delegate to vote on your behalf. You can view a list of
                those who have applied to be delegates in our&nbsp;
                <Link
                  href="https://discord.com/channels/880413392916054098/1092912362295668828"
                  rel="noreferrer"
                  target="_blank"
                >
                  discord
                </Link>
                .
              </Typography>

              <Stack gap={0.5}>
                {SNAPSHOT_SPACES.map((space, i) => (
                  <FormControlLabel
                    key={space.toString()}
                    value={space}
                    checked={selectedSpace === space}
                    control={<Radio size="small" sx={{ py: 0 }} />}
                    onChange={() => setGovSpace(space)}
                    label={GOV_SLUGS[i]}
                  />
                ))}
              </Stack>
            </Stack>
            <AddressInputField name="delegate" />
            <Stack gap={1}>
              <SmartSubmitButton
                variant="contained"
                mode="manual"
                type="submit"
                disabled={isSubmitting || isInvalidInput}
                loading={isSubmitting}
                tokens={[]}
              >
                Delegate
              </SmartSubmitButton>
              {canRemoveDelegate && (
                <Button variant="text" onClick={handleClearDelegate}>
                  Remove delegate
                </Button>
              )}
            </Stack>
          </Stack>
        </Form>
      </StyledDialogContent>
    </StyledDialog>
  );
};

const DelegateDialog: React.FC<Props> = (props) => {
  const { data: signer } = useSigner();
  const delegatesRegistry = useDelegatesRegistryContract(signer);
  const delegations = useFarmerDelegations();

  const account = useAccount();

  const [fetchDelegates] = useFetchFarmerDelegations();

  const delegates = delegations.delegates;

  const { onClose } = props;

  const onSubmit = useCallback(
    async (
      values: DelegateValues,
      formActions: FormikHelpers<DelegateValues>
    ) => {
      let txToast;
      try {
        const snapshotSpace = values.space;
        const delegate = values.delegate;

        if (!account) {
          throw new Error('Signer required.');
        }

        if (!snapshotSpace) {
          throw new Error('No snapshot space selected');
        }

        console.log('submitting...');

        txToast = new TransactionToast({
          loading: `Delegating voting power to ${values.delegate}...`,
          success: 'Successfully delegated voting power',
        });

        const tx = await delegatesRegistry.setDelegate(
          GOV_SPACE_BY_ID[snapshotSpace],
          delegate
        );
        txToast.confirming(tx);

        const receipt = await tx.wait();
        txToast.success(receipt);
        formActions.resetForm();

        onClose();
        await fetchDelegates(account);
      } catch (err) {
        if (txToast) {
          txToast.error(err);
        } else {
          const errorToast = new TransactionToast({});
          errorToast.error(err);
        }
        console.error(err);
      }
    },
    [account, delegatesRegistry, fetchDelegates, onClose]
  );

  return (
    <Formik<DelegateValues>
      onSubmit={onSubmit}
      initialValues={{
        delegate: '',
        space: undefined,
      }}
    >
      {(formikProps: FormikProps<DelegateValues>) => (
        <>
          <DialogContent
            {...formikProps}
            {...props}
            delegates={delegates}
            contract={delegatesRegistry}
            fetchDelegates={fetchDelegates}
          />
        </>
      )}
    </Formik>
  );
};

export default DelegateDialog;
