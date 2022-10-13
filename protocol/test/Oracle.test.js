const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { to18, to6, toStalk } = require('./utils/helpers.js')
const { BEAN, USDT, WETH, CURVE_REGISTRY, CRYPTO_REGISTRY, THREE_POOL, TRI_CRYPTO, TRI_CRYPTO_POOL, THREE_CURVE, BEAN_3_CURVE, USDC, WBTC, DAI, LUSD_3_CURVE, LUSD, CRYPTO_FACTORY, STABLE_FACTORY, USD, LIQUITY_PRICE_FEED, LIQUITY_PRICE_FEED_SELECTOR } = require('./utils/constants')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { getBeanstalk, getAltBeanstalk } = require('../utils/contracts.js');
const { impersonateBeanstalkOwner } = require('../utils/signer.js');
const { mintEth } = require('../utils/mint.js');

let user, user2, owner;
let userAddress, ownerAddress, user2Address;

describe('Oracle', function () {
  if (!!process.env.FORKING_RPC) {
    before(async function () {
      [owner, user, user2] = await ethers.getSigners();
      userAddress = user.address;
      user2Address = user2.address;
      try {
        await network.provider.request({
          method: "hardhat_reset",
          params: [
            {
              forking: {
                jsonRpcUrl: process.env.FORKING_RPC,
                blockNumber: 15582861
              },
            },
          ],
        });
      } catch {
        return
      }
      const contracts = await deploy("Test", false, true, false)
      ownerAddress = contracts.account;
      this.diamond = contracts.beanstalkDiamond;
      this.bean = await ethers.getContractAt('Bean', BEAN);
      this.beanstalk = await getAltBeanstalk(contracts.beanstalkDiamond.address)

      liquityPriceFeed = await ethers.getContractAt("ILiquityPriceFeed", LIQUITY_PRICE_FEED)
      await this.beanstalk.connect(owner).registerOracle(
        WETH,
        USD,
        LIQUITY_PRICE_FEED,
        LIQUITY_PRICE_FEED_SELECTOR,
        18,
        false,
        true
      )
    });

    beforeEach(async function () {
      snapshotId = await takeSnapshot();
    });

    afterEach(async function () {
      await revertToSnapshot(snapshotId);
    });

    it('Returns Eth/USD price', async function () {
        expect(await this.beanstalk.getPrice(WETH, USD)).to.be.equal(to18('1000'))
    });

  } else {
    it('skip', async function () { 
      console.log('Set FORKING_RPC in .env file to run tests')
    })
  }
})