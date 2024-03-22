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
    // user1 deposits 2 times at stem 1 and 2 100 silo tokens , so 100 bdv for each deposit
    await this.season.siloSunrise(0);
    await this.season.mockEndTotalGerminationForToken(this.siloToken.address);
    await this.season.siloSunrise(0);
    await this.season.mockEndTotalGerminationForToken(this.siloToken.address);

    // To isolate the anti lamda functionality, we will create and whitelist a new silo token
    this.newSiloToken = await ethers.getContractFactory("MockToken");
    this.newSiloToken = await this.newSiloToken.deploy("Silo2", "SILO2")
    await this.newSiloToken.deployed()

    await this.silo.mockWhitelistToken(
      this.newSiloToken.address, // token                        
      this.silo.interface.getSighash("newMockBDV()"), // selector (returns 1e6)
      '1', // stalkIssuedPerBdv
      1e6 //aka "1 seed" // stalkEarnedPerSeason
    );
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
        await expect(this.convert.connect(user).withdrawForConvertE(this.siloToken.address, [to6('1'), to6('2')], ['100'], '100', userAddress)).to.be.revertedWith('Convert: stems, amounts are diff lengths.')
      });

      it('crate balance too low', async function () {
        //params are token, stem, amounts, maxtokens
        // await expect(this.convert.connect(user).withdrawForConvertE(this.siloToken.address, ['0'], ['150'], '150')).to.be.revertedWith('Silo: Crate balance too low.') //before moving to constants for the original 4 whitelisted tokens (post replant), this test would revert with 'Silo: Crate balance too low.', but now it reverts with 'Must line up with season' because there's no constant seeds amount hardcoded in for this test token
        await expect(this.convert.connect(user).withdrawForConvertE(this.siloToken.address, [to6('2')], ['150'], '150', userAddress)).to.be.revertedWith('Silo: Crate balance too low.')
      });

      it('not enough removed', async function () {
        await expect(this.convert.connect(user).withdrawForConvertE(this.siloToken.address, [to6('2')], ['100'], '150', userAddress)).to.be.revertedWith('Convert: Not enough tokens removed.')
      });
    })

    //this test withdraws from stem index of 2, verifies they are removed correctly and stalk balances updated
    describe("Withdraw 1 Crate", async function () {
      beforeEach(async function () {
        this.result = await this.convert.connect(user).withdrawForConvertE(this.siloToken.address, [to6('2')], ['100'], '100', userAddress);
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
        this.result = await this.convert.connect(user).withdrawForConvertE(this.siloToken.address, [to6('2'), to6('1')], ['100', '100'], '100', userAddress);
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
        this.result = await this.convert.connect(user).withdrawForConvertE(this.siloToken.address, [to6('1'), to6('2')], ['100', '50'], '150', userAddress);
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
        this.result = await this.convert.connect(user).withdrawForConvertE(this.siloToken.address, [to6('1'), to6('2')], ['100', '100'], '150', userAddress);
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
        await expect(this.convert.connect(user2).depositForConvertE(this.siloToken.address, '100', '0', '100', user2Address)).to.be.revertedWith("Convert: BDV or amount is 0.")
      })

      it("Reverts if amount is 0", async function () {
        await expect(this.convert.connect(user2).depositForConvertE(this.siloToken.address, '0', '100', '100', user2Address)).to.be.revertedWith("Convert: BDV or amount is 0.")
      })
    })

    describe('Deposit Tokens No Grown', async function () {
      beforeEach(async function () {
        this.result = await this.convert.connect(user2).depositForConvertE(this.siloToken.address, '100', '100', '0', user2Address);
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
        this.result = await this.convert.connect(user2).depositForConvertE(this.siloToken.address, '100', '100', '100', user2Address);
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
        this.result = await this.convert.connect(user2).depositForConvertE(this.siloToken.address, '100', '100', '300', user2Address);
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

  //  ------------------------------ ANTI LAMBDA CONVERT ----------------------------------

  describe("anti lambda convert bdv decrease", async function () {

    beforeEach(async function () {
      // ----------------------- SETUP ------------------------
      // user deposits 100 new silo token at stem 0 so 1000000 bdv
      await this.newSiloToken.mint(userAddress, '10000000');
      await this.newSiloToken.connect(user).approve(this.silo.address, '1000000000');
      await this.silo.connect(user).deposit(this.newSiloToken.address, '100', EXTERNAL);

      // simulate deposit bdv decrease for user by changing bdv selector to newMockBDVDecrease ie 0.9e6
      await this.silo.mockChangeBDVSelector(this.newSiloToken.address, this.silo.interface.getSighash("newMockBDVDecrease()"))
      const currentBdv = await this.silo.newMockBDVDecrease()
      let depositResult = await this.siloGetters.getDeposit(userAddress, this.newSiloToken.address, 0)
      const depositBdv = depositResult[1]

      // ----------------------- CONVERT ------------------------
      this.result = await this.convert.connect(user2).convert(
        // CALLDATA                              // amount, token ,account
        ConvertEncoder.convertAntiLambdaToLambda('100', this.newSiloToken.address , userAddress),
        // STEMS []
        ['0'],
        // AMOUNTS []
        ['100']
      )
    })

    it('Correctly updates deposit stats', async function () {
      let deposit = await this.siloGetters.getDeposit(userAddress, this.newSiloToken.address, 0);
      expect(deposit[0]).to.eq('100'); // deposit[0] = amount of tokens
      expect(deposit[1]).to.eq('900000');  // deposit[1] = bdv
    })

    it('Correctly updates totals', async function () {
      expect(await this.silo.getTotalDeposited(this.newSiloToken.address)).to.equal('100');
      expect(await this.silo.getTotalDepositedBdv(this.newSiloToken.address)).to.eq('900000');
      // 100000 stalk removed = 1 stalk/bdv for newSiloToken * 100000 bdv removed from convert
      expect(await this.silo.totalStalk()).to.equal('2900100');
    })

    it('Emits events', async function () {
      await expect(this.result).to.emit(this.silo, 'RemoveDeposits').withArgs(userAddress, this.newSiloToken.address, [0], ['100'], '100', ['1000000']);
      await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(userAddress, this.newSiloToken.address, 0, '100', '900000'); // last param = updated bdv
      await expect(this.result).to.emit(this.convert, 'Convert').withArgs(userAddress, this.newSiloToken.address, this.newSiloToken.address, '100', '100');
    })

  })

  describe("anti lambda convert bdv increase", async function () {

    beforeEach(async function () {
      // ----------------------- SETUP ------------------------
      // user deposits 100 new silo token at stem 0 so 1000000 bdv
      await this.newSiloToken.mint(userAddress, '10000000');
      await this.newSiloToken.connect(user).approve(this.silo.address, '1000000000');
      await this.silo.connect(user).deposit(this.newSiloToken.address, '100', EXTERNAL);

      // simulate deposit bdv decrease for user2 by changing bdv selector to mockBdvIncrease ie 1.1e6
      await this.silo.mockChangeBDVSelector(this.newSiloToken.address, this.silo.interface.getSighash("newMockBDVIncrease()"))
      currentBdv = await this.silo.newMockBDVIncrease()
      let depositResult = await this.siloGetters.getDeposit(userAddress, this.newSiloToken.address, 0)
      const depositBdv = depositResult[1]

      // ----------------------- CONVERT ------------------------
      this.result = await this.convert.connect(user2).convert(
        // CALLDATA                              // amount, token ,account
        ConvertEncoder.convertAntiLambdaToLambda('100', this.newSiloToken.address , userAddress),
        // STEMS []
        ['0'],
        // AMOUNTS []
        ['100']
      )
    })

    it('Correctly updates deposit stats', async function () {
      let deposit = await this.siloGetters.getDeposit(userAddress, this.newSiloToken.address, 0);
      expect(deposit[0]).to.eq('100'); // deposit[0] = amount of tokens
      expect(deposit[1]).to.eq('1100000');  // deposit[1] = bdv
    })

    // it('Correctly updates totals', async function () {
    //   expect(await this.siloGetters.getTotalDeposited(this.newSiloToken.address)).to.equal('100');
    //   expect(await this.siloGetters.getTotalDepositedBdv(this.newSiloToken.address)).to.eq('1100000');
    //   // 100000 stalk added = 1 stalk/bdv for newSiloToken * 100000 bdv added from convert
    //   expect(await this.siloGetters.totalStalk()).to.equal('3100100');
    // })

    // it('Emits events', async function () {
    //   await expect(this.result).to.emit(this.silo, 'RemoveDeposits').withArgs(userAddress, this.newSiloToken.address, [0], ['100'], '100', ['1000000']);
    //   await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(userAddress, this.newSiloToken.address, 0, '100', '1100000'); // last param = updated bdv
    //   await expect(this.result).to.emit(this.convert, 'Convert').withArgs(userAddress, this.newSiloToken.address, this.newSiloToken.address, '100', '100');
    // })

  })
});
