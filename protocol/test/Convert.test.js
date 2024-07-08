const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { to6, to18 } = require('./utils/helpers.js');
const { ConvertEncoder } = require('./utils/encoder.js')
const { BEAN } = require('./utils/constants')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");

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
    this.siloGetters = await ethers.getContractAt('SiloGettersFacet', this.diamond.address);
    this.diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', this.diamond.address)
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address);
    this.convert = await ethers.getContractAt('MockConvertFacet', this.diamond.address);
    this.bean = await ethers.getContractAt('MockToken', BEAN);
    this.siloToken = await ethers.getContractFactory("MockToken");
    this.siloToken = await this.siloToken.deploy("Silo", "SILO")
    await this.siloToken.deployed()



    //test setup includes making 2 deposits, one at stem of 1, and another deposit at 2

    await this.bean.mint(userAddress, '1000000000');
    await this.bean.mint(user2Address, '1000000000');
    await this.bean.connect(user).approve(this.silo.address, '100000000000');
    await this.bean.connect(user2).approve(this.silo.address, '100000000000'); 
    await this.siloToken.connect(user).approve(this.silo.address, '100000000000');
    await this.siloToken.mint(userAddress, '10000');
    await this.season.teleportSunrise(10);

    this.season.deployStemsUpgrade();
    await this.silo.mockWhitelistToken(
      this.siloToken.address, 
      this.silo.interface.getSighash("mockBDV(uint256 amount)"), 
      '10000', 
      1e6 //aka "1 seed"
    );
    await this.season.siloSunrise(0);
    await this.silo.connect(user).deposit(this.siloToken.address, '100', EXTERNAL);
    await this.season.siloSunrise(0);
    await this.silo.connect(user).deposit(this.siloToken.address, '100', EXTERNAL);

    // call sunrise twice, and end germination for the silo token,
    // so that both deposits are not germinating.
    await this.season.siloSunrise(0);
    await this.season.mockEndTotalGerminationForToken(this.siloToken.address);
    await this.season.siloSunrise(0);
    await this.season.mockEndTotalGerminationForToken(this.siloToken.address);
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe('Withdraw For Convert', async function () {
    describe("Revert", async function () {
      it('diff lengths', async function () {
        await expect(this.convert.connect(user).withdrawForConvertE(this.siloToken.address, [to6('1'), to6('2')], ['100'], '100')).to.be.revertedWith('Convert: stems, amounts are diff lengths.')
      });

      it('crate balance too low', async function () {
        //params are token, stem, amounts, maxtokens
        // await expect(this.convert.connect(user).withdrawForConvertE(this.siloToken.address, ['0'], ['150'], '150')).to.be.revertedWith('Silo: Crate balance too low.') //before moving to constants for the original 4 whitelisted tokens (post replant), this test would revert with 'Silo: Crate balance too low.', but now it reverts with 'Must line up with season' because there's no constant seeds amount hardcoded in for this test token
        await expect(this.convert.connect(user).withdrawForConvertE(this.siloToken.address, [to6('2')], ['150'], '150')).to.be.revertedWith('Silo: Crate balance too low.')
      });

      it('not enough removed', async function () {
        await expect(this.convert.connect(user).withdrawForConvertE(this.siloToken.address, [to6('2')], ['100'], '150')).to.be.revertedWith('Convert: Not enough tokens removed.')
      });
    })

    //this test withdraws from stem index of 2, verifies they are removed correctly and stalk balances updated
    describe("Withdraw 1 Crate", async function () {
      beforeEach(async function () {
        this.result = await this.convert.connect(user).withdrawForConvertE(this.siloToken.address, [to6('2')], ['100'], '100');
      })

      it('Emits event', async function () {
        await expect(this.result).to.emit(this.convert, 'RemoveDeposits').withArgs(userAddress, this.siloToken.address, [2000000], ['100'], '100', ['100']);
        await expect(this.result).to.emit(this.convert, 'MockConvert').withArgs('200', '100');
      })

      it('Decrements totals', async function () {
        expect(await this.siloGetters.getTotalDeposited(this.siloToken.address)).to.equal('100');
        expect(await this.siloGetters.getTotalDepositedBdv(this.siloToken.address)).to.eq('100');
        expect(await this.siloGetters.totalStalk()).to.equal('1000300');
        //expect(await this.silo.totalSeeds()).to.equal('100');
      })

      it('Decrements balances', async function () {
        expect(await this.siloGetters.balanceOfStalk(userAddress)).to.equal('1000300');
      })

      it('properly removes the crate', async function () {
        let deposit = await this.siloGetters.getDeposit(userAddress, this.siloToken.address, to6('1'));

        expect(deposit[0]).to.eq('100');
        expect(deposit[1]).to.eq('100');
        deposit = await this.siloGetters.getDeposit(userAddress, this.siloToken.address, to6('2'));

        expect(deposit[0]).to.eq('0');
        expect(deposit[1]).to.eq('0');
      })
    })

    //this test withdraws from stem indexes of 2 and 1
    describe("Withdraw 1 Crate 2 input", async function () {
      beforeEach(async function () {
        this.result = await this.convert.connect(user).withdrawForConvertE(this.siloToken.address, [to6('2'), to6('1')], ['100', '100'], '100');
      })

      it('Emits event', async function () {
        await expect(this.result).to.emit(this.convert, 'RemoveDeposits').withArgs(userAddress, this.siloToken.address, [to6('2'), to6('1')], ['100', '0'], '100',['100', '0'] );
        await expect(this.result).to.emit(this.convert, 'MockConvert').withArgs('200', '100');
      })

      it('Decrements totals', async function () {
        expect(await this.siloGetters.getTotalDeposited(this.siloToken.address)).to.equal('100');
        expect(await this.siloGetters.getTotalDepositedBdv(this.siloToken.address)).to.eq('100');
        expect(await this.siloGetters.totalStalk()).to.equal('1000300');
      })

      it('Decrements balances', async function () {
        expect(await this.siloGetters.balanceOfStalk(userAddress)).to.equal('1000300');
      })

      it('properly removes the crate', async function () {
        let deposit = await this.siloGetters.getDeposit(userAddress, this.siloToken.address, to6('1'));
        expect(deposit[0]).to.eq('100');
        expect(deposit[1]).to.eq('100');
        deposit = await this.siloGetters.getDeposit(userAddress, this.siloToken.address, to6('2'));
        expect(deposit[0]).to.eq('0');
        expect(deposit[1]).to.eq('0');
      })
    })

    //withdraws less than the full deposited amount from stem indexes of 2 and 1
    describe("Withdraw 2 Crates exact", async function () {
      beforeEach(async function () {
        this.result = await this.convert.connect(user).withdrawForConvertE(this.siloToken.address, [to6('1'), to6('2')], ['100', '50'], '150');
      })

      it('Emits event', async function () { 
        await expect(this.result).to.emit(this.convert, 'RemoveDeposits').withArgs(userAddress, this.siloToken.address, [to6('1'),  to6('2')], ['100', '50'], '150', ['100', '50']);

        await expect(this.result).to.emit(this.convert, 'MockConvert').withArgs('400', '150');
      })

      it('Decrements totals', async function () {
        expect(await this.siloGetters.getTotalDeposited(this.siloToken.address)).to.equal('50');
        expect(await this.siloGetters.getTotalDepositedBdv(this.siloToken.address)).to.eq('50');
        expect(await this.siloGetters.totalStalk()).to.equal('500100');
        //expect(await this.silo.totalSeeds()).to.equal('50');
      })

      it('Decrements balances', async function () {
        expect(await this.siloGetters.balanceOfStalk(userAddress)).to.equal('500100');
        //expect(await this.siloGetters.balanceOfSeeds(userAddress)).to.equal('50');
      })

      it('properly removes the crate', async function () {
        let deposit = await this.siloGetters.getDeposit(userAddress, this.siloToken.address, to6('1'));
        expect(deposit[0]).to.eq('0');
        expect(deposit[1]).to.eq('0');
        deposit = await this.siloGetters.getDeposit(userAddress, this.siloToken.address, to6('2'));
        expect(deposit[0]).to.eq('50');
        expect(deposit[1]).to.eq('50');
      })
    })

    describe("Withdraw 2 Crates under", async function () {
      beforeEach(async function () {
        this.result = await this.convert.connect(user).withdrawForConvertE(this.siloToken.address, [to6('1'), to6('2')], ['100', '100'], '150');
      })

      it('Emits event', async function () {
        await expect(this.result).to.emit(this.convert, 'RemoveDeposits').withArgs(userAddress, this.siloToken.address, [to6('1'),  to6('2')], ['100','50'], '150', ['100','50']);
        await expect(this.result).to.emit(this.convert, 'MockConvert').withArgs('400', '150');
      })

      it('Decrements totals', async function () {
        expect(await this.siloGetters.getTotalDeposited(this.siloToken.address)).to.equal('50');
        expect(await this.siloGetters.getTotalDepositedBdv(this.siloToken.address)).to.eq('50');
        expect(await this.siloGetters.totalStalk()).to.equal('500100');
      })

      it('Decrements balances', async function () {
        expect(await this.siloGetters.balanceOfStalk(userAddress)).to.equal('500100');
      })

      it('properly removes the crate', async function () {
        let deposit = await this.siloGetters.getDeposit(userAddress, this.siloToken.address, to6('1'));
        expect(deposit[0]).to.eq('0');
        expect(deposit[1]).to.eq('0');
        deposit = await this.siloGetters.getDeposit(userAddress, this.siloToken.address, to6('2'));
        expect(deposit[0]).to.eq('50');
        expect(deposit[1]).to.eq('50');
      })
    })
  })
  
  describe('Deposit For Convert', async function () {
    describe("Revert", async function () {
      it("Reverts if BDV is 0", async function () {
        await expect(this.convert.connect(user2).depositForConvertE(this.siloToken.address, '100', '0', '100')).to.be.revertedWith("Convert: BDV or amount is 0.")
      })

      it("Reverts if amount is 0", async function () {
        await expect(this.convert.connect(user2).depositForConvertE(this.siloToken.address, '0', '100', '100')).to.be.revertedWith("Convert: BDV or amount is 0.")
      })
    })

    describe('Deposit Tokens No Grown', async function () {
      beforeEach(async function () {
        this.result = await this.convert.connect(user2).depositForConvertE(this.siloToken.address, '100', '100', '0');
      });

      it('Emits event', async function () {
        await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(user2Address, this.siloToken.address, to6('4'), '100', '100');
      })

      it('increment totals', async function () {
        expect(await this.siloGetters.getTotalDeposited(this.siloToken.address)).to.equal('200');
        expect(await this.siloGetters.getTotalDepositedBdv(this.siloToken.address)).to.eq('200');
        expect(await this.siloGetters.totalStalk()).to.equal('2000100');
        expect(await this.siloGetters.getGerminatingTotalDeposited(this.siloToken.address)).to.equal('100');
        expect(await this.siloGetters.getGerminatingTotalDepositedBdv(this.siloToken.address)).to.eq('100');
        expect(await this.siloGetters.getTotalGerminatingStalk()).to.equal('1000000');
      })

      it('increment balances', async function () {
        expect(await this.siloGetters.balanceOfStalk(user2Address)).to.equal('0');
        expect(await this.siloGetters.balanceOfGerminatingStalk(user2Address)).to.equal('1000000');
      })

      it('properly adds the crate', async function () {
        const deposit = await this.siloGetters.getDeposit(user2Address, this.siloToken.address, to6('4'));
        expect(deposit[0]).to.eq('100');
        expect(deposit[1]).to.eq('100');
      })
    })

    // with the germination update, deposits that are germinating cannot be 
    // converted. However, there are instances where a non-germinating deposit
    // is converted into a partially germinating deposit. This test checks that the
    // convert function properly handles this case.
    describe('Deposit not germinating', async function () {
      beforeEach(async function () {
        expect(await this.siloGetters.getTotalDeposited(this.siloToken.address)).to.equal('200');
        expect(await this.siloGetters.getTotalDepositedBdv(this.siloToken.address)).to.eq('200');
        expect(await this.siloGetters.totalStalk()).to.equal('2000100');
        expect(await this.siloGetters.getGerminatingTotalDeposited(this.siloToken.address)).to.equal('0');
        expect(await this.siloGetters.getGerminatingTotalDepositedBdv(this.siloToken.address)).to.eq('0');
        expect(await this.siloGetters.getTotalGerminatingStalk()).to.equal('0');
        this.result = await this.convert.connect(user2).depositForConvertE(this.siloToken.address, '100', '100', '100');
      });

      it('Emits event', async function () {
        await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(
          user2Address, 
          this.siloToken.address, 
          to6('3'), 
          '100', 
          '100'
        );
      })

      it('Increment totals', async function () {
        expect(await this.siloGetters.getTotalDeposited(this.siloToken.address)).to.equal('200');
        expect(await this.siloGetters.getTotalDepositedBdv(this.siloToken.address)).to.eq('200');
        expect(await this.siloGetters.totalStalk()).to.equal('2000200');
        expect(await this.siloGetters.getGerminatingTotalDeposited(this.siloToken.address)).to.equal('100');
        expect(await this.siloGetters.getGerminatingTotalDepositedBdv(this.siloToken.address)).to.eq('100');
        expect(await this.siloGetters.getTotalGerminatingStalk()).to.equal('1000000');
      })
      // user 2 should have stalk == grown stalk 
      it('Increment balances', async function () {
        expect(await this.siloGetters.balanceOfStalk(user2Address)).to.equal('100');
        expect(await this.siloGetters.balanceOfGerminatingStalk(user2Address)).to.equal('1000000');
      })

      it('properly adds the crate', async function () {
        const deposit = await this.siloGetters.getDeposit(user2Address, this.siloToken.address, to6('3'));
        expect(deposit[0]).to.eq('100');
        expect(deposit[1]).to.eq('100');
      })
    })

    describe('Deposit Tokens more grown', async function () {
      beforeEach(async function () {
        expect(await this.siloGetters.getTotalDeposited(this.siloToken.address)).to.equal('200');
        expect(await this.siloGetters.getTotalDepositedBdv(this.siloToken.address)).to.eq('200');
        expect(await this.siloGetters.totalStalk()).to.equal('2000100');
        expect(await this.siloGetters.getGerminatingTotalDeposited(this.siloToken.address)).to.equal('0');
        expect(await this.siloGetters.getGerminatingTotalDepositedBdv(this.siloToken.address)).to.eq('0');
        expect(await this.siloGetters.getTotalGerminatingStalk()).to.equal('0');
        this.result = await this.convert.connect(user2).depositForConvertE(this.siloToken.address, '100', '100', '300');
      });

      it('Emits event', async function () {
        // at 300 grown stalk, this would need to have been deposited 3 seasons ago, or at grown stalk index of 1.
        // with the current grown stalk index at 4, 3 seasons ago would be 1.
        await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(
          user2Address, 
          this.siloToken.address, 
          to6('1'), 
          '100', 
          '100'
        );
      })

      it('Increment totals', async function () {
        expect(await this.siloGetters.getTotalDeposited(this.siloToken.address)).to.equal('300');
        expect(await this.siloGetters.getTotalDepositedBdv(this.siloToken.address)).to.eq('300');
        expect(await this.siloGetters.totalStalk()).to.equal('3000400');
        expect(await this.siloGetters.getGerminatingTotalDeposited(this.siloToken.address)).to.equal('0');
        expect(await this.siloGetters.getGerminatingTotalDepositedBdv(this.siloToken.address)).to.eq('0');
        expect(await this.siloGetters.getTotalGerminatingStalk()).to.equal('0');
      })

      it('Increment balances', async function () {
        expect(await this.siloGetters.balanceOfStalk(user2Address)).to.equal('1000300');
        expect(await this.siloGetters.balanceOfGerminatingStalk(user2Address)).to.equal('0');

      })

      it('properly adds the crate', async function () {
        const deposit = await this.siloGetters.getDeposit(user2Address, this.siloToken.address, to6('1'));
        expect(deposit[0]).to.eq('100');
        expect(deposit[1]).to.eq('100');
      })
    })
  });

  describe("lambda convert", async function () {

    beforeEach(async function () {
      this.result = await this.convert.connect(user).callStatic.convert(
        ConvertEncoder.convertLambdaToLambda(
          '100',
          this.siloToken.address
        ),
        [to6('2')],
        ['100']
      )
      expect(this.result.toStem).to.be.equal(to6('2'))
      expect(this.result.toAmount).to.be.equal('100')

      this.result = await this.convert.connect(user).convert(
        ConvertEncoder.convertLambdaToLambda(
          '200',
          this.siloToken.address
        ),
        [to6('1'), to6('2')],
        ['100', '100']
      )
    })

    it('returns correct value', async function () {
      
    })

    it('removes and adds deposit', async function () {
      let deposit = await this.siloGetters.getDeposit(userAddress, this.siloToken.address, to6('1'));
      expect(deposit[0]).to.eq('0');
      expect(deposit[1]).to.eq('0');

      deposit = await this.siloGetters.getDeposit(userAddress, this.siloToken.address, to6('2'));
      expect(deposit[0]).to.eq('0');
      expect(deposit[1]).to.eq('0');

      deposit = await this.siloGetters.getDeposit(userAddress, this.siloToken.address, to6('1.5'));
      expect(deposit[0]).to.eq('200');
      expect(deposit[1]).to.eq('200');
    })

    it('Increments balances', async function () {
      expect(await this.siloGetters.balanceOfStalk(userAddress)).to.equal('2000500');
    })

    it('Increments totals', async function () {
      expect(await this.siloGetters.getTotalDeposited(this.siloToken.address)).to.equal('200');
      expect(await this.siloGetters.getTotalDepositedBdv(this.siloToken.address)).to.eq('200');
      expect(await this.siloGetters.totalStalk()).to.equal('2000500');
    })

    it('Emits events', async function () {
      await expect(this.result).to.emit(this.silo, 'RemoveDeposits').withArgs(userAddress, this.siloToken.address, [to6('1'),  to6('2')], ['100', '100'], '200', ['100', '100']);
      await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(userAddress, this.siloToken.address, to6('1.5'), '200', '200');
    })
  })
});
