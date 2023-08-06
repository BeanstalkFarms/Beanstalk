const { PRICE_DEPLOYER } = require("../test/utils/constants");
const { impersonateSigner } = require("../utils");

async function deployPriceContract(account = undefined, verbose = true) {
    if (account == undefined) {
        account = await impersonateSigner(PRICE_DEPLOYER, true);
    }

    const contract = await (await ethers.getContractFactory("BeanstalkPrice", account)).deploy();
    await contract.deployed()
    if (verbose) console.log(`Price Contract deployed to: ${contract.address}`)
    return contract
}

exports.deployPriceContract = deployPriceContract;