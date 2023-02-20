import { Accordion, AccordionDetails, Box, Stack } from '@mui/material';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { useConnect } from 'wagmi';
import {
  FormTokenState,
  SmartSubmitButton,
  TokenAdornment,
  TokenSelectDialog,
  TxnPreview,
} from '~/components/Common/Form';
import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import TokenInputField from '~/components/Common/Form/TokenInputField';
import FarmModeField from '~/components/Common/Form/FarmModeField';
import Token, { ERC20Token, NativeToken } from '~/classes/Token';
import { Beanstalk } from '~/generated/index';
import { ZERO_BN } from '~/constants';
import { BEAN, CRV3, DAI, ETH, USDC, USDT, WETH } from '~/constants/tokens';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import useFarmerBalances from '~/hooks/farmer/useFarmerBalances';
import useTokenMap from '~/hooks/chain/useTokenMap';
import { useSigner } from '~/hooks/ledger/useSigner';
import { FarmFromMode, FarmToMode } from '~/lib/Beanstalk/Farm';
import useGetChainToken from '~/hooks/chain/useGetChainToken';
import useAccount from '~/hooks/ledger/useAccount';
import { toStringBaseUnitBN, parseError } from '~/util';
import TransactionToast from '~/components/Common/TxnToast';
import { useFetchFarmerBalances } from '~/state/farmer/balances/updater';
import StyledAccordionSummary from '~/components/Common/Accordion/AccordionSummary';
import { ActionType } from '~/util/Actions';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import { BalanceFrom } from '~/components/Common/Form/BalanceFromRow';
import AddressInputField from '~/components/Common/Form/AddressInputField';
import FieldWrapper from '~/components/Common/Form/FieldWrapper';

/// ---------------------------------------------------------------

type TransferFormValues = {
  tokensIn: FormTokenState[]; //token, amount
  balanceFrom: BalanceFrom;
  fromMode: FarmFromMode.INTERNAL | FarmFromMode.EXTERNAL | FarmFromMode.INTERNAL_EXTERNAL;
  toMode: FarmToMode;
  destination: string;
  approving: boolean;
}

