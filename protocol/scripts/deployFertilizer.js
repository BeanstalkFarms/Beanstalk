const { ethers, upgrades } = require("hardhat");
var fs = require('fs');

usdc_minter = '0x5B6122C109B78C6755486966148C1D70a50A47D7'
const BCM = '0xa9bA2C40b263843C04d344727b954A545c81D043'
const FERTILIZER = '0x2E4243832db30787764F152457952C8305f442E5'

async function deploy(account, pre=true, mock=false) {
  const contractName = pre ? 'FertilizerPreMint' : 'Fertilizer';
  const args = pre ? [''] : [];
  const Fertilizer = await ethers.getContractFactory(contractName);
  const fertilizer = await upgrades.deployProxy(Fertilizer, args);
  console.log("Fertilizer 1155 deployed to:", fertilizer.address);

  if (mock) {
    const usdc = await ethers.getContractAt('IUSDC', await fertilizer.USDC())

    await account.sendTransaction({
      to: usdc_minter,
      value: ethers.utils.parseEther('1')
    })
    await hre.network.provider.request({ method: "hardhat_impersonateAccount", params: [usdc_minter] });
    const minter = await ethers.getSigner(usdc_minter)

    await usdc.connect(minter).mint(account.address, ethers.utils.parseUnits('10000',6));

    await account.sendTransaction({
      to: BCM,
      value: ethers.utils.parseEther('1')
    })
    await hre.network.provider.request({ method: "hardhat_impersonateAccount", params: [BCM] });
    const bcm = await ethers.getSigner(BCM)
    await usdc.connect(bcm).transfer(usdc_minter, await usdc.balanceOf(BCM));

  }

  return fertilizer;
}

async function impersonate() {
  let tokenJson = fs.readFileSync(`./artifacts/contracts/fertilizer/Fertilizer.sol/Fertilizer.json`);
  await network.provider.send("hardhat_setCode", [
    FERTILIZER,
    JSON.parse(tokenJson).deployedBytecode,
  ]);

  const fertilizer = await ethers.getContractAt('Fertilizer', FERTILIZER)
  await fertilizer.initialize()
  return fertilizer
}

exports.deployFertilizer = deploy
exports.impersonateFertilizer = impersonate