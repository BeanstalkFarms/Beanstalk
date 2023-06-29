import middy from 'middy';
import { Handler } from '@netlify/functions';
import { cors, rateLimit } from '~/functions/middleware';

const deposits = require('./data/deposits.json');
const merkle = require('./data/merkle.json');

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
    body: JSON.stringify({
      deposits: deposits[account] || {},
      merkle: merkle[account] || {},
    }),
  };
};

export const handler = middy(_handler)
  .use(rateLimit())
  .use(
    cors({
      origin: process.env.NODE_ENV === 'production' ? '*.bean.money' : '*',
    })
  );
