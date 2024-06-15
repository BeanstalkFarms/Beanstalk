import React, { useCallback, useState } from 'react';
import {
  Box,
  Stack,
  Popper,
  Grow,
  Button,
  TextField,
  Typography,
  IconButton,
  Divider,
  InputAdornment,
  Drawer,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import DateRangeOutlinedIcon from '@mui/icons-material/DateRangeOutlined';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { ClickAwayListener } from '@mui/base';
import { FC } from '~/types';
import { DateRange, DayPicker } from 'react-day-picker';
import { BeanstalkPalette } from '~/components/App/muiTheme';
import {
  format,
  isValid,
  parse,
  set,
  setHours,
  startOfYear,
  subHours,
  subMonths,
  subWeeks,
  subYears,
} from 'date-fns';
import CloseIcon from '@mui/icons-material/Close';

type CalendarProps = {
  setTimePeriod: React.Dispatch<
    React.SetStateAction<{
      from: Date | undefined;
      to: Date | undefined;
    }>
  >;
};

type CalendarContentProps = {
  handleHideMenu: () => void;
  isMobile: boolean;
  range: DateRange | undefined;
  selectedPreset: string;
  setPreset: React.Dispatch<React.SetStateAction<string>>;
  handleRangeChange: (newRange: DateRange | undefined) => void;
  handlePresetSelect: (
    _preset: string,
    selectedRange: DateRange | undefined
  ) => void;
};

const presetRanges: {
  key: string;
  from: Date | undefined;
  to: Date | undefined;
}[] = [
  {
    key: '1D',
    from: subHours(new Date(), 24),
    to: new Date(),
  },
  {
    key: '1W',
    from: subWeeks(new Date(), 1),
    to: new Date(),
  },
  {
    key: '1M',
    from: subMonths(new Date(), 1),
    to: new Date(),
  },
  {
    key: '3M',
    from: subMonths(new Date(), 3),
    to: new Date(),
  },
  {
    key: '6M',
    from: subMonths(new Date(), 6),
    to: new Date(),
  },
  {
    key: 'YTD',
    from: startOfYear(new Date()),
    to: new Date(),
  },
  {
    key: '1Y',
    from: subYears(new Date(), 1),
    to: new Date(),
  },
  {
    key: '2Y',
    from: subYears(new Date(), 2),
    to: new Date(),
  },
  {
    key: 'ALL',
    from: undefined,
    to: undefined,
  },
];

const initialRange: DateRange = {
  from: undefined,
  to: undefined,
};

const CalendarContent: FC<CalendarContentProps> = ({
  handleHideMenu,
  isMobile,
  range,
  selectedPreset,
  handleRangeChange,
  handlePresetSelect,
  setPreset,
}) => {
  const [month, setMonth] = useState(new Date());

  const [inputValue, setInputValue] = useState<{
    from: string | undefined;
    to: string | undefined;
  }>({ from: '', to: '' });
  const [inputTime, setInputTime] = useState<{
    from: string | undefined;
    to: string | undefined;
  }>({ from: '', to: '' });

  const handleDayPickerSelect = (date: DateRange | undefined) => {
    if (!date) {
      setInputValue({ from: undefined, to: undefined });
      setPreset('ALL');
      handleRangeChange(initialRange);
    } else {
      const fromHour = inputTime.from
        ? parse(inputTime.from, 'HH', new Date()).getHours()
        : undefined;
      const toHour = inputTime.to
        ? parse(inputTime.to, 'HH', new Date()).getHours()
        : undefined;
      const adjustedDate = {
        from: date.from
          ? set(date.from, { hours: Number(fromHour || 0), minutes: 5 })
          : undefined,
        to: date.to
          ? set(date.to, { hours: Number(toHour || 0), minutes: 5 })
          : undefined,
      };
      handleRangeChange(adjustedDate);
      setPreset('CUSTOM');
      setInputValue({
        from: adjustedDate.from
          ? format(adjustedDate.from, 'MM/dd/yyyy')
          : undefined,
        to: adjustedDate.to ? format(adjustedDate.to, 'MM/dd/yyyy') : undefined,
      });
    }
  };

  const handleInputChange = (type: string, target: string, value: string) => {
    if (type === 'date') {
      const currentValue = inputValue;
      const currentTime = inputTime;

      setInputValue({
        from: target === 'from' ? value : currentValue.from,
        to: target === 'to' ? value : currentValue.to,
      });

      let customHour = 0;
      if (target === 'from' && currentTime.from) {
        customHour = parse(currentTime.from, 'HH', new Date()).getHours();
      } else if (target === 'to' && currentTime.to) {
        customHour = parse(currentTime.to, 'HH', new Date()).getHours();
      }

      const parsedDate = set(parse(value, 'MM/dd/yyyy', new Date()), {
        hours: customHour,
        minutes: 5,
      });

      if (isValid(parsedDate)) {
        handleRangeChange({
          from: target === 'from' ? parsedDate : range?.from,
          to: target === 'to' ? parsedDate : range?.to,
        });
        setPreset('CUSTOM');
        setMonth(parsedDate);
      } else {
        handleRangeChange({
          from: undefined,
          to: undefined,
        });
        setPreset('ALL');
      }
    } else if (type === 'time') {
      const currentValue = inputTime;

      setInputTime({
        from: target === 'from' ? value : currentValue.from,
        to: target === 'to' ? value : currentValue.to,
      });

      const parsedTime = parse(value, 'HH', new Date());

      if (isValid(parsedTime)) {
        const newHour = parsedTime.getHours();
        const newTime = {
          from:
            target === 'from' && range?.from
              ? setHours(range.from, newHour)
              : range?.from,
          to:
            target === 'to' && range?.to
              ? setHours(range?.to, newHour)
              : range?.to,
        };
        handleRangeChange(newTime);
      }
    }
  };

  const formatInputTimeOnBlur = (target: string, value: string) => {
    const currentValue = inputTime;
    const parsedInput = parse(value, 'HH', new Date());
    if (isValid(parsedInput)) {
      const newFrom =
        target === 'from' ? format(parsedInput, 'HH:mm') : currentValue.from;
      const newTo =
        target === 'to' ? format(parsedInput, 'HH:mm') : currentValue.to;
      setInputTime({
        from: newFrom,
        to: newTo,
      });
    }
  };

  return (
    <Stack>
      <Box
        display="flex"
        justifyContent="space-between"
        paddingX="16px"
        paddingTop="16px"
      >
        <Typography fontWeight={700}>Custom Date Range</Typography>
        <IconButton
          aria-label="close"
          onClick={handleHideMenu}
          disableRipple
          sx={{
            p: 0,
          }}
        >
          <CloseIcon sx={{ fontSize: 20, color: 'text.primary' }} />
        </IconButton>
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          marginTop: 1.6,
          gap: 0.8,
        }}
      >
        {['from', 'to'].map((inputType) => (
          <Box
            display="flex"
            paddingX={1.6}
            maxWidth={isMobile ? undefined : 310}
            gap={0.8}
          >
            <TextField
              sx={{
                display: isMobile ? 'flex' : undefined,
                flexGrow: isMobile ? 1 : undefined,
                width: isMobile ? undefined : 160,
                '& .MuiOutlinedInput-root': {
                  height: 32,
                  borderRadius: 0.6,
                },
              }}
              value={inputValue[inputType as keyof typeof inputValue]}
              placeholder="MM/DD/YYYY"
              size="small"
              color="primary"
              onChange={(e) => {
                handleInputChange('date', inputType, e.target.value);
              }}
            />
            <TextField
              sx={{
                width: isMobile ? 140 : 120,
                '& .MuiOutlinedInput-root': {
                  height: 32,
                  borderRadius: 0.6,
                },
              }}
              value={inputTime[inputType as keyof typeof inputTime]}
              placeholder="03:00"
              size="small"
              color="primary"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end" sx={{ ml: 0, mr: -0.5 }}>
                    <AccessTimeIcon sx={{ scale: '80%' }} />
                  </InputAdornment>
                ),
              }}
              onChange={(e) => {
                handleInputChange('time', inputType, e.target.value);
              }}
              onBlur={(e) => {
                formatInputTimeOnBlur(inputType, e.target.value);
              }}
            />
          </Box>
        ))}
      </Box>
      <Divider
        sx={{
          borderTop: 0.5,
          borderBottom: 0,
          marginTop: '16px',
          borderColor: 'divider',
        }}
      />
      <Box display="flex" flexDirection="row">
        <DayPicker
          mode="range"
          showOutsideDays
          selected={range}
          onSelect={handleDayPickerSelect}
          month={month}
          onMonthChange={setMonth}
          fixedWeeks
          styles={{
            caption: {
              display: 'flex',
              position: 'relative',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: '10px',
            },
            nav: {
              display: 'flex',
              alignItems: 'center',
            },
            nav_button_previous: {
              position: 'absolute',
              left: '0',
              borderRadius: '8px',
              width: '30px',
              height: '30px',
            },
            nav_button_next: {
              position: 'absolute',
              right: '0',
              borderRadius: '8px',
              width: '30px',
              height: '30px',
            },
            head_row: {
              display: 'none',
            },
            table: {
              display: 'flex',
              justifyContent: 'center',
            },
            tbody: {
              marginLeft: '2px',
            },
            day: {
              borderRadius: '4px',
              backgroundColor: BeanstalkPalette.white,
              height: '36px',
              width: '36px',
              transitionProperty:
                'color, background-color, border-color, text-decoration-color, fill, stroke',
              transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
              transitionDuration: '150ms',
            },
          }}
          modifiersStyles={{
            today: {
              fontWeight: 'normal',
            },
            selected: {
              fontWeight: 'bold',
              backgroundColor: BeanstalkPalette.theme.spring.beanstalkGreen,
              color: BeanstalkPalette.white,
            },
            range_start: {
              fontWeight: 'bold',
              backgroundColor: BeanstalkPalette.theme.spring.beanstalkGreen,
              color: BeanstalkPalette.white,
            },
            range_middle: {
              fontWeight: 'bold',
              backgroundColor: BeanstalkPalette.theme.spring.beanstalkGreen,
              color: BeanstalkPalette.white,
            },
            range_end: {
              fontWeight: 'bold',
              backgroundColor: BeanstalkPalette.theme.spring.beanstalkGreen,
              color: BeanstalkPalette.white,
            },
          }}
        />
        {isMobile && (
          <Box
            display="flex"
            flexDirection="column"
            marginTop="16px"
            marginBottom="16px"
            marginRight="16px"
            flexGrow={1}
            justifyContent="space-between"
          >
            {presetRanges.map((preset) => (
              <Button
                key={`timePeriodPreset${preset.key}`}
                variant={
                  selectedPreset === preset.key
                    ? 'contained'
                    : 'outlined-secondary'
                }
                size="small"
                color={selectedPreset === preset.key ? 'primary' : 'secondary'}
                sx={{
                  borderRadius: 0.5,
                  px: 0.3,
                  py: 0.3,
                  mt: -0.3,
                  minWidth: 30,
                  fontWeight: 400,
                }}
                disableRipple
                onClick={() => {
                  handlePresetSelect(preset.key, {
                    from: preset.from,
                    to: preset.to,
                  });
                }}
              >
                {preset.key}
              </Button>
            ))}
          </Box>
        )}
      </Box>
    </Stack>
  );
};

