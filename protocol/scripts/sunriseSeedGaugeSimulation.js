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
const csvFilePath = './sunrise_simulation.csv';
const ethPrice = 3800;

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
  
    console.log("\n////////////////////////// SEED GAUGE UPGRADE //////////////////////////")
  
    // upgrade beanstalk at the block right before the sunrise block
    console.log("Excuting the deployBip39 upgrade script...")
    await bipSeedGauge();

    console.log("\nBeanstalk upgraded at block: ", await hre.ethers.provider.getBlockNumber());

    // starting base fee = 10 gwei
    let baseFee = hre.ethers.utils.parseUnits('10.0', 'gwei');
    setNextBlockBaseFee(baseFee);

    for (let i = 0; i < 100; i++) {

        // capture a snapshot of the current state of the blockchain
        console.log("Capturing a snapshot of the current state of the blockchain at block: " + await hre.ethers.provider.getBlockNumber());
        let snapshotId = await takeSnapshot();
        console.log("Snapshot ID: ", snapshotId);

        console.log("////////////////////////// ITERATION: ", i, " //////////////////////////")
        console.log("Base Fee: ", hre.ethers.utils.formatUnits(baseFee, 'gwei') + ' gwei');
        const reserves = [100000000000, 100000000000];
        await simulateSunrise(baseFee, reserves, ethPrice, i);

        // revert to previous block
        await revertToSnapshot(snapshotId);

        // increase the base fee by 1 gwei
        baseFee = baseFee.add(hre.ethers.utils.parseUnits('1.0', 'gwei'));
        setNextBlockBaseFee(baseFee);
    }

    // reset the fork
    await resetFork();

}

async function simulateSunrise(baseFee, reserves, ethPrice, index) {

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
       BEFORE_SUNRISE_BLOCK - 10,
      'latest'
    );
  
    console.log("Number of sunrise events: ", sunriseEvents.length);
  
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
  
    const usdGasCost =
      ethPrice * gasUsed * hre.ethers.utils.formatUnits(gasPrice, 'ether');
    const beanInUsd = hre.ethers.utils.formatUnits(beanAmount, 6);

    console.log("Sunrise Gas Used: ", gasUsed);
    console.log("Sunrise Gas Price: ", gasPrice);
    console.log("Sunrise Gas Cost: ", gasUsed * ethers.utils.formatUnits(gasPrice, 'ether'));
    console.log("Sunrise Gas Cost in Dollars: ", usdGasCost);
    console.log("Bean Amount: ", beanAmount);
    console.log("Profit: ", (beanInUsd - usdGasCost));

    writeToCsv([
        index, // iteration
        await hre.ethers.provider.getBlockNumber(), // sunrise block
        gasUsed.toString(), // gas used
        hre.ethers.utils.formatUnits(gasPrice, 'gwei'), // gas price
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