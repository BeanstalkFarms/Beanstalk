const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deploy } = require('../scripts/deploy.js')
const { ConvertEncoder } = require('./utils/encoder.js')

let user,user2,owner;
let userAddress, ownerAddress, user2Address;
describe('Uniswap Convert', function () {
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
    this.convert = await ethers.getContractAt('ConvertFacet', this.diamond.address);
    this.claim = await ethers.getContractAt('MockClaimFacet', this.diamond.address)
    this.pair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pair);
    this.pegPair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pegPair);
    this.bean = await ethers.getContractAt('MockToken', contracts.bean);
    this.weth = await ethers.getContractAt('MockToken', contracts.weth)

    await this.pair.set('10000', '40000', '1');
    await this.pegPair.simulateTrade('20000', '20000');
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
    await this.pair.burnTokens(this.bean.address);
    await this.pair.burnTokens(this.weth.address);
    await this.season.resetState();
    await this.season.siloSunrise(0);
  });

  describe('calclates beans to peg', async function () {
    it('p > 1', async function () {
      expect(await this.convert.beansToPeg(this.pair.address)).to.be.equal('30028');
    });

    it('p = 1', async function () {
      await this.pair.simulateTrade('20000', '20000');
      expect(await this.convert.beansToPeg(this.pair.address)).to.be.equal('0');
    });

    it('p < 1', async function () {
      await this.pair.simulateTrade('40000', '10000');
      expect(await this.convert.beansToPeg(this.pair.address)).to.be.equal('0');
    });
  });

  describe('calclates lp to peg', async function () {
    it('p > 1', async function () {
      await this.pair.simulateTrade('10000', '40000');
      await this.pair.faucet(this.silo.address, '10000')
      expect(await this.convert.lpToPeg(this.pair.address)).to.be.equal('0');
    });

    it('p = 1', async function () {
      await this.pair.faucet(this.silo.address, '10000')
      await this.pair.simulateTrade('20000', '20000');
      expect(await this.convert.lpToPeg(this.pair.address)).to.be.equal('0');
    });

    it('p < 1', async function () {
      await this.pair.simulateTrade('40000', '10000');
      await this.pair.faucet(this.silo.address, '10000')
      expect(await this.convert.lpToPeg(this.pair.address)).to.be.equal('5003');
    });
  })

  describe('convert beans to lp', async function () {

    describe('revert', async function () {      
      it('not enough LP', async function () {
        await this.silo.connect(user).depositBeans('20000');
        await this.pair.simulateTrade('10000', '40000');
        await expect(this.convert.connect(user).convert(ConvertEncoder.convertBeansToUniswapLP('5000','2'),['2'],['20000']))
          .to.be.revertedWith('Convert: Not enough LP.');
        await this.pair.set('10000', '40000', '1');
      });

      it('p >= 1', async function () {
        await this.silo.connect(user).depositBeans('1000');
        await this.pair.simulateTrade('20000', '20000');
        await expect(this.convert.connect(user).convert(ConvertEncoder.convertBeansToUniswapLP('100','1'),['1'],['1000']))
          .to.be.revertedWith('Convert: P must be > 1.');
      });
    });

    describe('below max', function () {
      beforeEach(async function () {
        await this.silo.connect(user).depositBeans('1000');
        await this.pair.simulateTrade('10000', '40000');
        this.result = await this.convert.connect(user).convert(ConvertEncoder.convertBeansToUniswapLP('1000','1'),['2'],['1000']);
      });
  
      it('properly updates total values', async function () {
        expect(await this.silo.totalDepositedBeans()).to.eq('47');
        expect(await this.silo.totalSeeds()).to.eq('3906');
        expect(await this.silo.totalStalk()).to.eq('10000000');
      });

      it('properly updates user deposits', async function () {
        expect(await this.silo.beanDeposit(userAddress, 2)).to.eq('47');
        const lpDeposit = await this.silo.lpDeposit(userAddress, 2);
        expect(lpDeposit[0]).to.eq('1');
        expect(lpDeposit[1]).to.eq('3812');
      });

      it('emits events', async function () {
        await expect(this.result).to.emit(this.silo, 'BeanRemove')
          .withArgs(userAddress, [2], ['953'], '953');
        await expect(this.result).to.emit(this.silo, 'LPDeposit')
          .withArgs(userAddress, 2, '1', '3812');
      });
    });

    describe('above max', function () {
      beforeEach(async function () {
        await this.silo.connect(user).depositBeans('20000');
        await this.pair.simulateTrade('19000', '21000');
        this.result = await this.convert.connect(user).convert(ConvertEncoder.convertBeansToUniswapLP('10000','1'),['2'],['20000']);
      });
  
      it('properly updates total values', async function () {
        expect(await this.silo.totalDepositedBeans()).to.eq('18098');
        expect(await this.silo.totalSeeds()).to.eq('43804');
        expect(await this.silo.totalStalk()).to.eq('200000000');
      });

      it('properly updates user deposits', async function () {
        expect(await this.silo.beanDeposit(userAddress, 2)).to.eq('18098');
        const lpDeposit = await this.silo.lpDeposit(userAddress, 2);
        expect(lpDeposit[0]).to.eq('1');
        expect(lpDeposit[1]).to.eq('7608');
      });

      it('emits events', async function () {
        await expect(this.result).to.emit(this.silo, 'BeanRemove')
          .withArgs(userAddress, [2], ['1902'], '1902');
        await expect(this.result).to.emit(this.silo, 'LPDeposit')
          .withArgs(userAddress, 2, '1', '7608');
      });
    });

    describe('after one season', function () {
      beforeEach(async function () {
        await this.silo.connect(user).depositBeans('1000');
        await this.pair.simulateTrade('10000', '40000');
        await this.season.siloSunrise(0);
        this.result = await this.convert.connect(user).convert(ConvertEncoder.convertBeansToUniswapLP('1000','1'),['2'],['1000']);
      });
  
      it('properly updates total values', async function () {
        expect(await this.silo.totalDepositedBeans()).to.eq('47');
        expect(await this.silo.totalSeeds()).to.eq('3906');
        expect(await this.silo.totalStalk()).to.eq('10000094');
      });

      it('properly updates user deposits', async function () {
        expect(await this.silo.beanDeposit(userAddress, 2)).to.eq('47');
        const lpDeposit = await this.silo.lpDeposit(userAddress, 3);
        expect(lpDeposit[0]).to.eq('1');
        expect(lpDeposit[1]).to.eq('3812');
      });

      it('emits events', async function () {
        await expect(this.result).to.emit(this.silo, 'BeanRemove')
          .withArgs(userAddress, [2], ['953'], '953');
        await expect(this.result).to.emit(this.silo, 'LPDeposit')
          .withArgs(userAddress, 3, '1', '3812');
      });
    });

    describe('after multiple seasons', function () {
      beforeEach(async function () {
        await this.silo.connect(user).depositBeans('1000');
        await this.pair.simulateTrade('10000', '40000');
        await this.season.siloSunrise(0);
        await this.season.siloSunrise(0);
        this.result = await this.convert.connect(user).convert(ConvertEncoder.convertBeansToUniswapLP('1000','1'),['2'],['1000']);
      });
  
      it('properly updates total values', async function () {
        expect(await this.silo.totalDepositedBeans()).to.eq('47');
        expect(await this.silo.totalSeeds()).to.eq('3906');
        expect(await this.silo.totalStalk()).to.eq('10004000');
      });

      it('properly updates user deposits', async function () {
        expect(await this.silo.beanDeposit(userAddress, 2)).to.eq('47');
        const lpDeposit = await this.silo.lpDeposit(userAddress, 3);
        expect(lpDeposit[0]).to.eq('1');
        expect(lpDeposit[1]).to.eq('3812');
      });

      it('emits events', async function () {
        await expect(this.result).to.emit(this.silo, 'BeanRemove')
          .withArgs(userAddress, [2], ['953'], '953');
        await expect(this.result).to.emit(this.silo, 'LPDeposit')
          .withArgs(userAddress, 3, '1', '3812');
      });
    });

    describe('multiple deposits', function () {
      beforeEach(async function () {
        await this.silo.connect(user).depositBeans('1000');
        await this.pair.simulateTrade('10000', '40000');
        await this.season.siloSunrise(0);
        await this.silo.connect(user).depositBeans('1000');
        this.result = await this.convert.connect(user).convert(ConvertEncoder.convertBeansToUniswapLP('1000','1'),['2','3'],['500','500']);
      });
  
      it('properly updates total values', async function () {
        expect(await this.silo.totalDepositedBeans()).to.eq('1047');
        expect(await this.silo.totalSeeds()).to.eq('5906');
        expect(await this.silo.totalStalk()).to.eq('20001000');
      });

      it('properly updates user deposits', async function () {
        expect(await this.silo.beanDeposit(userAddress, 2)).to.eq('500');
        const lpDeposit = await this.silo.lpDeposit(userAddress, 3);
        expect(lpDeposit[0]).to.eq('1');
        expect(lpDeposit[1]).to.eq('3812');
      });

      it('emits events', async function () {
        await expect(this.result).to.emit(this.silo, 'BeanRemove')
          .withArgs(userAddress, [2,3], ['500','453'], '953');
        await expect(this.result).to.emit(this.silo, 'LPDeposit')
          .withArgs(userAddress, 3, '1', '3812');
      });
    });
  });

  describe('convert lp to beans', function () {
    beforeEach(async function () {
      await this.pair.faucet(this.silo.address, '997')
      await this.pair.faucet(userAddress, '3');
      await this.bean.mint(this.pair.address, '400000');
      await this.weth.mint(this.pair.address, '100000');
      await this.pair.set('40000', '10000', '1');
    });

    describe('revert', async function () {
      it('p >= 1', async function () {
        await this.pair.simulateTrade('10000', '40000');
        await this.silo.connect(user).depositLP('1');
        await expect(this.convert.connect(user).convert(ConvertEncoder.convertUniswapLPToBeans('1','100'),['2'],['1']))
          .to.be.revertedWith('Convert: P must be < 1.');
      });
      it('beans below min', async function () {
        await this.pair.set('40000', '10000', '1');
        await this.silo.connect(user).depositLP('1');
        await expect(this.convert.connect(user).convert(ConvertEncoder.convertUniswapLPToBeans('1','1000'),['2'],['1']))
          .to.be.revertedWith('Convert: Not enough Beans.');
      });
    })

    describe('below max', async function () {
      beforeEach(async function () {
        await this.pair.simulateTrade('40000', '10000');
        await this.silo.connect(user).depositLP('1');
        this.result = await this.convert.connect(user).convert(ConvertEncoder.convertUniswapLPToBeans('1','100'),['2'],['1']);
      });
  
      it('properly updates total values', async function () {
        expect(await this.silo.totalDepositedLP()).to.eq('0');
        expect(await this.silo.totalDepositedBeans()).to.eq('796');
        expect(await this.silo.totalSeeds()).to.eq('1592');
        expect(await this.silo.totalStalk()).to.eq('7960000');
      });

      it('properly updates user deposits', async function () {
        expect(await this.silo.beanDeposit(userAddress, 2)).to.eq('796');
        const lpDeposit = await this.silo.lpDeposit(userAddress, 2);
        expect(lpDeposit[0]).to.eq('0');
        expect(lpDeposit[1]).to.eq('0');
      });

      it('emits events', async function () {
        await expect(this.result).to.emit(this.silo, 'LPRemove')
          .withArgs(userAddress, [2], ['1'], '1');
        await expect(this.result).to.emit(this.silo, 'BeanDeposit')
          .withArgs(userAddress, 2, '796');
      });
    });

    describe('after season', async function () {
      beforeEach(async function () {
        await this.pair.simulateTrade('200000', '50000');
        await this.silo.connect(user).depositLP('1');
        await this.season.siloSunrise(0);
        this.result = await this.convert.connect(user).convert(ConvertEncoder.convertUniswapLPToBeans('1','100'),['2'],['1']);
      });
  
      it('properly updates total values', async function () {
        expect(await this.silo.totalDepositedLP()).to.eq('0');
        expect(await this.silo.totalDepositedBeans()).to.eq('799');
        expect(await this.silo.totalSeeds()).to.eq('1598');
        expect(await this.silo.totalStalk()).to.eq('7991598');
      });

      it('properly updates user deposits', async function () {
        expect(await this.silo.beanDeposit(userAddress, 2)).to.eq('799');
        const lpDeposit = await this.silo.lpDeposit(userAddress, 2);
        expect(lpDeposit[0]).to.eq('0');
        expect(lpDeposit[1]).to.eq('0');
      });

      it('emits events', async function () {
        await expect(this.result).to.emit(this.silo, 'LPRemove')
          .withArgs(userAddress, [2], ['1'], '1');
        await expect(this.result).to.emit(this.silo, 'BeanDeposit')
          .withArgs(userAddress, 2, '799');
      });
    });

    describe('multiple deposits', async function () {
      beforeEach(async function () {
        await this.pair.simulateTrade('200000', '50000');
        await this.silo.connect(user).depositLP('2');
        await this.season.siloSunrise(0);
        await this.silo.connect(user).depositLP('1');
        this.result = await this.convert.connect(user).convert(ConvertEncoder.convertUniswapLPToBeans('2','100'),['3','2'],['1','1']);
      });
  
      it('properly updates total values', async function () {
        expect(await this.silo.totalDepositedLP()).to.eq('1');
        expect(await this.silo.totalDepositedBeans()).to.eq('1596');
        expect(await this.silo.totalSeeds()).to.eq('4792');
        expect(await this.silo.totalStalk()).to.eq('19961600');
      });

      it('properly updates user deposits', async function () {
        expect(await this.silo.beanDeposit(userAddress, 3)).to.eq('1596');
        const lpDeposit = await this.silo.lpDeposit(userAddress, 2);
        expect(lpDeposit[0]).to.eq('1');
        expect(lpDeposit[1]).to.eq('1600');
      });

      it('emits events', async function () {
        await expect(this.result).to.emit(this.silo, 'LPRemove')
          .withArgs(userAddress, [3,2], ['1', '1'], '2');
        await expect(this.result).to.emit(this.silo, 'BeanDeposit')
          .withArgs(userAddress, 3, '1596');
      });
    });
  });
  describe('Bean + Eth To LP', function () {
    beforeEach(async function () {
      await this.pair.set('10000', '10', '1')
      await this.pair.faucet(user2Address, '9');
      await this.silo.connect(user).depositBeans('1000');
    })

    describe('Different size arrays', async function () {      
      it('reverts', async function () {
        await this.silo.connect(user).depositBeans('20000');
        await this.pair.simulateTrade('10000', '40000');
        await expect(this.convert.connect(user).convert(ConvertEncoder.convertBeansToUniswapLP('5000','2'),['2', '4'],['20000']))
          .to.be.revertedWith('Convert: Not enough LP.');
        await this.pair.set('10000', '40000', '1');
      });
    });

    describe('crate balance too low', function () {
      it('reverts', async function () {
        await expect(this.convert.connect(user).convertAddAndDepositLP('0',['1500','900','1'], [2], [1500], {value: '1'})).to.be.revertedWith('Silo: Crate balance too low.');
      });
    })

	  describe('immediate convert', function () {
      beforeEach(async function () {
        this.first = await this.bean.balanceOf(userAddress)
        await this.convert.connect(user).convertAddAndDepositLP('0',['1000','900','1'], [2], [1000], {value: '1'});
	      this.after = await this.claim.connect(user).wrappedBeans(userAddress)
	      this.second = await this.bean.balanceOf(userAddress)
      });

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
        await this.convert.connect(user).convertAddAndDepositLP('0',['1000','900','1'], [2], [1000], {value: '1'});
        this.wrappedBeans = await this.claim.connect(user).wrappedBeans(userAddress)
      });

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

    describe('convert 2 crate 1 before after a lot of seasons', function () {
      beforeEach(async function () {
        await this.season.siloSunrises('10');
        await this.silo.connect(user).depositBeans('500');
	      this.first = await this.bean.balanceOf(userAddress)
        await this.convert.connect(user).convertAddAndDepositLP('0',['1000','900','1'], [2,12], [500,500], {value: '1'});
	      this.second = await this.bean.balanceOf(userAddress)
	      this.wrappedBeans = await this.claim.connect(user).wrappedBeans(userAddress)
      });

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

    describe('immediate convert, excessive LP allocation', function () {
      beforeEach(async function () {
	      this.first = await this.bean.balanceOf(userAddress)
        await this.convert.connect(user).convertAddAndDepositLP('0',['10000','9000','10'], [2], [1000], {value: '10'});
	      this.wrappedBeans = await this.claim.connect(user).wrappedBeans(userAddress)
	      this.second = await this.bean.balanceOf(userAddress)
      });

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

      it('takes the proper amount of beans from wallet', function () {
        const diff = this.first.sub(this.second);
        expect(diff).to.eq('9000');
      });

      it('properly clears wrapped beans value', function () {
        expect(this.wrappedBeans).to.eq('0');
      });
    });

    describe('convert 1 crate after a lot of seasons, excessive LP allocation', function () {
      beforeEach(async function () {
        await this.season.siloSunrises('10');
        this.first = await this.bean.balanceOf(userAddress)
        await this.convert.connect(user).convertAddAndDepositLP('0',['10000','9000','10'], [2], [1000], {value: '10'});
        this.wrappedBeans = await this.claim.connect(user).wrappedBeans(userAddress)
        this.second = await this.bean.balanceOf(userAddress)
      });

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

      it('takes the proper amount of beans from wallet', function () {
        const diff = this.first.sub(this.second);
        expect(diff).to.eq('9000');
      });

      it('properly clears wrapped beans value', function () {
        expect(this.wrappedBeans).to.eq('0');
      });
    });

    describe('convert 2 crate 1 before after a lot of seasons, excessive LP allocation', function () {
      beforeEach(async function () {
        await this.season.siloSunrises('10');
        await this.silo.connect(user).depositBeans('500');
	      this.first = await this.bean.balanceOf(userAddress)
        await this.convert.connect(user).convertAddAndDepositLP('0',['10000','9000','10'], [2,12], [500,500], {value: '10'});
	      this.wrappedBeans = await this.claim.connect(user).wrappedBeans(userAddress)
	      this.second = await this.bean.balanceOf(userAddress)
      });

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

      it('takes the proper amount of beans from wallet', function () {
	      const diff = this.first.sub(this.second);
        expect(diff).to.eq('9000');
      });
      
      it('properly clears wrapped beans value', function () {
        expect(this.wrappedBeans).to.eq('0');
      });
    });
  });
});
