import React, { useCallback, useEffect, useState } from 'react';
import {
    Box,
    Button,
    Card,
    InputAdornment,
    TextField,
    Typography,
} from '@mui/material';
import PageHeader from '~/components/Common/PageHeader';
import { FontWeight } from '~/components/App/muiTheme';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { BigNumber, ethers } from 'ethers';
import TransactionToast from '~/components/Common/TxnToast';
import useSdk from '~/hooks/sdk';
import useAccount from '~/hooks/ledger/useAccount';
import TokenIcon from '~/components/Common/TokenIcon';
import { useNavigate } from 'react-router-dom';
import { FarmToMode } from '@beanstalk/sdk';
import useIsSmartContract from '~/hooks/chain/useIsSmartContract';
import { useSigner } from '~/hooks/ledger/useSigner';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import MigrationMessage from '../components/Common/MigrationMessage';

export default function L1Delegate() {

    const account = useAccount();
    const sdk = useSdk();
    const { data: signer } = useSigner();
    const beanstalk = useBeanstalkContract(signer);

    const [destinationAccount, setDestinationAccount] = useState<
        string | undefined
    >(undefined);
    const [isAddressValid, setIsAddressValid] = useState<boolean | undefined>(
        undefined
    );
    const [hasReceipt, setHasReceipt] = useState(false);
    const [beanBalance, setBeanBalance] = useState<BigNumber>(BigNumber.from(0));
    const [beanAllowance, setBeanAllowance] = useState<BigNumber>(BigNumber.from(0));
    const [migrateInternal, setMigrateInternal] = useState(false);
    const [enableMigration, setEnableMigration] = useState(false);

    const [internalComplete, setInternalComplete] = useState(false);
    const [beanComplete, setBeanComplete] = useState(false);

    const [readyForNext, setReadyForNext] = useState(false);

    const beanstalkL1Address = sdk.addresses.BEANSTALK.ETH_MAINNET;
    const beanstalkL2Address = sdk.addresses.BEANSTALK.ARBITRUM_MAINNET;
    const beanL1Address = sdk.addresses.BEAN.ETH_MAINNET;

    const isContract = useIsSmartContract();
    const navigate = useNavigate();

    useEffect(() => {
        getReceipt();
        getBeanData();
        getMigrationData();
    }, [account, sdk]);

    useEffect(() => {
        if ((beanComplete && internalComplete) || (beanComplete && !migrateInternal) || (beanBalance.eq(0) && internalComplete)) {
            setReadyForNext(true);
        } else if (beanBalance.eq(0) && !migrateInternal) {
            setEnableMigration(false);
            setReadyForNext(false);
        } else {
            setReadyForNext(false);
            setEnableMigration(true);
        }
    }, [internalComplete, beanComplete, migrateInternal, beanBalance])

    const getReceipt = () => {
        const ticket = localStorage.getItem('retryableTicketBean');
        if (ticket) {
            setHasReceipt(true);
            setDestinationAccount(JSON.parse(ticket).l2Address);
        } else {
            setHasReceipt(false);
        }
    };

    const checkAddress = (address: string) => {
        const isValid = ethers.utils.isAddress(address);
        setDestinationAccount(address);
        setIsAddressValid(isValid);
    };

    const getBeanData = async () => {
        if (!account || !sdk) return;

        try {
            const balance = await sdk.contracts.beanstalk.getExternalBalance(
                account,
                beanL1Address
            );
            setBeanBalance(BigNumber.from(balance || 0));

            const allowance = await sdk.contracts.beanstalk.tokenAllowance(
                account,
                beanstalkL1Address,
                beanL1Address
            );
            setBeanAllowance(BigNumber.from(allowance || 0));
        } catch (error) {
            console.error('Error fetching bean data:', error);
        }
    };

    const getMigrationData = async () => {
        if (!account) return;
        try {
            const response = await fetch(`/.netlify/functions/l2migration?account=${account}`);
            const migrationData = await response.json();
            setMigrateInternal(migrationData.needsManualMigration);
        } catch (error) {
            console.error('Error fetching migration data:', error);
        }
    };

    const saveInternalMigrationData = () => {
        const internalMigration = {
            destination: destinationAccount,
            source: account,
            complete: false,
        }
        localStorage.setItem('internalL2MigrationData', JSON.stringify(internalMigration))
    };

    const saveBeanBalanceMigrationData = () => {
        const beanMigration = {
            destination: destinationAccount,
            source: account,
            amount: beanBalance.toString(),
            complete: false,
        }
        localStorage.setItem('beanBalanceL2MigrationData', JSON.stringify(beanMigration))
    };

    const onSubmitBeanMigration = useCallback(async () => {
        if (!destinationAccount) return;
        const approvalNeeded = beanBalance.gt(beanAllowance);

        const txToast = new TransactionToast({
            loading: approvalNeeded ? 'Approving L1 Bean Balance for Migration...' : 'Approving L2 Migration...',
            success: approvalNeeded ? 'Ready to Migrate L1 Bean Balance!' : 'Migration Approved!',
        });

        try {
            if (approvalNeeded) {
                const beanL1 = new ethers.Contract(beanL1Address, ['function approve(address spender, uint256 value) returns(bool)'], signer);
                const txn = await beanL1.functions.approve(beanstalkL1Address, beanBalance);
                txToast.confirming(txn);
                await txn.wait();
                txToast.success();
                await getBeanData();
            } else if (beanBalance.gt(0)) {
                const txn = await beanstalk.migrateL2Beans(
                    destinationAccount,
                    beanstalkL2Address,
                    beanBalance,
                    FarmToMode.EXTERNAL,
                    2e14,
                    200000,
                    10e9,
                    { value: ethers.utils.parseEther('0.005') }
                );
                txToast.confirming(txn);
                await txn.wait();
                txToast.success();
                saveBeanBalanceMigrationData();
                setBeanComplete(true);
            }
        } catch (err) {
            console.error('Transaction failed:', err);
            txToast.error(err);
        }
    }, [beanstalk, signer, beanBalance, beanAllowance, destinationAccount]);

    const onSubmitFarmMigration = useCallback(async () => {
        if (!destinationAccount || !isContract) return;

        const txToast = new TransactionToast({
            loading: 'Approving L2 Migration...',
            success: 'Migration Approved!',
        });

        try {
            const txn = await beanstalk.approveL2Receiver(
                destinationAccount,
                beanstalkL2Address,
                2e14,
                200000,
                10e9,
                { value: ethers.utils.parseEther('0.005') }
            );
            txToast.confirming(txn);
            await txn.wait();
            txToast.success();
            saveInternalMigrationData();
            setInternalComplete(true);
        } catch (err) {
            console.error('Transaction failed:', err);
            txToast.error(err);
        }
    }, [beanstalk, isContract, destinationAccount]);

    return (
        enableMigration ?
            <Box sx={{ paddingX: 2 }}>
                <>
                    <PageHeader
                        title="Delegate Contract Balance for L2 Migration"
                        description="Specify which address your want your Beanstalk assets migrated to on Arbitrum"
                    />
                    <Card sx={{ padding: 1, maxWidth: 700, minWidth: 300, marginTop: 2 }}>
                        <Typography variant="h4" fontWeight={FontWeight.bold} padding={1}>
                            Delegate Balances
                        </Typography>
                        <Box
                            padding={1}
                            sx={{ alignItems: 'center', display: 'inline-flex', gap: 0.5 }}
                        >
                            <Typography>
                                {readyForNext
                                    ? "You've delegated your Beanstalk assets to the following address on"
                                    : 'Delegate address on'}
                            </Typography>
                            <TokenIcon
                                token={sdk.tokens.ARB}
                                css={{ width: '24px', height: '24px' }}
                            />
                            <Typography
                                variant="h4"
                                fontWeight={600}
                                sx={{ alignSelf: 'center' }}
                            >
                                Arbitrum
                            </Typography>
                            <Typography>{ }</Typography>
                        </Box>
                        {readyForNext ? (
                            <Typography padding={1} fontSize={20} fontWeight={500}>
                                {destinationAccount}
                            </Typography>
                        ) : (
                            <>
                                <TextField
                                    sx={{ width: '100%' }}
                                    placeholder="0x0000"
                                    size="medium"
                                    color="primary"
                                    InputProps={{
                                        startAdornment: !isAddressValid ? (
                                            <InputAdornment position="start" sx={{ ml: 0, mr: 1 }}>
                                                <CloseIcon color="warning" sx={{ scale: '100%' }} />
                                            </InputAdornment>
                                        ) : (
                                            <InputAdornment position="start" sx={{ ml: 0, mr: 1 }}>
                                                <CheckIcon
                                                    sx={{ height: 24, width: 24, fontSize: '100%' }}
                                                    color="primary"
                                                />
                                            </InputAdornment>
                                        ),
                                    }}
                                    onChange={(e) => {
                                        checkAddress(e.target.value);
                                    }}
                                />
                                <Typography
                                    sx={{
                                        flex: 1,
                                        textAlign: 'end',
                                        color: 'GrayText',
                                        marginTop: 1,
                                    }}
                                >
                                    Enter an address
                                </Typography>
                            </>
                        )}
                        <Box sx={{ display: 'inline-flex', gap: 1, width: '100%' }}>
                            {!readyForNext ?
                                <Box sx={{ display: 'inline-flex', gap: 1, width: '100%' }}>
                                    {beanBalance.gt(0) &&
                                        <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', justifyContent: 'flex-end' }}>
                                            <Typography sx={{ padding: 1, color: 'GrayText' }}>
                                                Beans held in your wallet will be
                                                migrated and available to receive on Arbitrum at the address
                                                specified.
                                            </Typography>
                                            <Button
                                                disabled={!isAddressValid && beanBalance.eq(0)}
                                                sx={{
                                                    width: '100%',
                                                    height: 60,
                                                }}
                                                onClick={() => onSubmitBeanMigration()}
                                            >{beanBalance.gt(beanAllowance) ? 'Approve Beans for Migration' : 'Migrate Circulating Beans'}
                                            </Button>
                                        </Box>
                                    }
                                    {(isContract && migrateInternal) &&
                                        <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', justifyContent: 'flex-end' }}>
                                            <Typography sx={{ padding: 1, color: 'GrayText' }}>
                                                All Beanstalk balances associated with this contract address
                                                including Deposits, Pods, Farm Balance and Fertilizer will be
                                                migrated and available to receive on Arbitrum at the address
                                                specified.
                                            </Typography>
                                            <Button
                                                disabled={!isAddressValid && !migrateInternal}
                                                sx={{
                                                    width: '100%',
                                                    height: 60,
                                                }}
                                                onClick={() => onSubmitFarmMigration()}
                                            >
                                                Migrate Beanstalk Balances
                                            </Button>
                                        </Box>
                                    }
                                </Box>
                                :
                                migrateInternal &&
                                <Button
                                    sx={{
                                        width: '100%',
                                        height: 60,
                                    }}
                                    onClick={() => navigate('/l2claim')}
                                >
                                    Next Step
                                </Button>
                            }
                        </Box>
                    </Card>
                </>
            </Box>
            :
            <MigrationMessage />
    );
}
