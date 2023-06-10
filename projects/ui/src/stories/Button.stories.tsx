import React from 'react';
import { Button } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { Box } from '@mui/system';
import { ComponentMeta, ComponentStory } from '@storybook/react';

export default {
  component: Button,
  argTypes: {
    color: {
      options: ['primary', 'secondary'],
      control: { type: 'radio' },
    },
    variant: {
      options: ['text', 'contained', 'outlined'],
      control: { type: 'radio' },
    },
  },
  args: {
    color: 'primary',
    children: 'Example',
    variant: 'contained',
  },
} as ComponentMeta<typeof Button>;

const Template: ComponentStory<typeof Button> = (args) => (
  <Box sx={{ width: 800 }}>
    <Button {...args}>{args.children}</Button>
  </Box>
);

const Primary = Template.bind({});
Primary.args = {
  color: 'primary',
};

const Dropdown = Template.bind({});
Dropdown.args = {
  variant: 'contained',
  color: 'secondary',
  children: 'Select a token',
  endIcon: <ArrowDropDownIcon />,
};

const Large = Template.bind({});
Large.args = {
  variant: 'contained',
  color: 'primary',
  children: 'Convert Allocation of Deposited Assets',
  size: 'large',
  fullWidth: true,
};

export { Primary, Dropdown, Large };
