const { PRICE_DEPLOYER, BEANSTALK } = require("../test/utils/constants");
const { impersonateSigner } = require("../utils");
const { deployAtNonce } = require("./contracts");
const { impersonateContract } = require("./impersonate");

async function deployPriceContract(account = undefined, beanstalk = BEANSTALK, verbose = true, mock = true) {
    if (account == undefined) {
        account = await impersonateSigner(PRICE_DEPLOYER, true);
    }
    let price = await deployAtNonce('BeanstalkPrice', account, n = 3, verbose, [beanstalk]);
    // impersonate at price address:
    if (mock) {
        const bytecode = await ethers.provider.getCode(price.address);
        await network.provider.send("hardhat_setCode", [
            "0x4bed6cb142b7d474242d87f4796387deb9e1e1b4",
            bytecode,
        ]);
        price = await ethers.getContractAt("BeanstalkPrice", "0x4bed6cb142b7d474242d87f4796387deb9e1e1b4");
    }
    return price;
}

exports.deployPriceContract = deployPriceContract;