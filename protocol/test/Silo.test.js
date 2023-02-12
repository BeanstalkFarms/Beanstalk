const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { to18, to6, toStalk } = require('./utils/helpers.js')
const { BEAN } = require('./utils/constants')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

let user,user2,owner;
let userAddress, ownerAddress, user2Address;

describe('Silo', function () {
  before(async function () {

    [owner,user,user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
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
    await this.bean.mint(userAddress, to6('10000'));
    await this.bean.mint(user2Address, to6('10000'));
    await this.silo.mow(userAddress, this.bean.address);
    this.result = await this.silo.connect(user).deposit(this.bean.address, to6('1000'), EXTERNAL)
    this.result = await this.silo.connect(user2).deposit(this.bean.address, to6('1000'), EXTERNAL)

    console.log('current season: ', await this.season.season());
    console.log('deposited in cumulativeGrownStalkPerBdv: ', await this.silo.cumulativeGrownStalkPerBdv(this.bean.address));
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
    
    // tests a farmers deposit that has no earned bean prior
    describe("No Earned Beans prior to sunrise", async function() {

      // FIXME: figure out why there is a 125000 constant
      beforeEach(async function () {
        await this.season.siloSunrise(to6('100'))
      })

      it('Does not issue any Earned Beans at the start of the season.', async function () {
        expect(await this.silo.balanceOfEarnedBeans(userAddress)).to.eq('0');
      });

      it('Issues 1/4th the total Earned Beans at the start of the season.', async function () {
        await time.increase(900); // 900 seconds = 30 minutes = half beans issued
        expect(await this.silo.balanceOfEarnedBeans(userAddress)).to.eq(to6('12.5'));
      });

      it('Issues half the total Earned Beans at the start of the season.', async function () {
        await time.increase(1800); // 1800 seconds = 30 minutes = half beans issued
        expect(await this.silo.balanceOfEarnedBeans(userAddress)).to.eq(to6('25'));
      });

      it('Issues 3/4ths the total Earned Beans at the start of the season.', async function () {
        await time.increase(2700); // 2700 seconds = 30 minutes = half beans issued
        expect(await this.silo.balanceOfEarnedBeans(userAddress)).to.eq(to6('37.5'));
      });

      it('Issues all Earned Beans at the end of the season.', async function () {
        await time.increase(3600); //3600 seconds = 60 minutes = all beans issued
        expect(await this.silo.balanceOfEarnedBeans(userAddress)).to.eq(to6('50'));
      });
    })

    describe("Some Earned Beans Prior to sunrise", async function () {
      
      beforeEach(async function () {
        await this.season.siloSunrise(to6('100'))
        await time.increase(3600); // 1800 + 1800 = 60 minutes = all beans issued
        await this.season.siloSunrise(to6('100'))
      })

      it('Issues ONLY Earned Beans from last season.', async function () {
        expect(await this.silo.balanceOfEarnedBeans(userAddress)).to.eq(to6('50'));
      });

      it('Issues Earned Beans from last season + 25% of this season.', async function () {
        await time.increase(900); // 900 seconds = 30 minutes = half beans issued
        expect(await this.silo.balanceOfEarnedBeans(userAddress)).to.eq(to6('62.5'));
      });

      it('Issues Earned Beans from last season + 50% of this season.', async function () {
        await time.increase(1800); // 1800 seconds = 30 minutes = half beans issued
        expect(await this.silo.balanceOfEarnedBeans(userAddress)).to.eq(to6('75'));
      });

      it('Issues Earned Beans from last season + 75% of this season.', async function () {
        await time.increase(2700); // 2700 seconds = 30 minutes = half beans issued
        expect(await this.silo.balanceOfEarnedBeans(userAddress)).to.eq(to6('87.5'));
      });

      it('Issues Earned Beans from last season + all of this season.', async function () {
        await time.increase(3600); // 3600 seconds = 60 minutes = all beans issued
        season = await this.season.season();
        expect(await this.silo.balanceOfEarnedBeans(userAddress)).to.eq(to6('100'));
        await this.silo.connect(user).plant(this.bean.address);
        earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, season);
        console.log("earned Beans -", earned_beans);
      });

    })

    describe("Partial Earned Beans", async function () {

      beforeEach(async function () {
        await this.season.siloSunrise(to6('100'))
        beginning_timestamp = await time.latest();
        season = await this.season.season();
      })
    
      
      it('single farmer harvests Earned Beans after mid harvest', async function () {
        await time.setNextBlockTimestamp(beginning_timestamp + 1800);
        // disable automine so they mine exactly 1800 seconds after
        await network.provider.send("evm_setAutomine", [false]);
        await this.silo.connect(user).plant(this.bean.address);
        await network.provider.send("evm_mine");
        await network.provider.send("evm_setAutomine", [true]);
  
        earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, season)
        expect(earned_beans[0]).to.eq(24997619);

        await time.setNextBlockTimestamp(beginning_timestamp + 3600);
        await network.provider.send("evm_setAutomine", [false]);
        await this.silo.connect(user).plant(this.bean.address);
        await network.provider.send("evm_mine");
        await network.provider.send("evm_setAutomine", [true]);
        earned_beans = await this.silo.getDeposit(userAddress,this.bean.address,season);
        expect(earned_beans[0]).to.eq(50e6);
      });

      it('issues correct earned Beans after multiple plants', async function () {

        await time.increase(800);
        await this.silo.connect(user).plant(this.bean.address);
        await time.increase(1000);
        await this.silo.connect(user).plant(this.bean.address);
        await time.increase(900);
        await this.silo.connect(user).plant(this.bean.address);
        await time.increase(449);
        await this.silo.connect(user).plant(this.bean.address);
        await time.increase(451);
        await this.silo.connect(user).plant(this.bean.address);

        earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, season);
        expect(earned_beans[0]).to.eq(50e6);

        await this.silo.connect(user2).plant(this.bean.address);
        earned_beans2 = await this.silo.getDeposit(user2Address, this.bean.address, season);
        expect(earned_beans2[0]).to.eq(50e6);
      });

      it('correctly issues amount after multiple different farmer plants', async function () {
        await time.setNextBlockTimestamp(beginning_timestamp + 1800);
        // disable automine so both plants can be done exactly 1800 seconds after timestamp start
        await network.provider.send("evm_setAutomine", [false]);
        await this.silo.connect(user).plant(this.bean.address);
        await this.silo.connect(user2).plant(this.bean.address);
        await network.provider.send("evm_mine");
        await network.provider.send("evm_setAutomine", [true]);

        earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, season)
        expect(earned_beans[0]).to.eq(24997619);
        earned_beans2 = await this.silo.getDeposit(user2Address, this.bean.address, season)
        expect(earned_beans2[0]).to.eq(25e6);

        beginning_timestamp += 3600;
        await time.setNextBlockTimestamp(beginning_timestamp);
        await this.season.siloSunrise(to6('100'))
        beginning_timestamp += 3600;
        await time.setNextBlockTimestamp(beginning_timestamp);

        await network.provider.send("evm_setAutomine", [false]);
        await this.silo.connect(user).plant(this.bean.address);
        await this.silo.connect(user2).plant(this.bean.address);
        await network.provider.send("evm_mine");
        await network.provider.send("evm_setAutomine", [true]);

        earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, season + 1)
        // 50e6 + (25e6 - 24997619) = 75002381
        expect(earned_beans[0]).to.eq(75002381);
        earned_beans2 = await this.silo.getDeposit(user2Address, this.bean.address, season + 1)
        expect(earned_beans2[0]).to.eq(75e6);
      })

      it('correctly issues Earned Beans from multiple seasons', async function () {
        await time.increase(3600);
        await this.season.siloSunrise(to6('100'))
        season = await this.season.season();
        await time.increase(3600); // 3600 seconds = 60 minutes = all beans issued
        expect(await this.silo.balanceOfEarnedBeans(userAddress)).to.eq(to6('100'));
        await this.silo.connect(user).plant(this.bean.address);
        expect((await this.silo.getDeposit(userAddress, this.bean.address, season))[0]).to.eq(100e6);
      });
    })
  });
});