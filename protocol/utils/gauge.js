const fs = require('fs');
const { BEAN, WETH, BEANSTALK_PUMP, BEAN_ETH_WELL } = require('../test/utils/constants');
const { to6, to18 } = require('../test/utils/helpers');
const { getBeanstalk } = require('./contracts');
const { impersonateBeanstalkOwner } = require('./signer');
const { increaseToNonce } = require('../scripts/contracts');
const { impersonateContract } = require('../scripts/impersonate');


async function updateGaugeForToken(token, gaugePoints) {
    const beanstalk = await getBeanstalk()

    await beanstalk.connect(await impersonateBeanstalkOwner()).updateGaugeForToken(
        token,
        beanstalk.interface.getSighash("defaultGaugePointFunction(uint256 currentGaugePoints,uint256 optimalPercentDepositedBdv,uint256 percentOfDepositedBdv)"),
        gaugePoints
    )
}

exports.updateGaugeForToken = updateGaugeForToken;