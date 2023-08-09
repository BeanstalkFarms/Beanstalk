const { expect } = require('chai')
const { deploy } = require('../scripts/deploy.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot")
const { to6, toStalk, toBean, to18 } = require('./utils/helpers.js');
const { USDC, UNRIPE_LP, BEAN,ETH_USDC_UNISWAP_V3, BASE_FEE_CONTRACT, THREE_CURVE, THREE_POOL, BEAN_3_CURVE } = require('./utils/constants.js');
const { EXTERNAL, INTERNAL } = require('./utils/balances.js');
const { ethers } = require('hardhat');
const { deployMockWell } = require('../utils/well.js');

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
    this.basefee = await ethers.getContractAt('MockBlockBasefee', BASE_FEE_CONTRACT);
    this.tokenFacet = await ethers.getContractAt('TokenFacet', contracts.beanstalkDiamond.address)
    this.bean = await ethers.getContractAt('MockToken', BEAN);
    this.threeCurve = await ethers.getContractAt('MockToken', THREE_CURVE);
    this.threePool = await ethers.getContractAt('Mock3Curve', THREE_POOL);
    await this.threePool.set_virtual_price(to18('1'));
    this.beanThreeCurve = await ethers.getContractAt('MockMeta3Curve', BEAN_3_CURVE);
    this.uniswapV3EthUsdc = await ethers.getContractAt('MockUniswapV3Pool', ETH_USDC_UNISWAP_V3);
    await this.beanThreeCurve.set_supply(toBean('100000'));
    await this.beanThreeCurve.set_A_precise('1000');
    await this.beanThreeCurve.set_virtual_price(to18('1'));
    await this.beanThreeCurve.set_balances([toBean('10000'), to18('10000')]);
    await this.beanThreeCurve.reset_cumulative();

    await this.usdc.mint(owner.address, to6('10000'))
    await this.bean.mint(owner.address, to6('10000'))
    await this.usdc.connect(owner).approve(this.diamond.address, to6('10000'))
    this.unripeLP = await ethers.getContractAt('MockToken', UNRIPE_LP)
    await this.unripeLP.mint(owner.address, to6('10000'));

    [this.well, this.wellFunction, this.pump] = await deployMockWell()

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

  // 30000 beans were minted
  // 10000 beans given to the silo
  // 10000 beans given to pay back podholders
  // 10000 beans given to fert holders
  // current temperature: 1%
  // soil issued with no coefficent: 10000/1.01 = 9900 
  // soil issued with low podrate: 9900 * 1.5 = 14850
  // soil issued with high podrate: 9000 * 0.5 = 4500
  it("delta B > 1, low pod rate", async function () {
    await this.season.setAbovePegE(true);
    await this.field.incrementTotalPodsE('10000');
    this.result = await this.season.sunSunrise('30000', 0);
    expect(await this.field.totalSoil()).to.be.equal('14850');
  })

  it("delta B > 1, medium pod rate", async function () {
    await this.field.incrementTotalPodsE('10000');
    this.result = await this.season.sunSunrise('30000', 8);
    expect(await this.field.totalSoil()).to.be.equal('9900'); 
  })

  it("delta B > 1, high pod rate", async function () {
    await this.field.incrementTotalPodsE('10000');
    this.result = await this.season.sunSunrise('30000', 25);
    expect(await this.field.totalSoil()).to.be.equal('4950');
    await expect(this.result).to.emit(this.season, 'Soil').withArgs(3, '4950');
  })

  it("only silo", async function () {
    this.result = await this.season.sunSunrise('100', 8);
    await expect(this.result).to.emit(this.season, 'Soil').withArgs(3, '0');
    await expect(this.result).to.emit(this.season, 'Reward').withArgs(3, '0', '100', '0');
    expect(await this.silo.totalStalk()).to.be.equal('1000000');
    expect(await this.silo.totalEarnedBeans()).to.be.equal('100');
  })

  it("some harvestable", async function () {
    // issue 15000 macro-pods
    await this.field.incrementTotalPodsE('15000');
    // 10000 microBeans to Field, 10000 microBeans to Silo 
    this.result = await this.season.sunSunrise('20000', 8);
    await expect(this.result).to.emit(this.season, 'Soil').withArgs(3, '9900');
    expect(await this.field.totalSoil()).to.be.equal('9900');
    await expect(this.result).to.emit(this.season, 'Reward').withArgs(3, '10000', '10000', '0');
    expect(await this.field.totalHarvestable()).to.be.equal('10000');
    expect(await this.silo.totalStalk()).to.be.equal('100000000');
    expect(await this.silo.totalEarnedBeans()).to.be.equal('10000');
  })

  it("all harvestable", async function () {
    await this.field.incrementTotalPodsE('5000');
    await this.season.setAbovePegE(true);
    this.result = await this.season.sunSunrise('15000', 8);
    // 5000 to barn, field, and silo
    // 5000/1.01 = 4950
    await expect(this.result).to.emit(this.season, 'Soil').withArgs(3, '4950');
    expect(await this.field.totalSoil()).to.be.equal('4950');
    await expect(this.result).to.emit(this.season, 'Reward').withArgs(3, '5000', '10000', '0');
    expect(await this.field.totalHarvestable()).to.be.equal('5000');
    expect(await this.silo.totalStalk()).to.be.equal('100000000');
    expect(await this.silo.totalEarnedBeans()).to.be.equal('10000');
  })

  it("all harvestable and all fertilizable", async function () {
    await this.field.incrementTotalPodsE(to6('50'));
    await this.fertilizer.connect(owner).addFertilizerOwner('6274', '20', '0');
    this.result = await this.season.sunSunrise(to6('200'), 8);
    
    expect(await this.field.totalSoil()).to.be.equal('49504950');
    await expect(this.result).to.emit(this.season, 'Soil').withArgs(3, 49504950);
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
    await this.field.incrementTotalPodsE('500');
    await this.fertilizer.connect(owner).addFertilizerOwner('0', '1', '0');
    this.result = await this.season.sunSunrise('2000', 8);
    await expect(this.result).to.emit(this.season, 'Soil').withArgs(3, '495');
    expect(await this.field.totalSoil()).to.be.equal('495');
    await expect(this.result).to.emit(this.season, 'Reward').withArgs(3, '500', '834', '666');

    expect(await this.fertilizer.isFertilizing()).to.be.equal(true);
    expect(await this.fertilizer.totalFertilizedBeans()).to.be.equal('666');
    expect(await this.fertilizer.getActiveFertilizer()).to.be.equal('1');
    expect(await this.fertilizer.getFirst()).to.be.equal(to6('6'))
    expect(await this.fertilizer.getLast()).to.be.equal(to6('6'))
    expect(await this.fertilizer.beansPerFertilizer()).to.be.equal(666)

    expect(await this.field.totalHarvestable()).to.be.equal('500');

    expect(await this.silo.totalStalk()).to.be.equal('8340000');
    expect(await this.silo.totalEarnedBeans()).to.be.equal('834');
  })

  it("some harvestable, some fertilizable", async function () {
    // increments pods by 1000
    // temperature is 1% 
    await this.field.incrementTotalPodsE('1000');
    // add 1 fertilizer owner, 1 fert (which is equal to 5 beans)
    await this.fertilizer.connect(owner).addFertilizerOwner('0', '1', '0')
    //sunrise with 1500 beans 500 given to field, silo, and barn
    this.result = await this.season.sunSunrise('1500', 8);
    // emit a event that 495 soil was issued at season 3 
    // 500/1.01 = ~495 (rounded down)
    await expect(this.result).to.emit(this.season, 'Soil').withArgs(3, '495');

    expect(await this.field.totalSoil()).to.be.equal('495');

    await expect(this.result).to.emit(this.season, 'Reward').withArgs(3, '500', '500', '500');

    expect(await this.fertilizer.isFertilizing()).to.be.equal(true);
    expect(await this.fertilizer.totalFertilizedBeans()).to.be.equal('500');
    expect(await this.fertilizer.getActiveFertilizer()).to.be.equal('1');
    expect(await this.fertilizer.getFirst()).to.be.equal(to6('6'))
    expect(await this.fertilizer.getLast()).to.be.equal(to6('6'))
    expect(await this.fertilizer.beansPerFertilizer()).to.be.equal(500)

    expect(await this.field.totalHarvestable()).to.be.equal('500');

    expect(await this.silo.totalStalk()).to.be.equal('5000000');
    expect(await this.silo.totalEarnedBeans()).to.be.equal('500');
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

    const VERBOSE = false;
    // [[pool balances], base fee, secondsLate, toMode]

    const mockedValues = [
      [[toBean('10000'), to18('6.666666')], 50 * Math.pow(10, 9), 0, EXTERNAL],
      [[toBean('10000'), to18('4.51949333333335')], 30 * Math.pow(10, 9), 0, EXTERNAL],
      [[toBean('50000'), to18('24.5848333333334')], 50 * Math.pow(10, 9), 0, EXTERNAL],
      [[toBean('10000'), to18('3.33333')], 90 * Math.pow(10, 9), 0, INTERNAL],
      [[toBean('10000'), to18('6.66666')], 50 * Math.pow(10, 9), 24, INTERNAL],
      [[toBean('10000'), to18('6.666666')], 50 * Math.pow(10, 9), 500, INTERNAL]
    ];
    let START_TIME = (await ethers.provider.getBlock('latest')).timestamp;
    await timeSkip(START_TIME + 60*60*3);
    // Load some beans into the wallet's internal balance, and note the starting time
    // This also accomplishes initializing curve oracle
    const initial = await this.season.gm(owner.address, INTERNAL);
    const block = await ethers.provider.getBlock(initial.blockNumber);
    START_TIME = (await ethers.provider.getBlock('latest')).timestamp;
    await this.season.setCurrentSeasonE(1);
    
    const startingBeanBalance = (await this.tokenFacet.getAllBalance(owner.address, BEAN)).totalBalance.toNumber() / Math.pow(10, 6);
    for (const mockVal of mockedValues) {

      snapshotId = await takeSnapshot();

      await this.well.setReserves(mockVal[0]);
      await this.well.setReserves(mockVal[0]);
      // Time skip an hour after setting new balance (twap will be very close to whats in mockVal)
      await timeSkip(START_TIME + 60*60);

      await this.basefee.setAnswer(mockVal[1]);

      const secondsLate = mockVal[2];
      const effectiveSecondsLate = Math.min(secondsLate, 300);
      await this.season.resetSeasonStart(secondsLate);

      // SUNRISE
      this.result = await this.season.gm(owner.address, mockVal[3]);
      
      // Verify that sunrise was profitable assuming a 50% average success rate
      
      const beanBalance = (await this.tokenFacet.getAllBalance(owner.address, BEAN)).totalBalance.toNumber() / Math.pow(10, 6);
      const rewardAmount = parseFloat((beanBalance - startingBeanBalance).toFixed(6));

      // Determine how much gas was used
      const txReceipt = await ethers.provider.getTransactionReceipt(this.result.hash);
      const gasUsed = txReceipt.gasUsed.toNumber();

      const blockBaseFee = await this.basefee.block_basefee() / Math.pow(10, 9);
      const GasCostInETH = blockBaseFee * gasUsed / Math.pow(10, 9);

      // Get mocked eth/bean prices
      const ethPrice = mockVal[1] / Math.pow(10, 6);
      const beanPrice = (await this.beanThreeCurve.get_bean_price()).toNumber() / Math.pow(10, 6);
      // How many beans are required to purchase 1 eth
      const beanEthPrice = mockVal[0][0] * 1e12 / mockVal[0][1];

      // Bean equivalent of the cost to execute sunrise
      const GasCostBean = GasCostInETH * beanEthPrice;

      if (VERBOSE) {
        // console.log('sunrise call tx', this.result);
        const logs = await ethers.provider.getLogs(this.result.hash);
        viewGenericUint256Logs(logs);
        console.log('reward beans: ', rewardAmount);
        console.log('eth price', ethPrice);
        console.log('bean price', beanPrice);
        console.log('gas used', gasUsed);
        console.log('to mode', mockVal[4]);
        console.log('base fee', blockBaseFee);
        console.log('failure adjusted gas cost (eth)', GasCostInETH);
        console.log('failure adjusted cost (bean)', GasCostBean);
        console.log('failure adjusted cost * late exponent (bean)', GasCostBean * Math.pow(1.01, effectiveSecondsLate));
      }

      expect(rewardAmount * beanPrice).to.greaterThan(GasCostBean * Math.pow(1.01, effectiveSecondsLate));

      await expect(this.result).to.emit(this.season, 'Incentivization')
          .withArgs(owner.address, Math.round(rewardAmount * Math.pow(10, 6)));
      await revertToSnapshot(snapshotId);
    }
  })

  it("rewards more than type(uint128).max/10000 to silo", async function () {
    await expect(this.season.siloSunrise('340282366920938463463374607431768211456')).to.be.revertedWith('SafeCast: value doesn\'t fit in 128 bits');
  })

  it("rewards more than type(uint128).max Soil below peg", async function () {
    await expect(this.season.sunSunrise('-340282366920938463463374607431768211456', '0')).to.be.revertedWith('SafeCast: value doesn\'t fit in 128 bits');
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

async function timeSkip(timestamp) {
  await hre.network.provider.request({
    method: "evm_setNextBlockTimestamp",
    params: [timestamp],
  });
}