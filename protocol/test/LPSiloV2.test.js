const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')

let user,user2,owner;
let userAddress, ownerAddress, user2Address;
describe('Generalized Silo V2', function () {
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
    this.pair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pair);
    this.pegPair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pegPair);
    this.bean = await ethers.getContractAt('MockToken', contracts.bean);
    this.claim = await ethers.getContractAt('MockClaimFacet', this.diamond.address)

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
    await this.pair.faucet(userAddress, '1');
    await this.pair.faucet(user2Address, '1');
    await this.season.resetState();
    await this.season.siloSunrise(0);
  });

  describe('BDV', function () {
    describe('single BDV', function () {
  
      it('properly retrieves Uniswap BDV', async function () {
        const bdv = await this.silo.callStatic.getUniswapBDV(this.pair.address, '1')
        expect(bdv).to.be.equal('2000');
      });
  
    });
  });

  describe('deposit', function () {
    describe('single deposit', function () {
      beforeEach(async function () {
        this.result = await this.silo.connect(user).deposit(this.pair.address, '1');
      });
  
      it('properly adds the crate', async function () {
        const tokenDeposit = await this.silo.tokenDeposit(this.pair.address, userAddress, 2);
        expect(tokenDeposit[0]).to.be.equal('1');
        expect(tokenDeposit[1]).to.be.equal('2000');
      })

      it('properly increments user balances', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.be.equal('20000000');
        expect(await this.silo.balanceOfSeeds(userAddress)).to.be.equal('8000');
      })

      it('properly increments total balances', async function () {
        expect(await this.silo.totalDepositedToken(this.pair.address)).to.be.equal('1');
        expect(await this.silo.totalStalk()).to.be.equal('20000000');
        expect(await this.silo.totalSeeds()).to.be.equal('8000');
      })
  
      it('emits Deposit event', async function () {
        await expect(this.result).to.emit(this.silo, 'TokenDeposit').withArgs(this.pair.address, userAddress, 2, '1', '2000');
      });
    });
  });

  describe('withdraw', function () {
    describe('single deposit', function () {
      beforeEach(async function () {
        this.result = await this.silo.connect(user).deposit(this.pair.address, '1');
        this.result = await this.silo.connect(user).withdraw(this.pair.address, ['2'], ['1']);
      });

      it('properly removes the deposit', async function () {
        const tokenDeposit = await this.silo.tokenDeposit(this.pair.address, userAddress, 2);
        expect(tokenDeposit[0]).to.be.equal('0');
        expect(tokenDeposit[1]).to.be.equal('0');
      });

      it('properly removes the deposit', async function () {
        const tokenDeposit = await this.silo.tokenWithdrawal(this.pair.address, userAddress, 27);
        expect(tokenDeposit).to.be.equal('1');
      });

      it('properly increments user balances', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.be.equal('0');
        expect(await this.silo.balanceOfSeeds(userAddress)).to.be.equal('0');
      })

      it('properly increments total balances', async function () {
        expect(await this.silo.totalDepositedToken(this.pair.address)).to.be.equal('0');
        expect(await this.silo.totalWithdrawnToken(this.pair.address)).to.be.equal('1');
        expect(await this.silo.totalStalk()).to.be.equal('0');
        expect(await this.silo.totalSeeds()).to.be.equal('0');
      })
  
      it('emits Deposit event', async function () {
        await expect(this.result).to.emit(this.silo, 'TokenRemove').withArgs(this.pair.address, userAddress, [2], ['1'], '1');
        await expect(this.result).to.emit(this.silo, 'TokenWithdraw').withArgs(this.pair.address, userAddress, 27, '1');
      });
    });
  });
});
