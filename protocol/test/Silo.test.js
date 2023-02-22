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
  

  describe("Time Weighted Earned Bean Emission", async function () {
    before(async function () {
      await this.bean.mint(user3Address, to6('10000'));
      await this.bean.mint(user4Address, to6('10000'));
      this.result = await this.silo.connect(user3).deposit(this.bean.address, to6('1000'), EXTERNAL)
      this.result = await this.silo.connect(user4).deposit(this.bean.address, to6('1000'), EXTERNAL)
    });
    
    // tests a farmers deposit that has no earned bean prior
    describe("No Earned Beans prior to plant", async function() {
      
      beforeEach(async function () {
        await this.season.siloSunrise(to6('100'))
        beginning_timestamp = await time.latest();
        season = await this.season.season();
      })

      describe("With Multiple Users", async function () {
        it('a single farmer plants during and after vesting period', async function () {
          await this.season.setSunriseBlock(await ethers.provider.getBlockNumber());
  
          await this.silo.connect(user).plant();
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, season)
          expect(earned_beans[0]).to.eq(0);
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(0);
          expect(await this.silo.connect(user3).balanceOfEarnedBeans(user3Address)).to.eq(0);
          expect(await this.silo.connect(user4).balanceOfEarnedBeans(user4Address)).to.eq(0);
  
          
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 25 + 1);
  
          await this.silo.connect(user).plant();
          earned_beans = await this.silo.getDeposit(userAddress,this.bean.address,season);
          expect(earned_beans[0]).to.eq(25e6);
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(25e6);
          expect(await this.silo.connect(user3).balanceOfEarnedBeans(user3Address)).to.eq(25e6);
          expect(await this.silo.connect(user4).balanceOfEarnedBeans(user4Address)).to.eq(25e6);
        });
  
        it('multiple farmers plants during and after vesting period', async function () {
          console.log("Current Block", await ethers.provider.getBlockNumber());
          console.log("Sunrise Block", (await this.season.getSunriseBlock()).toString());
         
          await this.silo.connect(user).plant();
          await this.silo.connect(user2).plant();
          await this.silo.connect(user3).plant();
          await this.silo.connect(user4).plant();
  
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, season)
          expect(earned_beans[0]).to.eq(0);
          earned_beans = await this.silo.getDeposit(user2Address, this.bean.address, season)
          expect(earned_beans[0]).to.eq(0);
          earned_beans = await this.silo.getDeposit(user3Address, this.bean.address, season)
          expect(earned_beans[0]).to.eq(0);
          earned_beans = await this.silo.getDeposit(user4Address, this.bean.address, season)
          expect(earned_beans[0]).to.eq(0);
          
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 25 + 1);
          await this.silo.connect(user4).plant();
          await this.silo.connect(user2).plant();
          earned_beans = await this.silo.getDeposit(user4Address,this.bean.address,season);
          expect(earned_beans[0]).to.eq(25e6);
          earned_beans = await this.silo.getDeposit(user3Address,this.bean.address,season);
          expect(earned_beans[0]).to.eq(0);
          earned_beans = await this.silo.getDeposit(user2Address,this.bean.address,season);
          expect(earned_beans[0]).to.eq(25e6);
          earned_beans = await this.silo.getDeposit(userAddress,this.bean.address,season);
          expect(earned_beans[0]).to.eq(0);
        });
  
        it('some farmers plants during, some farmers plant after vesting period', async function () {
          await this.season.setSunriseBlock(await ethers.provider.getBlockNumber());
    
         
          await this.silo.connect(user).plant();
          await this.silo.connect(user2).plant();
  
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, season)
          expect(earned_beans[0]).to.eq(0);
          earned_beans = await this.silo.getDeposit(user2Address, this.bean.address, season)
          expect(earned_beans[0]).to.eq(0);
  
          expect(await this.silo.connect(user3).balanceOfEarnedBeans(user3Address)).to.eq(0);
          expect(await this.silo.connect(user4).balanceOfEarnedBeans(user4Address)).to.eq(0);
          
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 25 + 1);
          await this.silo.connect(user4).plant();
          await this.silo.connect(user3).plant();
          earned_beans = await this.silo.getDeposit(user4Address,this.bean.address,season);
          expect(earned_beans[0]).to.eq(25e6);
          earned_beans = await this.silo.getDeposit(user3Address,this.bean.address,season);
          expect(earned_beans[0]).to.eq(25e6);
  
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(25e6);
          expect(await this.silo.connect(user).balanceOfEarnedBeans(userAddress)).to.eq(25e6);
  
        });

        it("Some Earned Beans Prior to plant, some earned beans after plant", async function () {
          await mineUpTo((await ethers.provider.getBlockNumber()) + 25 + 1);
          await this.silo.connect(user).plant(); // root increased by X, stalk increased by 2
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, season)
  
          expect(earned_beans[0]).to.eq(25e6);
          expect(await this.silo.connect(user).balanceOfEarnedBeans(userAddress)).to.eq(0);
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(25e6);
          expect(await this.silo.connect(user3).balanceOfEarnedBeans(user3Address)).to.eq(25e6);
          expect(await this.silo.connect(user4).balanceOfEarnedBeans(user4Address)).to.eq(25e6);
  
          // call sunrise, plant again
          await time.increase(3600)
          await this.season.siloSunrise(to6('100'));
          season = await this.season.season();
          await this.season.setSunriseBlock(await ethers.provider.getBlockNumber());

          expect(await this.silo.connect(user).balanceOfEarnedBeans(userAddress)).to.eq(0); // harvested last season 
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(25e6); // not harvested yet 
          expect(await this.silo.connect(user3).balanceOfEarnedBeans(user3Address)).to.eq(25e6); // 
          expect(await this.silo.connect(user4).balanceOfEarnedBeans(user4Address)).to.eq(25e6);
        
          await this.silo.connect(user).plant(); // root increased by Y, stalk increased by 2
          earned_beans = await this.silo.getDeposit(user2Address,this.bean.address,season);
          expect(earned_beans[0]).to.eq(0);

          await this.silo.connect(user2).plant(); // root increased by Y, stalk increased by 4
          earned_beans = await this.silo.getDeposit(user2Address,this.bean.address,season);
          expect(earned_beans[0]).to.eq(25e6);
  
          expect(await this.silo.connect(user).balanceOfEarnedBeans(userAddress)).to.eq(0); // harvested 25 beans from previous season
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(0); // just harvested
  
          expect(await this.silo.connect(user3).balanceOfEarnedBeans(user3Address)).to.eq(25e6);
          expect(await this.silo.connect(user4).balanceOfEarnedBeans(user4Address)).to.eq(25e6);
  

          await mineUpTo((await ethers.provider.getBlockNumber()) + 25 + 1);
          
          //  user has more as he mowed grown stalk from previous season
          expect(await this.silo.connect(user).balanceOfEarnedBeans(userAddress)).to.eq(25003658); 
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(24998780);
  
          expect(await this.silo.connect(user3).balanceOfEarnedBeans(user3Address)).to.eq(49998780);
          expect(await this.silo.connect(user4).balanceOfEarnedBeans(user4Address)).to.eq(49998780);

          await this.silo.connect(user3).plant();
          await this.silo.connect(user4).plant(); 
  
          earned_beans = await this.silo.getDeposit(user3Address,this.bean.address,season);
          expect(earned_beans[0]).to.eq(49998780);
          earned_beans = await this.silo.getDeposit(user4Address,this.bean.address,season);
          expect(earned_beans[0]).to.eq(49998780);
  
          expect(await this.silo.connect(user).balanceOfEarnedBeans(userAddress)).to.eq(25003658); 
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(24998780);
  
        });
      })    
    })

    describe("Some Earned Beans Prior to plant", async function () {
      
      beforeEach(async function () {
        await this.season.siloSunrise(to6('100'))
        await time.increase(3600) // 1800 + 1800 = 60 minutes = all beans issued
        await this.season.siloSunrise(to6('100'))
        season = await this.season.season()
      })

      describe("With Multiple Users", async function () {
        
        it('a single farmer plants during and after vesting period', async function () {
          await this.season.setSunriseBlock(await ethers.provider.getBlockNumber());
          
          await this.silo.connect(user).plant();
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, season)

          expect(earned_beans[0]).to.eq(25e6); // 50 earned beans - 25 from this season 
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(25e6);
          expect(await this.silo.connect(user3).balanceOfEarnedBeans(user2Address)).to.eq(25e6);
          expect(await this.silo.connect(user4).balanceOfEarnedBeans(user2Address)).to.eq(25e6);
  
          
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 25 + 1);
  
          await this.silo.connect(user).plant();
          earned_beans = await this.silo.getDeposit(userAddress,this.bean.address,season);

          expect(earned_beans[0]).to.eq(50e6);
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(50e6);
          expect(await this.silo.connect(user3).balanceOfEarnedBeans(user2Address)).to.eq(50e6);
          expect(await this.silo.connect(user4).balanceOfEarnedBeans(user2Address)).to.eq(50e6);
        });
  
        it('multiple farmers plants during and after vesting period', async function () {
          await this.season.setSunriseBlock(await ethers.provider.getBlockNumber());

          await this.silo.connect(user).plant();
          await this.silo.connect(user3).plant();
  
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, season)
          expect(earned_beans[0]).to.eq(25e6);
          earned_beans = await this.silo.getDeposit(user2Address, this.bean.address, season)
          expect(earned_beans[0]).to.eq(0);
          earned_beans = await this.silo.getDeposit(user3Address, this.bean.address, season)
          expect(earned_beans[0]).to.eq(25e6);
          earned_beans = await this.silo.getDeposit(user4Address, this.bean.address, season)
          expect(earned_beans[0]).to.eq(0);
          
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 25 + 1);
          await this.silo.connect(user4).plant();
          await this.silo.connect(user2).plant();
          earned_beans = await this.silo.getDeposit(userAddress,this.bean.address,season);
          expect(earned_beans[0]).to.eq(25e6);
          earned_beans = await this.silo.getDeposit(user2Address,this.bean.address,season);
          expect(earned_beans[0]).to.eq(50e6);
          earned_beans = await this.silo.getDeposit(user3Address,this.bean.address,season);
          expect(earned_beans[0]).to.eq(25e6);
          earned_beans = await this.silo.getDeposit(user4Address,this.bean.address,season);
          expect(earned_beans[0]).to.eq(50e6);
          
        });
  
        it('some farmers plants during, some farmers plant after vesting period', async function () {
          await this.season.setSunriseBlock(await ethers.provider.getBlockNumber());
    
         
          await this.silo.connect(user).plant();
          await this.silo.connect(user2).plant();
  
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, season)
          expect(earned_beans[0]).to.eq(25e6);
          earned_beans = await this.silo.getDeposit(user2Address, this.bean.address, season)
          expect(earned_beans[0]).to.eq(25e6);
  
          expect(await this.silo.connect(user3).balanceOfEarnedBeans(user3Address)).to.eq(25e6);
          expect(await this.silo.connect(user4).balanceOfEarnedBeans(user4Address)).to.eq(25e6);
          
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 25 + 1);
          await this.silo.connect(user4).plant();
          await this.silo.connect(user3).plant();
          earned_beans = await this.silo.getDeposit(user4Address,this.bean.address,season);
          expect(earned_beans[0]).to.eq(50e6);
          earned_beans = await this.silo.getDeposit(user3Address,this.bean.address,season);
          expect(earned_beans[0]).to.eq(50e6);
  
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(25e6);
          expect(await this.silo.connect(user).balanceOfEarnedBeans(userAddress)).to.eq(25e6);
  
        });

      });

    });
  });
});

