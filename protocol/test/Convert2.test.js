const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { GeneralFunctionEncoder } = require('./utils/encoder.js')
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
    this.silo = await ethers.getContractAt('MockSiloV2Facet', this.diamond.address);
    this.convert = await ethers.getContractAt('MockConvertFacet', this.diamond.address);
    this.bean = await ethers.getContractAt('MockToken', contracts.bean);

    this.siloToken = await ethers.getContractFactory("MockToken");
    this.siloToken = await this.siloToken.deploy("Silo", "SILO")
    await this.siloToken.deployed()

    await this.silo.mockWhitelistToken(
      this.siloToken.address, 
      this.silo.interface.getSighash("mockBDV(uint256 amount)"), 
      '10000', 
      '1'
    );

    await this.bean.mint(userAddress, '1000000000');
    await this.bean.mint(user2Address, '1000000000');
    await this.bean.connect(user).approve(this.silo.address, '100000000000');
    await this.bean.connect(user2).approve(this.silo.address, '100000000000'); 
    await this.siloToken.connect(user).approve(this.silo.address, '100000000000');
    await this.siloToken.mint(userAddress, '10000');
    await this.season.siloSunrise(0);
    await this.silo.connect(user).deposit(this.siloToken.address, '100');
    await this.season.siloSunrise(0);
    await this.silo.connect(user).deposit(this.siloToken.address, '100');
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
        expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.equal('100');
        expect(await this.silo.totalStalk()).to.equal('1000100');
        expect(await this.silo.totalSeeds()).to.equal('100');
      })

      it('Decrements balances', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.equal('1000100');
        expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('100');
      })

      it('properly removes the crate', async function () {
        let deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, 2);
        expect(deposit[0]).to.eq('100');
        expect(deposit[1]).to.eq('100');
        deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, 3);
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
        expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.equal('100');
        expect(await this.silo.totalStalk()).to.equal('1000100');
        expect(await this.silo.totalSeeds()).to.equal('100');
      })

      it('Decrements balances', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.equal('1000100');
        expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('100');
      })

      it('properly removes the crate', async function () {
        let deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, 2);
        expect(deposit[0]).to.eq('100');
        expect(deposit[1]).to.eq('100');
        deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, 3);
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
        expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.equal('50');
        expect(await this.silo.totalStalk()).to.equal('500000');
        expect(await this.silo.totalSeeds()).to.equal('50');
      })

      it('Decrements balances', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.equal('500000');
        expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('50');
      })

      it('properly removes the crate', async function () {
        let deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, 2);
        expect(deposit[0]).to.eq('0');
        expect(deposit[1]).to.eq('0');
        deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, 3);
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
        expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.equal('50');
        expect(await this.silo.totalStalk()).to.equal('500000');
        expect(await this.silo.totalSeeds()).to.equal('50');
      })

      it('Decrements balances', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.equal('500000');
        expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('50');
      })

      it('properly removes the crate', async function () {
        let deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, 2);
        expect(deposit[0]).to.eq('0');
        expect(deposit[1]).to.eq('0');
        deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, 3);
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
        await expect(this.result).to.emit(this.silo, 'Deposit').withArgs(user2Address, this.siloToken.address, 3, '100', '100');
      })

      it('Decrements totals', async function () {
        expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.equal('300');
        expect(await this.silo.totalStalk()).to.equal('3000100');
        expect(await this.silo.totalSeeds()).to.equal('300');
      })

      it('Decrements balances', async function () {
        expect(await this.silo.balanceOfStalk(user2Address)).to.equal('1000000');
        expect(await this.silo.balanceOfSeeds(user2Address)).to.equal('100');
      })

      it('properly removes the crate', async function () {
        const deposit = await this.silo.getDeposit(user2Address, this.siloToken.address, 3);
        expect(deposit[0]).to.eq('100');
        expect(deposit[1]).to.eq('100');
      })
    })

    describe('Deposit Tokens some grown', async function () {
      beforeEach(async function () {
        this.result = await this.convert.connect(user2).depositForConvertE(this.siloToken.address, '100', '100', '100');
      });

      it('Emits event', async function () {
        await expect(this.result).to.emit(this.silo, 'Deposit').withArgs(user2Address, this.siloToken.address, 2, '100', '100');
      })

      it('Decrements totals', async function () {
        expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.equal('300');
        expect(await this.silo.totalStalk()).to.equal('3000200');
        expect(await this.silo.totalSeeds()).to.equal('300');
      })

      it('Decrements balances', async function () {
        expect(await this.silo.balanceOfStalk(user2Address)).to.equal('1000100');
        expect(await this.silo.balanceOfSeeds(user2Address)).to.equal('100');
      })

      it('properly removes the crate', async function () {
        const deposit = await this.silo.getDeposit(user2Address, this.siloToken.address, 2);
        expect(deposit[0]).to.eq('100');
        expect(deposit[1]).to.eq('100');
      })
    })

    describe('Deposit Tokens more grown', async function () {
      beforeEach(async function () {
        this.result = await this.convert.connect(user2).depositForConvertE(this.siloToken.address, '100', '100', '250');
      });

      it('Emits event', async function () {
        await expect(this.result).to.emit(this.silo, 'Deposit').withArgs(user2Address, this.siloToken.address, 1, '100', '100');
      })

      it('Decrements totals', async function () {
        expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.equal('300');
        expect(await this.silo.totalStalk()).to.equal('3000300');
        expect(await this.silo.totalSeeds()).to.equal('300');
      })

      it('Decrements balances', async function () {
        expect(await this.silo.balanceOfStalk(user2Address)).to.equal('1000200');
        expect(await this.silo.balanceOfSeeds(user2Address)).to.equal('100');
      })

      it('properly removes the crate', async function () {
        const deposit = await this.silo.getDeposit(user2Address, this.siloToken.address, 1);
        expect(deposit[0]).to.eq('100');
        expect(deposit[1]).to.eq('100');
      })
    })
  });
});
