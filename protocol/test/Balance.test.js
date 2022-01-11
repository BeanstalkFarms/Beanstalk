const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { BigNumber } = require('bignumber.js')
const { print } = require('./utils/print.js')

let user,user2,owner;
let userAddress, ownerAddress, user2Address;

describe('Balance', function () {
  before(async function () {
    [owner,user,user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
    this.claim = await ethers.getContractAt('MockClaimFacet', this.diamond.address)
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address)
    this.field = await ethers.getContractAt('MockFieldFacet', this.diamond.address)
    this.balance = await ethers.getContractAt('MockBalanceFacet', this.diamond.address)
    this.pair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pair)
    this.pegPair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pegPair)
    this.bean = await ethers.getContractAt('MockToken', contracts.bean)
    this.weth = await ethers.getContractAt('MockToken', contracts.weth)
    this.seed = await ethers.getContractAt('MockToken', contracts.seed)

    await this.season.siloSunrise(0)
    await this.bean.mint(userAddress, '1000000000')
    await this.bean.mint(user2Address, '1000000000')
    await this.bean.mint(this.pair.address, '100000')
    await this.weth.mint(this.pair.address, '100')
    await this.pair.connect(user).approve(this.silo.address, '100000000000')
    await this.pair.connect(user2).approve(this.silo.address, '100000000000')
    await this.bean.connect(user).approve(this.silo.address, '100000000000')
    await this.bean.connect(user2).approve(this.silo.address, '100000000000')
    await this.bean.connect(user).approve(this.bean.address, '100000000000')
    await this.bean.connect(user2).approve(this.bean.address, '100000000000')
    await this.pair.faucet(userAddress, '100');
    await this.pair.set('100000', '100','1');

    await user.sendTransaction({
        to: this.weth.address,
        value: ethers.utils.parseEther("1.0")
    });
  });

  beforeEach (async function () {
    await this.season.resetAccount(userAddress)
    await this.season.resetAccount(user2Address)
    await this.season.resetAccount(ownerAddress)
    await this.season.resetWrappedBeans([userAddress, user2Address, ownerAddress])
    await this.season.resetState()
    await this.season.siloSunrise(0)
    let newBeans = 1000000000 - parseInt(await this.bean.balanceOf(userAddress))
    await this.bean.mint(userAddress, newBeans)
    newBeans = parseInt(await this.bean.balanceOf(user2Address)) - 1000000000
    await this.bean.connect(user2).burn(newBeans)
  });

  describe('to internal', function () {
    describe('revert', async function () {
      it('reverts on too much', async function () {
        await expect(this.balance.connect(user).toInternalBalance(this.bean.address, '1000000001'))
          .to.be.revertedWith('ERC20: transfer amount exceeds balance');
      });
    })
    beforeEach(async function () {
      await this.balance.connect(user).toInternalBalance(this.bean.address, '1000');
    });

    it('increments user internal balance', async function() {
      expect(await this.bean.balanceOf(userAddress)).to.be.equal('999999000');
      expect(await this.balance.internalBalanceOf(userAddress, this.bean.address)).to.be.equal('1000');
      expect(await this.balance.totalBalanceOf(userAddress, this.bean.address)).to.be.equal('1000000000');
      const ibs = await this.balance.internalBalancesOf(userAddress, [this.bean.address])
      expect(ibs[0]).to.be.equal('1000')
      const bs = await this.balance.balancesOf(userAddress, [this.bean.address])
      expect(bs[0]).to.be.equal('1000000000')
      expect(await this.bean.balanceOf(this.balance.address)).to.be.equal('1000');
    });
  });

  describe('to external', function () {
    describe('revert', async function () {
      it('reverts on too much', async function () {
        await expect(this.balance.connect(user).toExternalBalance(this.bean.address, '1'))
          .to.be.revertedWith('INSUFFICIENT INTERNAL BALANCE');
      });

      it('reverts on too much', async function () {
        await this.balance.connect(user).toInternalBalance(this.bean.address, '1000');
        await expect(this.balance.connect(user).toExternalBalance(this.bean.address, '1001'))
          .to.be.revertedWith('INSUFFICIENT INTERNAL BALANCE');
      });
    })
    beforeEach(async function () {
      await this.balance.connect(user).toInternalBalance(this.bean.address, '1000');
      await this.balance.connect(user).toExternalBalance(this.bean.address, '1000');
    });

    it('decrements user internal balance', async function() {
      expect(await this.bean.balanceOf(userAddress)).to.be.equal('1000000000');
      expect(await this.balance.internalBalanceOf(userAddress, this.bean.address)).to.be.equal('0');
      expect(await this.balance.totalBalanceOf(userAddress, this.bean.address)).to.be.equal('1000000000');
      const ibs = await this.balance.internalBalancesOf(userAddress, [this.bean.address])
      expect(ibs[0]).to.be.equal('0')
      const bs = await this.balance.balancesOf(userAddress, [this.bean.address])
      expect(bs[0]).to.be.equal('1000000000')
      expect(await this.bean.balanceOf(this.balance.address)).to.be.equal('0');
    });
  });

  describe('transfer', function () {
    describe('to external from external', async function () {
      it ('reverts when too much', async function () {
        await expect(this.balance.connect(user).transfer(
          this.bean.address,
          user2Address,
          '1000000001',
          false,
          false
        )).to.be.revertedWith('')
      })

      beforeEach(async function () {
        await this.balance.connect(user).transfer(
          this.bean.address,
          user2Address,
          '1000',
          false,
          false
        );
      });

      it('transfer balances correctly', async function () {
        expect(await this.balance.internalBalanceOf(userAddress, this.bean.address)).to.be.equal('0');
        expect(await this.balance.totalBalanceOf(userAddress, this.bean.address)).to.be.equal('999999000');
        expect(await this.balance.internalBalanceOf(user2Address, this.bean.address)).to.be.equal('0');
        expect(await this.balance.totalBalanceOf(user2Address, this.bean.address)).to.be.equal('1000001000');
        expect(await this.bean.balanceOf(this.balance.address)).to.be.equal('0');
      })
    });

    describe('to internal from external', async function () {
      it ('reverts when too much', async function () {
        await expect(this.balance.connect(user).transfer(
          this.bean.address,
          user2Address,
          '1000000001',
          false,
          true
        )).to.be.revertedWith('')
      })

      beforeEach(async function () {
        await this.balance.connect(user).transfer(
          this.bean.address,
          user2Address,
          '1000',
          false,
          true
        );
      });

      it('transfer balances correctly', async function () {
        expect(await this.balance.internalBalanceOf(userAddress, this.bean.address)).to.be.equal('0');
        expect(await this.balance.totalBalanceOf(userAddress, this.bean.address)).to.be.equal('999999000');
        expect(await this.balance.internalBalanceOf(user2Address, this.bean.address)).to.be.equal('1000');
        expect(await this.balance.totalBalanceOf(user2Address, this.bean.address)).to.be.equal('1000001000');
        expect(await this.bean.balanceOf(this.balance.address)).to.be.equal('1000');
      })
    });

    describe('to external from internal', async function () {
      describe('exact internal balance', async function () {
        beforeEach(async function () {
          await this.balance.connect(user).toInternalBalance(this.bean.address, '1000');
          await this.balance.connect(user).transfer(
            this.bean.address,
            user2Address,
            '1000',
            true,
            false,
          );
        });

        it('transfer balances correctly', async function () {
          expect(await this.balance.internalBalanceOf(userAddress, this.bean.address)).to.be.equal('0');
          expect(await this.balance.totalBalanceOf(userAddress, this.bean.address)).to.be.equal('999999000');
          expect(await this.balance.internalBalanceOf(user2Address, this.bean.address)).to.be.equal('0');
          expect(await this.balance.totalBalanceOf(user2Address, this.bean.address)).to.be.equal('1000001000');
          expect(await this.bean.balanceOf(this.balance.address)).to.be.equal('0');
        });
      });

      describe('less than internal balance', async function () {
        beforeEach(async function () {
          await this.balance.connect(user).toInternalBalance(this.bean.address, '1000');
          await this.balance.connect(user).transfer(
            this.bean.address,
            user2Address,
            '500',
            true,
            false,
          );
        });

        it('transfer balances correctly', async function () {
          expect(await this.balance.internalBalanceOf(userAddress, this.bean.address)).to.be.equal('500');
          expect(await this.balance.totalBalanceOf(userAddress, this.bean.address)).to.be.equal('999999500');
          expect(await this.balance.internalBalanceOf(user2Address, this.bean.address)).to.be.equal('0');
          expect(await this.balance.totalBalanceOf(user2Address, this.bean.address)).to.be.equal('1000000500');
          expect(await this.bean.balanceOf(this.balance.address)).to.be.equal('500');
        });
      });

      describe('more than internal balance', async function () {
        beforeEach(async function () {
          await this.balance.connect(user).toInternalBalance(this.bean.address, '1000');
          await this.balance.connect(user).transfer(
            this.bean.address,
            user2Address,
            '1500',
            true,
            false,
          );
        });

        it('transfer balances correctly', async function () {
          expect(await this.balance.internalBalanceOf(userAddress, this.bean.address)).to.be.equal('0');
          expect(await this.balance.totalBalanceOf(userAddress, this.bean.address)).to.be.equal('999998500');
          expect(await this.balance.internalBalanceOf(user2Address, this.bean.address)).to.be.equal('0');
          expect(await this.balance.totalBalanceOf(user2Address, this.bean.address)).to.be.equal('1000001500');
          expect(await this.bean.balanceOf(this.balance.address)).to.be.equal('0');
        });
      });
    });
  });

  describe('to internal from internal', async function () {
    describe('exact internal balance', async function () {
      beforeEach(async function () {
        await this.balance.connect(user).toInternalBalance(this.bean.address, '1000');
        await this.balance.connect(user).transfer(
          this.bean.address,
          user2Address,
          '1000',
          true,
          true,
        );
      });

      it('transfer balances correctly', async function () {
        expect(await this.balance.internalBalanceOf(userAddress, this.bean.address)).to.be.equal('0');
        expect(await this.balance.totalBalanceOf(userAddress, this.bean.address)).to.be.equal('999999000');
        expect(await this.balance.internalBalanceOf(user2Address, this.bean.address)).to.be.equal('1000');
        expect(await this.balance.totalBalanceOf(user2Address, this.bean.address)).to.be.equal('1000001000');
        expect(await this.bean.balanceOf(this.balance.address)).to.be.equal('1000');
      });
    });

    describe('less than internal balance', async function () {
      beforeEach(async function () {
        await this.balance.connect(user).toInternalBalance(this.bean.address, '1000');
        await this.balance.connect(user).transfer(
          this.bean.address,
          user2Address,
          '500',
          true,
          true,
        );
      });

      it('transfer balances correctly', async function () {
        expect(await this.balance.internalBalanceOf(userAddress, this.bean.address)).to.be.equal('500');
        expect(await this.balance.totalBalanceOf(userAddress, this.bean.address)).to.be.equal('999999500');
        expect(await this.balance.internalBalanceOf(user2Address, this.bean.address)).to.be.equal('500');
        expect(await this.balance.totalBalanceOf(user2Address, this.bean.address)).to.be.equal('1000000500');
        expect(await this.bean.balanceOf(this.balance.address)).to.be.equal('1000');
      });
    });

    describe('more than internal balance', async function () {
      beforeEach(async function () {
        await this.balance.connect(user).toInternalBalance(this.bean.address, '1000');
        await this.balance.connect(user).transfer(
          this.bean.address,
          user2Address,
          '1500',
          true,
          true,
        );
      });

      it('transfer balances correctly', async function () {
        expect(await this.balance.internalBalanceOf(userAddress, this.bean.address)).to.be.equal('0');
        expect(await this.balance.totalBalanceOf(userAddress, this.bean.address)).to.be.equal('999998500');
        expect(await this.balance.internalBalanceOf(user2Address, this.bean.address)).to.be.equal('1500');
        expect(await this.balance.totalBalanceOf(user2Address, this.bean.address)).to.be.equal('1000001500');
        expect(await this.bean.balanceOf(this.balance.address)).to.be.equal('1500');
      });
    });
  });
});
