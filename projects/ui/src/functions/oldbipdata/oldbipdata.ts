import { Handler } from '@netlify/functions';
import * as fs from 'fs';
import middy from 'middy';
import path from 'path';
import { cors, rateLimit } from '../middleware';
import { oldBipList } from './oldBipList';

/**
 * Return BIP content for prior on-chain BIPs.
 */
const _handler: Handler = async (event) => {
  try {

    if (event.queryStringParameters?.getOldBip) {
      if (event.queryStringParameters?.getOldBip === 'all') {
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(oldBipList),
        };
      };

      const bipNumber = Number(event.queryStringParameters?.getOldBip);
      if (bipNumber >= 0) {
        const proposalBody = await new Promise((resolve, reject) => {
          fs.readFile(path.join(__dirname, `./bips/bip-${bipNumber}.md`), 'utf8', (err, data) => {
            if (err) {
              return reject(err);
            }
            resolve(data);
          });
        });

        const output = {
          ...oldBipList[bipNumber],
          body: proposalBody,
        };

        if (!proposalBody) {
          return {
            statusCode: 404,
          };
        }

        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(output),
        };
      };
    };

    return {
      statusCode: 400
    };

  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
    };
  }
};

export const handler = middy(_handler)
  .use(cors({ origin: '*.bean.money' }))
  .use(rateLimit());