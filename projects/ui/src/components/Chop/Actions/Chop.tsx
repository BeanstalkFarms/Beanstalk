import {
  Accordion,
  AccordionDetails,
  Box,
  CircularProgress,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import BigNumber from 'bignumber.js';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { FarmToMode, ERC20Token } from '@beanstalk/sdk';
import {
  FormStateNew,
  SmartSubmitButton,
  TokenAdornment,
  TokenOutputField,
  TokenSelectDialog,
  TxnPreview,
  TxnSeparator,
} from '~/components/Common/Form';
import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import StyledAccordionSummary from '~/components/Common/Accordion/AccordionSummary';
import TokenInputField from '~/components/Common/Form/TokenInputField';
import { BeanstalkPalette } from '~/components/App/muiTheme';
import FarmModeField from '~/components/Common/Form/FarmModeField';

import { Beanstalk } from '~/generated/index';
import useToggle from '~/hooks/display/useToggle';
import useFarmerBalances from '~/hooks/farmer/useFarmerBalances';
import useAccount from '~/hooks/ledger/useAccount';
import usePreferredToken from '~/hooks/farmer/usePreferredToken';
import { ActionType } from '~/util/Actions';
import {
  displayBN,
  displayFullBN,
  optimizeFromMode,
  toStringBaseUnitBN,
} from '~/util';

import { ZERO_BN } from '~/constants';
import { useFetchFarmerBalances } from '~/state/farmer/balances/updater';
import { AppState } from '~/state';
import useUnripeUnderlyingMap from '~/hooks/beanstalk/useUnripeUnderlying';
import Row from '~/components/Common/Row';
import { FC } from '~/types';
import TransactionToast from '~/components/Common/TxnToast';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import useSdk from '~/hooks/sdk';
import useBDV from '~/hooks/beanstalk/useBDV';
import { BalanceFrom } from '~/components/Common/Form/BalanceFromRow';
import { useUnripe } from '~/state/bean/unripe/updater';
import { TokenInstance, useUnripeTokens } from '~/hooks/beanstalk/useTokens';
import WarningAlert from '~/components/Common/Alert/WarningAlert';

type ChopFormValues = FormStateNew & {
  destination: FarmToMode | undefined;
};

const useOptimizedBalanceSource = (
  token: FormStateNew['tokens'][number]['token'],
  balances: ReturnType<typeof useFarmerBalances>
) => {
  const bal = balances[token.address];

  if (bal && bal.external.gt(bal.internal)) {
    return BalanceFrom.EXTERNAL;
  }

  return BalanceFrom.INTERNAL;
};

const ChopForm: FC<
  FormikProps<ChopFormValues> & {
    balances: ReturnType<typeof useFarmerBalances>;
    beanstalk: Beanstalk;
    optimizedBalanceSource: BalanceFrom;
  }
> = ({
  values,
  setFieldValue,
  balances,
  beanstalk,
  optimizedBalanceSource,
}) => {
  const sdk = useSdk();
  const getBDV = useBDV();
  const { tokenMap: erc20TokenMap } = useUnripeTokens();
  const [isTokenSelectVisible, showTokenSelect, hideTokenSelect] = useToggle();
  const unripeUnderlying = useUnripeUnderlyingMap();
  const [quote, setQuote] = useState<BigNumber>(new BigNumber(0));
  const [quoteBdv, setQuoteBdv] = useState<BigNumber>(new BigNumber(0));
  const [balanceFromIn, setBalanceFromIn] = useState<BalanceFrom>(
    optimizedBalanceSource
  );
  /// Derived values
  const state = values.tokens[0];
  const inputToken = state.token;
  const tokenBalance = balances[inputToken.address];
  const outputToken = unripeUnderlying[inputToken.address];

  const isUnripeLP =
    values.tokens[0]?.token.symbol === sdk.tokens.UNRIPE_BEAN_WSTETH.symbol;

  useEffect(() => {
    const fetchQuote = async () => {
      const amountIn = toStringBaseUnitBN(state.amount!, state.token.decimals);
      const token = inputToken.address;
      console.log('Fetching chop quote', amountIn?.toString(), token);

      const result = await sdk.contracts.beanstalk.getPenalizedUnderlying(
        token,
        amountIn!.toString()
      );

      // const resbn = tokenResult(state.token)(result)
      const resbn = new BigNumber(result.toString()).div(
        10 ** outputToken.decimals
      );
      setQuote(resbn);
      const bdv = getBDV(outputToken).times(resbn);
      setQuoteBdv(bdv);
    };

    if (state.amount?.gt(0)) {
      fetchQuote();
    } else {
      setQuote(new BigNumber(0));
    }
  }, [state, inputToken, sdk, outputToken, getBDV]);

  // Clear quote when token changes
  useEffect(() => {
    setQuote(new BigNumber(0));
  }, [inputToken]);

  /// Chop Penalty  = 99% <-> Chop Rate     = 0.01
  const unripeTokens = useSelector<AppState, AppState['_bean']['unripe']>(
    (_state) => _state._bean.unripe
  );

  const chopPenalty =
    unripeTokens[inputToken.address]?.chopPenalty || new BigNumber(100);

  ///
  const handleSelectTokens = useCallback(
    (_tokens: Set<TokenInstance>) => {
      // If the user has typed some existing values in,
      // save them. Add new tokens to the end of the list.
      // FIXME: match sorting of erc20TokenList
      const copy = new Set(_tokens);
      const newValue = values.tokens.filter((x) => {
        copy.delete(x.token);
        return _tokens.has(x.token);
      });
      setFieldValue('tokens', [
        ...newValue,
        ...Array.from(copy).map((_token) => ({
          token: _token,
          amount: undefined, // balances[_token.address]?.total ||
        })),
      ]);
    },
    [values.tokens, setFieldValue]
  );

  const isSubmittable = quote?.gt(0) && values.destination;

  const changeDestination = (v: BalanceFrom) => {
    setBalanceFromIn(v);
    setFieldValue(
      'destination',
      v === BalanceFrom.EXTERNAL ? FarmToMode.EXTERNAL : FarmToMode.INTERNAL
    );
  };

  return (
    <Form autoComplete="off">
      <TokenSelectDialog
        open={isTokenSelectVisible}
        handleClose={hideTokenSelect}
        handleSubmit={handleSelectTokens}
        selected={values.tokens}
        balances={balances}
        tokenList={Object.values(erc20TokenMap)}
        mode={TokenSelectMode.SINGLE}
        balanceFrom={balanceFromIn}
        setBalanceFrom={changeDestination}
        balanceFromOptions={[BalanceFrom.INTERNAL, BalanceFrom.EXTERNAL]}
      />
      <Stack gap={1}>
        <TokenInputField
          token={inputToken}
          balance={tokenBalance || ZERO_BN}
          balanceFrom={balanceFromIn}
          name="tokens.0.amount"
          // MUI
          fullWidth
          InputProps={{
            endAdornment: (
              <TokenAdornment
                balanceFrom={balanceFromIn}
                token={inputToken}
                onClick={showTokenSelect}
              />
            ),
          }}
        />
        <Stack gap={0.5}>
          <FarmModeField name="destination" />
          <Row justifyContent="space-between" px={0.5}>
            <Typography variant="body1" color="text.tertiary">
              Chop Penalty
            </Typography>
            {!unripeTokens[inputToken.address] ? (
              <CircularProgress
                size={16}
                thickness={5}
                sx={{ color: BeanstalkPalette.theme.winter.red }}
              />
            ) : (
              <Typography
                variant="body1"
                color={BeanstalkPalette.theme.winter.error}
              >
                {displayFullBN(chopPenalty, 5)}%
              </Typography>
            )}
          </Row>
        </Stack>
        {isSubmittable ? (
          <>
            <TxnSeparator />
            <TokenOutputField
              token={outputToken}
              amount={quote || ZERO_BN}
              bdv={quoteBdv}
            />
            <Box>
              <Accordion variant="outlined">
                <StyledAccordionSummary title="Transaction Details" />
                <AccordionDetails>
                  <TxnPreview
                    actions={[
                      {
                        type: ActionType.BASE,
                        message: `Chop ${displayBN(
                          state.amount || ZERO_BN
                        )} ${inputToken}.`,
                      },
                      {
                        type: ActionType.BASE,
                        message: `Add ${displayBN(
                          quote || ZERO_BN
                        )} ${outputToken} to your 
                        ${
                          values.destination === FarmToMode.EXTERNAL
                            ? `Circulating`
                            : `Farm`
                        } Balance.`,
                      },
                    ]}
                  />
                </AccordionDetails>
              </Accordion>
            </Box>
          </>
        ) : null}
        {isUnripeLP ? (
          <WarningAlert>
            <Typography>
              You can get more value by Converting to{' '}
              {sdk.tokens.UNRIPE_BEAN.symbol} first by Depositing and Converting
              in the Silo{' '}
              <Typography
                component={Link}
                href={`#/silo/${sdk.tokens.UNRIPE_BEAN_WSTETH.address}?action=deposit`}
              >
                here
              </Typography>
              . Note that you will have to wait 2 Seasons for your new Deposit
              to Germinate before Converting.
            </Typography>
          </WarningAlert>
        ) : null}
        <SmartSubmitButton
          type="submit"
          variant="contained"
          color="primary"
          size="large"
          disabled={!isSubmittable}
          contract={beanstalk}
          tokens={values.tokens}
          mode="auto"
        >
          Chop
        </SmartSubmitButton>
      </Stack>
    </Form>
  );
};

const usePreferredUnripeTokenConfig = () => {
  const { UNRIPE_BEAN, UNRIPE_BEAN_WSTETH } = useUnripeTokens();
  return useMemo(
    () => [
      { token: UNRIPE_BEAN, minimum: new BigNumber(1) },
      { token: UNRIPE_BEAN_WSTETH, minimum: new BigNumber(1) },
    ],
    [UNRIPE_BEAN, UNRIPE_BEAN_WSTETH]
  );
};

const Chop: FC<{}> = () => {
  /// Ledger
  const sdk = useSdk();
  const account = useAccount();
  const beanstalk = sdk.contracts.beanstalk;
  const [refetchUnripe] = useUnripe();

  const preferredUnripeTokenConfig = usePreferredUnripeTokenConfig();

  /// Farmer
  const farmerBalances = useFarmerBalances();
  const [refetchFarmerBalances] = useFetchFarmerBalances();

  /// Form
  const middleware = useFormMiddleware();
  const baseToken = usePreferredToken(preferredUnripeTokenConfig, 'use-best');
  const initialValues: ChopFormValues = useMemo(
    () => ({
      tokens: [
        {
          token: baseToken as ERC20Token,
          amount: undefined,
        },
      ],
      destination: FarmToMode.INTERNAL,
    }),
    [baseToken]
  );

  const initialBalanceFrom = useOptimizedBalanceSource(
    initialValues.tokens[0].token,
    farmerBalances
  );

  /// Handlers
  const onSubmit = useCallback(
    async (
      values: ChopFormValues,
      formActions: FormikHelpers<ChopFormValues>
    ) => {
      const txToast = new TransactionToast({});
      try {
        middleware.before();

        if (!account) throw new Error('Connect a wallet first.');
        if (!values.destination) throw new Error('No destination selected.');
        const state = values.tokens[0];
        if (!state.amount?.gt(0))
          throw new Error('No Unfertilized token to Chop.');

        txToast.setToastMessages({
          loading: `Chopping ${displayFullBN(state.amount)} ${
            state.token.symbol
          }...`,
          success: 'Chop successful.',
        });

        const txn = await beanstalk.chop(
          state.token.address,
          toStringBaseUnitBN(state.amount, state.token.decimals),
          optimizeFromMode(state.amount, farmerBalances[state.token.address]),
          values.destination
        );
        txToast.confirming(txn);

        const receipt = await txn.wait();
        await Promise.all([refetchFarmerBalances(), refetchUnripe()]);
        txToast.success(receipt);
        formActions.resetForm();
      } catch (err) {
        txToast.error(err);
        formActions.setSubmitting(false);
      }
    },
    [
      account,
      beanstalk,
      farmerBalances,
      middleware,
      refetchFarmerBalances,
      refetchUnripe,
    ]
  );

  return (
    <Formik<ChopFormValues>
      enableReinitialize
      initialValues={initialValues}
      onSubmit={onSubmit}
    >
      {(formikProps: FormikProps<ChopFormValues>) => (
        <ChopForm
          balances={farmerBalances}
          beanstalk={beanstalk}
          optimizedBalanceSource={initialBalanceFrom}
          {...formikProps}
        />
      )}
    </Formik>
  );
};

export default Chop;
