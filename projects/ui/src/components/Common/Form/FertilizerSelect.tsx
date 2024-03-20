import React, { ReactElement, useCallback } from 'react';
import {
  ListItemIcon,
  ListItemText,
  List,
  Box,
  useMediaQuery,
  TextField,
} from '@mui/material';
import { FC } from '~/types';
import { FontSize, IconSize } from '~/components/App/muiTheme';
import { displayBN } from '~/util';
import sproutIcon from '~/img/beanstalk/sprout-icon.svg';
import fertActiveIcon from '~/img/tokens/fert-logo-active.svg';
import fertUsedIcon from '~/img//tokens/fert-logo-used.svg';
import Row from '~/components/Common/Row';
import { FullFertilizerBalance } from '~/components/Barn/Actions/Transfer';
import SelectionItem from '../SelectionItem';

export interface PlotSelectProps {
  /** A farmer's fertilizers */
  fertilizers: FullFertilizerBalance[];
  /** Custom function to set the selected plot index */
  handleSelect: any;
  /** List of selected fertilizers */
  selected?: any[];
}

interface IRowContent {
  isMobile: boolean | null;
  fertilizer: FullFertilizerBalance;
}

function RowContent({isMobile, fertilizer}: IRowContent): ReactElement {

  const textFieldStyles = {
    borderRadius: 1,
    '& .MuiOutlinedInput-root': {
      background: 'white',
    },
  } as const;

  // Ignore scroll events on the input. Prevents
  // accidentally scrolling up/down the number input.
  const handleWheel = useCallback((e: any) => {
    // @ts-ignore
    e.target.blur();
  }, []);

  return (
    <Row justifyContent="space-between" sx={{ width: '100%' }}>
    <Row justifyContent="center">
      <ListItemIcon sx={{ pr: 1 }}>
        <Box
          component="img"
          src={fertilizer.status === "active" ? fertActiveIcon : fertUsedIcon}
          alt=""
          sx={{
            width: IconSize.tokenSelect,
            height: IconSize.tokenSelect,
          }}
        />
      </ListItemIcon>
      <ListItemText
        primary={`${isMobile ? 'x' : ''}${displayBN(fertilizer.amount)} ${!isMobile ? 'FERTILIZER' : ''}`}
        primaryTypographyProps={{ color: 'text.primary', display: 'flex' }}
        secondary={
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
              {isMobile ? 
                <Box
                  component="img"
                  src={sproutIcon}
                  alt=""
                  sx={{
                    width: IconSize.xs,
                    height: IconSize.xs,
                  }}
                /> 
                : 'Sprouts: '}
              {displayBN(fertilizer.sprouts)}
            </Box>
          </>
        }
        secondaryTypographyProps={{ display: 'flex', gap: 1}}
        sx={{ my: 0 }}
      />
    </Row>
    <TextField
      type="number"
      color="primary"
      placeholder={isMobile ? "Amount" :  "Amount to Transfer"}
      value={fertilizer.amount.toNumber()}
      onWheel={handleWheel}
      size="small"
      sx={{ ...textFieldStyles, width: isMobile ? 84 : 160 }}
    />
  </Row>
  );
}

const FertilizerSelect: FC<PlotSelectProps> = ({
  fertilizers,
  handleSelect,
  selected,
}) => {
  const isMobile = useMediaQuery('(max-width: 500px)');
  if (!fertilizers) return null;
  ///
  const items = fertilizers.map((fertilizer) => {
    
    const thisFert = {
      id: fertilizer.token.id.toNumber(),
      amount: fertilizer.amount.toNumber(),
    };

    let isSelected = false;
    if (selected) {
      for (let i = 0; i < selected?.length; i += 1) {
        if (selected[i] === thisFert.id) {
          isSelected = true;
          break
        }
      }
    }
    
    return (
      <SelectionItem
        selected={isSelected}
        checkIcon="left"
        onClick={() => handleSelect(thisFert)}
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
            // color: BeanstalkPalette.lightGrey
          },
          mb: 1,
          '&:last-child': {mb: 0}
        }}
        >
          <RowContent
            isMobile={isMobile}
            fertilizer={fertilizer}
          />
      </SelectionItem>
    );
  });

  return (
    <List sx={{ p: 0 }}>
      {items}
    </List>
  );
};

export default FertilizerSelect;
