import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Card, Link, Typography } from '@mui/material';
import PageHeader from '~/components/Common/PageHeader';
import { FontWeight } from '~/components/App/muiTheme';
import CheckIcon from '@mui/icons-material/Check';
import TransactionToast from '~/components/Common/TxnToast';
import useSdk from '~/hooks/sdk';
import useAccount from '~/hooks/ledger/useAccount';
import BeanProgressIcon from '~/components/Common/BeanProgressIcon';
import useChainState from '~/hooks/chain/useChainState';
import { useSwitchChain } from 'wagmi';
import useBanner from '~/hooks/app/useBanner';
import useNavHeight from '~/hooks/app/usePageDimensions';
import {
    findLatestReceiverApproval,
    fetchMigrationEventState,
    L2_MIGRATION_EVENT_FROM_BLOCK,
} from '~/lib/L2Migration/events';
import {
    createRequestScope,
    fetchL2MigrationData,
    readStoredMigrationSource,
} from '~/lib/L2Migration/requests';

const L2_CLAIM_EVENT_POLL_INTERVAL = 5 * 60_000;

export default function L2Claim() {

    const [discoveredMigration, setDiscoveredMigration] = useState<{
        receiver: string;
        source: string;
    }>();

    const [deposits, setDeposits] = useState<any>(undefined);
    const [ferts, setFerts] = useState<any>(undefined);
    const [plots, setPlots] = useState<any>(undefined);
    const [farmBalance, setFarmBalance] = useState<any>(undefined);

    const [depositsClaimed, setDepositsClaimed] = useState(false);
    const [plotsClaimed, setPlotsClaimed] = useState(false);
    const [internalBalancesClaimed, setInternalBalancesClaimed] = useState(false);
    const [fertilizerClaimed, setFertilizerClaimed] = useState(false);

    const [receiverApproved, setReceiverApproved] = useState<boolean>(false);

    const account = useAccount();
    const sdk = useSdk();
    const cachedSourceAccount = useMemo(
        () => readStoredMigrationSource(
            () => window.localStorage.getItem('internalL2MigrationData'),
            account
        ),
        [account]
    );
    const discoveredSourceAccount =
        account && discoveredMigration?.receiver.toLowerCase() === account.toLowerCase()
            ? discoveredMigration.source
            : undefined;
    const sourceAccount = discoveredSourceAccount ?? cachedSourceAccount;

    const { isArbitrum, isTestnet } = useChainState();
    const { switchChain } = useSwitchChain();

    const hasDeposits = deposits ? Object.keys(deposits).length > 0 : false;
    const hasFert = ferts ? Object.keys(ferts).length > 0 : false;
    const hasPlots = plots ? Object.keys(plots).length > 0 : false;
    const hasFarmBalance = farmBalance ? Object.keys(farmBalance).length > 0 : false;
    const claimEnabled = receiverApproved && (hasDeposits || hasFert || hasPlots || hasFarmBalance);
    const claimComplete = (hasDeposits || hasFert || hasPlots || hasFarmBalance)
        && ((hasDeposits === depositsClaimed) && (hasFert === fertilizerClaimed) && (hasPlots === plotsClaimed) && (hasFarmBalance === internalBalancesClaimed));

    const eventRequestScopeRef = useRef(createRequestScope());

    useEffect(() => {
        setDeposits(undefined);
        setFerts(undefined);
        setPlots(undefined);
        setFarmBalance(undefined);
        setDepositsClaimed(false);
        setPlotsClaimed(false);
        setInternalBalancesClaimed(false);
        setFertilizerClaimed(false);
        setReceiverApproved(false);
    }, [account, sourceAccount]);

    const getEvent = useCallback(async () => {
        if (claimComplete || !account) return

        const requestScope = eventRequestScopeRef.current;
        const request = requestScope.begin(
            `${account.toLowerCase()}:${sourceAccount?.toLowerCase() ?? 'discover'}`
        );
        if (!request) return;

        try {
            if (sourceAccount) {
                const state = await fetchMigrationEventState(
                    sdk.contracts.beanstalk,
                    sourceAccount
                );
                if (!requestScope.isCurrent(request)) return;

                setReceiverApproved(
                    state.receiver?.toLowerCase() === account.toLowerCase()
                );
                setDepositsClaimed(state.depositsClaimed);
                setPlotsClaimed(state.plotsClaimed);
                setInternalBalancesClaimed(state.internalBalancesClaimed);
                setFertilizerClaimed(state.fertilizerClaimed);
            } else {
                const receiverFilter = sdk.contracts.beanstalk.filters['ReceiverApproved(address,address)']();
                const logs = await sdk.contracts.beanstalk.queryFilter(receiverFilter, L2_MIGRATION_EVENT_FROM_BLOCK, 'latest');
                if (!requestScope.isCurrent(request)) return;

                const discoveredSource = findLatestReceiverApproval(logs, account);
                if (discoveredSource) {
                    setDiscoveredMigration({
                        receiver: account,
                        source: discoveredSource,
                    });
                    setReceiverApproved(true);
                    return;
                }
                setReceiverApproved(false);
            }
        } catch (error) {
            if (requestScope.isCurrent(request)) {
                console.error('[l2claim] Failed to load migration events', error);
            }
        } finally {
            requestScope.finish(request);
        }
    }, [sdk.contracts.beanstalk, sourceAccount, account, claimComplete]);

    useEffect(() => {
        if (!account || !sourceAccount) return;

        const controller = new AbortController();
        fetchL2MigrationData(sourceAccount, controller.signal)
            .then((migrationData) => {
                if (controller.signal.aborted) return;
                setDeposits(migrationData.deposits);
                setFerts(migrationData.fertilizer);
                setPlots(migrationData.plots);
                setFarmBalance(migrationData.farmBalance);
            })
            .catch((error) => {
                if (!controller.signal.aborted) {
                    console.error('[l2claim] Failed to load migration data', error);
                }
            });

        return () => controller.abort();
    }, [account, sourceAccount]);

    useEffect(() => {
        if (claimComplete) return;
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                getEvent();
            }
        }, L2_CLAIM_EVENT_POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [getEvent, claimComplete]);

    useEffect(() => {
        getEvent();
    }, [getEvent]);

    function onSubmit() {

        if (!sourceAccount || !account) return

        const txToast = new TransactionToast({
            loading: 'Receiving Balances from Mainnet...',
            success: 'Balances Received!',
        });

        const farmCallData = [];

        if (hasDeposits) {
            const issueDeposits = sdk.contracts.beanstalk.interface.encodeFunctionData("issueDeposits", [
                sourceAccount,
                deposits.depositIds,
                deposits.amounts,
                deposits.bdvs,
                deposits.proofs
            ])
            farmCallData.push(issueDeposits)
        };

        if (hasFert) {
            const issueFert = sdk.contracts.beanstalk.interface.encodeFunctionData("issueFertilizer", [
                sourceAccount,
                ferts.fertIds,
                ferts.amounts,
                ferts.lastBpf,
                ferts.proofs
            ])
            farmCallData.push(issueFert)
        }

        if (hasPlots) {
            const issuePlots = sdk.contracts.beanstalk.interface.encodeFunctionData("issuePlots", [
                sourceAccount,
                plots.index,
                plots.pods,
                plots.proofs
            ])
            farmCallData.push(issuePlots)
        }

        if (hasFarmBalance) {
            const issueFarmBalance = sdk.contracts.beanstalk.interface.encodeFunctionData("issueInternalBalances", [
                sourceAccount,
                farmBalance.tokens,
                farmBalance.amounts,
                farmBalance.proofs
            ])
            farmCallData.push(issueFarmBalance)
        }

        sdk.contracts.beanstalk.farm(farmCallData)
            .then((txn) => {
                txToast.confirming(txn);
                return txn.wait();
            })
            .then((receipt) => {
                txToast.success(receipt);
                getEvent();
            })
            .catch((err) => {
                console.error(txToast.error(err.error || err));
            });
    }

    const banner = useBanner();
    const navHeight = useNavHeight(!!banner);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: `calc(100vh - ${navHeight}px)`, paddingX: 1 }}>
            <Box sx={{ textAlign: 'left' }}>
                <PageHeader
                    title="Receive Contract Balance on L2"
                    description="Retrieve the balances delegated to the address specified in the previous step"
                    sx={{ textAlign: 'left' }}
                />
                <Card sx={{ padding: 1, maxWidth: 700, minWidth: 300, marginTop: 2, }}>
                    {claimComplete ?
                        <Box sx={{
                            height: 200, display: 'flex', flex: 1,
                            justifyContent: 'center',
                            alignItems: 'center',
                            flexDirection: 'column'
                        }}>
                            <Typography variant="h4" textAlign="center">Beanstalk Balance Migration Complete!</Typography>
                            <Link
                                color="primary"
                                display="flex"
                                flexDirection="row"
                                gap={1}
                                alignItems="center"
                                href="/"
                            >
                                <Typography variant="h4">Migrate another address</Typography>
                            </Link>
                        </Box>
                        :
                        <>
                            <Typography variant="h4" fontWeight={FontWeight.bold} padding={1}>
                                Receive Delegated Balances from Mainnet
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <Box
                                    sx={{
                                        padding: 1,
                                        border: 1,
                                        borderColor: hasDeposits ? '#46B955' : undefined,
                                        backgroundColor: hasDeposits ? '#EDF8EE' : undefined,
                                        borderRadius: 1,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 0.5
                                    }}>
                                    {hasDeposits &&
                                        <CheckIcon sx={{ width: 20, height: 20 }} />
                                    }
                                    <Typography>{hasDeposits ? 'Silo Deposits' : 'No Silo Deposits'}</Typography>
                                </Box>
                                <Box
                                    sx={{
                                        padding: 1,
                                        border: 1,
                                        borderColor: hasPlots ? '#46B955' : undefined,
                                        backgroundColor: hasPlots ? '#EDF8EE' : undefined,
                                        borderRadius: 1,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 0.5
                                    }}>
                                    {hasPlots &&
                                        <CheckIcon sx={{ width: 20, height: 20 }} />
                                    }
                                    <Typography>{hasPlots ? 'Pods' : 'No Pods'}</Typography>
                                </Box>
                                <Box
                                    sx={{
                                        padding: 1,
                                        border: 1,
                                        borderColor: hasFarmBalance ? '#46B955' : undefined,
                                        backgroundColor: hasFarmBalance ? '#EDF8EE' : undefined,
                                        borderRadius: 1,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 0.5
                                    }}>
                                    {hasFarmBalance &&
                                        <CheckIcon sx={{ width: 20, height: 20 }} />
                                    }
                                    <Typography>{hasFarmBalance ? 'Farm Balance' : 'No Farm Balance'}</Typography>
                                </Box>
                                <Box
                                    sx={{
                                        padding: 1,
                                        border: 1,
                                        borderColor: hasFert ? '#46B955' : undefined,
                                        backgroundColor: hasFert ? '#EDF8EE' : undefined,
                                        borderRadius: 1,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 0.5
                                    }}>
                                    {hasFert &&
                                        <CheckIcon sx={{ width: 20, height: 20 }} />
                                    }
                                    <Typography>{hasFert ? 'Fertilizer' : 'No Fertilizer'}</Typography>
                                </Box>
                                <Typography sx={{ padding: 1 }}>
                                    This page checks Arbitrum One for the arrival of migration data every few minutes. The button below will automatically
                                    enable itself when this data becomes available.
                                </Typography>
                                <Button
                                    disabled={!isArbitrum ? !!isArbitrum : (isArbitrum && !claimEnabled)}
                                    sx={{
                                        width: "100%",
                                        height: 60,
                                        backgroundColor: (!isArbitrum && !isTestnet) ? '#213147' : undefined,
                                        color: (!isArbitrum && !isTestnet) ? '#12ABFF' : undefined,
                                        '&:hover': {
                                            backgroundColor: (!isArbitrum && !isTestnet) ? '#375278' : undefined,
                                        }
                                    }}
                                    onClick={() => (!isArbitrum && !isTestnet) ? switchChain({ addEthereumChainParameter: { chainName: "Arbitrum One", rpcUrls: ["https://arb1.arbitrum.io/rpc"] }, chainId: 42161 }) : onSubmit()}
                                >
                                    {(!isArbitrum && !isTestnet) ?
                                        'Switch to Arbitrum One'
                                        : !receiverApproved ?
                                            <Box sx={{ display: 'inline-flex', gap: 1, alignContent: 'center' }}>
                                                <BeanProgressIcon
                                                    size={16}
                                                    enabled
                                                    variant="indeterminate"
                                                />
                                                Awaiting Migration Confirmation...
                                            </Box>
                                            :
                                            'Claim Beanstalk Balances'
                                    }
                                </Button>
                            </Box>
                        </>
                    }
                </Card>
            </Box>
        </Box>
    )
};
