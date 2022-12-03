<img src="https://github.com/BeanstalkFarms/Beanstalk-Assets/blob/main/BEAN/bean-128x128.png" alt="Beanstalk logo" align="right" width="120" />

# Beanstalk

[![Discord][discord-badge]][discord-url]

[discord-badge]: https://img.shields.io/discord/880413392916054098?label=Beanstalk
[discord-url]: https://discord.gg/beanstalk

Code Version: `2.3.0` <br>
Whitepaper Version `2.3.0`

Beanstalk is a permissionless fiat stablecoin protocol built on Ethereum.

This repository contains the code base for the Beanstalk protocol, all of its facets and related contracts in the Beanstalk ecosystem.

- [Documentation](#documentation)
- [Bug Bounty Program](#bug-bounty-program)
- [Contracts](#contracts)
- [EIP-2535 Diamond](#eip-2535-diamond)
- [Setup](#setup)
- [Developing](#developing)
- [Testing a BIP](#testing-a-bip)
- [License](#license)

## Documentation

Conceptual documentation on Beanstalk can be found in the [Farmers' Almanac](https://docs.bean.money/almanac). <br>
Technical documentation on Beanstalk can be found in the [Agronomics Handbook](https://docs.bean.money/developers).

The latest version of the Beanstalk Whitepaper is available [here](https://bean.money/beanstalk.pdf).

## Bug Bounty Program

The Beanstalk DAO partnered with Immunefi to launch a bug bounty program with rewards up to **1.1M Beans**.

You can find the bug bounty program and submit bug reports [here](https://immunefi.com/bounty/beanstalk).

## Contracts

A comprehensive list of contract addresses related to Beanstalk is available [here](https://docs.bean.money/almanac/protocol/contracts).

|       Contract               |              Address 
|:-----------------------------|:-----------------------------------------------------------------------------------------------------------------------|
|  Beanstalk                   | [0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5](https://etherscan.io/address/0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5)  |
|  Bean                        | [0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab](https://etherscan.io/address/0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab)  |
|  BEAN:3CRV LP token          | [0xc9C32cd16Bf7eFB85Ff14e0c8603cc90F6F2eE49](https://etherscan.io/address/0xc9C32cd16Bf7eFB85Ff14e0c8603cc90F6F2eE49)  |
|  Unripe Bean token           | [0x1BEA0050E63e05FBb5D8BA2f10cf5800B6224449](https://etherscan.io/address/0x1BEA0050E63e05FBb5D8BA2f10cf5800B6224449)  |
|  Unripe BEAN:3CRV LP token   | [0x1BEA3CcD22F4EBd3d37d731BA31Eeca95713716D](https://etherscan.io/address/0x1BEA3CcD22F4EBd3d37d731BA31Eeca95713716D)  |
|  Fertilizer ERC-1155 token   | [0x402c84de2ce49af88f5e2ef3710ff89bfed36cb6](https://etherscan.io/address/0x402c84de2ce49af88f5e2ef3710ff89bfed36cb6)  |
| Beanstalk Community Multisig | [0xa9bA2C40b263843C04d344727b954A545c81D043](https://etherscan.io/address/0xa9bA2C40b263843C04d344727b954A545c81D043)  |

## EIP-2535 Diamond

The Beanstalk contract is a multi-facet proxy that implements [EIP-2535](https://eips.ethereum.org/EIPS/eip-2535). Thus, the Beanstalk contract implements functionality from multiple different Facet contracts that all share a common storage.

* [Beanstalk EIP-2535 Diamond Documentation](https://docs.bean.money/developers/overview/eip-2535-diamond)
* [Current Beanstalk Facets](https://docs.bean.money/almanac/protocol/contracts#diamond)
* [Beanstalk on Louper, The Ethereum Diamond Inspector](https://louper.dev/diamond/0xc1e088fc1323b20bcbee9bd1b9fc9546db5624c5)

## Setup

1. Clone the repository
2. Run `cd protocol` to enter the protocol repository
3. Run `npm install`
4. Run `npx hardhat compile`

### Forking Mainnet Locally

We elect to use `anvil` instead of `hardhat` for local node forking as `anvil` is considerably faster than `hardhat` and properly caches the blockchain locally.

1. Ensure you are in the `/protocol` repository
2. Install Foundry with `curl -L https://foundry.paradigm.xyz | bash` and reopen your terminal
3. Run `foundryup` to ensure you have downloaded the latest version
4. Start a locally forked node with the following command:

```bash
anvil --fork-url <FORK_RPC> --fork-block-number <BLOCK_NUMBER> --chain-id 1337
```

For `<FORK_RPC>`, use an Alchemy or Infura RPC URL. It should be very clear if the node starts up properly.

**Note: `anvil` will cache the blockchain provided that `BLOCK_NUMBER` does NOT change. Given this, we recommend picking a block and sticking to it.**

### Testing

1. Ensure you are in the `protocol` directory
2. Run `npm test` to run all coverage tests
3. Run `npx hardhat coverage` to run all coverage tests and generate a coverage report

## Developing

### Overview

As Beanstalk implements EIP-2535, Beanstalk is upgraded through a `diamondCut` function call.

There are two different ways a `diamondCut` can execute code:
1. Adding, replacing and/or removing functions
    * Functions in Beanstalk are implemented in contracts known as `facets`. Facets are no different than normal smart contract with callable functions. In order to share a state, Facets can only define 1 internal state variable: The `AppStorage` struct defined in `AppStorage.sol`. Read more [here](https://docs.bean.money/developers/overview/app-storage).
2. Calling the `init` function of a contract
    * This is a one time action and will be called when the `diamondCut` is executed. There can be 1 `init` call per `diamondCut`.

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

1. Include the following code in the `networks` section of the hardhat.config.js, where `ALCHEMY_URL` is your RPC url. We recommend using Alchemy for this. The `BLOCK_NUMBER` is optional, but we recommend choosing a block number close to the current block.
    ```
    forking: {
        url: <RPC_URL>,
        blockNumber: <BLOCK_NUMBER>
      },
    ```
    ```
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
    ```
    const BEANSTALK = "0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5";
    const ownerFacet = await ethers.getContractAt('OwnershipFacet', BEANSTALK);
    const owner = await ownerFacet.owner();
    const { upgradeWithNewFacets } = require('./scripts/diamond.js')
    ```

3. Lastly, include the tasks required for upgrading above `module.exports`: 
    ```
    task("upgrade", "Commits a bip", async() => {
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [owner],
        });
        const account = await ethers.getSigner(owner)
        await upgradeWithNewFacets({
            diamondAddress: BEANSTALK,
            facetNames: [],
            initFacetName: 'InitEmpty',
            initArgs: [],
            bip: false,
            verbose: true,
            account: account
        });
    })
    ```
4. Here is an example of what BIP-11 deployment looked like:
    ```
    await upgradeWithNewFacets({
        diamondAddress: BEANSTALK,
        initFacetName: 'InitBip11',
        facetNames: ['MarketplaceFacet'],
        libraryNames: ["LibClaim"],
        facetLibraries: {
        "MarketplaceFacet": ["LibClaim"],
        },
        bip: false,
        verbose: true,
        account: account
    }); 
    ```

### Running the Upgrade Tasks

1. Spin up your mainnet fork node with:
    ```
    npx hardhat node
    ```

2. In another console, execute your tasks against your mainnet fork by running:
    ```
    npx hardhat upgrade --network localhost
    ```
    Where `upgrade` is where you put the name of your task (in the example above it was named upgrade).

3. Now you can test your changes using your local mainnet fork that should now have the latest version
of Beanstalk that you upgraded.

## License

[MIT](https://github.com/BeanstalkFarms/Beanstalk/blob/master/LICENSE.txt)
