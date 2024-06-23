import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  ClickAwayListener,
  Divider,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import beanIcon from '~/img/tokens/bean-logo-circled.svg';
import siloIcon from '~/img/beanstalk/silo-icon.svg';
import podIcon from '~/img/beanstalk/pod-icon.svg';
import CloseIcon from '@mui/icons-material/Close';
import Row from '../Common/Row';
import { useChartSetupData } from './useChartSetupData';
import { chartColors } from './chartColors';

export interface SelectDialogProps {
  handleClose: () => void;
  selected: any[];
  setSelected: React.Dispatch<React.SetStateAction<any>>;
  isMobile: boolean;
}

const selectedSx = {
  color: 'primary.main',
  borderColor: 'primary.main',
  backgroundColor: 'primary.light',
};

const unselectedSx = {
  color: 'text.primary',
  borderColor: 'text.light',
};

const SelectDialog: FC<SelectDialogProps> = ({
  handleClose,
  selected,
  setSelected,
  isMobile,
}) => {
  const chartSetupData = useChartSetupData();
  const dataTypes = ['Bean', 'Silo', 'Field'];

  const [searchInput, setSearchInput] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [filteredData, setFilteredData] = useState(chartSetupData);
  const [internalSelected, setInternalSelected] = useState(selected);

  const maxChartsSelected = chartColors.length;

  function typeToggle(type: string) {
    const index = selectedTypes.indexOf(type);
    if (index === -1) {
      const newSelection = [...selectedTypes];
      newSelection.push(type);
      setSelectedTypes(newSelection);
    } else {
      const newSelection = [...selectedTypes];
      newSelection.splice(index, 1);
      setSelectedTypes(newSelection);
    }
  }

  useEffect(() => {
    if ((!searchInput || searchInput === '') && selectedTypes.length === 0) {
      setFilteredData(chartSetupData);
    } else {
      const inputFilter = searchInput
        .split(/(\s+)/)
        .filter((output) => output.trim().length > 0);
      const stringFilter = chartSetupData.filter((option) =>
        inputFilter.every((filter) =>
          option.name.toLowerCase().includes(filter)
        )
      );
      const typeFilter =
        selectedTypes.length > 0
          ? stringFilter.filter((option) => selectedTypes.includes(option.type))
          : stringFilter;
      setFilteredData(typeFilter);
    }
  }, [chartSetupData, searchInput, selectedTypes]);

  function handleSelection(selection: number) {
    const selectedItems = [...internalSelected];
    const indexInSelection = selectedItems.findIndex(
      (selectionIndex) => selection === selectionIndex
    );
    const isSelected = indexInSelection > -1;
    isSelected
      ? selectedItems.splice(indexInSelection, 1)
      : selectedItems.push(selection);
    if (selectedItems.length > maxChartsSelected) return;
    setInternalSelected(selectedItems);
  };

  function closeDialog() {
    setSelected(internalSelected);
    localStorage.setItem('advancedChartSelectedCharts', JSON.stringify(internalSelected));
    handleClose();
  };

  useMemo(() => {
    setInternalSelected(selected);
  }, [selected]);

  const [rowWidth, setRowWidth] = useState(undefined);

  const measuredRef = useCallback((node: any) => {
    if (node !== null) {
      setRowWidth(node.getBoundingClientRect().width);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredData]);

  return (
    <ClickAwayListener onClickAway={handleClose} mouseEvent="onMouseDown" touchEvent="onTouchStart">
      <Box
        sx={{
          paddingY: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          height: isMobile ? '400px' : '100%',
        }}
      >
        <Box
          sx={{
            marginX: 2,
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex' }}>Find Data</Box>
          <IconButton
            aria-label="close"
            onClick={() => closeDialog()}
            disableRipple
            sx={{
              p: 0,
            }}
          >
            <CloseIcon sx={{ fontSize: 20, color: 'text.primary' }} />
          </IconButton>
        </Box>
        <TextField
          sx={{ width: '100%', paddingX: 2, }}
          placeholder="Search for data"
          size="small"
          color="primary"
          InputProps={{
            startAdornment: (
              <SearchRoundedIcon fontSize="small" color="inherit" />
            ),
          }}
          onChange={(e) => {
            setSearchInput(e.target.value);
          }}
        />
        <Box sx={{ display: 'flex', gap: 1, marginX: 2 }}>
          {dataTypes.map((dataType) => {
            const isSelected = selectedTypes.includes(dataType);
            return (
              <Button
                key={`selectDialog${dataType}`}
                variant="outlined"
                size="large"
                sx={{
                  px: 0.75,
                  py: 0.25,
                  height: 'unset',
                  backgroundColor: 'white',
                  border: '1px solid',
                  fontWeight: 'normal',
                  ':hover': {
                    borderColor: 'text.light',
                    background: 'primary.light',
                    ...(isSelected ? selectedSx : {}),
                  },
                  ...(isSelected ? selectedSx : unselectedSx),
                }}
                onClick={() => typeToggle(dataType)}
              >
                {dataType}
              </Button>
            );
          })}
        </Box>
        <Divider />
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
            overflowY: 'auto',
          }}
        >
          <Box ref={measuredRef} sx={{ display: 'flex', width: '100%', height: '0px' }} />
          {filteredData.map((data, index) => {
            const indexInSelection = internalSelected.findIndex(
              (selectionIndex) => data.index === selectionIndex
            );
            const isSelected = indexInSelection > -1;
            if (!isMobile) {
              return (
                <Row
                  key={`chartSelectList${index}`}
                  onClick={() => handleSelection(data.index)}
                  gap={0.3}
                  p={0.25}
                  sx={{
                    paddingLeft: 2,
                    paddingRight: rowWidth ? `${22.5 - (700 - rowWidth)}px` : 0,
                    backgroundColor: isSelected ? 'primary.light' : undefined,
                    '&:hover': { backgroundColor: '#F5F5F5', cursor: 'pointer' },
                  }}
                >
                  {data.type === 'Bean' ? (
                    <img
                      src={beanIcon}
                      alt="Bean"
                      style={{ height: 16, width: 16 }}
                    />
                  ) : data.type === 'Silo' ? (
                    <img
                      src={siloIcon}
                      alt="Silo"
                      style={{ height: 16, width: 16 }}
                    />
                  ) : data.type === 'Field' ? (
                    <img
                      src={podIcon}
                      alt="Bean"
                      style={{ height: 16, width: 16 }}
                    />
                  ) : null}
                  <Box>{data.name}</Box>
                  <Box
                    sx={{
                      display: 'flex',
                      flexGrow: 1,
                      justifyContent: 'flex-end',
                      overflow: 'clip',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    <Typography fontSize={10} color="text.tertiary">
                      {data.shortDescription}
                    </Typography>
                  </Box>
                </Row>
              );
            }
            return (
              <Row
                key={`chartSelectList${index}`}
                onClick={() => handleSelection(data.index)}
                gap={0.3}
                paddingY={0.25}
                paddingX={2}
                sx={{
                  backgroundColor: isSelected ? 'primary.light' : undefined,
                  '&:hover': { backgroundColor: '#F5F5F5', cursor: 'pointer' },
                }}
              >
                <Box display="flex" alignContent="center">
                  {data.type === 'Bean' ? (
                    <img
                      src={beanIcon}
                      alt="Bean"
                      style={{ height: 32, width: 32 }}
                    />
                  ) : data.type === 'Silo' ? (
                    <img
                      src={siloIcon}
                      alt="Silo"
                      style={{ height: 32, width: 32 }}
                    />
                  ) : data.type === 'Field' ? (
                    <img
                      src={podIcon}
                      alt="Bean"
                      style={{ height: 32, width: 32 }}
                    />
                  ) : null}
                </Box>
                <Box display="flex" flexDirection="column">
                  <Box
                    sx={{ display: 'flex', flexGrow: 1, whiteSpace: 'nowrap' }}
                  >
                    {data.name}
                  </Box>
                  <Typography
                    fontSize={10}
                    lineHeight={1}
                    whiteSpace="wrap"
                    color="text.tertiary"
                  >
                    {data.shortDescription}
                  </Typography>
                </Box>
              </Row>
            );
          })}
        </Box>
      </Box>
    </ClickAwayListener>
  );
};

export default SelectDialog;
