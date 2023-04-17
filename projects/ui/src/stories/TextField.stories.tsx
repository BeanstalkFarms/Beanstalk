import React from 'react';
import { TextField, Button } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

export default {
  component: TextField,
};

const Template : any = (args : any) => (
  <TextField
    type="text"
    variant="outlined"
    placeholder="Placeholder"
    InputProps={{
      endAdornment: args.endAdornment
    }}
  />
);

const WithAdornment = Template.bind({});
WithAdornment.args = {
  endAdornment: (
    <Button
      variant="contained"
      color="secondary"
      endIcon={<ArrowDropDownIcon />}
      fullWidth
    >
      Select a token
    </Button>
  ),
};

export {
  WithAdornment
};
