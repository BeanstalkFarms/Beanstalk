import React, { FC } from 'react';
import { Box, Button, Divider, IconButton, TextField, Typography } from "@mui/material";
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import beanIcon from '~/img/tokens/bean-logo-circled.svg';
import siloIcon from '~/img/beanstalk/silo-icon.svg';
import podIcon from '~/img/beanstalk/pod-icon.svg';
import CloseIcon from '@mui/icons-material/Close';
import Row from '../Common/Row';
import { useChartSetupData }from './useChartSetupData';

export interface SelectDialogProps {
    handleClose: () => void,
    selected: any[],
    setSelected: React.Dispatch<React.SetStateAction<any>>,
};

const SelectDialog: FC<SelectDialogProps> = ({ handleClose, selected, setSelected }) => {

    const chartSetupData = useChartSetupData();
    
    return (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, height: 400 }}>
            <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex'}}>Find Data</Box>
                <IconButton
                    aria-label="close"
                    onClick={handleClose}
                    disableRipple
                    sx={{
                        p: 0,
                    }}
                    >
                    <CloseIcon sx={{ fontSize: 20, color: 'text.primary' }} />
                </IconButton>
            </Box>
            <TextField 
                sx={{ width: '100%' }}
                placeholder="Search for data" 
                size='small' 
                color='primary'
                InputProps={{
                startAdornment: <SearchRoundedIcon fontSize="small" color="inherit" /> 
                }}
                // onChange={/* (e) => {checkAddress(e.target.value)} */} 
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                variant='outlined-secondary'
                color='secondary'
                size='small'
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    border: '0.5px solid',
                    borderColor: 'divider',
                    fontWeight: 'normal',
                    color: 'text.primary',
                    boxSizing: 'border-box',
                    paddingY: 0.25,
                    paddingX: 0.75,
                }}
                >
                Bean
                </Button>
                <Button
                variant='outlined-secondary'
                color='secondary'
                size='small'
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    border: '0.5px solid',
                    borderColor: 'divider',
                    fontWeight: 'normal',
                    color: 'text.primary',
                    boxSizing: 'border-box',
                    paddingY: 0.25,
                    paddingX: 0.75,
                }}
                >
                Silo
                </Button>
                <Button
                variant='outlined-secondary'
                color='secondary'
                size='small'
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    border: '0.5px solid',
                    borderColor: 'divider',
                    fontWeight: 'normal',
                    color: 'text.primary',
                    boxSizing: 'border-box',
                    paddingY: 0.25,
                    paddingX: 0.75,
                }}
                >
                Field
                </Button>
            </Box>
            <Divider />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, overflowY: 'auto' }}>
                {chartSetupData.map((data, index) => {
                    const selectedItems = [...selected];
                    const indexInSelection = selectedItems.findIndex((selectionIndex) => data.index === selectionIndex);
                    const isSelected = indexInSelection > -1;
                    isSelected ? selectedItems.splice(indexInSelection, 1) : selectedItems.push(data.index);
                    return (
                    <Row key={`chartSelectList${index}`} onClick={() => setSelected(selectedItems.length > 0 ? selectedItems : [0]) } gap={0.3} p={0.25} sx={{ backgroundColor: (isSelected ? 'primary.light' : undefined), '&:hover': { backgroundColor: '#F5F5F5', cursor: 'pointer' } }}>
                        {data.type === 'Bean' ? (
                            <img src={beanIcon} alt="Bean" style={{ height: 16, width: 16 }} /> 
                        ) : data.type === 'Silo' ? (
                            <img src={siloIcon} alt="Silo" style={{ height: 16, width: 16 }} /> 
                        ) : data.type === 'Field' ? (
                            <img src={podIcon} alt="Bean" style={{ height: 16, width: 16 }} /> 
                        ) : null}
                        <Box>{data.name}</Box>
                        <Box sx={{ display: 'flex', flexGrow: 1, justifyContent: 'flex-end' }}>
                            <Typography fontSize={10} color='text.tertiary'>{data.tooltipHoverText}</Typography>
                        </Box>
                    </Row>
                    )
                })}
            </Box>
        </Box>
    );
};

export default SelectDialog