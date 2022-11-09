const { UNRIPE_LP } = require('../test/utils/constants.js');
const { modifySeeds } = require('./modifySeeds');
const { BEAN, BEANSTALK, BCM, USDC, BEAN_3_CURVE, ZERO_ADDRESS, CURVE_ZAP, TEST_GNOSIS } = require('../test/utils/constants.js');
const { fetchUnripeLPDeposits } = require('./fetchUnripeLPDeposits');

//npx hardhat compile && npx hardhat rebalance --network localhost

//use debugger:
//npx --node-options="--inspect" hardhat rebalance --network localhost

async function rebalance(account, deployAccount=undefined, mock=true, log=false, start=3, end=0) {
    

    console.log('starting Rebalance');
    console.log('mock: ', mock);

    if (mock) {

        //reset back to block whatever for testing so we can just run this script over and over and mess with stuff each time
        await network.provider.request({
          method: "hardhat_reset",
          params: [{
              forking: {
                jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/_WAraN_FKdx5A8J70d7xUvzDQVYMFKac`,
                blockNumber: 15736326, //todo: update block number before launch
              },
            },],
        });


        //give BCM some eth so we can do stuff
        //0x thing necessary to impersonate contracts https://github.com/foundry-rs/foundry/issues/1943
        //this is taken from replant10.js
        await hre.network.provider.send("hardhat_setCode", [BCM, "0x"]);
        await hre.network.provider.send("hardhat_setBalance", [BCM, "0xDE0B6B3A7640000"]);
        console.log('gave bcm some eth');
    }

    //first, we need to get all the current unripe LP deposits, save them to a file, and withdraw them
    const unripeLPDeposits = await fetchUnripeLPDeposits(account);

    //with BCM account Decrement s.ss[token].seeds value in storage
    await modifySeeds(account, deployAccount, unripeLPDeposits);

    console.log("Rebalance successful.")
  }

exports.rebalance = rebalance;