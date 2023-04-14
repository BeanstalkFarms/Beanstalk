import { createAction } from '@reduxjs/toolkit';
import { Event } from '~/lib/Beanstalk/EventProcessor';
import { EventCacheName } from '.';

export type IngestPayload = {
  // Cache selectors
  cache:   EventCacheName;
  account: string;
  chainId: number;
  // Results
  startBlockNumber: number | undefined;
  endBlockNumber: number;
  timestamp: number;
  events: Event[];
}

export const ingestEvents = createAction<IngestPayload>(
  'farmer/events2/ingest'
);

export const resetEvents = createAction(
  'farmer/events2/reset'
);
