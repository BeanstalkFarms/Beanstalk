import { Accordion, AccordionDetails, Box, Button, Card, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { useConnect, useReadContract, useReadContracts } from 'wagmi';
import { Alert } from '@mui/lab';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { BeanstalkSDK, FarmFromMode, FarmToMode, TokenValue } from '@beanstalk/sdk';
import { FontWeight, IconSize } from '~/components/App/muiTheme';
import IconWrapper from '~/components/Common/IconWrapper';
import {
  FormTokenState,
  TokenAdornment,
  TokenSelectDialog,
  TxnPreview,
} from '~/components/Common/Form';
import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import TokenInputField from '~/components/Common/Form/TokenInputField';
import FarmModeField from '~/components/Common/Form/FarmModeField';
import { ERC20Token, NativeToken } from '~/classes/Token';
import { Beanstalk } from '~/generated/index';
import { ZERO_BN } from '~/constants';
import {
  DAI,
  USDC,
  USDT,
  WETH,
  WSTETH,
} from '~/constants/tokens';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import useFarmerBalances from '~/hooks/farmer/useFarmerBalances';
import useTokenMap from '~/hooks/chain/useTokenMap';
import { useSigner } from '~/hooks/ledger/useSigner';
import useGetChainToken from '~/hooks/chain/useGetChainToken';
import useAccount from '~/hooks/ledger/useAccount';
import { toStringBaseUnitBN, transform } from '~/util';
import TransactionToast from '~/components/Common/TxnToast';
import StyledAccordionSummary from '~/components/Common/Accordion/AccordionSummary';
import { ActionType } from '~/util/Actions';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import { BalanceFrom } from '~/components/Common/Form/BalanceFromRow';
import AddressInputField from '~/components/Common/Form/AddressInputField';
import copy from '~/constants/copy';
import useGetBalancesUsedBySource from '~/hooks/beanstalk/useBalancesUsedBySource';
import { TokenInstance } from '~/hooks/beanstalk/useTokens';
import PageHeader from '~/components/Common/PageHeader';
import useSdk from '~/hooks/sdk';
import BigNumber from 'bignumber.js';

/// ---------------------------------------------------------------

type TransferFormValues = {
  tokensIn: FormTokenState[]; // token, amount
  balanceFrom: BalanceFrom;
  fromMode:
  | FarmFromMode.INTERNAL
  | FarmFromMode.EXTERNAL
  | FarmFromMode.INTERNAL_EXTERNAL;
  toMode: FarmToMode;
  destination: string;
  approving: boolean;
};

const Warning: FC<{ color?: 'warning' | 'error' }> = ({
  children,
  color = 'warning',
}) => (
  <Alert
    color={color}
    icon={
      <IconWrapper boxSize={IconSize.medium}>
        <WarningAmberIcon sx={{ fontSize: IconSize.small }} />
      </IconWrapper>
    }
  >
    {children}
  </Alert>
);

const beanstalkL1MiniAbi = new ethers.utils.Interface([
  "function transferToken(address token, address recipient, uint256 amount, uint8 fromMode, uint8 toMode) external payable",
  "function getAllBalances(address account, address[] tokens) external view returns (tuple(uint256 internal, uint256 external, uint256 total)[] balances)",
  "function tokenAllowance(address account, address spender, address token) public view returns (uint256)",
]);

const erc20MiniAbi = new ethers.utils.Interface([
  "function allowance(address owner, address spender) returns (uint256)"
]);

const TransferForm: FC<
  FormikProps<TransferFormValues> & {
    balances: ReturnType<typeof useFarmerBalances>;
    allowances: { [x: string]: BigNumber };
    beanstalk: Beanstalk;
    sdk: BeanstalkSDK,
    tokenList: (ERC20Token | NativeToken)[];
    defaultValues: TransferFormValues;
  }
> = ({
  values,
  setFieldValue,
  isSubmitting,
  balances,
  allowances,
  sdk,
  tokenList,
  defaultValues,
  submitForm,
}) => {
    /// Tokens
    const { status } = useConnect();
    const account = useAccount();

    /// Derived values
    const stateIn = values.tokensIn[0];
    const tokenIn = stateIn.token;
    const fromMode = values.fromMode;
    const toMode = values.toMode;
    const amount = stateIn.amount;
    const destination = values.destination;

    const tokenAllowanceBN = allowances[tokenIn.address];

    const balanceInMax = useMemo(() => {
      const _balanceIn = balances[tokenIn.address];
      let _balanceInMax;
      if (_balanceIn) {
        switch (fromMode) {
          case FarmFromMode.INTERNAL:
            _balanceInMax = _balanceIn.internal;
            return _balanceInMax;
          case FarmFromMode.EXTERNAL:
            _balanceInMax = _balanceIn.external;
            return _balanceInMax;
          default:
            _balanceInMax = _balanceIn.total;
            return _balanceInMax;
        }
      }
      return ZERO_BN;
    }, [balances, fromMode, tokenIn.address]);

    const noBalance = !balanceInMax?.gt(0);

    const [getAmountsFromSource] = useGetBalancesUsedBySource({
      tokens: values.tokensIn,
      mode: values.fromMode,
    });
    const amountsBySource = useMemo(
      () => getAmountsFromSource()?.[0] || undefined,
      [getAmountsFromSource]
    );

    const handleSetDefault = useCallback(() => {
      setFieldValue('tokensIn.0', { ...defaultValues.tokensIn[0] });
      setFieldValue('fromMode', defaultValues.fromMode);
      setFieldValue('toMode', defaultValues.toMode);
      setFieldValue('tokenIn.0.amount', defaultValues.tokensIn[0].amount);
      setFieldValue('destination', defaultValues.destination);
    }, [defaultValues, setFieldValue]);

    const handleChangeToMode = useCallback(
      (v: FarmToMode) => {
        setFieldValue('toMode', v);
      },
      [setFieldValue]
    );

    /// Token Select
    const [tokenSelect, setTokenSelect] = useState<null | 'tokensIn'>(null);
    const selectedTokens =
      tokenSelect === 'tokensIn' ? values.tokensIn.map((x) => x.token) : [];

    const handleCloseTokenSelect = useCallback(() => setTokenSelect(null), []);

    const handleShowTokenSelect = useCallback(
      (which: 'tokensIn') => () => setTokenSelect(which),
      []
    );

    const handleTokenSelectSubmit = useCallback(
      (_tokens: Set<TokenInstance>) => {
        if (tokenSelect === 'tokensIn') {
          const newTokenIn = Array.from(_tokens)[0];
          setFieldValue('tokensIn.0.token', newTokenIn);
        }
      },
      [setFieldValue, tokenSelect]
    );

    const handleApprovalMode = useCallback(
      (v: boolean) => {
        if (v === true) {
          setFieldValue('approving', true);
        } else {
          setFieldValue('approving', false);
        }
      },
      [setFieldValue]
    );

    const handleSubmitWrapper = useCallback(
      (e: React.FormEvent) => {
        // Note: We need to wrap the formik handler to set the swapOperation form value first
        e.preventDefault();
        submitForm();
      },
      [submitForm]
    );

    const handleSetBalanceFrom = useCallback(
      (_balanceFrom: BalanceFrom) => {
        switch (_balanceFrom) {
          case BalanceFrom.INTERNAL:
            setFieldValue('balanceFrom', _balanceFrom);
            setFieldValue('fromMode', FarmFromMode.INTERNAL);
            break;
          case BalanceFrom.EXTERNAL:
            setFieldValue('balanceFrom', _balanceFrom);
            setFieldValue('fromMode', FarmFromMode.EXTERNAL);
            break;
          default: // case BalanceFrom.INTERNAL_EXTERNAL
            setFieldValue('balanceFrom', _balanceFrom);
            setFieldValue('fromMode', FarmFromMode.INTERNAL_EXTERNAL);
            break;
        }
      },
      [setFieldValue]
    );

    /// reset to default values when user switches wallet addresses or disconnects
    useEffect(() => {
      handleSetDefault();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [account, status]);

    /// behaviour when user changes destination address or fromMode
    useEffect(() => {
      if (values.destination.toLowerCase() === account?.toLowerCase()) {
        switch (fromMode) {
          case FarmFromMode.INTERNAL:
            setFieldValue('toMode', FarmToMode.EXTERNAL);
            break;
          case FarmFromMode.EXTERNAL:
            setFieldValue('toMode', FarmToMode.INTERNAL);
            break;
          default: // case FarmFromMode.INTERNAL_EXTERNAL
            break;
        }
      }
    }, [setFieldValue, account, values.destination, fromMode]);

    /// behaviour when user changes toMode
    useEffect(() => {
      if (values.destination.toLowerCase() === account?.toLowerCase()) {
        switch (toMode) {
          case FarmToMode.INTERNAL:
            handleSetBalanceFrom(BalanceFrom.EXTERNAL);
            break;
          default: // case FarmToMode.cd
            handleSetBalanceFrom(BalanceFrom.INTERNAL);
            break;
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handleSetBalanceFrom, account, toMode]);

    /// Approval Checks
    const shouldApprove = useMemo(() =>
      amount?.gt(tokenAllowanceBN) && fromMode === FarmFromMode.EXTERNAL ||
      (fromMode === FarmFromMode.INTERNAL_EXTERNAL &&
        amount?.gt(balances[tokenIn.address]?.internal)), [amount, tokenAllowanceBN, fromMode])

    useEffect(() => {
      shouldApprove ? handleApprovalMode(true) : handleApprovalMode(false);
    }, [shouldApprove])

    const amountsCheck = amount?.gt(0);
    const enoughBalanceCheck = amount
      ? amount.gt(0) && balanceInMax.gte(amount)
      : true;

    const addressCheck = values.destination.length === 42;

    const modeCheck =
      destination === account && fromMode !== FarmFromMode.INTERNAL_EXTERNAL
        ? fromMode.valueOf() !== toMode.valueOf()
        : true;

    const sameAddressCheck =
      values.destination.toLowerCase() === account?.toLowerCase();

    const internalExternalCheck = fromMode === FarmFromMode.INTERNAL_EXTERNAL;

    const ethTransferCheck = tokenIn.address === 'eth';

    const ethTransferModeCheck =
      ethTransferCheck && toMode === FarmToMode.EXTERNAL;

    const isValid =
      amountsCheck &&
      enoughBalanceCheck &&
      addressCheck &&
      modeCheck &&
      (sameAddressCheck ? !internalExternalCheck : true) &&
      (ethTransferCheck ? ethTransferModeCheck : true);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    return (
      <Box sx={{ padding: 1, maxWidth: 600, width: !isMobile ? 600 : undefined, minWidth: 300 }}>
        <PageHeader
          title="Transfer assets from L1 Beanstalk"
          description="Transfer non-Beanstalk assets that were not automatically migrated"
        />
        <Card sx={{ padding: 1, marginTop: 2 }}>
          <Typography variant="h4" fontWeight={FontWeight.bold} padding={1}>
            L1 Beanstalk Transfer
          </Typography>
          <Form autoComplete="off" onSubmit={handleSubmitWrapper}>
            <TokenSelectDialog
              title="Select Token to Transfer"
              open={tokenSelect !== null} // 'tokensIn' | 'tokensOut'
              handleClose={handleCloseTokenSelect} //
              handleSubmit={handleTokenSelectSubmit} //
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
                    ),
                  }}
                  balanceLabel={copy.MODES[values.fromMode]}
                  balance={balanceInMax}
                />
              </>
              {/* Output */}
              <>
                <AddressInputField
                  name="destination"
                  allowTransferToSelf
                  newLabel="Transfer to"
                />
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
                        actions={[
                          {
                            type: ActionType.TRANSFER_BALANCE,
                            amountsBySource: amountsBySource,
                            amount: amount!,
                            token: tokenIn,
                            source: fromMode,
                            destination: toMode,
                            to: destination === account ? undefined : destination,
                          },
                          {
                            type: ActionType.RECEIVE_TOKEN,
                            amount: amount!,
                            token: tokenIn,
                            destination: toMode,
                            to: destination === account ? undefined : destination,
                            hideMessage: true,
                          },
                        ]}
                      />
                    </AccordionDetails>
                  </Accordion>
                </Box>
              ) : null}
              {sameAddressCheck && ethTransferCheck ? (
                <Warning color="error">You cannot send ETH to yourself.</Warning>
              ) : toMode === FarmToMode.INTERNAL && ethTransferCheck ? (
                <Warning color="error">
                  ETH can only be delivered to a Circulating Balance.
                </Warning>
              ) : sameAddressCheck && internalExternalCheck ? (
                <Warning>
                  You cannot use Combined Balance when transferring to yourself.
                </Warning>
              ) : (
                amount?.gt(balanceInMax) && (
                  <Warning>
                    {`Transfer amount higher than your ${copy.MODES[values.fromMode]}.`}
                  </Warning>
                )
              )}
              {toMode === FarmToMode.INTERNAL && !ethTransferCheck && (
                <Warning color="error">
                  If you send assets to the Farm Balance of contracts, centralized
                  exchanges, etc. that don&apos;t support Farm Balances, the assets
                  will be lost.
                </Warning>
              )}
              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                disabled={!isValid || isSubmitting}
              >
                {noBalance
                  ? 'Nothing to transfer'
                  : values.approving ? `Approve ${tokenIn.symbol}` // : !enoughBalanceCheck
                    // ? 'Not enough to transfer'
                    : 'Transfer'}
              </Button>
            </Stack>
          </Form>
        </Card>
      </Box>
    );
  };

