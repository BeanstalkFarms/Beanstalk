import { EventManager } from '@beanstalk/sdk';
import { createAction } from '@reduxjs/toolkit';

export type IngestPayload = {
  // Cache selectors
  cache: string;
  account: string;
  chainId: number;
  // Results
  startBlockNumber: number | undefined;
  endBlockNumber: number;
  timestamp: number;
  events: EventManager.Event[];
};

export const ingestEvents = createAction<IngestPayload>(
  'farmer/events2/ingest'
);

export const resetEvents = createAction('farmer/events2/reset');