describe.only('Silo V3: Grown Stalk Per Bdv deployment', function () {
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
    console.log('here 1');
    const signer = await impersonateBeanstalkOwner()
    await mintEth(signer.address);
    await upgradeWithNewFacets({
      diamondAddress: BEANSTALK,
      facetNames: ['SiloFacet', 'ConvertFacet', 'WhitelistFacet', 'MockAdminFacet'],
      // libraryNames: ['LibLegacyTokenSilo'],
      initFacetName: 'InitBipNewSilo',
      bip: false,
      object: false,
      verbose: false,
      account: signer
    });
    console.log('here 2');
    const latestBlock = await hre.ethers.provider.getBlock("latest");
    console.log('latestBlock: ', latestBlock.number);

    [owner,user,user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    console.log('here 3');
    // const contracts = await deploy("Test", false);
    // ownerAddress = contracts.account;
    this.diamond = BEANSTALK;
    console.log('here 3a');
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond);

    console.log('here 4');
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond);
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

  describe('Update Whitelist info for Silo Assets', function () {
    it('properly updates the silo info for bean', async function () {
      const settings = await this.silo.tokenSettings(this.bean.address);

      expect(settings['stalkPerBdvPerSeason']).to.eq(2);
      expect(settings['stalkPerBdv']).to.eq(1);
      expect(settings['lastUpdateSeason']).to.eq(await this.season.season());
      expect(settings['lastCumulativeGrownStalkPerBdv']).to.eq(0);
      expect(settings['legacySeedsPerBdv']).to.eq(2);
    });
    
    it('properly updates the silo info for curve metapool', async function () {
      const settings = await this.silo.tokenSettings(this.beanMetapool.address);

      expect(settings['stalkPerBdvPerSeason']).to.eq(4);
      expect(settings['stalkPerBdv']).to.eq(1);
      expect(settings['lastUpdateSeason']).to.eq(await this.season.season());
      expect(settings['lastCumulativeGrownStalkPerBdv']).to.eq(0);
      expect(settings['legacySeedsPerBdv']).to.eq(4);
    });

    it('properly updates the silo info for unripe bean', async function () {
      const settings = await this.silo.tokenSettings(this.unripeBean.address);

      expect(settings['stalkPerBdvPerSeason']).to.eq(2);
      expect(settings['stalkPerBdv']).to.eq(1);
      expect(settings['lastUpdateSeason']).to.eq(await this.season.season());
      expect(settings['lastCumulativeGrownStalkPerBdv']).to.eq(0);
      expect(settings['legacySeedsPerBdv']).to.eq(2);
    });

    it('properly updates the silo info for unripe LP', async function () {
      const settings = await this.silo.tokenSettings(this.unripeLP.address);

      expect(settings['stalkPerBdvPerSeason']).to.eq(2);
      expect(settings['stalkPerBdv']).to.eq(1);
      expect(settings['lastUpdateSeason']).to.eq(await this.season.season());
      expect(settings['lastCumulativeGrownStalkPerBdv']).to.eq(0);
      expect(settings['legacySeedsPerBdv']).to.eq(4); //keep 4 here because it used to be 4, needed for seasons deposit calculations
    });
  });
});