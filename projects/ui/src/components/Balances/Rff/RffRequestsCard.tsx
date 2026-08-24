import React, { useMemo, useState } from 'react';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { ethers } from 'ethers';
import { useSearchParams } from 'react-router-dom';
import type { Address, Hex } from 'viem';

import WalletButton from '~/components/Common/Connection/WalletButton';
import useAccount from '~/hooks/ledger/useAccount';
import { useSigner } from '~/hooks/ledger/useSigner';
import useSdk from '~/hooks/sdk';
import {
  rffQueryKeys,
  useRffConfig,
  useRffRequests,
} from '~/hooks/rff/useRff';
import { rffApi } from '~/lib/Rff/runtime';
import { RffApiError, type RffRequestRecord } from '~/lib/Rff/client';
import {
  BalanceMode,
  buildCancelRffSwapTypedData,
} from '~/lib/Rff/request';
import {
  RffSessionAccountMismatchError,
  RffSessionManager,
} from '~/lib/Rff/session';
import { useQueryClient } from '@tanstack/react-query';

import { requestStatusText, requestTokenSymbol } from './requestDisplay';

function readableError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
}

function statusColor(status: RffRequestRecord['status']) {
  if (status === 'EXECUTED') return 'primary.main';
  if (status === 'CANCELLED' || status === 'EXPIRED') return 'text.secondary';
  return 'warning.main';
}

