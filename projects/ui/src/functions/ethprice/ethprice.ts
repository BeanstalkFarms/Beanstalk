import { Handler } from '@netlify/functions';
import axios from 'axios';
import middy from 'middy';
import { cors, rateLimit } from '~/functions/middleware';

/// https://docs.etherscan.io/api-endpoints/gas-tracker#get-gas-oracle
type EtherscanGasOracleResponse = {
  LastBlock: string;
  SafeGasPrice: string;
  ProposeGasPrice: string;
  FastGasPrice: string;
  suggestBaseFee: string;
  gasUsedRatio: string;
}

/// https://docs.etherscan.io/api-endpoints/stats-1#get-ether-last-price
type EtherscanEthPriceResponse = {
  ethbtc: string;
  ethbtc_timestamp: string;
  ethusd: string;
  ethusd_timestamp: string;
}

export type EthPriceResponse = {
  block: string;
  gas: {
    safe: string;
    propose: string;
    fast: string;
    suggestBaseFee: string;
  };
  ethusd: string;
  ethusdTimestamp: string;
  lastRefreshed: string
}

let data : null | EthPriceResponse = null;
let lastRefreshed = new Date().getTime();

/// Allow a refresh every 10s (~1 block)
const REFRESH_MS = 10 * 1000;

/// If we fail to get new data for this length of time,
/// clear the existing cache to prevent stale price data.
const FORCE_EXPIRY_MS = 120 * 1000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production' ? 'https://*.bean.money ' : '*',
  'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
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
  const expired = (!data || ((now - lastRefreshed) > REFRESH_MS));

  if (expired) {
    try {
      const [gasoracle, ethprice] = await Promise.all([
        axios.get<{ result: EtherscanGasOracleResponse }>(`https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${process.env.ETHERSCAN_API_KEY}`).then((r) => r.data.result),
        axios.get<{ result: EtherscanEthPriceResponse }>(`https://api.etherscan.io/api?module=stats&action=ethprice&apikey=${process.env.ETHERSCAN_API_KEY}`).then((r) => r.data.result)
      ]);
      lastRefreshed = new Date().getTime();
      data = {
        block: gasoracle.LastBlock,
        gas: {
          safe: gasoracle.SafeGasPrice,
          propose: gasoracle.ProposeGasPrice,
          fast: gasoracle.FastGasPrice,
          suggestBaseFee: gasoracle.suggestBaseFee,
        },
        ethusd: ethprice.ethusd,
        ethusdTimestamp: ethprice.ethusd_timestamp,
        lastRefreshed: lastRefreshed.toString(),
      };
    } catch (e) {
      console.error(e);
      if ((now - lastRefreshed) > FORCE_EXPIRY_MS) {
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
