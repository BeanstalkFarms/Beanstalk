import { Link, Typography } from '@mui/material';
import { GridRenderCellParams } from '@mui/x-data-grid';
import { displayFullBN, secondsToDate, toTokenUnitsBN } from '~/util';

const AMOUNT_IN = {
  field: 'amountIn',
  flex: 1,
  headerName: 'Amount In',
  align: 'left',
  headerAlign: 'left',
  renderCell: (params: GridRenderCellParams) => {
    return (
      <span>
        <Typography display={{ xs: 'none', md: 'block' }}>
          {displayFullBN(
            toTokenUnitsBN(params.row.amountIn, params.row.tokenIn.decimals),
            4
          )}
        </Typography>
        {/* <Typography display={{ xs: 'block', md: 'none' }}>
            {displayBN(params.row.amountIn)}
          </Typography> */}
      </span>
    );
  },
  sortable: false,
};

const AMOUNT_OUT = {
  field: 'amountOut',
  flex: 1,
  headerName: 'Amount Out',
  align: 'left',
  headerAlign: 'left',
  renderCell: (params: GridRenderCellParams) => {
    return (
      <span>
        <Typography display={{ xs: 'none', md: 'block' }}>
          {displayFullBN(
            toTokenUnitsBN(params.row.amountOut, params.row.tokenOut.decimals),
            4
          )}
        </Typography>
        {/* <Typography display={{ xs: 'block', md: 'none' }}>
                {displayBN(params.row.amountIn)}
              </Typography> */}
      </span>
    );
  },
  sortable: false,
};

const AMOUNT_USD = {
  field: 'amountUSD',
  flex: 1,
  headerName: 'Amount USD',
  align: 'left',
  headerAlign: 'left',
  renderCell: (params: GridRenderCellParams) => {
    return (
      <span>
        <Typography display={{ xs: 'none', md: 'block' }}>
          {`$${parseFloat(params.row.amountUSD).toFixed(2)}`}
        </Typography>
        {/* <Typography display={{ xs: 'block', md: 'none' }}>
                {displayBN(params.row.amountIn)}
              </Typography> */}
      </span>
    );
  },
  sortable: false,
};

const TIME = {
  field: 'time',
  flex: 1,
  headerName: 'Time',
  align: 'left',
  headerAlign: 'left',
  renderCell: (params: GridRenderCellParams) => {
    return (
      <span>
        <Typography display={{ xs: 'none', md: 'block' }}>
          {secondsToDate(params.row.timestamp).toLocaleDateString()}{' '}
          {secondsToDate(params.row.timestamp).toLocaleTimeString()}
        </Typography>
        {/* <Typography display={{ xs: 'block', md: 'none' }}>
                {displayBN(params.row.amountIn)}
              </Typography> */}
      </span>
    );
  },
  sortable: true,
};

const DESCRIPTION = {
  field: 'description',
  flex: 1,
  headerName: 'Description',
  align: 'left',
  headerAlign: 'left',
  renderCell: (params: GridRenderCellParams) => {
    return (
      <span>
        <Link href={`https://etherscan.io/tx/${params.row.hash}`} target="_blank" rel="noopener noreferrer">
          <Typography>
            {params.row.label}
          </Typography>
        </Link>
        {/* <Typography display={{ xs: 'block', md: 'none' }}>
                {displayBN(params.row.amountIn)}
              </Typography> */}
      </span>
    );
  },
  sortable: false,
};

export default {
  AMOUNT_IN,
  AMOUNT_OUT,
  TIME,
  AMOUNT_USD,
  DESCRIPTION,
};
