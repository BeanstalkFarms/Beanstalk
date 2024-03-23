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
const { setReserves } = require("../utils/well.js");

//////////////////////// STEPS ////////////////////////
// 1. Fetch all sunrise events in the last 6 months
// 1.check sunrise block --> if it is later than top of hour --> search for block number closest to true sunrise block
// 2.Go to block before sunrise
// 3.upgrade beanstalk with seed gauge
// call sunrise
// check block base fee (gwei) 
// check eth price from oracle 
// log sunrise data
// write to csv all info 
// reverto to block before sunrise
// go forward to the next sunrise
// repeat.....

const START_BLOCK = 18137928; // 190 days ago
const ANVIL_FORK_BLOCK = 19497260;
const csvFilePath = './sunrise_simulation.csv';

async function writeSunriseBlockNumbersToFile() {
  // get season facet
  const seasonFacet = await hre.ethers.getContractAt(
    'SeasonFacet',
    '0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5'
  );
  
  // fetch the sunrise events in the last 6 months
  const events = await seasonFacet.queryFilter(
    'Sunrise(uint256)',
    START_BLOCK,
    'latest'
  );

  const blockNumbers = events.map((event) => event.blockNumber);
  fs.writeFileSync('sunrise_block_numbers.txt', blockNumbers.join('\n'));
}


async function simulateSeedGaugeSunrises() {

    // remove the csv file if it exists
    if (fs.existsSync(csvFilePath)) {
        fs.unlinkSync(csvFilePath);
    }

    // Write CSV headers
    writeToCsv([
        "Iteration",
        "Sunrise Block",
        "Sunrise block timestamp",
        "Gas Used (computational units)",
        "Gas Price (gwei)",
        "Gas Cost (ETH)",
        "Gas Cost (USD)",
        "Bean Amount",
        "Profit"
    ]);
  
    console.log("\n////////////////////////// INITIAL STATE //////////////////////////")
  
    // fetch the baseFee of the block at the top of the hour 
    const baseFeeData = await hre.ethers.provider.getFeeData();
    const formattedBaseFee = hre.ethers.utils.formatUnits(baseFeeData.lastBaseFeePerGas, 'gwei');
    console.log('Initial baseFee: ', formattedBaseFee + ' gwei');
    
    // get bean eth well deployed at: 0xBEA0e11282e2bB5893bEcE110cF199501e872bAd
    const well = await getWellContractAt("Well", "0xBEA0e11282e2bB5893bEcE110cF199501e872bAd");
    
    // fetch the reserves of the bean/eth well at the top of the hour
    const reserves = await well.getReserves();
    console.log("Well Statistics:")
    console.log("Bean Reserve:", reserves[0].toString());
    console.log("Eth Reserve:", reserves[1].toString());
    console.log("LP Token Total Supply:", (await well.totalSupply()).toString());
    console.log("initial ETH Price: ", await getETHPriceAtCurrentBlock());

    console.log("Number of sunrise events: ", events.length);
    // for all events get block number 
    const blockNumbers = events.map((event) => event.blockNumber);

    for (let i = 0; i < 1; i++) {

      const event = events[i];
  
      const lastTimestamp = (await hre.ethers.provider.getBlock('latest')).timestamp;
      const sunriseBlock = await hre.ethers.provider.getBlock(event.blockNumber);
      const sunriseTimestamp = sunriseBlock.timestamp;
      await hre.network.provider.send('evm_setNextBlockTimestamp', [sunriseTimestamp]);
      await setNextBlockBaseFee(event.baseFee);
  
      await bipSeedGauge();
  
      simulateSunrise(event.baseFee, i);
    }

    // for (let i = 0; i < 1; i++) {
    //     console.log("\n////////////////////////// ITERATION ", i, " //////////////////////////")

    //     // get the block number of the next sunrise event
    //     const blockNumber = blockNumbers[i];
    //     console.log("Sunrise block number: ", blockNumber);

    //     // get the block before the sunrise event
    //     const blockBeforeSunrise = blockNumber - 1;
    //     console.log("Block before sunrise: ", blockBeforeSunrise);

    //     // take a snapshot of the current state
    //     const snapshotId = await takeSnapshot;
    //     console.log("Snapshot taken: ", snapshotId);

    //     console.log("\n////////////////////////// SEED GAUGE UPGRADE //////////////////////////")
    //     // upgrade beanstalk at the block right before the sunrise block
    //     console.log("Excuting the deployBip39 upgrade script...")
    //     // this does not mine a block since --no-mining flag is set
    //     await bipSeedGauge();

    //     // mine 1 block
    //     // await network.provider.send("evm_mine");

    //     // get the base fee of the block before the sunrise event
    //     const baseFeeData = await hre.ethers.provider.getFeeData();
    //     const formattedBaseFee = hre.ethers.utils.formatUnits(baseFeeData.lastBaseFeePerGas, 'gwei');
    //     console.log('Base Fee before sunrise: ', formattedBaseFee + ' gwei');

    //     // simulate sunrise
    //     await simulateSunrise(baseFeeData.lastBaseFeePerGas, reserves, i);

    //     // revert to the snapshot
    //     await revertToSnapshot(snapshotId);
    //     console.log("Reverted to snapshot: ", snapshotId);
    // }

}