const CalendarButton: FC<CalendarProps> = ({ setTimePeriod }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuVisible = Boolean(anchorEl);

  const handleToggleMenu = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      setAnchorEl(anchorEl ? null : event.currentTarget);
    },
    [anchorEl]
  );

  const handleHideMenu = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const [range, setRange] = useState<DateRange | undefined>(initialRange);

  const [selectedPreset, setPreset] = useState<string>('1W');

  const handleRangeChange = (newRange: DateRange | undefined) => {
    setRange(newRange);
    const newTimePeriod = {
      from: newRange?.from,
      to: newRange?.to,
    };
    setTimePeriod(newTimePeriod);
  };

  const handlePresetSelect = (
    _preset: string,
    selectedRange: DateRange | undefined
  ) => {
    handleRangeChange(selectedRange);
    setPreset(_preset);
  };

  return (
    <ClickAwayListener onClickAway={handleHideMenu}>
      <Box sx={{ display: 'flex' }}>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {!isMobile &&
            presetRanges.map((preset) => (
              <Button
                key={`timePeriodPreset${preset.key}`}
                variant="text"
                size="small"
                color={selectedPreset === preset.key ? 'primary' : 'dark'}
                sx={{
                  borderRadius: 0.5,
                  px: 0.3,
                  py: 0.3,
                  mt: -0.3,
                  minWidth: 30,
                  fontWeight: 400,
                }}
                disableRipple
                onClick={() => {
                  handlePresetSelect(preset.key, {
                    from: preset.from,
                    to: preset.to,
                  });
                }}
              >
                {preset.key}
              </Button>
            ))}
          <Divider
            variant="middle"
            orientation="vertical"
            aria-hidden="true"
            flexItem
            sx={{
              marginTop: '0px',
              marginBottom: '0px',
              height: '25px',
              color: 'divider',
            }}
          />
          <Button
            key="calendarSelect"
            variant="text"
            size="small"
            color={
              selectedPreset === 'CUSTOM' && !isMobile ? 'primary' : 'dark'
            }
            sx={{
              borderRadius: 0.5,
              px: 0.3,
              py: 0.3,
              mt: -0.3,
              minWidth: 0,
            }}
            disableRipple
            onClick={handleToggleMenu}
          >
            <DateRangeOutlinedIcon color="inherit" fontSize="small" />
          </Button>
        </Box>
        {!isMobile ? (
          <Popper
            anchorEl={anchorEl}
            open={menuVisible}
            sx={{ zIndex: 79 }}
            placement="left-start"
            transition
          >
            {({ TransitionProps }) => (
              <Grow
                {...TransitionProps}
                timeout={200}
                style={{ transformOrigin: 'right' }}
              >
                <Box
                  sx={{
                    borderWidth: 2,
                    borderColor: 'divider',
                    borderStyle: 'solid',
                    backgroundColor: 'white',
                    borderRadius: 1,
                    '& .MuiInputBase-root:after, before': {
                      borderColor: 'primary.main',
                    },
                  }}
                >
                  <CalendarContent
                    handleHideMenu={handleHideMenu}
                    isMobile={isMobile}
                    range={range}
                    selectedPreset={selectedPreset}
                    handleRangeChange={handleRangeChange}
                    handlePresetSelect={handlePresetSelect}
                    setPreset={setPreset}
                  />
                </Box>
              </Grow>
            )}
          </Popper>
        ) : (
          <Drawer anchor="bottom" open={menuVisible} onClose={handleHideMenu}>
            <CalendarContent
              handleHideMenu={handleHideMenu}
              isMobile={isMobile}
              range={range}
              selectedPreset={selectedPreset}
              handleRangeChange={handleRangeChange}
              handlePresetSelect={handlePresetSelect}
              setPreset={setPreset}
            />
          </Drawer>
        )}
      </Box>
    </ClickAwayListener>
  );
};

export default CalendarButton;
