const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { to18, to6, toStalk } = require('./utils/helpers.js')
const { impersonateBeanstalkOwner, impersonateSigner } = require('../utils/signer.js')
const { mintEth } = require('../utils/mint.js')
const { BEAN, BEANSTALK, BCM, BEAN_3_CURVE, UNRIPE_BEAN, UNRIPE_LP, THREE_CURVE } = require('./utils/constants')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { upgradeWithNewFacets } = require("../scripts/diamond");
const { time, mineUpTo, mine } = require("@nomicfoundation/hardhat-network-helpers");
const { ConvertEncoder } = require('./utils/encoder.js');
const { BigNumber } = require('ethers');
require('dotenv').config();

let user,user2,owner;
let userAddress, ownerAddress, user2Address;


describe('Silo V3: Grown Stalk Per Bdv deployment', function () {
    before(async function () {
      try {
        await network.provider.request({
          method: "hardhat_reset",
          params: [
            {
              forking: {
                jsonRpcUrl: process.env.FORKING_RPC,
                blockNumber: 16664100 //a random semi-recent block close to Grown Stalk Per Bdv pre-deployment
              },
            },
          ],
        });
      } catch(error) {
        console.log('forking error in Silo V3: Grown Stalk Per Bdv:');
        console.log(error);
        return
      }
  
      const signer = await impersonateBeanstalkOwner()
      await mintEth(signer.address);
      await upgradeWithNewFacets({
        diamondAddress: BEANSTALK,
        facetNames: ['EnrootFacet', 'ConvertFacet', 'WhitelistFacet', 'MockSiloFacet', 'MockSeasonFacet', 'MigrationFacet'],
        initFacetName: 'InitBipNewSilo',
        bip: false,
        object: false,
        verbose: false,
        account: signer
      });
  
      [owner,user,user2] = await ethers.getSigners();
      userAddress = user.address;
      user2Address = user2.address;
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
      this.threeCurve = await ethers.getContractAt('MockToken', THREE_CURVE);

    });
  
    beforeEach(async function () {
      snapshotId = await takeSnapshot();
    });
  
    afterEach(async function () {
      await revertToSnapshot(snapshotId);
    });
  
    describe('properly updates the silo info', function () {
      it('for bean', async function () {
        const settings = await this.silo.tokenSettings(this.bean.address);
  
        expect(settings['stalkEarnedPerSeason']).to.eq(2000000);
        expect(settings['stalkIssuedPerBdv']).to.eq(10000);
        expect(settings['milestoneSeason']).to.eq(await this.season.season());
        expect(settings['milestoneStem']).to.eq(0);
      });
      
      it('for curve metapool', async function () {
        const settings = await this.silo.tokenSettings(this.beanMetapool.address);
  
        expect(settings['stalkEarnedPerSeason']).to.eq(4000000);
        expect(settings['stalkIssuedPerBdv']).to.eq(10000);
        expect(settings['milestoneSeason']).to.eq(await this.season.season());
        expect(settings['milestoneStem']).to.eq(0);
      });
  
      it('for unripe bean', async function () {
        const settings = await this.silo.tokenSettings(this.unripeBean.address);
  
        expect(settings['stalkEarnedPerSeason']).to.eq(0);
        expect(settings['stalkIssuedPerBdv']).to.eq(10000);
        expect(settings['milestoneSeason']).to.eq(await this.season.season());
        expect(settings['milestoneStem']).to.eq(0);
      });
  
      it('for unripe LP', async function () {
        const settings = await this.silo.tokenSettings(this.unripeLP.address);
  
        expect(settings['stalkEarnedPerSeason']).to.eq(0);
        expect(settings['stalkIssuedPerBdv']).to.eq(10000);
        expect(settings['milestoneSeason']).to.eq(await this.season.season());
        expect(settings['milestoneStem']).to.eq(0);
      });
    });
  
    describe('stem values for all tokens zero', function () {
      it('for bean', async function () {
        expect(await this.silo.stemTipForToken(this.bean.address)).to.eq(0);
      });
      it('for curve metapool', async function () {
        expect(await this.silo.stemTipForToken(this.beanMetapool.address)).to.eq(0);
      });
      it('for unripe bean', async function () {
        expect(await this.silo.stemTipForToken(this.unripeBean.address)).to.eq(0);
      });
      it('for unripe LP', async function () {
        expect(await this.silo.stemTipForToken(this.unripeLP.address)).to.eq(0);
      });
    });
  
    //get deposits for a sample big depositor, verify they can migrate their deposits correctly
    describe('properly migrates deposits', function () {
      it('for a sample depositor', async function () {
        //get deposit data using a query like this: https://graph.node.bean.money/subgraphs/name/beanstalk/graphql?query=%7B%0A++silos%28orderBy%3A+stalk%2C+orderDirection%3A+desc%2C+first%3A+2%29+%7B%0A++++farmer+%7B%0A++++++id%0A++++++plots+%7B%0A++++++++season%0A++++++++source%0A++++++%7D%0A++++++silo+%7B%0A++++++++id%0A++++++%7D%0A++++++deposits+%7B%0A++++++++season%0A++++++++token%0A++++++%7D%0A++++%7D%0A++++stalk%0A++%7D%0A%7D
  
  
        const depositorAddress = '0x5e68bb3de6133baee55eeb6552704df2ec09a824';
        const tokens = ['0x1bea0050e63e05fbb5d8ba2f10cf5800b6224449', '0x1bea3ccd22f4ebd3d37d731ba31eeca95713716d','0xbea0000029ad1c77d3d5d23ba2d8893db9d1efab'];
        const seasons = [[6074],[6061],[6137]];

        const amounts = [];
        for(let i=0; i<seasons.length; i++) {
          const newSeason = [];
          for(let j=0; j<seasons[i].length; j++) {
            const deposit = await this.migrate.getDepositLegacy(depositorAddress, tokens[i], seasons[i][j]);
            newSeason.push(deposit[0].toString());
          }
          amounts.push(newSeason);
        }
  
        const depositorSigner = await impersonateSigner(depositorAddress);
        await this.silo.connect(depositorSigner);

        const balanceOfStalkBefore = await this.silo.balanceOfStalk(depositorAddress);
        const balanceOfStalkUpUntilStemsDeployment = await this.migrate.balanceOfGrownStalkUpToStemsDeployment(depositorAddress);
    
        //need an array of all the tokens that have been deposited and their corresponding seasons
        await this.migrate.mowAndMigrate(depositorAddress, tokens, seasons, amounts, 0, 0, []);

        //verify balance of stalk after is equal to balance of stalk before plus the stalk earned up until stems deployment
        const balanceOfStalkAfter = await this.silo.balanceOfStalk(depositorAddress);
        expect(balanceOfStalkAfter).to.be.equal(balanceOfStalkBefore.add(balanceOfStalkUpUntilStemsDeployment));
        
        //now mow and it shouldn't revert
        await this.silo.mow(depositorAddress, this.beanMetapool.address)
      });
  
      
      it('for a third sample depositor', async function () {
        const depositorAddress = ethers.utils.getAddress('0xc46c1b39e6c86115620f5297e98859529b92ad14');
        const tokens = [ethers.utils.getAddress('0x1bea0050e63e05fbb5d8ba2f10cf5800b6224449'), ethers.utils.getAddress('0x1bea3ccd22f4ebd3d37d731ba31eeca95713716d')];
  
        const seasons = [
          [
            6008, 6074,
          ],
          [6004, 6008],
        ];

        const amounts = [];
        for(let i=0; i<seasons.length; i++) {
          const newSeason = [];
          for(let j=0; j<seasons[i].length; j++) {
            const deposit = await this.migrate.getDepositLegacy(depositorAddress, tokens[i], seasons[i][j]);
            newSeason.push(deposit[0].toString());
          }
          amounts.push(newSeason);
        }

        const depositorSigner = await impersonateSigner(depositorAddress);
        await this.silo.connect(depositorSigner);
    
        this.migrateResult = await this.migrate.mowAndMigrate(depositorAddress, tokens, seasons, amounts, 0, 0, []);

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

        const oldRemoveDepositInterface = new ethers.utils.Interface(oldRemoveDepositAbi);
        const customMigrate = new ethers.Contract(this.migrate.address, oldRemoveDepositInterface, this.migrate.signer);
        
        //check for emitting Legacy RemoveDeposit events
        await expect(this.migrateResult).to.emit(customMigrate, 'RemoveDeposit').withArgs(depositorAddress, tokens[0], seasons[0][0], amounts[0][0]);
        await expect(this.migrateResult).to.emit(customMigrate, 'RemoveDeposit').withArgs(depositorAddress, tokens[0], seasons[0][1], amounts[0][1]);
        await expect(this.migrateResult).to.emit(customMigrate, 'RemoveDeposit').withArgs(depositorAddress, tokens[1], seasons[1][0], amounts[1][0]);
        await expect(this.migrateResult).to.emit(customMigrate, 'RemoveDeposit').withArgs(depositorAddress, tokens[1], seasons[1][1], amounts[1][1]);
  
        await this.silo.mow(depositorAddress, this.beanMetapool.address)
      });

      it('for a depositor with a lot of deposits', async function () {
        const depositorAddress = '0x77700005bea4de0a78b956517f099260c2ca9a26';
        const tokens = ['0xbea0000029ad1c77d3d5d23ba2d8893db9d1efab'];
  
        const seasons = [
          [
            5342, 5735, 5948, 6083, 6087, 6092, 6093, 6097, 6098, 6100, 6101,
            6103, 6106, 6108, 6109, 6110, 6122, 6131, 6147, 6163, 6172, 6178,
            6183, 6198, 6199, 6213, 6219, 6228, 6248, 6263, 6266, 6269, 6271,
            6272, 6275, 6298, 6338, 6339, 6340, 6358, 6411, 6435, 6441, 6454,
            6500, 6519, 6538, 6562, 6565, 6575, 6590, 6601, 6654, 6706, 6724,
            6735, 6754, 6767, 6799, 6805, 6816, 6819, 6823, 6879, 6913, 6916,
            6958, 7006, 7012, 7046, 7059, 7091, 7110, 7116, 7133, 7152, 7202,
            7295, 7310, 7452, 7562, 7563, 7582, 7664, 7690, 7754, 7793, 7805,
            7814, 7848, 7884, 7920, 7922, 7960, 7983, 7993, 7999, 8003, 8006,
            8010, 8014, 8020, 8021, 8024, 8041, 8055, 8073, 8074, 8075, 8092,
            8100, 8111, 8115, 8121, 8135, 8137, 8148, 8157, 8159, 8162, 8170,
            8173, 8176, 8183, 8193, 8198, 8205, 8209, 8216, 8230, 8231, 8234,
            8235, 8237, 8248, 8258, 8259, 8265, 8285, 8288, 8290, 8295, 8296,
            8301, 8305, 8309, 8314, 8316, 8325, 8351, 8384, 8387, 8388, 8416,
            8429, 8432, 8435, 8439, 8448, 8451, 8452, 8457, 8458, 8473, 8477,
            8484, 8486, 8487, 8491, 8507, 8518, 8522, 8524, 8525, 8526, 8527,
            8528, 8529, 8530, 8532, 8535, 8541, 8542, 8544, 8550, 8552, 8553,
            8554, 8559, 8560, 8575, 8576, 8577, 8578, 8579, 8581, 8582, 8591,
            8593, 8594,
          ],
        ];

        const amounts = [];
        for(let i=0; i<seasons.length; i++) {
          const newSeason = [];
          for(let j=0; j<seasons[i].length; j++) {
            const deposit = await this.migrate.getDepositLegacy(depositorAddress, tokens[i], seasons[i][j]);
            newSeason.push(deposit[0].toString());
          }
          amounts.push(newSeason);
        }

        const depositorSigner = await impersonateSigner(depositorAddress);
        await mintEth(depositorAddress);
        await this.migrate.connect(depositorSigner).mowAndMigrate(depositorAddress, tokens, seasons, amounts, 0, 0, []);
        await this.silo.mow(depositorAddress, this.beanMetapool.address)
      });

      //verify that after migration, stalk is properly calculated
      describe('verify stalk amounts after migration for a whale', function () {
        beforeEach(async function () {
            this.depositorAddress = '0x5e68bb3de6133baee55eeb6552704df2ec09a824';
            const tokens = ['0x1bea0050e63e05fbb5d8ba2f10cf5800b6224449', '0x1bea3ccd22f4ebd3d37d731ba31eeca95713716d','0xbea0000029ad1c77d3d5d23ba2d8893db9d1efab'];
            const seasons = [[6074],[6061],[6137]];

            const amounts = [];
            for(let i=0; i<seasons.length; i++) {
              const newSeason = [];
              for(let j=0; j<seasons[i].length; j++) {
                const deposit = await this.migrate.getDepositLegacy(this.depositorAddress, tokens[i], seasons[i][j]);
                newSeason.push(deposit[0].toString());
              }
              amounts.push(newSeason);
            }
    

            const depositorSigner = await impersonateSigner(this.depositorAddress);
            await this.silo.connect(depositorSigner);

            this.stalkBeforeUser = await this.silo.balanceOfStalk(this.depositorAddress);
            this.stalkBeforeTotal = await this.silo.totalStalk();

            this.balanceOfStalkUpUntilStemsDeployment = await this.migrate.balanceOfGrownStalkUpToStemsDeployment(this.depositorAddress);
        
            //need an array of all the tokens that have been deposited and their corresponding seasons
            await this.migrate.mowAndMigrate(this.depositorAddress, tokens, seasons, amounts, 0, 0, []);
        });

        it('properly migrates the user balances', async function () {
          expect(await this.silo.balanceOfStalk(this.depositorAddress)).to.eq(this.stalkBeforeUser.add(this.balanceOfStalkUpUntilStemsDeployment));
        });
      
        it('properly migrates the total balances', async function () {
          expect(await this.silo.totalStalk()).to.eq(this.stalkBeforeTotal.add(this.balanceOfStalkUpUntilStemsDeployment));
        });
      });
  
      it('fails to migrate for incorrect season input', async function () {
        
        const depositorAddress = '0x5e68bb3de6133baee55eeb6552704df2ec09a824';
        const tokens = ['0x1bea0050e63e05fbb5d8ba2f10cf5800b6224449', '0x1bea3ccd22f4ebd3d37d731ba31eeca95713716d'];
        const seasons = [[6074],[6061],];

        const amounts = [];
        for(let i=0; i<seasons.length; i++) {
          const newSeason = [];
          for(let j=0; j<seasons[i].length; j++) {
            const deposit = await this.migrate.getDepositLegacy(depositorAddress, tokens[i], seasons[i][j]);
            newSeason.push(deposit[0].toString());
          }
          amounts.push(newSeason);
        }
    
        //need an array of all the tokens that have been deposited and their corresponding seasons
        await expect(this.migrate.mowAndMigrate(depositorAddress, tokens, seasons, seasons, 0, 0, [])).to.be.revertedWith('seeds misalignment, double check submitted deposits');
        await expect(this.silo.mow(depositorAddress, this.beanMetapool.address)).to.be.revertedWith('Silo: Migration needed');
      })
    });

    describe("properly calculates stalk on migration if you migrate later", function () {
      it("for a sample depositor", async function () {
        const depositorAddress = "0x5e68bb3de6133baee55eeb6552704df2ec09a824";
        const tokens = [
          "0x1bea0050e63e05fbb5d8ba2f10cf5800b6224449",
          "0x1bea3ccd22f4ebd3d37d731ba31eeca95713716d",
          "0xbea0000029ad1c77d3d5d23ba2d8893db9d1efab"
        ];
        const seasons = [[6074], [6061], [6137]];

        const amounts = [];
        for (let i = 0; i < seasons.length; i++) {
          const newSeason = [];
          for (let j = 0; j < seasons[i].length; j++) {
            const deposit = await this.migrate.getDepositLegacy(depositorAddress, tokens[i], seasons[i][j]);
            newSeason.push(deposit[0].toString());
          }
          amounts.push(newSeason);
        }

        const depositorSigner = await impersonateSigner(depositorAddress);
        await this.silo.connect(depositorSigner);

        const seasonsJump = 1000000; //if you change this number to any other positive number, test should still pass

        await this.season.fastForward(seasonsJump);

        const balanceOfStalkBefore = await this.silo.balanceOfStalk(depositorAddress);
        const balanceOfStalkUpUntilStemsDeployment = await this.migrate.balanceOfGrownStalkUpToStemsDeployment(depositorAddress);

        //get balance of grown stalk for each token and add them up
        var totalBalanceOfGrownStalk = ethers.BigNumber.from(0);
        for (let i = 0; i < tokens.length; i++) {
          const stemTip = await this.silo.stemTipForToken(tokens[i]);
          const [amount, bdv] = await this.migrate.getDepositLegacy(depositorAddress, tokens[i], seasons[i][0]);
          const amountOfGrownStalkPerToken = stemTip.mul(bdv);
          totalBalanceOfGrownStalk = totalBalanceOfGrownStalk.add(amountOfGrownStalkPerToken);
        }

        await this.migrate.mowAndMigrate(depositorAddress, tokens, seasons, amounts, 0, 0, []);

        //verify balance of stalk after is equal to balance of stalk before plus the stalk earned up until stems deployment
        const balanceOfStalkAfter = await this.silo.balanceOfStalk(depositorAddress);

        const calculatedTotalAfter = balanceOfStalkBefore.add(balanceOfStalkUpUntilStemsDeployment).add(totalBalanceOfGrownStalk);

        //verify that the stalk amount for this user is equal to the grown stalk they should have earned up until stems deployment,
        //plus the grown stalk they should have earned after stems deployment
        expect(balanceOfStalkAfter).to.be.equal(calculatedTotalAfter);

        //now mow and it shouldn't revert
        await this.silo.mow(depositorAddress, this.beanMetapool.address);
      });
    });
  
    describe('reverts if you try to mow before migrating', function () {
      it('for a sample whale', async function () {
        
        const depositorAddress = '0x10bf1dcb5ab7860bab1c3320163c6dddf8dcc0e4';
        const depositorSigner = await impersonateSigner(depositorAddress);
        await this.silo.connect(depositorSigner);
        //need an array of all the tokens that have been deposited and their corresponding seasons
        await expect(this.silo.mow(depositorAddress, this.beanMetapool.address)).to.be.revertedWith('Silo: Migration needed');
      });
    });
  
    describe('update grown stalk per bdv per season rate', function () {
      it('change rate a few times and check stemTipForToken', async function () {
        this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond);
        const beanstalkOwner = await impersonateBeanstalkOwner()
        await this.season.teleportSunrise(await this.silo.stemStartSeason());
  
        expect(await this.silo.stemTipForToken(this.beanMetapool.address)).to.eq(0);
  
        //change rate to 5 and check after 1 season
        await this.whitelist.connect(beanstalkOwner).updateStalkPerBdvPerSeasonForToken(this.beanMetapool.address, 5*1e6);
        await this.season.siloSunrise(0);
        expect(await this.silo.stemTipForToken(this.beanMetapool.address)).to.eq(5);
  
        //change rate to 1 and check after 5 seasons
        await this.whitelist.connect(beanstalkOwner).updateStalkPerBdvPerSeasonForToken(this.beanMetapool.address, 1*1e6);
        await this.season.fastForward(5);
        expect(await this.silo.stemTipForToken(this.beanMetapool.address)).to.eq(10);
      });
    });

    describe('fractional seeds', function () {
      it('change rate to something fractional and check stemTipForToken', async function () {
        this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond);
        const beanstalkOwner = await impersonateBeanstalkOwner()
        await this.season.teleportSunrise(await this.silo.stemStartSeason());
  
        expect(await this.silo.stemTipForToken(this.beanMetapool.address)).to.eq(0);
  
        //change rate to 2.5 and check after 1 season
        await this.whitelist.connect(beanstalkOwner).updateStalkPerBdvPerSeasonForToken(this.beanMetapool.address, 2.5*1e6);
        await this.season.siloSunrise(0);
        expect(await this.silo.stemTipForToken(this.beanMetapool.address)).to.eq(2);
        //in theory should be 2.5 after one season but because of rounding is 2

        //change rate to 3.5 and check after 5 seasons
        await this.whitelist.connect(beanstalkOwner).updateStalkPerBdvPerSeasonForToken(this.beanMetapool.address, 3.5*1e6);
        await this.season.fastForward(5);
        expect(await this.silo.stemTipForToken(this.beanMetapool.address)).to.eq(19); //in theory should equal 20 but because of rounding down twice it's 19
      });

      //write a test that Mows after a fractional seeds season goes by and checks... something?
    });
  
    describe('Silo interaction tests after deploying grown stalk per bdv', function () {
      it('attempt to withdraw before migrating', async function () {
        const depositorAddress = '0x10bf1dcb5ab7860bab1c3320163c6dddf8dcc0e4';
        const depositorSigner = await impersonateSigner(depositorAddress);
        await this.silo.connect(depositorSigner);
        
        const token = '0x1bea0050e63e05fbb5d8ba2f10cf5800b6224449';
  
        const seasons = [
            1964, 2281
        ];
        
        for (let i = 0; i < seasons.length; i++) {
            const season = seasons[i];
            seasons[i] = await this.silo.seasonToStem(token, season);
        }
  
        //single withdraw
        await expect(this.silo.connect(depositorSigner).withdrawDeposit(token, seasons[0], to6('1'), EXTERNAL)).to.be.revertedWith('Silo: Migration needed')
        
        //multi withdraw
        await expect(this.silo.connect(depositorSigner).withdrawDeposits(token, seasons, [to6('1'), to6('1')], EXTERNAL)).to.be.revertedWith('Silo: Migration needed')
      });
  
      //attempt to convert before migrating
      it('attempt to convert LP before migrating', async function () {
        const depositorAddress = '0x5e68bb3de6133baee55eeb6552704df2ec09a824';
        const token = '0x1bea3ccd22f4ebd3d37d731ba31eeca95713716d';
        const stem =  await this.silo.seasonToStem(token, 6061);
        await mintEth(depositorAddress);
        const depositorSigner = await impersonateSigner(depositorAddress);
        await this.silo.connect(depositorSigner);
        await expect(this.convert.connect(depositorSigner).convert(ConvertEncoder.convertCurveLPToBeans(to6('7863'), to6('0'), this.beanMetapool.address), [stem], [to6('7863')])).to.be.revertedWith('Silo: Migration needed')
      });

      // Testing that a single convert type fails before migrating should be sufficient given
      // that the the migration check happens in the shared logic in `convert(...)`.
      // Tests for other convert types are commented out until they are fixed.

      it('attempt to convert bean before migrating', async function () {
        const depositorAddress = '0x10bf1dcb5ab7860bab1c3320163c6dddf8dcc0e4';
        const token = '0xbea0000029ad1c77d3d5d23ba2d8893db9d1efab';
        const stem =  await this.silo.seasonToStem(token, 7563);
        await mintEth(depositorAddress);

        const threecrvHolder = '0xe74b28c2eAe8679e3cCc3a94d5d0dE83CCB84705'
        const threecrvSigner = await impersonateSigner(threecrvHolder);
        await this.threeCurve.connect(threecrvSigner).approve(this.beanMetapool.address, to18('100000000000'));
        await this.beanMetapool.connect(threecrvSigner).add_liquidity([to6('0'), to18('10000000')], to18('150'));
        const depositorSigner = await impersonateSigner(depositorAddress);
        await this.silo.connect(depositorSigner);
        await expect(this.convert.connect(depositorSigner).convert(ConvertEncoder.convertBeansToCurveLP(to6('345000'), to6('340000'), this.beanMetapool.address), [stem], [to6('345000')])).to.be.revertedWith('Silo: Migration needed')
      });

      it('attempt to convert unripe LP before migrating', async function () {
        const depositorAddress = '0x5e68bb3de6133baee55eeb6552704df2ec09a824';
        const token = '0x1bea3ccd22f4ebd3d37d731ba31eeca95713716d';
        const stem =  await this.silo.seasonToStem(token, 6061);
        await mintEth(depositorAddress);

        const depositorSigner = await impersonateSigner(depositorAddress);
        await this.silo.connect(depositorSigner);

        await expect(
          this.convert.connect(depositorSigner).convert(
            ConvertEncoder.convertUnripeLPToBeans(to6('7863'), to6('7500')), [stem], [to6('7863')]))
            .to.be.revertedWith('Silo: Migration needed')
      });

      it('attempt to convert unripe bean before migrating', async function () {
        const urBean = '0x1bea0050e63e05fbb5d8ba2f10cf5800b6224449';
        const stem =  await this.silo.seasonToStem(urBean, 6074);
        const depositorAddress = '0x10bf1dcb5ab7860bab1c3320163c6dddf8dcc0e4';
        await mintEth(depositorAddress);
        const depositorSigner = await impersonateSigner(depositorAddress);
        
        const threecrvHolder = '0xe74b28c2eAe8679e3cCc3a94d5d0dE83CCB84705'
        const threecrvSigner = await impersonateSigner(threecrvHolder);
        await this.threeCurve.connect(threecrvSigner).approve(this.beanMetapool.address, to18('100000000000'));
        await this.beanMetapool.connect(threecrvSigner).add_liquidity([to6('0'), to18('10000000')], to18('150'));
        await expect(this.convert.connect(depositorSigner).convert(ConvertEncoder.convertUnripeBeansToLP(to6('345000'), to6('340000')), [stem], [to6('345000')])).to.be.revertedWith('Silo: Migration needed')
      });
    });
  });