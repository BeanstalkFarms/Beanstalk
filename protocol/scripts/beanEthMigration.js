const { BEAN_ETH_WELL, BEAN_3_CURVE, STABLE_FACTORY, USDT, TRI_CRYPTO_POOL, CURVE_REGISTRY, WETH, BEAN, BEANSTALK, THREE_CURVE, THREE_POOL, CRYPTO_REGISTRY, UNRIPE_LP } = require("../test/utils/constants");
const { toX } = require("../test/utils/helpers");
const { getBeanstalk, impersonateBeanstalkOwner } = require("../utils");
const { bipMigrateUnripeBean3CrvToBeanEth } = require("./bips");

async function finishBeanEthMigration(verbose = false) {
    const owner = await impersonateBeanstalkOwner()

    await hre.network.provider.send("hardhat_setBalance", [owner.address, "0x152D02C7E14AF6800000"]);

    const beanstalk = await getBeanstalk()
    const well = await ethers.getContractAt('IWell', BEAN_ETH_WELL)
    const bean3CrvToken = await ethers.getContractAt('IERC20', BEAN_3_CURVE);
    const threeCrvToken = await ethers.getContractAt('IERC20', THREE_CURVE);
    const bean = await ethers.getContractAt('IERC20', BEAN);
    const weth = await ethers.getContractAt('IWETH', WETH);
    const beanEthToken = await ethers.getContractAt('IERC20', BEAN_ETH_WELL);
    const usdt = await ethers.getContractAt('IERC20', USDT);
    let balance = await beanstalk.getExternalBalance(owner.address, BEAN_3_CURVE)
    if (verbose) console.log(`Bean 3 Crv Balance: ${balance}`)
    await bean3CrvToken.connect(owner).approve(BEANSTALK, balance);
    await beanstalk.connect(owner).removeLiquidity(
        BEAN_3_CURVE,
        STABLE_FACTORY,
        balance,
        ['0', '0'],
        '0',
        '0'
    )

    let balances = await well.getReserves();
    const beanBalance = await beanstalk.getExternalBalance(owner.address, BEAN)
    const wethBalance = balances[1].div(balances[0]).mul(beanBalance)
    await weth.connect(owner).deposit({value: wethBalance})
    await bean.connect(owner).approve(BEAN_ETH_WELL, beanBalance);
    await weth.connect(owner).approve(BEAN_ETH_WELL, wethBalance);
    await well.connect(owner).addLiquidity(
        [beanBalance , wethBalance],
        '0',
        owner.address,
        ethers.constants.MaxUint256
    )

    balance = await beanstalk.getExternalBalance(owner.address, BEAN_ETH_WELL)
    await beanEthToken.connect(owner).approve(BEANSTALK, balance);
    await beanstalk.connect(owner).addMigratedUnderlying(UNRIPE_LP, balance);
    if (verbose) console.log(`Unripe LP Underlying Balance: ${await beanstalk.getTotalUnderlying(UNRIPE_LP)}`)

    balances = await well.getReserves();
    if (verbose) console.log(`Well Bean Balance: ${balances[0]}`);
    if (verbose) console.log(`Well WETH Balance: ${balances[1]}`);
}

async function migrateBean3CrvToBeanEth() {
    await bipMigrateUnripeBean3CrvToBeanEth()
    await finishBeanEthMigration()
}

exports.finishBeanEthMigration = finishBeanEthMigration;
exports.migrateBean3CrvToBeanEth = migrateBean3CrvToBeanEth;