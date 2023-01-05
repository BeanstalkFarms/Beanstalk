import React, { useCallback, useEffect, useState } from 'react';

import { Button, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, Link } from '@mui/material';
import { StyledDialog, StyledDialogActions, StyledDialogContent, StyledDialogTitle } from '~/components/Common/Dialog';
import Token from '~/classes/Token';
import { displayBN } from '~/util';
import { ZERO_BN } from '~/constants';
import { FarmerBalances } from '~/state/farmer/balances';
import { FarmerSilo } from '~/state/farmer/silo';
import { BeanstalkPalette, FontSize, IconSize } from '../../App/muiTheme';
import Row from '~/components/Common/Row';

export enum TokenSelectMode { MULTI, SINGLE }

export type TokenBalanceMode = {
  'farm': FarmerBalances;
  'silo-deposits': FarmerSilo['balances'];
}

export type TokenSelectDialogProps<K extends keyof TokenBalanceMode> = {
  /** Show the dialog. */
  open: boolean;
  /** Close the dialog. */
  handleClose: () => void;
  /** The list of selected Tokens when the User opens the dialog. Updated on submit. */
  selected: ({ token: Token } & any)[];
  /** Called when the user "submits" their changes to selected tokens. */
  handleSubmit: (s: Set<Token>) => void;

  /** Override the dialog title */
  title?: string | JSX.Element;
  /** */
  description?: string | JSX.Element;

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
  tokenList: Token[];
  /** Single or multi-select */
  mode?: TokenSelectMode;
}

type TokenSelectDialogC = React.FC<TokenSelectDialogProps<keyof TokenBalanceMode>>;

const TokenSelectDialog : TokenSelectDialogC = React.memo(({
  // Dialog
  open,
  handleClose,
  selected,
  handleSubmit,
  title,
  description,
  // Balances
  balancesType = 'farm',
  balances: _balances,
  // Tokens
  tokenList,
  mode = TokenSelectMode.MULTI,
}) => {
  /** keep an internal copy of selected tokens */
  const [selectedInternal, setSelectedInternal] = useState<Set<Token>>(new Set<Token>());

  const getBalance = useCallback((addr: string) => {
    if (!_balances) return ZERO_BN;
    if (balancesType === 'farm') return (_balances as TokenBalanceMode['farm'])?.[addr]?.total || ZERO_BN;
    return (_balances as TokenBalanceMode['silo-deposits'])?.[addr]?.deposited?.amount || ZERO_BN;
  }, [_balances, balancesType]);

  // Toggle the selection state of a token.
  const toggle = useCallback((token: Token) => {
    const copy = new Set(selectedInternal);
    if (selectedInternal.has(token)) {
      copy.delete(token);
      setSelectedInternal(copy);
    } else {
      copy.add(token);
      setSelectedInternal(copy);
    }
  }, [selectedInternal]);

  // Whenever the Dialog opens, store a temporary copy of the currently
  // selected tokens so we can manipulate them quickly here without
  // affecting the form state. User needs to "confirm" the change.
  useEffect(() => {
    if (open) {
      console.debug('[TokenSelectDialog] resetting _selected');
      setSelectedInternal(
        new Set(selected.map(({ token }) => token))
      );
    } else {
      setSelectedInternal(new Set());
    }
  }, [open, selected]);

  // Submit the newSelection and close the dialog.
  // Accepts a param _newSelection instead of using
  // the newSelection state variable so the handler can
  // be reused with onClickItem.
  const onClickSubmit = useCallback((_newSelection: Set<Token>) => () => {
    handleSubmit(_newSelection); // update form state
    handleClose();               // hide dialog
  }, [handleSubmit, handleClose]);

  // Click an item in the token list.
  const onClickItem = useCallback((_token: Token) => {
    if (mode === TokenSelectMode.MULTI) return () => toggle(_token);
    return onClickSubmit(new Set([_token])); // submit just this token
  }, [mode, onClickSubmit, toggle]);

  if (!selectedInternal) return null;

  return (
    <StyledDialog
      onClose={handleClose}
      aria-labelledby="customized-dialog-title"
      open={open}
      transitionDuration={0}
      TransitionProps={{}}
    >
      <StyledDialogTitle id="customized-dialog-title" onClose={handleClose} sx={{ pb: 0.5 }}>
        {title || (mode === TokenSelectMode.MULTI 
            ? 'Select Tokens'
            : 'Select Token')}
      </StyledDialogTitle>
      <StyledDialogContent sx={{ pb: mode === TokenSelectMode.MULTI ? 0 : 1, pt: 0 }}>
        {/**
          * Tokens
          */}
        <List sx={{ p: 0 }}>
          {tokenList ? tokenList.map((_token) => (
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
                  lineHeight: '1.875rem'
                },
                '& .MuiListItemText-secondary': {
                  fontSize: FontSize.base,
                  lineHeight: '1.25rem',
                  color: BeanstalkPalette.lightGrey
                }
              }}
            >
              <ListItemButton disableRipple selected={selectedInternal.has(_token)}>
                {/* Top-level button stack */}
                <Row justifyContent="space-between" sx={{ width: '100%' }}>
                  {/* Icon & text left side */}
                  <Row justifyContent="center" gap={0}>
                    <ListItemIcon>
                      <img
                        src={_token.logo}
                        alt=""
                        css={{ 
                          width: IconSize.tokenSelect,
                          height: IconSize.tokenSelect
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
                      {displayBN(getBalance(_token.address))}
                    </Typography>
                  ) : null}
                </Row>
              </ListItemButton>
            </ListItem>
          )) : null}
          {/**
            * Farm + Circulating Balances notification
            */}
          {_balances ? (
            <Typography ml={1} pt={0.5} textAlign="center" fontSize={FontSize.sm} color="gray">
              Displaying total Farm and Circulating balances.&nbsp;
              <Link href="https://docs.bean.money/almanac/protocol/asset-states" target="_blank" rel="noreferrer" underline="none">
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
              : `Select ${selectedInternal.size} Token${selectedInternal.size === 1 ? '' : 's'}`}
          </Button>
        </StyledDialogActions>
      )}
    </StyledDialog>
  );
});

export default TokenSelectDialog;
