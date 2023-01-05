import React from 'react';
import { Box, Divider, Link, Stack, Typography } from '@mui/material';
import BigNumber from 'bignumber.js';
import Token from '~/classes/Token';
import { displayBN, toTokenUnitsBN } from '~/util';
import { BEAN, PODS, SILO_WHITELIST } from '~/constants/tokens';
import { SupportedChainId } from '~/constants/chains';
import { Event } from '~/lib/Beanstalk/EventProcessor';
import TokenIcon from '../Common/TokenIcon';
import useTokenMap from '../../hooks/chain/useTokenMap';
import Row from '~/components/Common/Row';
import { FC } from '~/types';

export interface EventItemProps {
  event: Event;
  account: string;
}

/**
 * Token Display with respect to the User.
 * - "in"  = I receive something.
 * - "out" = I spend something.
 */
const TokenDisplay: FC<{
  color?: 'green' | 'red';
  input?: [BigNumber, Token],
}> = (props) => (
  <div>
    {props.input ? (
      <Row gap={0.3}>
        <Typography variant="body1" color={props.color}>
          {props.color === 'red' ? '-' : '+'}
        </Typography>
        <TokenIcon token={props.input[1]} />
        <Typography variant="body1" color={props.color}>
          {`${displayBN(props.input[0])}`}
        </Typography>
      </Row>
    ) : null}
  </div>
);

const EventItem: FC<EventItemProps> = ({ event, account }) => {
  // const [expanded, setExpanded] = useState(false);
  let eventTitle = `${event.event}`;
  let amountIn;
  let amountOut;
  
  const siloTokens = useTokenMap(SILO_WHITELIST);
  
  const processTokenEvent = (e: Event, title: string, showInput?: boolean, showOutput?: boolean) => {
    const tokenAddr = e.args?.token.toString().toLowerCase();
      if (siloTokens[tokenAddr]) {
        const token = siloTokens[tokenAddr];
        const amount = toTokenUnitsBN(
          new BigNumber(event.args?.amount.toString()),
            token.decimals
        );
        eventTitle = `${title} ${token.symbol}`;
        if (showInput) {
          amountIn = (
            <TokenDisplay color="green" input={[amount, token]} />
          );
        }
        if (showOutput) {
          amountOut = (
            <TokenDisplay color="red" input={[amount, token]} />
          );
        }
      }
  };

  switch (event.event) {
    case 'AddDeposit': {
      processTokenEvent(event, 'Deposit', true, false);
      break;
    }
    case 'AddWithdrawal': {
      processTokenEvent(event, 'Withdraw', false, true);
      break;
    }
    case 'AddWithdrawals': {
      processTokenEvent(event, 'Add Withdrawals of', false, true);
      break;
    }
    // claim from silo
    case 'RemoveWithdrawal': {
      processTokenEvent(event, 'Claim', true, false);
      break;
    }
    case 'RemoveWithdrawals': {
      processTokenEvent(event, 'Remove Withdrawals of', false, true);
      break;
    }
    case 'Chop': {
      processTokenEvent(event, 'Chop', true, false);
      break;
    }
    case 'Pick': {
      processTokenEvent(event, 'Pick', true, false);
      break;
    }
    case 'Rinse': {
      processTokenEvent(event, 'Rinse', true, false);
      break;
    }
    case 'Sow': {
      const pods = toTokenUnitsBN(event.args?.pods.toString(), BEAN[SupportedChainId.MAINNET].decimals);
      if (event.args?.beans.toString() !== undefined) {
        const beans = toTokenUnitsBN(event.args?.beans.toString(), BEAN[SupportedChainId.MAINNET].decimals);

        const weather = pods
          .dividedBy(beans)
          .minus(new BigNumber(1))
          .multipliedBy(100)
          .toFixed(0);

        eventTitle = `Bean Sow (${weather}% Temperature)`;
        amountOut = (
          <TokenDisplay color="red" input={[beans, BEAN[SupportedChainId.MAINNET]]} />
        );
        amountIn = (
          <TokenDisplay color="green" input={[pods, PODS]} />
        );
      } else {
        eventTitle = 'Bean Sow';
        amountIn = (
          <TokenDisplay color="green" input={[pods, PODS]} />
        );
      }
      break;
    }
    case 'Harvest': {
      const beans = toTokenUnitsBN(
        new BigNumber(event.args?.beans.toString()),
        BEAN[SupportedChainId.MAINNET].decimals
      );

      eventTitle = 'Pod Harvest';
      amountOut = (
        <TokenDisplay color="red" input={[beans, PODS]} />
      );
      amountIn = (
        <TokenDisplay color="green" input={[beans, BEAN[SupportedChainId.MAINNET]]} />
      );
      break;
    }
    // FIXME: need to add Bean inflows here.
    // Technically we need to look up the price of the Pod Order
    // during this Fill by scanning Events. This is too complex to
    // do efficiently in the frontend so it should be likely be
    // moved to the subgraph.
    case 'PodOrderFilled': {
      const values = event.args;
      // const pods = toTokenUnitsBN(values.amount, BEAN.decimals);
      if (values?.to.toString().toLowerCase() === account) {
        // My Pod Order was "Filled".
        // I lose Beans, gain the Plot.
        eventTitle = 'Bought Plot';
      } else {
        // I "Filled" a Pod Order (sold my plot)
        // I lose the plot, gain Beans.
        eventTitle = 'Purchase Plot';
      }
      break;
    }
    case 'PlotTransfer': {
      const pods = toTokenUnitsBN(
        new BigNumber(event.args?.pods.toString()),
        BEAN[SupportedChainId.MAINNET].decimals
      );
      if (event.args?.from.toString().toLowerCase() === account) {
        eventTitle = 'Transfer Plot';
        amountOut = (
          <TokenDisplay color="red" input={[pods, PODS]} />
        );
      } else {
        eventTitle = 'Receive Plot';
        amountIn = (
          <TokenDisplay color="green" input={[pods, PODS]} />
        );
      }
      break;
    }
    default:
      break;
  }

  // Don't display certain processed events like "RemoveDeposits"
  if (amountIn === undefined && amountOut === undefined) {
    return null;
  }

  return (
    <Box sx={{ position: 'relative' }}>
      <Box py={1}>
        <Row gap={0.2} justifyContent="space-between">
          <Stack direction="column">
            {/* Event title */}
            <Typography variant="h4">{eventTitle}</Typography>
            {/* Timestamps */}
            <Row>
              <Link color="text.secondary" sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }} href={`https://etherscan.io/tx/${event.transactionHash}`} target="_blank" rel="noreferrer">
                {/* {event?.args?.season ? ( */}
                {/*  <Typography color="text.secondary">Season {event.args?.season.toString()}</Typography> */}
                {/* ) : ( */}
                {/*  <Typography color="text.secondary">{`Block ${event.blockNumber}`}</Typography> */}
                {/* )} */}
                <Typography color="text.secondary">{`Block ${event.blockNumber}`}</Typography>
              </Link>
            </Row>
          </Stack>
          <Stack direction="column" alignItems="flex-end">
            {amountOut}
            {amountIn}
          </Stack>
        </Row>
      </Box>
      <Box sx={{ position: 'absolute', width: 'calc(100% + 40px)', height: '1px', left: '-20px' }}>
        <Divider />
      </Box>
    </Box>
  );
};

