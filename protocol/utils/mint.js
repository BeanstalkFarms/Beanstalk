const { USDC_MINTER, BEAN } = require('../test/utils/constants')
const { getUsdc, getBean, getBeanstalkAdminControls } = require('./contracts.js')
const { impersonateSigner, impersonateBeanstalkOwner } = require('./signer.js')

async function mintUsdc(address, amount) {
    const signer = await impersonateSigner(USDC_MINTER)
    const usdc = await getUsdc()
    await usdc.connect(signer).mint(address, amount)
}

async function mintBeans(address, amount) {
    const beanstalkAdmin = await getBeanstalkAdminControls()
    await beanstalkAdmin.mintBeans(address, amount)
}

exports.mintUsdc = mintUsdc
exports.mintBeans = mintBeans