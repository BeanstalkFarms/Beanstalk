import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Link, LinkProps, Stack, Typography, StackProps as MuiStackProps } from '@mui/material';
import KeyboardBackspaceIcon from '@mui/icons-material/KeyboardBackspace';
import React from 'react';
import EastIcon from '@mui/icons-material/East';
import { FontSize, IconSize } from '../App/muiTheme';
import Row from '~/components/Common/Row';

import { FC } from '~/types';

const PageHeader : FC<{
  /** The Field: The Decentralized Credit Facility */
  title?: any;
  /** "Earn yield through lending beans..." */
  description?: string;
  /** Show a back button to return to `returnPath`. */
  returnPath?: string;
  /**  */
  control?: React.ReactElement;
  /** */
  OuterStackProps?: MuiStackProps;
} & Omit<LinkProps, 'title'>> = (props) => (
  <Stack direction={{ md: 'row', xs: 'column' }} justifyContent="space-between" gap={1} {...props.OuterStackProps}>
    <Row gap={1.5}>
      {/* Back button */}
      {props.returnPath && (
        <Button
          to={props.returnPath}
          component={RouterLink}
          color="naked"
          sx={{
            p: 1,
            borderRadius: 1,
            color: 'text.secondary',
            '&:hover': {
              color: 'primary.main',
            }
        }}
        >
          <Row gap={0.5}>
            <KeyboardBackspaceIcon sx={{ width: IconSize.small }} height="auto" />
            <Typography variant="h4">Back</Typography>
          </Row>
        </Button>
      )}
      {/* Title */}
      <Stack direction="column" gap={0}>
        {props.title && (
          <Box>
            <Typography variant="h1" display="flex" alignItems="center" gap={1}>
              <span>{props.title}</span>
            </Typography>
          </Box>
        )}
        {props.description && (
          <Box>
            <Typography variant="subtitle1" sx={{ lineHeight: '1.5rem' }}>
              {props.description}.
              {props.href !== undefined && (
                <Link
                  href={props.href || 'https://docs.bean.money/almanac'}
                  underline="none"
                  color="primary"
                  display="flex"
                  flexDirection="row"
                  gap={1}
                  alignItems="center"
                  target="_blank"
                  rel="noreferrer"
                  sx={{ display: 'inline', ml: 0.3, '&:hover': { opacity: 0.85 } }}
                >
                  <Typography display="inline" variant="subtitle1" sx={{ lineHeight: '1.5rem' }} alignItems="center">
                    Learn more
                  </Typography>
                  &nbsp;
                  <EastIcon sx={{ height: '100%', fontSize: FontSize.base, mb: -0.3 }} />
                </Link>
              )}
            </Typography>
          </Box>
        )}
      </Stack>
    </Row>
    {props.control && <Box>{props.control}</Box>}
  </Stack>
);

export default PageHeader;
