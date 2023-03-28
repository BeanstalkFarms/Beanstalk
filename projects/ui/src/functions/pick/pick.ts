import { Handler } from '@netlify/functions';
import middy from 'middy';
import { cors, rateLimit } from '~/functions/middleware';

const unripeBean     = require('./unripe-beans-merkle.json');
const unripeBean3CRV = require('./unripe-bean3crv-merkle.json');

export type MerkleLeaf = {
  amount: string;
  leaf: string;
  proof: string[];
}

export type PickMerkleResponse = {
  bean: MerkleLeaf | null;
  bean3crv: MerkleLeaf | null;
}

/**
 * Lookup Merkle leaves for a given `account`.
 */
const _handler : Handler = async (event) => {
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
    body: JSON.stringify({
      bean:     unripeBean[account]     || null,
      bean3crv: unripeBean3CRV[account] || null,
    }),
  };
};

export const handler = middy(_handler)
  .use(cors({ origin: '*.bean.money' }))
  .use(rateLimit());
