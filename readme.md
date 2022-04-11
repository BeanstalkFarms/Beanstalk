# Beanstalk
Beanstalk is a decentralized credit based algorithmic stablecoin protocol that is built on Ethereum.

## Techincal Documentation
Technical documentation is a WIP. Current Draft is available here:
https://gist.github.com/leonardo-fibonacci/268bb316c4c5ac08bcbc431927998a51

## Contracts

|Contract                  | Addresss 
|:-------------------------|:--------------------------------------------|
|Bean                      |[0xDC59ac4FeFa32293A95889Dc396682858d52e5Db](https://etherscan.io/address/0xDC59ac4FeFa32293A95889Dc396682858d52e5Db)|
|Beanstalk                 |[0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5](https://etherscan.io/address/0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5)|
|UniswapV2 BEAN:ETH Pool   |[0x87898263B6C5BABe34b4ec53F22d98430b91e371](https://etherscan.io/address/0x87898263B6C5BABe34b4ec53F22d98430b91e371)|
|Curve BEAN:3CRV Metapool  |[0x3a70DfA7d2262988064A2D051dd47521E43c9BdD](https://etherscan.io/address/0x3a70DfA7d2262988064A2D051dd47521E43c9BdD)|
|Curve BEAN:LUSD Plain Pool|[0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D](https://etherscan.io/address/0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D)|
|Beanstalk Contract Owner  |[0xefd0E9ff0C4E1Bee55Db53FDD1FAD6F6950CeD0b](https://etherscan.io/address/0xefd0E9ff0C4E1Bee55Db53FDD1FAD6F6950CeD0b)
|Beanstalk Farms Multisig  |[0x21DE18B6A8f78eDe6D16C50A167f6B222DC08DF7](https://etherscan.io/address/0x21DE18B6A8f78eDe6D16C50A167f6B222DC08DF7)|
|Bean Sprout Multisig      |[0xb7ab3f0667eFF5e2299d39C23Aa0C956e8982235](https://etherscan.io/address/0xb7ab3f0667eFF5e2299d39C23Aa0C956e8982235)|
|Development Budget 1      |[0x83A758a6a24FE27312C1f8BDa7F3277993b64783](https://etherscan.io/address/0x83A758a6a24FE27312C1f8BDa7F3277993b64783)|
|Marketing Budget 1        |[0xAA420e97534aB55637957e868b658193b112A551](https://etherscan.io/address/0xAA420e97534aB55637957e868b658193b112A551)|
|Beanstalk Farms Budget    |[0x21DE18B6A8f78eDe6D16C50A167f6B222DC08DF7](https://etherscan.io/address/0x21de18b6a8f78ede6d16c50a167f6b222dc08df7)|
|Bean Sprout Budget        |[0xb7ab3f0667eFF5e2299d39C23Aa0C956e8982235](https://etherscan.io/address/0xb7ab3f0667eff5e2299d39c23aa0c956e8982235)|
|BeaNFT Genesis            |[0xa755A670Aaf1FeCeF2bea56115E65e03F7722A79](https://etherscan.io/address/0xa755A670Aaf1FeCeF2bea56115E65e03F7722A79)|
|BeaNFT Winter             |[0x459895483556dad32526efa461f75e33e458d9e9](https://etherscan.io/address/0x459895483556dad32526efa461f75e33e458d9e9)|

### Beanstalk Contract & EIP-2535
The Beanstalk smart contract is a multi-facet proxy as it implements EIP-2535. Thus, the Beanstalk contract pulls in functions from a variety of different contracts (called facets in the [EIP-2535 documentation](https://eips.ethereum.org/EIPS/eip-2535)) that are all capable of sharing the same state object.

The following are the different facets Beanstalk uses:
|Facet       | Addresss                                                                                                            |
|:-----------|:--------------------------------------------------------------------------------------------------------------------|
|Budget      |[0x6c90e5ce27461e31b8954dfa2bc5101507751df6](https://etherscan.io/address/0x6c90e5ce27461e31b8954dfa2bc5101507751df6)|
|Claim       |[0x024a129bb564da019aca23b41891329eadd233d8](https://etherscan.io/address/0x024a129bb564da019aca23b41891329eadd233d8)|
|Convert     |[0x649d4b21278a1771c0b196614e2c21b4c73fe801](https://etherscan.io/address/0x649d4b21278a1771c0b196614e2c21b4c73fe801)|
|BDV         |[0x33b63042865242739bA410aC32AB68723E6CF4b9](https://etherscan.io/address/0x33b63042865242739bA410aC32AB68723E6CF4b9)|
|Field       |[0x656b50740cbf6616d6324e3ccc9a96147fa04fb6](https://etherscan.io/address/0x656b50740cbf6616d6324e3ccc9a96147fa04fb6)|
|Fundraiser  |[0x19c0674071d068be6c0b3900629618738bd137dc](https://etherscan.io/address/0x19c0674071d068be6c0b3900629618738bd137dc)|
|Governance  |[0xf480ee81a54e21be47aa02d0f9e29985bc7667c4](https://etherscan.io/address/0xf480ee81a54e21be47aa02d0f9e29985bc7667c4)|
|Marketplace |[0xdefcf58e20520466c2f023ab94a526184f534a6a](https://etherscan.io/address/0xdefcf58e20520466c2f023ab94a526184f534a6a)|
|Season      |[0x197406ee97ad1d464194ee0e47efcf5b99520d27](https://etherscan.io/address/0x197406ee97ad1d464194ee0e47efcf5b99520d27)|
|Silo        |[0x448d330affa0ad31264c2e6a7b5d2bf579608065](https://etherscan.io/address/0x448d330affa0ad31264c2e6a7b5d2bf579608065)|
|SiloV2      |[0x23d231f37c8f5711468c8abbfbf1757d1f38fda2](https://etherscan.io/address/0x23d231f37c8f5711468c8abbfbf1757d1f38fda2)|

The following facets are part of the [diamond functionality](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-2535.md):

|Contract             | Addresss                                                                                                            |
|:--------------------|:--------------------------------------------------------------------------------------------------------------------|
|DiamondCutFacet      |[0xDFeFF7592915bea8D040499E961E332BD453C249](https://etherscan.io/address/0xDFeFF7592915bea8D040499E961E332BD453C249)|
|DiamondLoupeFacet    |[0xB51D5C699B749E0382e257244610039dDB272Da0](https://etherscan.io/address/0xB51D5C699B749E0382e257244610039dDB272Da0)|
|OwnershipFacet       |[0x0176D95fd451353F3543A4542e667C62b673621a](https://etherscan.io/address/0x0176D95fd451353F3543A4542e667C62b673621a)|

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
Code Version: `1.16.0` <br>
Whitepaper Version `1.9.3`

## License
[MIT](https://github.com/BeanstalkFarms/Beanstalk/blob/master/LICENSE)

