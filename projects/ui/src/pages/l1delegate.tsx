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
import { useClient, useReadContracts, useSwitchChain, useWatchContractEvent } from 'wagmi';
import { parseAbiItem } from 'viem';
import { arbitrum } from 'viem/chains';
import { getLogs } from 'viem/actions';
import useBanner from '~/hooks/app/useBanner';
import useNavHeight from '~/hooks/app/usePageDimensions';
import useChainState from '~/hooks/chain/useChainState';

export default function L1Delegate() {

    const account = useAccount();
    const sdk = useSdk();
    const { data: signer } = useSigner();
    const beanstalk = useBeanstalkContract(signer);

    const chainId = useChainId();
    const { isArbitrum, isTestnet } = useChainState();
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
    const [hasMigrationData, setHasMigrationData] = useState(false);
    const [migratedDeposits, setMigratedDeposits] = useState(false);
    const [migratedPlots, setMigratedPlots] = useState(false);
    const [migratedBalances, setMigratedBalances] = useState(false);
    const [migratedFertilizer, setMigratedFertilizer] = useState(false);

    const migrateInternal = hasMigrationData && !(migratedDeposits || migratedPlots || migratedBalances || migratedFertilizer)

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
    ]);

    const arbitrumClient = useClient({ chainId: arbitrum.id });

    useEffect(() => {
        async function getReceiverApproved() {
            if (!arbitrumClient || !account) return
            const logs = await getLogs(arbitrumClient, {
                address: beanstalkL2Address as `0x${string}`,
                event: parseAbiItem("event ReceiverApproved(address indexed owner, address receiver)"),
                fromBlock: 4365627n,
                toBlock: 'latest',
                args: {
                    owner: (account || '') as `0x${string}`
                },
                strict: true,
            });
            return logs;
        };
        async function getL1Deposits() {
            if (!arbitrumClient || !account) return
            const logs = await getLogs(arbitrumClient, {
                address: beanstalkL2Address as `0x${string}`,
                event: parseAbiItem("event L1DepositsMigrated(address indexed owner, address indexed receiver, uint256[] depositIds, uint256[] amounts, uint256[] bdvs)"),
                fromBlock: 4365627n,
                toBlock: 'latest',
                args: {
                    owner: (account || '') as `0x${string}`
                },
                strict: true,
            });
            return logs;
        };
        async function getL1Plots() {
            if (!arbitrumClient || !account) return
            const logs = await getLogs(arbitrumClient, {
                address: beanstalkL2Address as `0x${string}`,
                event: parseAbiItem("event L1PlotsMigrated(address indexed owner, address indexed receiver, uint256[] index, uint256[] pods)"),
                fromBlock: 4365627n,
                toBlock: 'latest',
                args: {
                    owner: (account || '') as `0x${string}`
                },
                strict: true,
            });
            return logs;
        };
        async function getL1InternalBalances() {
            if (!arbitrumClient || !account) return
            const logs = await getLogs(arbitrumClient, {
                address: beanstalkL2Address as `0x${string}`,
                event: parseAbiItem("event L1InternalBalancesMigrated(address indexed owner, address indexed receiver, address[] tokens, uint256[] amounts)"),
                fromBlock: 4365627n,
                toBlock: 'latest',
                args: {
                    owner: (account || '') as `0x${string}`
                },
                strict: true,
            });
            return logs;
        };
        async function getL1Fertilizer() {
            if (!arbitrumClient || !account) return
            const logs = await getLogs(arbitrumClient, {
                address: beanstalkL2Address as `0x${string}`,
                event: parseAbiItem("event L1FertilizerMigrated(address indexed owner, address indexed receiver, uint256[] fertIds, uint128[] amounts, uint128 lastBpf)"),
                fromBlock: 4365627n,
                toBlock: 'latest',
                args: {
                    owner: (account || '') as `0x${string}`
                },
                strict: true,
            });
            return logs;
        };

        getReceiverApproved().then((event) => { if (event && event[0]?.args) { checkAddress(event[0].args.receiver); setInternalComplete(true) } })
        getL1Deposits().then((event) => { setMigratedDeposits(event && event[0] ? true : false) });
        getL1Plots().then((event) => { setMigratedPlots(event && event[0] ? true : false) });
        getL1InternalBalances().then((event) => { setMigratedBalances(event && event[0] ? true : false) });
        getL1Fertilizer().then((event) => { setMigratedFertilizer(event && event[0] ? true : false) });


        const localData = localStorage.getItem('internalL2MigrationData');
        const parsed = localData ? JSON.parse(localData) : undefined;
        if (parsed && parsed.source.toLowerCase() === account?.toLowerCase() && !isArbitrum) {
            checkAddress(parsed.destination);
            setInternalComplete(true);
        }

    }, [arbitrumClient, account, chainId]);

    const l1ReadResults = useReadContracts({
        contracts: [
            {
                address: beanstalkL1Address as `0x${string}`,
                abi: JSON.parse(beanstalkL1MiniAbi.format(ethers.utils.FormatTypes.json) as string),
                functionName: "getExternalBalance",
                args: [(account || ''), beanL1Address]
            },
            {
                address: beanL1Address as `0x${string}`,
                abi: JSON.parse(beanL1MiniAbi.format(ethers.utils.FormatTypes.json) as string),
                functionName: "allowance",
                args: [(account || ''), beanstalkL1Address]
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
        getMigrationData();
    }, [account, sdk]);

    useEffect(() => {
        if ((beanComplete && internalComplete) || (beanComplete && !migrateInternal) || (beanBalance.eq(0) && internalComplete)) {
            setReadyForNext(true);
            setEnableMigration(true);
        } else if (beanBalance.eq(0) && !migrateInternal) {
            setEnableMigration(false);
            setReadyForNext(false);
        } else {
            setReadyForNext(false);
            setEnableMigration(true);
        }
    }, [internalComplete, beanComplete, migrateInternal, beanBalance])

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
            setHasMigrationData(migrationData.needsManualMigration);
        } catch (error) {
            console.error('Error fetching migration data:', error);
        }

    };

    const saveInternalMigrationData = () => {
        const internalMigration = {
            destination: destinationAccount,
            source: account,
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
            loading: 'Delegating Beanstalk Assets...',
            success: 'Delegation Confirmed!',
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
            setInternalComplete(true);
            saveInternalMigrationData();
        } catch (err) {
            console.error('Transaction failed:', err);
            txToast.error(err);
        }
    }, [beanstalk, isContract, destinationAccount]);

    const banner = useBanner();
    const navHeight = useNavHeight(!!banner);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: `calc(100vh - ${navHeight}px)` }}>
            {enableMigration ?
                <Box sx={{ paddingX: 2 }}>
                    <>
                        <PageHeader
                            title="Delegate Balances for L2 Migration"
                            description="Specify which address your want your Beanstalk assets migrated to on Arbitrum One"
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
                                    Arbitrum One
                                </Typography>
                                <Typography>{ }</Typography>
                            </Box>
                            {readyForNext ? (
                                <>
                                    <Typography padding={1} fontSize={20} fontWeight={500}>
                                        {destinationAccount}
                                    </Typography>
                                    {(beanComplete) &&
                                        <Typography padding={1}>
                                            The specified account will automatically be credited with Circulating Beans once Migration data clears the Arbitrum One bridge.
                                        </Typography>
                                    }
                                    {(migrateInternal && internalComplete) &&
                                        <Typography padding={1}>
                                            Smart Contracts must claim their Beanstalk assets on Arbitrum One in order to complete the Migration process. Click the button below to continue.
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
                                        value={destinationAccount ? destinationAccount : ''}
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
                                {(isArbitrum && !isTestnet) ?
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
                                                        migrated and automatically sent to the specified address on Arbitrum One.
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
                                                        migrated and available to receive on Arbitrum One at the address
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
                                                        {internalComplete ? "Delegation Complete!" : "Delegate Beanstalk Balances"}
                                                    </Button>
                                                </Box>
                                            }
                                        </Box>
                                        :
                                        <Button
                                            sx={{
                                                width: '100%',
                                                height: 60,
                                            }}
                                            onClick={() => navigate('/l2claim')}
                                        >
                                            Go To L2 Claim Page
                                        </Button>
                                }
                            </Box>
                        </Card>
                    </>
                </Box>
                :
                <MigrationMessage />}
        </Box>
    );
}
