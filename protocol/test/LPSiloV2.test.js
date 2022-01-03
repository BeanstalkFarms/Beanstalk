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
    await this.season.resetState();
    await this.season.siloSunrise(0);
  });

  describe('deposit', function () {
    describe('single deposit', function () {
      beforeEach(async function () {
        this.result = await this.silo.connect(user).depositBeans('1000');
      });
  
      it('properly updates the total lp balances', async function () {
        await this.silo.incrementDepositedLPByPoolE('1', '0x87898263b6c5babe34b4ec53f22d98430b91e371')
        expect(await this.silo.totalDepositedLPByPool('0x87898263b6c5babe34b4ec53f22d98430b91e371')).to.eq('1');
      });
  
      it('properly updates the user balance', async function () {
        const lpDeposit = await this.silo.lpDeposit(userAddress, '27')
        expect(lpDeposit[0]).to.be.equal('0');
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
  });

});
