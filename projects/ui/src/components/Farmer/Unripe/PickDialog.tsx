import React, { useState, useEffect, useCallback } from 'react';
import {
  DialogProps,
  Stack,
  Dialog,
  Typography,
  useMediaQuery,
  Divider,
  Box,
  Link,
  CircularProgress
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { LoadingButton } from '@mui/lab';
import toast from 'react-hot-toast';
import unripeBeanIcon from '~/img/tokens/unripe-bean-logo-circled.svg';
import brownLPIcon from '~/img/tokens/unripe-lp-logo-circled.svg';
import { BeanstalkPalette } from '~/components/App/muiTheme';
import { StyledDialogActions, StyledDialogContent, StyledDialogTitle } from '~/components/Common/Dialog';
import pickImage from '~/img/beanstalk/unripe/pick.png';
import DescriptionButton from '~/components/Common/DescriptionButton';
import type { PickMerkleResponse } from '~/functions/pick/pick';
import TransactionToast from '~/components/Common/TxnToast';
import Token from '~/classes/Token';
import { useSigner } from '~/hooks/ledger/useSigner';
import { BEAN, BEAN_CRV3_LP, BEAN_ETH_UNIV2_LP, BEAN_LUSD_LP, UNRIPE_BEAN, UNRIPE_BEAN_CRV3 } from '~/constants/tokens';
import { UNRIPE_ASSET_TOOLTIPS } from '~/constants/tooltips';
import { ZERO_BN } from '~/constants';
import { displayFullBN, toTokenUnitsBN, parseError } from '~/util';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import useGetChainToken from '~/hooks/chain/useGetChainToken';
import { FarmFromMode, FarmToMode } from '~/lib/Beanstalk/Farm';
import useAccount from '~/hooks/ledger/useAccount';
import { useFetchFarmerSilo } from '~/state/farmer/silo/updater';
import UnripeTokenRow from './UnripeTokenRow';
import Row from '~/components/Common/Row';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';

// ----------------------------------------------------

import { FC } from '~/types';

// ----------------------------------------------------

type UnripeKeys = (
  // Beans
  'circulatingBeans' |
  'withdrawnBeans' |
  'harvestableBeans' |
  'orderedBeans' |
  'farmableBeans' |
  'farmBeans' |
  'unripeBeans' |
  // LP
  'circulatingBeanEthLp' |
  'circulatingBeanLusdLp' |
  'circulatingBean3CrvLp' |
  'withdrawnBeanEthLp' |
  'withdrawnBeanLusdLp' |
  'withdrawnBean3CrvLp' |
  'circulatingBeanEthBdv' |
  'circulatingBeanLusdBdv' |
  'circulatingBean3CrvBdv' |
  'withdrawnBeanEthBdv' |
  'withdrawnBeanLusdBdv' |
  'withdrawnBean3CrvBdv' |
  'unripeLp'
);
type GetUnripeResponse = Partial<{ [key in UnripeKeys]: string }>;

// ----------------------------------------------------

const UNRIPE_BEAN_CATEGORIES = [
  'circulating',
  'withdrawn',
  'harvestable',
  'ordered',
  // 'farmable',
  'farm',
] as const;

const UNRIPE_LP_CATEGORIES = [
  {
    key: 'BeanEth',
    token: BEAN_ETH_UNIV2_LP[1],
  },
  {
    key: 'Bean3Crv',
    token: BEAN_CRV3_LP[1],
  },
  {
    key: 'BeanLusd',
    token: BEAN_LUSD_LP[1],
  },
] as const;

const tokenOrZero = (amount: string | undefined, token: Token) => {
  if (!amount) return ZERO_BN;
  return toTokenUnitsBN(amount, token.decimals);
};

const PickBeansDialog: FC<{
  handleClose: any;
} & DialogProps> = ({
  open,
  sx,
  onClose,
  fullWidth,
  fullScreen,
  disableScrollLock,
  handleClose
}) => {
  /// Theme
  const theme         = useTheme();
  const isMobile      = useMediaQuery(theme.breakpoints.down('md'));
  const [tab, setTab] = useState(0);

  /// Tokens
  const getChainToken = useGetChainToken();
  const urBean        = getChainToken(UNRIPE_BEAN);
  const urBeanCRV3    = getChainToken(UNRIPE_BEAN_CRV3);
  
  /// Farmer
  const [refetchFarmerSilo] = useFetchFarmerSilo();

  /// Ledger
  const account          = useAccount();
  const { data: signer } = useSigner();
  const beanstalk        = useBeanstalkContract(signer);
  
  /// Local data
  const [unripe, setUnripe]         = useState<GetUnripeResponse | null>(null);
  const [merkles, setMerkles]       = useState<PickMerkleResponse | null>(null);
  const [pickStatus, setPickStatus] = useState<null | 'picking' | 'success' | 'error'>(null);
  const [picked, setPicked]         = useState<[null, null] | [boolean, boolean]>([null, null]);

  /// Form
  const middleware = useFormMiddleware();

  /// Refresh 
  useEffect(() => {
    (async () => {
      try {
        if (account && open) {
          const [
            _unripe,
            _merkles,
            _picked,
          ] = await Promise.all([
            fetch(`/.netlify/functions/unripe?account=${account}`).then((response) => response.json()),
            fetch(`/.netlify/functions/pick?account=${account}`).then((response) => response.json()),
            Promise.all([
              beanstalk.picked(account, urBean.address),
              beanstalk.picked(account, urBeanCRV3.address),
            ]),
          ]);
          console.debug('[PickDialog] loaded states', { _unripe, _merkles, _picked });
          setUnripe(_unripe);
          setMerkles(_merkles);
          setPicked(_picked);
        }
      } catch (err) {
        console.error(err);
        toast.error(parseError(err));
      }
    })();
  }, [account, beanstalk, open, urBean.address, urBeanCRV3.address]);

  /// Tab handlers
  const handleDialogClose = () => {
    handleClose();
    setTab(0);
  };
  const handleNextTab = () => {
    setTab(tab + 1);
  };
  const handlePreviousTab = () => {
    setTab(tab - 1);
    if (pickStatus !== 'picking') setPickStatus(null);
  };

  /// Pick handlers
  const handlePick = useCallback((isDeposit : boolean) => () => {
    if (!merkles) return;
    middleware.before();

    setPickStatus('picking');
    const data = [];

    if (merkles.bean && picked[0] === false) {
      data.push(beanstalk.interface.encodeFunctionData('pick', [
        urBean.address,
        merkles.bean.amount,
        merkles.bean.proof,
        isDeposit ? FarmToMode.INTERNAL : FarmToMode.EXTERNAL,
      ]));
      if (isDeposit) {
        data.push(beanstalk.interface.encodeFunctionData('deposit', [
          urBean.address,
          merkles.bean.amount,
          FarmFromMode.INTERNAL, // always use internal for deposits
        ]));
      }
    }
    if (merkles.bean3crv && picked[1] === false) {
      data.push(beanstalk.interface.encodeFunctionData('pick', [
        urBeanCRV3.address,
        merkles.bean3crv.amount,
        merkles.bean3crv.proof,
        isDeposit ? FarmToMode.INTERNAL : FarmToMode.EXTERNAL,
      ]));
      if (isDeposit) {
        data.push(beanstalk.interface.encodeFunctionData('deposit', [
          urBeanCRV3.address,
          merkles.bean3crv.amount,
          FarmFromMode.INTERNAL, // always use internal for deposits
        ]));
      }
    }

    const txToast = new TransactionToast({
      loading: `Picking${isDeposit ? ' and depositing' : ''} Unripe Assets`,
      success: `Pick${isDeposit ? ' and deposit' : ''} successful. You can find your Unripe Assets ${isDeposit ? 'in the Silo' : 'in your wallet'}.`,
    });

    beanstalk.farm(data)
      .then((txn) => {
        txToast.confirming(txn);
        return txn.wait();
      })
      .then((receipt) => Promise.all([
        refetchFarmerSilo(),
      ]).then(() => receipt))
      .then((receipt) => {
        txToast.success(receipt);
        setPickStatus('success');
      })
      .catch((err) => {
        console.error(
          txToast.error(err.error || err)
        );
        setPickStatus('error');
      });
  }, [merkles, picked, beanstalk, urBean.address, urBeanCRV3.address, refetchFarmerSilo, middleware]);

  /// Tab: Pick Overview
  const alreadyPicked = picked[0] === true || picked[1] === true;
  const buttonLoading = !merkles;
  let buttonText      = 'Nothing to Pick';
  let buttonDisabled  = true;
  if (alreadyPicked) {
    buttonText = 'Already Picked';
    buttonDisabled = true;
  } else if (merkles && (merkles.bean || merkles.bean3crv)) {
    buttonDisabled = false;
    const avail = [];
    if (merkles.bean) avail.push('Unripe Beans');
    if (merkles.bean3crv) avail.push('Unripe BEAN:3CRV LP');
    buttonText = `Pick ${avail.join(' & ')}`;
  }

  const tab0 = (
    <>
      <StyledDialogTitle sx={{ pb: 1 }} onClose={handleDialogClose}>
        Pick non-Deposited Unripe Beans and Unripe BEAN:3CRV LP
      </StyledDialogTitle>
      <Row gap={1} pb={2} pl={1} pr={3}>
        <img
          src={pickImage}
          alt="pick"
          css={{ height: 120 }}
        />
        <Typography sx={{ fontSize: '15px' }} color="text.secondary">
          To claim non-Deposited Unripe Beans and Unripe BEAN:3CRV LP, they must be Picked. After Replant, you can Pick assets to your wallet, or Pick and Deposit them directly in the Silo.<br /><br />
          Unripe Deposited assets <b>do not need to be Picked</b> and will be automatically Deposited at Replant.<br /><br />
          Read more about Unripe assets <Link href="https://docs.bean.money/almanac/farm/barn#unripe-assets" target="_blank" rel="noreferrer">here</Link>.
        </Typography>
      </Row>
      <Divider />
      <StyledDialogContent>
        <Stack gap={2}>
          {/**
            * Section 2: Unripe Beans
            */}
          <Stack gap={1}>
            {/**
              * Section 2a: Beans by State
              */}
            <Typography variant="h4">Non-Deposited pre-exploit Bean balances</Typography>
            <Stack gap={0.5} pl={1}>
              {UNRIPE_BEAN_CATEGORIES.map((key) => (
                <UnripeTokenRow
                  key={key}
                  name={key === 'harvestable' ? 'Harvestable Pods' : `${key} Beans`}
                  amount={tokenOrZero(unripe?.[`${key}Beans`], BEAN[1])}
                  tooltip={UNRIPE_ASSET_TOOLTIPS[`${key}Beans`]}
                  token={BEAN[1]}
                />
              ))}
            </Stack>
            <Divider sx={{ ml: 1 }} />
            {/**
              * Section 3b: Total Unripe Beans
              */}
            <Row justifyContent="space-between" pl={1}>
              <Typography>
                Unripe Beans available to Pick at Replant
              </Typography>
              <Row gap={0.3}>
                <img src={unripeBeanIcon} alt="Circulating Beans" width={13} />
                <Typography variant="h4">
                  {displayFullBN(
                    // HOTFIX:
                    // After launching this dialog, the team decided to
                    // auto-deposit Farmable Beans. Instead of reworking the
                    // underlying JSONs, we just subtract farmableBeans from 
                    // the total unripeBeans for user display.
                    tokenOrZero(unripe?.unripeBeans, BEAN[1]).minus(
                      tokenOrZero(unripe?.farmableBeans, BEAN[1])
                    )
                  )}
                </Typography>
              </Row>
            </Row>
          </Stack>
          {/**
            * Section 3: LP
            */}
          <Stack sx={{ pl: isMobile ? 0 : 0, pb: 0.5 }} gap={1}>
            {/**
              * Section 2a: LP by State
              */}
            <Typography variant="h4">Non-Deposited pre-exploit LP balances</Typography>
            {UNRIPE_LP_CATEGORIES.map((obj) => (
              <Stack key={obj.token.address} gap={0.5} pl={1}>
                <Typography sx={{ fontSize: '16px' }}>{obj.token.name} Balances</Typography>
                <UnripeTokenRow
                  name={`Circulating ${obj.token.name}`}
                  amount={tokenOrZero(unripe?.[`circulating${obj.key}Lp`], obj.token)}
                  tooltip={UNRIPE_ASSET_TOOLTIPS[`circulating${obj.key}Lp`]}
                  token={obj.token}
                  bdv={tokenOrZero(unripe?.[`circulating${obj.key}Bdv`], BEAN[1])}
                />
                <UnripeTokenRow
                  name={`Withdrawn ${obj.token.name}`}
                  amount={tokenOrZero(unripe?.[`withdrawn${obj.key}Lp`], obj.token)}
                  tooltip={UNRIPE_ASSET_TOOLTIPS[`withdrawn${obj.key}Lp`]}
                  token={obj.token}
                  bdv={tokenOrZero(unripe?.[`withdrawn${obj.key}Bdv`], BEAN[1])}
                />
              </Stack>
            ))}
            <Divider sx={{ ml: 1 }} />
            {/**
              * Section 2b: Total Unripe LP
              */}
            <Row justifyContent="space-between" pl={1}>
              <Typography>
                Unripe BEAN:3CRV LP available to Pick at Replant
              </Typography>
              <Row gap={0.3}>
                <img src={brownLPIcon} alt="Circulating Beans" width={13} />
                <Typography variant="h4">
                  {displayFullBN(tokenOrZero(unripe?.unripeLp, BEAN[1]))}
                </Typography>
              </Row>
            </Row>
          </Stack>
        </Stack>
      </StyledDialogContent>
      <StyledDialogActions>
        <Box width="100%">
          <LoadingButton
            loading={buttonLoading}
            disabled={buttonDisabled}
            onClick={handleNextTab}
            fullWidth
            // Below two params are required for the disabled
            // state to work correctly and for the font to show
            // as white when enabled
            variant="contained"
            color="dark"
            sx={{
              py: 1,
              backgroundColor: BeanstalkPalette.brown,
              '&:hover': { 
                backgroundColor: BeanstalkPalette.brown,
                opacity: 0.96
              }
            }}>
            {buttonText}
          </LoadingButton>
        </Box>
      </StyledDialogActions>
    </>
  );

  /// Tab: Pick
  const tab1 = (
    <>
      <StyledDialogTitle
        onBack={handlePreviousTab}
        onClose={handleDialogClose}
      >
        Pick Unripe Assets
      </StyledDialogTitle>
      <StyledDialogContent sx={{ width: isMobile ? null : '560px' }}>
        <Stack gap={0.8}>
          {pickStatus === null ? (
            <>
              <DescriptionButton
                title="Pick Unripe Assets" 
                description="Claim your Unripe Beans and Unripe LP to your wallet." 
                onClick={handlePick(false)}
              />
              <DescriptionButton
                title="Pick and Deposit Unripe Assets" 
                description="Claim your Unripe Beans and Unripe LP, then Deposit them in the Silo to earn yield."
                onClick={handlePick(true)}
              />
            </>
          ) : (
            <Stack direction="column" sx={{ width: '100%', minHeight: 100 }} justifyContent="center" gap={1} alignItems="center">
              {pickStatus === 'picking' && <CircularProgress variant="indeterminate" color="primary" size={32} />}
              {pickStatus === 'error' && (
                <Typography color="text.secondary">Something went wrong while picking your Unripe assets.</Typography>
              )}
              {pickStatus === 'success' && (
                <Typography color="text.secondary">Unripe Assets picked successfully.</Typography>
              )}
            </Stack>
          )}
        </Stack>
      </StyledDialogContent>
    </>
  );

  return (
    <Dialog
      onClose={onClose}
      open={open}
      fullWidth={fullWidth}
      fullScreen={fullScreen}
      disableScrollLock={disableScrollLock}
      sx={{ ...sx }}
    >
      {tab === 0 && tab0}
      {tab === 1 && tab1}
    </Dialog>
  );
};

export default PickBeansDialog;
