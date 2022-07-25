const { upgradeWithNewFacets } = require('../scripts/diamond.js');
const { BEANSTALK, PRICE_DEPLOYER } = require('../test/utils/constants.js');
const { impersonateSigner } = require('../utils/signer.js');

async function replant8 (
        account,
        deployAccount
    ) {
    console.log('-----------------------------------')
    console.log('Replant8: Deploy New Tokens\n')
    await upgradeWithNewFacets({
      diamondAddress: BEANSTALK,
      facetNames: [],
      initFacetName: 'Replant8',
      bip: false,
      verbose: true,
      account: account
    });

    if (!deployAccount) deployAccount = await impersonateSigner(PRICE_DEPLOYER)

    await account.sendTransaction({
      to: deployAccount.address,
      value: ethers.utils.parseEther("1")
    });

    const PriceContract = await ethers.getContractFactory("BeanstalkPrice", deployAccount);
    const priceContract = await PriceContract.deploy();
    await priceContract.deployed()
    console.log(priceContract.address);
    console.log('-----------------------------------')
}
exports.replant8 = replant8
