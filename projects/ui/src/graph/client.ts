import {
  ApolloClient,
  ApolloLink,
  FieldPolicy,
  HttpLink,
  InMemoryCache,
} from '@apollo/client';
import { LocalStorageWrapper, persistCacheSync } from 'apollo3-cache-persist';
import { SGEnvironments, SUBGRAPH_ENVIRONMENTS } from '~/graph/endpoints';
import store from '~/state';
import { exists } from '~/util';
import { binarySearchSeasons } from '~/util/Graph';

/// ///////////////////////// Field policies ////////////////////////////

// prettier-ignore
const mergeUsingSeasons: (keyArgs: string[]) => FieldPolicy = (keyArgs) => ({
  keyArgs,
  read(existing, { args, readField }) {
    if (!existing) return;

    const first = args?.first as number | undefined;
    const season_lte = args?.where?.season_lte as number | undefined;
    const seasonGt = args?.where?.season_gt as number | undefined;
    const seasonGte = args?.where?.season_gte as number | undefined;

    const season_gt = seasonGt ?? ((seasonGte && typeof seasonGte === 'number') ? seasonGte - 1 : undefined);

    console.debug(
      `[apollo/client/read@seasons] first=${first}, season_lte=${season_lte}, season_gt=${seasonGt}, season_gte=${seasonGte} for ${existing?.length || 0} existing items`,
      existing
    );

    let data: any[] | undefined = [];

    // Prepare seasons array. We know that this is in descending order.
    const seasons: number[] = [];
    for (const item of existing) {
      const season = readField('season', item) as number;
      if (exists(season) && season > 0) {
        seasons.push(season);
      }
    }

    // Function to compare seasons in descending order
    const compareDesc = (season: number, target: number) => season - target;

    // Find the start index
    let startIndex = 0;
    if (season_lte !== undefined) {
      startIndex = binarySearchSeasons<number>(seasons, season_lte, compareDesc);
    }

    // Find the end index
    let endIndex = existing.length - 1;
    if (season_gt !== undefined) {
      endIndex = binarySearchSeasons<number>(seasons, season_gt, compareDesc) + 1;
    }

    // Ensure indices are within bounds
    startIndex = Math.max(0, startIndex);
    endIndex = Math.min(existing.length - 1, endIndex);

    // Slice the array
    const slicedData = existing.slice(startIndex, endIndex + 1);

    // Return the first N items
    const _data = first ? slicedData.slice(0, first) : slicedData;
    if (exists(first) && first > 1000) {
      console.debug('[apollo/client/read@seasons] cache', {
        first,
        season_gt,
        startIndex,
        endIndex,
        existing,
        slicedData,
        _data,
      });
      data = slicedData;
    } else {
      data = first && Array.isArray(_data) && _data.length === first ? _data : undefined;
    }

    console.debug(
      `[apollo/client/read@seasons] read ${data?.length} items`,
      data
    );

    // Return undefined if no data is found.
    return data;
  },
  merge(existing = [], incoming, { fieldName, args, readField }) {
    // Ensure that this merge function maintains the 'existing' data points in sorted order.
    // Time complexity is O(n + m) where n and m are the lengths of the existing and incoming arrays.
    // We make sure it's in descending order so we can utilize binary search in the read function.

    console.debug(
      `[apollo/client/merge@seasons] ${fieldName}(${JSON.stringify(args)}): Merging ${incoming?.length || 0} incoming data points into ${existing?.length || 0} existing data points.`,
      { existing, incoming, args }
    );

    const merged = [];

    let i = 0; // index for existing
    let j = 0; // index for incoming

    // Iterate through both arrays and merge them
    while (i < existing.length && j < incoming.length) {
      const seasonExisting = readField('season', existing[i]) as number;
      const seasonIncoming = readField('season', incoming[j]) as number | undefined;

      // Skip undefined items with season below 0
      if (!exists(seasonIncoming) || seasonIncoming < 0) {
        j += 1;
        continue;
      }

      if (seasonExisting > seasonIncoming) {
        merged.push(existing[i]);
        i += 1;
      } else if (seasonExisting < seasonIncoming) {
        merged.push(incoming[j]);
        j += 1;
      } else {
        // Seasons are equal, prefer incoming data
        merged.push(incoming[j]);
        i += 1;
        j += 1;
      }
    }

    // Add any remaining items
    while (i < existing.length) {
      merged.push(existing[i]);
      i += 1;
    }

    while (j < incoming.length) {
      const seasonIncoming = readField('season', incoming[j]) as number;
      if (exists(seasonIncoming) && seasonIncoming > 0) {
        merged.push(incoming[j]);
      }
      j += 1;
    }

    // prettier-ignore
    console.debug(
      `[apollo/client/merge@seasons] ${fieldName}(${JSON.stringify(args)}): Merged into ${merged.length} points.`,
      { merged }
    );

    return merged;
  },
});

