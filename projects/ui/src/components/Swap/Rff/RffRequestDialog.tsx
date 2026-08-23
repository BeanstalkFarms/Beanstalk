import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  Alert,
  Box,
  Button,
  Collapse,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { ethers } from 'ethers';
import { useNavigate } from 'react-router-dom';
import type { Address, Hex } from 'viem';
import {
  useAccount as useWagmiAccount,
  useSwitchChain,
} from 'wagmi';

import {
  StyledDialog,
  StyledDialogContent,
  StyledDialogTitle,
} from '~/components/Common/Dialog';
import {
  TokenAdornment,
  TokenSelectDialog,
} from '~/components/Common/Form';
import { BalanceFrom } from '~/components/Common/Form/BalanceFromRow';
import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import WalletButton from '~/components/Common/Connection/WalletButton';
import useFarmerBalances from '~/hooks/farmer/useFarmerBalances';
import useAccount from '~/hooks/ledger/useAccount';
import { useSigner } from '~/hooks/ledger/useSigner';
import useSdk from '~/hooks/sdk';
import type { TokenInstance } from '~/hooks/beanstalk/useTokens';
import useRffApproval from '~/hooks/rff/useRffApproval';
import {
  rffQueryKeys,
  useRffConfig,
  useRffTurnstile,
} from '~/hooks/rff/useRff';
import { rffApi } from '~/lib/Rff/runtime';
import {
  buildRffRequest,
  buildRffSwapRequestTypedData,
  minimumAmountOut,
  randomRffNonce,
} from '~/lib/Rff/request';
import { RffSessionManager } from '~/lib/Rff/session';
import type { RffQuote } from '~/lib/Rff/client';
import { displayFullBN, getTokenIndex } from '~/util';

import {
  balanceForSource,
  balanceModeForSource,
  isRffChain,
  recipientForConnectedAccount,
  rffQuoteKey,
} from './model';

type Props = {
  open: boolean;
  onClose: () => void;
};

const DEFAULT_SLIPPAGE_BPS = 100;

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
}

