import { QueryData } from '~/components/Common/Charts/BaseSeasonPlot';
import React from 'react';

type QueryStateProps = {
  queryData: QueryData;
  loading: JSX.Element;
  error: JSX.Element;
  success: JSX.Element;
};

const QueryState: React.FC<QueryStateProps> = ({
  queryData,
  loading,
  error,
  success,
}) => {
  if (queryData.loading) {
    return loading;
  }
  if (queryData.data.length === 0 || queryData.error) {
    return error;
  }
  return success;
};

export default QueryState;
