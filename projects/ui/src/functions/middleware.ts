import middy from 'middy';
import httpErrorHandler from '@middy/http-error-handler';
import httpCors from '@middy/http-cors';
import { Event } from '@netlify/functions/dist/function/event';
import { Response } from '@netlify/functions/dist/function/response';
import LRL from 'lambda-rate-limiter';
import createError from 'http-errors';

const checkRateLimit = LRL({ interval: 60 * 1000 }).check;

export const rateLimit = (max = 12) : middy.MiddlewareObject<Event, Response> => ({
  before: async (request, next) => {
    const ip = request.event.headers['x-nf-client-connection-ip'] || request.event.headers['client-ip'];
    if (!ip) throw new createError.InternalServerError();
    try {
      await checkRateLimit(max, ip);
    } catch (error) {
      throw new createError.TooManyRequests();
    }
    next();
  },
  onError: async (handler) => {
    handler.response.statusCode = (handler.error as createError.HttpError).statusCode;
  }
});

export { httpErrorHandler };
export { httpCors as cors };
