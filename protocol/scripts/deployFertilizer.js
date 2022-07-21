const { upgrades } = require("hardhat");
var fs = require('fs');

const {
  BCM,
  FERTILIZER,
  USDC_MINTER
} = require('../test/utils/constants')

async function deploy(account, pre=true, mock=false) {
  const contractName = pre ? 'FertilizerPreMint' : 'Fertilizer';
  const args = pre ? [''] : [];
  const Fertilizer = await ethers.getContractFactory(contractName);
  const fertilizer = await upgrades.deployProxy(Fertilizer, args);
  console.log("Fertilizer 1155 deployed to:", fertilizer.address);

  if (mock) {
    const usdc = await ethers.getContractAt('IUSDC', await fertilizer.USDC())

    await account.sendTransaction({
      to: USDC_MINTER,
      value: ethers.utils.parseEther('1')
    })

    await hre.network.provider.request({ method: "hardhat_impersonateAccount", params: [USDC_MINTER] });
    const minter = await ethers.getSigner(USDC_MINTER)

    await usdc.connect(minter).mint(account.address, ethers.utils.parseUnits('10000',6));

    await account.sendTransaction({
      to: BCM,
      value: ethers.utils.parseEther('1')
    })
    await hre.network.provider.request({ method: "hardhat_impersonateAccount", params: [BCM] });
    const bcm = await ethers.getSigner(BCM)
    await usdc.connect(bcm).transfer(USDC_MINTER, await usdc.balanceOf(BCM));

  }

  return fertilizer;
}

async function impersonate() {
  let tokenJson = fs.readFileSync(`./artifacts/contracts/mocks/MockFertilizer.sol/MockFertilizer.json`);
  await network.provider.send("hardhat_setCode", [
    FERTILIZER,
    JSON.parse(tokenJson).deployedBytecode,
  ]);

  const fertilizer = await ethers.getContractAt('MockFertilizer', FERTILIZER)
  await fertilizer.initialize()
  return fertilizer
}

exports.deployFertilizer = deploy
exports.impersonateFertilizer = impersonate