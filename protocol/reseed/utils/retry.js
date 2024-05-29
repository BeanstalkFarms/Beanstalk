const withRetryHandling = (callback, {
    baseDelay = 400,
    logger = console,
    numberOfTries = 3,
  } = {}) => function callbackWithRetryHandling(...params) {
    const retry = async (attempt = 1) => {
      try {
        return await callback(...params);
      } catch (error) {
        if (attempt >= numberOfTries) throw error;
  
        // Use an increasing delay to prevent flodding the
        // server with requests in case of a short downtime.
        const delay = baseDelay * attempt;
  
        if (logger) logger.warn('Retry because of', error);
  
        return new Promise(resolve => setTimeout(() => resolve(retry(attempt + 1)), delay));
      }
    };
  
    return retry();
  };

  exports.wrapWithRetryHandling = withRetryHandling