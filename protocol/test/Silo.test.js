const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')

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
    this.diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', this.diamond.address)
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address);
    this.pair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pair);
    this.pegPair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pegPair);
    this.bean = await ethers.getContractAt('MockToken', contracts.bean);

    await this.pair.simulateTrade('2000', '2');
    await this.season.siloSunrise(0);
    await this.pair.faucet(userAddress, '1');
    await this.bean.mint(userAddress, '1000000000');
    await this.bean.mint(user2Address, '1000000000');
    await this.pair.connect(user).approve(this.silo.address, '100000000000');
    await this.pair.connect(user2).approve(this.silo.address, '100000000000');
    await this.bean.connect(user).approve(this.silo.address, '100000000000');
    await this.bean.connect(user2).approve(this.silo.address, '100000000000'); 
  });

  beforeEach (async function () {
    await this.season.resetAccount(userAddress)
    await this.season.resetAccount(user2Address)
    await this.season.resetAccount(ownerAddress)
    await this.pair.burnAllLP(this.silo.address);
    await this.pair.burnAllLP(userAddress);
    await this.pair.burnAllLP(user2Address);
    await this.pair.burnAllLP(ownerAddress);
    await this.season.resetState();
    await this.season.siloSunrise(0);
  });

  describe('deposit', function () {
    describe('single deposit', function () {
      beforeEach(async function () {
        this.result = await this.silo.connect(user).depositBeans('1000');
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo.totalDepositedBeans()).to.eq('1000');
        expect(await this.silo.totalSeeds()).to.eq('2000');
        expect(await this.silo.totalStalk()).to.eq('10000000');
      });
  
      it('properly updates the user balance', async function () {
        expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('2000');
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq('10000000');
      });
  
      it('properly adds the crate', async function () {
        expect(await this.silo.beanDeposit(userAddress, 2)).to.eq('1000');
      })
  
      it('emits Deposit event', async function () {
        await expect(this.result).to.emit(this.silo, 'BeanDeposit').withArgs(userAddress, 2, '1000');
      });
    });
  
    describe('2 deposits same season', function () {
      beforeEach(async function () {
        await this.silo.connect(user).depositBeans('1000');
        await this.silo.connect(user).depositBeans('1000');
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo.totalDepositedBeans()).to.eq('2000');
        expect(await this.silo.totalSeeds()).to.eq('4000');
        expect(await this.silo.totalStalk()).to.eq('20000000');
      });
      it('properly updates the user balance', async function () {
        expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('4000');
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq('20000000');
      });
  
      it('properly adds the crate', async function () {
        expect(await this.silo.beanDeposit(userAddress, 2)).to.eq('2000');
      });
    });
  
    describe('2 deposits 2 users', function () {
      beforeEach(async function () {
        await this.silo.connect(user).depositBeans('1000');
        await this.silo.connect(user2).depositBeans('1000');
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo.totalDepositedBeans()).to.eq('2000');
        expect(await this.silo.totalSeeds()).to.eq('4000');
        expect(await this.silo.totalStalk()).to.eq('20000000');
      });
  
      it('properly updates the user balance', async function () {
        expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('2000');
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq('10000000');
      });
      it('properly updates the user2 balance', async function () {
        expect(await this.silo.balanceOfSeeds(user2Address)).to.eq('2000');
        expect(await this.silo.balanceOfStalk(user2Address)).to.eq('10000000');
      });
  
      it('properly adds the crate', async function () {
        expect(await this.silo.beanDeposit(userAddress, 2)).to.eq('1000');
        expect(await this.silo.beanDeposit(user2Address, 2)).to.eq('1000');
      });
    });
  
    describe('1 deposit with step', function () {
      beforeEach(async function () {
        await this.silo.connect(user).depositBeans('1000');
        await this.season.siloSunrise(0);
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo.totalDepositedBeans()).to.eq('1000');
        expect(await this.silo.totalSeeds()).to.eq('2000');
        expect(await this.silo.totalStalk()).to.eq('10000000');
      });
      it('properly updates the user balance', async function () {
        expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('2000');
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq('10000000');
      });
    });
    describe('2 deposits different seasons', function () {
      beforeEach(async function () {
        await this.silo.connect(user).depositBeans('1000');
        await this.season.siloSunrise(0);
        await this.silo.connect(user).depositBeans('1000');
        await this.season.siloSunrise(0);
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo.totalDepositedBeans()).to.eq('2000');
        expect(await this.silo.totalSeeds()).to.eq('4000');
        expect(await this.silo.totalStalk()).to.eq('20002000');
      });
      it('properly updates the user balance', async function () {
        expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('4000');
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq('20002000');
      });
  
      it('properly adds the crate', async function () {
        expect(await this.silo.beanDeposit(userAddress, 2)).to.eq('1000');
        expect(await this.silo.beanDeposit(userAddress, 3)).to.eq('1000');
      });
    });
  });
  describe('withdraw', function () {
    describe('withdraw 1 bean crate', function () {
      beforeEach(async function () {
        await this.silo.connect(user).depositBeans('1000');
        this.result = await this.silo.connect(user).withdrawBeans([2],['1000']);
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo.totalDepositedBeans()).to.eq('0');
        expect(await this.silo.totalStalk()).to.eq('0');
        expect(await this.silo.totalSeeds()).to.eq('0');
        expect(await this.silo.totalWithdrawnBeans()).to.eq('1000');
      });
      it('properly updates the user balance', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq('0');
        expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('0');
      });
      it('properly removes the crate', async function () {
        expect(await this.silo.beanDeposit(user2Address, 2)).to.eq('0');
      });
  
      it('emits BeanRemove event', async function () {
        await expect(this.result).to.emit(this.silo, 'BeanRemove').withArgs(userAddress, [2], ['1000'], '1000');
        await expect(this.result).to.emit(this.silo, 'BeanRemove').withArgs(userAddress, [2], ['1000'], '1000');
      });
    });
    describe('withdraw part of a bean crate', function () {
      beforeEach(async function () {
        await this.silo.connect(user).depositBeans('2000');
        await this.silo.connect(user).withdrawBeans([2],['1000']);
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo.totalDepositedBeans()).to.eq('1000');
        expect(await this.silo.totalStalk()).to.eq('10000000');
        expect(await this.silo.totalSeeds()).to.eq('2000');
        expect(await this.silo.totalWithdrawnBeans()).to.eq('1000');
      });
      it('properly updates the user balance', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq('10000000');
        expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('2000');
      });
      it('properly removes the crate', async function () {
        expect(await this.silo.beanDeposit(userAddress, 2)).to.eq('1000');
      });
    });
    describe('2 bean crates', function () {
      beforeEach(async function () {
        await this.silo.connect(user).depositBeans('1000');
        await this.season.siloSunrise(0);
        await this.silo.connect(user).depositBeans('1000');
        await this.silo.connect(user).withdrawBeans([2,3],['1000','1000']);
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo.totalDepositedBeans()).to.eq('0');
        expect(await this.silo.totalStalk()).to.eq('0');
        expect(await this.silo.totalSeeds()).to.eq('0');
        expect(await this.silo.totalWithdrawnBeans()).to.eq('2000');
      });
      it('properly updates the user balance', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq('0');
        expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('0');
      });
      it('properly removes the crate', async function () {
        expect(await this.silo.beanDeposit(userAddress, 2)).to.eq(0);
        expect(await this.silo.beanDeposit(userAddress, 3)).to.eq(0);
      });
    });
  });
  
  describe('supply increase', function () {
    describe('1 supply increase', function () {
      beforeEach(async function () {
        await this.silo.connect(user).depositBeans('1000');
        await this.season.siloSunrise(100);
      });
      it('properly updates the total balances', async function () {
        expect(await this.silo.supplyIncreases()).to.eq(1);
        expect(await this.silo.unclaimedRoots()).to.eq('10000000000000000000');
        expect(await this.silo.totalFarmableBeans()).to.eq('100');
        expect(await this.silo.totalFarmableStalk()).to.eq('0');
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo.totalDepositedBeans()).to.eq('1100');
        expect(await this.silo.totalStalk()).to.eq('11000000');
        expect(await this.silo.totalSeeds()).to.eq('2200');
        expect(await this.silo.lastSupplyIncreases(userAddress)).to.eq(0);
  
      });
      it('properly updates the user balance', async function () {
        expect(await this.silo.balanceOfFarmableBeans(userAddress)).to.eq('100');
        expect(await this.silo.balanceOfFarmableStalk(userAddress)).to.eq('0');
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq('11000000');
      });
    });
  
    describe('supply increase and update silo', function () {
      beforeEach(async function () {
        await this.silo.connect(user).depositBeans('1000');
        await this.season.siloSunrise(100);
        await this.silo.updateSilo(userAddress);
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo.supplyIncreases()).to.eq(1);
        expect(await this.silo.unclaimedRoots()).to.eq('0');
        expect(await this.silo.totalFarmableBeans()).to.eq('0');
        expect(await this.silo.totalFarmableStalk()).to.eq('0');
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo.totalDepositedBeans()).to.eq('1100');
        expect(await this.silo.totalStalk()).to.eq('11002000');
        expect(await this.silo.totalSeeds()).to.eq('2200');
  
      });
      it('properly updates the user balance', async function () {
        expect(await this.silo.balanceOfFarmableBeans(userAddress)).to.eq('0');
        expect(await this.silo.balanceOfFarmableStalk(userAddress)).to.eq('0');
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq('11002000');
        expect(await this.silo.lastSupplyIncreases(userAddress)).to.eq(1);
      });
  
      it('properly updates the user balance', async function () {
        expect(await this.silo.beanDeposit(userAddress,3)).to.eq('100');
      });
    });
  
    describe('2 supply increase', function () {
      beforeEach(async function () {
        await this.silo.connect(user).depositBeans('1000');
        await this.season.siloSunrise(100);
        await this.season.siloSunrise(100);
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo.supplyIncreases()).to.eq(2);
        expect(await this.silo.unclaimedRoots()).to.eq('20000000000000000000');
        expect(await this.silo.totalFarmableBeans()).to.eq('200');
        expect(await this.silo.totalFarmableStalk()).to.eq('200');
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo.totalDepositedBeans()).to.eq('1200');
        expect(await this.silo.totalSeeds()).to.eq('2400');
        expect(await this.silo.totalStalk()).to.eq('12000200');
  
      });
      it('properly updates the user balance', async function () {
        expect(await this.silo.balanceOfFarmableBeans(userAddress)).to.eq('200');
        expect(await this.silo.balanceOfFarmableStalk(userAddress)).to.eq('0');
        expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('2400');
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq('12000000');
      });
    });
  
    describe('2 supply increases and update silo ', function () {
      beforeEach(async function () {
        await this.silo.connect(user).depositBeans('1000');
        await this.season.siloSunrise(100);
        await this.season.siloSunrise(100);
        await this.silo.updateSilo(userAddress);
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo.supplyIncreases()).to.eq(2);
        expect(await this.silo.unclaimedRoots()).to.eq('0');
        expect(await this.silo.totalFarmableBeans()).to.eq('0');
        expect(await this.silo.totalFarmableStalk()).to.eq('200');
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo.totalDepositedBeans()).to.eq('1200');
        expect(await this.silo.totalStalk()).to.eq('12004200');
        expect(await this.silo.totalSeeds()).to.eq('2400');
  
      });

      it('properly updates the user balance', async function () {
        expect(await this.silo.balanceOfFarmableBeans(userAddress)).to.eq('0');
        expect(await this.silo.balanceOfFarmableStalk(userAddress)).to.eq('0');
        expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('2400');
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq('12004000');
        expect(await this.silo.lastSupplyIncreases(userAddress)).to.eq(2);
      });
  
      it('properly updates the user balance', async function () {
        expect(await this.silo.beanDeposit(userAddress,4)).to.eq('200');
      });
    });

    describe('3 supply increase', function () {
      beforeEach(async function () {
        await this.silo.connect(user).depositBeans('1000');
        await this.season.siloSunrise(100);
        await this.season.siloSunrise(100);
        await this.season.siloSunrise(100);
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo.supplyIncreases()).to.eq(3);
        expect(await this.silo.unclaimedRoots()).to.eq('30000000000000000000');
        expect(await this.silo.totalFarmableBeans()).to.eq('300');
        expect(await this.silo.totalFarmableStalk()).to.eq('600');
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo.totalDepositedBeans()).to.eq('1300');
        expect(await this.silo.totalSeeds()).to.eq('2600');
        expect(await this.silo.totalStalk()).to.eq('13000600');
  
      });
      it('properly updates the user balance', async function () {
        expect(await this.silo.balanceOfFarmableBeans(userAddress)).to.eq('300');
        expect(await this.silo.balanceOfFarmableStalk(userAddress)).to.eq('600');
        expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('2600');
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq('13000600');
      });
    });

    describe('3 supply increase and an update silo', function () {
      beforeEach(async function () {
        await this.silo.connect(user).depositBeans('1000');
        await this.season.siloSunrise(100);
        await this.season.siloSunrise(100);
        await this.season.siloSunrise(100);
        await this.silo.updateSilo(userAddress);
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo.supplyIncreases()).to.eq(3);
        expect(await this.silo.unclaimedRoots()).to.eq('0');
        expect(await this.silo.totalFarmableBeans()).to.eq('0');
        expect(await this.silo.totalFarmableStalk()).to.eq('0');
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo.totalDepositedBeans()).to.eq('1300');
        expect(await this.silo.totalSeeds()).to.eq('2600');
        expect(await this.silo.totalStalk()).to.eq('13006600');
  
      });
      it('properly updates the user balance', async function () {
        expect(await this.silo.balanceOfFarmableBeans(userAddress)).to.eq('0');
        expect(await this.silo.balanceOfFarmableStalk(userAddress)).to.eq('0');
        expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('2600');
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq('13006600');
      });
  
      it('properly updates the user balance', async function () {
        expect(await this.silo.beanDeposit(userAddress,4)).to.eq('300');
      });
    });

    describe('2 supply increases and update silo in the middle', function () {
      beforeEach(async function () {
        await this.silo.connect(user).depositBeans('1000');
        await this.season.siloSunrise(100);
        await this.silo.updateSilo(userAddress);
        await this.season.siloSunrise(100);
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo.supplyIncreases()).to.eq(2);
        expect(await this.silo.unclaimedRoots()).to.eq('10001818181818181818');
        expect(await this.silo.totalFarmableBeans()).to.eq('100');
        expect(await this.silo.totalFarmableStalk()).to.eq('0');
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo.totalDepositedBeans()).to.eq('1200');
        expect(await this.silo.totalStalk()).to.eq('12002000');
        expect(await this.silo.totalSeeds()).to.eq('2400');
  
      });

      it('properly updates the user balance', async function () {
        expect(await this.silo.balanceOfFarmableBeans(userAddress)).to.eq('100');
        expect(await this.silo.balanceOfFarmableStalk(userAddress)).to.eq('0');
        expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('2400');
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq('12002000');
        expect(await this.silo.lastSupplyIncreases(userAddress)).to.eq(1);
      });
  
      it('properly updates the user balance', async function () {
        expect(await this.silo.beanDeposit(userAddress,3)).to.eq('100');
      });
    });

    describe('3 supply increase and an update silo in the middle', function () {
      beforeEach(async function () {
        await this.silo.connect(user).depositBeans('1000');
        await this.season.siloSunrise(100);
        await this.season.siloSunrise(100);
        await this.silo.updateSilo(userAddress);
        await this.season.siloSunrise(100);
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo.supplyIncreases()).to.eq(3);
        expect(await this.silo.unclaimedRoots()).to.eq('10003333277778703688');
        expect(await this.silo.totalFarmableBeans()).to.eq('100');
        expect(await this.silo.totalFarmableStalk()).to.eq('200');
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo.totalDepositedBeans()).to.eq('1300');
        expect(await this.silo.totalSeeds()).to.eq('2600');
        expect(await this.silo.totalStalk()).to.eq('13004200');
  
      });
      it('properly updates the user balance', async function () {
        expect(await this.silo.balanceOfFarmableBeans(userAddress)).to.eq('100');
        expect(await this.silo.balanceOfFarmableStalk(userAddress)).to.eq('200');
        expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('2600');
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq('13004200');
      });
  
      it('properly updates the user balance', async function () {
        expect(await this.silo.beanDeposit(userAddress,4)).to.eq('200');
      });
    });

  describe('2 supply increases with alternating updates', function () {
    beforeEach(async function () {
      await this.silo.connect(user).depositBeans('1000');
      await this.season.siloSunrise(100);
      await this.silo.updateSilo(userAddress);
      await this.season.siloSunrise(100);
      await this.silo.updateSilo(userAddress);
    });

    it('properly updates the total balances', async function () {
      expect(await this.silo.supplyIncreases()).to.eq(2);
      expect(await this.silo.unclaimedRoots()).to.eq('0');
      expect(await this.silo.totalFarmableBeans()).to.eq('0');
      expect(await this.silo.totalFarmableStalk()).to.eq('0');
    });

    it('properly updates the total balances', async function () {
      expect(await this.silo.totalDepositedBeans()).to.eq('1200');
      expect(await this.silo.totalStalk()).to.eq('12004200');
      expect(await this.silo.totalSeeds()).to.eq('2400');

    });

    it('properly updates the user balance', async function () {
      expect(await this.silo.balanceOfFarmableBeans(userAddress)).to.eq('0');
      expect(await this.silo.balanceOfFarmableStalk(userAddress)).to.eq('0');
      expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('2400');
      expect(await this.silo.balanceOfStalk(userAddress)).to.eq('12004200');
      expect(await this.silo.lastSupplyIncreases(userAddress)).to.eq(2);
    });

    it('properly updates the user balance', async function () {
      expect(await this.silo.beanDeposit(userAddress,3)).to.eq('100');
      expect(await this.silo.beanDeposit(userAddress,4)).to.eq('100');
    });
  });

  describe('2 users with supply increase and 1 update', function () {
    beforeEach(async function () {
      await this.silo.connect(user).depositBeans('1000');
      await this.silo.connect(user2).depositBeans('1000');
      await this.season.siloSunrise(100);
      await this.silo.updateSilo(userAddress);
    });

    it('properly updates the total balances', async function () {
      expect(await this.silo.supplyIncreases()).to.eq(1);
      expect(await this.silo.unclaimedRoots()).to.eq('10000000000000000000');
      expect(await this.silo.totalFarmableBeans()).to.eq('50');
      expect(await this.silo.totalFarmableStalk()).to.eq('0');
    });

    it('properly updates the total balances', async function () {
      expect(await this.silo.totalDepositedBeans()).to.eq('2100');
      expect(await this.silo.totalStalk()).to.eq('21002000');
      expect(await this.silo.totalSeeds()).to.eq('4200');

    });

    it('properly updates the user balance', async function () {
      expect(await this.silo.balanceOfFarmableBeans(userAddress)).to.eq('0');
      expect(await this.silo.balanceOfFarmableStalk(userAddress)).to.eq('0');
      expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('2100');
      expect(await this.silo.balanceOfStalk(userAddress)).to.eq('10502000');
      expect(await this.silo.lastSupplyIncreases(userAddress)).to.eq(1);
    });

    it('properly updates the user2 balance', async function () {
      expect(await this.silo.balanceOfFarmableBeans(user2Address)).to.eq('50');
      expect(await this.silo.balanceOfFarmableStalk(user2Address)).to.eq('0');
      expect(await this.silo.balanceOfSeeds(user2Address)).to.eq('2100');
      expect(await this.silo.balanceOfStalk(user2Address)).to.eq('10500000');
      expect(await this.silo.lastSupplyIncreases(user2Address)).to.eq(0);
    });

    it('properly updates the user balance', async function () {
      expect(await this.silo.beanDeposit(userAddress,3)).to.eq('50');
    });
  });

  describe('2 users with supply increase and both update', function () {
    beforeEach(async function () {
      await this.silo.connect(user).depositBeans('1000');
      await this.silo.connect(user2).depositBeans('1000');
      await this.season.siloSunrise(100);
      await this.silo.updateSilo(userAddress);
      await this.silo.updateSilo(user2Address);
    });

    it('properly updates the total balances', async function () {
      expect(await this.silo.supplyIncreases()).to.eq(1);
      expect(await this.silo.unclaimedRoots()).to.eq('0');
      expect(await this.silo.totalFarmableBeans()).to.eq('0');
      expect(await this.silo.totalFarmableStalk()).to.eq('0');
    });

    it('properly updates the total balances', async function () {
      expect(await this.silo.totalDepositedBeans()).to.eq('2100');
      expect(await this.silo.totalStalk()).to.eq('21004000');
      expect(await this.silo.totalSeeds()).to.eq('4200');

    });

    it('properly updates the user balance', async function () {
      expect(await this.silo.balanceOfFarmableBeans(userAddress)).to.eq('0');
      expect(await this.silo.balanceOfFarmableStalk(userAddress)).to.eq('0');
      expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('2100');
      expect(await this.silo.balanceOfStalk(userAddress)).to.eq('10502000');
      expect(await this.silo.lastSupplyIncreases(userAddress)).to.eq(1);
    });

    it('properly updates the user2 balance', async function () {
      expect(await this.silo.balanceOfFarmableBeans(user2Address)).to.eq('0');
      expect(await this.silo.balanceOfFarmableStalk(user2Address)).to.eq('0');
      expect(await this.silo.balanceOfSeeds(user2Address)).to.eq('2100');
      expect(await this.silo.balanceOfStalk(user2Address)).to.eq('10502000');
      expect(await this.silo.lastSupplyIncreases(user2Address)).to.eq(1);
    });

    it('properly updates the user balance', async function () {
      expect(await this.silo.beanDeposit(userAddress,3)).to.eq('50');
      expect(await this.silo.beanDeposit(user2Address,3)).to.eq('50');
    });
  });

  describe('2 users with supply increase and both update', function () {
    beforeEach(async function () {
      await this.silo.connect(user).depositBeans('1000');
      await this.silo.connect(user2).depositBeans('1000');
      await this.season.siloSunrise(100);
      await this.silo.updateSilo(userAddress);
      await this.season.siloSunrise(100);
      await this.silo.updateSilo(user2Address);
    });

    it('properly updates the total balances', async function () {
      expect(await this.silo.supplyIncreases()).to.eq(2);
      expect(await this.silo.unclaimedRoots()).to.eq('10001904761904761904');
      expect(await this.silo.totalFarmableBeans()).to.eq('51');
      expect(await this.silo.totalFarmableStalk()).to.eq('100');
    });

    it('properly updates the total balances', async function () {
      expect(await this.silo.totalDepositedBeans()).to.eq('2200');
      expect(await this.silo.totalStalk()).to.eq('22006100');
      expect(await this.silo.totalSeeds()).to.eq('4400');

    });

    it('properly updates the user balance', async function () {
      expect(await this.silo.balanceOfFarmableBeans(userAddress)).to.eq('51');
      expect(await this.silo.balanceOfFarmableStalk(userAddress)).to.eq('0');
      expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('2202');
      expect(await this.silo.balanceOfStalk(userAddress)).to.eq('11012000');
      expect(await this.silo.lastSupplyIncreases(userAddress)).to.eq(1);
    });

    it('properly updates the user2 balance', async function () {
      expect(await this.silo.balanceOfFarmableBeans(user2Address)).to.eq('0');
      expect(await this.silo.balanceOfFarmableStalk(user2Address)).to.eq('0');
      expect(await this.silo.balanceOfSeeds(user2Address)).to.eq('2198');
      expect(await this.silo.balanceOfStalk(user2Address)).to.eq('10994000');
      expect(await this.silo.lastSupplyIncreases(user2Address)).to.eq(2);
    });

    it('properly updates the user balance', async function () {
      expect(await this.silo.beanDeposit(userAddress,3)).to.eq('50');
    });
  });
});

  describe('convert', function () {
    beforeEach(async function () {
      await this.pair.set('10000', '10', '1')
      await this.pair.faucet(user2Address, '9');
      await this.silo.connect(user).depositBeans('1000');
    })

    describe('crate balance too low', function () {
      it('reverts', async function () {
        await expect(this.silo.connect(user).convertAddAndDepositLP('0',['1500','900','1'], [2], [1500],{value: '1'})).to.be.revertedWith('Silo: Crate balance too low.');
      });
    })

    describe('immediate convert', function () {
      beforeEach(async function () {
        await this.silo.connect(user).convertAddAndDepositLP('0',['1000','900','1'], [2], [1000],{value: '1'});
      })
      it('properly updates the total balances', async function () {
        expect(await this.silo.totalDepositedLP()).to.eq('1');
        expect(await this.silo.totalDepositedBeans()).to.eq('0');
        expect(await this.silo.totalSeeds()).to.eq('8000');
        expect(await this.silo.totalStalk()).to.eq('20000000');
      });
      it('properly updates the user balance', async function () {
        expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('8000');
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq('20000000')
      });
      it('properly updates the user total', async function () {
        expect(await this.silo.totalSeeds()).to.eq('8000');
        expect(await this.silo.totalStalk()).to.eq('20000000')
      });
      it('properly withdraws the bean crate', async function () {
        expect(await this.silo.beanDeposit(userAddress, 2)).to.eq('0');
      });
      it('properly deposits the lp crate', async function () {
        const lpCrate = await this.silo.lpDeposit(userAddress, 2);
        expect(lpCrate[0]).to.eq('1');
        expect(lpCrate[1]).to.eq('8000');
      });
    });
    describe('convert 1 crate after a lot of seasons', function () {
      beforeEach(async function () {
        await this.season.siloSunrises('10');
        await this.silo.connect(user).convertAddAndDepositLP('0',['1000','900','1'], [2], [1000],{value: '1'});
      })
      it('properly updates the user balance', async function () {
        expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('8000');
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq('20016000')
      });
      it('properly updates the user total', async function () {
        expect(await this.silo.totalSeeds()).to.eq('8000');
        expect(await this.silo.totalStalk()).to.eq('20016000')
      });
      it('properly withdraws the bean crate', async function () {
        expect(await this.silo.beanDeposit(userAddress, 2)).to.eq('0');
      });
      it('properly deposits the lp crate', async function () {
        const lpCrate = await this.silo.lpDeposit(userAddress, 10);
        expect(lpCrate[0]).to.eq('1');
        expect(lpCrate[1]).to.eq('8000');
      });
    });
    //
    describe('convert 2 crate 1 before after a lot of seasons', function () {
      beforeEach(async function () {
        await this.season.siloSunrises('10');
        await this.silo.connect(user).depositBeans('500');
        await this.silo.connect(user).convertAddAndDepositLP('0',['1000','900','1'], [2,12], [500,500],{value: '1'});
      })
      it('properly updates the user balance', async function () {
        expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('9000');
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq('25018000')
      });
      it('properly updates the user total', async function () {
        expect(await this.silo.totalSeeds()).to.eq('9000');
        expect(await this.silo.totalStalk()).to.eq('25018000')
      });
      it('properly withdraws the bean crate', async function () {
        expect(await this.silo.beanDeposit(userAddress, 2)).to.eq('500');
      });
      it('properly deposits the lp crate', async function () {
        const lpCrate = await this.silo.lpDeposit(userAddress, 11);
        expect(lpCrate[0]).to.eq('1');
        expect(lpCrate[1]).to.eq('8000');
      });
      it('properly removese the bean crate', async function () {
      expect(await this.silo.beanDeposit(userAddress, 2)).to.eq('500');
      expect(await this.silo.beanDeposit(userAddress, 12)).to.eq('0');
      });
    });
  });
});
