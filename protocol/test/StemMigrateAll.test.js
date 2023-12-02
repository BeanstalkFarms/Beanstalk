const { impersonateBeanstalkOwner, impersonateSigner } = require('../utils/signer.js')
const { toBN } = require('../utils');
const { mintEth } = require('../utils/mint.js')
const { BEAN, BEANSTALK, BCM, BEAN_3_CURVE, UNRIPE_BEAN, UNRIPE_LP } = require('./utils/constants')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { upgradeWithNewFacets } = require("../scripts/diamond");
const beanstalkABI = require("../abi/Beanstalk.json");
const fs = require('fs');
const { BigNumber } = require('ethers');
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { expect } = require('chai');

//we need to know the amount of BDV that migrated between silo v3 deployment (17671557) and unripe migration (18392690)


//17251905 is the block the enroot fix was deployed
//17671557 is the block the silo v3 was deployed
//18392690 unripe migration

const UNRIPE_MIGRATION = 18392690;
const SILOV3_DEPLOYMENT = 17671557;
const ENROOT_FIX = 17251905;



const FORK_BLOCK_NUMBER = UNRIPE_MIGRATION;
const END_BLOCK = UNRIPE_MIGRATION;
const QUERY_EVENTS_START_BLOCK = SILOV3_DEPLOYMENT;



