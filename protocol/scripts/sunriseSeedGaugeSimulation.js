const beanstalkABI = require('../abi/Beanstalk.json');
const { upgradeWithNewFacets } = require('./diamond.js');
const hre = require('hardhat');
const { impersonateBeanstalkOwner, mintEth, mintBeans } = require('../utils/index.js');
const fs = require('fs');
var exec = require('child_process').exec;
// BIP 39 
const { bipSeedGauge } = require("./bips.js");
const { getWellContractAt } = require("../utils/well.js");

//////////////////////// STEPS ////////////////////////
// - fetch the baseFee of the block at the top of the hour --> done
// - fetch the reserves of the bean/eth well at the top of the hour --> done 

// then run a script that
// (1) upgrades beanstalk at the block right before the sunrise block 
// (2) update the base fee, update reserves
// (3) calls sunrise, logs data
// (4) revert back to previous block,
// (5) repeat steps (2) - (4)

async function setNextBlockBaseFee(baseFee) {
  await network.provider.send("anvil_setNextBlockBaseFeePerGas", [
    "0x2540be400", // 10 gwei
  ]);
}

async function simulateSeedGaugeSunrises() {


  // fetch the baseFee of the block at the top of the hour 

  // this returns an object like this
  //   lastBaseFeePerGas: BigNumber { value: "70202737439" },
  //   maxFeePerGas: BigNumber { value: "141905474878" },
  //   maxPriorityFeePerGas: BigNumber { value: "1500000000" },
  //   gasPrice: BigNumber { value: "73800624839" }
  // fee data of the current forked block
  const baseFeeData = await hre.ethers.provider.getFeeData();

  console.log('baseFee: ', baseFeeData.lastBaseFeePerGas.toString());


  const seasonFacet = await hre.ethers.getContractAt(
    'SeasonFacet',
    '0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5'
  );


  // const instantaneousReserves = await multiFlowPump.readInstantaneousReserves(
  //   well.address,
  //   "0x"
  // );
  // console.log("Instantaneous Bean Reserve:", instantaneousReserves[0].toString());
  // console.log("Instantaneous WETH Reserve:", instantaneousReserves[1].toString());
  
  // get bean eth well deployed at: 0xBEA0e11282e2bB5893bEcE110cF199501e872bAd

  const well = await getWellContractAt("Well", "0xBEA0e11282e2bB5893bEcE110cF199501e872bAd");

  const reserves = await well.getReserves();
  console.log("Well Statistics:")
  console.log("Bean Reserve:", reserves[0].toString());
  console.log("Eth Reserve:", reserves[1].toString());
  console.log("LP Token Total Supply:", (await well.totalSupply()).toString());

  const BEFORE_SUNRISE_BLOCK = 19398596;

  setNextBlockBaseFee(10);

  // go forward a block
  await network.provider.send("evm_mine");
  
  // console.log("Excute the deployBip39 script...")
  // await bipSeedGauge();


}


async function main() {

    const seasonFacet = await hre.ethers.getContractAt(
      'SeasonFacet',
      '0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5'
    );

  const START_BLOCK = 16143379;

  const events = await seasonFacet.queryFilter(
    'Sunrise(uint256)',
    START_BLOCK,
    'latest'
  );

  const beanstalk = await hre.ethers.getContractAt(
    beanstalkABI,
    '0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5'
  );

  let csvContent =
    'BLOCK_NUMBER,TX_HASH,GAS_USED,GAS_PRICE,GAS_COST,GAS_COST_IN_DOLLARS,BEAN_AMOUNT,PROFIT\n';

  const preUpgradeBaseFees = [];
  for (let i = 0; i < 150; i++) {
    // fetch eth price from uniswap pool
    console.log('preupgrade', i);

    const event = events[i];
    const ethPrice = await getETHPrice(event.blockNumber);

    const txHash = event.transactionHash;
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    const block = await ethers.provider.getBlock(receipt.blockNumber);

    preUpgradeBaseFees.push(block.baseFeePerGas);

    const gasUsed = receipt.gasUsed;
    const gasPrice = receipt.effectiveGasPrice;
    const [beanTransfer] = receipt.logs.filter((log) => {
      return (
        log.address === '0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab' &&
        hre.ethers.utils.hexZeroPad(receipt.from.toLowerCase(), 32) ===
          log.topics[2]
      );
    });

    if (beanTransfer === undefined) {
      continue;
    }
    const beanAmount = parseInt(beanTransfer?.data, 16);

    const usdGasCost =
      ethPrice * gasUsed * ethers.utils.formatUnits(gasPrice, 'ether');
    const beanInUsd = ethers.utils.formatUnits(beanAmount, 6);

    csvContent +=
      receipt.blockNumber +
      ',' +
      receipt.transactionHash +
      ',' +
      gasUsed +
      ',' +
      gasPrice +
      ',' +
      gasUsed * ethers.utils.formatUnits(gasPrice, 'ether') +
      ',' +
      usdGasCost +
      ',' +
      beanAmount +
      ',' +
      (beanInUsd - usdGasCost) +
      '\n';
  }

  csvContent += '\n"AFTER UPGRADE"\n\n';

  for (let i = 0; i < 150; i++) {
    const event = events[i];
    const ethPrice = await getETHPrice(event.blockNumber);

    const lastTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
    const hourTimestamp = parseInt(lastTimestamp / 3600 + 1) * 3600;
    await network.provider.send('evm_setNextBlockTimestamp', [hourTimestamp]);

    const account = await impersonateBeanstalkOwner();
    await mintEth(account.address);

    await upgradeWithNewFacets({
      diamondAddress: beanstalk.address,
      facetNames: ['SeasonFacet'],
      bip: false,
      object: false,
      verbose: true,
      account: account,
    });

    const signer = await hre.ethers.getImpersonatedSigner(
      '0xc9C32cd16Bf7eFB85Ff14e0c8603cc90F6F2eE49'
    );
    await mintEth(signer.address);

    const sunrise = await beanstalk
      .connect(signer)
      .sunrise({ gasPrice: preUpgradeBaseFees[i] });
    const receipt = await sunrise.wait();

    const gasUsed = receipt.gasUsed;
    const gasPrice = receipt.effectiveGasPrice;
    const [beanTransfer] = receipt.logs.filter((log) => {
      return (
        log.address === '0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab' &&
        hre.ethers.utils.hexZeroPad(receipt.from.toLowerCase(), 32) ===
          log.topics[2]
      );
    });

    if (beanTransfer === undefined) {
      continue;
    }
    const beanAmount = parseInt(beanTransfer?.data, 16);

    const usdGasCost =
      ethPrice * gasUsed * ethers.utils.formatUnits(gasPrice, 'ether');
    const beanInUsd = ethers.utils.formatUnits(beanAmount, 6);

    csvContent +=
      receipt.blockNumber +
      ',' +
      receipt.transactionHash +
      ',' +
      gasUsed +
      ',' +
      gasPrice +
      ',' +
      gasUsed * ethers.utils.formatUnits(gasPrice, 'ether') +
      ',' +
      usdGasCost +
      ',' +
      beanAmount +
      ',' +
      (beanInUsd - usdGasCost) +
      '\n';
  }

  try {
    fs.writeFileSync('./sunrise_simulate.csv', csvContent);
    console.log('Data written to file successfully.');
  } catch (err) {
    console.error('Failed to write to file: ' + err);
    throw err;
  }
}

simulateSeedGaugeSunrises()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });