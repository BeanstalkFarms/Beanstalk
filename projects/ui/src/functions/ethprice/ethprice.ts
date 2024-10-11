import { Handler } from '@netlify/functions';
import axios from 'axios';
import middy from 'middy';
import { cors, rateLimit } from '~/functions/middleware';

// export type EthPriceResponse = {
//   block: string;
//   gas: {
//     safe: string;
//     propose: string;
//     fast: string;
//     suggestBaseFee: string;
//   };
//   ethusd: string;
//   ethusdTimestamp: string;
//   lastRefreshed: string;
// };

/// https://docs.arbiscan.io/api-endpoints/stats-1#get-ether-last-price
export type ArbiscanEthPriceResponse = {
  ethbtc: string;
  ethbtc_timestamp: string;
  ethusd: string;
  ethusd_timestamp: string;
};

export type EthPriceResponse = {
  ethusd: string;
  ethusdTimestamp: string;
  lastRefreshed: string;
};

let data: null | EthPriceResponse = null;
let lastRefreshed = new Date().getTime();

/// Allow a refresh every 10s (~1 block)
const REFRESH_MS = 10 * 1000;

/// If we fail to get new data for this length of time,
/// clear the existing cache to prevent stale price data.
const FORCE_EXPIRY_MS = 120 * 1000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':
    process.env.NODE_ENV === 'production' ? 'https://*.bean.money ' : '*',
  'Access-Control-Allow-Headers':
    'Origin, X-Requested-With, Content-Type, Accept',
};

/**
 * Lookup ETH gas prices and the USD price of ETH via Etherscan's API.
 * Cache this value in the active serverless function's memory to reduce
 * repeated requests to Etherscan. Apply refresh logic to in-memory cache
 * to ensure data doesn't become stale.
 */
const _handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
    };
  }

  const now = new Date().getTime();
  const expired = !data || now - lastRefreshed > REFRESH_MS;

  if (expired) {
    try {
      const [arbEthPrice] = await Promise.all([
        axios.get<{ result: ArbiscanEthPriceResponse }>(
          `https://api.arbiscan.io/api?module=stats&action=ethprice&apikey=${process.env.VITE_ARBISCAN_API_KEY}`
        ),
      ]);
      lastRefreshed = new Date().getTime();
      data = {
        ethusd: arbEthPrice.data.result.ethusd,
        ethusdTimestamp: arbEthPrice.data.result.ethusd_timestamp,
        lastRefreshed: lastRefreshed.toString(),
      };
    } catch (e) {
      console.error(e);
      if (now - lastRefreshed > FORCE_EXPIRY_MS) {
        data = null;
      }
    }
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  };
};

export const handler = middy(_handler)
  .use(cors({ origin: '*.bean.money' }))
  .use(rateLimit());
