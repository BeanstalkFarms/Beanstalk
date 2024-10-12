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

/// ///////////////////////// Field policies ////////////////////////////

const mergeUsingSeasons: (keyArgs: string[]) => FieldPolicy = (keyArgs) => ({
  // Don't cache separate results based on
  // any of this field's arguments.
  keyArgs,

  /**
   */
  read(existing, { args, readField }) {
    const first = args?.first;
    const startSeason = args?.where?.season_lte; // could be larger than the biggest season

    console.debug(
      `[apollo/client/read@seasons] read first = ${first} startSeason = ${startSeason} for ${
        existing?.length || 0
      } existing items`,
      existing
    );

    if (!existing) return;

    let dataset;
    if (!first) {
      dataset = existing;
    } else {
      const maxSeason = Math.min(
        startSeason || existing.length,
        existing.length
      );

      // 0 = latest season; always defined
      // maxSeason = 6073
      // existing.length = 6074
      // left = 1
      // right = 1+1000 = 1001
      //
      // Length 6074
      // -----------
      // 0    6074
      // 1    6073
      // ....
      // 6071 2
      // 6072 1
      // 6073 0 (this doesnt exist)
      const left = Math.max(
        0, // clamp to first index
        existing.length - maxSeason //
      );

      // n = oldest season
      const right = Math.min(
        left + first - 1, //
        existing.length - 1 // clamp to last index
      );

      // If one of the endpoints is missing, force refresh
      if (!existing[left] || !existing[right]) return;

      // first = 1000
      // existing.length = 6074
      // startIndex = 5074
      // endIndex = 6074
      dataset = existing.slice(left, right + 1); // slice = [left, right)
    }

    return dataset;
  },
  merge(existing = [], incoming, { fieldName, args, readField }) {
    console.debug(
      `[apollo/client/merge@seasons] ${fieldName}(${JSON.stringify(
        args
      )}): Merging ${incoming?.length || 0} incoming data points into ${
        existing?.length || 0
      } existing data points.`,
      { existing, incoming, args }
    );

    // Create a map to store unique snapshots
    const snapshotsMap = new Map();
    const addToMap = (items: any[]) => {
      items.forEach((item) => {
        const id = readField('id', item);
        const key = `${id}`;
        snapshotsMap.set(key, item);
      });
    };

    if (existing) {
      addToMap(existing);
    }

    // Add incoming items to the map
    if (incoming) {
      addToMap(incoming);
    }

    // Return an array of unique snapshots
    const merged = Array.from(snapshotsMap.values()).sort((a, b) => {
      const aSeason = readField('season', a);
      const bSeason = readField('season', b);
      if (!aSeason) return -1;
      if (!bSeason) return 1;
      return parseFloat(b.season) - parseFloat(a.season);
    });

    console.debug(
      `[apollo/client/merge@seasons] ${fieldName}(${JSON.stringify(
        args
      )}:) Merged into ${merged.length} points.`,
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
