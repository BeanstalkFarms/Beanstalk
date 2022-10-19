const { mintRoot, depositAndMintRoot, mintRootFromTokens } = require("../scripts/root");
const { INTERNAL, EXTERNAL } = require("../test/utils/balances");
const { BEANSTALK, BEAN, ROOT } = require("../test/utils/constants");
const { to6 } = require("../test/utils/helpers");
const { getBean, getBeanstalk, mintBeans } = require("../utils");
const { mockSunrise } = require("../utils/mocks");

async function mintBeansIntoRootPipeline() {
    [account] = await ethers.getSigners()
    await mintBeans(account.address, to6('100'))
    await depositAndMintRoot(account, BEAN, to6('100'), INTERNAL)
    console.log(`Root Internal Balance: ${await beanstalk.getInternalBalance(account.address, ROOT)}`)
}

async function mintDepositedBeansIntoRoots() {
    [account] = await ethers.getSigners()
    await mintBeans(account.address, to6('200'))

    beanstalk = await getBeanstalk()
    bean = await getBean()
    await bean.connect(account).approve(BEANSTALK, to6('200'))
    await beanstalk.connect(account).deposit(BEAN, to6('100'), EXTERNAL)
    season1 = await beanstalk.season()
    await mockSunrise()
    await beanstalk.connect(account).deposit(BEAN, to6('100'), EXTERNAL)
    season2 = await beanstalk.season()

    await mintRoot(account, BEAN, [season1, season2], [to6('100'), to6('100')], INTERNAL)

    console.log(`Root Internal Balance: ${await beanstalk.getInternalBalance(account.address, ROOT)}`)
}

async function mintMultipleDepositsIntoRoots() {
    [account] = await ethers.getSigners()
    await mintBeans(account.address, to6('200'))

    beanstalk = await getBeanstalk()
    bean = await getBean()
    await bean.connect(account).approve(BEANSTALK, to6('200'))
    await beanstalk.connect(account).deposit(BEAN, to6('100'), EXTERNAL)
    season1 = await beanstalk.season()
    await mockSunrise()
    await beanstalk.connect(account).deposit(BEAN, to6('100'), EXTERNAL)
    season2 = await beanstalk.season()

    await mintRootFromTokens(account, [[BEAN, [season1, season2], [to6('100'), to6('100')]]], INTERNAL)

    console.log(`Root Internal Balance: ${await beanstalk.getInternalBalance(account.address, ROOT)}`)
}

exports.mintDepositedBeansIntoRoots = mintDepositedBeansIntoRoots
exports.mintMultipleDepositsIntoRoots = mintMultipleDepositsIntoRoots
exports.mintBeansIntoRootPipeline = mintBeansIntoRootPipeline