import { Event } from '~/lib/Beanstalk/EventProcessor';

export enum EventCacheName {
  SILO = 'silo',
  FIELD = 'field',
  FERTILIZER = 'fert',
  MARKET = 'market',
}

export type FarmerEvents = {
  [id: string] : {
    /**
     * The block number at which we last stopped searching. 
     * This is NOT the last block where an event occurred.
     */
    endBlockNumber: number;
    /** When this cache was created. */
    createdAt: number;
    /** When this cache was last updated. */
    updatedAt: number;
    /** All events stored in this cache. */
    events: Event[];
  };
};
