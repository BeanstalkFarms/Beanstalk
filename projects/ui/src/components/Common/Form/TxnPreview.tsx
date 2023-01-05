import React, { useMemo, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import groupBy from 'lodash/groupBy';
import DoubleArrowIcon from '@mui/icons-material/DoubleArrow';
import TokenIcon from '~/components/Common/TokenIcon';
import { FERTILIZER_ICONS } from '~/components/Barn/FertilizerImage';
import siloIcon from '~/img/beanstalk/silo-icon.svg';
import Token from '~/classes/Token';
import {
  Action,
  ActionType,
  parseActionMessage,
  ReceiveTokenAction,
  SiloDepositAction,
  SiloRewardsAction,
  SiloTransitAction,
  SwapAction
} from '~/util/Actions';
import { SupportedChainId } from '~/constants/chains';
import { BEAN, PODS, SEEDS, SPROUTS, STALK, USDC } from '~/constants/tokens';
import { FarmToMode } from '~/lib/Beanstalk/Farm';
import AddressIcon from '~/components/Common/AddressIcon';
import Row from '~/components/Common/Row';
import { FC } from '~/types';
import { BeanstalkPalette } from '~/components/App/muiTheme';

// -----------------------------------------------------------------------

const IconRow : FC<{ spacing?: number }> = ({ children, spacing = 0.75 }) => (
  <Row sx={{ height: '100%' }} spacing={spacing}>
    {children}
  </Row>
);

const ActionTokenImage : FC<{ token: Token }> = ({ token }) => (
  <img
    key={token.address}
    src={token.logo}
    alt={token.name}
    css={{ height: '100%' }}
  />
);

const SwapStep : FC<{ actions: SwapAction[] }> = ({ actions }) => {
  const data = actions.reduce((agg, a) => {
    if (!agg.in.addrs.has(a.tokenIn.address)) {
      agg.in.addrs.add(a.tokenIn.address);
      agg.in.elems.push(
        <ActionTokenImage key={a.tokenIn.address} token={a.tokenIn} />
      );
    }
    if (!agg.out.addrs.has(a.tokenOut.address)) {
      agg.out.addrs.add(a.tokenOut.address);
      agg.out.elems.push(
        <ActionTokenImage key={a.tokenOut.address} token={a.tokenOut} />
      );
    }
    return agg;
  }, {
    in: {
      addrs: new Set<string>(),
      elems: [] as JSX.Element[],
    },
    out: {
      addrs: new Set<string>(),
      elems: [] as JSX.Element[],
    }
  });
  return (
    <Row sx={{ height: '100%' }} spacing={0.33}>
      {data.in.elems}
      <DoubleArrowIcon sx={{ color: 'text.secondary', fontSize: 14 }} />
      {data.out.elems}
    </Row>
  );
};

const TxnStep : FC<{
  type: ActionType;
  actions: Action[];
  highlighted: ActionType | undefined;
}> = ({
  type,
  actions,
  highlighted,
}) => {
  let step;
  switch (type) {
    /// SWAP
    case ActionType.SWAP:
      step = (
        <SwapStep actions={actions as SwapAction[]} />
      );
      break;
    case ActionType.RECEIVE_TOKEN: {
      // eslint-disable-next-line
      const a = actions[0] as ReceiveTokenAction;
      step = (
        <IconRow spacing={0.5}>
          {a.destination !== undefined ? (
            a.destination === FarmToMode.INTERNAL
              ? <Typography>🚜</Typography>
              : <AddressIcon />
          ) : null}
        </IconRow>
      );
      break;
    }

    /// SILO
    case ActionType.DEPOSIT:
    case ActionType.WITHDRAW:
    case ActionType.CLAIM_WITHDRAWAL:
      step = (
        <IconRow>
          <img
            src={siloIcon}
            css={{ height: '100%' }}
            alt=""
          />
          {(actions as SiloDepositAction[]).map((a) => (
            <ActionTokenImage key={a.token.address} token={a.token} />
          ))}
        </IconRow>
      );
      break;
    case ActionType.TRANSFER:
      step = (
        <IconRow>
          <TokenIcon token={(actions[0] as SiloTransitAction).token} css={{ height: '100%' }} />
        </IconRow>
      );
      break;
    case ActionType.UPDATE_SILO_REWARDS:
      step = (
        <IconRow spacing={0}>
          <Typography fontWeight="bold" sx={{ fontSize: 20 }}>{(actions[0] as SiloRewardsAction).stalk.lt(0) ? '🔥' : '+'}</Typography>
          <TokenIcon token={STALK} css={{ height: '100%' }} />
          <TokenIcon token={SEEDS} css={{ height: '100%' }} />
        </IconRow>
      );
      break;
    case ActionType.IN_TRANSIT:
      step = (
        <IconRow>
          <TokenIcon token={(actions[0] as SiloTransitAction).token} css={{ height: '100%' }} />
        </IconRow>
      );
      break;

    /// FIELD
    case ActionType.BUY_BEANS:
      step = (
        <IconRow>
          <TokenIcon token={(actions[0] as SiloTransitAction).token} css={{ height: '100%' }} />
        </IconRow>
      );
      break;
    case ActionType.BURN_BEANS:
      step = (
        <IconRow spacing={0.3}>
          <Typography fontWeight="bold" sx={{ fontSize: 20 }}>🔥</Typography>
          <TokenIcon token={BEAN[1]} css={{ height: '100%' }} />
        </IconRow>
      );
      break;
      case ActionType.HARVEST:
        step = (
          <IconRow>
            <TokenIcon token={PODS} css={{ height: '100%' }} />
          </IconRow>
        );
        break;
    case ActionType.RECEIVE_PODS:
      step = (
        <IconRow>
          <TokenIcon token={PODS} css={{ height: '100%' }} />
        </IconRow>
      );
      break;
    case ActionType.RECEIVE_BEANS:
      step = (
        <IconRow>
          <TokenIcon token={BEAN[1]} css={{ height: '100%' }} />
        </IconRow>
      );
      break;
    case ActionType.TRANSFER_PODS:
      step = (
        <IconRow>
          <TokenIcon token={PODS} css={{ height: '100%' }} />
        </IconRow>
      );
      break;

    /// MARKET
    case ActionType.CREATE_ORDER:
      step = (
        <IconRow>
          <TokenIcon token={BEAN[1]} css={{ height: '100%', marginTop: 0, }} />
          <DoubleArrowIcon sx={{ color: 'text.secondary', fontSize: 14 }} />
          <TokenIcon token={PODS} css={{ height: '100%', marginTop: 0, }} />
        </IconRow>
      );
      break;
    // FIXME: better way to reduce duplicate code here?
    case ActionType.BUY_PODS:
      step = (
        <TokenIcon token={PODS} css={{ height: '100%', marginTop: 0, }} />
      );
      break;
    case ActionType.SELL_PODS:
      step = (
        <TokenIcon token={PODS} css={{ height: '100%', marginTop: 0, }} />
      );
      break;

    /// FERTILIZER
    case ActionType.RINSE:
      step = (
        <IconRow>
          <TokenIcon token={SPROUTS} css={{ height: '100%' }} />
        </IconRow>
      );
      break;
    case ActionType.BUY_FERTILIZER:
      step = (
        <IconRow>
          <TokenIcon token={USDC[SupportedChainId.MAINNET]} css={{ height: '100%', marginTop: 0, }} />
          <DoubleArrowIcon sx={{ color: 'text.secondary', fontSize: 14 }} />
          <img
            src={FERTILIZER_ICONS.unused}
            alt="FERT"
            css={{ height: '100%' }}
          />
        </IconRow>
      );
      break;
    case ActionType.RECEIVE_FERT_REWARDS:
      step = (
        <IconRow>
          <img
            src={FERTILIZER_ICONS.active}
            alt="FERT"
            css={{ height: '100%' }}
          />
          <DoubleArrowIcon sx={{ color: 'text.secondary', fontSize: 14 }} />
          <TokenIcon token={SPROUTS} css={{ height: '100%', marginTop: 0, }} />
        </IconRow>
      );
      break;

    /// ?
    case ActionType.END_TOKEN:
      step = (
        <IconRow>
          <TokenIcon token={(actions[0] as SiloTransitAction).token} css={{ height: '100%' }} />
        </IconRow>
      );
      break;
    default:
      break;
  }

  return (
    <Box sx={{
      width: '80px',
      height: '100%', // of TXN_PREVIEW_HEIGHT
      textAlign: 'center',
      '&:first-child': {
        textAlign: 'left',
      },
      '&:last-child': {
        textAlign: 'right',
      }
    }}>
      <Box sx={{
        height: '100%',
        display: 'inline-block',
        py: 0.5,
        px: 0.5,
        mx: 'auto',
        background: BeanstalkPalette.offWhite,
      }}>
        <Box
          display="inline-block"
          sx={{
            height: '100%',
            opacity: (highlighted === undefined || highlighted === type) ? 1 : 0.2,
          }}
        >
          {step}
        </Box>
      </Box>
    </Box>
  );
};

// -----------------------------------------------------------------------

const EXECUTION_STEPS = [
  /// Group 1:
  /// Actions that must precede a Beanstalk transaction
  ActionType.SWAP,

  /// Group 2:
  /// Beanstalk function calls
  ActionType.TRANSFER_BALANCE,
  ActionType.HARVEST,
  ActionType.DEPOSIT,
  ActionType.WITHDRAW,
  ActionType.BUY_FERTILIZER,
  ActionType.CREATE_ORDER,
  ActionType.TRANSFER,
  ActionType.BUY_BEANS,
  ActionType.BURN_BEANS,
  ActionType.TRANSFER_PODS,
  ActionType.SELL_PODS,
  ActionType.RINSE,

  /// Group 3:
  /// Results of Beanstalk function calls
  ActionType.UPDATE_SILO_REWARDS,
  ActionType.RECEIVE_FERT_REWARDS,
  ActionType.IN_TRANSIT,
  ActionType.CLAIM_WITHDRAWAL,
  ActionType.RECEIVE_BEANS,
  ActionType.RECEIVE_PODS,
  ActionType.BUY_PODS,
  ActionType.RECEIVE_TOKEN,

  /// Group 4:
  /// ???
  ActionType.END_TOKEN
];

const TXN_PREVIEW_HEIGHT = 35;
const TXN_PREVIEW_LINE_WIDTH = 5;

const TxnPreview : FC<{
  actions: (Action | undefined)[]
}> = ({
  actions
}) => {
  const instructionsByType = useMemo(() =>
    // actions.reduce((prev, curr) => {
    //   if (curr.type !== ActionType.BASE) {
    //     prev.grouped[curr.type] = curr;

    //   }
    //   return prev;
    // }, { grouped: {}, total: 0 }),
    // [actions]
    groupBy(actions.filter((a) => a && a.type !== ActionType.BASE) as Action[], 'type'),
    [actions]
  );
  const instructionGroupCount = Object.keys(instructionsByType).length;
  const [highlighted, setHighlighted] = useState<ActionType | undefined>(undefined);

  if (actions.length === 0) {
    return (
      <Typography color="text.secondary" textAlign="center">
        No actions yet.
      </Typography>
    );
  }

  return (
    <Stack gap={1.5}>
      {instructionGroupCount > 1 ? (
        <Box sx={{
          position: 'relative',
          height: `${TXN_PREVIEW_HEIGHT}px`,
        }}>
          {/* Dotted line */}
          <Box
            sx={{
              borderColor: 'divider',
              borderBottomStyle: 'dotted',
              borderBottomWidth: TXN_PREVIEW_LINE_WIDTH,
              width: '100%',
              position: 'absolute',
              left: 0,
              top: TXN_PREVIEW_HEIGHT / 2 - TXN_PREVIEW_LINE_WIDTH / 2,
              zIndex: 1,
            }}
          />
          {/* Content */}
          <Box sx={{
            position: 'relative',
            zIndex: 2,      // above the Divider
            height: '100%'  // of TXN_PREVIEW_HEIGHT
          }}>
            {/* Distribute content equally spaced
              * across the entire container */}
            <Row
              justifyContent="space-between"
              sx={{
                height: '100%' // of TXN_PREVIEW_HEIGHT
              }}
            >
              {EXECUTION_STEPS.map((step, index) => (
                instructionsByType[step] ? (
                  <TxnStep
                    key={index}
                    type={step}
                    actions={instructionsByType[step]}
                    highlighted={highlighted}
                  />
                ) : null
              ))}
            </Row>
          </Box>
        </Box>
      ) : null}
      {/* Show highlightable explanations of each action */}
      <Stack>
        {actions.map((a, index) => (
          a !== undefined && (
            <Box
              key={index}
              sx={{
                opacity: (highlighted === undefined || a.type === highlighted) ? 1 : 0.3,
                cursor: 'pointer',
                py: 0.5,
              }}
              onMouseOver={() => setHighlighted(a.type)}
              onMouseOut={() => setHighlighted(undefined)}
              onFocus={() => setHighlighted(a.type)}
              onBlur={() => setHighlighted(undefined)}
            >
              {/* <Typography variant="body1" color="grey[300]"> */}
              <Typography variant="body1" color="text.primary">
                {parseActionMessage(a)}
              </Typography>
            </Box>
          )
        ))}
      </Stack>
    </Stack>
  );
};

export default TxnPreview;
