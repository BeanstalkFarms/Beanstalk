const { PRICE_DEPLOYER } = require("../test/utils/constants");
const { impersonateSigner } = require("../utils");
const { deployAtNonce } = require("./contracts");

async function deployPriceContract(account = undefined, verbose = true) {
    if (account == undefined) {
        account = await impersonateSigner(PRICE_DEPLOYER, true);
    }
    const price = await deployAtNonce('BeanstalkPrice', account, n = 3)
    return price
}

exports.deployPriceContract = deployPriceContract;