const fs = require('fs');
const { BEAN, WETH, BEANSTALK_PUMP, BEAN_ETH_WELL, BEANSTALK } = require('../test/utils/constants');
const { getBeanstalk, impersonateBeanstalkOwner, mintEth, impersonateSigner } = require("../utils");
const { to6, to18 } = require('../test/utils/helpers');
const { increaseToNonce } = require('../scripts/contracts');
const { impersonateContract } = require('../scripts/impersonate');
const { upgradeWithNewFacets } = require("../scripts/diamond");

async function updateGaugeForToken(token, gaugePoints, optimalPercentDepositedBdv) {
    const beanstalk = await getBeanstalk()

    await beanstalk.connect(await impersonateBeanstalkOwner()).updateGaugeForToken(
        token,
        beanstalk.interface.getSighash("defaultGaugePointFunction(uint256 currentGaugePoints,uint256 optimalPercentDepositedBdv,uint256 percentOfDepositedBdv)"),
        gaugePoints,
        optimalPercentDepositedBdv
    )
}

exports.updateGaugeForToken = updateGaugeForToken;