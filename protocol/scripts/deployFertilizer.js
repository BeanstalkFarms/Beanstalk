const { ethers, upgrades } = require("hardhat");
var fs = require('fs');

usdc_minter = '0x5B6122C109B78C6755486966148C1D70a50A47D7'
const BF = '0x21DE18B6A8f78eDe6D16C50A167f6B222DC08DF7'
const FERTILIZER = '0x2E4243832db30787764F152457952C8305f442E5'

async function deploy(account, pre=true, mock=false) {
  const contractName = pre ? 'FertilizerPreMint' : 'Fertilizer';
  const Fertilizer = await ethers.getContractFactory(contractName);
  const fertilizer = await upgrades.deployProxy(Fertilizer);
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
      to: BF,
      value: ethers.utils.parseEther('1')
    })
    await hre.network.provider.request({ method: "hardhat_impersonateAccount", params: [BF] });
    const bf = await ethers.getSigner(BF)
    await usdc.connect(bf).transfer(usdc_minter, await usdc.balanceOf(BF));

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