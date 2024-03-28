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


const csvFilePath = 'sunrise_simulation.csv';
const FORKING_BLOCK_NUMBER = 19398596;

async function simulateSeedGaugeSunrises() {

    // remove the csv file if it exists
    if (fs.existsSync(csvFilePath)) {
        fs.unlinkSync(csvFilePath);
    }

    // Write CSV headers
    writeToCsv([
        "Iteration",
        "Sunrise Block",
        "Gas Used (computational units)",
        "Gas Price (gwei)",
        "Gas Cost (ETH)",
        "Gas Cost (USD)",
        "Bean Amount",
        "Profit"
    ]);
    
    // get bean eth well deployed at: 0xBEA0e11282e2bB5893bEcE110cF199501e872bAd
    // const well = await getWellContractAt("Well", "0xBEA0e11282e2bB5893bEcE110cF199501e872bAd");

    const sunriseBlockInfoCsv = 'adjusted_blocks_info_final.csv';

    const sunriseBlocks = await readCsvFile(sunriseBlockInfoCsv);

    // console.log("Going forward 1000 blocks...")
    // mine 100 blocks to reach the next sunrise block
    // for (let i = 0; i < 1000; i++) {
    //     await network.provider.send("evm_mine");
    // }
    
    for (let i = 0; i < sunriseBlocks.length; i++) {

        console.log("\n////////////////////////// ITERATION ", i, " //////////////////////////")

        // console.log("Taking snapshot...")
        // const snapshotId = await takeSnapshot();
        // console.log("Snapshot taken: ", snapshotId);

        const row = sunriseBlocks[i];
        const blockNumber = parseInt(row['Block Number']);

        // reset fork to the block number of the sunrise
        console.log("Resetting fork to sunrise block number: ", blockNumber);
        await resetForkToBlock(blockNumber);


        // obtain current parameters
        
        // get the eth price at the current block
        let ethPrice = await getETHPriceAtCurrentBlock();
        ethPrice = ethers.utils.formatUnits(ethPrice, 6);
        console.log("Current ETH Price from Oracle: ", ethPrice);

        // get the base fee of the block
        const baseFeeData = await hre.ethers.provider.getFeeData();
        const baseFee = baseFeeData.lastBaseFeePerGas;
        console.log("Base Fee: ", hre.ethers.utils.formatUnits(baseFee, 'gwei') + ' gwei');

        // reset to 18 blocks before the sunrise and excecute seed gauge
        console.log("Resetting fork to 18 blocks before sunrise...");
        await resetForkToBlock(blockNumber);

        // seed gauge takes 17 blocks to execute
        console.log("Executing Seed Gauge...");
        await bipSeedGauge();
        
        // wait 100 ms for events to be emitted
        await new Promise((resolve) => setTimeout(resolve, 100));

        // mine 100 blocks to reach the next sunrise block
        // for (let i = 0; i < 1000; i++) {
        //     await network.provider.send("evm_mine");
        // }

        // set the base fee for the next block to be the same as the sunrise block
        await setNextBlockBaseFee(baseFee);

        // simulate sunrise
        await simulateSunrise(blockNumber, baseFee, i, ethPrice);
    }
  }
  

async function simulateSunrise(blockNumber, baseFee, index, ethPrice) {

    console.log("\n////////////////////////// SUNRISE TX //////////////////////////")
    // call sunrise
    const seasonFacet = await hre.ethers.getContractAt(
      'SeasonFacet',
      '0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5'
    );
  
    console.log("Sunrise block : ", await hre.ethers.provider.getBlockNumber());
    console.log("Calling sunrise...");
    
    // const maxFeePerGas = hre.ethers.utils.parseUnits('150', 'gwei');

    await seasonFacet.sunrise();

    // wait 100 ms for events to be emitted
    await new Promise((resolve) => setTimeout(resolve, 100));
        
    const sunriseEvents = await seasonFacet.queryFilter(
      'Sunrise(uint256)',
       blockNumber - 100,
      'latest'
    );

    console.log("Sunrise events: ", sunriseEvents.length);
  
    const txHash = sunriseEvents[0].transactionHash;

    const receipt = await hre.ethers.provider.getTransactionReceipt(txHash);

    // console.log("Sunrise receipt: ", receipt);
  
    const gasUsed = receipt.gasUsed;

    const gasPrice = receipt.effectiveGasPrice;

    const [beanTransfer] = receipt.logs.filter((log) => {
      return (
        log.address === '0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab' &&
        hre.ethers.utils.hexZeroPad(receipt.from.toLowerCase(), 32) ===
          log.topics[2]
      );
    });
  
    // console.log("Bean Transfer: ", beanTransfer);
  
    const beanAmount = parseInt(beanTransfer?.data, 16);

    const usdGasCost =
      ethPrice * gasUsed * hre.ethers.utils.formatUnits(gasPrice, 'ether');

    const beanInUsd = hre.ethers.utils.formatUnits(beanAmount, 6);

    const gasCostEth = gasUsed * hre.ethers.utils.formatUnits(gasPrice, 'ether');

    console.log("Sunrise Gas Used: ", gasUsed);
    console.log("Sunrise Gas Price: ", gasPrice);
    console.log("Sunrise Gas Cost: ", gasCostEth);
    console.log("Sunrise Gas Cost in Dollars: ", usdGasCost);
    console.log("Bean Amount: ", beanAmount);
    console.log("Bean in USD: ", beanInUsd);
    console.log("ETH Price: ", ethPrice)
    console.log("Profit: ", (beanInUsd - usdGasCost));

    writeToCsv([
        index, // iteration
        blockNumber, // sunrise block
        gasUsed, // gas used (computational units)
        hre.ethers.utils.formatUnits(gasPrice, 'gwei'), // gas price (gwei)
        (gasUsed * ethers.utils.formatUnits(gasPrice, 'ether')).toString(), // gas cost
        usdGasCost.toString(), // gas cost in dollars
        hre.ethers.utils.formatUnits(beanAmount, 6).toString(), // bean amount
        (beanInUsd - usdGasCost).toString() // profit
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

function numberToRpcQuantity(value) {
    value = value.toBigInt();
    return `0x${value.toString(16)}`;
}

async function setNextBlockBaseFee(baseFee) {
    // console.log("Setting next block base fee to: ", hre.ethers.utils.formatUnits(baseFee, 'gwei') + ' gwei');
    // console.log("Hex representation: ", hre.ethers.utils.hexlify(baseFee));
    // console.log("NUmber to RPC Quantity: ", numberToRpcQuantity(baseFee));
    await hre.network.provider.send("hardhat_setNextBlockBaseFeePerGas", [
      numberToRpcQuantity(baseFee),
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

async function resetForkToBlock(blockNumber) {
    await network.provider.request({
        method: 'hardhat_reset',
        params: [
          {
            forking: {
              jsonRpcUrl: "",
              blockNumber: blockNumber,
            },
          },
        ],
    });
}

simulateSeedGaugeSunrises()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
});