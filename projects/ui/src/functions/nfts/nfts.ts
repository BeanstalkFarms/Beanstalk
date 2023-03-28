import { Handler } from '@netlify/functions';
import middy from 'middy';
import { cors, rateLimit } from '~/functions/middleware';

const nftData = require('./nfts-genesis-winter.json');

/**
 * Return mintable NFTs for a provided `account`.
 * `nfts-genesis-winter` is a combined JSON that contains
 * information about mintable NFTs for both the Genesis
 * and Winter NFT colletions.
 */
const _handler: Handler = async (event) => {
  const account = event.queryStringParameters?.account?.toLowerCase();
  if (!account) {
    return {
      statusCode: 400,
      body: 'Account parameter required',
    };
  }
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(nftData[account] || []),
  };
};

export const handler = middy(_handler)
  .use(cors({ origin: '*.bean.money' }))
  .use(rateLimit());
