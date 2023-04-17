import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import { ComponentMeta, ComponentStory } from '@storybook/react';

export default {
  component: Card,
  args: {}
} as ComponentMeta<typeof Card>;

const Template: ComponentStory<typeof Card> = (args: any) => (
  <Card {...args}>
    <CardContent>
      <Typography>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse malesuada lacus ex, sit amet blandit leo lobortis eget.
      </Typography>
    </CardContent>
  </Card>
);

const Primary = Template.bind({});
Primary.args = {};

export {
  Primary
};
