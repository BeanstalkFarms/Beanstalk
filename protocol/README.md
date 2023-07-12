<img src="https://github.com/BeanstalkFarms/Beanstalk-Brand-Assets/blob/main/BEAN/bean-128x128.png" alt="Beanstalk logo" align="right" width="120" />

# Beanstalk Protocol

[![Discord][discord-badge]][discord-url]

[discord-badge]: https://img.shields.io/discord/880413392916054098?label=Beanstalk
[discord-url]: https://discord.gg/beanstalk

Code Version: `2.3.1` <br>
Whitepaper Version: `2.3.0`

## About

This repository contains the code base for the Beanstalk protocol, all of its facets and related contracts in the Beanstalk ecosystem.

- [EIP-2535 Diamond](#eip-2535-diamond)
- [Setup](#setup)
- [Developing](#developing)
- [Testing a BIP](#testing-a-bip)
- [License](#license)

## EIP-2535 Diamond

The Beanstalk contract is a multi-facet proxy that implements [EIP-2535](https://eips.ethereum.org/EIPS/eip-2535). Thus, the Beanstalk contract implements functionality from multiple different Facet contracts that all share a common storage.

- [Beanstalk EIP-2535 Diamond Documentation](https://docs.bean.money/developers/overview/eip-2535-diamond)
- [Current Beanstalk Facets](https://docs.bean.money/almanac/protocol/contracts#diamond)
- [Beanstalk on Louper, The Ethereum Diamond Inspector](https://louper.dev/diamond/0xc1e088fc1323b20bcbee9bd1b9fc9546db5624c5)

# Getting Started

## Prerequistes

- [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
  - You'll know you did it right if you can run `git --version` and you see a response like `git version x.x.x`
- [Nodejs](https://nodejs.org/en/)
  - You'll know you've installed nodejs right if you can run `node --version`and get an ouput like: `vx.x.x`
- [Yarn](https://classic.yarnpkg.com/lang/en/docs/install/)
  - You'll know you've installed yarn right if you can run `yarn --version` And get an output like: `x.x.x`

## Installation

_Note: The Beanstalk repo is a monorepo with induvidual projects inside it. See the `DEVELOPER.md` in the root directory for more information._

1. Clone the repository and install dependencies

```bash
git clone https://github.com/BeanstalkFarms/Beanstalk
cd Beanstalk/protocol
yarn
```

2. Compile the contracts

```
yarn hardhat compile
```

## Quickstart

### Testing

1. Ensure you are in the `protocol` directory
2. Have a [FORKING_RPC](https://hardhat.org/hardhat-network/docs/guides/forking-other-networks) as an [environment variable](https://www.npmjs.com/package/dotenv) pointing to ETH Mainnet.
   1. _We fork ETH Mainnet to run our test suite locally. Note, this will make a large number of API calls to your `FORKING_RPC`_
3. Run all tests

```bash
yarn test
```

4. Generate coverage report

```bash
yarn hardhat coverage
```

### Forking Mainnet Locally

We elect to use `anvil` instead of `hardhat` for local node forking as `anvil` is considerably faster than `hardhat` and properly caches the blockchain locally.

1. Ensure you are in the `/protocol` repository
2. Install [Foundry](https://book.getfoundry.sh/getting-started/installation)

```bash
# Be sure to use the official docs linked above if this doesn't work
curl -L https://foundry.paradigm.xyz | bash
```

3. Close and re-open your terminal to ensure foundry is installed correctly
   1. _You may need to update your path._
4. Run `foundryup` to ensure you have downloaded the latest version
5. Start a locally forked node with the following command:

```bash
anvil --fork-url <FORKING_RPC> --fork-block-number <BLOCK_NUMBER> --chain-id 1337
```

For `<FORKING_RPC>`, use an Alchemy or Infura RPC URL. It should be very clear if the node starts up properly.

**Note: `anvil` will cache the blockchain provided that `BLOCK_NUMBER` does NOT change. Given this, we recommend picking a block and sticking to it.**

## Developing

### Overview

As Beanstalk implements EIP-2535, Beanstalk is upgraded through a `diamondCut` function call.

There are two different ways a `diamondCut` can execute code:

1. Adding, replacing and/or removing functions
   - Functions in Beanstalk are implemented in contracts known as `facets`. Facets are no different than normal smart contract with callable functions. In order to share a state, Facets can only define 1 internal state variable: The `AppStorage` struct defined in `AppStorage.sol`. Read more [here](https://docs.bean.money/developers/overview/app-storage).
2. Calling the `init` function of a contract
   - This is a one time action and will be called when the `diamondCut` is executed. There can be 1 `init` call per `diamondCut`.

### Creating a New Facet

For this tutorial, we will create a new Facet called `SampleFacet`.

1. Ensure you are in the `protocol` directory
2. In `protocol/farm/facets/`, create a new folder called `SampleFacet`
3. Within the `SampleFacet` folder create a file called `SampleFacet.sol`.
4. Implement your Facet. You can use `SampleFacet.sol` in `protocol/samples` as a template. Note that Facets can only have `AppStorage` as an internal state variable.
5. Modify the `deploy` function in `scripts/deploy` to include your new Facet, so that the Facet will be deployed with the Beanstalk Diamond.

## Testing a BIP

### Overview

There are a couple of steps that must be done before forking mainnet and testing a BIP.

1. Include the following code in the `networks` section of the hardhat.config.js, where `RPC_URL` is your RPC url. We recommend using Alchemy for this. The `BLOCK_NUMBER` is optional, but we recommend choosing a block number close to the current block.
   ```javascript
   forking: {
       url: <RPC_URL>,
       blockNumber: <BLOCK_NUMBER>
     },
   ```
   ```javascript
   localhost: {
     chainId: 1337,
     url: "http://127.0.0.1:8545",
     forking: {
       url: <RPC_URL>,
       blockNumber: <BLOCK_NUMBER>
     },
   },
   ```
2. Include as imports:

   ```javascript
   const BEANSTALK = "0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5";
   const ownerFacet = await ethers.getContractAt("OwnershipFacet", BEANSTALK);
   const owner = await ownerFacet.owner();
   const { upgradeWithNewFacets } = require("./scripts/diamond.js");
   ```

3. Lastly, include the tasks required for upgrading above `module.exports`:
   ```javascript
   task("upgrade", "Commits a bip", async () => {
     await hre.network.provider.request({
       method: "hardhat_impersonateAccount",
       params: [owner]
     });
     const account = await ethers.getSigner(owner);
     await upgradeWithNewFacets({
       diamondAddress: BEANSTALK,
       facetNames: [],
       initFacetName: "InitEmpty",
       initArgs: [],
       bip: false,
       verbose: true,
       account: account
     });
   });
   ```
4. Here is an example of what BIP-11 deployment looked like:
   ```javascript
   await upgradeWithNewFacets({
     diamondAddress: BEANSTALK,
     initFacetName: "InitBip11",
     facetNames: ["MarketplaceFacet"],
     libraryNames: ["LibClaim"],
     facetLibraries: {
       MarketplaceFacet: ["LibClaim"]
     },
     bip: false,
     verbose: true,
     account: account
   });
   ```

### Running the Upgrade Tasks

1. Spin up your mainnet fork node with:

   ```bash
   yarn hardhat node
   ```

2. In another console, execute your tasks against your mainnet fork by running:

   ```bash
   yarn hardhat upgrade --network localhost
   ```

   Where `upgrade` is where you put the name of your task (in the example above it was named upgrade).

3. Now you can test your changes using your local mainnet fork that should now have the latest version
   of Beanstalk that you upgraded.

## License

[MIT](https://github.com/BeanstalkFarms/Beanstalk/blob/master/LICENSE.txt)