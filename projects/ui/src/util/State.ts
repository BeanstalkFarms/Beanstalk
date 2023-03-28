import { ethers } from 'ethers';
import { EventCacheName, FarmerEvents } from '~/state/farmer/events2';

/**
 * Return the key at which Farmer events should be held in localStorage.
 * @param chainId
 * @param account 
 * @param cacheId 
 * @returns string
 */
export const getEventCacheId = (
  chainId: number,
  account: string,
  cacheId: EventCacheName
) => `${chainId}-${account.toLowerCase()}-${cacheId}`;

export const clearApolloCache = () => {
  localStorage.removeItem('apollo-cache-persist');
  window?.location.reload();
};

/**
 * Load Redux state from localStorage.
 * @unused
 */
export const loadState = () => {
  try {
    const serializedState = localStorage.getItem('beanstalk.s');
    if (serializedState === null) {
      return undefined;
    }
    return JSON.parse(serializedState);
  } catch (err) {
    console.warn('Failed to load state');
    return undefined;
  }
};

/**
 * Save Redux state to localStorage.
 * @unused
 * @param state 
 */
export const saveState = (state: any) => {
  if (state.app.settings) {
    try {
      const serializedState = JSON.stringify({ app: { settings: state.app.settings } });
      localStorage.setItem('beanstalk.s', serializedState);
    } catch (err) {
      // pass
      console.warn('Failed to save state');
    }
  }
};

/**
 * Rehydrate BigNumbers from stored value in Redux
 * @unused
 */
export const rehydrateEvents2 = (events2: FarmerEvents | undefined) => {
  try {
    if (!events2) return;
    const cache = { ...events2 };
    Object.keys(cache).forEach((key) => {
      if (cache[key].events?.length > 0) {
        cache[key].events = cache[key].events.map((event) => ({
            ...event,
            args: event.args?.map((arg: any) => {
              if (typeof arg === 'object' && arg.type === 'BigNumber') {
                return ethers.BigNumber.from(arg.hex);
              }
              return arg;
            }) || [],
          }));
      }
    });
    return cache;
  } catch (err) {
    console.error(err);
    return {}; //
  }
};
