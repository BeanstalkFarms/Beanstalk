import React, { useEffect, useState } from 'react';
import { Box, Button, Card, Typography } from '@mui/material';
import PageHeader from '~/components/Common/PageHeader';
import { FontWeight } from '~/components/App/muiTheme';
import CheckIcon from '@mui/icons-material/Check';
import TransactionToast from '~/components/Common/TxnToast';
import useSdk from '~/hooks/sdk';
import useAccount from '~/hooks/ledger/useAccount';


export default function L2Claim() {

    const [sourceAccount, setSourceAccount] = useState<string | undefined>(undefined);

    const [needsMigration, setNeedsMigration] = useState<boolean>(false);
    const [deposits, setDeposits] = useState<any>(undefined);
    const [ferts, setFerts] = useState<any>(undefined);
    const [plots, setPlots] = useState<any>(undefined);
    const [farmBal, setFarmBal] = useState<any>(undefined);

    const [receiverApproved, setReceiverApproved] = useState<boolean>(false);

    const account = useAccount();
    const sdk = useSdk();

    function getEvent() {
        const event = sdk.contracts.beanstalk.filters['RecieverApproved(address,address)'](sourceAccount);
        if (!event) return
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
            const migrationData = await fetch(`/.netlify/functions/l2migration?account=${account}`)
                .then((response) => response.json())
            setNeedsMigration(migrationData.needsManualMigration)
            setDeposits(migrationData.deposits)
            setFerts(migrationData.fertilizer)
            setPlots(migrationData.plots)
            setFarmBal(migrationData.farmBalance)
        };
        getMigrationData();
    }, [account]);

    useEffect(() => {
        const interval = setInterval(() => {
            getEvent()
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    function onSubmit() {

        if (!account) return

        const txToast = new TransactionToast({
            loading: 'Receiving Balances from Mainnet...',
            success: 'Balances Received!',
        });

        const farmCallData = [];

        if (Object.keys(deposits).length > 0) {
            const issueDeposits = sdk.contracts.beanstalk.interface.encodeFunctionData("issueDeposits", [
                account,
                deposits.depositIds,
                deposits.amounts,
                deposits.bdvs,
                deposits.proofs
            ])
            farmCallData.push(issueDeposits)
        };

        if (Object.keys(ferts).length > 0) {
            const issueFert = sdk.contracts.beanstalk.interface.encodeFunctionData("issueFertilizer", [
                account,
                ferts.fertIds,
                ferts.amounts,
                ferts.lastBpf,
                ferts.proofs
            ])
            farmCallData.push(issueFert)
        }

        if (Object.keys(plots).length > 0) {
            const issuePlots = sdk.contracts.beanstalk.interface.encodeFunctionData("issuePlots", [
                account,
                plots.index,
                plots.pods,
                plots.proofs
            ])
            farmCallData.push(issuePlots)
        }

        if (Object.keys(farmBal).length > 0) {
            const issueFarmBalance = sdk.contracts.beanstalk.interface.encodeFunctionData("issueInternalBalances", [
                account,
                farmBal.tokens,
                farmBal.amounts,
                farmBal.proofs
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
                    <Box sx={{ padding: 1, border: 1, borderColor: '#46B955', backgroundColor: '#EDF8EE', borderRadius: 1, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                        <CheckIcon sx={{ width: 20, height: 20 }} />
                        <Typography>Silo Deposits</Typography>
                    </Box>
                    <Box sx={{ padding: 1, border: 1, borderColor: '#46B955', backgroundColor: '#EDF8EE', borderRadius: 1, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                        <CheckIcon sx={{ width: 20, height: 20 }} />
                        <Typography>Pods</Typography>
                    </Box>
                    <Box sx={{ padding: 1, border: 1, borderColor: '#46B955', backgroundColor: '#EDF8EE', borderRadius: 1, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                        <CheckIcon sx={{ width: 20, height: 20 }} />
                        <Typography>Farm Balance</Typography>
                    </Box>
                    <Box sx={{ padding: 1, border: 1, borderColor: '#46B955', backgroundColor: '#EDF8EE', borderRadius: 1, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                        <CheckIcon sx={{ width: 20, height: 20 }} />
                        <Typography>Fertilizer</Typography>
                    </Box>
                    <Button
                        disabled={false}
                        sx={{
                            width: "100%",
                            height: 60,
                        }}
                        onClick={() => onSubmit()}
                    >
                        {'Receive Assets'}
                    </Button>
                </Box>
            </Card>
        </Box>
    )
};
