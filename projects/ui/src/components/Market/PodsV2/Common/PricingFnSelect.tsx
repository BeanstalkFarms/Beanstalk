import { Select, MenuItem } from '@mui/material';
import { useAtom } from 'jotai';
import React from 'react';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { FontSize } from '~/components/App/muiTheme';
import { pricingFunctionAtom, PricingFn } from '../info/atom-context';

const sx = {
  '& .MuiSelect-select': {
    fontSize: FontSize.xs,
  },
  '& .MuiInputBase-input': {
    padding: '8px 12px',
  },
  ' & .MuiSvgIcon-root': {
    fontSize: FontSize.xs,
    color: 'text.primary',
    mt: '-1px',
  },
};

const PricingFnSelect: React.FC<{}> = () => {
  const [pricingFn, setPricingFn] = useAtom(pricingFunctionAtom);

  return (
    <Select
      value={pricingFn}
      defaultValue={PricingFn.FIXED}
      onChange={(e) => setPricingFn(e.target.value as PricingFn)}
      size="small"
      IconComponent={KeyboardArrowDownIcon}
      sx={{ ...sx, borderRadius: 0.6 }}
    >
      <MenuItem value={PricingFn.FIXED} sx={{ fontSize: FontSize.xs }}>
        {PricingFn.FIXED}
      </MenuItem>
      <MenuItem value={PricingFn.DYNAMIC} sx={{ fontSize: FontSize.xs }}>
        {PricingFn.DYNAMIC}
      </MenuItem>
    </Select>
  );
};

export default PricingFnSelect;
