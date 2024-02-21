const fs = require('fs');
const { BEAN, WETH, BEANSTALK_PUMP, BEAN_ETH_WELL, BEANSTALK } = require('../test/utils/constants');
const { getBeanstalk, impersonateBeanstalkOwner, mintEth, impersonateSigner } = require("../utils");
const { to6, to18 } = require('../test/utils/helpers');
const { increaseToNonce } = require('../scripts/contracts');
const { impersonateContract } = require('../scripts/impersonate');
const { upgradeWithNewFacets } = require("../scripts/diamond");

async function initalizeGaugeForToken(token, gaugePoints, optimalPercentDepositedBdv) {
    const season = await ethers.getContractAt('MockSeasonFacet', BEANSTALK)
    const gauge = await ethers.getContractAt('GaugePointFacet', BEANSTALK)
    const liquidityWeight = await ethers.getContractAt('LiquidityWeightFacet', BEANSTALK)
    await season.connect(await impersonateBeanstalkOwner()).mockInitalizeGaugeForToken(
        token,
        gauge.interface.getSighash("defaultGaugePointFunction(uint256,uint256,uint256)"),
        liquidityWeight.interface.getSighash("maxWeight()"),
        gaugePoints,
        optimalPercentDepositedBdv
    )
}

exports.initalizeGaugeForToken = initalizeGaugeForToken;