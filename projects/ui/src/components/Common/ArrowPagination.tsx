import React, { useCallback, useMemo } from 'react';
import { Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { gridPageCountSelector, gridPageSelector, useGridApiContext, useGridSelector } from '@mui/x-data-grid';
import { FontSize } from '../App/muiTheme';
import Row from '~/components/Common/Row';
import { FC } from '~/types';

const ArrowPagination: FC<{}> = () => {
  const apiRef = useGridApiContext();
  const page = useGridSelector(apiRef, gridPageSelector);
  const pageCount = useGridSelector(apiRef, gridPageCountSelector);

  const handleBack = useCallback(() => {
    if (page > 0) {
      apiRef.current.setPage(page - 1);
    }
  }, [apiRef, page]);

  const handleForward = useCallback(() => {
    if (page < pageCount) {
      apiRef.current.setPage(page + 1);
    }
  }, [apiRef, page, pageCount]);

  /** Determines color of next arrow. */
  const hasNextPage = useMemo(() => !((page === pageCount - 1) || pageCount === 0), [page, pageCount]);

  return (
    <Row gap={0.5}>
      <ArrowBackIcon
        onClick={handleBack}
        sx={{
          fontSize: FontSize.lg,
          cursor: 'pointer',
          color: page === 0 ? 'text.secondary' : 'text.primary',
          '&:hover': {
            color: page === 0 ? 'text.secondary' : 'primary.main',
          }
        }}
      />
      <Typography variant="body1">
        Page {page + 1} of {pageCount === 0 ? pageCount + 1 : pageCount}
      </Typography>
      <ArrowForwardIcon
        onClick={handleForward}
        sx={{
          fontSize: FontSize.lg,
          cursor: 'pointer',
          color: hasNextPage ? 'text.primary' : 'text.secondary',
          '&:hover': {
            color: page === pageCount - 1 || pageCount === 0 ? 'text.secondary' : 'primary.main',
          }
        }}
      />
    </Row>
  );
};

export default ArrowPagination;