const RffRequestsCard: React.FC = () => {
  const account = useAccount();
  const { data: signer } = useSigner();
  const sdk = useSdk();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('request');
  const { data: config } = useRffConfig(!!account);
  const requests = useRffRequests(account);
  const [verifying, setVerifying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const sortedRequests = useMemo(
    () =>
      [...(requests.data || [])].sort(
        (left, right) => right.createdAt - left.createdAt
      ),
    [requests.data]
  );
  const selected = sortedRequests.find((request) => request.id === selectedId);
  const needsSession =
    (requests.error instanceof RffApiError && requests.error.status === 401) ||
    requests.error instanceof RffSessionAccountMismatchError;

  const ensureSession = async () => {
    if (!account || !signer) throw new Error('Connect a wallet to continue.');
    const session = new RffSessionManager(rffApi);
    await session.ensureSession({
      requester: account as Address,
      signMessage: async (message) =>
        (await signer.signMessage(message)) as Hex,
    });
  };

  const handleVerify = async () => {
    setActionError(null);
    setVerifying(true);
    try {
      await ensureSession();
      await requests.refetch();
    } catch (error) {
      setActionError(readableError(error));
    } finally {
      setVerifying(false);
    }
  };

  const handleCancel = async (request: RffRequestRecord) => {
    if (!signer || !config) return;
    setActionError(null);
    setCancelling(true);
    try {
      await ensureSession();
      const deadline = BigInt(Math.floor(Date.now() / 1_000) + 5 * 60);
      const typedData = buildCancelRffSwapTypedData(
        { requestId: request.id, deadline },
        config.safeAddress
      );
      const signature = (await (
        signer as ethers.providers.JsonRpcSigner
      )._signTypedData(
        typedData.domain,
        typedData.types as unknown as Record<string, ethers.TypedDataField[]>,
        typedData.message
      )) as Hex;
      await rffApi.cancelRequest(request.id, deadline, signature);
      await queryClient.invalidateQueries({
        queryKey: rffQueryKeys.requests(account),
      });
    } catch (error) {
      setActionError(readableError(error));
    } finally {
      setCancelling(false);
    }
  };

  const tokenFor = (address: Address) =>
    requestTokenSymbol(address) === 'BEAN'
      ? sdk.tokens.BEAN
      : sdk.tokens.WSTETH;

  const renderAmount = (value: bigint, address: Address) => {
    const token = tokenFor(address);
    return `${token.fromBlockchain(value).toHuman('short')} ${token.symbol}`;
  };

  const renderList = () => {
    if (!account) {
      return (
        <Stack alignItems="center" textAlign="center" gap={1.5} py={5}>
          <Typography color="text.secondary">
            Connect your wallet to see fill requests.
          </Typography>
          <WalletButton showFullText variant="contained" color="primary" />
        </Stack>
      );
    }
    if (requests.isLoading) {
      return (
        <Stack alignItems="center" py={6}>
          <CircularProgress size={24} />
        </Stack>
      );
    }
    if (needsSession) {
      return (
        <Stack alignItems="center" textAlign="center" gap={1.5} py={4}>
          <Typography color="text.secondary">
            Verify your wallet to privately load its fill requests.
          </Typography>
          <Button
            variant="contained"
            onClick={handleVerify}
            disabled={verifying || !config}
            startIcon={
              verifying ? <CircularProgress size={16} color="inherit" /> : null
            }
          >
            {verifying ? 'Verifying…' : 'Verify wallet'}
          </Button>
        </Stack>
      );
    }
    if (requests.error) {
      return <Alert severity="error">{readableError(requests.error)}</Alert>;
    }
    if (!sortedRequests.length) {
      return (
        <Stack alignItems="center" textAlign="center" gap={1} py={5}>
          <Typography variant="h4">No fill requests yet</Typography>
          <Typography color="text.secondary">
            Requests created from Swap will appear here.
          </Typography>
        </Stack>
      );
    }

    return (
      <Stack divider={<Divider flexItem />}>
        {sortedRequests.map((request) => {
          const inputToken = tokenFor(request.tokenIn);
          return (
            <Button
              key={request.id}
              variant="text"
              color="secondary"
              onClick={() => setSearchParams({ request: request.id })}
              sx={{
                justifyContent: 'stretch',
                textAlign: 'left',
                px: 0,
                py: 1.5,
                height: 'auto',
              }}
            >
              <Stack width="100%" gap={0.5}>
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <Stack direction="row" alignItems="center" gap={0.75}>
                    <Box
                      component="img"
                      src={inputToken.logo}
                      alt=""
                      sx={{ width: 22, height: 22 }}
                    />
                    <Typography color="text.primary" fontWeight="fontWeightBold">
                      {renderAmount(request.requestedAmountIn, request.tokenIn)}
                    </Typography>
                  </Stack>
                  <OpenInNewRoundedIcon sx={{ fontSize: 16 }} />
                </Stack>
                <Typography color="text.secondary" variant="bodySmall">
                  Receive at least{' '}
                  {renderAmount(
                    request.minAmountOutAtRequestedIn,
                    request.tokenOut
                  )}
                </Typography>
                <Typography
                  color={statusColor(request.status)}
                  variant="bodySmall"
                >
                  {requestStatusText(
                    request.status,
                    Number(request.deadline)
                  )}
                </Typography>
              </Stack>
            </Button>
          );
        })}
      </Stack>
    );
  };

  const renderDetail = (request: RffRequestRecord) => (
    <Stack gap={1.5}>
      <Stack direction="row" alignItems="center" gap={1}>
        <IconButton
          aria-label="Back to requests"
          onClick={() => setSearchParams({})}
          sx={{ p: 0.5 }}
        >
          <ArrowBackRoundedIcon />
        </IconButton>
        <Box>
          <Typography variant="h4">Request details</Typography>
          <Typography color={statusColor(request.status)} variant="bodySmall">
            {requestStatusText(request.status, Number(request.deadline))}
          </Typography>
        </Box>
      </Stack>
      <Divider />
      <Stack gap={0.75}>
        <Stack direction="row" justifyContent="space-between" gap={2}>
          <Typography color="text.secondary">Input</Typography>
          <Typography fontWeight="fontWeightBold">
            {renderAmount(request.requestedAmountIn, request.tokenIn)}
          </Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between" gap={2}>
          <Typography color="text.secondary">From</Typography>
          <Typography>
            {request.sourceMode === BalanceMode.EXTERNAL
              ? 'Circulating Balance'
              : 'Farm Balance'}
          </Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between" gap={2}>
          <Typography color="text.secondary">Minimum received</Typography>
          <Typography>
            {renderAmount(
              request.minAmountOutAtRequestedIn,
              request.tokenOut
            )}
          </Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between" gap={2}>
          <Typography color="text.secondary">Destination</Typography>
          <Typography>Circulating Balance</Typography>
        </Stack>
        {request.actualAmountIn !== null ? (
          <>
            <Divider sx={{ my: 0.5 }} />
            <Stack direction="row" justifyContent="space-between" gap={2}>
              <Typography color="text.secondary">Filled input</Typography>
              <Typography>
                {renderAmount(request.actualAmountIn, request.tokenIn)}
              </Typography>
            </Stack>
          </>
        ) : null}
        {request.actualAmountOut !== null ? (
          <Stack direction="row" justifyContent="space-between" gap={2}>
            <Typography color="text.secondary">Received</Typography>
            <Typography>
              {renderAmount(request.actualAmountOut, request.tokenOut)}
            </Typography>
          </Stack>
        ) : null}
      </Stack>
      {request.status === 'EXECUTED' ? (
        <Alert severity="success" icon={<CheckCircleRoundedIcon />}>
          This request has been filled.
        </Alert>
      ) : null}
      {request.status === 'OPEN' ? (
        <Button
          variant="outlined"
          color="cancel"
          onClick={() => handleCancel(request)}
          disabled={cancelling}
        >
          {cancelling ? 'Cancelling…' : 'Cancel request'}
        </Button>
      ) : null}
    </Stack>
  );

  return (
    <Card sx={{ height: { lg: 422 }, overflow: 'auto' }}>
      <Stack gap={1.5} p={2}>
        {!selected ? (
          <Stack direction="row" alignItems="center" gap={0.75}>
            <Typography variant="h4">Fill Requests</Typography>
            <Tooltip
              variant="wide"
              title="A smaller fill may execute if your approval or selected-source wallet balance drops below the requested input. That fill completes the request; no remainder stays open."
            >
              <IconButton
                aria-label="About smaller fills"
                size="small"
                sx={{ p: 0.25 }}
              >
                <InfoOutlinedIcon
                  sx={{ fontSize: 16, color: 'text.secondary' }}
                />
              </IconButton>
            </Tooltip>
          </Stack>
        ) : null}
        {selected ? renderDetail(selected) : renderList()}
        {selectedId && !selected && !requests.isLoading ? (
          <Alert severity="warning">That request could not be found.</Alert>
        ) : null}
        {actionError ? <Alert severity="error">{actionError}</Alert> : null}
      </Stack>
    </Card>
  );
};

export default RffRequestsCard;
