import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Link,
  Box,
  Stack,
} from '@mui/material';
import {
  StyledDialog,
  StyledDialogActions,
  StyledDialogContent,
  StyledDialogTitle,
} from '~/components/Common/Dialog';
import { displayBN, getTokenIndex } from '~/util';
import { ZERO_BN } from '~/constants';
import { FarmerBalances } from '~/state/farmer/balances';
import { FarmerSilo } from '~/state/farmer/silo';
import Row from '~/components/Common/Row';
import { ETH } from '~/constants/tokens';
import useGetChainToken from '~/hooks/chain/useGetChainToken';
import { TokenInstance } from '~/hooks/beanstalk/useTokens';
import BalanceFromRow, { BalanceFrom } from './BalanceFromRow';
import { BeanstalkPalette, FontSize, IconSize } from '../../App/muiTheme';

export enum TokenSelectMode {
  MULTI,
  SINGLE,
}

export type TokenBalanceMode = {
  farm: FarmerBalances;
  'silo-deposits': FarmerSilo['balances'];
};

export type TokenSelectDialogProps<K extends keyof TokenBalanceMode> = {
  /** Show the dialog. */
  open: boolean;
  /** Close the dialog. */
  handleClose: () => void;
  /** The list of selected Tokens when the User opens the dialog. Updated on submit. */
  selected: ({ token: TokenInstance } & any)[];
  /** Called when the user "submits" their changes to selected tokens. */
  handleSubmit: (s: Set<TokenInstance>) => void;

  /** Override the dialog title */
  title?: string | JSX.Element;
  /** */
  description?: string | JSX.Element;
  /** the balance (circulating |farm | combined) being used */
  balanceFrom?: BalanceFrom;
  /** custom set of options to filter the balance from selection */
  balanceFromOptions?: BalanceFrom[];
  /** set the balance (circulating |farm | combined) to use */
  setBalanceFrom?: (v: BalanceFrom) => void;
  /**
   *
   */
  balancesType?: K;
  /** The Farmer's current balances. Displayed alongside each token.
   * Shows 0 for missing balances if `balances` is an object.
   * Shows nothing if `balances` is undefined`. */
  balances?: TokenBalanceMode[K] | undefined;
  // balances: FarmerSiloBalance['deposited'] | FarmerBalances | undefined;
  /** A list of tokens to show in the Dialog. */
  tokenList: TokenInstance[];
  /** Single or multi-select */
  mode?: TokenSelectMode;
};

type TokenSelectDialogC = React.FC<
  TokenSelectDialogProps<keyof TokenBalanceMode>
>;

const balanceFromText = {
  [BalanceFrom.INTERNAL]: 'Displaying Farm Balances.',
  [BalanceFrom.EXTERNAL]: 'Displaying Circulating Balances.',
  [BalanceFrom.TOTAL]: 'Displaying Total Farm and Circulating Balances.',
};

