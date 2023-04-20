import middy from 'middy';
import { Handler } from '@netlify/functions';
import { cors, rateLimit } from '~/functions/middleware';

const unripe = require('./unripe.json');

/**
 * Lookup Unripe Bean and Unripe LP count for the provided `account`.
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
    body: JSON.stringify(unripe[account] || {}),
  };
};

export const handler = middy(_handler)
  .use(cors({ origin: '*.bean.money' }))
  .use(rateLimit());
