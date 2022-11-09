const { impersonateBeanstalkOwner } = require('../utils/signer.js');
const { upgradeWithNewFacets } = require('../scripts/diamond.js');
const { BEANSTALK, UNRIPE_LP } = require('../test/utils/constants.js');
const beanstalkABI = require("../abi/Beanstalk.json");


async function fetchUnripeLPDeposits (
        account
    ) {
    console.log('-----------------------------------')
    console.log('Fetching Unripe LP deposits\n')
    

    const contract = new ethers.Contract(BEANSTALK, beanstalkABI, account);

    // const addDeposits = await contract.filters.AddDeposit(null);


    //create an event filter to find all the AddDeposits for unripe LP token
    let eventFilter = contract.filters.AddDeposit(null, UNRIPE_LP);
    //the to block of 0xe91fe4 was suggested by hardhat but I think this needs to be updated
    const addDeposits = await contract.queryFilter(eventFilter, 0x0, 0xe91fe4);

    // console.log('addDeposits: ', addDeposits);

    //all we need from the deposits are the address and the season, we get BDV from the blockchain in the Solidity code
    const deposits = addDeposits.map((d) => {
        return [d.args.account, d.args.season];
    });

    
    return deposits;
    
    // console.log('-----------------------------------')
}
exports.fetchUnripeLPDeposits = fetchUnripeLPDeposits
