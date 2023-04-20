import React from 'react';

import { Accordion, AccordionDetails, AccordionProps } from '@mui/material';
import StyledAccordionSummary from './Accordion/AccordionSummary';

import { FC } from '~/types';

const TxnAccordion : FC<AccordionProps> = ({ children, ...props }) => (
  <Accordion defaultExpanded variant="outlined" {...props}>
    <StyledAccordionSummary title="Transaction Details" />
    <AccordionDetails>
      {children}
    </AccordionDetails>
  </Accordion>
);

export default TxnAccordion;
