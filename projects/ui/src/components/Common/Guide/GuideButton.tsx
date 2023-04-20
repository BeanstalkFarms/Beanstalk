import React from 'react';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark'; import {
  Box,
  Button,
} from '@mui/material';
import { FontSize } from '~/components/App/muiTheme';
import GuideDialog from '~/components/Common/Guide/GuideDialog';
import useToggle from '~/hooks/display/useToggle';
import { Guide } from '~/util/Guides';

import { FC } from '~/types';

export type GuideProps = {
  title: string;
  guides: Guide[];
}

const GuideButton: FC<{ title: string; guides: Guide[] }> = (props) => {
  const [isOpen, show, hide] = useToggle();
  return (
    <>
      <Box display="flex" height="100%" alignItems={{ xs: 'start', sm: 'end' }}>
        <Button
          onClick={show}
          variant="contained"
          color="primary"
          sx={{ p: 1, borderRadius: 100, minWidth: 0, width: '25px', height: '25px' }}
        >
          <QuestionMarkIcon sx={{ fontSize: FontSize.sm, background: 'primary.main' }} />
        </Button>
      </Box>
      <GuideDialog open={isOpen} onClose={hide} {...props} />
    </>
  );
};

export default GuideButton;
