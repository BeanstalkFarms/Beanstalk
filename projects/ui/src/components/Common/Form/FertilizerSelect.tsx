import React, { ReactElement, useCallback } from 'react';
import {
  ListItemIcon,
  ListItemText,
  List,
  Box,
  TextField,
} from '@mui/material';
import { FC } from '~/types';
import { FontSize, IconSize } from '~/components/App/muiTheme';
import { displayBN } from '~/util';
import sproutIcon from '~/img/beanstalk/sprout-icon.svg';
import fertActiveIcon from '~/img/tokens/fert-logo-active.svg';
import fertUsedIcon from '~/img//tokens/fert-logo-used.svg';
import humidityIcon from '~/img/beanstalk/humidity-icon.svg';
import Row from '~/components/Common/Row';
import { FullFertilizerBalance } from '~/components/Barn/Actions/Transfer';
import { useFormikContext } from 'formik';
import SelectionItem from '../SelectionItem';

export interface FertilizerSelectProps {
  /** A farmer's fertilizers */
  fertilizers: FullFertilizerBalance[];
  /** If true, switch to small screen layout */
  isMobile: boolean;
}

interface FertilizerTransferFormContext {
  fertilizerIds: (number | undefined)[];
  amounts: (number | undefined)[];
}

interface IRowContent {
  isMobile: boolean | null;
  fertilizer: FullFertilizerBalance;
  index: number;
  values: FertilizerTransferFormContext;
  setFieldValue: any;
}

function RowContent({
  isMobile,
  fertilizer,
  index,
  values,
  setFieldValue,
}: IRowContent): ReactElement {
  const textFieldStyles = {
    borderRadius: 1,
    '& .MuiOutlinedInput-root': {
      background: 'white',
    },
  } as const;

  // Ignore scroll events on the input. Prevents
  // accidentally scrolling up/down the number input.
  const preventScroll = useCallback((e: any) => {
    // @ts-ignore
    e.target.blur();
  }, []);

  const preventNegativeInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '-') {
      e.preventDefault();
    }
  };

  const handleInput = useCallback(
    (e: any) => {
      const newIds = values.fertilizerIds;
      const newAmounts = values.amounts;

      if (e.target.value && e.target.value !== newAmounts[index]) {
        const roundedValue = Math.round(e.target.value);
        if (roundedValue === 0) {
          newIds[index] = undefined;
          newAmounts[index] = undefined;
        } else if (roundedValue > fertilizer.amount.toNumber()) {
          newIds[index] = fertilizer.token.id.toNumber();
          newAmounts[index] = fertilizer.amount.toNumber();
        } else {
          newIds[index] = fertilizer.token.id.toNumber();
          newAmounts[index] = roundedValue;
        }
      } else {
        newIds[index] = undefined;
        newAmounts[index] = undefined;
      }

      const newTotalSelected = newIds.filter(Boolean).length;

      setFieldValue('fertilizerIds', newIds);
      setFieldValue('amounts', newAmounts);
      setFieldValue('totalSelected', newTotalSelected);
    },
    [
      index,
      setFieldValue,
      values.amounts,
      fertilizer.amount,
      values.fertilizerIds,
      fertilizer.token.id,
    ]
  );

  const handleClick = (e: any) => {
    e.stopPropagation();
  };

  return (
    <>
      <Row justifyContent="space-between" sx={{ width: '100%' }}>
        <Row justifyContent="center">
          <ListItemIcon sx={{ pr: 1 }}>
            <Box
              component="img"
              src={
                fertilizer.status === 'active' ? fertActiveIcon : fertUsedIcon
              }
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
                <Box
                  sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}
                >
                  {isMobile ? (
                    <Box
                      component="img"
                      src={sproutIcon}
                      alt=""
                      sx={{
                        width: IconSize.xs,
                        height: IconSize.xs,
                      }}
                    />
                  ) : (
                    'Sprouts: '
                  )}
                  {displayBN(fertilizer.sprouts)}
                </Box>
                {!isMobile ? <>·</> : null}
                <Box
                  sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}
                >
                  {isMobile ? (
                    <Box
                      component="img"
                      src={humidityIcon}
                      alt=""
                      sx={{
                        width: IconSize.xs,
                        height: IconSize.xs,
                      }}
                    />
                  ) : (
                    'Humidity: '
                  )}
                  {`${Number(fertilizer.token.humidity)}%`}
                </Box>
              </>
            }
            secondaryTypographyProps={{
              display: 'flex',
              marginTop: isMobile ? -0.5 : 0,
              gap: isMobile ? 0 : 1,
              flexDirection: isMobile ? 'column' : 'row',
            }}
            sx={{ my: 0 }}
          />
        </Row>
        <TextField
          type="number"
          color="primary"
          placeholder={isMobile ? 'Amount' : 'Amount to Transfer'}
          value={values.amounts[index] || ''}
          onWheel={preventScroll}
          onChange={handleInput}
          onKeyDown={preventNegativeInput}
          onClick={handleClick}
          size="small"
          sx={{ ...textFieldStyles, width: isMobile ? 85 : 160 }}
        />
      </Row>
    </>
  );
}

const FertilizerSelect: FC<FertilizerSelectProps> = ({
  fertilizers,
  isMobile,
}) => {
  /// Form state
  const { values, setFieldValue } =
    useFormikContext<FertilizerTransferFormContext>();

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
        }
      }
    }

    function toggleFertilizer() {
      const newIds = values.fertilizerIds;
      const newAmounts = values.amounts;
      let newTotalSelected = values.fertilizerIds.filter(Boolean).length;
      if (isSelected) {
        newIds[index] = undefined;
        newAmounts[index] = undefined;
      } else {
        newIds[index] = fertilizer.token.id.toNumber();
        newAmounts[index] = fertilizer.amount.toNumber();
      }
      newTotalSelected = newIds.filter(Boolean).length;
      setFieldValue('fertilizerIds', newIds);
      setFieldValue('amounts', newAmounts);
      setFieldValue('totalSelected', newTotalSelected);
    }

    return (
      <SelectionItem
        selected={isSelected}
        checkIcon="left"
        onClick={() => toggleFertilizer()}
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
          '&:last-child': { mb: 0 },
        }}
      >
        <RowContent
          isMobile={isMobile}
          fertilizer={fertilizer}
          index={index}
          values={values}
          setFieldValue={setFieldValue}
        />
      </SelectionItem>
    );
  });

  return <List sx={{ p: 0 }}>{items}</List>;
};

export default FertilizerSelect;
