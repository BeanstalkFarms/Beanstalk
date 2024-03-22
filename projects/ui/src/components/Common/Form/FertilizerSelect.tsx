import React, { ReactElement, useCallback, useState } from 'react';
import {
  ListItemIcon,
  ListItemText,
  List,
  Box,
  useMediaQuery,
  TextField,
  Button,
} from '@mui/material';
import { FC } from '~/types';
import { FontSize, IconSize } from '~/components/App/muiTheme';
import { displayBN } from '~/util';
import sproutIcon from '~/img/beanstalk/sprout-icon.svg';
import fertActiveIcon from '~/img/tokens/fert-logo-active.svg';
import fertUsedIcon from '~/img//tokens/fert-logo-used.svg';
import Row from '~/components/Common/Row';
import { FullFertilizerBalance } from '~/components/Barn/Actions/Transfer';
import { useFormikContext } from 'formik';
import SelectionItem from '../SelectionItem';

export interface PlotSelectProps {
  /** A farmer's fertilizers */
  fertilizers: FullFertilizerBalance[];
}

interface IRowContent {
  isMobile: boolean | null;
  fertilizer: FullFertilizerBalance;
  index: number;
  values: any;
  setFieldValue: any;
  focused: number | null | undefined;
}

function RowContent({isMobile, fertilizer, index, values, setFieldValue, focused }: IRowContent): ReactElement {

  const textFieldStyles = {
    borderRadius: 1,
    '& .MuiOutlinedInput-root': {
      background: 'white',
    },
  } as const;

  // Internal State
  const [displayValue, setDisplayValue] = useState(values.amounts[index]);
  const [focusWithin, setFocusWithin] = useState(false);

  // Ignore scroll events on the input. Prevents
  // accidentally scrolling up/down the number input.
  const preventScroll = useCallback((e: any) => {
    // @ts-ignore
    e.target.blur();
  }, []);

  const preventNegativeInput = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === '-') {
      e.preventDefault();
    }
  };

  const handleInput = useCallback((e: any) => {

    const newIds = values.fertilizerIds;
    const newAmounts = values.amounts;

    if (e.target.value && e.target.value !== newAmounts[index]) {
      const roundedValue = Math.round(e.target.value);
      if (roundedValue === 0) {
        newIds[index] = undefined;
        newAmounts[index] = undefined;
        setDisplayValue(undefined);
      } else if (roundedValue > fertilizer.amount.toNumber()) {
        newIds[index] = fertilizer.token.id.toNumber();
        newAmounts[index] = fertilizer.amount.toNumber();
        setDisplayValue(fertilizer.amount.toNumber());
      } else {
        newIds[index] = fertilizer.token.id.toNumber();
        newAmounts[index] = roundedValue;
        setDisplayValue(roundedValue);
      };
    } else {
      newIds[index] = undefined;
      newAmounts[index] = undefined;
      setDisplayValue(undefined);
    };

    const newTotalSelected = newIds.filter(Boolean).length;

    setFieldValue('fertilizerIds', newIds);
    setFieldValue('amounts', newAmounts);
    setFieldValue('totalSelected', newTotalSelected);

  }, [index, setFieldValue, values.amounts, fertilizer.amount, values.fertilizerIds, fertilizer.token.id]);

  const clearInput = useCallback(() => {

    const newIds = values.fertilizerIds;
    const newAmounts = values.amounts;
    newIds[index] = undefined;
    newAmounts[index] = undefined;
    setDisplayValue(undefined);

    const newTotalSelected = newIds.filter(Boolean).length;
    setFieldValue('fertilizerIds', newIds);
    setFieldValue('amounts', newAmounts);
    setFieldValue('totalSelected', newTotalSelected);
    
  }, [index, values.amounts, values.fertilizerIds, setFieldValue])

  return (
    <>
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
          value={displayValue || ''}
          onWheel={preventScroll}
          onChange={handleInput}
          onKeyDown={preventNegativeInput}
          size="small"
          inputRef={inputRef => inputRef && focused === index && !focusWithin && inputRef.focus()}
          onFocus={() => setFocusWithin(true)}
          onBlur={() => setFocusWithin(false)}
          sx={{ ...textFieldStyles, width: isMobile ? 105 : 190 }}
          InputProps={{
            endAdornment: 
              <Button
                color='primary'
                size='small'
                onClick={clearInput}
                sx={{
                  minWidth: 28,
                  maxWidth: 28,
                  fontSize: 20,
                  scale: '65%',
                  marginRight: -1,
                  borderRadius: '50%',
                  alignSelf: 'center',
                }}
              >
                ✖
              </Button>,
          }}
        />
      </Row>
    </>
  );
}

const FertilizerSelect: FC<PlotSelectProps> = ({
  fertilizers,
}) => {
  const isMobile = useMediaQuery('(max-width: 500px)');

  /// Form state
  const { values, setFieldValue } = useFormikContext<{
    /// These fields are required in the parent's Formik state
    fertilizerIds: any[];
    amounts: any[];
  }>();

  /// Internal state
  const [isFocused, setIsFocused] = useState<number | null>();

  if (!fertilizers) return null;

  const items = fertilizers.map((fertilizer, index) => {
    
    const thisFert = {
      id: fertilizer.token.id.toNumber(),
      amount: fertilizer.amount.toNumber(),
      index: index,
    };

    let isSelected = false;
    if (values.fertilizerIds) {
      for (let i = 0; i < values.fertilizerIds?.length; i += 1) {
        if (values.fertilizerIds[i] === thisFert.id) {
          isSelected = true;
          break;
        };
      };
    };
    
    return (
      <SelectionItem
        selected={isSelected}
        checkIcon="left"
        onClick={() => setIsFocused(index)}
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
            index={index}
            values={values}
            setFieldValue={setFieldValue}
            focused={isFocused}
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
