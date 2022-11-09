const { upgradeWithNewFacets } = require('../scripts/diamond.js');
const { BEANSTALK, PRICE_DEPLOYER } = require('../test/utils/constants.js');
const { impersonateSigner } = require('../utils/signer.js');
const { wrapWithRetryHandling } = require('../replant/utils/retry.js');

const chunkArray = (arr, size) =>
    arr.length > size
    ? [arr.slice(0, size), ...chunkArray(arr.slice(size), size)]
    : [arr];

async function modifySeeds (
        account,
        deployAccount,
        unripeLPDeposits
    ) {
    console.log('-----------------------------------')
    console.log('Modify Seeds: Modify the seeds, yo\n')

    //get unripe LP deposits

    const modifySeedsContract = await ethers.getContractFactory('ModifySeeds', account)
    const contract = await modifySeedsContract.deploy()
    await contract.deployed()
    const deployReceipt = await contract.deployTransaction.wait()
    console.log(`ModifySeeds deploy gas used: ` + deployReceipt.gasUsed)
    const initFacetAddress = deployReceipt.contractAddress
    console.log(`ModifySeeds address: ` + initFacetAddress)

    const diamondCut = await ethers.getContractAt('DiamondCutFacet', BEANSTALK)
  
    const diamondCutRetry = wrapWithRetryHandling((functionCall, initAddress) => {
        return diamondCut.connect(account).diamondCut(
          [],
          initAddress,
          functionCall
        )
      })

      //first reduce seeds count
    var functionCall = contract.interface.encodeFunctionData("reduceUnripeLPSeeds");
    console.log("made function call to reduce seeds number");
    const receipt = await diamondCutRetry(functionCall, initFacetAddress);
    console.log("finished diamond cut retry on reduce unripe");
    const gasUsed = (await receipt.wait()).gasUsed;
    console.log("gasUsed on reduce unripe lp seeds: ", gasUsed);
      
    //150 per chunk still takes some time, maybe make smaller?
    const chunked = chunkArray(unripeLPDeposits, 150);


    for (let i = 0; i < chunked.length; i++) {
        var functionCall = contract.interface.encodeFunctionData("init", [chunked[i]]);
        console.log("made function call ", i);
        const receipt = await diamondCutRetry(functionCall, initFacetAddress);
        console.log("finished diamond cut retry");
        const gasUsed = (await receipt.wait()).gasUsed;
        console.log("gasUsed: ", gasUsed);
    }
}

exports.modifySeeds = modifySeeds;
