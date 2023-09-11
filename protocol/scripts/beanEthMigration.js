const { BEAN_ETH_WELL, BEAN_3_CURVE, STABLE_FACTORY, USDT, TRI_CRYPTO_POOL, CURVE_REGISTRY, WETH, BEAN, BEANSTALK, THREE_CURVE, THREE_POOL, CRYPTO_REGISTRY, UNRIPE_LP } = require("../test/utils/constants");
const { toX } = require("../test/utils/helpers");
const { getBeanstalk, impersonateBeanstalkOwner } = require("../utils");


async function completeBeanEthMigration() {
    const owner = await impersonateBeanstalkOwner()
    const beanstalk = await getBeanstalk()
    const well = await ethers.getContractAt('IWell', BEAN_ETH_WELL)
    const bean3CrvToken = await ethers.getContractAt('IERC20', BEAN_3_CURVE);
    const threeCrvToken = await ethers.getContractAt('IERC20', THREE_CURVE);
    const bean = await ethers.getContractAt('IERC20', BEAN);
    const weth = await ethers.getContractAt('IWETH', WETH);
    const beanEthToken = await ethers.getContractAt('IERC20', BEAN_ETH_WELL);
    const usdt = await ethers.getContractAt('IERC20', USDT);
    let balance = await beanstalk.getExternalBalance(owner.address, BEAN_3_CURVE)
    console.log(`Bean 3 Crv Balance: ${balance}`)
    await bean3CrvToken.connect(owner).approve(BEANSTALK, balance);
    await beanstalk.connect(owner).removeLiquidity(
        BEAN_3_CURVE,
        STABLE_FACTORY,
        balance,
        ['0', '0'],
        '0',
        '0'
    )


    balance = await beanstalk.getExternalBalance(owner.address, THREE_CURVE)
    console.log(`3 Crv Balance: ${balance}`)
    await threeCrvToken.connect(owner).approve(BEANSTALK, balance);
    await beanstalk.connect(owner).removeLiquidityOneToken(
        THREE_POOL,
        CURVE_REGISTRY,
        USDT,
        balance,
        '0',
        '0',
        '0'
    )
    balance = await beanstalk.getExternalBalance(owner.address, USDT)
    console.log(`USDT: ${balance}`)
    await usdt.connect(owner).approve(BEANSTALK, balance);
    await beanstalk.connect(owner).exchange(
        TRI_CRYPTO_POOL,
        CRYPTO_REGISTRY,
        USDT,
        WETH,
        balance,
        '0',
        '0',
        '0'
    )

    let balances = await well.getReserves();
    console.log(`Well Bean Balance Before: ${balances[0]}`);
    console.log(`Well WETH Balance Before: ${balances[1]}`);
    console.log(`Well Price b4: ${balances[0].mul(toX('1', 12)).div(balances[1])}`)

    const beanBalance = await beanstalk.getExternalBalance(owner.address, BEAN)
    const wethBalance = await beanstalk.getExternalBalance(owner.address, WETH)

    const ethToAdd = balances[1].div(balances[0]).mul(beanBalance)
    await weth.deposit({value: ethToAdd.sub(wethBalance)})

    console.log(`Bean Balance: ${beanBalance}`);
    console.log(`WETH Balance: ${balances[1]}`);

    await bean.connect(owner).approve(BEAN_ETH_WELL, balances[0]);
    await weth.connect(owner).approve(BEAN_ETH_WELL, balances[1]);
    await well.connect(owner).addLiquidity(
        [beanBalance , ethToAdd],
        '0',
        owner.address,
        ethers.constants.MaxUint256
    )

    balance = await beanstalk.getExternalBalance(owner.address, BEAN_ETH_WELL)
    console.log(`Well LP Balance: ${balance}`)
    await beanEthToken.connect(owner).approve(BEANSTALK, balance);
    await beanstalk.connect(owner).addMigratedUnderlying(UNRIPE_LP, balance);
    console.log(`Unripe LP Underlying Balance: ${await beanstalk.getTotalUnderlying(UNRIPE_LP)}`)

    balances = await well.getReserves();
    console.log(`Well Bean Balance: ${balances[0]}`);
    console.log(`Well WETH Balance: ${balances[1]}`);
    console.log(`Price after: ${balances[0].mul(toX('1', 12)).div(balances[1])}`)
}

exports.completeBeanEthMigration = completeBeanEthMigration;