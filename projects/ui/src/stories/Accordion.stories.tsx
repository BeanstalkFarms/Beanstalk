import React from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Button, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import AccordionWrapper from '~/components/Common/Accordion/AccordionWrapper';

export default {
  component: Button,
  args: {
    wrapped: true,
  }
} as ComponentMeta<typeof Button>;

const Template: ComponentStory<typeof Button> = (args: any) => {
  const a = (
    <Accordion variant={args.variant}>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls="panel1a-content"
        id="panel1a-header"
      >
        <Typography>Accordion 1</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse
          malesuada lacus ex, sit amet blandit leo lobortis eget.
        </Typography>
      </AccordionDetails>
    </Accordion>
  );
  
  if (args.wrapped) return <AccordionWrapper>{a}</AccordionWrapper>;

  return a;
};

const Primary = Template.bind({});
Primary.args = {};

const Outlined = Template.bind({});
Outlined.args = {
  variant: 'outlined',
  // wrapped: false,
};

export { Primary, Outlined };