const TokenSelectDialog: TokenSelectDialogC = React.memo(
  ({
    // Dialog
    open,
    handleClose,
    selected,
    handleSubmit,
    title,
    description,
    balanceFrom = BalanceFrom.TOTAL,
    balanceFromOptions,
    setBalanceFrom,
    // Balances
    balancesType = 'farm',
    balances: _balances,
    // Tokens
    tokenList,
    mode = TokenSelectMode.MULTI,
  }) => {
    /// Chain Constants
    const getChainToken = useGetChainToken();
    const Eth = getChainToken(ETH);

    /** keep an internal copy of selected tokens */
    const [selectedInternal, setSelectedInternal] = useState<
      Set<TokenInstance>
    >(new Set<TokenInstance>());
    const [balanceFromInternal, setBalanceFromInternal] = useState<BalanceFrom>(
      BalanceFrom.TOTAL
    );

    const getBalance = useCallback(
      (token: TokenInstance) => {
        if (!_balances) return ZERO_BN;
        if (balancesType === 'farm')
          return (
            (_balances as TokenBalanceMode['farm'])?.[getTokenIndex(token)]?.[
              balanceFromInternal
            ] || ZERO_BN
          );
        return (
          (_balances as TokenBalanceMode['silo-deposits'])?.[
            getTokenIndex(token)
          ]?.deposited?.amount || ZERO_BN
        );
      },
      [_balances, balancesType, balanceFromInternal]
    );

    // Toggle the selection state of a token.
    const toggle = useCallback(
      (token: TokenInstance) => {
        const copy = new Set(selectedInternal);
        if (selectedInternal.has(token)) {
          copy.delete(token);
          setSelectedInternal(copy);
        } else {
          copy.add(token);
          setSelectedInternal(copy);
        }
      },
      [selectedInternal]
    );

    // ETH can only be used from EXTERNAL balance
    const filteredTokenList = useMemo(() => {
      if (balanceFromInternal === BalanceFrom.INTERNAL) {
        return tokenList.filter((tk) => tk !== Eth);
      }
      return tokenList;
    }, [Eth, balanceFromInternal, tokenList]);

    // Whenever the Dialog opens, store a temporary copy of the currently
    // selected tokens so we can manipulate them quickly here without
    // affecting the form state. User needs to "confirm" the change.
    useEffect(() => {
      if (open) {
        console.debug('[TokenSelectDialog] resetting _selected');
        setSelectedInternal(new Set(selected.map(({ token }) => token)));
        setBalanceFromInternal(balanceFrom);
      } else {
        setSelectedInternal(new Set());
        setBalanceFromInternal(BalanceFrom.TOTAL);
      }
    }, [open, selected, balanceFrom]);

    // Set balanceFrom before closing the dialog.
    const setBalanceFromAndClose = useCallback(() => {
      if (setBalanceFrom) {
        setBalanceFrom(balanceFromInternal);
      }
      handleClose(); // hide dialog
    }, [handleClose, setBalanceFrom, balanceFromInternal]);

    // Submit the newSelection and close the dialog.
    // Accepts a param _newSelection instead of using
    // the newSelection state variable so the handler can
    // be reused with onClickItem.
    const onClickSubmit = useCallback(
      (_newSelection: Set<TokenInstance>) => () => {
        handleSubmit(_newSelection); // update form state
        setBalanceFromAndClose();
      },
      [handleSubmit, setBalanceFromAndClose]
    );

    // Click an item in the token list.
    const onClickItem = useCallback(
      (_token: TokenInstance) => {
        if (mode === TokenSelectMode.MULTI) return () => toggle(_token);
        return onClickSubmit(new Set([_token])); // submit just this token
      },
      [mode, onClickSubmit, toggle]
    );

    if (!selectedInternal) return null;

    return (
      <StyledDialog
        onClose={setBalanceFromAndClose}
        aria-labelledby="customized-dialog-title"
        open={open}
        transitionDuration={0}
        TransitionProps={{}}
      >
        <StyledDialogTitle
          id="customized-dialog-title"
          onClose={setBalanceFromAndClose}
          sx={{ pb: 0.5 }}
        >
          {title ||
            (mode === TokenSelectMode.MULTI ? 'Select Tokens' : 'Select Token')}
        </StyledDialogTitle>
        <StyledDialogContent
          sx={{ pb: mode === TokenSelectMode.MULTI ? 0 : 1, pt: 0 }}
        >
          {/**
           * Balance From
           */}
          {setBalanceFrom ? (
            <Stack pt={1.5} pb={2}>
              <BalanceFromRow
                balanceFrom={balanceFromInternal}
                setBalanceFrom={setBalanceFromInternal}
                customOptions={balanceFromOptions}
              />
              <Box
                pt={2}
                sx={{
                  borderBottom: '0.5px solid',
                  borderColor: 'text.light',
                  width: '100%',
                }}
              />
            </Stack>
          ) : null}
          {/**
           * Tokens
           */}
          <List sx={{ p: 0 }}>
            {filteredTokenList
              ? filteredTokenList.map((_token) => {
                  const tokenBalance = getBalance(_token);
                  return (
                    <ListItem
                      key={_token.address}
                      color="primary"
                      // selected={selectedInternal.has(_token)}
                      disablePadding
                      onClick={onClickItem(_token)}
                      sx={{
                        // ListItem is used elsewhere so we define here
                        // instead of in muiTheme.ts
                        '& .MuiListItemText-primary': {
                          fontSize: FontSize['1xl'],
                          lineHeight: '1.875rem',
                        },
                        '& .MuiListItemText-secondary': {
                          fontSize: FontSize.base,
                          lineHeight: '1.25rem',
                          color: BeanstalkPalette.lightGrey,
                        },
                      }}
                    >
                      <ListItemButton
                        disableRipple
                        selected={selectedInternal.has(_token)}
                      >
                        {/* Top-level button stack */}
                        <Row
                          justifyContent="space-between"
                          sx={{ width: '100%' }}
                        >
                          {/* Icon & text left side */}
                          <Row justifyContent="center" gap={0}>
                            <ListItemIcon>
                              <img
                                src={_token.logo}
                                alt=""
                                css={{
                                  width: IconSize.tokenSelect,
                                  height: IconSize.tokenSelect,
                                }}
                              />
                            </ListItemIcon>
                            <ListItemText
                              primary={_token.symbol}
                              secondary={_token.name}
                              sx={{ my: 0 }}
                            />
                          </Row>
                          {/* Balances right side */}
                          {_balances ? (
                            <Typography variant="bodyLarge">
                              {/* Token balance */}
                              {displayBN(tokenBalance)}
                              {/* additionally applied balance */}
                            </Typography>
                          ) : null}
                        </Row>
                      </ListItemButton>
                    </ListItem>
                  );
                })
              : null}
            {/**
             * Farm + Circulating Balances notification
             */}
            {_balances ? (
              <Typography
                ml={1}
                pt={0.5}
                textAlign="center"
                fontSize={FontSize.sm}
                color="gray"
              >
                {balanceFromText[balanceFrom]}&nbsp;
                <Link
                  href="https://docs.bean.money/almanac/protocol/asset-states"
                  target="_blank"
                  rel="noreferrer"
                  underline="none"
                >
                  Learn more &rarr;
                </Link>
              </Typography>
            ) : null}
          </List>
        </StyledDialogContent>
        {mode === TokenSelectMode.MULTI && (
          <StyledDialogActions sx={{ pb: 2 }}>
            <Button
              onClick={onClickSubmit(selectedInternal)}
              disabled={selectedInternal.size === 0}
              variant="outlined"
              fullWidth
              color="primary"
              size="large"
            >
              {selectedInternal.size === 0
                ? 'Select Token to Continue'
                : `Select ${selectedInternal.size} Token${
                    selectedInternal.size === 1 ? '' : 's'
                  }`}
            </Button>
          </StyledDialogActions>
        )}
      </StyledDialog>
    );
  }
);

export default TokenSelectDialog;