describe('Silo V3: migration calculation', function () {
  before(async function () {

    try {
      await network.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
              jsonRpcUrl: process.env.FORKING_RPC,
              blockNumber: FORK_BLOCK_NUMBER
            },
          },
        ],
      });
    } catch(error) {
      console.log('forking error in Silo V3: Grown Stalk Per Bdv:');
      console.log(error);
      return
    }

    const signer = await impersonateBeanstalkOwner();
    // const signer = await impersonateSigner(BCM);
    await mintEth(signer.address);
    await upgradeWithNewFacets({
      diamondAddress: BEANSTALK,
      facetNames: ['ConvertFacet', 'WhitelistFacet', 'MockSiloFacet', 'MockSeasonFacet', 'MigrationFacet'],
      // libraryNames: ['LibLegacyTokenSilo'],
      initFacetName: 'InitBipNewSilo',
      bip: false,
      object: false,
      verbose: false,
      account: signer
    });

    this.diamond = BEANSTALK;

    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond);

    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond);
    this.migrate = await ethers.getContractAt('MigrationFacet', this.diamond);
    this.convert = await ethers.getContractAt('ConvertFacet', this.diamond);
    this.whitelist = await ethers.getContractAt('WhitelistFacet', this.diamond);
    this.bean = await ethers.getContractAt('Bean', BEAN);
    this.beanMetapool = await ethers.getContractAt('IMockCurvePool', BEAN_3_CURVE);
    this.unripeBean = await ethers.getContractAt('MockToken', UNRIPE_BEAN)
    this.unripeLP = await ethers.getContractAt('MockToken', UNRIPE_LP)
    this.farm = await ethers.getContractAt('FarmFacet', this.diamond)
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  const provider = new ethers.providers.JsonRpcProvider(process.env.FORKING_RPC);
  const contract = new ethers.Contract(BEANSTALK, beanstalkABI, provider);



  function reformatData(data) {
    let reformattedData = {};
   
    Object.keys(data).forEach(address => {
      let tokens = [];
      let seasons = [];
      let amounts = [];
      let bdvs = [];
   
      Object.keys(data[address]).forEach(token => {
        tokens.push(token);
        let season = [];
        let amount = [];
        let innerBdv = [];
        Object.keys(data[address][token]).forEach(sea => {
          season.push(sea);
          amount.push(data[address][token][sea].amount);
          innerBdv.push(data[address][token][sea].bdv);
        });
        seasons.push(season);
        amounts.push(amount);
        bdvs.push(innerBdv);
      });
   
      reformattedData[address] = {
        "tokens": tokens,
        "seasons": seasons,
        "amounts": amounts,
        "bdvs": bdvs
      };
    });
   
    return reformattedData;
   }

  const queryEvents = async (eventSignature, interface, startBlock) => {
    const eventTopic = ethers.utils.id(eventSignature);
    // Create the filter object
    const filter = {
      fromBlock: startBlock,
      toBlock: END_BLOCK,
      address: contract.address,
      topics: [eventTopic]
    };
    const events = await contract.provider.getLogs(filter, 0, END_BLOCK);
    const updatedEvents = events.map((eventLog) => {
      let parsedLog;
      parsedLog = interface.parseLog(eventLog);
      if (parsedLog) {
        const { args } = parsedLog;
        eventLog = { ...eventLog, ...args };
        const eventName = eventSignature.split("(")[0];
        eventLog["event"] = eventName;
      }
      return eventLog;
    });
    return updatedEvents;
  };

  //get deposits for a sample big depositor, verify they can migrate their deposits correctly
  describe('properly migrates deposits', function () {
    it('for all depositors', async function () {

      console.log('start load');

      let deposits = JSON.parse(await fs.readFileSync(__dirname + '/../../projects/ui/src/functions/silov3/data/raw/deposits.json')); 
      let merkleData = JSON.parse(await fs.readFileSync(__dirname + '/../../projects/ui/src/functions/silov3/data/raw/merkle.json')); 

      // console.log('deposits: ', deposits);


      const oldRemoveDepositAbi = [
        {
            anonymous: false,
            inputs: [
            { indexed: true, internalType: "address", name: "account", type: "address" },
            { indexed: true, internalType: "address", name: "token", type: "address" },
            { indexed: false, internalType: "uint32", name: "season", type: "uint32" },
            { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
            ],
            name: "RemoveDeposit",
            type: "event",
        },
    ];

      const removeDepositInterface = new ethers.utils.Interface(oldRemoveDepositAbi);

      //get every transaction that emitted the RemoveDeposit event after block 17671557
      //this is the block that silo v3 was deployed on:
      //https://etherscan.io/tx/0x17ca3482479f4a0f13f0337a9288b8569e531e71e1e932813d04e6ed1224e95c
      //the idea is that we are starting with a list of all deposits at the point of silo v3 deployment (deposits.json)
      //then we want to see which accounts migrated, which we can do by looking at all the legacy RemoveDeposit events
      //and removing those accounts from the list of deposits that were present at the time of silo v3 deployment
      let events = await queryEvents("RemoveDeposit(address,address,uint32,uint256)", removeDepositInterface, QUERY_EVENTS_START_BLOCK);

      //log number of deposits
      console.log('deposits before: ', Object.keys(deposits).length);

      const depositsMigratedBetweenSiloV3AndUnripeMigration = {};

      //loop through events
      for (let i = 0; i < events.length; i++) {
        let event = events[i];
        //get account from event
        let account = event.account;
        //if this account is in the deposits file, remove the entire account
        // if (deposits[account]) {
        //   delete deposits[account];
        // }

        depositsMigratedBetweenSiloV3AndUnripeMigration[account] = deposits[account];
      }

      console.log('deposits remaining unmigrated: ', Object.keys(deposits).length);

      // var depositsReformatted = reformatData(deposits)
      var depositsReformatted = reformatData(depositsMigratedBetweenSiloV3AndUnripeMigration)

      var totalGasUsed = BigNumber.from(0);

      var batchIntoGroupsOf = 10;

      var nextToMigrate = [];

      var unmigrated = {};

      var progress = 0;
      for (const depositorAddress in depositsReformatted) {
          console.log('progress:', progress, 'depositorAddress: ', depositorAddress, 'totalGasUsed: ', totalGasUsed);

          const tokens = depositsReformatted[depositorAddress]['tokens'];
          const seasons = depositsReformatted[depositorAddress]['seasons'];
          const amounts = depositsReformatted[depositorAddress]['amounts'];
          const bdvs = depositsReformatted[depositorAddress]['bdvs'];

          for (var i = 0; i < tokens.length; i++) {
            for (var j = 0; j < bdvs[i].length; j++) {
              var token = tokens[i];
              var bdv = bdvs[i][j];

              if (!unmigrated[token]) {
                unmigrated[token] = BigNumber.from(0);
              }

              unmigrated[token] = unmigrated[token].add(bdv);
            }
          }

          console.log('migrated between silov3 and unripe migration: ', unmigrated);

          /*
          let stalkDiff = 0;
          let seedsDiff = 0;
          let proof = [];

          if (merkleData[depositorAddress]) {
            stalkDiff = merkleData[depositorAddress]['stalk'];
            seedsDiff = merkleData[depositorAddress]['seeds'];
            proof = merkleData[depositorAddress]['proof'];
          }

          const depositorSigner = await impersonateSigner(depositorAddress);
          mintEth(depositorAddress);
          await this.silo.connect(depositorSigner);

          //use farm to call mowAndMigrate
          const migrateEncoded = this.migrate.interface.encodeFunctionData('mowAndMigrate', [depositorAddress, tokens, seasons, amounts, stalkDiff, seedsDiff, proof]);

          nextToMigrate.push(migrateEncoded);

          //address is last depositor in depositors list
          if (nextToMigrate.length == batchIntoGroupsOf || '0xb3ce85df372271f37dbb40c21aca38acacbb315f' == depositorAddress) {

            const migrateResult = await this.farm.connect(depositorSigner).farm(nextToMigrate);

            // const migrateResult = await this.migrate.mowAndMigrate(depositorAddress, tokens, seasons, amounts, stalkDiff, seedsDiff, proof);

            const receipt = await migrateResult.wait();
            const gasUsed = receipt.gasUsed;
            console.log('gasUsed: ', gasUsed);
            totalGasUsed = totalGasUsed.add(gasUsed);
            nextToMigrate = [];
          }

          // console.log('here 5');
          progress++;*/
      }

      console.log('final totalGasUsed: ', totalGasUsed);
    });
  });
});