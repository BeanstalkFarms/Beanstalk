import React, { useEffect, useState } from 'react';
import { Box, Button, Card, InputAdornment, TextField, Typography } from '@mui/material';
import PageHeader from '~/components/Common/PageHeader';
import { FontWeight } from '~/components/App/muiTheme';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { ethers } from 'ethers';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import { useSigner } from '~/hooks/ledger/useSigner';
import TransactionToast from '~/components/Common/TxnToast';
import useSdk from '~/hooks/sdk';
import useAccount from '~/hooks/ledger/useAccount';
import TokenIcon from '~/components/Common/TokenIcon';
import { useSwitchChain } from 'wagmi';
import { useNavigate } from 'react-router-dom';


export default function L1Delegate() {

    const [destinationAccount, setDestinationAccount] = useState<string | undefined>(undefined);
    const [isAddressValid, setIsAddressValid] = useState<boolean | undefined>(undefined);
    const [hasReceipt, setHasReceipt] = useState(false);

    const { data: signer } = useSigner();
    const account = useAccount();
    const beanstalk = useBeanstalkContract(signer);
    const sdk = useSdk();
    const beanstalkL2Address = sdk.addresses.BEANSTALK.ARBITRUM_MAINNET;

    const navigate = useNavigate();

    function getReceipt() {
        const ticket = localStorage.getItem("retryableTicket")
        if (ticket) {
            setHasReceipt(true);
            setDestinationAccount(JSON.parse(ticket).l2Address);
        } else {
            setHasReceipt(false);
        };
    };

    function checkAddress(address: string) {
        if (address) {
            const isValid = ethers.utils.isAddress(address);
            setDestinationAccount(address);
            if (isValid) {
                setIsAddressValid(true);
            } else {
                setIsAddressValid(false);
            }
        } else {
            setIsAddressValid(undefined);
        }
    }

    function onSubmit() {
        if (!destinationAccount) return;
        const txToast = new TransactionToast({
            loading: 'Approving L2 Receiver...',
            success: 'L2 Receiver approved!',
        });
        beanstalk.approveL2Receiver(
            destinationAccount,
            beanstalkL2Address,
            2e14,
            200000,
            10e9
            , { value: ethers.utils.parseEther("0.005") })
            .then((txn) => {
                txToast.confirming(txn);
                return txn.wait();
            })
            .then((receipt) => {
                txToast.success(receipt);
                localStorage.setItem("retryableTicket", JSON.stringify({ l1Address: account, l2Address: destinationAccount, receipt: receipt.events, migrationComplete: false }));
                getReceipt();
                // formActions.resetForm();
            })
            .catch((err) => {
                console.error(txToast.error(err.error || err));
            });
    }

    return (
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
                    <Box padding={1} sx={{ alignItems: 'center', display: 'inline-flex', gap: 0.5 }}>
                        <Typography>
                            {hasReceipt
                                ? "You've delegated your Beanstalk assets to the following address on"
                                : "Delegate address on"
                            }
                        </Typography>
                        <TokenIcon token={sdk.tokens.ARB} css={{ width: '24px', height: '24px' }} />
                        <Typography variant="h4" fontWeight={600} sx={{ alignSelf: 'center' }}>Arbitrum</Typography>
                    </Box>
                    {hasReceipt ?
                        <Typography padding={1} fontSize={20} fontWeight={500}>{destinationAccount}</Typography>
                        :
                        <>
                            <TextField
                                sx={{ width: '100%' }}
                                placeholder="0x0000"
                                size='medium'
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
                                    )
                                }}
                                onChange={(e) => {
                                    checkAddress(e.target.value);
                                }}
                            />
                            <Typography sx={{ flex: 1, textAlign: 'end', color: 'GrayText', marginTop: 1 }}>
                                Enter an address
                            </Typography>
                        </>
                    }
                    <Typography sx={{ padding: 1, color: 'GrayText' }}>
                        All Beanstalk balances associated with this contract address including Deposits, Pods, Farm Balance
                        and Fertilizer will be migrated and available to receive on Arbitrum at the address specified.
                    </Typography>
                    <Button
                        disabled={!isAddressValid}
                        sx={{
                            width: "100%",
                            height: 60,
                        }}
                        onClick={() => hasReceipt ? navigate('/l2claim') : onSubmit()}
                    >
                        {hasReceipt ? 'Next Step' :
                            !isAddressValid ? 'Input Address' : 'Begin L2 Migration'}
                    </Button>
                </Card>
            </>
        </Box>
    )
};
