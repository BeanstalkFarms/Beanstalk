const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
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
    this.diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', this.diamond.address)
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address);
    this.convert = await ethers.getContractAt('MockConvertFacet', this.diamond.address);
    this.bean = await ethers.getContractAt('MockToken', BEAN);

    this.siloToken = await ethers.getContractFactory("MockToken");
    this.siloToken = await this.siloToken.deploy("Silo", "SILO")
    await this.siloToken.deployed()

    await this.silo.mockWhitelistToken(
      this.siloToken.address, 
      this.silo.interface.getSighash("mockBDV(uint256 amount)"), 
      '10000', 
      1e6, //aka "1 seed"
      '1'
    );

    console.log('totalstalk 1: ', await this.silo.totalStalk());

    //test setup includes making 2 deposits, one at grownStalkPerBdv of 1, and another deposit at 2

    await this.bean.mint(userAddress, '1000000000');
    await this.bean.mint(user2Address, '1000000000');
    await this.bean.connect(user).approve(this.silo.address, '100000000000');
    await this.bean.connect(user2).approve(this.silo.address, '100000000000'); 
    await this.siloToken.connect(user).approve(this.silo.address, '100000000000');
    await this.siloToken.mint(userAddress, '10000');
    console.log('start season: ', await this.season.season());
    console.log('totalstalk 2: ', await this.silo.totalStalk());
    await this.season.siloSunrise(0);
    console.log('totalstalk 3: ', await this.silo.totalStalk());
    await this.silo.connect(user).deposit(this.siloToken.address, '100', EXTERNAL);
    console.log('totalstalk 3a: ', await this.silo.totalStalk());
    await this.season.siloSunrise(0);
    console.log('totalstalk 4: ', await this.silo.totalStalk());
    await this.silo.connect(user).deposit(this.siloToken.address, '100', EXTERNAL); //something about this deposit adds extra stalk
    console.log('totalstalk 5: ', await this.silo.totalStalk());
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
        await expect(this.convert.connect(user).withdrawForConvertE(this.siloToken.address, ['1', '2'], ['100'], '100')).to.be.revertedWith('Convert: grownStalkPerBdvs, amounts are diff lengths.')
      });

      it('crate balance too low', async function () {
        //params are token, grownStalkPerBdv, amounts, maxtokens
        // await expect(this.convert.connect(user).withdrawForConvertE(this.siloToken.address, ['0'], ['150'], '150')).to.be.revertedWith('Silo: Crate balance too low.') //TODOSEEDS write a test that reverts with Silo: Crate balance too low.
        await expect(this.convert.connect(user).withdrawForConvertE(this.siloToken.address, ['0'], ['150'], '150')).to.be.revertedWith('Must line up with season')
      });

      it('not enough removed', async function () {
        await expect(this.convert.connect(user).withdrawForConvertE(this.siloToken.address, ['2'], ['100'], '150')).to.be.revertedWith('Convert: Not enough tokens removed.')
      });
    })

    //this test withdraws from grownStalkPerBdv index of 2, verifies they are removed correctly and stalk balances updated
    describe("Withdraw 1 Crate", async function () {
      beforeEach(async function () {
        this.result = await this.convert.connect(user).withdrawForConvertE(this.siloToken.address, ['2'], ['100'], '100');
      })

      it('Emits event', async function () {
        await expect(this.result).to.emit(this.convert, 'RemoveDeposits').withArgs(userAddress, this.siloToken.address, [2], ['100'], '100');
        await expect(this.result).to.emit(this.convert, 'MockConvert').withArgs('0', '100');
      })

      it('Decrements totals', async function () {
        expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.equal('100');
        expect(await this.silo.totalStalk()).to.equal('1000100');
        //expect(await this.silo.totalSeeds()).to.equal('100');
      })

      it('Decrements balances', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.equal('1000100');
        //expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('100');
      })

      it('properly removes the crate', async function () {
        let deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, 1);
        console.log('deposit: ', deposit);
        expect(deposit[0]).to.eq('100');
        expect(deposit[1]).to.eq('100');
        deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, 2);
        console.log('deposit 2: ', deposit);
        expect(deposit[0]).to.eq('0');
        expect(deposit[1]).to.eq('0');
      })
    })

    //this test withdraws from grownStalkPerBdv indexes of 2 and 1
    describe("Withdraw 1 Crate 2 input", async function () {
      beforeEach(async function () {
        this.result = await this.convert.connect(user).withdrawForConvertE(this.siloToken.address, ['2', '1'], ['100', '100'], '100');
      })

      it('Emits event', async function () {
        await expect(this.result).to.emit(this.convert, 'RemoveDeposits').withArgs(userAddress, this.siloToken.address, [2, 1], ['100', '0'], '100');
        await expect(this.result).to.emit(this.convert, 'MockConvert').withArgs('0', '100');
      })

      it('Decrements totals', async function () {
        expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.equal('100');
        expect(await this.silo.totalStalk()).to.equal('1000100');
        //expect(await this.silo.totalSeeds()).to.equal('100');
      })

      it('Decrements balances', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.equal('1000100');
        //expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('100');
      })

      it('properly removes the crate', async function () {
        let deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, 1);
        expect(deposit[0]).to.eq('100');
        expect(deposit[1]).to.eq('100');
        deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, 2);
        expect(deposit[0]).to.eq('0');
        expect(deposit[1]).to.eq('0');
      })
    })

    //withdraws less than the full deposited amount from grownStalkPerBdv indexes of 2 and 1
    describe("Withdraw 2 Crates exact", async function () {
      beforeEach(async function () {
        this.result = await this.convert.connect(user).withdrawForConvertE(this.siloToken.address, ['1', '2'], ['100', '50'], '150');
      })

      it('Emits event', async function () { 
        // console.log('checking for first emit');
        // await expect(this.result).to.emit(this.convert, 'RemoveDeposits').withArgs(userAddress, this.siloToken.address, [1, 2], ['100', '50'], '150');
        console.log('checking for second emit');
        await expect(this.result).to.emit(this.convert, 'MockConvert').withArgs('100', '150');
      })

      it('Decrements totals', async function () {
        expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.equal('50');
        expect(await this.silo.totalStalk()).to.equal('500000');
        //expect(await this.silo.totalSeeds()).to.equal('50');
      })

      it('Decrements balances', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.equal('500000');
        //expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('50');
      })

      it('properly removes the crate', async function () {
        let deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, 1);
        expect(deposit[0]).to.eq('0');
        expect(deposit[1]).to.eq('0');
        deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, 2);
        expect(deposit[0]).to.eq('50');
        expect(deposit[1]).to.eq('50');
      })
    })

    describe("Withdraw 2 Crates under", async function () {
      beforeEach(async function () {
        this.result = await this.convert.connect(user).withdrawForConvertE(this.siloToken.address, ['1', '2'], ['100', '100'], '150');
      })

      it('Emits event', async function () { 
        await expect(this.result).to.emit(this.convert, 'RemoveDeposits').withArgs(userAddress, this.siloToken.address, [1, 2], ['100','50'], '150');
        await expect(this.result).to.emit(this.convert, 'MockConvert').withArgs('100', '150');
      })

      it('Decrements totals', async function () {
        expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.equal('50');
        expect(await this.silo.totalStalk()).to.equal('500000');
        //expect(await this.silo.totalSeeds()).to.equal('50');
      })

      it('Decrements balances', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.equal('500000');
        //expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('50');
      })

      it('properly removes the crate', async function () {
        let deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, 1);
        expect(deposit[0]).to.eq('0');
        expect(deposit[1]).to.eq('0');
        deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, 2);
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
        await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(user2Address, this.siloToken.address, 2, '100', '100');
      })

      it('Decrements totals', async function () {
        expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.equal('300');
        expect(await this.silo.totalStalk()).to.equal('3000100');
        //expect(await this.silo.totalSeeds()).to.equal('300');
      })

      it('Decrements balances', async function () {
        expect(await this.silo.balanceOfStalk(user2Address)).to.equal('1000000');
        //expect(await this.silo.balanceOfSeeds(user2Address)).to.equal('100');
      })

      it('properly removes the crate', async function () {
        const deposit = await this.silo.getDeposit(user2Address, this.siloToken.address, 2);
        expect(deposit[0]).to.eq('100');
        expect(deposit[1]).to.eq('100');
      })
    })

    describe('Deposit Tokens some grown', async function () {
      beforeEach(async function () {
        this.result = await this.convert.connect(user2).depositForConvertE(this.siloToken.address, '100', '100', '100');
      });

      it('Emits event', async function () {
        //seasons start at 1 and the current season is 3
        //a deposit with 100 grown stalk, when the "seeds" count is 1, means that 1 season has passed since this deposit
        //and the current grown stalk index should be 2, since a total of 2 seasons have passed (1->2, 2->3)
        //so "1 grown stalk season ago" would be season 1
        await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(user2Address, this.siloToken.address, 1, '100', '100');
      })

      it('Decrements totals', async function () {
        expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.equal('300');
        expect(await this.silo.totalStalk()).to.equal('3000200');
        //expect(await this.silo.totalSeeds()).to.equal('300');
      })

      it('Decrements balances', async function () {
        expect(await this.silo.balanceOfStalk(user2Address)).to.equal('1000100');
        //expect(await this.silo.balanceOfSeeds(user2Address)).to.equal('100');
      })

      it('properly removes the crate', async function () {
        const deposit = await this.silo.getDeposit(user2Address, this.siloToken.address, 1);
        expect(deposit[0]).to.eq('100');
        expect(deposit[1]).to.eq('100');
      })
    })

    describe('Deposit Tokens more grown', async function () {
      beforeEach(async function () {
        //current season
        console.log('this.season.season(): ', await this.season.season());
        
        this.result = await this.convert.connect(user2).depositForConvertE(this.siloToken.address, '100', '100', '250');
      });

      it('Emits event', async function () {
        //at 250 grown stalk, this would need to have been deposited 2.5 seasons ago, or at grown stalk index of 2.5
        //But guess what, we don't have decimals for 2.5, only 2, so you'll lose 0.5 seasons of grown stalk (30 mins)
        //so with the current grown stalk index at 2, 2 seasons ago would be 0
        await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(user2Address, this.siloToken.address, 0, '100', '100');
      })

      it('Decrements totals', async function () {
        expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.equal('300');
        expect(await this.silo.totalStalk()).to.equal('3000300');
        //expect(await this.silo.totalSeeds()).to.equal('300');
      })

      it('Decrements balances', async function () {
        expect(await this.silo.balanceOfStalk(user2Address)).to.equal('1000200');
        //expect(await this.silo.balanceOfSeeds(user2Address)).to.equal('100');
      })

      it('properly removes the crate', async function () {
        const deposit = await this.silo.getDeposit(user2Address, this.siloToken.address, 0);
        expect(deposit[0]).to.eq('100');
        expect(deposit[1]).to.eq('100');
      })
    })
  });

  describe("lambda convert", async function () {
    it('returns correct value', async function () {
      this.result = await this.convert.connect(user).callStatic.convert(
        ConvertEncoder.convertLambdaToLambda(
          '100',
          this.siloToken.address
        ),
        ['2'],
        ['100']
      )
      expect(this.result.toCumulativeGrownStalk).to.be.equal(2)
      expect(this.result.toAmount).to.be.equal('100')
    })

    beforeEach(async function () {
      this.result = await this.convert.connect(user).convert(
        ConvertEncoder.convertLambdaToLambda(
          '200',
          this.siloToken.address
        ),
        ['1', '2'],
        ['100', '100']
      )
    })

    it('removes and adds deposit', async function () {
      let deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, 1);
      expect(deposit[0]).to.eq('0');
      expect(deposit[1]).to.eq('0');

      deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, 2);
      expect(deposit[0]).to.eq('200');
      expect(deposit[1]).to.eq('200');
    })

    it('Decrements balances', async function () {
      expect(await this.silo.balanceOfStalk(userAddress)).to.equal('2000000');
      //expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('200');
    })

    it('Decrements totals', async function () {
      expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.equal('200');
      expect(await this.silo.totalStalk()).to.equal('2000000');
      //expect(await this.silo.totalSeeds()).to.equal('200');
    })

    it('Emits events', async function () {
      await expect(this.result).to.emit(this.silo, 'RemoveDeposits').withArgs(userAddress, this.siloToken.address, [1, 2], ['100', '100'], '200');
      await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(userAddress, this.siloToken.address, 2, '200', '200');
    })
  })
});