const TransferForm: FC<FormikProps<TransferFormValues> & {
  balances: ReturnType<typeof useFarmerBalances>;
  beanstalk: Beanstalk;
  tokenList: (ERC20Token | NativeToken)[];
  defaultValues: TransferFormValues;
}> = ({
  values,
  setFieldValue,
  isSubmitting,
  balances,
  beanstalk,
  tokenList,
  defaultValues,
  submitForm
}) => {
  /// Tokens
  const { status } = useConnect();
  const account = useAccount();

  /// Derived values
  const stateIn     = values.tokensIn[0];
  const tokenIn     = stateIn.token;
  const fromMode    = values.fromMode;
  const toMode      = values.toMode;
  const balanceFrom = values.balanceFrom;
  const amount      = stateIn.amount;
  const destination = values.destination;
  const approving   = values.approving;

  const [balanceIn, balanceInInput, balanceInMax] = useMemo(() => {
    const _balanceIn = balances[tokenIn.address];
    return [_balanceIn, _balanceIn, _balanceIn?.total || ZERO_BN] as const;
  }, [balances, fromMode, tokenIn.address]);

  const noBalance = !(balanceInMax?.gt(0));

  const handleSetDefault = useCallback(() => {
    setFieldValue('tokensIn.0', { ...defaultValues.tokensIn[0] });
    setFieldValue('fromMode', defaultValues.fromMode);
    setFieldValue('toMode', defaultValues.toMode);
    setFieldValue('tokenIn.0.amount', defaultValues.tokensIn[0].amount);
    setFieldValue('destination', defaultValues.destination);
  }, [defaultValues, setFieldValue]);
  
  /// reset to default values when user switches wallet addresses or disconnects
  useEffect(() => {
    handleSetDefault();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, status]);

  const handleChangeToMode = useCallback((v: FarmToMode) => {
    const newToMode = (
      v === FarmToMode.INTERNAL
        ? FarmToMode.INTERNAL
        : FarmToMode.EXTERNAL
    );
    setFieldValue('toMode', newToMode);
  }, [setFieldValue]);

  /// Token Select
  const [tokenSelect, setTokenSelect] =  useState<null | 'tokensIn'>(null);
  const selectedTokens = (
    tokenSelect === 'tokensIn' ? values.tokensIn.map((x) => x.token) : []
  );

  const [validAddress, setValidAddress] = useState<null | boolean>(false);

  const handleCloseTokenSelect = useCallback(() => setTokenSelect(null), []);
  
  const handleShowTokenSelect  = useCallback((which: 'tokensIn') => () => setTokenSelect(which), []);
  
  const handleTokenSelectSubmit = useCallback((_tokens: Set<Token>) => {
    if (tokenSelect === 'tokensIn') {
      const newTokenIn = Array.from(_tokens)[0];
      setFieldValue('tokensIn.0', {
        token: newTokenIn,
        amount: undefined
      });
    }
  }, [setFieldValue, tokenSelect, tokenIn]);
  
  const handleApprovalMode = useCallback((v: boolean) => {
    if (v === true) {
    setFieldValue('approving', true)
   } else {
    setFieldValue('approving', false)
   }
  }, [approving])

  /// Checks
  const shouldApprove = (fromMode == FarmFromMode.EXTERNAL || fromMode == FarmFromMode.INTERNAL_EXTERNAL);

  const amountsCheck = (
    amount?.gt(0)
  );
  const enoughBalanceCheck = (
    amount
      ? amount.gt(0) && balanceInMax.gte(amount)
      : true
  );

  const handleAddressChange = useCallback((v: any) => {
    setValidAddress(v)
  }, [])

  const addressCheck = (
    destination.length == 42 && validAddress
  )

  const isValid = (
    amountsCheck
    && enoughBalanceCheck
    && addressCheck
  );

  const handleSubmitWrapper = useCallback((e: React.FormEvent) => {
    // Note: We need to wrap the formik handler to set the swapOperation form value first
    e.preventDefault();
    submitForm();
  }, [setFieldValue, submitForm]);

  const handleSetBalanceFrom = useCallback((_balanceFrom: BalanceFrom) => {
    switch (_balanceFrom) {
      case BalanceFrom.INTERNAL:
        setFieldValue('balanceFrom', _balanceFrom);
        setFieldValue('fromMode', FarmFromMode.INTERNAL);
        break
      case BalanceFrom.EXTERNAL:
        setFieldValue('balanceFrom', _balanceFrom);
        setFieldValue('fromMode', FarmFromMode.EXTERNAL);
        break
      case BalanceFrom.TOTAL:
        setFieldValue('balanceFrom', _balanceFrom);
        setFieldValue('fromMode', FarmFromMode.INTERNAL_EXTERNAL);
        break
    }
  }, [setFieldValue]);

  return (
    <Form autoComplete="off" onSubmit={handleSubmitWrapper}>
      <TokenSelectDialog
        title={"Select Token to Transfer"}
        open={tokenSelect !== null}   // 'tokensIn' | 'tokensOut'
        handleClose={handleCloseTokenSelect}     //
        handleSubmit={handleTokenSelectSubmit}   //
        selected={selectedTokens}
        balances={balances}
        balanceFrom={values.balanceFrom}
        setBalanceFrom={handleSetBalanceFrom}
        tokenList={tokenList}
        mode={TokenSelectMode.SINGLE}
      />
      <Stack gap={1}>
        {/* Input */}
        <>
          <TokenInputField
            token={tokenIn}
            name="tokensIn.0.amount"
            // MUI
            fullWidth
            InputProps={{
              endAdornment: (
                <TokenAdornment
                  token={tokenIn}
                  balanceFrom={values.balanceFrom}
                  onClick={handleShowTokenSelect('tokensIn')}
                />
              )
            }}
            balanceLabel={undefined}
            balance={
              balanceInInput
            }
          />
        </>
        {/* Output */}
        <>
        <FieldWrapper label="Transfer to">
            <AddressInputField name="destination" validAddress={handleAddressChange}/>
        </FieldWrapper>
          <FarmModeField
            name="toMode"
            label="Destination"
            infoLabel="Destination Balance"
            baseMode={FarmToMode}
            circDesc="Send assets to another wallet."
            farmDesc="Send assets to another internal balance within Beanstalk."
            onChange={handleChangeToMode}
          />
        </>
        {isValid ? (
          <Box>
            <Accordion variant="outlined">
              <StyledAccordionSummary title="Transfer Details" />
              <AccordionDetails>
                <TxnPreview
                  actions={
                    [
                      {
                        type: ActionType.TRANSFER_BALANCE,
                        amount: amount!,
                        token: tokenIn,
                        source: fromMode,
                        destination: toMode,
                        to: destination,
                      },
                      {
                        type: ActionType.RECEIVE_TOKEN,
                        amount: amount!,
                        token: tokenIn,
                        destination: toMode,
                        to: destination,
                      }
                    ]
                  }
                />
              </AccordionDetails>
            </Accordion>
          </Box>
        ) : null}
        <SmartSubmitButton
          type="submit"
          variant="contained"
          color="primary"
          size="large"
          loading={isSubmitting}
          disabled={!isValid || isSubmitting}
          contract={beanstalk}
          tokens={shouldApprove ? values.tokensIn : []}
          mode="auto"
          nowApproving={handleApprovalMode}
        >
          {noBalance 
            ? 'Nothing to transfer' 
            // : !enoughBalanceCheck
            // ? 'Not enough to transfer'
            : 'Transfer'}
        </SmartSubmitButton>
      </Stack>
    </Form>
  );
};

