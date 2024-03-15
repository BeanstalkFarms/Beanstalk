const beanstalkABI = require('../abi/Beanstalk.json');
const { upgradeWithNewFacets } = require('./diamond.js');
const hre = require('hardhat');
const { impersonateBeanstalkOwner, mintEth, mintBeans } = require('../utils/index.js');
const fs = require('fs');
var exec = require('child_process').exec;
// BIP 39 
const { bipSeedGauge } = require("./bips.js");
const { getWellContractAt } = require("../utils/well.js");
const { takeSnapshot, revertToSnapshot} = require("../test/utils/snapshot.js");


//////////////////////// STEPS ////////////////////////
// - fetch the baseFee of the block at the top of the hour --> done
// - fetch the reserves of the bean/eth well at the top of the hour --> done 

// then run a script that
// (1) upgrades beanstalk at the block right before the sunrise block 
// (2) update the base fee, update reserves
// (3) calls sunrise, logs data
// (4) revert back to previous block,
// (5) repeat steps (2) - (4)

const BEFORE_SUNRISE_BLOCK = 19398596;
const SUNRISE_BLOCK = 19398597;

async function setNextBlockBaseFee(baseFee) {
  await network.provider.send("anvil_setNextBlockBaseFeePerGas", [
    hre.ethers.utils.hexlify(baseFee),
  ]);
}

async function simulateSeedGaugeSunrises() {
  
    console.log("\n////////////////////////// INITIAL STATE //////////////////////////")
  
    // fetch the baseFee of the block at the top of the hour 
    const baseFeeData = await hre.ethers.provider.getFeeData();
    console.log('Initial baseFee: ', baseFeeData.lastBaseFeePerGas.toString());
    
    // get bean eth well deployed at: 0xBEA0e11282e2bB5893bEcE110cF199501e872bAd
    const well = await getWellContractAt("Well", "0xBEA0e11282e2bB5893bEcE110cF199501e872bAd");
    
    // fetch the reserves of the bean/eth well at the top of the hour
    const reserves = await well.getReserves();
    console.log("Well Statistics:")
    console.log("Bean Reserve:", reserves[0].toString());
    console.log("Eth Reserve:", reserves[1].toString());
    console.log("LP Token Total Supply:", (await well.totalSupply()).toString());
  
    console.log("\n////////////////////////// SEED GAUGE UPGRADE //////////////////////////")
  
    // upgrade beanstalk at the block right before the sunrise block
    console.log("Excuting the deployBip39 upgrade script...")
    await bipSeedGauge();

    console.log("Beanstalk upgraded at block: ", await hre.ethers.provider.getBlockNumber());
  
    console.log("\n////////////////////////// SNAPSHOT //////////////////////////")
  
    // capture a snapshot of the current state of the blockchain
    console.log("Capturing a snapshot of the current state of the blockchain... Block:" + await hre.ethers.provider.getBlockNumber());
    const snapshotId = await takeSnapshot();
    console.log("Snapshot ID: ", snapshotId);

    for (let i = 0; i < 10; i++) {
      console.log("////////////////////////// ITERATION: ", i, " //////////////////////////")
      const baseFee = 100000000000;
      const reserves = [100000000000, 100000000000];
      await simulateSunrise(baseFee, reserves, snapshotId);
    }

    // reset the fork
    console.log("Resetting the fork...");
    await network.provider.send("anvil_reset");
    console.log("Fork reset successfully.");
    console.log("Current block: ", await hre.ethers.provider.getBlockNumber());
}

async function simulateSunrise(baseFee, reserves, snapshotId) {
    console.log("\n////////////////////////// SUNRISE TX //////////////////////////")
  
    // call sunrise
    const seasonFacet = await hre.ethers.getContractAt(
      'SeasonFacet',
      '0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5'
    );
  
    // // go forward a block to reach the sunrise block
    // console.log("Going forward a block to reach the sunrise block...")
    // // await hre.network.provider.send("anvil_mine");
  
    console.log("Sunrise block reached: ", await hre.ethers.provider.getBlockNumber());
    console.log("Calling sunrise...");

    const sunriseReceipt = await seasonFacet.sunrise();
  
    const sunriseEvents = await seasonFacet.queryFilter(
      'Sunrise(uint256)',
       BEFORE_SUNRISE_BLOCK - 10,
      'latest'
    );
  
    console.log("Number of sunrise events: ", sunriseEvents.length);
  
    const txHash = sunriseEvents[0].transactionHash;
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    //console.log("Sunrise Receipt: ", receipt);
  
    const gasUsed = receipt.gasUsed;
    const gasPrice = receipt.effectiveGasPrice;
    const [beanTransfer] = receipt.logs.filter((log) => {
      return (
        log.address === '0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab' &&
        hre.ethers.utils.hexZeroPad(receipt.from.toLowerCase(), 32) ===
          log.topics[2]
      );
    });
  
    console.log("Bean Transfer: ", beanTransfer);
  
    const beanAmount = parseInt(beanTransfer?.data, 16);
  
    const ethPrice = 3800;
  
    const usdGasCost =
      ethPrice * gasUsed * ethers.utils.formatUnits(gasPrice, 'ether');
    const beanInUsd = ethers.utils.formatUnits(beanAmount, 6);

    console.log("Sunrise Gas Used: ", gasUsed);
    console.log("Sunrise Gas Price: ", gasPrice);
    console.log("Sunrise Gas Cost: ", gasUsed * ethers.utils.formatUnits(gasPrice, 'ether'));
    console.log("Sunrise Gas Cost in Dollars: ", usdGasCost);
    console.log("Bean Amount: ", beanAmount);
    console.log("Profit: ", (beanInUsd - usdGasCost));

    const logTopicMapping = {
        "0xb360bcf4b60112f485fd94b599df45181250ef0e80538be7b334728ab0990b1a": "Sunrise",
        "0x0e0c101fa6afb12838450cfd752d904d70198349367ff256b1460f10bcbd1904": "MetaPoolOracle",
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef": "Bean Transfer Reward",
        "0xbb4f656853bc420ad6e4321622c07eefb4ed40e3f91b35553ce14a6dff4c0981": "Incentivization (Bean transfer reward_"
    }
    // set next block base fee to 100 gwei
    // setNextBlockBaseFee(baseFee);

    // revert to previous block
    await revertToSnapshot(snapshotId);
}

////////////////////////// END //////////////////////////




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