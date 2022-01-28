const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')

let user,user2,owner;
let userAddress, ownerAddress, user2Address;
describe('Legacy LP Silo Support', function () {
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
    this.weth = await ethers.getContractAt('MockToken', contracts.weth)
    this.claim = await ethers.getContractAt('MockClaimFacet', this.diamond.address)

    await this.pair.simulateTrade('10000', '10');
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
    await this.pair.faucet(userAddress, '5');
    await this.pair.faucet(user2Address, '5');
    await this.pair.burnTokens(this.bean.address);
    await this.pair.burnTokens(this.weth.address);
    await this.season.resetState();
    await this.season.siloSunrise(0);
    await this.pair.simulateTrade('10000', '10');

    await this.silo.connect(user).mockLegacySiloDeposit(2, '1')
    await this.silo.connect(user).mockLegacySiloDeposit(1, '1')
    await this.silo.connect(user).deposit(this.pair.address, '1')
  });

  describe("Withdraw", async function () {
    it('Withdraw just Legacy', async function () {
      const result = await this.silo.connect(user).withdrawLegacyLP([2],['1'],[true]);

      expect(result).to.emit(this.silo, 'LegacyLPRemove').withArgs(userAddress, [2], ['1'], [true], '1');

      const deposit = await this.silo.legacyLPDeposit(userAddress, 2)
      expect(deposit[0]).to.be.equal(0);
      expect(deposit[1]).to.be.equal(0);
      expect(await this.silo.tokenWithdrawal(userAddress, this.pair.address, '27')).to.be.equal('1');

      expect(await this.silo.totalDepositedToken(this.pair.address)).to.be.equal('2');
      expect(await this.silo.totalWithdrawnToken(this.pair.address)).to.be.equal('1');

      expect(await this.silo.balanceOfStalk(userAddress)).to.be.equal('40008000');
      expect(await this.silo.balanceOfSeeds(userAddress)).to.be.equal('16000');

      expect(await this.silo.totalStalk()).to.be.equal('40008000');
      expect(await this.silo.totalSeeds()).to.be.equal('16000');
    });

    it('Withdraw 2 Legacy', async function () {
      const result = await this.silo.connect(user).withdrawLegacyLP([1, 2],['1', '1'],[true, true]);

      expect(result).to.emit(this.silo, 'LegacyLPRemove').withArgs(userAddress, [1, 2], ['1', '1'], [true, true], '2');

      const deposit = await this.silo.legacyLPDeposit(userAddress, 2)
      expect(deposit[0]).to.be.equal(0);
      expect(deposit[1]).to.be.equal(0);
      expect(await this.silo.tokenWithdrawal(userAddress, this.pair.address, '27')).to.be.equal('2');

      expect(await this.silo.totalDepositedToken(this.pair.address)).to.be.equal('1');
      expect(await this.silo.totalWithdrawnToken(this.pair.address)).to.be.equal('2');

      expect(await this.silo.balanceOfStalk(userAddress)).to.be.equal('20000000');
      expect(await this.silo.balanceOfSeeds(userAddress)).to.be.equal('8000');

      expect(await this.silo.totalStalk()).to.be.equal('20000000');
      expect(await this.silo.totalSeeds()).to.be.equal('8000');
    });

    it('Withdraw both Legacy + New', async function () {
      const result = await this.silo.connect(user).withdrawLegacyLP([2, 2],['1', '1'],[true, false]);

      expect(result).to.emit(this.silo, 'LegacyLPRemove').withArgs(userAddress, [2, 2], ['1', '1'], [true, false], '2');

      const deposit = await this.silo.legacyLPDeposit(userAddress, 2)
      expect(deposit[0]).to.be.equal(0);
      expect(deposit[1]).to.be.equal(0);
      expect(await this.silo.tokenWithdrawal(userAddress, this.pair.address, '27')).to.be.equal('2')

      expect(await this.silo.totalDepositedToken(this.pair.address)).to.be.equal('1');
      expect(await this.silo.totalWithdrawnToken(this.pair.address)).to.be.equal('2');

      expect(await this.silo.balanceOfStalk(userAddress)).to.be.equal('20008000');
      expect(await this.silo.balanceOfSeeds(userAddress)).to.be.equal('8000');

      expect(await this.silo.totalStalk()).to.be.equal('20008000');
      expect(await this.silo.totalSeeds()).to.be.equal('8000');
    });
  });

  describe("Convert", async function () {
    beforeEach(async function () {
      await this.pair.simulateTrade('40000', '10000');
      await this.pegPair.simulateTrade('20000', '20000');
      await this.bean.mint(this.pair.address, '400000');
      await this.weth.mint(this.pair.address, '100000');
    });

    it("Converts just legacy", async function () {
      this.result = await this.convert.connect(user).convertDepositedLegacyLP('1','100',['2'],['1'], [true]);
      // this.result = await this.convert.connect(user).convertDepositedLP('1','100',['2'],['1']);


      // const deposit = await this.silo.legacyLPDeposit(userAddress, 2)
      // expect(deposit[0]).to.be.equal(0);
      // expect(deposit[1]).to.be.equal(0);
      expect(await this.silo.totalDepositedToken(this.pair.address)).to.be.equal('2');
      expect(await this.silo.totalDepositedBeans()).to.be.equal('60000');

      expect(await this.silo.balanceOfStalk(userAddress)).to.be.equal('640008000');
      expect(await this.silo.balanceOfSeeds(userAddress)).to.be.equal('136000');

      expect(await this.silo.totalStalk()).to.be.equal('640008000');
      expect(await this.silo.totalSeeds()).to.be.equal('136000');
    })

    it("Converts old legacy", async function () {
      this.result = await this.convert.connect(user).convertDepositedLegacyLP('1','100',['1'],['1'], [true]);

      const deposit = await this.silo.legacyLPDeposit(userAddress, 1)
      expect(deposit[0]).to.be.equal(0);
      expect(deposit[1]).to.be.equal(0);
      expect(await this.silo.totalDepositedToken(this.pair.address)).to.be.equal('2');
      expect(await this.silo.totalDepositedBeans()).to.be.equal('60000');

      expect(await this.silo.balanceOfStalk(userAddress)).to.be.equal('640000000');
      expect(await this.silo.balanceOfSeeds(userAddress)).to.be.equal('136000');

      expect(await this.silo.totalStalk()).to.be.equal('640000000');
      expect(await this.silo.totalSeeds()).to.be.equal('136000');
    })

    it("Converts old and new legacy", async function () {
      this.result = await this.convert.connect(user).convertDepositedLegacyLP('2','100',['1', '2'],['1', '1'], [true, false]);

      const deposit = await this.silo.legacyLPDeposit(userAddress, 1)
      expect(deposit[0]).to.be.equal(0);
      expect(deposit[1]).to.be.equal(0);
      expect(await this.silo.totalDepositedToken(this.pair.address)).to.be.equal('1');
      expect(await this.silo.totalDepositedBeans()).to.be.equal('106666');

      expect(await this.silo.balanceOfStalk(userAddress)).to.be.equal('1086660000');
      expect(await this.silo.balanceOfSeeds(userAddress)).to.be.equal('221332');

      expect(await this.silo.totalStalk()).to.be.equal('1086660000');
      expect(await this.silo.totalSeeds()).to.be.equal('221332');
    })

  });
});
