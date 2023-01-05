import { Button, Tooltip } from '@mui/material';
import React from 'react';
import { NavLink } from 'react-router-dom';
import { BeanstalkPalette, FontSize } from '~/components/App/muiTheme';
import Row from '~/components/Common/Row';
import { FC } from '~/types';

const BUTTON_SX = {
  minWidth: 0,
  maxHeight: '23px',
  padding: 0.5,
  color: 'text.secondary',
  fontSize: FontSize.xs,
  // https://stackoverflow.com/a/63276424
  '&:disabled': {
    pointerEvents: 'auto !important'
  },
  backgroundColor: undefined,
  '&.Mui-active': {
    color: 'white',
    backgroundColor: BeanstalkPalette.theme.winter.primary,
    // ':hover': {
    //   backgroundColor: BeanstalkPalette.theme.winter.primaryDark
    // }
  },
  borderRadius: '4px',
};

const SubActionSelect: FC<{
  action: 'buy' | 'sell',
  id?: string;
}> = ({
  action,
  id,
}) => (
  // Hack: if `id` is present, the user navigated to a specific listing/order,
  // so we switch the selected tab to 1. Otherwise it's 0. Change is handled
  // by NavLink routing to `to` so we don't need a handleChange function.
  <Row gap={0.8}>
    <Button 
      variant="text"
      component={NavLink}
      to={`/market/${action}`}
      sx={BUTTON_SX}
      className={id ? undefined : 'Mui-active'}
    >
      {action === 'buy' ? 'ORDER' : 'LIST'}
    </Button>
    <Tooltip title={id ? '' : `Select a Pod ${action === 'buy' ? 'Listing' : 'Order'} on the graph to Fill.`}>
      <div>
        <Button 
          variant="text"
          component={NavLink}
          disabled={!id}
          to={`/market/${action}/${id}`}
          sx={BUTTON_SX}
          className={id ? 'Mui-active' : undefined}
        >
          FILL
        </Button>
      </div>
    </Tooltip>
  </Row>
);

// <Row gap={0.8}>
//   <Button
//     component={NavLink}
//     to="/market/buy"
//     variant="text"
//     color="primary"
//   >
//     {createLabel}
//   </Button>
//   <Tooltip title="Test">
//     <span>
//       <Button
//         variant="text"
//         color="primary"
//         disabled={!id}
//       >
//         {fillLabel}
//       </Button>
//     </span>
//   </Tooltip>
//   {/* <SubAction
//        isActive={orderType !== PodOrderType.FILL}
//        onClick={() =>
//         setOrderType(
//           orderAction === PodOrderAction.BUY
//             ? PodOrderType.ORDER
//             : PodOrderType.LIST
//         )
//       }
//     >
//        <Typography variant="caption">
//          {orderAction === PodOrderAction.BUY ? 'ORDER' : 'LIST'}
//        </Typography>
//      </SubAction>
//      <SubAction
//        isActive={orderType === PodOrderType.FILL}
//        onClick={() => setOrderType(PodOrderType.FILL)}
//     >
//        <Typography variant="caption">FILL</Typography>
//      </SubAction> */}
// </Row>

export default SubActionSelect;
