import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Box, Button, Stack, Typography } from '@mui/material';
import KeyboardBackspaceIcon from '@mui/icons-material/KeyboardBackspace';
import React from 'react';
import { IconSize } from '../App/muiTheme';
import Row from '~/components/Common/Row';

import { FC } from '~/types';

const PageHeaderSecondary: FC<{
  /** The Field: The Decentralized Credit Facility */
  title?: string | JSX.Element;
  /** Align text within the title. */
  titleAlign?: 'left' | 'center';
  /** Show an icon next to the title. */
  icon?: JSX.Element;
  /** Set a custom path for the back button to return to. Defaults to navigate(-1). */
  returnPath?: string;
  /** Show a back button */
  hideBackButton?: boolean; 
  /** Show a control on the right side of the header. */
  control?: React.ReactElement;
}> = (props) => {
  const navigate = useNavigate();
  const buttonProps = props.returnPath
    ? {
        to: props.returnPath,
        component: RouterLink,
      }
    : {
        onClick: () => navigate(-1),
      };
  return (
    <div>
      <Row justifyContent="space-between" gap={0.5}>
        {props.hideBackButton ? null : (
          <Stack sx={{ width: 70, justifyContent: 'start' }}>
            <Button
              {...buttonProps}
              color="naked"
              sx={{
                p: 0,
                borderRadius: 1,
                float: 'left',
                display: 'inline',
                mb: '-2.5px',
                color: 'text.secondary',
                '&:hover': {
                  color: 'primary.main',
                },
              }}
            >
              <Row gap={0.5} height="100%">
                <KeyboardBackspaceIcon
                  sx={{ width: IconSize.small }}
                  height="auto"
                />
                <Typography variant="h4">Back</Typography>
              </Row>
            </Button>
          </Stack>
        )}
        {props.title && (
          typeof props.title === 'string' ? (
            <Typography
              variant="h2"
              textAlign={props.titleAlign ?? 'center'}
              sx={{
                ml: !props.hideBackButton && props.titleAlign ? 1.5 : 0,
                verticalAlign: 'middle',
                width: '100%',
              }}
            >
              {props.icon}&nbsp;
              {props.title}
            </Typography>
          ) : (
            props.title
          )
        )}
        <Box sx={{ width: 70 }} display="flex" justifyContent="end">
          {props.control}
        </Box>
      </Row>
    </div>
  );
};

export default PageHeaderSecondary;
