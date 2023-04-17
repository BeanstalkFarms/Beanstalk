import { Handler } from '@netlify/functions';
import { ethers } from 'ethers';
import middy from 'middy';
import { BEANSTALK_PRICE_ADDRESSES } from '~/constants/addresses';
import { cors, rateLimit } from '~/functions/middleware';
import { BeanstalkPrice__factory } from '~/generated';

const provider = new ethers.providers.AlchemyProvider(1, process.env.VITE_ALCHEMY_API_KEY);
const address  = BEANSTALK_PRICE_ADDRESSES[1];
const contract = BeanstalkPrice__factory.connect(address, provider);

/**
 * Return a JSON version of the Beanstalk price contract's
 * `price()` struct. This should only be used for display purposes.
 */
const _handler: Handler = async () => {
  try {
    const bp = await contract.price();
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        price:      bp.price.toString(),
        liquidity:  bp.liquidity.toString(),
        deltaB:     bp.deltaB.toString(),
        ps: bp.ps.map((pool) => ({
          pool:       pool.pool,
          tokens:     pool.tokens.map((token) => token.toString()),
          balances:   pool.balances.map((balance) => balance.toString()),
          price:      pool.price.toString(),
          liquidity:  pool.liquidity.toString(),
          deltaB:     pool.deltaB.toString(),
        }))
      }),
    };
  } catch (e: any) {
    console.error(e);
    return {
      statusCode: 403,
      body: e?.toString()
    };
  }
};

export const handler = middy(_handler)
  .use(cors({ origin: '*' }))
  .use(rateLimit());