// TODO: Adjust the block numbers to the closest block number to the true sunrise block
// async function adjustDelayedSunriseBlockNumebers(blockNumbers) {

async function simulateSunrise(baseFee, index) {

    console.log("\n////////////////////////// SUNRISE TX //////////////////////////")
    // call sunrise
    const seasonFacet = await hre.ethers.getContractAt(
      'SeasonFacet',
      '0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5'
    );
  
    console.log("Sunrise block reached: ", await hre.ethers.provider.getBlockNumber());
    console.log("Calling sunrise...");
    
    const maxFeePerGas = hre.ethers.utils.parseUnits('150', 'gwei');

    await seasonFacet.sunrise({maxFeePerGas: maxFeePerGas});

    // wait 100 ms
    await new Promise((resolve) => setTimeout(resolve, 100));
  
    const sunriseEvents = await seasonFacet.queryFilter(
      'Sunrise(uint256)',
       hre.ethers.provider.getBlockNumber() - 10,
      'latest'
    );
  
    const txHash = sunriseEvents[0].transactionHash;
    const receipt = await hre.ethers.provider.getTransactionReceipt(txHash);
    // console.log("Sunrise Receipt: ", receipt);
  
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

    ethPrice = await getETHPriceAtCurrentBlock();
  
    const usdGasCost =
      ethPrice * gasUsed * hre.ethers.utils.formatUnits(gasPrice, 'ether');
    const beanInUsd = hre.ethers.utils.formatUnits(beanAmount, 6);

    console.log("Sunrise Gas Used: ", gasUsed);
    console.log("Sunrise Gas Price: ", gasPrice);
    console.log("Sunrise Gas Cost: ", gasUsed * ethers.utils.formatUnits(gasPrice, 'ether'));
    console.log("Sunrise Gas Cost in Dollars: ", usdGasCost);
    console.log("Bean Amount: ", beanAmount);
    console.log("Profit: ", (beanInUsd - usdGasCost));
    console.log("Block timestamp: ", (await hre.ethers.provider.getBlock(receipt.blockNumber)).timestamp);
    console.log("Block datetime: ", new Date((await hre.ethers.provider.getBlock(receipt.blockNumber)).timestamp * 1000));

    writeToCsv([
        index, // iteration
        await hre.ethers.provider.getBlockNumber(), // sunrise block
        (await hre.ethers.provider.getBlock(receipt.blockNumber)).timestamp, // sunrise block timestamp
        gasUsed.toString(), // gas used
        hre.ethers.utils.formatUnits(gasPrice, 'gwei'), // gas price
        (gasUsed * ethers.utils.formatUnits(gasPrice, 'ether')).toString(), // gas cost
        usdGasCost.toString(), // gas cost in dollars
        hre.ethers.utils.formatUnits(beanAmount, 6).toString(), // bean amount
        (beanInUsd - usdGasCost).toString(), // profit
    ]);
}

////////////////////////// HELPER FUNCTIONS //////////////////////////

// Function to write data to CSV
function writeToCsv(data) {
    const csvString = `${data.join(',')}\n`;
    fs.appendFileSync(csvFilePath, csvString, (err) => {
        if (err) throw err;
    });
}

async function getETHPriceAtCurrentBlock() {
    const oracle = await hre.ethers.getContractAt(
      'UsdOracle',
      '0x1aa19ed7DfC555E4644c9353Ad383c33024855F7'
    );
    const ethPrice = await oracle.getEthUsdPrice();
    return ethPrice;
}

async function updateReserves(account, well, reserves) {
    console.log("Updating reserves...");
    await setReserves(account, well, reserves);
}

async function setNextBlockBaseFee(baseFee) {
    console.log("Setting next block base fee to: ", hre.ethers.utils.formatUnits(baseFee, 'gwei') + ' gwei');
    await network.provider.send("anvil_setNextBlockBaseFeePerGas", [
      hre.ethers.utils.hexlify(baseFee),
    ]);
}

async function resetFork() {
    // reset the fork
    try {
        console.log("Resetting the fork...");
        await network.provider.send("anvil_reset");
    } catch (error) {
        // for some reason, the fork reset returns a ProviderError: Not Implemented
        // but the anvil node command is executed successfully
        console.log("Fork reset successfully.");
        console.log("Current block: ", await hre.ethers.provider.getBlockNumber());
    }
}

simulateSeedGaugeSunrises()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
});