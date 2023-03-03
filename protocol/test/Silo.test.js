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

let user,user2,owner;
let userAddress, ownerAddress, user2Address;

describe('Silo', function () {
  before(async function () {

    [owner,user,user2] = await ethers.getSigners();
    [owner,user,user2,user3,user4] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    user3Address = user3.address;
    user4Address = user4.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address);
    
    await this.season.teleportSunrise(10);

    this.season.deployGrownStalkPerBdv();

    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address);
    this.bean = await ethers.getContractAt('Bean', BEAN);
    await this.season.lightSunrise();
    await this.bean.connect(user).approve(this.silo.address, '100000000000');
    await this.bean.connect(user2).approve(this.silo.address, '100000000000'); 
    await this.bean.connect(user3).approve(this.silo.address, '100000000000');
    await this.bean.connect(user4).approve(this.silo.address, '100000000000'); 
    await this.bean.mint(userAddress, to6('10000'));
    await this.bean.mint(user2Address, to6('10000'));
    await this.silo.mow(userAddress, this.bean.address);

    this.result = await this.silo.connect(user).deposit(this.bean.address, to6('1000'), EXTERNAL)
    this.result = await this.silo.connect(user2).deposit(this.bean.address, to6('1000'), EXTERNAL)
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe('Silo Balances After Deposits', function () {
    it('properly updates the user balances', async function () {
      //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(to6('2000'));
      expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('1000'));
      expect(await this.silo.balanceOfRoots(userAddress)).to.eq(toStalk('1000000000000000'));
    });

    it('properly updates the total balances', async function () {
      //expect(await this.silo.totalSeeds()).to.eq(to6('4000'));
      expect(await this.silo.totalStalk()).to.eq(toStalk('2000'));
      expect(await this.silo.totalRoots()).to.eq(toStalk('2000000000000000'));
    });
  });

  describe('Silo Balances After Withdrawal', function () {
    beforeEach(async function () {
      await this.silo.connect(user).withdrawDeposit(this.bean.address, '2', to6('500'), EXTERNAL) //we deposited at grownStalkPerBdv of 2, need to withdraw from 2
    })

    it('properly updates the total balances', async function () {
      expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('500'));
      expect(await this.silo.balanceOfRoots(userAddress)).to.eq(toStalk('500000000000000'));
    });

    it('properly updates the total balances', async function () {
      expect(await this.silo.totalStalk()).to.eq(toStalk('1500'));
      expect(await this.silo.totalRoots()).to.eq(toStalk('1500000000000000'));
    });
  });

  describe("Silo Sunrise", async function () {
    describe("Single", async function () {
      beforeEach(async function () {
        await this.season.siloSunrise(to6('100'))
        await time.increase(3600); // wait until end of season to get earned
        await mine(25);
      })

      it('properly updates the earned balances', async function () {
        expect(await this.silo.balanceOfGrownStalk(userAddress, this.bean.address)).to.eq(toStalk('0.2'));
        expect(await this.silo.balanceOfEarnedBeans(userAddress)).to.eq(to6('50'));
        expect(await this.silo.balanceOfEarnedStalk(userAddress)).to.eq(toStalk('50'));
        expect(await this.silo.totalEarnedBeans()).to.eq(to6('100'));
      });

      it('properly updates the total balances', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('1050'));
        expect(await this.silo.balanceOfRoots(userAddress)).to.eq(toStalk('1000000000000000'));
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo.totalStalk()).to.eq(toStalk('2100'));
        expect(await this.silo.totalRoots()).to.eq(toStalk('2000000000000000'));
      });
    })
  });

  describe("Single Earn", async function () {
    beforeEach(async function () {
      await this.season.siloSunrise(to6('100'))
      await time.increase(3600); // wait until end of season to get earned
      await mine(25);
      await this.silo.mow(user2Address, this.bean.address)
      this.result = await this.silo.connect(user).plant(this.bean.address)
    })

    it('properly updates the earned balances', async function () {
      expect(await this.silo.balanceOfGrownStalk(userAddress, this.bean.address)).to.eq('0');
      expect(await this.silo.balanceOfEarnedBeans(userAddress)).to.eq('0');
      // expect(await this.silo.balanceOfEarnedSeeds(userAddress)).to.eq('0');
      expect(await this.silo.balanceOfEarnedStalk(userAddress)).to.eq('0');
      expect(await this.silo.totalEarnedBeans()).to.eq(to6('50'));
    });

    it('properly updates the total balances', async function () {
      //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(to6('2100'));
      expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('1050.2'));
      expect(await this.silo.balanceOfRoots(userAddress)).to.eq('10001904761904761904761904');
    });

    it('properly updates the total balances', async function () {
      //expect(await this.silo.totalSeeds()).to.eq(to6('4100'));
      expect(await this.silo.totalStalk()).to.eq(to6('21004000'));
      expect(await this.silo.totalRoots()).to.eq('20003809523809523809523808');
    });

    it('properly emits events', async function () {
      expect(this.result).to.emit(this.silo, 'Earn')
    })

    it('user2 earns rest', async function () {
      await this.silo.connect(user2).plant(this.bean.address)
      expect(await this.silo.totalEarnedBeans()).to.eq('0');
    });
  });
  

});

describe('Silo V3: Grown Stalk Per Bdv deployment', function () {
  before(async function () {

    try {
      await network.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
              jsonRpcUrl: process.env.FORKING_RPC,
              blockNumber: 16664100 //a random semi-recent block
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

    const latestBlock = await hre.ethers.provider.getBlock("latest");
    console.log('latestBlock: ', latestBlock.number);

    [owner,user,user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;

    // const contracts = await deploy("Test", false);
    // ownerAddress = contracts.account;
    this.diamond = BEANSTALK;

    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond);


    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond);
    this.whitelist = await ethers.getContractAt('WhitelistFacet', this.diamond);
    console.log('this.whitelist: ', this.whitelist);
    console.log('this.silo: ', this.silo.address);
    this.bean = await ethers.getContractAt('Bean', BEAN);
    this.beanMetapool = await ethers.getContractAt('IMockCurvePool', BEAN_3_CURVE);
    this.unripeBean = await ethers.getContractAt('MockToken', UNRIPE_BEAN)
    this.unripeLP = await ethers.getContractAt('MockToken', UNRIPE_LP)


    //large bean depositor is 0x10bf1dcb5ab7860bab1c3320163c6dddf8dcc0e4



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

      // for (let i = 0; i < seasons.length; i++) {
      //   for (let j = 0; j < seasons[i].length; j++) {
      //     const season = seasons[i][j];
      //     seasons[i][j] = await this.silo.seasonToGrownStalkPerBdv(tokens[i], season);
      //   }
      // }
      
      // console.log('modified seasons: ', seasons);

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
  
    
      // migrate will fail since user has no deposits here (they should use .)
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

  describe.only('Silo interaction tests after deploying grown stalk per bdv', function () {
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
    
  });
});