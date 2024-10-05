import React, { useEffect, useState } from 'react';
import { Box, Button, Card, Typography } from '@mui/material';
import PageHeader from '~/components/Common/PageHeader';
import { FontWeight } from '~/components/App/muiTheme';
import CheckIcon from '@mui/icons-material/Check';
import TransactionToast from '~/components/Common/TxnToast';
import useSdk from '~/hooks/sdk';
import useAccount from '~/hooks/ledger/useAccount';
import BeanProgressIcon from '~/components/Common/BeanProgressIcon';


export default function L2Claim() {

    const [sourceAccount, setSourceAccount] = useState<string | undefined>(undefined);

    const [needsMigration, setNeedsMigration] = useState<boolean>(false);
    const [deposits, setDeposits] = useState<any>(undefined);
    const [ferts, setFerts] = useState<any>(undefined);
    const [plots, setPlots] = useState<any>(undefined);
    const [farmBalance, setFarmBalance] = useState<any>(undefined);

    const [receiverApproved, setReceiverApproved] = useState<boolean>(false);

    const account = useAccount();
    const sdk = useSdk();

    const hasDeposits = deposits ? Object.keys(deposits).length > 0 : false;
    const hasFert = ferts ? Object.keys(ferts).length > 0 : false;
    const hasPlots = plots ? Object.keys(plots).length > 0 : false;
    const hasFarmBalance = farmBalance ? Object.keys(farmBalance).length > 0 : false;

    function getEvent() {
        const event = sdk.contracts.beanstalk.filters['ReceiverApproved(address,address)'](sourceAccount);
        console.log("event: ", event)
        if (!event || !event.topics || event.topics.length === 1) return
        setReceiverApproved(true)
    };

    function getReceipt() {
        const ticket = localStorage.getItem("retryableTicket")
        if (ticket) {
            setSourceAccount(JSON.parse(ticket).l1Address);
        };
    };

    useEffect(() => {
        getReceipt();
    }, []);

    useEffect(() => {
        async function getMigrationData() {
            if (!account) return
            const migrationData = await fetch(`/.netlify/functions/l2migration?account=${sourceAccount}`)
                .then((response) => response.json())
            setNeedsMigration(migrationData.needsManualMigration)
            setDeposits(migrationData.deposits)
            setFerts(migrationData.fertilizer)
            setPlots(migrationData.plots)
            setFarmBalance(migrationData.farmBalance)
        };
        getMigrationData();
    }, [account]);

    useEffect(() => {
        const interval = setInterval(() => {
            getEvent()
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    const claimEnabled = receiverApproved && (hasDeposits || hasFert || hasPlots || hasFarmBalance);

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
            })
            .catch((err) => {
                console.error(txToast.error(err.error || err));
            });
    }

    return (
        <Box sx={{ paddingX: 2 }}>
            <PageHeader
                title="Delegate Contract Balance for L2 Migration"
                description="Specify which address your want your Beanstalk assets migrated to on Arbitrum"
            />
            <Card sx={{ padding: 1, maxWidth: 700, minWidth: 300, marginTop: 2 }}>
                <Typography variant="h4" fontWeight={FontWeight.bold} padding={1}>
                    {"Receive Delegated Balances from Mainnet"}
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
                    <Button
                        disabled={!claimEnabled}
                        sx={{
                            width: "100%",
                            height: 60,
                        }}
                        onClick={() => onSubmit()}
                    >
                        {!receiverApproved ?
                            <Box sx={{ display: 'inline-flex', gap: 1, alignContent: 'center' }}>
                                <BeanProgressIcon
                                    size={16}
                                    enabled
                                    variant="indeterminate"
                                />
                                Waiting For L2...
                            </Box>
                            :
                            'Receive Assets'
                        }
                    </Button>
                </Box>
            </Card>
        </Box>
    )
};
