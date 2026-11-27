<img src="https://github.com/BeanstalkFarms/Beanstalk-Brand-Assets/blob/main/BEAN/bean-128x128.png" alt="Beanstalk logo" align="right" width="120" />

## Beanstalk UI


**An interface for the Beanstalk Protocol: [app.bean.money](https://app.bean.money)**

## Getting started

### Installation
```
# Install packages
yarn install

# Build the SDKs
yarn all:build

# Generate typed contracts and queries
yarn generate

# Start development server at http://localhost:4173/
# See below for environment vars
yarn start

# Or: run frontend & serverless functions at http://localhost:8888/
yarn dev

# Build and run a static copy of the site
yarn build && yarn serve
```

Serverless functions are built for deployment to Netlify. See the [Netlify CLI docs](https://docs.netlify.com/cli/get-started/) to get started.

### GraphQL schemas

Normal UI and SDK builds generate types from the committed schemas in `src/graph/`;
they do not fetch schemas from live APIs. The SDK uses the same Beanstalk snapshot.
After an intentional API schema change, refresh from this workspace:

```sh
yarn refresh:graphql
yarn generate:graphql
# From the repository root:
yarn sdk:generate
node --test scripts/offline-build.test.mjs
```

Review and commit the refreshed schema files together with any query changes.
The refresh command requires the configured endpoints to be available and exits
with an error if any refresh fails; review partial output before committing.
Snapshot2 remains a checked-in legacy schema because its endpoint is retired.
Builds still validate GraphQL documents, generate contract types, and run TypeScript.

### Environment
```
# .env.local
# This is the minimum required configuration. 
# See `src/.env.d.ts` for a full list of supported env vars.
VITE_ALCHEMY_API_KEY=[your api key]
ETHERSCAN_API_KEY=[your api key]
```

### Development

When developing, it's recommended to use a local fork of Ethereum. See [Beanstalk / Forking Mainnet Locally](https://github.com/BeanstalkFarms/Beanstalk#forking-mainnet-locally) for instructions.

### Testing

Unit tests are executed using [Vitest](https://vitest.dev/).

```
yarn test
```
