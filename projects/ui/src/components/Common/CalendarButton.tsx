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
} from '@mui/material';
import DateRangeOutlinedIcon from '@mui/icons-material/DateRangeOutlined';
import { ClickAwayListener } from '@mui/base';
import { FC } from '~/types';
import { DateRange, DayPicker } from 'react-day-picker';
import { BeanstalkPalette } from '~/components/App/muiTheme';
import { subDays } from 'date-fns';
import CloseIcon from '@mui/icons-material/Close';

const CalendarButton: FC<{}> = ({ children }) => {
  // Menu
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

  const initialRange: DateRange = {
    from: subDays(new Date(), 4),
    to: new Date(),
  };

  const [range, setRange] = useState<DateRange | undefined>(initialRange);

  return (
    <ClickAwayListener onClickAway={handleHideMenu}>
      <Box sx={{ display: 'flex' }}>
        <Button
            key='calendarSelect'
            variant="text"
            size="small"
            color="dark"
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
            <DateRangeOutlinedIcon color="inherit" fontSize='small' />
        </Button>
        <Popper
          anchorEl={anchorEl}
          open={menuVisible}
          sx={{ zIndex: 79 }}
          placement="left"
          // Align the menu to the bottom
          // right side of the anchor button.
          transition
        >
          {({ TransitionProps }) => (
            <Grow
              {...TransitionProps}
              timeout={200}
              style={{ transformOrigin: 'top right' }}
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
                <Stack>
                    <Box display='flex' justifyContent='space-between' paddingX='16px' paddingTop='16px'>
                        <Typography fontWeight={700}>Custom Date Range</Typography>
                        <IconButton
                            aria-label="close"
                            // onClick={onClose}
                            disableRipple
                            sx={{
                                p: 0,
                            }}
                        >
                            <CloseIcon sx={{ fontSize: 20, color: 'text.primary' }} />
                        </IconButton>
                    </Box>
                    <Box display='flex' paddingX='16px' paddingTop='16px' maxWidth='310px' gap='8px'>
                        <TextField
                            sx={{ 
                                width: 160, 
                                '& .MuiOutlinedInput-root': {
                                    height: '32px',
                                    borderRadius: '6px' 
                                }
                            }}
                            placeholder="YYYY-MM-DD"
                            size="small"
                            color="primary"
                            InputProps={{
                                // startAdornment: isAddressValid === false && (
                                // <InputAdornment position="start" sx={{ ml: -1, mr: 0 }}>
                                //     <CloseIcon color="warning" sx={{ scale: '80%' }} />
                                // </InputAdornment>
                                // ),
                            }}
                            onChange={(e) => {
                                // checkAddress(e.target.value);
                            }}
                        />
                        <TextField
                            sx={{ 
                                width: 120, 
                                '& .MuiOutlinedInput-root': {
                                    height: '32px',
                                    borderRadius: '6px' 
                                }
                            }}
                            placeholder="11:00"
                            size="small"
                            color="primary"
                            InputProps={{
                                // startAdornment: isAddressValid === false && (
                                // <InputAdornment position="start" sx={{ ml: -1, mr: 0 }}>
                                //     <CloseIcon color="warning" sx={{ scale: '80%' }} />
                                // </InputAdornment>
                                // ),
                            }}
                            onChange={(e) => {
                                // checkAddress(e.target.value);
                            }}
                        />
                    </Box>
                    <Box display='flex' paddingX='16px' marginTop='8px' maxWidth='310px' gap='8px'>
                        <TextField
                            sx={{ 
                                width: 160, 
                                '& .MuiOutlinedInput-root': {
                                    height: '32px',
                                    borderRadius: '6px' 
                                }
                            }}
                            placeholder="YYYY-MM-DD"
                            size="small"
                            color="primary"
                            InputProps={{
                                // startAdornment: isAddressValid === false && (
                                // <InputAdornment position="start" sx={{ ml: -1, mr: 0 }}>
                                //     <CloseIcon color="warning" sx={{ scale: '80%' }} />
                                // </InputAdornment>
                                // ),
                            }}
                            onChange={(e) => {
                                // checkAddress(e.target.value);
                            }}
                        />
                        <TextField
                            sx={{ 
                                width: 120, 
                                '& .MuiOutlinedInput-root': {
                                    height: '32px',
                                    borderRadius: '6px' 
                                }
                            }}
                            placeholder="11:00"
                            size="small"
                            color="primary"
                            InputProps={{
                                // startAdornment: isAddressValid === false && (
                                // <InputAdornment position="start" sx={{ ml: -1, mr: 0 }}>
                                //     <CloseIcon color="warning" sx={{ scale: '80%' }} />
                                // </InputAdornment>
                                // ),
                            }}
                            onChange={(e) => {
                                // checkAddress(e.target.value);
                            }}
                        />
                    </Box>
                    <Divider sx={{ borderTop: 0.5, borderBottom: 0, marginTop: '16px', borderColor: 'divider' }} />
                    <DayPicker 
                        mode="range" 
                        showOutsideDays
                        selected={range}
                        onSelect={setRange}
                        styles={{
                            caption: {
                                display: 'flex',
                                position: 'relative',
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginBottom: '10px'
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
                                height: '30px'
                            },
                            nav_button_next: {
                                position: 'absolute',
                                right: '0',
                                borderRadius: '8px',
                                width: '30px',
                                height: '30px'
                            },
                            head_row: {
                                display: 'none'
                            },
                            table: {
                                display: 'flex',
                                justifyContent: 'center',
                                backgroundColor: BeanstalkPalette.lightestGreen,
                                borderRadius: '8px',
                            },
                            tbody: {
                                padding: '10px',
                                marginLeft: '6px'
                            },
                            day: {
                                borderRadius: '4px',
                                backgroundColor: BeanstalkPalette.white,
                                height: '30px',
                                width: '30px',
                                transitionProperty: 'color, background-color, border-color, text-decoration-color, fill, stroke',
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
                                color: BeanstalkPalette.white
                            },
                            range_end: {
                                fontWeight: 'bold',
                                backgroundColor: BeanstalkPalette.theme.spring.beanstalkGreen,
                                color: BeanstalkPalette.white,
                            },
                        }}
                    />
                    <Box display='flex' paddingX='16px' paddingBottom='16px' flexDirection='row-reverse' gap='8px'>
                        <Button sx={{ fontSize: 'small', height: '32px' }}>OK</Button>
                        <Button variant='text' color='cancel' sx={{ fontSize: 'small', height: '32px' }}>CANCEL</Button>
                    </Box>
                </Stack>
              </Box>
            </Grow>
          )}
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};

export default CalendarButton;
