import React from 'react';
import { Box } from '@mui/material';
// import NavBar from './NavBar';

export default {
  // component: NavBar,
  args: {},
  // parameters: {
  //   layout: 'fullscreen'
  // }
};// as ComponentMeta<typeof NavBar>;

const Template = (args: any) => (
  <Box>
    {/* <NavBar /> */}
    There is a problem bundling NavBar right now.
  </Box>
);

const Primary = Template.bind({});
export {
  Primary
};
