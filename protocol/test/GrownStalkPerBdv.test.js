const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { to18, to6, toStalk } = require('./utils/helpers.js')
const { impersonateBeanstalkOwner, impersonateSigner } = require('../utils/signer.js')
const { mintEth } = require('../utils/mint.js')
const { BEAN, BEANSTALK, BCM, BEAN_3_CURVE, UNRIPE_BEAN, UNRIPE_LP } = require('./utils/constants')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { upgradeWithNewFacets } = require("../scripts/diamond");
const { time, mineUpTo, mine } = require("@nomicfoundation/hardhat-network-helpers");
const { ConvertEncoder } = require('./utils/encoder.js')

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
        facetNames: ['ConvertFacet', 'WhitelistFacet', 'MockAdminFacet', 'MockSiloFacet', 'MockSeasonFacet'],
        // libraryNames: ['LibLegacyTokenSilo'],
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
  
    describe('properly updates the silo info', function () {
      it('for bean', async function () {
        const settings = await this.silo.tokenSettings(this.bean.address);
  
        expect(settings['stalkEarnedPerSeason']).to.eq(2000000);
        expect(settings['stalkIssuedPerBdv']).to.eq(10000);
        expect(settings['milestoneSeason']).to.eq(await this.season.season());
        expect(settings['milestoneGrownStalkPerBdv']).to.eq(0);
      });
      
      it('for curve metapool', async function () {
        const settings = await this.silo.tokenSettings(this.beanMetapool.address);
  
        expect(settings['stalkEarnedPerSeason']).to.eq(4000000);
        expect(settings['stalkIssuedPerBdv']).to.eq(10000);
        expect(settings['milestoneSeason']).to.eq(await this.season.season());
        expect(settings['milestoneGrownStalkPerBdv']).to.eq(0);
      });
  
      it('for unripe bean', async function () {
        const settings = await this.silo.tokenSettings(this.unripeBean.address);
  
        expect(settings['stalkEarnedPerSeason']).to.eq(2000000);
        expect(settings['stalkIssuedPerBdv']).to.eq(10000);
        expect(settings['milestoneSeason']).to.eq(await this.season.season());
        expect(settings['milestoneGrownStalkPerBdv']).to.eq(0);
      });
  
      it('for unripe LP', async function () {
        const settings = await this.silo.tokenSettings(this.unripeLP.address);
  
        expect(settings['stalkEarnedPerSeason']).to.eq(2000000);
        expect(settings['stalkIssuedPerBdv']).to.eq(10000);
        expect(settings['milestoneSeason']).to.eq(await this.season.season());
        expect(settings['milestoneGrownStalkPerBdv']).to.eq(0);
      });
    });
  
    describe('cumulative grown stalk per bdv values for all tokens zero', function () {
      it('for bean', async function () {
        expect(await this.silo.cumulativeGrownStalkPerBdv(this.bean.address)).to.eq(0);
      });
      it('for curve metapool', async function () {
        expect(await this.silo.cumulativeGrownStalkPerBdv(this.beanMetapool.address)).to.eq(0);
      });
      it('for unripe bean', async function () {
        expect(await this.silo.cumulativeGrownStalkPerBdv(this.unripeBean.address)).to.eq(0);
      });
      it('for unripe LP', async function () {
        expect(await this.silo.cumulativeGrownStalkPerBdv(this.unripeLP.address)).to.eq(0);
      });
      
    });
  
    //get deposits for a sample big depositor, verify they can migrate their deposits correctly
    describe('properly migrates deposits', function () {
      it('for a sample depositor', async function () {
        //get deposit data using a query like this: https://graph.node.bean.money/subgraphs/name/beanstalk/graphql?query=%7B%0A++silos%28orderBy%3A+stalk%2C+orderDirection%3A+desc%2C+first%3A+2%29+%7B%0A++++farmer+%7B%0A++++++id%0A++++++plots+%7B%0A++++++++season%0A++++++++source%0A++++++%7D%0A++++++silo+%7B%0A++++++++id%0A++++++%7D%0A++++++deposits+%7B%0A++++++++season%0A++++++++token%0A++++++%7D%0A++++%7D%0A++++stalk%0A++%7D%0A%7D
  
  
        const depositorAddress = '0x5e68bb3de6133baee55eeb6552704df2ec09a824';
        const tokens = ['0x1bea0050e63e05fbb5d8ba2f10cf5800b6224449', '0x1bea3ccd22f4ebd3d37d731ba31eeca95713716d','0xbea0000029ad1c77d3d5d23ba2d8893db9d1efab'];
        const seasons = [[6074],[6061],[6137]];
  
        const depositorSigner = await impersonateSigner(depositorAddress);
        await this.silo.connect(depositorSigner);
    
        //need an array of all the tokens that have been deposited and their corresponding seasons
        await this.silo.mowAndMigrate(depositorAddress, tokens, seasons);
  
        //now mow and it shouldn't revert
        await this.silo.mow(depositorAddress, this.beanMetapool.address)
      });
  
      it('for a second sample depositor', async function () {
        const depositorAddress = '0x10bf1dcb5ab7860bab1c3320163c6dddf8dcc0e4';
        const tokens = ['0x1bea0050e63e05fbb5d8ba2f10cf5800b6224449', '0x1bea3ccd22f4ebd3d37d731ba31eeca95713716d', '0xbea0000029ad1c77d3d5d23ba2d8893db9d1efab'];
  
        const seasons = [
          [
            1964, 2281, 3615, 4641, 4673, 4820, 5359, 5869, 5988, 5991, 6031,
            6032, 6035, 6074,
          ],
          [2773, 2917, 3019, 4641, 4673, 4820, 5869],
          [6389, 7563],
        ];
  
        const depositorSigner = await impersonateSigner(depositorAddress);
        await this.silo.connect(depositorSigner);
    
        //need an array of all the tokens that have been deposited and their corresponding seasons
        await this.silo.mowAndMigrate(depositorAddress, tokens, seasons);
  
        //now mow and it shouldn't revert
        // await this.silo.mow(depositorAddress, this.beanMetapool.address)
      });
      
      it('for a third sample depositor', async function () {
        const depositorAddress = '0xc46c1b39e6c86115620f5297e98859529b92ad14';
        const tokens = ['0x1bea0050e63e05fbb5d8ba2f10cf5800b6224449', '0x1bea3ccd22f4ebd3d37d731ba31eeca95713716d'];
  
        const seasons = [
          [
            6008, 6074,
          ],
          [6004, 6008],
        ];
  
        const depositorSigner = await impersonateSigner(depositorAddress);
        await this.silo.connect(depositorSigner);
    
  
        //need an array of all the tokens that have been deposited and their corresponding seasons
        await this.silo.mowAndMigrate(depositorAddress, tokens, seasons);
  
        //now mow and it shouldn't revert
        // await this.silo.mow(depositorAddress, this.beanMetapool.address)
      });
  
      it('fails to migrate for 0 BDV crates', async function () {
        const depositorAddress = '0x5e68bb3de6133baee55eeb6552704df2ec09a824';
        const tokens = ['0x1bea0050e63e05fbb5d8ba2f10cf5800b6224449', '0x1bea3ccd22f4ebd3d37d731ba31eeca95713716d','0xbea0000029ad1c77d3d5d23ba2d8893db9d1efab'];
        const seasons = [[5050],[5050],[5050]];
        const depositorSigner = await impersonateSigner(depositorAddress);
        await this.silo.connect(depositorSigner);
    
        // migrate will fail since user has no deposits here (they should use )
        await expect(this.silo.mowAndMigrate(depositorAddress, tokens, seasons)).to.be.revertedWith('SafeMath: division by zero');
  
        await expect(this.silo.mow(depositorAddress, this.beanMetapool.address)).to.be.revertedWith('silo migration needed')
      })
  
      it('fails to migrate for greater seed diff, not the signer', async function () {
        const depositorAddress = '0x297751960dad09c6d38b73538c1cce45457d796d';
        const tokens = ['0x1bea0050e63e05fbb5d8ba2f10cf5800b6224449', '0x1bea3ccd22f4ebd3d37d731ba31eeca95713716d'];
        const seasons = [[5510],[6004,6846,6668]];  
      
        await expect(this.silo.mowAndMigrate(depositorAddress, tokens, seasons)).to.be.revertedWith("deSynced seeds, only account can migrate");
        await expect(this.silo.mow(depositorAddress, this.beanMetapool.address)).to.be.revertedWith('silo migration needed');
      })
  
      it('succeeds to migrate for greater seed diff if its the account being called', async function () {
        const depositorAddress = '0x297751960dad09c6d38b73538c1cce45457d796d';
        const tokens = ['0x1bea0050e63e05fbb5d8ba2f10cf5800b6224449', '0x1bea3ccd22f4ebd3d37d731ba31eeca95713716d'];
        const seasons = [[5510],[6004,6846,6668]];  
        const depositorSigner = await impersonateSigner(depositorAddress);
  
        await user.sendTransaction({
          to: depositorAddress,
          value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
        });
      
        await this.silo.connect(depositorSigner).mowAndMigrate(depositorAddress, tokens, seasons);
        await this.silo.mow(depositorAddress, this.beanMetapool.address);
      })
  
      it('fails to migrate for incorrect season input', async function () {
        const depositorAddress = '0x5e68bb3de6133baee55eeb6552704df2ec09a824';
        const tokens = ['0x1bea0050e63e05fbb5d8ba2f10cf5800b6224449', '0x1bea3ccd22f4ebd3d37d731ba31eeca95713716d','0xbea0000029ad1c77d3d5d23ba2d8893db9d1efab'];
        const seasons = [[1],[1],[1]];
    
        //need an array of all the tokens that have been deposited and their corresponding seasons
        await expect(this.silo.mowAndMigrate(depositorAddress, tokens, seasons)).to.be.revertedWith('SafeMath: division by zero');
        await expect(this.silo.mow(depositorAddress, this.beanMetapool.address)).to.be.revertedWith('silo migration needed');
      })
    });
  
    describe('reverts if you try to mow before migrating', function () {
      it('for a sample whale', async function () {
        
        const depositorAddress = '0x10bf1dcb5ab7860bab1c3320163c6dddf8dcc0e4';
        const depositorSigner = await impersonateSigner(depositorAddress);
        await this.silo.connect(depositorSigner);
        //need an array of all the tokens that have been deposited and their corresponding seasons
        await expect(this.silo.mow(depositorAddress, this.beanMetapool.address)).to.be.revertedWith('silo migration needed');
      });
    });
  
    describe('update grown stalk per bdv per season rate', function () {
      it('change rate a few times and check cumulativeGrownStalkPerBdv', async function () {
        this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond);
        const beanstalkOwner = await impersonateBeanstalkOwner()
        await this.season.teleportSunrise(await this.silo.grownStalkPerBdvStartSeason());
  
        expect(await this.silo.cumulativeGrownStalkPerBdv(this.beanMetapool.address)).to.eq(0);
  
        //change rate to 5 and check after 1 season
        await this.whitelist.connect(beanstalkOwner).updateStalkPerBdvPerSeasonForToken(this.beanMetapool.address, 5*1e6);
        await this.season.siloSunrise(0);
        expect(await this.silo.cumulativeGrownStalkPerBdv(this.beanMetapool.address)).to.eq(5);
  
        //change rate to 1 and check after 5 seasons
        await this.whitelist.connect(beanstalkOwner).updateStalkPerBdvPerSeasonForToken(this.beanMetapool.address, 1*1e6);
        await this.season.fastForward(5);
        expect(await this.silo.cumulativeGrownStalkPerBdv(this.beanMetapool.address)).to.eq(10);
      });
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
            seasons[i] = await this.silo.seasonToGrownStalkPerBdv(token, season);
        }
  
        //single withdraw
        await expect(this.silo.connect(depositorSigner).withdrawDeposit(token, seasons[0], to6('1'), EXTERNAL)).to.be.revertedWith('silo migration needed')
        
        //multi withdraw
        await expect(this.silo.connect(depositorSigner).withdrawDeposits(token, seasons, [to6('1'), to6('1')], EXTERNAL)).to.be.revertedWith('silo migration needed')
      });
  
      //attempt to convert before migrating
      it('attempt to convert LP before migrating', async function () {
        const depositorAddress = '0x5e68bb3de6133baee55eeb6552704df2ec09a824';
        const token = '0x1bea3ccd22f4ebd3d37d731ba31eeca95713716d';
        const grownStalkPerBdv =  await this.silo.seasonToGrownStalkPerBdv(token, 6061);
        await mintEth(depositorAddress);
        const depositorSigner = await impersonateSigner(depositorAddress);
        await this.silo.connect(depositorSigner);
        await expect(this.convert.connect(depositorSigner).convert(ConvertEncoder.convertCurveLPToBeans(to6('7863'), to6('7500'), this.beanMetapool.address), [grownStalkPerBdv], [to6('7863')])).to.be.revertedWith('Silo: mow failed')
      });
  
      it('attempt to convert bean before migrating', async function () {
        const depositorAddress = '0x10bf1dcb5ab7860bab1c3320163c6dddf8dcc0e4';
        const token = '0xbea0000029ad1c77d3d5d23ba2d8893db9d1efab';
        const grownStalkPerBdv =  await this.silo.seasonToGrownStalkPerBdv(token, 7563);
        await mintEth(depositorAddress);
        const depositorSigner = await impersonateSigner(depositorAddress);
        await this.silo.connect(depositorSigner);
        await expect(this.convert.connect(depositorSigner).convert(ConvertEncoder.convertBeansToCurveLP(to6('345000'), to6('340000'), this.beanMetapool.address), [grownStalkPerBdv], [to6('345000')])).to.be.revertedWith('Silo: mow failed')
      }); 
  
      it('attempt to convert unripe LP before migrating', async function () {
        const depositorAddress = '0x5e68bb3de6133baee55eeb6552704df2ec09a824';
        const token = '0x1bea3ccd22f4ebd3d37d731ba31eeca95713716d';
        const grownStalkPerBdv =  await this.silo.seasonToGrownStalkPerBdv(token, 6061);
        await mintEth(depositorAddress);
  
        const depositorSigner = await impersonateSigner(depositorAddress);
        await this.silo.connect(depositorSigner);
    
        await expect(this.convert.connect(depositorSigner).convert(ConvertEncoder.convertUnripeLPToBeans(to6('7863'), to6('7500')), [grownStalkPerBdv], [to6('7863')])).to.be.revertedWith('Silo: mow failed')
      });
  
      it('attempt to convert unripe bean before migrating', async function () {
        //price of bean doesn't even have to be over 1 for this test because a mow is required before
        //any convert, and that will fail if the silo hasn't been migrated
        const depositorAddress = '0x10bf1dcb5ab7860bab1c3320163c6dddf8dcc0e4';
  
        const token = '0x1bea0050e63e05fbb5d8ba2f10cf5800b6224449';
  
        const grownStalkPerBdv =  await this.silo.seasonToGrownStalkPerBdv(token, 6074);
        await mintEth(depositorAddress);
  
        const depositorSigner = await impersonateSigner(depositorAddress);
        await this.silo.connect(depositorSigner);
    
        await expect(this.convert.connect(depositorSigner).convert(ConvertEncoder.convertUnripeBeansToLP(to6('345000'), to6('340000')), [grownStalkPerBdv], [to6('345000')])).to.be.revertedWith('Silo: mow failed')
      });    
    });
  });