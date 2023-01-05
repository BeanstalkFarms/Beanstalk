<img src="src/img/tokens/bean-logo-circled.svg" alt="Beanstalk logo" align="right" width="120" />

## Beanstalk UI

[![Discord][discord-badge]][discord-url]

[discord-badge]: https://img.shields.io/discord/880413392916054098?label=Beanstalk
[discord-url]: https://discord.gg/beanstalk

**An interface for the Beanstalk Protocol: [app.bean.money](https://app.bean.money)**

## Getting started

### Installation
```
# Install packages
yarn install

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