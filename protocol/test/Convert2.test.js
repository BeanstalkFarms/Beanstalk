const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { GeneralFunctionEncoder } = require('./utils/encoder.js')

let user,user2,owner;
let userAddress, ownerAddress, user2Address;
describe('Convert', function () {
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
    this.silo2 = await ethers.getContractAt('MockSiloV2Facet', this.diamond.address);
    this.convert = await ethers.getContractAt('MockConvertFacet', this.diamond.address);
    this.claim = await ethers.getContractAt('MockClaimFacet', this.diamond.address)
    this.pair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pair);
    this.pegPair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pegPair);
    this.bean = await ethers.getContractAt('MockToken', contracts.bean);
    this.weth = await ethers.getContractAt('MockToken', contracts.weth)
    this.updateSettings = [false, false, false];

    this.siloToken = await ethers.getContractFactory("MockToken");
    this.siloToken = await this.siloToken.deploy("Silo", "SILO")
    await this.siloToken.deployed()

    await this.silo2.mockWhitelistToken(
      this.siloToken.address, 
      this.silo2.interface.getSighash("mockBDV(uint256 amount)"), 
      '10000', 
      '1'
    );

    await this.pair.set('100', '400', '1');
    await this.pegPair.simulateTrade('20000', '20000');
    await this.season.siloSunrise(0);
    await this.pair.faucet(userAddress, '1');
    await this.bean.mint(userAddress, '1000000000');
    await this.bean.mint(user2Address, '1000000000');
    await this.pair.connect(user).approve(this.silo.address, '100000000000');
    await this.pair.connect(user2).approve(this.silo.address, '100000000000');
    await this.bean.connect(user).approve(this.silo.address, '100000000000');
    await this.bean.connect(user2).approve(this.silo.address, '100000000000'); 
    await this.siloToken.connect(user).approve(this.silo.address, '100000000000');
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
    await this.pair.faucet(userAddress, '200');
    await this.season.resetAccountToken(userAddress, this.siloToken.address);
    await this.siloToken.mint(userAddress, '10000');
    await this.season.resetState();
    await this.season.siloSunrise(0);
  });

  describe('Withdraw For Convert', async function () {
    describe("Bean", async function () {
      beforeEach(async function () {
        await this.silo.connect(user).depositBeans('100');
        await this.season.siloSunrise(0);
        await this.silo.connect(user).depositBeans('100');
      })
      describe("Revert", async function () {
        it('diff lengths', async function () {
          await expect(this.convert.connect(user).withdrawForConvertE(this.bean.address, ['2', '3'], ['100'], '100')).to.be.revertedWith('Convert: seasons, amounts are diff lengths.')
        });

        it('crate balance too low', async function () {
          await expect(this.convert.connect(user).withdrawForConvertE(this.bean.address, ['2'], ['150'], '150')).to.be.revertedWith('Silo: Crate balance too low.')
        });

        it('not enough removed', async function () {
          await expect(this.convert.connect(user).withdrawForConvertE(this.bean.address, ['2'], ['100'], '150')).to.be.revertedWith('Convert: Not enough Beans removed.')
        });
      })
      describe("Withdraw 1 Crate", async function () {
        beforeEach(async function () {
          this.result = await this.convert.connect(user).withdrawForConvertE(this.bean.address, ['3'], ['100'], '100');
        })

        it('Emits event', async function () {
          await expect(this.result).to.emit(this.convert, 'BeanRemove').withArgs(userAddress, [3], ['100'], '100');
          await expect(this.result).to.emit(this.convert, 'MockConvert').withArgs('0');
        })

        it('Decrements totals', async function () {
          expect(await this.silo.totalDepositedBeans()).to.equal('100');
          expect(await this.silo.totalStalk()).to.equal('1000200');
          expect(await this.silo.totalSeeds()).to.equal('200');
        })

        it('Decrements balances', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.equal('1000200');
          expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('200');
        })

        it('properly removes the crate', async function () {
          expect(await this.silo.beanDeposit(userAddress, 2)).to.eq('100')
          expect(await this.silo.beanDeposit(userAddress, 3)).to.eq('0')
        })
      })

      describe("Withdraw 1 Crate 2 input", async function () {
        beforeEach(async function () {
          this.result = await this.convert.connect(user).withdrawForConvertE(this.bean.address, ['3', '2'], ['100', '100'], '100');
        })

        it('Emits event', async function () { 
          await expect(this.result).to.emit(this.convert, 'BeanRemove').withArgs(userAddress, [3,2], ['100','0'], '100');
          await expect(this.result).to.emit(this.convert, 'MockConvert').withArgs('0');
        })

        it('Decrements totals', async function () {
          expect(await this.silo.totalDepositedBeans()).to.equal('100');
          expect(await this.silo.totalStalk()).to.equal('1000200');
          expect(await this.silo.totalSeeds()).to.equal('200');
        })

        it('Decrements balances', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.equal('1000200');
          expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('200');
        })

        it('properly removes the crate', async function () {
          expect(await this.silo.beanDeposit(userAddress, 2)).to.eq('100')
          expect(await this.silo.beanDeposit(userAddress, 3)).to.eq('0')
        })
      })

      describe("Withdraw 2 Crates exact", async function () {
        beforeEach(async function () {
          this.result = await this.convert.connect(user).withdrawForConvertE(this.bean.address, ['2', '3'], ['100', '50'], '150');
        })

        it('Emits event', async function () { 
          await expect(this.result).to.emit(this.convert, 'BeanRemove').withArgs(userAddress, [2,3], ['100','50'], '150');
          await expect(this.result).to.emit(this.convert, 'MockConvert').withArgs('200');
        })

        it('Decrements totals', async function () {
          expect(await this.silo.totalDepositedBeans()).to.equal('50');
          expect(await this.silo.totalStalk()).to.equal('500000');
          expect(await this.silo.totalSeeds()).to.equal('100');
        })

        it('Decrements balances', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.equal('500000');
          expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('100');
        })

        it('properly removes the crate', async function () {
          expect(await this.silo.beanDeposit(userAddress, 2)).to.eq('0')
          expect(await this.silo.beanDeposit(userAddress, 3)).to.eq('50')
        })
      })

      describe("Withdraw 2 Crates under", async function () {
        beforeEach(async function () {
          this.result = await this.convert.connect(user).withdrawForConvertE(this.bean.address, ['2', '3'], ['100', '100'], '150');
        })

        it('Emits event', async function () { 
          await expect(this.result).to.emit(this.convert, 'BeanRemove').withArgs(userAddress, [2, 3], ['100','50'], '150');
          await expect(this.result).to.emit(this.convert, 'MockConvert').withArgs('200');
        })

        it('Decrements totals', async function () {
          expect(await this.silo.totalDepositedBeans()).to.equal('50');
          expect(await this.silo.totalStalk()).to.equal('500000');
          expect(await this.silo.totalSeeds()).to.equal('100');
        })

        it('Decrements balances', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.equal('500000');
          expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('100');
        })

        it('properly removes the crate', async function () {
          expect(await this.silo.beanDeposit(userAddress, 2)).to.eq('0')
          expect(await this.silo.beanDeposit(userAddress, 3)).to.eq('50')
        })
      })
    })

    describe("LP", async function () {
      beforeEach(async function () {
        await this.silo.connect(user).depositLP('100');
        await this.season.siloSunrise(0);
        await this.silo.connect(user).depositLP('100');
      })
      describe("Revert", async function () {
        it('diff lengths', async function () {
          await expect(this.convert.connect(user).withdrawForConvertE(this.pair.address, ['2', '3'], ['100'], '100')).to.be.revertedWith('Convert: seasons, amounts are diff lengths.')
        });

        it('crate balance too low', async function () {
          await expect(this.convert.connect(user).withdrawForConvertE(this.pair.address, ['2'], ['150'], '150')).to.be.revertedWith('Silo: Crate balance too low.')
        });

        it('not enough removed', async function () {
          await expect(this.convert.connect(user).withdrawForConvertE(this.pair.address, ['2'], ['100'], '150')).to.be.revertedWith('Convert: Not enough tokens removed.')
        });
      })
      describe("Withdraw 1 Crate", async function () {
        beforeEach(async function () {
          this.result = await this.convert.connect(user).withdrawForConvertE(this.pair.address, ['3'], ['100'], '100');
        })

        it('Emits event', async function () {
          await expect(this.result).to.emit(this.convert, 'LPRemove').withArgs(userAddress, [3], ['100'], '100');
          await expect(this.result).to.emit(this.convert, 'MockConvert').withArgs('0');
        })

        it('Decrements totals', async function () {
          expect(await this.silo.totalDepositedLP()).to.equal('100');
          expect(await this.silo.totalStalk()).to.equal('1000400');
          expect(await this.silo.totalSeeds()).to.equal('400');
        })

        it('Decrements balances', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.equal('1000400');
          expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('400');
        })

        it('properly removes the crate', async function () {
          let deposit = await this.silo.lpDeposit(userAddress, 2);
          expect(deposit[0]).to.eq('100');
          expect(deposit[1]).to.eq('400');
          deposit = await this.silo.lpDeposit(userAddress, 3);
          expect(deposit[0]).to.eq('0');
          expect(deposit[1]).to.eq('0');
        })
      })

      describe("Withdraw 1 Crate 2 input", async function () {
        beforeEach(async function () {
          this.result = await this.convert.connect(user).withdrawForConvertE(this.pair.address, ['3', '2'], ['100', '100'], '100');
        })

        it('Emits event', async function () {
          await expect(this.result).to.emit(this.convert, 'LPRemove').withArgs(userAddress, [3, 2], ['100', '0'], '100');
          await expect(this.result).to.emit(this.convert, 'MockConvert').withArgs('0');
        })

        it('Decrements totals', async function () {
          expect(await this.silo.totalDepositedLP()).to.equal('100');
          expect(await this.silo.totalStalk()).to.equal('1000400');
          expect(await this.silo.totalSeeds()).to.equal('400');
        })

        it('Decrements balances', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.equal('1000400');
          expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('400');
        })

        it('properly removes the crate', async function () {
          let deposit = await this.silo.lpDeposit(userAddress, 2);
          expect(deposit[0]).to.eq('100');
          expect(deposit[1]).to.eq('400');
          deposit = await this.silo.lpDeposit(userAddress, 3);
          expect(deposit[0]).to.eq('0');
          expect(deposit[1]).to.eq('0');
        })
      })

      describe("Withdraw 2 Crates exact", async function () {
        beforeEach(async function () {
          this.result = await this.convert.connect(user).withdrawForConvertE(this.pair.address, ['2', '3'], ['100', '50'], '150');
        })

        it('Emits event', async function () { 
          await expect(this.result).to.emit(this.convert, 'LPRemove').withArgs(userAddress, [2, 3], ['100', '50'], '150');
          await expect(this.result).to.emit(this.convert, 'MockConvert').withArgs('400');
        })

        it('Decrements totals', async function () {
          expect(await this.silo.totalDepositedLP()).to.equal('50');
          expect(await this.silo.totalStalk()).to.equal('500000');
          expect(await this.silo.totalSeeds()).to.equal('200');
        })

        it('Decrements balances', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.equal('500000');
          expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('200');
        })

        it('properly removes the crate', async function () {
          let deposit = await this.silo.lpDeposit(userAddress, 2);
          expect(deposit[0]).to.eq('0');
          expect(deposit[1]).to.eq('0');
          deposit = await this.silo.lpDeposit(userAddress, 3);
          expect(deposit[0]).to.eq('50');
          expect(deposit[1]).to.eq('200');
        })
      })

      describe("Withdraw 2 Crates under", async function () {
        beforeEach(async function () {
          this.result = await this.convert.connect(user).withdrawForConvertE(this.pair.address, ['2', '3'], ['100', '100'], '150');
        })

        it('Emits event', async function () { 
          await expect(this.result).to.emit(this.convert, 'LPRemove').withArgs(userAddress, [2, 3], ['100','50'], '150');
          await expect(this.result).to.emit(this.convert, 'MockConvert').withArgs('400');
        })

        it('Decrements totals', async function () {
          expect(await this.silo.totalDepositedLP()).to.equal('50');
          expect(await this.silo.totalStalk()).to.equal('500000');
          expect(await this.silo.totalSeeds()).to.equal('200');
        })

        it('Decrements balances', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.equal('500000');
          expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('200');
        })

        it('properly removes the crate', async function () {
          let deposit = await this.silo.lpDeposit(userAddress, 2);
          expect(deposit[0]).to.eq('0');
          expect(deposit[1]).to.eq('0');
          deposit = await this.silo.lpDeposit(userAddress, 3);
          expect(deposit[0]).to.eq('50');
          expect(deposit[1]).to.eq('200');
        })
      })
    })

    describe("Token", async function () {
      beforeEach(async function () {
        await this.silo2.connect(user).deposit(this.siloToken.address, '100');
        await this.season.siloSunrise(0);
        await this.silo2.connect(user).deposit(this.siloToken.address, '100');
      })
      describe("Revert", async function () {
        it('diff lengths', async function () {
          await expect(this.convert.connect(user).withdrawForConvertE(this.siloToken.address, ['2', '3'], ['100'], '100')).to.be.revertedWith('Convert: seasons, amounts are diff lengths.')
        });

        it('crate balance too low', async function () {
          await expect(this.convert.connect(user).withdrawForConvertE(this.siloToken.address, ['2'], ['150'], '150')).to.be.revertedWith('Silo: Crate balance too low.')
        });

        it('not enough removed', async function () {
          await expect(this.convert.connect(user).withdrawForConvertE(this.siloToken.address, ['2'], ['100'], '150')).to.be.revertedWith('Convert: Not enough tokens removed.')
        });
      })
      describe("Withdraw 1 Crate", async function () {
        beforeEach(async function () {
          this.result = await this.convert.connect(user).withdrawForConvertE(this.siloToken.address, ['3'], ['100'], '100');
        })

        it('Emits event', async function () {
          await expect(this.result).to.emit(this.convert, 'RemoveSeasons').withArgs(userAddress, this.siloToken.address, [3], ['100'], '100');
          await expect(this.result).to.emit(this.convert, 'MockConvert').withArgs('0');
        })

        it('Decrements totals', async function () {
          expect(await this.silo2.getTotalDeposited(this.siloToken.address)).to.equal('100');
          expect(await this.silo.totalStalk()).to.equal('1000100');
          expect(await this.silo.totalSeeds()).to.equal('100');
        })

        it('Decrements balances', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.equal('1000100');
          expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('100');
        })

        it('properly removes the crate', async function () {
          let deposit = await this.silo2.getDeposit(userAddress, this.siloToken.address, 2);
          expect(deposit[0]).to.eq('100');
          expect(deposit[1]).to.eq('100');
          deposit = await this.silo2.getDeposit(userAddress, this.siloToken.address, 3);
          expect(deposit[0]).to.eq('0');
          expect(deposit[1]).to.eq('0');
        })
      })

      describe("Withdraw 1 Crate 2 input", async function () {
        beforeEach(async function () {
          this.result = await this.convert.connect(user).withdrawForConvertE(this.siloToken.address, ['3', '2'], ['100', '100'], '100');
        })

        it('Emits event', async function () {
          await expect(this.result).to.emit(this.convert, 'RemoveSeasons').withArgs(userAddress, this.siloToken.address, [3, 2], ['100', '0'], '100');
          await expect(this.result).to.emit(this.convert, 'MockConvert').withArgs('0');
        })

        it('Decrements totals', async function () {
          expect(await this.silo2.getTotalDeposited(this.siloToken.address)).to.equal('100');
          expect(await this.silo.totalStalk()).to.equal('1000100');
          expect(await this.silo.totalSeeds()).to.equal('100');
        })

        it('Decrements balances', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.equal('1000100');
          expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('100');
        })

        it('properly removes the crate', async function () {
          let deposit = await this.silo2.getDeposit(userAddress, this.siloToken.address, 2);
          expect(deposit[0]).to.eq('100');
          expect(deposit[1]).to.eq('100');
          deposit = await this.silo2.getDeposit(userAddress, this.siloToken.address, 3);
          expect(deposit[0]).to.eq('0');
          expect(deposit[1]).to.eq('0');
        })
      })

      describe("Withdraw 2 Crates exact", async function () {
        beforeEach(async function () {
          this.result = await this.convert.connect(user).withdrawForConvertE(this.siloToken.address, ['2', '3'], ['100', '50'], '150');
        })

        it('Emits event', async function () { 
          await expect(this.result).to.emit(this.convert, 'RemoveSeasons').withArgs(userAddress, this.siloToken.address, [2, 3], ['100', '50'], '150');
          await expect(this.result).to.emit(this.convert, 'MockConvert').withArgs('100');
        })

        it('Decrements totals', async function () {
          expect(await this.silo2.getTotalDeposited(this.siloToken.address)).to.equal('50');
          expect(await this.silo.totalStalk()).to.equal('500000');
          expect(await this.silo.totalSeeds()).to.equal('50');
        })

        it('Decrements balances', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.equal('500000');
          expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('50');
        })

        it('properly removes the crate', async function () {
          let deposit = await this.silo2.getDeposit(userAddress, this.siloToken.address, 2);
          expect(deposit[0]).to.eq('0');
          expect(deposit[1]).to.eq('0');
          deposit = await this.silo2.getDeposit(userAddress, this.siloToken.address, 3);
          expect(deposit[0]).to.eq('50');
          expect(deposit[1]).to.eq('50');
        })
      })

      describe("Withdraw 2 Crates under", async function () {
        beforeEach(async function () {
          this.result = await this.convert.connect(user).withdrawForConvertE(this.siloToken.address, ['2', '3'], ['100', '100'], '150');
        })

        it('Emits event', async function () { 
          await expect(this.result).to.emit(this.convert, 'RemoveSeasons').withArgs(userAddress, this.siloToken.address, [2, 3], ['100','50'], '150');
          await expect(this.result).to.emit(this.convert, 'MockConvert').withArgs('100');
        })

        it('Decrements totals', async function () {
          expect(await this.silo2.getTotalDeposited(this.siloToken.address)).to.equal('50');
          expect(await this.silo.totalStalk()).to.equal('500000');
          expect(await this.silo.totalSeeds()).to.equal('50');
        })

        it('Decrements balances', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.equal('500000');
          expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('50');
        })

        it('properly removes the crate', async function () {
          let deposit = await this.silo2.getDeposit(userAddress, this.siloToken.address, 2);
          expect(deposit[0]).to.eq('0');
          expect(deposit[1]).to.eq('0');
          deposit = await this.silo2.getDeposit(userAddress, this.siloToken.address, 3);
          expect(deposit[0]).to.eq('50');
          expect(deposit[1]).to.eq('50');
        })
      })
    })
  })
  
  describe('Deposit For Convert', async function () {
    describe("Revert", async function () {
      it("Reverts if BDV is 0", async function () {
        await expect(this.convert.connect(user).depositForConvertE(this.bean.address, '100', '0', '100')).to.be.revertedWith("Convert: BDV or amount is 0.")
      })

      it("Reverts if amount is 0", async function () {
        await expect(this.convert.connect(user).depositForConvertE(this.bean.address, '0', '100', '100')).to.be.revertedWith("Convert: BDV or amount is 0.")
      })
    })
    describe('Deposit Beans no grown stalk', async function () {
      beforeEach(async function () {
        this.result = await this.convert.connect(user).depositForConvertE(this.bean.address, '100', '100', '0');
      });

      it('Emits event', async function () {
        await expect(this.result).to.emit(this.silo, 'BeanDeposit').withArgs(userAddress, 2, '100');
      })

      it('Decrements totals', async function () {
        expect(await this.silo.totalDepositedBeans()).to.equal('100');
        expect(await this.silo.totalStalk()).to.equal('1000000');
        expect(await this.silo.totalSeeds()).to.equal('200');
      })

      it('Decrements balances', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.equal('1000000');
        expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('200');
      })

      it('properly removes the crate', async function () {
        expect(await this.silo.beanDeposit(userAddress, 2)).to.eq('100');
      })
    })

    describe('Deposit Beans', async function () {
      beforeEach(async function () {
        this.result = await this.convert.connect(user).depositForConvertE(this.bean.address, '100', '100', '200');
      });

      it('Emits event', async function () {
        await expect(this.result).to.emit(this.silo, 'BeanDeposit').withArgs(userAddress, 1, '100');
      })

      it('Decrements totals', async function () {
        expect(await this.silo.totalDepositedBeans()).to.equal('100');
        expect(await this.silo.totalStalk()).to.equal('1000200');
        expect(await this.silo.totalSeeds()).to.equal('200');
      })

      it('Decrements balances', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.equal('1000200');
        expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('200');
      })

      it('properly removes the crate', async function () {
        expect(await this.silo.beanDeposit(userAddress, 1)).to.eq('100');
      })
    })

    describe('Deposit Beans too much Grown Stalk', async function () {
      beforeEach(async function () {
        this.result = await this.convert.connect(user).depositForConvertE(this.bean.address, '100', '100', '500');
      });

      it('Emits event', async function () {
        await expect(this.result).to.emit(this.silo, 'BeanDeposit').withArgs(userAddress, 1, '100');
      })

      it('Decrements totals', async function () {
        expect(await this.silo.totalDepositedBeans()).to.equal('100');
        expect(await this.silo.totalStalk()).to.equal('1000200');
        expect(await this.silo.totalSeeds()).to.equal('200');
      })

      it('Decrements balances', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.equal('1000200');
        expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('200');
      })

      it('properly removes the crate', async function () {
        expect(await this.silo.beanDeposit(userAddress, 1)).to.eq('100');
      })
    })

    describe('Deposit LP', async function () {
      beforeEach(async function () {
        await this.season.siloSunrise('0');
        await this.season.siloSunrise('0');
        this.result = await this.convert.connect(user).depositForConvertE(this.pair.address, '100', '100', '400');
      });

      it('Emits event', async function () {
        await expect(this.result).to.emit(this.silo, 'LPDeposit').withArgs(userAddress, 3, '100', '400');
      })

      it('Decrements totals', async function () {
        expect(await this.silo.totalDepositedLP()).to.equal('100');
        expect(await this.silo.totalStalk()).to.equal('1000400');
        expect(await this.silo.totalSeeds()).to.equal('400');
      })

      it('Decrements balances', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.equal('1000400');
        expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('400');
      })

      it('properly removes the crate', async function () {
        const deposit = await this.silo.lpDeposit(userAddress, 3);
        expect(deposit[0]).to.eq('100');
        expect(deposit[1]).to.eq('400');
      })
    })

    describe('Deposit Tokens', async function () {
      beforeEach(async function () {
        await this.season.siloSunrise('0');
        await this.season.siloSunrise('0');
        this.result = await this.convert.connect(user).depositForConvertE(this.siloToken.address, '100', '100', '100');
      });

      it('Emits event', async function () {
        await expect(this.result).to.emit(this.silo2, 'Deposit').withArgs(userAddress, this.siloToken.address, 3, '100', '100');
      })

      it('Decrements totals', async function () {
        expect(await this.silo2.getTotalDeposited(this.siloToken.address)).to.equal('100');
        expect(await this.silo.totalStalk()).to.equal('1000100');
        expect(await this.silo.totalSeeds()).to.equal('100');
      })

      it('Decrements balances', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.equal('1000100');
        expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('100');
      })

      it('properly removes the crate', async function () {
        const deposit = await this.silo2.getDeposit(userAddress, this.siloToken.address, 3);
        expect(deposit[0]).to.eq('100');
        expect(deposit[1]).to.eq('100');
      })
    })
  });
});
