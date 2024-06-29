const { PRICE_DEPLOYER, BEANSTALK } = require("../test/utils/constants");
const { impersonateSigner } = require("../utils");
const { deployAtNonce } = require("./contracts");

async function deployPriceContract(account = undefined, beanstalk = BEANSTALK, verbose = true) {
    if (account == undefined) {
        account = await impersonateSigner(PRICE_DEPLOYER, true);
    }
    const price = await deployAtNonce('BeanstalkPrice', account, n = 3, verbose, [beanstalk])
    return price
}

exports.deployPriceContract = deployPriceContract;