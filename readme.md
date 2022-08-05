# Beanstalk
Beanstalk is a permissionless fiat stablecoin protocol built on Ethereum.

## Techincal Documentation
Technical documentation is a WIP. Current draft is available [here](https://beanstalk.gitbook.io/beanstalk-protocol/overview/beanstalk).

## Contracts

A comprehensive list of contracts related to Beanstalk is available [here](https://docs.bean.money/additional-resources/contracts).

|Contract                  | Address 
|:-------------------------|:--------------------------------------------|
|Beanstalk                 |[0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5](https://etherscan.io/address/0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5)|
|Bean                      |[0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab](https://etherscan.io/address/0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab)|
|Curve BEAN:3CRV Metapool  |[0xc9C32cd16Bf7eFB85Ff14e0c8603cc90F6F2eE49](https://etherscan.io/token/0xc9C32cd16Bf7eFB85Ff14e0c8603cc90F6F2eE49)|
|Unripe Bean ERC-20 token  |[0x1BEA0050E63e05FBb5D8BA2f10cf5800B6224449](https://etherscan.io/address/0x1BEA0050E63e05FBb5D8BA2f10cf5800B6224449)|
|Unripe BEAN:3CRV LP token  |[0x1BEA3CcD22F4EBd3d37d731BA31Eeca95713716D](https://etherscan.io/address/0x1BEA3CcD22F4EBd3d37d731BA31Eeca95713716D)|
|Fertilizer ERC-1155 token  |[0x402c84de2ce49af88f5e2ef3710ff89bfed36cb6](https://etherscan.io/address/0x402c84de2ce49af88f5e2ef3710ff89bfed36cb6)|
|Fertilizer Admin  |[0xfECB01359263C12Aa9eD838F878A596F0064aa6e](https://etherscan.io/address/0xfECB01359263C12Aa9eD838F878A596F0064aa6e)|
|Fertilizer Implementation  |[0x39cdAf9Dc6057Fd7Ae81Aaed64D7A062aAf452fD](https://etherscan.io/address/0x39cdAf9Dc6057Fd7Ae81Aaed64D7A062aAf452fD)|
|Beanstalk Price Contract  |[0xA57289161FF18D67A68841922264B317170b0b81](https://etherscan.io/address/0xA57289161FF18D67A68841922264B317170b0b81)|
|Beanstalk Contract Owner ([BCM](https://docs.bean.money/governance/beanstalk/bcm-process))  |[0xa9bA2C40b263843C04d344727b954A545c81D043](https://etherscan.io/address/0xa9bA2C40b263843C04d344727b954A545c81D043)
|Beanstalk Farms Multisig  |[0x21DE18B6A8f78eDe6D16C50A167f6B222DC08DF7](https://etherscan.io/address/0x21DE18B6A8f78eDe6D16C50A167f6B222DC08DF7)|
|Bean Sprout Multisig      |[0xb7ab3f0667eFF5e2299d39C23Aa0C956e8982235](https://etherscan.io/address/0xb7ab3f0667eFF5e2299d39C23Aa0C956e8982235)|
|BeaNFT Genesis            |[0xa755A670Aaf1FeCeF2bea56115E65e03F7722A79](https://etherscan.io/address/0xa755A670Aaf1FeCeF2bea56115E65e03F7722A79)|
|BeaNFT Winter             |[0x459895483556dad32526efa461f75e33e458d9e9](https://etherscan.io/address/0x459895483556dad32526efa461f75e33e458d9e9)|

### Beanstalk Contract & EIP-2535
The Beanstalk smart contract is a multi-facet proxy as it implements EIP-2535. Thus, the Beanstalk contract pulls in functions from a variety of different contracts (called facets in the [EIP-2535 documentation](https://eips.ethereum.org/EIPS/eip-2535)) that are all capable of sharing the same state object.

The following are the different facets Beanstalk uses:

|Facet             | Address                                                                                                          |
|:--------------------|:--------------------------------------------------------------------------------------------------------------------|
|Whitelist      |[0xAeA0e6e011106968ADc7943579C829E49EFddaD0](https://etherscan.io/address/0xAeA0e6e011106968ADc7943579C829E49EFddaD0)|
|Unripe    |[0xaF26527eFCbF5BA7ba5de57e7048BF605011cc39](https://etherscan.io/address/0xaF26527eFCbF5BA7ba5de57e7048BF605011cc39)|
|Token       |[0x146f86c2EF039f9176bc2434D3DA5919C19B87fC](https://etherscan.io/address/0x146f86c2EF039f9176bc2434D3DA5919C19B87fC)|
|Silo      |[0x5BB733654C75dCFdD68096ad1764b9Db9b33Fd35](https://etherscan.io/address/0x5BB733654C75dCFdD68096ad1764b9Db9b33Fd35)|
|Season    |[0xcee260AF23cD262a9921A16B3586948A465801da](https://etherscan.io/address/0xcee260AF23cD262a9921A16B3586948A465801da)|
|Pause       |[0xeab4398f62194948cB25F45fEE4C46Fae2e91229](https://etherscan.io/address/0xeab4398f62194948cB25F45fEE4C46Fae2e91229)|
|Marketplace      |[0xD870aAB97c2739b320a3eFAd370511452894F1b2](https://etherscan.io/address/0xD870aAB97c2739b320a3eFAd370511452894F1b2)|
|Fundraiser    |[0x538C76976eF45b8cA5c12662a86034434bFC7a8E](https://etherscan.io/address/0x538C76976eF45b8cA5c12662a86034434bFC7a8E)|
|Field       |[0x538C76976eF45b8cA5c12662a86034434bFC7a8E](https://etherscan.io/address/0x538C76976eF45b8cA5c12662a86034434bFC7a8E)|
|Fertilizer      |[0xFC7Ed192a24FaB3093c8747c3DDBe6Cacd335B6C](https://etherscan.io/address/0xFC7Ed192a24FaB3093c8747c3DDBe6Cacd335B6C)|
|Farm    |[0x6039c602B730f44f418145454a2D954133CBD394](https://etherscan.io/address/0x6039c602B730f44f418145454a2D954133CBD394)|
|BDV       |[0xc17ED2e41242063DB6b939f5601bA01374b9D44a](https://etherscan.io/address/0xc17ED2e41242063DB6b939f5601bA01374b9D44a)|
|Curve       |[0xd231498144c5b53b65b782343CDFB366472c7bf7](https://etherscan.io/address/0xd231498144c5b53b65b782343CDFB366472c7bf7)|
|Convert       |[0xc1A92D1fA36717bfC3C795d3A335f84784DC593d](https://etherscan.io/address/0xc1A92D1fA36717bfC3C795d3A335f84784DC593d)|

The following facets are part of the [diamond functionality](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-2535.md):

|Contract             | Address                                                                                                          |
|:--------------------|:--------------------------------------------------------------------------------------------------------------------|
|DiamondCutFacet      |[0xDFeFF7592915bea8D040499E961E332BD453C249](https://etherscan.io/address/0xDFeFF7592915bea8D040499E961E332BD453C249)|
|DiamondLoupeFacet    |[0xB51D5C699B749E0382e257244610039dDB272Da0](https://etherscan.io/address/0xB51D5C699B749E0382e257244610039dDB272Da0)|
|OwnershipFacet       |[0x5D45283Ff53aabDb93693095039b489Af8b18Cf7](https://etherscan.io/address/0x5D45283Ff53aabDb93693095039b489Af8b18Cf7)|

## Setup
1. clone the repository
2. run `cd protocol` to enter the protocol repository
3. run `npm install`
5. run `npx hardhat compile`

## Testing
1. make sure you are in the `protocol` repository
1. run `npm test` to run all coverage tests
2. run `npx hardhat coverage` to run all coverage tests and generate a coverage report

## Developing

### Overview
As Beanstalk implements EIP-2535, Beanstalk is upgraded through a `diamondCut` function call.
There are two different ways a `diamondCut` can apply code to Beanstalk:
1. adding/replacing/removing functions
    * Functions being added/replaced are implemented in smart contracts referred to as `facets`. Facets are no different than a normal smart contract with callable functions. In order to share a state, Facets can only define 1 internal state variable: The `AppStorage` struct defined in `AppStorage.sol`.
2. calling the `init` function of a smart contract
    * This is a one time action and will be called when the `diamondCut` is executed. There can be 1 `init` call per `diamondCut`.

### Creating a new facet
For this tutorial, we are going to create a new facet called `SampleFacet`. In your own implementation replace iterations of the word `Sample` with the name of the Facet you want to create. 
1. make sure you are in the `protocol` repository
2. in `protocol/farm/facets/`, create a new folder called `SampleFacet`
3. within the `SampleFacet` folder create a file called `SampleFacet.sol`.
4. implement your faucet. You can use `SampleFacet.sol` in `protocol/samples` as a template for a basis faucet. Note that facets can only have `AppStorage` as an internal state variable or there will be issues with accessing `AppStorage`.
5. modify the `deploy` function in `scripts/deploy` to include your new facet, so that the `faucet` will be deployed with the Beanstalk diamond.

## Mainnet Forking and Bip Upgrades

### Overview
There are a couple of steps that must be done before we can fork mainnet and upgrade Bips/test Bip upgrades
1. include the following code in the networks section of the hardhat.config.js, where ALCHEMY_URL is your mainnet url. We recommend using Alchemy for this. The blockNumber is optional, but we recommend to be one that is close to the current block number but not too close.
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
2. include as in imports section
    ```
    const BEANSTALK = "0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5";
    const ownerFacet = await ethers.getContractAt('OwnershipFacet', BEANSTALK);
    const owner = await ownerFacet.owner();
    const { upgradeWithNewFacets } = require('./scripts/diamond.js')
    ```

3. Lastly, include the tasks required for upgrading above module.exports: 
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
4. (this is an example of what bip11 deployment looked like):
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

## Running the Upgrade Tasks
1. Spin up your mainnet fork node with:
    ```
    npx hardhat node
    ```

2. In another console, execute your tasks by running 
    ```
    npx hardhat upgrade --network localhost
    ```
    where `upgrade` is where you put the name of your task, in the example above it was named upgrade.

3. Now you can test your changes using your local blockchain node that should now have the latest version
of beanstalk that you upgraded.


## Versions
Code Version: `2.0.0` <br>
Whitepaper Version `2.0.0`

## License
[MIT](https://github.com/BeanstalkFarms/Beanstalk/blob/master/LICENSE)

