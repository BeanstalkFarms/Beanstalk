import { ApolloClient, ApolloLink, FieldPolicy, HttpLink, InMemoryCache } from '@apollo/client';
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

    console.debug(`[apollo/client/read@seasons] read first = ${first} startSeason = ${startSeason} for ${existing?.length || 0} existing items`, existing);

    if (!existing) return;

    let dataset;
    if (!first) {
      dataset = existing;
    } else {
      const maxSeason = Math.min(startSeason || existing.length, existing.length);

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
        0,                           // clamp to first index
        existing.length - maxSeason, //
      );

      // n = oldest season
      const right = Math.min(
        left + first - 1,            //
        existing.length - 1,         // clamp to last index
      );

      console.debug('[apollo/client/read@seasons] READ:');
      console.debug(`| left:  index = ${left}, season = ${readField('season', existing[left])}`);
      console.debug(`| right: index = ${right}, season = ${readField('season', existing[right])}`);
      console.debug(`| existing.length = ${existing.length}`);
      console.debug(`| existing[0] = ${readField('season', existing[0])}`, existing);
      console.debug(`| existing[${existing.length - 1}] = ${readField('season', existing[existing.length - 1])}`);

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
    console.debug(`[apollo/client/merge@seasons] ${fieldName}(${JSON.stringify(args)}): Merging ${incoming?.length || 0} incoming data points into ${existing?.length || 0} existing data points.`, { existing, incoming, args });

    // Slicing is necessary because the existing data is
    // immutable, and frozen in development.
    let merged = existing ? existing.slice(0).reverse() : [];

    // Seasons are indexed by season (could also parseInt the "id" field)
    // This structures stores seasons in ascending order such that
    // merged[0] = undefined
    // merged[1] = Season 1
    // merged[2] = ...
    for (let i = 0; i < incoming.length; i += 1) {
      const season = readField('season', incoming[i]);
      if (!season) throw new Error('Seasons queried without season');
      // Season 1 = Index 0
      merged[(season as number) - 1] = incoming[i];
    }

    merged = merged.reverse();

    console.debug(`[apollo/client/merge@seasons] ${fieldName}(${JSON.stringify(args)}:) Merged into ${merged.length} points.`, { merged });

    // We complete operations on the array in ascending order,
    // but reverse it before saving back to the cache.
    // Reverse is O(n) while sorting during the read operation
    // is O(n*log(n)) and likely called more often.
    // return merged.reverse();
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
        siloYields: mergeUsingSeasons([]),
      }
    }
  }
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

const beanstalkLink = new HttpLink({
  uri: sgEnv.subgraphs.beanstalk,
});

const beanLink = new HttpLink({
  uri: sgEnv.subgraphs.bean,
});

const snapshotLink = new HttpLink({
  uri: 'https://hub.snapshot.org/graphql',
});

/// ///////////////////////// Client ////////////////////////////

export const apolloClient = new ApolloClient({
  link: ApolloLink.split(
    (operation) => operation.getContext().subgraph === 'bean',
    beanLink, // true
    ApolloLink.split(
      (operation) => operation.getContext().subgraph === 'snapshot',
      snapshotLink, // true
      beanstalkLink, // false
    ),
  ),
  cache,
});
