import {
  useGridApiContext,
  useGridSelector,
  gridPageSelector,
  gridPageCountSelector,
} from '@mui/x-data-grid';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import ArrowPagination from '~/components/Common/ArrowPagination';
import Centered from '~/components/Common/ZeroState/Centered';

type IScrollPaginationControl = {
  /**
   * ref of the data grid container element
   */
  scrollRef: React.MutableRefObject<HTMLDivElement | null>;
  /**
   * async function to fetch more data when scrolled to the bottom of the table
   */
  handleFetchMore?: () => Promise<void>;
};

type ControllerCache = {
  /**
   * keep track of how many rows there were prior to calling `handleFetchMore`
   */
  numRowsPrev: number;
  /**
   * keep track of whether or not page number can update
   */
  mayUpdatePage: boolean;
};

const CONTROL_HEIGHT = 52;

const ScrollPaginationControl: React.FC<IScrollPaginationControl> = ({
  scrollRef,
  handleFetchMore,
}) => {
  const apiRef = useGridApiContext();
  const numRows = apiRef.current.getRowsCount();
  const page = useGridSelector(apiRef, gridPageSelector);
  const pageCount = useGridSelector(apiRef, gridPageCountSelector);

  // use useRef here instead to avoid unnecessary re-renders
  const cacheRef = useRef<ControllerCache | null>(null);

  // initialize cacheRef on mount & clean up on unmount
  useEffect(() => {
    cacheRef.current = {
      numRowsPrev: 0,
      mayUpdatePage: false,
    };
    return () => {
      cacheRef.current = null;
    };
  }, []);

  // get the Mui Data-Grid-scroll container element in which the scrollbar is rendered
  const el = scrollRef?.current?.querySelector('.MuiDataGrid-virtualScroller');

  const hasNextPage = useMemo(
    () => !(page === pageCount - 1 || pageCount === 0),
    [page, pageCount]
  );

  /*
   * Handle scroll events. If scrolled to the bottom, call 'fetchMore()' if provided
   */
  const handleOnScroll = useCallback(async () => {
    if (!handleFetchMore || !cacheRef?.current) return;
    const [sh, st, ch] = [el?.scrollHeight, el?.scrollTop, el?.clientHeight];
    if (sh && st && ch) {
      const isBottom = sh - st - 1 <= ch;
      // only call fetchMore if we're at the bottom and we are on the last page
      if (isBottom && !hasNextPage) {
        handleFetchMore();
        cacheRef.current.mayUpdatePage = true;
      }
    }
  }, [handleFetchMore, el, hasNextPage]);

  /**
   * handle update page number & cached values if `handleFetchMore` was called.
   */
  const handleUpdatePage = useCallback(() => {
    if (!cacheRef?.current) return;
    const isRowDiff = numRows !== cacheRef.current.numRowsPrev;
    const isPageDiff = page + 1 !== pageCount;

    if (isPageDiff && hasNextPage) {
      // set as pageCount - 1 for cases where new rows exceed the a single page size
      apiRef.current.setPage(pageCount - 1);
      cacheRef.current.mayUpdatePage = false;
      cacheRef.current.numRowsPrev = numRows;

      // only update rows here if we are on the last page
    } else if (isRowDiff && !hasNextPage) {
      cacheRef.current.numRowsPrev = numRows;
    }
  }, [apiRef, hasNextPage, numRows, page, pageCount]);

  /**
   * listen to scroll events of the Mui Data Grid virtual scroller child element
   */
  useEffect(() => {
    if (!handleFetchMore) return;
    el?.addEventListener('scroll', handleOnScroll);
    return () => {
      el?.removeEventListener('scroll', handleOnScroll);
    };
  }, [el, handleOnScroll, handleFetchMore]);

  /*
   * update page number if necessary
   */
  useEffect(() => {
    if (cacheRef.current && cacheRef.current.mayUpdatePage) {
      handleUpdatePage();
    }
  }, [handleUpdatePage]);

  return (
    <Centered height={CONTROL_HEIGHT} width="100%">
      <ArrowPagination />
    </Centered>
  );
};

export default ScrollPaginationControl;