export default EventItem;

// const [eventDatetime, setEventDatetime] = useState('');
//
// const handleSetDatetime = () => {
//   getBlockTimestamp(event.blockNumber).then((t) => {
//     const date = new Date(t * 1e3);
//     const dateString = date.toLocaleDateString('en-US');
//     const timeString = date.toLocaleTimeString('en-US');
//     setEventDatetime(`${dateString} ${timeString}`);
//   });
// };

// useEffect(() => {
//   /** This is NOT an optimal way to get timestamps for events.
//    * A more ideal solution will 1) be off-chain and 2) not
//    * repeat calls for the same block number. - Cool Bean */
//   function handleSetDatetimeTwo() {
//     getBlockTimestamp(event.blockNumber).then((t) => {
//       const date = new Date(t * 1e3);
//       const dateString = date.toLocaleDateString('en-US');
//       const timeString = date.toLocaleTimeString('en-US');
//       setEventDatetime(`${dateString} ${timeString}`);
//     });
//   }
//
//   handleSetDatetimeTwo();
// }, [event.blockNumber]);

// ----- CODE TO HANDLE SWAPS -----
// case 'Swap': {
//   if (event.args?.amount0In.toString() !== '0') {
//     const swapFrom = toTokenUnitsBN(
//       new BigNumber(event.args?.amount0In.toString()),
//       ETH[SupportedChainId.MAINNET].decimals
//     );
//     const swapTo = toTokenUnitsBN(
//       new BigNumber(event.args?.amount1Out.toString()),
//       BEAN[SupportedChainId.MAINNET].decimals
//     );
//
//     eventTitle = 'ETH to Bean Swap';
//     amountOut = (
//       <TokenDisplay color="red" input={[swapFrom, ETH[SupportedChainId.MAINNET]]} />
//     );
//     amountIn = (
//       <TokenDisplay color="green" input={[swapTo, BEAN[SupportedChainId.MAINNET]]} />
//     );
//   } else if (event.args?.amount1In.toString() !== '0') {
//     const swapFrom = toTokenUnitsBN(
//       new BigNumber(event.args?.amount1In.toString()),
//       BEAN[SupportedChainId.MAINNET].decimals
//     );
//     const swapTo = toTokenUnitsBN(
//       new BigNumber(event.args?.amount0Out.toString()),
//       ETH[SupportedChainId.MAINNET].decimals
//     );
//
//     eventTitle = 'Bean to ETH Swap';
//     amountOut = (
//       <TokenDisplay color="red" input={[swapFrom, BEAN[SupportedChainId.MAINNET]]} />
//     );
//     amountIn = (
//       <TokenDisplay color="green" input={[swapTo, ETH[SupportedChainId.MAINNET]]} />
//     );
//   }
//   break;
// }
