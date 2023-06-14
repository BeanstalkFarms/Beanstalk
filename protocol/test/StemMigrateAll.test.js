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

const BLOCK_NUMBER = 17301500; //a recent block number. Using this so that the currentStalkDiff in _mowAndMigrateMerkleCheck is exercised

//17251905 is the block the enroot fix was deployed


const eventsAbi = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "account", type: "address" },
      { indexed: false, internalType: "int256", name: "delta", type: "int256" },
      { indexed: false, internalType: "int256", name: "deltaRoots", type: "int256" },
    ],
    name: "StalkBalanceChanged",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "account", type: "address" },
      { indexed: true, internalType: "address", name: "token", type: "address" },
      { indexed: false, internalType: "int96", name: "stem", type: "int96" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "bdv", type: "uint256" },
    ],
    name: "AddDeposit",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "account", type: "address" },
      { indexed: false, internalType: "int256", name: "delta", type: "int256" },
    ],
    name: "SeedsBalanceChanged",
    type: "event",
  }
];


describe('Silo V3: Stem deployment migrate everyone', function () {
    before(async function () {

      try {
        await network.provider.request({
          method: "hardhat_reset",
          params: [
            {
              forking: {
                jsonRpcUrl: process.env.FORKING_RPC,
                blockNumber: BLOCK_NUMBER
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
    });
  
    beforeEach(async function () {
      snapshotId = await takeSnapshot();
    });
  
    afterEach(async function () {
      await revertToSnapshot(snapshotId);
    });

    async function getDepositsForAccount(account, onChainBdv = false) {
        const END_BLOCK = BLOCK_NUMBER;
        // const END_BLOCK = 'latest'
        
        //couldn't quickly figure out how to just use the hardhat network provider?
        const provider = new ethers.providers.JsonRpcProvider(process.env.FORKING_RPC);

        const contract = new ethers.Contract(BEANSTALK, beanstalkABI, provider);
    
        const oldAddDepositAbi = [
            {
                anonymous: false,
                inputs: [
                { indexed: true, internalType: "address", name: "account", type: "address" },
                { indexed: true, internalType: "address", name: "token", type: "address" },
                { indexed: false, internalType: "uint32", name: "season", type: "uint32" },
                { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
                { indexed: false, internalType: "uint256", name: "bdv", type: "uint256" },
                ],
                name: "AddDeposit",
                type: "event",
            },
        ];
        
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

        const oldRemoveDepositsAbi = [
            {
                anonymous: false,
                inputs: [
                { indexed: true, internalType: "address", name: "account", type: "address" },
                { indexed: true, internalType: "address", name: "token", type: "address" },
                { indexed: false, internalType: "uint32[]", name: "seasons", type: "uint32[]" },
                { indexed: false, internalType: "uint256[]", name: "amounts", type: "uint256[]" },
                { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
                ],
                name: "RemoveDeposits",
                type: "event",
            },
        ];

        const addDepositInterface = new ethers.utils.Interface(oldAddDepositAbi);
        const removeDepositInterface = new ethers.utils.Interface(oldRemoveDepositAbi);
        const removeDepositsInterface = new ethers.utils.Interface(oldRemoveDepositsAbi);
          
        const queryEvents = async (oldEventSignature, account, interface) => {
            const oldEventTopic = ethers.utils.id(oldEventSignature);
            // Create the filter object
            const oldFilter = {
                fromBlock: 0,
                toBlock: END_BLOCK,
                address: contract.address,
                topics: [oldEventTopic, ethers.utils.hexZeroPad(account, 32)],
            };

            // Query the old events
            const oldEvents = await contract.provider.getLogs(oldFilter, 0, END_BLOCK);
            
            const updatedEvents = oldEvents.map((eventLog) => {
                let parsedLog;

                parsedLog = interface.parseLog(eventLog);
              
                if (parsedLog) {
                    const { args } = parsedLog;
                    eventLog = { ...eventLog, ...args };
                    const eventName = oldEventSignature.split('(')[0];
                    eventLog['event'] = eventName;
                }
                return eventLog;
              });

            return updatedEvents;
        };

        let lpEvent = await Promise.all([
            queryEvents("AddDeposit(address,address,uint32,uint256,uint256)", account, addDepositInterface),
            queryEvents("RemoveDeposits(address,address,uint32[],uint256[],uint256)", account, removeDepositsInterface),
            queryEvents("RemoveDeposit(address,address,uint32,uint256)", account, removeDepositInterface),
        ]);

        lpEvent = (await lpEvent).flat()


        lpEvent = lpEvent.sort((a,b) => {
            if (a.blockNumber == b.blockNumber) return a.logIndex - b.logIndex
            return a.blockNumber - b.blockNumber
        })

        console.log('-----------------------------')
        console.log('stalk balance checking: ', account)
        console.log(`Found: ${lpEvent.length} events`)

        //////////////////////////////////////////////////////////////
        
        let deposits = {}

        for (let i = 0; i < lpEvent.length; i++) {
            let d = lpEvent[i]
        
            let token = d.token
            let season = d.season

            if (!deposits[token]) deposits[token] = {}
            if (d.event == 'AddDeposit') {
                if (!deposits[token][season]) deposits[token][season] = {
                    amount: toBN('0'),
                    bdv: toBN('0'),
                }
                deposits[token][season].amount = deposits[token][season].amount.add(toBN(d.amount))
                deposits[token][season].bdv = deposits[token][season].bdv.add(toBN((d.bdv)))
                if (onChainBdv) {
                    let expectedBdv = await getDepositBdv(account, token, season, d.blockNumber)
                    deposits[token][season].bdv = expectedBdv
                }
                if (deposits[token][season].amount.eq(toBN('0'))) delete deposits[token][season]
            } else if (d.event == 'RemoveDeposit') {
                let season = d.season
                let amount = toBN(d.amount)
                let bdv = amount.mul(deposits[token][season].bdv).div(deposits[token][season].amount)
                deposits[token][season].amount = deposits[token][season].amount.sub(amount)
                deposits[token][season].bdv =  deposits[token][season].bdv.sub(bdv)
                if (onChainBdv) {
                    let expectedBdv = await getDepositBdv(account, token, season, d.blockNumber)
                    console.log("BDV:", `${deposits[token][season].bdv.sub(bdv)}`, `${expectedBdv}`)
                    deposits[token][season].bdv = expectedBdv
                }
                if (deposits[token][season].amount.eq(toBN('0'))) delete deposits[token][season]
            } else if (d.event == 'RemoveDeposits') {
                let seasons = d.seasons
                let amounts = d.amounts
                for (let i = 0; i < seasons.length; i++) {
                    let amount = toBN(amounts[i])
                    if (`${amount}` !== '0') {
                        let bdv = amount.mul(deposits[token][seasons[i]].bdv).div(deposits[token][seasons[i]].amount)
                        deposits[token][seasons[i]].amount = deposits[token][seasons[i]].amount.sub(amount)
                        deposits[token][seasons[i]].bdv = deposits[token][seasons[i]].bdv.sub(bdv)
                        if (onChainBdv) {
                            let expectedBdv = await getDepositBdv(account, token, season, d.blockNumber)
                            console.log("BDV:", `${deposits[token][season].bdv.sub(bdv)}`, `${expectedBdv}`)
                            deposits[token][season].bdv = expectedBdv
                        }
                        if (deposits[token][seasons[i]].amount.eq(toBN('0'))) delete deposits[token][seasons[i]]
                    }
                }
            }

            if (Object.keys(deposits[token]) == 0) delete deposits[token]
            lastBlock = d.blockNumber
        }
        return [deposits]
    }

    async function getStalkBalanceChangedForAccount(account) {
      const END_BLOCK = BLOCK_NUMBER;
      const provider = new ethers.providers.JsonRpcProvider(process.env.FORKING_RPC);
      const contract = new ethers.Contract(BEANSTALK, beanstalkABI, provider);
      const eventsInterface = new ethers.utils.Interface(eventsAbi);
      const queryEvents = async (eventSignature, account, interface) => {
          const eventTopic = ethers.utils.id(eventSignature);
          // Create the filter object
          const filter = {
              fromBlock: 0,
              toBlock: END_BLOCK,
              address: contract.address,
              topics: [eventTopic, ethers.utils.hexZeroPad(account, 32)],
          };
          const events = await contract.provider.getLogs(filter, 0, END_BLOCK);
          const updatedEvents = events.map((eventLog) => {
              let parsedLog;
              parsedLog = interface.parseLog(eventLog);
              if (parsedLog) {
                  const { args } = parsedLog;
                  eventLog = { ...eventLog, ...args };
                  const eventName = eventSignature.split('(')[0];
                  eventLog['event'] = eventName;
              }
              return eventLog;
            });
          return updatedEvents;
      };
      let stalkBalanceChangedEvents = await Promise.all([
          queryEvents("StalkBalanceChanged(address,int256,int256)", account, eventsInterface),
      ]);
      stalkBalanceChangedEvents = (await stalkBalanceChangedEvents).flat()
      stalkBalanceChangedEvents = stalkBalanceChangedEvents.sort((a,b) => {
          if (a.blockNumber == b.blockNumber) return a.logIndex - b.logIndex
          return a.blockNumber - b.blockNumber
      })

      console.log('-----------------------------')
      console.log('checking: ', account)
      console.log(`Found: ${stalkBalanceChangedEvents.length} events`)

      let changed = [];
      for (let i = 0; i < stalkBalanceChangedEvents.length; i++) {
          let d = stalkBalanceChangedEvents[i]
          if (d.event == 'StalkBalanceChanged') {
            changed.push(d.delta);
          }
          lastBlock = d.blockNumber
      }
      return changed;
  }

  async function getSeedBalanceChangedForAccount(account) {
    const END_BLOCK = BLOCK_NUMBER;
    const provider = new ethers.providers.JsonRpcProvider(process.env.FORKING_RPC);
    const contract = new ethers.Contract(BEANSTALK, beanstalkABI, provider);
    const eventsInterface = new ethers.utils.Interface(eventsAbi);
    const queryEvents = async (eventSignature, account, interface) => {
        const eventTopic = ethers.utils.id(eventSignature);
        // Create the filter object
        const filter = {
            fromBlock: 0,
            toBlock: END_BLOCK,
            address: contract.address,
            topics: [eventTopic, ethers.utils.hexZeroPad(account, 32)],
        };
        const events = await contract.provider.getLogs(filter, 0, END_BLOCK);
        const updatedEvents = events.map((eventLog) => {
            let parsedLog;
            parsedLog = interface.parseLog(eventLog);
            if (parsedLog) {
                const { args } = parsedLog;
                eventLog = { ...eventLog, ...args };
                const eventName = eventSignature.split('(')[0];
                eventLog['event'] = eventName;
            }
            return eventLog;
          });
        return updatedEvents;
    };
    let seedChangedEvents = await Promise.all([
        queryEvents("SeedsBalanceChanged(address,int256)", account, eventsInterface),
    ]);
    seedChangedEvents = (await seedChangedEvents).flat()
    seedChangedEvents = seedChangedEvents.sort((a,b) => {
        if (a.blockNumber == b.blockNumber) return a.logIndex - b.logIndex
        return a.blockNumber - b.blockNumber
    })

    console.log('-----------------------------')
    console.log('seed balance checking: ', account)
    console.log(`Found: ${seedChangedEvents.length} events`)

    let changed = [];
    for (let i = 0; i < seedChangedEvents.length; i++) {
        let d = seedChangedEvents[i]
        if (d.event == 'SeedsBalanceChanged') {
          changed.push(d.delta);
        }
        lastBlock = d.blockNumber
    }
    return changed;
}

    function reformatData(data) {
        const result = {};
      
        for (const siloAddress in data) {
          const tokenAddresses = [];
          const seasonsArray = [];
          const amountsArray = [];
      
          for (const tokenData of data[siloAddress]) {
            for (const tokenAddress in tokenData) {
              const seasons = [];
              const amounts = [];
      
              for (const season in tokenData[tokenAddress]) {
                seasons.push(toBN(season));
                // amounts.push(parseInt(tokenData[tokenAddress][season].amount.hex, 16));
                amounts.push(ethers.BigNumber.from(tokenData[tokenAddress][season].amount.hex));
              }
      
              if (seasons.length > 0 && amounts.length > 0) {
                tokenAddresses.push(tokenAddress);
                seasonsArray.push(seasons);
                amountsArray.push(amounts);
              }
            }
          }
      
          if (tokenAddresses.length > 0 && seasonsArray.length > 0 && amountsArray.length > 0) {
            result[siloAddress] = {
              tokenAddresses,
              seasonsArray,
              amountsArray,
            };
          }
        }
      
        return result;
      }
  
    //get deposits for a sample big depositor, verify they can migrate their deposits correctly
    describe('properly migrates deposits', function () {
      it('for all depositors', async function () {

        //check to see if /data/deposits.json exists
        //this is done just to make repeat testing faster, delete the file to re-fetch all deposits
        if (!fs.existsSync(__dirname + '/data/deposits.json')) {
            let accounts = JSON.parse(await fs.readFileSync(__dirname + '/data/farmers.json')); //where did this file come from?
            let deposits = {};
    
            //loop through accounts and get deposits
            for (let i = 0; i < accounts.length; i++) {
                let account = accounts[i];
                deposits[account] = await getDepositsForAccount(account);
            }
            //write deposits to disk
            await fs.writeFileSync(__dirname + '/data/deposits.json', JSON.stringify(deposits, null, 4))
        }

        if (!fs.existsSync(__dirname + '/data/stalk_balance_changed.json')) {
          let accounts = JSON.parse(await fs.readFileSync(__dirname + '/data/farmers.json'));
          let stalkChanges = {};
  
          //loop through accounts and get stalk_balance_changed events
          for (let i = 0; i < accounts.length; i++) {
              let account = accounts[i];
              stalkChanges[account] = await getStalkBalanceChangedForAccount(account);
          }
          //write stalk_balance_changed to disk
          await fs.writeFileSync(__dirname + '/data/stalk_balance_changed.json', JSON.stringify(stalkChanges, null, 4))
        }

        if (!fs.existsSync(__dirname + '/data/seed_balance_changed.json')) {
          let accounts = JSON.parse(await fs.readFileSync(__dirname + '/data/farmers.json'));
          let seedChanges = {};
  
          //loop through accounts and get seed_balance_changed events
          for (let i = 0; i < accounts.length; i++) {
              let account = accounts[i];
              seedChanges[account] = await getSeedBalanceChangedForAccount(account);
          }
          //write stalk_balance_changed to disk
          await fs.writeFileSync(__dirname + '/data/seed_balance_changed.json', JSON.stringify(seedChanges, null, 4))
        }

        //load deposits from disk
        let deposits = JSON.parse(await fs.readFileSync(__dirname + '/data/deposits.json'));
        deposits = reformatData(deposits);

        //load seed/stalk diff from disk
        let seedStalkDiff = JSON.parse(await fs.readFileSync(__dirname + '/../scripts/silov3-merkle/data/seed-stalk-merkle.json'));

        //load stalk balance changed from disk
        let stalkChanges = JSON.parse(await fs.readFileSync(__dirname + '/data/stalk_balance_changed.json'));
        console.log('stalkChanges: ', stalkChanges);

        //load seed balance changed from disk
        let seedChanges = JSON.parse(await fs.readFileSync(__dirname + '/data/seed_balance_changed.json'));

        //eth addresses here have the checksum casing, need just lowercase
        //to match up with the stored data
        for (const key in seedStalkDiff) {
          seedStalkDiff[key.toLowerCase()] = seedStalkDiff[key];
        }

        const eventsInterface = new ethers.utils.Interface(eventsAbi);

        var progress = 0;
        for (const depositorAddress in deposits) {
            console.log('progress:', progress, 'depositorAddress: ', depositorAddress);

            const tokens = deposits[depositorAddress]['tokenAddresses'];
            const seasons = deposits[depositorAddress]['seasonsArray'];
            const amounts = deposits[depositorAddress]['amountsArray'];

            let stalkDiff = 0;
            let seedsDiff = 0;
            let proof = [];

            if (seedStalkDiff[depositorAddress]) {
              stalkDiff = seedStalkDiff[depositorAddress]['stalk'];
              seedsDiff = seedStalkDiff[depositorAddress]['seeds'];
              proof = seedStalkDiff[depositorAddress]['proof'];
            }

            const depositorSigner = await impersonateSigner(depositorAddress);
            mintEth(depositorAddress);
            await this.silo.connect(depositorSigner);
        
            const migrateResult = await this.migrate.mowAndMigrate(depositorAddress, tokens, seasons, amounts, stalkDiff, seedsDiff, proof);
            const receipt = await migrateResult.wait();

            
            const migratedDeposits = []; //stores AddDeposit events emitted by migrate
            let migrateStalkBalanceChanged = BigNumber.from(0); //stores stalk balance changes from migrate
            let migrateSeedBalanceChanged = BigNumber.from(0); //stores seed balance changes from migrate

            for (const log of receipt.logs) {
              try {
                const parsedEvent = eventsInterface.parseLog(log);
                if (parsedEvent.name === "StalkBalanceChanged") {
                  migrateStalkBalanceChanged = migrateStalkBalanceChanged.add(parsedEvent.args.delta);
                }
                if (parsedEvent.name === "AddDeposit") {
                  migratedDeposits.push(parsedEvent.args);
                }
                if (parsedEvent.name === "SeedsBalanceChanged") {
                  migrateSeedBalanceChanged = migrateSeedBalanceChanged.add(parsedEvent.args.delta);
                }
              } catch (error) {}
            }
            
            //one way to verify the stalk balance change event is correct is to remove all deposits,
            //verify the on-chain stalk function returns 0, and then add up all the stalk balance changed
            //events and verify those add up to zero as well

            //add up all the stalk balance changes from pre-migration
            let stalkBalanceChangedSum = BigNumber.from(0);
            if (stalkChanges[depositorAddress]) {
              for (let i = 0; i < stalkChanges[depositorAddress].length; i++) {
                stalkBalanceChangedSum = stalkBalanceChangedSum.add(stalkChanges[depositorAddress][i]);
              }
            }

            //add up all the seed balance changes from pre-migration
            let seedBalanceChangedSum = BigNumber.from(0);
            if (seedChanges[depositorAddress]) {
              for (let i = 0; i < seedChanges[depositorAddress].length; i++) {
                seedBalanceChangedSum = seedBalanceChangedSum.add(seedChanges[depositorAddress][i]);
              }
            }

            //add up all the StalkBalanceChanged events emitted from migrateResult
            let stalkDeltaSum = ethers.BigNumber.from(0);
            let seedDeltaSum = ethers.BigNumber.from(0);

            for (let k = 0; k < migratedDeposits.length; k++) {
              const migratedDeposit = migratedDeposits[k];
              const withdraw = await this.silo.connect(depositorSigner).withdrawDeposit(migratedDeposit.token, migratedDeposit.stem, migratedDeposit.amount, EXTERNAL);
              const receipt = await withdraw.wait();

              for (const log of receipt.logs) {
                try {
                  const parsedLog = eventsInterface.parseLog(log);
                  if (parsedLog.name === "StalkBalanceChanged") {
                    stalkDeltaSum = stalkDeltaSum.add(parsedLog.args.delta);
                  }
                  if (parsedLog.name === "SeedsBalanceChanged") {
                    seedDeltaSum = seedDeltaSum.add(parsedLog.args.delta);
                  }
                } catch (error) {}
              }
            }

            const finalStalkSum = stalkDeltaSum.add(stalkBalanceChangedSum).add(migrateStalkBalanceChanged);
            expect(finalStalkSum).to.equal('0');

            const finalSeedSum = seedDeltaSum.add(seedBalanceChangedSum).add(migrateSeedBalanceChanged);
            expect(finalSeedSum).to.equal('0');
            
            progress++;
        }
      });
    });
});