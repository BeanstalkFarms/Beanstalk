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
import useChainId from '~/hooks/chain/useChainId';
import { useContractReads, useReadContracts, useSwitchChain } from 'wagmi';

export default function L1Delegate() {

    const account = useAccount();
    const sdk = useSdk();
    const { data: signer } = useSigner();
    const beanstalk = useBeanstalkContract(signer);

    const chainId = useChainId();
    const { chains, error, isPending, switchChain } = useSwitchChain();

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

    const beanstalkL1MiniAbi = new ethers.utils.Interface([
        "function getExternalBalance(address account, address token) public view returns (uint256 balance)",
        "function tokenAllowance(address account, address spender, address token) public view returns (uint256)"
    ])

    const beanL1MiniAbi = new ethers.utils.Interface([
        "function allowance(address owner, address spender) returns (uint256)"
    ])

    const l1ReadResults = useReadContracts({
        contracts: [
            {
                address: beanstalkL1Address as `0x${string}`,
                abi: JSON.parse(beanstalkL1MiniAbi.format(ethers.utils.FormatTypes.json) as string),
                functionName: "getExternalBalance",
                // @ts-ignore
                args: [account, beanL1Address]
            },
            {
                address: beanL1Address as `0x${string}`,
                abi: JSON.parse(beanL1MiniAbi.format(ethers.utils.FormatTypes.json) as string),
                functionName: "allowance",
                // @ts-ignore
                args: [account, beanstalkL1Address]
            },
        ],
        query: {
            enabled: Boolean(account),
            refetchInterval: 10000
        }
    }).data;

    useEffect(() => {
        if (!l1ReadResults) {
            setBeanBalance(BigNumber.from(0));
            setBeanAllowance(BigNumber.from(0));
        } else {
            if (l1ReadResults[0].result) {
                setBeanBalance(BigNumber.from((l1ReadResults[0].result as bigint)))
            } else {
                setBeanBalance(BigNumber.from(0));
            }
            if (l1ReadResults[1].result) {
                setBeanAllowance(BigNumber.from((l1ReadResults[1].result as bigint)))
            } else {
                setBeanAllowance(BigNumber.from(0));
            }
        };
    }, [l1ReadResults])

    useEffect(() => {
        getReceipt();
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
                setBeanAllowance(beanBalance);
            } else if (beanBalance.gt(0)) {
                const beanstalkL1 = new ethers.Contract(beanstalkL1Address, ['function migrateL2Beans(address receiver, address L2Beanstalk, uint256 amount, uint8 toMode, uint256 maxSubmissionCost, uint256 maxGas, uint256 gasPriceBid) external payable returns (uint256 ticketID)'], signer);
                const txn = await beanstalkL1.migrateL2Beans(
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
                            <>
                                <Typography padding={1} fontSize={20} fontWeight={500}>
                                    {destinationAccount}
                                </Typography>
                                {(beanBalance.gt(0) && beanComplete) &&
                                    <Typography padding={1}>
                                        The specified account will automatically be credited with Circulating Beans once Migration data clears the Arbitrum bridge.
                                    </Typography>
                                }
                                {(migrateInternal && internalComplete) &&
                                    <Typography padding={1}>
                                        Smart Contracts must claim their Beanstalk assets on Arbitrum in order to complete the Migration process. Click the button below to continue.
                                    </Typography>
                                }
                            </>
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
                            {chainId !== 1 ?
                                <Button
                                    sx={{
                                        width: '100%',
                                        height: 60,
                                        backgroundColor: '#7487CF',
                                        '&:hover': {
                                            backgroundColor: '#556BC4'
                                        }
                                    }}
                                    onClick={() => switchChain({ chainId: 1 })}
                                >
                                    Switch to Ethereum
                                </Button>
                                : !readyForNext ?
                                    <Box sx={{ display: 'inline-flex', gap: 1, width: '100%' }}>
                                        {beanBalance.gt(0) &&
                                            <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', justifyContent: 'flex-end' }}>
                                                <Typography sx={{ padding: 1, color: 'GrayText' }}>
                                                    Beans held in your wallet will be
                                                    migrated and automatically sent to the specified address on Arbitrum.
                                                </Typography>
                                                <Button
                                                    disabled={!isAddressValid || (!isAddressValid && beanBalance.eq(0)) || !destinationAccount || beanComplete}
                                                    sx={{
                                                        width: '100%',
                                                        height: 60,
                                                    }}
                                                    onClick={() => onSubmitBeanMigration()}
                                                >{beanComplete ? "Migration Complete!" : beanBalance.gt(beanAllowance) ? 'Approve Beans for Migration' : 'Migrate Circulating Beans'}
                                                </Button>
                                            </Box>
                                        }
                                        {(isContract && migrateInternal) &&
                                            <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', justifyContent: 'flex-end' }}>
                                                <Typography sx={{ padding: 1, color: 'GrayText' }}>
                                                    Beanstalk balances associated with this contract address will be
                                                    migrated and available to receive on Arbitrum at the address
                                                    specified.
                                                </Typography>
                                                <Button
                                                    disabled={!isAddressValid || (!isAddressValid && !migrateInternal) || !destinationAccount || internalComplete}
                                                    sx={{
                                                        width: '100%',
                                                        height: 60,
                                                    }}
                                                    onClick={() => onSubmitFarmMigration()}
                                                >
                                                    {internalComplete ? "Migration Complete!" : "Migrate Beanstalk Balances"}
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
