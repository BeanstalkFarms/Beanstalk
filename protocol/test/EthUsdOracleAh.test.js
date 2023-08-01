const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js');
const { getAltBeanstalk, getBean } = require('../utils/contracts.js');
const { ETH_USDC_UNISWAP_V3, ETH_USDT_UNISWAP_V3, WETH, ETH_USD_CHAINLINK_AGGREGATOR } = require('./utils/constants.js');
const { to6, to18 } = require('./utils/helpers.js');
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot.js");
const { toBN } = require('../utils/helpers.js');

let user, user2, owner;

let ethUsdcUniswapPool, ethUsdtUniswapPool, ethUsdChainlinkAggregator;


describe('USD Oracle', function () {
    it('fucks', async function () {

        try {
            await network.provider.request({
                method: "hardhat_reset",
                params: [
                    {
                        forking: {
                            jsonRpcUrl: process.env.FORKING_RPC,
                            blockNumber: 16664100 //a random semi-recent block close to Grown Stalk Per Bdv pre-deployment
                        },
                    },
                ],
            });
        } catch (error) {
            console.log('forking error in Silo V3: Grown Stalk Per Bdv:');
            console.log(error);
            return
        }

        const SeasonFacet = await ethers.getContractFactory("MockSeasonFacet");
        const seasonFacet = await SeasonFacet.deploy();
        await seasonFacet.deployed()
        console.log(seasonFacet.address);

        await seasonFacet.getEthUsdcPrice();
        await seasonFacet.getEthUsdtPrice();
        await seasonFacet.getChainlinkEthUsdPrice()


    })
})