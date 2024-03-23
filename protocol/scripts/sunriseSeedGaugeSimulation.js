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
const Papa = require('papaparse');

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

const csvFilePath = 'sunrise_simulation.csv';

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
    
    // get bean eth well deployed at: 0xBEA0e11282e2bB5893bEcE110cF199501e872bAd
    const well = await getWellContractAt("Well", "0xBEA0e11282e2bB5893bEcE110cF199501e872bAd");

    console.log("////////////////////////// SEED GAUGE UPGRADE //////////////////////////")

    await bipSeedGauge();

    const sunriseBlockInfoCsv = 'adjusted_blocks_info_final.csv';

    const sunriseBlocks = await readCsvFile(sunriseBlockInfoCsv);
    
    for (let i = 0; i < sunriseBlocks.length; i++) {

        const snapshotId = await takeSnapshot();

        const row = sunriseBlocks[i];
        const blockNumber = parseInt(row['Block Number']);
        const baseFee = hre.ethers.utils.parseUnits(row['Base Fee (Gwei)'], 'gwei');
        const ethPrice = parseFloat(row['ETH Price (USD)']);

        console.log("Block Number: ", blockNumber);
        console.log("Base Fee: ", baseFee);
        console.log("ETH Price: ", ethPrice);

        // set the base fee for the next block
        await setNextBlockBaseFee(baseFee);

        // simulate sunrise
        await simulateSunrise(blockNumber, baseFee, i);

        // go to the next block
        await network.provider.send("evm_mine", [adjustedBlockNumber]);

        await revertToSnapshot(snapshotId);
    }
  }
  

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

function readCsvFile(filePath) {
  return new Promise((resolve, reject) => {
      // Read the CSV file as a string
      fs.readFile(filePath, 'utf8', (err, data) => {
          if (err) {
              reject(err);
              return;
          }

          // Parse CSV string
          Papa.parse(data, {
              header: true, // Use the first row as property names
              complete: (results) => {
                  resolve(results.data); // Resolve promise with parsed objects
              },
              error: (error) => {
                  reject(error); // Reject promise on error
              }
          });
      });
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