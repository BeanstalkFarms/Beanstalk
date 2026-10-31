import { QueryData } from '~/components/Common/Charts/BaseSeasonPlot';
import React from 'react';

type QueryStateProps = {
  queryData: QueryData;
  loading: JSX.Element;
  error: JSX.Element;
  empty: JSX.Element;
  success: JSX.Element;
};

const QueryState: React.FC<QueryStateProps> = ({
  queryData,
  loading,
  error,
  empty,
  success,
}) => {
  if (queryData.loading) {
    return loading;
  }
  if (queryData.error) {
    return error;
  }
  if (!queryData.data.some((series) => series.length > 0)) {
    return empty;
  }
  return success;
};

export default QueryState;