// ---------------------------------------------------

const SUPPORTED_TOKENS = [
  BEAN,
  WETH,
  CRV3,
  DAI,
  USDC,
  USDT,
];

const Transfer: FC<{}> = () => {
  /// Ledger
  const account = useAccount();
  const { data: signer } = useSigner();
  const beanstalk = useBeanstalkContract(signer);

  /// Tokens
  const getChainToken = useGetChainToken();
  const Bean          = getChainToken(BEAN);
  
  /// Token List
  const tokenMap      = useTokenMap<ERC20Token | NativeToken>(SUPPORTED_TOKENS);
  const tokenList     = useMemo(() => Object.values(tokenMap), [tokenMap]);

  /// Farmer
  const farmerBalances = useFarmerBalances();
  const [refetchFarmerBalances] = useFetchFarmerBalances();

  /// Form
  const middleware = useFormMiddleware();
  const initialValues: TransferFormValues = useMemo(() => ({
      tokensIn: [{
        token: Bean,
        amount: undefined,
      }],
      balanceFrom: BalanceFrom.TOTAL,
      fromMode: FarmFromMode.INTERNAL_EXTERNAL,
      toMode: FarmToMode.INTERNAL,
      destination: '',
      approving: false,
    }), [Bean, account]);

  const onSubmit = useCallback(
    async (values: TransferFormValues, formActions: FormikHelpers<TransferFormValues>) => {
      let txToast;
      try {
        middleware.before();

        const tokenIn = values.tokensIn[0];
        const tokenAmount = tokenIn.amount;
        const tokenDecimals = tokenIn.token.decimals;

        const tokenAddress = tokenIn.token.address;
        const recipient = values.destination;
        
        const fromMode = values.fromMode;
        const toMode = values.toMode;
        
        const amount = ethers.BigNumber.from(toStringBaseUnitBN(tokenAmount!, tokenDecimals))
        const approving = values.approving;

        if (!tokenAmount) throw new Error('No input amount set.');
        if (!account) throw new Error('Connect a wallet first.');
        if (!recipient) throw new Error('Enter an address to transfer to.');
        if (approving) return;

        txToast = new TransactionToast({
          loading: 'Transferring...',
          success: 'Transfer successful..'
        });

        const txn = await beanstalk.transferToken(tokenAddress, recipient, amount, fromMode, toMode);
        txToast.confirming(txn);

        const receipt = await txn.wait();
        await Promise.all([
          refetchFarmerBalances()
        ]);
        console.log(receipt)
        txToast.success(receipt);
        // formActions.resetForm();
        formActions.setFieldValue('tokensIn.0', {
          token: tokenIn.token,
          amount: undefined,
        });
      } catch (err) {
        if (txToast) {
          txToast.error(err)
        } else {
          let errorToast = new TransactionToast({success: '', loading: ''}) //change later
          errorToast.error(err)
        }
        formActions.setSubmitting(false);
      }
    },
    [account, refetchFarmerBalances, farmerBalances, beanstalk, signer, middleware]
  );

  return (
    <Formik<TransferFormValues>
      enableReinitialize
      initialValues={initialValues}
      onSubmit={onSubmit} 
    >
      {(formikProps: FormikProps<TransferFormValues>) => (
        <>
          <TransferForm
            balances={farmerBalances}
            beanstalk={beanstalk}
            tokenList={tokenList}
            defaultValues={initialValues}
            {...formikProps}
          />
        </>
      )}
    </Formik>
  );
};

export default Transfer;
