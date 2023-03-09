const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { to18, to6, toStalk } = require('./utils/helpers.js')
const { BEAN, BEANSTALK, BCM, BEAN_3_CURVE, UNRIPE_BEAN, UNRIPE_LP } = require('./utils/constants')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
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

    this.season.deployStemsUpgrade();

    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address);
    this.bean = await ethers.getContractAt('Bean', BEAN);
    await this.season.lightSunrise();
    await this.bean.connect(user).approve(this.silo.address, '100000000000');
    await this.bean.connect(user2).approve(this.silo.address, '100000000000'); 
    await this.bean.connect(user3).approve(this.silo.address, '100000000000');
    await this.bean.connect(user4).approve(this.silo.address, '100000000000'); 
    await this.bean.mint(userAddress, to6('10000'));
    await this.bean.mint(user2Address, to6('10000'));
    await this.bean.mint(user3Address, to6('10000'));
    await this.bean.mint(user4Address, to6('10000'));
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
      await this.silo.connect(user).withdrawDeposit(this.bean.address, '2', to6('500'), EXTERNAL) //we deposited at stem of 2, need to withdraw from 2
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

  describe("Earned Beans issuance during vesting period", async function () {
    before(async function () {
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
  
          await this.silo.connect(user).plant(this.bean.address);
          stem = await this.silo.seasonToStem(this.bean.address, season);
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0);
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(0);
          expect(await this.silo.connect(user3).balanceOfEarnedBeans(user3Address)).to.eq(0);
          expect(await this.silo.connect(user4).balanceOfEarnedBeans(user4Address)).to.eq(0);
  
          
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 25 + 1);
  
          await this.silo.connect(user).plant(this.bean.address);
          earned_beans = await this.silo.getDeposit(userAddress,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(25e6);
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(25e6);
          expect(await this.silo.connect(user3).balanceOfEarnedBeans(user3Address)).to.eq(25e6);
          expect(await this.silo.connect(user4).balanceOfEarnedBeans(user4Address)).to.eq(25e6);
        });
  
        it('multiple farmers plants during and after vesting period', async function () {
          console.log("Current Block", await ethers.provider.getBlockNumber());
          console.log("Sunrise Block", (await this.season.getSunriseBlock()).toString());
         
          await this.silo.connect(user).plant(this.bean.address);
          await this.silo.connect(user2).plant(this.bean.address);
          await this.silo.connect(user3).plant(this.bean.address);
          await this.silo.connect(user4).plant(this.bean.address);
          stem = await this.silo.seasonToStem(this.bean.address, season);
  
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0);
          earned_beans = await this.silo.getDeposit(user2Address, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0);
          earned_beans = await this.silo.getDeposit(user3Address, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0);
          earned_beans = await this.silo.getDeposit(user4Address, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0);
          
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 25 + 1);
          await this.silo.connect(user4).plant(this.bean.address);
          await this.silo.connect(user2).plant(this.bean.address);
          earned_beans = await this.silo.getDeposit(user4Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(25e6);
          earned_beans = await this.silo.getDeposit(user3Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(0);
          earned_beans = await this.silo.getDeposit(user2Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(25e6);
          earned_beans = await this.silo.getDeposit(userAddress,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(0);
        });
  
        it('some farmers plants during, some farmers plant after vesting period', async function () {
          await this.season.setSunriseBlock(await ethers.provider.getBlockNumber());
    
         
          await this.silo.connect(user).plant(this.bean.address);
          await this.silo.connect(user2).plant(this.bean.address);
          stem = await this.silo.seasonToStem(this.bean.address, season);

  
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0);
          earned_beans = await this.silo.getDeposit(user2Address, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0);
  
          expect(await this.silo.connect(user3).balanceOfEarnedBeans(user3Address)).to.eq(0);
          expect(await this.silo.connect(user4).balanceOfEarnedBeans(user4Address)).to.eq(0);
          
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 25 + 1);
          await this.silo.connect(user4).plant(this.bean.address);
          await this.silo.connect(user3).plant(this.bean.address);
          earned_beans = await this.silo.getDeposit(user4Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(25e6);
          earned_beans = await this.silo.getDeposit(user3Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(25e6);
  
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(25e6);
          expect(await this.silo.connect(user).balanceOfEarnedBeans(userAddress)).to.eq(25e6);
  
        });

        it("Some Earned Beans Prior to plant, some earned beans after plant", async function () {
          await mineUpTo((await ethers.provider.getBlockNumber()) + 25 + 1);
          await this.silo.connect(user).plant(this.bean.address); // root increased by X, stalk increased by 2
          stem = await this.silo.seasonToStem(this.bean.address, season);
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)
  
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
        
          await this.silo.connect(user).plant(this.bean.address); // root increased by Y, stalk increased by 2
          stem = await this.silo.seasonToStem(this.bean.address, season);
          earned_beans = await this.silo.getDeposit(user2Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(0);

          await this.silo.connect(user2).plant(this.bean.address); // root increased by Y, stalk increased by 4
          earned_beans = await this.silo.getDeposit(user2Address,this.bean.address,stem);
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

          await this.silo.connect(user3).plant(this.bean.address);
          await this.silo.connect(user4).plant(this.bean.address); 
  
          earned_beans = await this.silo.getDeposit(user3Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(49998780);
          earned_beans = await this.silo.getDeposit(user4Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(49998780);
  
          expect(await this.silo.connect(user).balanceOfEarnedBeans(userAddress)).to.eq(25003658); 
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(24998780);
  
        });

        it('farmer plants in vesting period, then plants again in the following season', async function () {
          await this.season.setSunriseBlock(await ethers.provider.getBlockNumber());
          season = await this.season.season();
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(userAddress)).to.eq(0);
          await this.silo.connect(user).plant(this.bean.address);

          stem = await this.silo.seasonToStem(this.bean.address, season);
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0);
            
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 25 + 1);
          expect(await this.silo.connect(userAddress).balanceOfEarnedBeans(userAddress)).to.eq(25e6);

          // sunrise again 
          await this.season.siloSunrise(to6('100'))
          season = await this.season.season();
          stem = await this.silo.seasonToStem(this.bean.address, season);

          expect(await this.silo.connect(userAddress).balanceOfEarnedBeans(userAddress)).to.eq(25e6); 
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0)
          
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 25 + 1);

          await this.silo.connect(user).plant(this.bean.address);
          expect(await this.silo.connect(userAddress).balanceOfEarnedBeans(userAddress)).to.eq(0);
          earned_beans = await this.silo.getDeposit(userAddress,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(50003658); // user gets the earned beans from the previous season + the beans from the current season
          // user gets slightly more since they mowed last season. 
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
          
          await this.silo.connect(user).plant(this.bean.address);
          stem = await this.silo.seasonToStem(this.bean.address, season);
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)

          expect(earned_beans[0]).to.eq(25e6); // 50 earned beans - 25 from this season 
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(25e6);
          expect(await this.silo.connect(user3).balanceOfEarnedBeans(user2Address)).to.eq(25e6);
          expect(await this.silo.connect(user4).balanceOfEarnedBeans(user2Address)).to.eq(25e6);
  
          
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 25 + 1);
  
          await this.silo.connect(user).plant(this.bean.address);
          earned_beans = await this.silo.getDeposit(userAddress,this.bean.address,stem);

          expect(earned_beans[0]).to.eq(50e6);
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(50e6);
          expect(await this.silo.connect(user3).balanceOfEarnedBeans(user2Address)).to.eq(50e6);
          expect(await this.silo.connect(user4).balanceOfEarnedBeans(user2Address)).to.eq(50e6);
        });
  
        it('multiple farmers plants during and after vesting period', async function () {
          await this.season.setSunriseBlock(await ethers.provider.getBlockNumber());

          await this.silo.connect(user).plant(this.bean.address);
          await this.silo.connect(user3).plant(this.bean.address);
          stem = await this.silo.seasonToStem(this.bean.address, season);

  
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(25e6);
          earned_beans = await this.silo.getDeposit(user2Address, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0);
          earned_beans = await this.silo.getDeposit(user3Address, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(25e6);
          earned_beans = await this.silo.getDeposit(user4Address, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0);
          
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 25 + 1);
          await this.silo.connect(user4).plant(this.bean.address);
          await this.silo.connect(user2).plant(this.bean.address);
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem);
          expect(earned_beans[0]).to.eq(25e6);
          earned_beans = await this.silo.getDeposit(user2Address,this.bean.address, stem);
          expect(earned_beans[0]).to.eq(50e6);
          earned_beans = await this.silo.getDeposit(user3Address,this.bean.address, stem);
          expect(earned_beans[0]).to.eq(25e6);
          earned_beans = await this.silo.getDeposit(user4Address,this.bean.address, stem);
          expect(earned_beans[0]).to.eq(50e6);
          
        });
  
        it('some farmers plants during, some farmers plant after vesting period', async function () {
          await this.season.setSunriseBlock(await ethers.provider.getBlockNumber());
    
         
          await this.silo.connect(user).plant(this.bean.address);
          await this.silo.connect(user2).plant(this.bean.address);
  
          stem = await this.silo.seasonToStem(this.bean.address, season);
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(25e6);
          earned_beans = await this.silo.getDeposit(user2Address, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(25e6);
  
          expect(await this.silo.connect(user3).balanceOfEarnedBeans(user3Address)).to.eq(25e6);
          expect(await this.silo.connect(user4).balanceOfEarnedBeans(user4Address)).to.eq(25e6);
          
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 25 + 1);
          await this.silo.connect(user4).plant(this.bean.address);
          await this.silo.connect(user3).plant(this.bean.address);
          earned_beans = await this.silo.getDeposit(user4Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(50e6);
          earned_beans = await this.silo.getDeposit(user3Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(50e6);
  
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(25e6);
          expect(await this.silo.connect(user).balanceOfEarnedBeans(userAddress)).to.eq(25e6);
  
        });
      });
    });
  });
});