// ---------------------------------------------------

const SUPPORTED_TOKENS = [
  WETH,
  WSTETH,
  DAI,
  USDC,
  USDT,
];

const L1Transfer: FC<{}> = () => {
  /// Ledger
  const account = useAccount();
  const { data: signer } = useSigner();
  const beanstalk = useBeanstalkContract(signer);

  /// Tokens
  const getChainToken = useGetChainToken();
  const weth = getChainToken(WETH);

  /// Token List
  const tokenMap = useTokenMap<ERC20Token | NativeToken>(SUPPORTED_TOKENS);
  const tokenList = useMemo(() => Object.values(tokenMap), [tokenMap]);

  /// Form
  const middleware = useFormMiddleware();
  const initialValues: TransferFormValues = useMemo(
    () => ({
      tokensIn: [
        {
          token: weth,
          amount: undefined,
        },
      ],
      balanceFrom: BalanceFrom.INTERNAL,
      fromMode: FarmFromMode.INTERNAL,
      toMode: FarmToMode.EXTERNAL,
      destination: '',
      approving: false,
    }),
    [weth]
  );

  const sdk = useSdk();
  const beanstalkL1Address = sdk.addresses.BEANSTALK.ETH_MAINNET;
  const beanstalkL1 = new ethers.Contract(beanstalkL1Address, beanstalkL1MiniAbi, signer)

  const supportedAddresses = Object.keys(tokenMap);

  const tokenBalances = useReadContract({
    address: beanstalkL1Address as `0x${string}`,
    abi: JSON.parse(beanstalkL1MiniAbi.format(ethers.utils.FormatTypes.json) as string),
    functionName: "getAllBalances",
    // @ts-ignore
    args: [account, supportedAddresses],
    query: {
      enabled: Boolean(account),
      refetchInterval: 10000
    }
  });

  const tokenBalanceData = tokenBalances.data as Array<{ internal: bigint, external: bigint, total: bigint }>;
  const tokenData = supportedAddresses.reduce((acc, address, index) => {
    // @ts-ignore
    acc[address] = {
      internal: transform(TokenValue.fromBlockchain(tokenBalanceData ? tokenBalanceData[index].internal : 0n, tokenMap[address].decimals), 'bnjs'),
      external: transform(TokenValue.fromBlockchain(tokenBalanceData ? tokenBalanceData[index].external : 0n, tokenMap[address].decimals), 'bnjs'),
      total: transform(TokenValue.fromBlockchain(tokenBalanceData ? tokenBalanceData[index].total : 0n, tokenMap[address].decimals), 'bnjs'),
    };
    return acc;
  }, {})

  const allowanceCalls = supportedAddresses.map((tokenAddress) => {
    return {
      address: tokenAddress as `0x${string}`,
      abi: JSON.parse(erc20MiniAbi.format(ethers.utils.FormatTypes.json) as string),
      functionName: "allowance",
      args: [account, beanstalkL1Address],
    }
  })
  const tokenAllowances = useReadContracts({
    contracts: allowanceCalls,
    query: {
      enabled: Boolean(account),
      refetchInterval: 10000
    }
  });
  const tokenAllowancesData = tokenAllowances.data as Array<{ result: bigint, status: string }>
  const allowances = supportedAddresses.reduce((acc, address, index) => {
    // @ts-ignore
    acc[address] = transform(TokenValue.fromBlockchain(tokenAllowancesData ? tokenAllowancesData[index].result : 0n, tokenMap[address].decimals), 'bnjs')
    return acc;
  }, {})

  const onSubmit = useCallback(
    async (
      values: TransferFormValues,
      formActions: FormikHelpers<TransferFormValues>
    ) => {
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

        const amount = ethers.BigNumber.from(
          toStringBaseUnitBN(tokenAmount!, tokenDecimals)
        );
        const approving = values.approving;

        if (!tokenAmount) throw new Error('No input amount set.');
        if (!account) throw new Error('Connect a wallet first.');
        if (!recipient) throw new Error('Enter an address to transfer to.');
        if (!signer) throw new Error('Signer not found.');
        if (approving) {
          txToast = new TransactionToast({
            loading: `Approving ${tokenIn.token.symbol}...`,
            success: `Success. The L1 Beanstalk contract can now transact with your ${tokenIn.token.name}.`,
          });
          const erc20 = new ethers.Contract(tokenIn.token.address, ['function approve(address spender, uint256 value) returns(bool)'], signer);
          const txn = await erc20.functions.approve(beanstalkL1Address, amount);
          txToast.confirming(txn);
          await txn.wait();
          txToast.success();
          await tokenAllowances.refetch();
          return
        };

        txToast = new TransactionToast({
          loading: 'Transferring...',
          success: 'Transfer successful..',
        });

        let txn;
        if (tokenAddress === 'eth') {
          txn = await signer.sendTransaction({
            to: recipient,
            value: amount,
          });
        } else {
          txn = await beanstalkL1.transferToken(
            tokenAddress,
            recipient,
            amount,
            fromMode,
            toMode
          );
        }
        txToast.confirming(txn);

        const receipt = await txn.wait();
        await tokenBalances.refetch();
        txToast.success(receipt);
        // formActions.resetForm();
        formActions.setFieldValue('tokensIn.0', {
          token: tokenIn.token,
          amount: undefined,
        });
      } catch (err) {
        if (txToast) {
          txToast.error(err);
        } else {
          const errorToast = new TransactionToast({ success: '', loading: '' }); // change later
          errorToast.error(err);
        }
        formActions.setSubmitting(false);
      }
    },
    [account, tokenBalances, beanstalk, middleware, signer]
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
            balances={tokenData}
            allowances={allowances}
            beanstalk={beanstalk}
            sdk={sdk}
            tokenList={tokenList}
            defaultValues={initialValues}
            {...formikProps}
          />
        </>
      )}
    </Formik>
  );
};

export default L1Transfer;
