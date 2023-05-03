import React, { useCallback, useMemo } from 'react';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import { Button, Link, Stack, Typography } from '@mui/material';
import { useSigner } from '~/hooks/ledger/useSigner';
import useFarmerDelegations from '~/hooks/farmer/useFarmerDelegations';
import { useDelegatesRegistryContract } from '~/hooks/ledger/useContract';
import { GovSpace } from '~/lib/Beanstalk/Governance';
import { useFetchFarmerDelegations } from '~/state/farmer/delegations/updater';
import useAccount from '~/hooks/ledger/useAccount';
import TransactionToast from '~/components/Common/TxnToast';
import { DelegateRegistry } from '~/generated';
import { FarmerDelegation } from '~/state/farmer/delegations';

import AddressInputField, {
  validateAddress,
} from '~/components/Common/Form/AddressInputField';
import { SmartSubmitButton } from '~/components/Common/Form';
import { GOV_SPACE_BY_ID, trimAddress } from '~/util';
import Row from '~/components/Common/Row';
import { FontWeight } from '~/components/App/muiTheme';

type DelegateValues = {
  delegate: string;
  action: 'delegate' | 'undelegate' | 'change';
};

type Props = {
  space: GovSpace;
};

type DelegateProps = Props & {
  delegate: FarmerDelegation['delegates'][GovSpace] | undefined;
  contract: DelegateRegistry;
  fetchDelegates: ReturnType<typeof useFetchFarmerDelegations>[0];
  account: ReturnType<typeof useAccount>;
};

const DelegationForm: React.FC<FormikProps<DelegateValues> & DelegateProps> = ({
  contract,
  fetchDelegates,
  space,
  account,
  delegate,
  /// formik
  isSubmitting,
  setSubmitting,
  setFieldValue,
  resetForm,
  values,
}) => {
  const handleClearDelegate = useCallback(async () => {
    let txToast;
    try {
      if (!account) {
        throw new Error('Signer required');
      }

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
    delegate,
    space,
    setSubmitting,
    contract,
    fetchDelegates,
    resetForm,
  ]);

  const handleSetAction = useCallback(
    (action: DelegateValues['action']) => {
      setFieldValue('action', action);
    },
    [setFieldValue]
  );

  const { isChange, isRemove, isSetDelegate } = useMemo(
    () => ({
      isChange: values.action === 'change',
      isRemove: values.action === 'undelegate',
      isSetDelegate: values.action === 'delegate',
    }),
    [values.action]
  );

  const getIsInvalidInput = () => {
    const validateSelf = validateAddress(account, false);
    const validateExisting = validateAddress(delegate?.address, false);

    const checkSelf = validateSelf(values.delegate) === undefined;
    const checkExisting = validateExisting(values.delegate) === undefined;

    return !checkSelf || !checkExisting;
  };

  const showInputField = delegate ? isChange : true;
  const hasDelegateActionSelected = delegate && (isChange || isRemove);

  const buttonText = (() => {
    if (delegate) {
      return !hasDelegateActionSelected
        ? 'Select an option'
        : 'Change Delegate';
    }
    return 'Set Delegate';
  })();

  return (
    <Form autoComplete="off" noValidate>
      <Stack gap={2} width="100%">
        {delegate ? (
          <Stack gap={2} width="100%">
            <Typography color="text.secondary">
              Your votes are currently delegated to&nbsp;
              <Link
                component="a"
                href={`https://etherscan.io/address/${delegate.address}`}
                target="_blank"
                rel="noreferrer"
                variant="h4"
                color="inherit"
                sx={{ fontWeight: FontWeight.bold }}
              >
                {trimAddress(delegate.address)}
              </Link>
            </Typography>
            <Row justifyContent="space-between" gap={1} width="100%">
              <Button
                variant="outlined"
                fullWidth
                sx={{
                  color: 'text.secondary',
                  fontWeight: FontWeight.normal,
                  backgroundColor: isChange ? 'primary.light' : undefined,
                  borderColor: isChange ? 'primary.main' : 'text.light',
                }}
                onClick={() => handleSetAction('change')}
              >
                Change Delegation Address
              </Button>
              <Button
                variant="outlined"
                fullWidth
                sx={{
                  color: 'text.secondary',
                  fontWeight: FontWeight.normal,
                  backgroundColor: isRemove ? 'primary.light' : 'transparent',
                  borderColor: isRemove ? 'primary.main' : 'text.light',
                }}
                onClick={() => handleSetAction('undelegate')}
              >
                Remove Delegation
              </Button>
            </Row>
          </Stack>
        ) : (
          <Typography color="text.secondary">
            Your votes are not currently delegated.
          </Typography>
        )}
        {showInputField && <AddressInputField fullWidth name="delegate" />}
        {isChange || isSetDelegate ? (
          <SmartSubmitButton
            variant="contained"
            mode="manual"
            type="submit"
            fullWidth
            disabled={isSubmitting || getIsInvalidInput()}
            loading={isSubmitting}
            tokens={[]}
          >
            {buttonText}
          </SmartSubmitButton>
        ) : (
          <SmartSubmitButton
            variant="contained"
            mode="manual"
            fullWidth
            onClick={() => handleClearDelegate()}
            disabled={isSubmitting}
            loading={isSubmitting}
            tokens={[]}
          >
            Remove Delegate
          </SmartSubmitButton>
        )}
      </Stack>
    </Form>
  );
};

const Delegation: React.FC<Props> = ({ space }) => {
  /// Contract
  const { data: signer } = useSigner();
  const delegatesRegistry = useDelegatesRegistryContract(signer);

  /// Farmer
  const delegations = useFarmerDelegations();
  const account = useAccount();

  /// Refetch
  const [fetchDelegates] = useFetchFarmerDelegations();

  /// Derived
  const delegate = useMemo(
    () => delegations.delegates[space],
    [delegations.delegates, space]
  );

  /// Handlers
  const onSubmit = useCallback(
    async (
      values: DelegateValues,
      formActions: FormikHelpers<DelegateValues>
    ) => {
      let txToast;
      try {
        const newDelegateAddress = values.delegate;

        if (!account) {
          throw new Error('Signer required.');
        }

        txToast = new TransactionToast({
          loading: `Delegating voting power to ${values.delegate}...`,
          success: 'Successfully delegated voting power',
        });

        const tx = await delegatesRegistry.setDelegate(
          GOV_SPACE_BY_ID[space],
          newDelegateAddress
        );
        txToast.confirming(tx);
        const receipt = await tx.wait();
        await fetchDelegates(account);

        txToast.success(receipt);
        formActions.resetForm();
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
    [account, delegatesRegistry, fetchDelegates, space]
  );

  return (
    <Formik<DelegateValues>
      onSubmit={onSubmit}
      initialValues={{
        delegate: '',
        action: 'delegate',
      }}
    >
      {(formikProps: FormikProps<DelegateValues>) => (
        <DelegationForm
          {...formikProps}
          contract={delegatesRegistry}
          fetchDelegates={fetchDelegates}
          delegate={delegate}
          account={account}
          space={space}
        />
      )}
    </Formik>
  );
};

export default Delegation;
