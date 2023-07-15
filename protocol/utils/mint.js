const { USDC_MINTER, BEAN } = require("../test/utils/constants");
const { getUsdc, getBean, getBeanstalkAdminControls } = require("./contracts.js");
const { impersonateSigner, impersonateBeanstalkOwner } = require("./signer.js");

async function mintUsdc(address, amount) {
  await mintEth(USDC_MINTER);
  const signer = await impersonateSigner(USDC_MINTER);
  const usdc = await getUsdc();
  await usdc.connect(signer).mint(address, amount);
}

async function mintBeans(address, amount) {
  const beanstalkAdmin = await getBeanstalkAdminControls();
  await beanstalkAdmin.mintBeans(address, amount);
}

async function mintEth(address) {
  await hre.network.provider.send("hardhat_setBalance", [address, "0x3635C9ADC5DEA00000"]);
}

exports.mintEth = mintEth;
exports.mintUsdc = mintUsdc;
exports.mintBeans = mintBeans;
