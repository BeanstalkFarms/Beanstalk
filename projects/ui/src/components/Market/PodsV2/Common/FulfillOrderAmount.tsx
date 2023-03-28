import { Button, InputAdornment, Typography } from '@mui/material';
import React from 'react';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import Token, { ERC20Token, NativeToken } from '~/classes/Token';
import { TokenSelectDialog } from '~/components/Common/Form';
import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import { BEAN, ETH, WETH } from '~/constants/tokens';
import useTokenMap from '~/hooks/chain/useTokenMap';
import useToggle from '~/hooks/display/useToggle';
import useFarmerBalances from '~/hooks/farmer/useFarmerBalances';
import { fulfillAmountAtom, useFulfillTokenAtom } from '../info/atom-context';
import AtomInputField from '~/components/Common/Atom/AtomInputField';
import { FontSize } from '~/components/App/muiTheme';

const StartAdornment: React.FC<{}> = () => (
  <InputAdornment position="start">
    <Typography color="text.primary" variant="caption">
      TOTAL
    </Typography>
  </InputAdornment>
);

const TokenEndAdornment: React.FC<{
  token: Token;
  onClick: () => void;
}> = ({ token, onClick }) => (
  <InputAdornment position="end" sx={{ mt: 0.1 }}>
    <Button variant="text" size="small" onClick={onClick}>
      <Typography variant="caption" color="text.primary">
        {token.symbol}
        <KeyboardArrowDownIcon
          sx={{
            fontSize: FontSize.xs,
            position: 'relative',
            color: 'rgba(0,0,0,0.87)',
            ml: '2px',
            top: '2px',
          }}
        />
      </Typography>
    </Button>
  </InputAdornment>
);

const FulfillOrderAmount: React.FC<{}> = () => {
  // State
  const [isTokenSelectVisible, handleOpen, hideTokenSelect] = useToggle();
  const [fulfillToken, setFulfillToken] = useFulfillTokenAtom();

  const erc20TokenMap = useTokenMap<ERC20Token | NativeToken>([
    BEAN,
    ETH,
    WETH,
  ]);

  // Farmer
  const balances = useFarmerBalances();

  return (
    <>
      <TokenSelectDialog
        open={isTokenSelectVisible}
        handleClose={hideTokenSelect}
        handleSubmit={(_tokens: Set<Token>) => {
          const toArr = Array.from(_tokens);
          toArr.length && setFulfillToken(toArr[0]);
        }}
        selected={[fulfillToken]}
        balances={balances}
        tokenList={Object.values(erc20TokenMap)}
        mode={TokenSelectMode.SINGLE}
      />
      <AtomInputField
        atom={fulfillAmountAtom}
        InputProps={{
          startAdornment: <StartAdornment />,
          endAdornment: fulfillToken && (
            <TokenEndAdornment token={fulfillToken} onClick={handleOpen} />
          ),
        }}
      />
    </>
  );
};

export default FulfillOrderAmount;
