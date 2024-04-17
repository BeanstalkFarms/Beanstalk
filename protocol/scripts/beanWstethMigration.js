const { BEAN_ETH_WELL, WETH, BEAN, BEANSTALK, UNRIPE_LP, WSTETH, BEAN_WSTETH_WELL } = require("../test/utils/constants");
const { getBeanstalk, impersonateBeanstalkOwner } = require("../utils");
const { bipMigrateUnripeBeanEthToBeanSteth } = require("./bips");
const { impersonateWsteth } = require("./impersonate");
const { getWeth } = require('../utils/contracts.js');

const ETH_STETH_POOL = '0xDC24316b9AE028F1497c275EB9192a3Ea0f67022';

async function finishWstethMigration(mock = true, verbose = false) {
    const owner = await impersonateBeanstalkOwner()

    await hre.network.provider.send("hardhat_setBalance", [owner.address, "0x152D02C7E14AF6800000"]);

    const beanEthWell = await ethers.getContractAt('IWell', BEAN_ETH_WELL)
    const beanEthWellToken = await ethers.getContractAt('IERC20', BEAN_ETH_WELL)

    const wellTokenBalance = await beanEthWellToken.balanceOf(owner.address)

    if (verbose) console.log(`Migrating ${wellTokenBalance} Bean:Eth Tokens`)

    await beanEthWell.connect(owner).removeLiquidity(wellTokenBalance, [0, 0], owner.address, ethers.constants.MaxUint256);
    const weth = await getWeth();
    const wethBalance = await weth.balanceOf(owner.address);

    const bean = await ethers.getContractAt('IERC20', BEAN);
    const beanBalance = await bean.balanceOf(owner.address);

    if (verbose) console.log(`Migrating ${wethBalance} WETH`);
    if (verbose) console.log(`Migrating ${wethBalance} Bean`);


    const wsteth = await ethers.getContractAt('MockWsteth', WSTETH);
    const stethPerWsteth = await wsteth.stEthPerToken();

    const wstethAmount = wethBalance.mul(ethers.utils.parseEther('1')).div(stethPerWsteth);

    await wsteth.mint(owner.address, wstethAmount);
    if (verbose) console.log(`Migrating ${await wsteth.balanceOf(owner.address)} WSTETH`);

    const beanWstethWell = await ethers.getContractAt('IWell', BEAN_WSTETH_WELL);
    const beanWstethWellToken = await ethers.getContractAt('IERC20', BEAN_WSTETH_WELL);

    await bean.connect(owner).approve(BEAN_WSTETH_WELL, beanBalance);
    await wsteth.connect(owner).approve(BEAN_WSTETH_WELL, wstethAmount);
    await beanWstethWell.connect(owner).addLiquidity(
        [beanBalance , wstethAmount],
        '0',
        owner.address,
        ethers.constants.MaxUint256
    )

    const beanstalk = await getBeanstalk()

    balance = await beanstalk.getExternalBalance(owner.address, BEAN_WSTETH_WELL)

    await beanWstethWellToken.connect(owner).approve(BEANSTALK, balance);
    await beanstalk.connect(owner).addMigratedUnderlying(UNRIPE_LP, balance);
    if (verbose) console.log(`Migrated ${balance} Bean:Wsteth Tokens`);

    return balance;
}

async function migrateBeanEthToBeanWSteth() {
    await bipMigrateUnripeBeanEthToBeanSteth(true, undefined, false)
    await finishWstethMigration(false)
}

exports.finishWstethMigration = finishWstethMigration;
exports.migrateBeanEthToBeanWSteth = migrateBeanEthToBeanWSteth;