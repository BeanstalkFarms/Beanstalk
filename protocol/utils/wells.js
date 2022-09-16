const { BEANSTALK, BEAN, WETH } = require("../test/utils/constants")
const { getBean, getBeanstalk } = require("./contracts")
const { mintBeans, mintEth } = require("./mint")
const { impersonateSigner } = require("./signer")
const { toX } = require("../test/utils/helpers")

async function buyBuysInBeanEth(account, amount) {
    const signer = await impersonateSigner(account)
    const beanstalk = await getBeanstalk()
    await mintEth(account)

    const well = await beanstalk.getWellAtIndex(0)

    let ethIn = await beanstalk.getSwapIn(well.info, WETH, BEAN, amount)
    ethIn = ethIn.mul(toX('1000', 0)).div(toX('999', 0))
    await beanstalk.connect(signer).wrapEth(ethIn, '1', { value: ethIn })

    await beanstalk.connect(signer).swapTo(
        well.info,
        WETH,
        BEAN,
        ethIn, 
        amount,
        '1',
        '0'
    )
}

async function sellBeansInBeanEth(account, amount) {
    const signer = await impersonateSigner(account)
    await mintEth(account)
    await mintBeans(account, amount);
    const bean = await getBean()
    const beanstalk = await getBeanstalk()
    await bean.connect(signer).approve(BEANSTALK, amount);

    const well = await beanstalk.getWellAtIndex(0)

    await beanstalk.connect(signer).swapFrom(
        well.info,
        BEAN,
        WETH,
        amount, 
        '0',
        '0',
        '0'
    )

}

exports.sellBeansInBeanEth = sellBeansInBeanEth
exports.buyBuysInBeanEth = buyBuysInBeanEth