/// ///////////////////////// Cache Persistence ////////////////////////////

const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        seasons: mergeUsingSeasons([]),
        fieldHourlySnapshots: mergeUsingSeasons([]),
        beanHourlySnapshots: mergeUsingSeasons([]),
        siloAssetHourlySnapshots: mergeUsingSeasons(['$siloAsset']),
        siloHourlySnapshots: mergeUsingSeasons([]),
        poolHourlySnapshots: mergeUsingSeasons(['$pool']),
        // siloYields: mergeUsingSeasons([]),
      },
    },
  },
});

try {
  persistCacheSync({
    cache,
    storage: new LocalStorageWrapper(window.localStorage),
    trigger: 'write',
    debounce: 500,
  });
} catch (e) {
  console.error('Failed to persist cache, skipping.');
}

/// ///////////////////////// Links ////////////////////////////

export let sgEnvKey = SGEnvironments.BF_PROD;
export let sgEnv = SUBGRAPH_ENVIRONMENTS[sgEnvKey];

const SNAPSHOT_API_KEY = import.meta.env.VITE_SNAPSHOT_API_KEY;
if (!SNAPSHOT_API_KEY) throw new Error('Missing SNAPSHOT_API_KEY');

try {
  const sgEnvInState = store.getState().app.settings.subgraphEnv;
  // Verify that this version is still supported.
  if (SUBGRAPH_ENVIRONMENTS[sgEnvInState]) {
    sgEnvKey = sgEnvInState;
    sgEnv = SUBGRAPH_ENVIRONMENTS[sgEnvInState];
  }
} catch (e) {
  console.warn('Failed to read subgraph env from state, skipping.');
}

// Beanstalk
const beanstalkLinks = {
  eth: new HttpLink({
    uri: sgEnv.subgraphs.beanstalk_eth,
  }),
  arb: new HttpLink({
    uri: sgEnv.subgraphs.beanstalk,
  }),
};

// Bean
const beanLinks = {
  eth: new HttpLink({
    uri: sgEnv.subgraphs.bean_eth,
  }),
  arb: new HttpLink({
    uri: sgEnv.subgraphs.bean,
  }),
};

// BS3TODO: Is this dfferent for Arbitrum?
const snapshotLink = new HttpLink({
  uri: 'https://hub.snapshot.org/graphql',
  headers: {
    'x-api-key': SNAPSHOT_API_KEY,
  },
});

// BS3TODO: Is this dfferent for Arbitrum?
const snapshotLabsLink = new HttpLink({
  uri: `https://gateway-arbitrum.network.thegraph.com/api/${import.meta.env.VITE_THEGRAPH_API_KEY}/subgraphs/id/5MkoYVE5KREBTe2x45FuPdqWKGc2JgrHDteMzi6irSGD`,
});

// BS3TODO: Do we need to keep this?
const beanftLink = new HttpLink({
  uri: sgEnv.subgraphs.beanft,
});

/// ///////////////////////// Client ////////////////////////////

export const apolloClient = new ApolloClient({
  connectToDevTools: true,
  link: ApolloLink.split(
    ({ getContext }) => getContext().subgraph === 'bean_eth',
    beanLinks.eth, // true
    ApolloLink.split(
      ({ getContext }) => getContext().subgraph === 'beanstalk_eth',
      beanstalkLinks.eth, // true
      ApolloLink.split(
        ({ getContext }) => getContext().subgraph === 'snapshot',
        snapshotLink, // true
        ApolloLink.split(
          ({ getContext }) => getContext().subgraph === 'snapshot-labs',
          snapshotLabsLink, // true
          ApolloLink.split(
            // BS3TODO: Do we need to keep beaNFT support?
            ({ getContext }) => getContext().subgraph === 'beanft_eth',
            beanftLink, // true
            ApolloLink.split(
              ({ getContext }) => getContext().subgraph === 'bean',
              beanLinks.arb, // true
              beanstalkLinks.arb // false
            )
          )
        )
      )
    )
  ),
  cache,
});
