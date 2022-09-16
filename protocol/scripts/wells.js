const BEANSTALK = "0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5"
const fs = require('fs');
const { PRICE_DEPLOYER } = require('../test/utils/constants');
const { to18, to6, toX } = require('../test/utils/helpers');
const { getBeanstalk, impersonateBeanstalkOwner, mintBeans, getEthUsdPrice, impersonateSigner, getBean, mintEth, toBN } = require('../utils');
const { upgradeWithNewFacets } = require('./diamond');
require('dotenv').config();

async function deployWells() {
    const bcm = await impersonateBeanstalkOwner()
    const beanstalk = await getBeanstalk()
    console.log("Wells")
    await mintEth(bcm.address)
    console.log("Upgrading Beanstalk...")
    await upgradeWithNewFacets({
      diamondAddress: BEANSTALK,
      initFacetName: 'InitWell',
      facetNames:
      [
        'WellBuildingFacet',
        'WellFacet',
        'WellOracleFacet',
        'MockAdminFacet',
        'WhitelistFacet',
        'SiloFacet',
        'ConvertFacet',
        'BDVFacet'
      ],
      bip: false,
      verbose: false,
      account: bcm
    });
  
    console.log("Minting Mock Assets and Approving...")
    const ethAmount = to18('1000')
    await mintBeans(bcm.address, to6('100000000'))
    await beanstalk.connect(bcm).wrapEth(ethAmount, '1', {value: ethAmount})
    await (await getBean()).connect(bcm).approve(BEANSTALK, to6('100000000'))
  
    const price = await getEthUsdPrice()
    const well = await beanstalk.getWellAtIndex(0)
    const beanAmount = ethAmount.mul(price).div(toX('1', 20))
  
    const amountOut = await beanstalk.getAddLiquidityOut(well.info, [beanAmount, ethAmount])
    console.log("Adding Liquidity...")
    await beanstalk.connect(bcm).addLiquidity(
      well.info,
      [beanAmount, ethAmount],
      amountOut.mul(toBN('999')).div(toBN('1000')),
      '2',
      '1'
    )
    console.log("Deploying Price Contract...")
    const priceAccount = await impersonateSigner(PRICE_DEPLOYER)
    const PriceContract = await ethers.getContractFactory("BeanstalkPrice", priceAccount);
    const priceContract = await PriceContract.deploy();
    await priceContract.deployed()
    console.log(`Price Contract deployed at: ${priceContract.address}`);
}

exports.deployWells = deployWells
