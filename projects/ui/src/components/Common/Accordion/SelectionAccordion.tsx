import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionProps,
  AccordionSummary,
  Chip,
  Stack,
  StackProps,
  Typography,
} from '@mui/material';
import React, { useMemo } from 'react';

import { BeanstalkPalette, IconSize } from '~/components/App/muiTheme';
import Row from '../Row';

export type SelectionAccordionItemProps<T> = {
  id: string;
  item: T;
  selected: boolean;
};

export type SelectionAccordionProps<T> = {
  /**
   * 
   */
  open: boolean;
  /** 
   * 
   */
  onChange: () => void;
  /**
   * render function
   */
  render: (i: T, selected: boolean) => JSX.Element | null;
  /**
   * function to handle the selection of the items
   */
  onToggle: (i: T) => void;
  /**
   * the title of the accordion
   */
  title: string | JSX.Element;
  /**
   * state of the selected items
   */
  selected: Set<T>;
  /**
   * the items to be displayed in the accordion
   */
  options: Set<T>;
  /**
   * the orientation of the items in the accordion
   */
  direction?: StackProps['direction'];
  /**
   * the icon to be displayed to the left of the title
   * Toggle button will be rendered below the title, and right aligned
   */
  hideCounter?: boolean;
  /**
   *
   */
  subtitle?: string | JSX.Element;
  /**
   *
   */
  sx?: AccordionProps['sx'];
};

export default function SelectionAccordion<T>({
  open,
  onChange,
  render,
  onToggle,
  title,
  selected,
  options,
  direction = 'column',
  hideCounter = false,
  subtitle,
  sx,
}: SelectionAccordionProps<T>) {
  const selectedText = useMemo(() => {
    const activeItems = selected.size;
    if (options.size === 1) {
      return `${activeItems === 0 ? 'None' : activeItems} selected`;
    }
    return `${activeItems || 0} selected`;
  }, [options.size, selected.size]);

  return (
    <Stack>
      <Accordion
        expanded={open}
        onChange={onChange}
        sx={{ background: BeanstalkPalette.white, ...sx }}
      >
        <AccordionSummary
          expandIcon={
            <ExpandMoreIcon
              sx={{
                color: 'text.secondary',
                fontSize: IconSize.xs,
              }}
            />
          }
        >
          <Row gap={1}>
            <Row gap={0.5}>
              {typeof title === 'string' ? (
                <Typography variant="body1" color="text.secondary">
                  {title}
                </Typography>
              ) : (
                <>{title}</>
              )}
            </Row>
            {!hideCounter ? (
              <Chip
                color="primary"
                variant="filled"
                onClick={undefined}
                size="small"
                label={
                  <Typography sx={{ whitespace: 'nowrap' }} variant="bodySmall">
                    {selectedText}
                  </Typography>
                }
                sx={{
                  color: selected.size > 0 ? 'primary.main' : 'text.secondary',
                  backgroundColor:
                    selected.size > 0
                      ? 'primary.light'
                      : BeanstalkPalette.inputGrey,
                }}
              />
            ) : null}
          </Row>
        </AccordionSummary>
        <AccordionDetails
          sx={{
            '&.MuiAccordionDetails-root': {
              pb: 1,
              px: 1,
            },
          }}
        >
          <Stack width="100%" gap={1}>
            {subtitle && (<>{subtitle}</>)}
            <Stack width="100%" gap={1} direction={direction}>
              {Array.from(options.values()).map((item, i) => {
                const active = selected.has(item);
                const component = render(item, active);
                if (!component) return null;
                return React.cloneElement(component, {
                  id: `selection-item-${i}`,
                  key: `selection-key-${i}`,
                  sx: {
                    ...component.props.sx,
                  },
                  onClick: () => onToggle(item),
                });
              })}
            </Stack>
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
}
