export const memoize = (func: Function, expirationTime = Infinity) => {
  const cache: Record<string, any> = {};

  return function (...args: any) {
    const cacheKey = JSON.stringify(args);
    const cachedResult = cache[cacheKey];
    const now = new Date().getTime();

    if (cachedResult && now - cachedResult.timestamp < expirationTime * 1000) {
      return cachedResult.value;
    }

    const result = func.apply(undefined, args);
    cache[cacheKey] = { value: result, timestamp: now };

    return result;
  };
};
