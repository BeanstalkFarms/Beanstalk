import { Accordion, AccordionDetails, Box, Stack } from '@mui/material';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { useConnect } from 'wagmi';
import { Alert } from '@mui/lab';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { FarmFromMode, FarmToMode } from '@beanstalk/sdk';
import { IconSize } from '~/components/App/muiTheme';
import IconWrapper from '~/components/Common/IconWrapper';
import {
    FormTokenState,
    SmartSubmitButton,
    TokenAdornment,
    TokenSelectDialog,
    TxnPreview,
} from '~/components/Common/Form';
import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import TokenInputField from '~/components/Common/Form/TokenInputField';
import FarmModeField from '~/components/Common/Form/FarmModeField';
import { ERC20Token, NativeToken } from '~/classes/Token';
import { Beanstalk } from '~/generated/index';
import { ZERO_BN } from '~/constants';
import {
    BEAN,
    BEAN_ETH_WELL_LP,
    DAI,
    USDC,
    USDT,
    WETH,
    ETH,
    BEAN_WSTETH_WELL_LP,
    WSTETH,
} from '~/constants/tokens';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import useFarmerBalances from '~/hooks/farmer/useFarmerBalances';
import useTokenMap from '~/hooks/chain/useTokenMap';
import { useSigner } from '~/hooks/ledger/useSigner';
import useGetChainToken from '~/hooks/chain/useGetChainToken';
import useAccount from '~/hooks/ledger/useAccount';
import { toStringBaseUnitBN } from '~/util';
import TransactionToast from '~/components/Common/TxnToast';
import { useFetchFarmerBalances } from '~/state/farmer/balances/updater';
import StyledAccordionSummary from '~/components/Common/Accordion/AccordionSummary';
import { ActionType } from '~/util/Actions';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import { BalanceFrom } from '~/components/Common/Form/BalanceFromRow';
import AddressInputField from '~/components/Common/Form/AddressInputField';
import copy from '~/constants/copy';
import useGetBalancesUsedBySource from '~/hooks/beanstalk/useBalancesUsedBySource';
import { TokenInstance } from '~/hooks/beanstalk/useTokens';
import useSdk from '~/hooks/sdk';

/// ---------------------------------------------------------------

type TransferFormValues = {
    tokensIn: FormTokenState[]; // token, amount
    balanceFrom: BalanceFrom;
    fromMode:
    | FarmFromMode.INTERNAL
    toMode: FarmToMode.EXTERNAL;
    destination: string;
    approving: boolean;
};

const Warning: FC<{ color?: 'warning' | 'error' }> = ({
    children,
    color = 'warning',
}) => (
    <Alert
        color={color}
        icon={
            <IconWrapper boxSize={IconSize.medium}>
                <WarningAmberIcon sx={{ fontSize: IconSize.small }} />
            </IconWrapper>
        }
    >
        {children}
    </Alert>
);

// ---------------------------------------------------

const SUPPORTED_TOKENS = [
    WETH,
    WSTETH,
    DAI,
    USDC,
    USDT,
];

const L1Withdraw: FC<{}> = () => {
    /// Ledger
    const account = useAccount();
    const { data: signer } = useSigner();
    const beanstalk = useBeanstalkContract(signer);

    const sdk = useSdk();

    /// Tokens
    const getChainToken = useGetChainToken();
    const Bean = getChainToken(BEAN);

    /// Token List
    const tokenMap = useTokenMap<ERC20Token | NativeToken>(SUPPORTED_TOKENS);
    const tokenList = useMemo(() => Object.values(tokenMap), [tokenMap]).filter((token) => { return token instanceof ERC20Token });
    /// Farmer
    const [farmerBalances, setFarmerBalances] = useState<any>();
    const getFarmerBalances = useCallback(async () => {
        if (!account) return
        try {
            const balances = await sdk.contracts.beanstalk.getAllBalances(account, tokenList.map((token) => token.address))
            setFarmerBalances(balances);
        } catch {
            console.log("catch!")
        }
    }, [account, tokenList]);

    useEffect(() => {
        const interval = setInterval(getFarmerBalances, 30000);
        return () => clearInterval(interval);
    }, []);

    /// Form
    const middleware = useFormMiddleware();
    const initialValues: TransferFormValues = useMemo(
        () => ({
            tokensIn: [
                {
                    token: Bean,
                    amount: undefined,
                },
            ],
            balanceFrom: BalanceFrom.INTERNAL,
            fromMode: FarmFromMode.INTERNAL,
            toMode: FarmToMode.EXTERNAL,
            destination: '',
            approving: false,
        }),
        [Bean]
    );

    const onSubmit = useCallback(
        async (
            values: TransferFormValues,
            formActions: FormikHelpers<TransferFormValues>
        ) => {
            let txToast;
            try {
                middleware.before();

                const tokenIn = values.tokensIn[0];
                const tokenAmount = tokenIn.amount;
                const tokenDecimals = tokenIn.token.decimals;

                const tokenAddress = tokenIn.token.address;
                const recipient = values.destination;

                const fromMode = values.fromMode;
                const toMode = values.toMode;

                const amount = ethers.BigNumber.from(
                    toStringBaseUnitBN(tokenAmount!, tokenDecimals)
                );
                const approving = values.approving;

                if (!tokenAmount) throw new Error('No input amount set.');
                if (!account) throw new Error('Connect a wallet first.');
                if (!recipient) throw new Error('Enter an address to transfer to.');
                if (!signer) throw new Error('Signer not found.');
                if (approving) return;

                txToast = new TransactionToast({
                    loading: 'Transferring...',
                    success: 'Transfer successful..',
                });

                let txn;
                if (tokenAddress === 'eth') {
                    txn = await signer.sendTransaction({
                        to: recipient,
                        value: amount,
                    });
                } else {
                    txn = await beanstalk.transferToken(
                        tokenAddress,
                        recipient,
                        amount,
                        fromMode,
                        toMode
                    );
                }
                txToast.confirming(txn);

                const receipt = await txn.wait();
                txToast.success(receipt);
                // formActions.resetForm();
                formActions.setFieldValue('tokensIn.0', {
                    token: tokenIn.token,
                    amount: undefined,
                });
            } catch (err) {
                if (txToast) {
                    txToast.error(err);
                } else {
                    const errorToast = new TransactionToast({ success: '', loading: '' }); // change later
                    errorToast.error(err);
                }
                formActions.setSubmitting(false);
            }
        },
        [account, beanstalk, middleware, signer]
    );

    return (
        farmerBalances &&
        <Formik<TransferFormValues>
            enableReinitialize
            initialValues={initialValues}
            onSubmit={onSubmit}
        >
            {(formikProps: FormikProps<TransferFormValues>) => (
                <>

                </>
            )}
        </Formik>
    );
};

export default L1Withdraw;
