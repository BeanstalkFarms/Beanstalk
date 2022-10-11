const { expect } = require('chai')
const { deploy } = require('../scripts/deploy.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot")
const { to6, toStalk, toBean, to18 } = require('./utils/helpers.js');
const { USDC, UNRIPE_LP, BEAN, CHAINLINK_CONTRACT, BASE_FEE_CONTRACT, THREE_CURVE, THREE_POOL, BEAN_3_CURVE } = require('./utils/constants.js');
const { EXTERNAL, INTERNAL } = require('./utils/balances.js');
const { ethers } = require('hardhat');

let user, user2, owner;
let userAddress, ownerAddress, user2Address;

describe('Sun', function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners()
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true)
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
    this.fertilizer = await ethers.getContractAt('MockFertilizerFacet', this.diamond.address)
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address)
    this.field = await ethers.getContractAt('MockFieldFacet', this.diamond.address)
    this.usdc = await ethers.getContractAt('MockToken', USDC);
  
    // These are needed for sunrise incentive test
    this.chainlink = await ethers.getContractAt('MockChainlink', CHAINLINK_CONTRACT);
    this.basefee = await ethers.getContractAt('MockBlockBasefee', BASE_FEE_CONTRACT);
    this.bean = await ethers.getContractAt('MockToken', BEAN);
    this.threeCurve = await ethers.getContractAt('MockToken', THREE_CURVE);
    this.threePool = await ethers.getContractAt('Mock3Curve', THREE_POOL);
    await this.threePool.set_virtual_price(to18('1'));
    this.beanThreeCurve = await ethers.getContractAt('MockMeta3Curve', BEAN_3_CURVE);
    await this.beanThreeCurve.set_supply(toBean('100000'));
    await this.beanThreeCurve.set_A_precise('1000');
    await this.beanThreeCurve.set_virtual_price(to18('1'));
    // Set twice so the prev balance is nonzero
    await this.beanThreeCurve.set_balances([toBean('1000000'), to18('1000000')]);
    await this.beanThreeCurve.set_balances([toBean('1000000'), to18('1000000')]);
    await this.beanThreeCurve.reset_cumulative();

    await this.usdc.mint(owner.address, to6('10000'))
    await this.usdc.connect(owner).approve(this.diamond.address, to6('10000'))
    this.unripeLP = await ethers.getContractAt('MockToken', UNRIPE_LP)
    await this.unripeLP.mint(owner.address, to6('10000'))

    await this.season.siloSunrise(0)
  })

  beforeEach(async function () {
    snapshotId = await takeSnapshot()
  })

  afterEach(async function () {
    await revertToSnapshot(snapshotId)
  })

  it("delta B < 1", async function () {
    this.result = await this.season.sunSunrise('-100', 8);
    await expect(this.result).to.emit(this.season, 'Soil').withArgs(3, '100');
  })

  it("delta B == 1", async function () {
    this.result = await this.season.sunSunrise('0', 8);
    await expect(this.result).to.emit(this.season, 'Soil').withArgs(3, '0');
  })

  it("delta B > 1, low pod rate", async function () {
    await this.field.incrementTotalPodsE('100');
    this.result = await this.season.sunSunrise('300', 0);
    expect(await this.field.totalSoil()).to.be.equal('148')
  })

  it("delta B > 1, medium pod rate", async function () {
    await this.field.incrementTotalPodsE('100');
    this.result = await this.season.sunSunrise('300', 8);
    expect(await this.field.totalSoil()).to.be.equal('99')
  })

  it("delta B > 1, high pod rate", async function () {
    await this.field.incrementTotalPodsE('100');
    this.result = await this.season.sunSunrise('300', 25);
    await expect(this.result).to.emit(this.season, 'Soil').withArgs(3, '49');
  })

  it("only silo", async function () {
    this.result = await this.season.sunSunrise('100', 8);
    await expect(this.result).to.emit(this.season, 'Soil').withArgs(3, '0');
    await expect(this.result).to.emit(this.season, 'Reward').withArgs(3, '0', '100', '0');

    expect(await this.silo.totalStalk()).to.be.equal('1000000');
    expect(await this.silo.totalEarnedBeans()).to.be.equal('100');
  })

  it("some harvestable", async function () {
    await this.field.incrementTotalPodsE('150');
    this.result = await this.season.sunSunrise('200', 8);
    await expect(this.result).to.emit(this.season, 'Soil').withArgs(3, '99');
    await expect(this.result).to.emit(this.season, 'Reward').withArgs(3, '100', '100', '0');

    expect(await this.field.totalHarvestable()).to.be.equal('100');

    expect(await this.silo.totalStalk()).to.be.equal('1000000');
    expect(await this.silo.totalEarnedBeans()).to.be.equal('100');
  })

  it("all harvestable", async function () {
    await this.field.incrementTotalPodsE('50');
    this.result = await this.season.sunSunrise('150', 8);
    await expect(this.result).to.emit(this.season, 'Soil').withArgs(3, '49');
    await expect(this.result).to.emit(this.season, 'Reward').withArgs(3, '50', '100', '0');

    expect(await this.field.totalHarvestable()).to.be.equal('50');

    expect(await this.silo.totalStalk()).to.be.equal('1000000');
    expect(await this.silo.totalEarnedBeans()).to.be.equal('100');
  })

  it("all harvestable and all fertilizable", async function () {
    await this.field.incrementTotalPodsE(to6('50'));
    await this.fertilizer.connect(owner).addFertilizerOwner('6274', '20', '0')
    this.result = await this.season.sunSunrise(to6('200'), 8);
    await expect(this.result).to.emit(this.season, 'Soil').withArgs(3, '49504950');
    await expect(this.result).to.emit(this.season, 'Reward').withArgs(3, to6('50'), to6('100'), to6('50'));

    expect(await this.fertilizer.isFertilizing()).to.be.equal(false);
    expect(await this.fertilizer.totalFertilizedBeans()).to.be.equal(to6('50'));
    expect(await this.fertilizer.getActiveFertilizer()).to.be.equal(to6('0'));
    expect(await this.fertilizer.getFirst()).to.be.equal(0)
    expect(await this.fertilizer.getLast()).to.be.equal(0)
    expect(await this.fertilizer.beansPerFertilizer()).to.be.equal(to6('2.5'))

    expect(await this.field.totalHarvestable()).to.be.equal(to6('50'));

    expect(await this.silo.totalStalk()).to.be.equal(toStalk('100'));
    expect(await this.silo.totalEarnedBeans()).to.be.equal(to6('100'));
  })

  it("all harvestable, some fertilizable", async function () {
    await this.field.incrementTotalPodsE('50');
    await this.fertilizer.connect(owner).addFertilizerOwner('0', '1', '0')
    this.result = await this.season.sunSunrise('200', 8);
    await expect(this.result).to.emit(this.season, 'Soil').withArgs(3, '49');
    await expect(this.result).to.emit(this.season, 'Reward').withArgs(3, '50', '84', '66');

    expect(await this.fertilizer.isFertilizing()).to.be.equal(true);
    expect(await this.fertilizer.totalFertilizedBeans()).to.be.equal('66');
    expect(await this.fertilizer.getActiveFertilizer()).to.be.equal('1');
    expect(await this.fertilizer.getFirst()).to.be.equal(to6('6'))
    expect(await this.fertilizer.getLast()).to.be.equal(to6('6'))
    expect(await this.fertilizer.beansPerFertilizer()).to.be.equal(66)

    expect(await this.field.totalHarvestable()).to.be.equal('50');

    expect(await this.silo.totalStalk()).to.be.equal('840000');
    expect(await this.silo.totalEarnedBeans()).to.be.equal('84');
  })

  it("some harvestable, some fertilizable", async function () {
    await this.field.incrementTotalPodsE('100');
    await this.fertilizer.connect(owner).addFertilizerOwner('0', '1', '0')
    this.result = await this.season.sunSunrise('150', 8);
    await expect(this.result).to.emit(this.season, 'Soil').withArgs(3, '49');
    await expect(this.result).to.emit(this.season, 'Reward').withArgs(3, '50', '50', '50');

    expect(await this.fertilizer.isFertilizing()).to.be.equal(true);
    expect(await this.fertilizer.totalFertilizedBeans()).to.be.equal('50');
    expect(await this.fertilizer.getActiveFertilizer()).to.be.equal('1');
    expect(await this.fertilizer.getFirst()).to.be.equal(to6('6'))
    expect(await this.fertilizer.getLast()).to.be.equal(to6('6'))
    expect(await this.fertilizer.beansPerFertilizer()).to.be.equal(50)

    expect(await this.field.totalHarvestable()).to.be.equal('50');

    expect(await this.silo.totalStalk()).to.be.equal('500000');
    expect(await this.silo.totalEarnedBeans()).to.be.equal('50');
  })

  it("1 all and 1 some fertilizable", async function () {
    await this.field.incrementTotalPodsE(to6('250'));
    await this.fertilizer.connect(owner).addFertilizerOwner('0', '40', '0')
    this.result = await this.season.sunSunrise(to6('120'), 8);
    await this.fertilizer.connect(owner).addFertilizerOwner('6374', '40', '0')
    this.result = await this.season.sunSunrise(to6('480'), 8);

    expect(await this.fertilizer.isFertilizing()).to.be.equal(true);
    expect(await this.fertilizer.totalFertilizedBeans()).to.be.equal(to6('200'));
    expect(await this.fertilizer.getActiveFertilizer()).to.be.equal('40');
    expect(await this.fertilizer.getFirst()).to.be.equal(to6('6'))
    expect(await this.fertilizer.getLast()).to.be.equal(to6('6'))
    expect(await this.fertilizer.beansPerFertilizer()).to.be.equal(to6('3'))

    expect(await this.field.totalHarvestable()).to.be.equal(to6('200'));

    expect(await this.silo.totalStalk()).to.be.equal(toStalk('200'));
    expect(await this.silo.totalEarnedBeans()).to.be.equal(to6('200'));
  })

  it("sunrise reward", async function() {

    const VERBOSE = true;
    const mockedEthAndBasefee = [
      [1500 * Math.pow(10, 8), 15 * Math.pow(10, 9)],
      [3000 * Math.pow(10, 8), 30 * Math.pow(10, 9)],
      [1500 * Math.pow(10, 8), 330 * Math.pow(10, 9)],
      [3000 * Math.pow(10, 8), 150 * Math.pow(10, 9)]
    ];

    let prevBalance = 0;
    for (const mockAns of mockedEthAndBasefee) {

      await this.chainlink.setAnswer(mockAns[0]);
      await this.basefee.setAnswer(mockAns[1]);

      this.result = await this.season.sunrise(EXTERNAL);
      // Use this to test reward exponentiation
      // const block = await ethers.provider.getBlock(this.result.blockNumber);
      // console.log(block.timestamp, new Date(block.timestamp * 1000));
      
      // Verify that sunrise was profitable assuming a 50% average success rate
      // Get bean balance after reward. Assumption is that the balance of the sender was zero previously
      const beanBalance = (await this.bean.balanceOf(this.result.from)).toNumber() / Math.pow(10, 6);
      const rewardAmount = parseFloat((beanBalance - prevBalance).toFixed(6));
      prevBalance = beanBalance;

      // Determine how much gas was used
      const txReceipt = await ethers.provider.getTransactionReceipt(this.result.hash);
      const gasUsed = txReceipt.gasUsed.toNumber();
      const FAIL_GAS_BUFFER = 36000;

      // Calculate gas amount using the mocked baseFee + priority
      const PRIORITY = 5;
      const blockBaseFee = await this.basefee.block_basefee() / Math.pow(10, 9);
      const failAdjustedGasCostEth = (blockBaseFee + PRIORITY) * (gasUsed + FAIL_GAS_BUFFER) / Math.pow(10, 9);

      // Get mocked eth/bean prices
      const ethPrice = (await this.chainlink.latestAnswer()).toNumber() / Math.pow(10, 8);
      const beanPrice = 1.2; // TODO
      // How many beans are required to purcahse 1 eth
      const beanEthPrice = ethPrice / beanPrice;

      // Bean equivalent of the cost to execute sunrise
      const failAdjustedGasCostBean = failAdjustedGasCostEth * beanEthPrice;

      if (VERBOSE) {
        console.log('sunrise call tx', this.result);
        const logs = await ethers.provider.getLogs(this.result.hash);
        viewGenericUint256Logs(logs);
        console.log('reward beans: ', rewardAmount);
        console.log('eth price', ethPrice);
        console.log('gas used', gasUsed);
        console.log('base fee', blockBaseFee);
        console.log('failure adjusted gas cost (eth)', failAdjustedGasCostEth);
        console.log('failure adjusted cost (bean)', failAdjustedGasCostBean);
      }

      expect(rewardAmount).to.greaterThan(failAdjustedGasCostBean);

      await expect(this.result).to.emit(this.season, 'Incentivization')
          .withArgs(owner.address, Math.trunc(rewardAmount * Math.pow(10, 6)));
    }
  })
})

function viewGenericUint256Logs(logs) {
  const uint256Topic = '0x925a839279bd49ac1cea4c9d376477744867c1a536526f8c2fd13858e78341fb';
  for (const log of logs) {
    if (log.topics.includes(uint256Topic)) {
      console.log('Value: ', parseInt(log.data.substring(2, 66), 16));
      console.log('Label: ', hexToAscii(log.data.substring(66)));
      console.log();
    }
  }
}

function hexToAscii(str1) {
	var hex  = str1.toString();
	var str = '';
	for (var n = 0; n < hex.length; n += 2) {
		str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
	}
	return str;
}