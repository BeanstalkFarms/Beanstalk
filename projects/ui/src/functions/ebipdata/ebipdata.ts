import { Handler } from '@netlify/functions';
import * as fs from 'fs';
import middy from 'middy';
import path from 'path';
import { cors, rateLimit } from '../middleware';
import { ebipList } from './ebipList';

/**
 * Return EBIP content.
 */
const _handler: Handler = async (event) => {
  try {

    if (event.queryStringParameters?.getEbip) {
      if (event.queryStringParameters?.getEbip === 'all') {
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(ebipList),
        };
      };

      const ebipNumber = Number(event.queryStringParameters?.getEbip);
      if (ebipNumber >= 0) {
        const ebipBody = await new Promise((resolve, reject) => {
          fs.readFile(path.join(__dirname, `./ebips/ebip-${ebipNumber}.md`), 'utf8', (err, data) => {
            if (err) {
              return reject(err);
            }
            resolve(data);
          });
        });

        const output = {
          ...ebipList[ebipNumber],
          body: ebipBody,
        };
    
        if (!ebipBody) {
          return {
            statusCode: 404,
          };
        };
    
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