import { createReducer } from '@reduxjs/toolkit';
import { getEventCacheId } from '~/util/State';
import { FarmerEvents } from '.';
import { ingestEvents, resetEvents } from './actions';

const initialState : FarmerEvents = {};

export default createReducer(initialState, (builder) =>
  builder
    .addCase(resetEvents, () => initialState)
    .addCase(ingestEvents, (state, { payload }) => {
      const id = getEventCacheId(payload.chainId, payload.account, payload.cache);
      if (!state[id]) {
        state[id] = {
          events: payload.events,
          endBlockNumber: payload.endBlockNumber,
          createdAt: new Date().getTime(),
          updatedAt: payload.timestamp,
        };
      } else {
        // edge case: duplicate events
        // FIXME: how should we handle this?
        const c = state[id]!; // assert exists
        if (payload?.startBlockNumber && payload.startBlockNumber <= c.endBlockNumber) {
          console.warn(`[events2] Cache ID ${payload.cache} previously searched for events through ${c.endBlockNumber}, but received a new payload with blocks starting at ${payload.startBlockNumber}. There may be duplicates.`);
        }
        state[id] = {
          ...c,
          events: [
            ...c.events,
            ...payload.events,
          ],
          endBlockNumber: payload.endBlockNumber,
          updatedAt:      payload.timestamp,
        };
      }
    })
);