const RffRequestDialog: React.FC<Props> = ({ open, onClose }) => {
  const sdk = useSdk();
  const account = useAccount();
  const { chainId } = useWagmiAccount();
  const { isPending: isSwitchingChain, switchChain } = useSwitchChain();
  const { data: signer } = useSigner();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const balances = useFarmerBalances();
  const { data: config, error: configError } = useRffConfig(open);
  const { containerRef, getToken } = useRffTurnstile(
    config?.turnstileSiteKey
  );

  const [tokenIn, setTokenIn] = useState(sdk.tokens.BEAN);
  const [source, setSource] = useState(BalanceFrom.EXTERNAL);
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState(
    recipientForConnectedAccount(account)
  );
  const [advanced, setAdvanced] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [quote, setQuote] = useState<RffQuote | null>(null);
  const [quoteKey, setQuoteKey] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [requestId, setRequestId] = useState<Hex | null>(null);
  const quoteSequence = useRef(0);

  useEffect(() => {
    setRecipient(recipientForConnectedAccount(account));
  }, [account, open]);

  useEffect(() => {
    if (!open) {
      setAmount('');
      setQuote(null);
      setQuoteKey(null);
      setQuoteError(null);
      setSubmitError(null);
      setRequestId(null);
      setAdvanced(false);
    }
  }, [open]);

  const tokenOut = tokenIn.equals(sdk.tokens.BEAN)
    ? sdk.tokens.WSTETH
    : sdk.tokens.BEAN;
  const tokenBalance = balanceForSource(
    balances?.[getTokenIndex(tokenIn)],
    source
  );

  const amountIn = useMemo(() => {
    try {
      if (!amount || !new RegExp('^\\d*\\.?\\d+$').test(amount)) return 0n;
      return BigInt(tokenIn.fromHuman(amount).toBlockchain().toString());
    } catch {
      return 0n;
    }
  }, [amount, tokenIn]);

  const balanceIsEnough =
    amountIn > 0n && tokenBalance.gte(tokenIn.fromBlockchain(amountIn).toHuman());
  const recipientIsValid = ethers.utils.isAddress(recipient);
  const sourceMode = balanceModeForSource(source);
  const isCorrectChain = !!config && isRffChain(chainId, config.chainId);
  const approval = useRffApproval({
    token: tokenIn.address as Address,
    safeAddress: config?.safeAddress,
    sourceMode,
    requestedAmountIn: amountIn,
    expectedChainId: config?.chainId,
  });

  const fetchQuote = useCallback(async () => {
    if (!config || amountIn <= 0n) return null;
    const turnstileToken = await getToken('rff_quote');
    return rffApi.getQuote(
      tokenIn.address as Address,
      tokenOut.address as Address,
      amountIn,
      turnstileToken
    );
  }, [amountIn, config, getToken, tokenIn.address, tokenOut.address]);

  useEffect(() => {
    quoteSequence.current += 1;
    const sequence = quoteSequence.current;
    setQuote(null);
    setQuoteKey(null);
    setQuoteError(null);
    if (!open || !config || amountIn <= 0n) {
      setQuoteLoading(false);
      return undefined;
    }

    const timeout = window.setTimeout(async () => {
      setQuoteLoading(true);
      try {
        const nextQuote = await fetchQuote();
        if (quoteSequence.current === sequence) {
          setQuote(nextQuote);
          setQuoteKey(rffQuoteKey(tokenIn.address, amountIn));
        }
      } catch (error) {
        if (quoteSequence.current === sequence) {
          setQuoteError(errorMessage(error));
        }
      } finally {
        if (quoteSequence.current === sequence) setQuoteLoading(false);
      }
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [amountIn, config, fetchQuote, open, tokenIn.address]);

  const quoteIsCurrent =
    !!quote && quoteKey === rffQuoteKey(tokenIn.address, amountIn);

  const minAmountOut = quoteIsCurrent
    ? minimumAmountOut(quote.amountOut, DEFAULT_SLIPPAGE_BPS)
    : 0n;
  const formatTokenAmount = (value: bigint) =>
    tokenOut.fromBlockchain(value).toHuman('short');

  const handleTokenSelected = useCallback(
    (selected: Set<TokenInstance>) => {
      const selectedToken = Array.from(selected)[0];
      if (!selectedToken) return;
      setTokenIn(
        selectedToken.address.toLowerCase() ===
          sdk.tokens.BEAN.address.toLowerCase()
          ? sdk.tokens.BEAN
          : sdk.tokens.WSTETH
      );
    },
    [sdk.tokens.BEAN, sdk.tokens.WSTETH]
  );

  const handleSubmit = async () => {
    if (!account || !signer || !config || amountIn <= 0n) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      if (!isCorrectChain) {
        throw new Error('Switch to Arbitrum One before submitting.');
      }
      let freshQuote = quoteIsCurrent ? quote : null;
      if (!freshQuote || freshQuote.expiresAt * 1_000 <= Date.now()) {
        freshQuote = await fetchQuote();
      }
      if (!freshQuote) throw new Error('A current quote is required.');

      const request = buildRffRequest({
        requester: account as Address,
        recipient: recipient as Address,
        tokenIn: tokenIn.address as Address,
        requestedAmountIn: amountIn,
        quotedAmountOut: freshQuote.amountOut,
        sourceMode,
        slippageBps: DEFAULT_SLIPPAGE_BPS,
        nonce: randomRffNonce(),
        nowSeconds: Math.floor(Date.now() / 1_000),
      });

      const session = new RffSessionManager(rffApi);
      await session.ensureSession({
        requester: account as Address,
        getToken,
        signMessage: async (message) =>
          (await signer.signMessage(message)) as Hex,
      });

      const typedData = buildRffSwapRequestTypedData(
        request,
        config.safeAddress
      );
      const signature = (await (
        signer as ethers.providers.JsonRpcSigner
      )._signTypedData(
        typedData.domain,
        typedData.types as unknown as Record<string, ethers.TypedDataField[]>,
        typedData.message
      )) as Hex;
      const turnstileToken = await getToken('rff_submit');
      const response = await rffApi.createRequest(
        request,
        signature,
        turnstileToken
      );
      setRequestId(response.requestId);
      await queryClient.invalidateQueries({
        queryKey: rffQueryKeys.requests(account),
      });
    } catch (error) {
      setSubmitError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const requestReady =
    !!account &&
    !!signer &&
    !!config &&
    isCorrectChain &&
    amountIn > 0n &&
    balanceIsEnough &&
    recipientIsValid &&
    quoteIsCurrent &&
    approval.isApproved &&
    !quoteLoading;

  return (
    <>
      <StyledDialog
        open={open}
        onClose={submitting ? undefined : onClose}
        fullWidth
        maxWidth="sm"
      >
        <StyledDialogTitle onClose={submitting ? undefined : onClose}>
          Request a Fill
        </StyledDialogTitle>
        <StyledDialogContent sx={{ px: 2, pb: 2 }}>
          {requestId ? (
            <Stack alignItems="center" textAlign="center" gap={2} py={5}>
              <CheckCircleRoundedIcon color="primary" sx={{ fontSize: 64 }} />
              <Box>
                <Typography variant="h3">Request submitted</Typography>
                <Typography color="text.secondary" mt={0.5}>
                  Your request is pending review and expires in one month.
                </Typography>
              </Box>
              <Button
                variant="contained"
                onClick={() => navigate(`/balances?request=${requestId}`)}
              >
                See request →
              </Button>
            </Stack>
          ) : (
            <Stack gap={2}>
              <Typography color="text.secondary">
                Request an off-market BEAN ↔ wstETH fill from Beanstalk Farms.
                Your destination is always your external wallet balance.
              </Typography>

              <TokenSelectDialog
                title="Select Input"
                open={selectorOpen}
                handleClose={() => setSelectorOpen(false)}
                handleSubmit={handleTokenSelected}
                selected={[{ token: tokenIn }]}
                balances={balances}
                tokenList={[sdk.tokens.BEAN, sdk.tokens.WSTETH]}
                mode={TokenSelectMode.SINGLE}
                balanceFrom={source}
                setBalanceFrom={setSource}
                balanceFromOptions={[
                  BalanceFrom.EXTERNAL,
                  BalanceFrom.INTERNAL,
                ]}
              />

              <Stack gap={0.75}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography fontWeight="fontWeightBold">Input</Typography>
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => setAmount(tokenBalance.toFixed())}
                    disabled={tokenBalance.lte(0)}
                    sx={{ minWidth: 0, height: 'auto', p: 0 }}
                  >
                    Max
                  </Button>
                </Stack>
                <TextField
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0"
                  fullWidth
                  error={amountIn > 0n && !balanceIsEnough}
                  helperText={
                    amountIn > 0n && !balanceIsEnough
                      ? `Exceeds ${
                          source === BalanceFrom.EXTERNAL
                            ? 'Circulating'
                            : 'Farm'
                        } Balance`
                      : `Balance: ${displayFullBN(tokenBalance, tokenIn.displayDecimals)}`
                  }
                  InputProps={{
                    endAdornment: (
                      <TokenAdornment
                        token={tokenIn}
                        balanceFrom={source}
                        onClick={() => setSelectorOpen(true)}
                      />
                    ),
                  }}
                />
              </Stack>

              <Box
                sx={{
                  border: '1px solid',
                  borderColor: 'text.light',
                  borderRadius: 1,
                  p: 1.5,
                }}
              >
                <Stack direction="row" justifyContent="space-between" gap={2}>
                  <Box>
                    <Typography color="text.secondary" variant="bodySmall">
                      Estimated output
                    </Typography>
                    <Typography variant="h4">
                      {quoteLoading ? (
                        <CircularProgress size={18} />
                      ) : quoteIsCurrent ? (
                        formatTokenAmount(quote.amountOut)
                      ) : (
                        '—'
                      )}
                    </Typography>
                  </Box>
                  <TokenAdornment token={tokenOut} />
                </Stack>
                <Divider sx={{ my: 1.25 }} />
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">
                    Minimum received
                  </Typography>
                  <Typography>
                    {quoteIsCurrent
                      ? `${formatTokenAmount(minAmountOut)} ${tokenOut.symbol}`
                      : '—'}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">Slippage</Typography>
                  <Typography>1.0%</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">Destination</Typography>
                  <Typography>Circulating Balance</Typography>
                </Stack>
              </Box>

              <Box>
                <Button
                  variant="text"
                  color="secondary"
                  fullWidth
                  onClick={() => setAdvanced((value) => !value)}
                  endIcon={
                    <ExpandMoreRoundedIcon
                      sx={{
                        transform: advanced ? 'rotate(180deg)' : 'none',
                        transition: 'transform 150ms ease',
                      }}
                    />
                  }
                  sx={{ justifyContent: 'space-between', px: 0 }}
                >
                  Advanced
                </Button>
                <Collapse in={advanced}>
                  <Stack gap={1.5} pt={1}>
                    <TextField
                      label="Recipient"
                      value={recipient}
                      onChange={(event) => setRecipient(event.target.value)}
                      error={!!recipient && !recipientIsValid}
                      helperText={
                        recipient && !recipientIsValid
                          ? 'Enter a valid wallet address'
                          : 'Receives the output in Circulating Balance'
                      }
                      fullWidth
                    />
                    <TextField
                      label="Expiration"
                      value="1 month"
                      fullWidth
                      InputProps={{ readOnly: true }}
                    />
                  </Stack>
                </Collapse>
              </Box>

              <Alert severity="info" icon={<InfoOutlinedIcon />}>
                A smaller fill may execute if your approval or selected balance
                drops below the requested input. That fill completes this request;
                no remainder stays open.
              </Alert>

              {configError || quoteError || submitError || approval.error ? (
                <Alert severity="error">
                  {errorMessage(
                    configError || quoteError || submitError || approval.error
                  )}
                </Alert>
              ) : null}

              {!account ? (
                <WalletButton showFullText variant="contained" color="primary" />
              ) : !isCorrectChain && config ? (
                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  disabled={isSwitchingChain}
                  onClick={() => switchChain({ chainId: config.chainId })}
                  startIcon={
                    isSwitchingChain ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : undefined
                  }
                >
                  {isSwitchingChain ? 'Switching…' : 'Switch to Arbitrum One'}
                </Button>
              ) : (
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                  <Button
                    variant={approval.isApproved ? 'outlined' : 'contained'}
                    color="primary"
                    fullWidth
                    disabled={
                      amountIn <= 0n ||
                      !balanceIsEnough ||
                      !config ||
                      !approval.isCorrectChain ||
                      approval.isApproving ||
                      approval.isApproved
                    }
                    onClick={() => approval.approve()}
                    startIcon={
                      approval.isApproving ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : approval.isApproved ? (
                        <CheckCircleRoundedIcon />
                      ) : undefined
                    }
                  >
                    {approval.isApproved
                      ? 'Approved'
                      : approval.isApproving
                        ? 'Approving…'
                        : `Approve ${tokenIn.symbol}`}
                  </Button>
                  <Tooltip
                    title={
                      !approval.isApproved
                        ? 'Approve the exact input amount first.'
                        : ''
                    }
                  >
                    <Box width="100%">
                      <Button
                        variant="contained"
                        color="primary"
                        fullWidth
                        disabled={!requestReady || submitting}
                        onClick={handleSubmit}
                        startIcon={
                          submitting ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : undefined
                        }
                      >
                        {submitting ? 'Submitting…' : 'Request for Fill'}
                      </Button>
                    </Box>
                  </Tooltip>
                </Stack>
              )}
            </Stack>
          )}
          <Box
            ref={containerRef}
            sx={{ minHeight: 1 }}
            aria-live="polite"
            aria-label="Security verification challenge"
          />
        </StyledDialogContent>
      </StyledDialog>
    </>
  );
};

export default RffRequestDialog;
