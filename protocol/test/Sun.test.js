const { expect } = require('chai')
const { deploy } = require('../scripts/deploy.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot")
const { toStalk, to6, to18 } = require('./utils/helpers.js');
const { USDC, UNRIPE_BEAN, UNRIPE_LP, BEAN, ETH_USDC_UNISWAP_V3, BASE_FEE_CONTRACT, THREE_CURVE, THREE_POOL, BEAN_3_CURVE, BEAN_ETH_WELL, WSTETH, ZERO_BYTES, BEAN_WSTETH_WELL } = require('./utils/constants.js');
const { EXTERNAL, INTERNAL } = require('./utils/balances.js');
const { ethers } = require('hardhat');
const { setEthUsdChainlinkPrice, setWstethUsdPrice } = require('../utils/oracle.js');
const { deployBasin } = require('../scripts/basin.js');
const { deployBasinV1_1Upgrade } = require('../scripts/basinV1_1.js');
const { getAllBeanstalkContracts } = require("../utils/contracts");
const { getBean } = require('../utils/index.js');

let user, user2, owner;


describe('Sun', function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners()
    
    const contracts = await deploy(verbose = false, mock = true, reset = true)
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [ beanstalk, mockBeanstalk ] = await getAllBeanstalkContracts(this.diamond.address);
    
    this.usdc = await ethers.getContractAt('MockToken', USDC);
    this.wsteth = await ethers.getContractAt('MockToken', WSTETH);
    
  
    // These are needed for sunrise incentive test
    this.basefee = await ethers.getContractAt('MockBlockBasefee', BASE_FEE_CONTRACT);
    bean = await getBean()
    this.threeCurve = await ethers.getContractAt('MockToken', THREE_CURVE);
    this.threePool = await ethers.getContractAt('Mock3Curve', THREE_POOL);
    await this.threePool.set_virtual_price(to18('1'));
    this.beanThreeCurve = await ethers.getContractAt('MockMeta3Curve', BEAN_3_CURVE);
    this.uniswapV3EthUsdc = await ethers.getContractAt('MockUniswapV3Pool', ETH_USDC_UNISWAP_V3);
    
    await this.beanThreeCurve.set_supply(to6('100000'));
    await this.beanThreeCurve.set_A_precise('1000');
    await this.beanThreeCurve.set_virtual_price(to18('1'));
    await this.beanThreeCurve.set_balances([to6('10000'), to18('10000')]);
    await this.beanThreeCurve.reset_cumulative();

    await this.usdc.mint(owner.address, to6('10000'))
    await bean.mint(owner.address, to6('10000'))
    await this.wsteth.mint(owner.address, to18('10000'))
    await this.usdc.connect(owner).approve(this.diamond.address, to6('10000'))
    await this.wsteth.connect(owner).approve(this.diamond.address, to18('10000'))
    this.unripeBean = await ethers.getContractAt('MockToken', UNRIPE_BEAN)

    // add unripe
    this.unripeLP = await ethers.getContractAt('MockToken', UNRIPE_LP)
    await this.unripeLP.mint(user.address, to6('1000'))
    await this.unripeLP.connect(user).approve(this.diamond.address, to6('100000000'))
    await this.unripeBean.mint(user.address, to6('1000'))
    await this.unripeBean.connect(user).approve(this.diamond.address, to6('100000000'))
    await mockBeanstalk.addUnripeToken(UNRIPE_BEAN, BEAN, ZERO_BYTES)
    await mockBeanstalk.addUnripeToken(UNRIPE_LP, BEAN_WSTETH_WELL, ZERO_BYTES);

    await setEthUsdChainlinkPrice('1000');
    await setWstethUsdPrice('1000');

    // let c = await deployBasin(true, undefined, false, true)
    // await c.multiFlowPump.update([to6('10000'), to18('10')], 0x00);
    // await c.multiFlowPump.update([to6('10000'), to18('10')], 0x00);
    // c = await deployBasinV1_1Upgrade(c, true, undefined, false, true, mockPump=true)
    // await c.multiFlowPump.update([to6('10000'), to18('10')], 0x00);
    // await c.multiFlowPump.update([to6('10000'), to18('10')], 0x00);
    // this.pump = c.multiFlowPump;

    await mockBeanstalk.siloSunrise(0)
  })

  beforeEach(async function () {
    snapshotId = await takeSnapshot()
  })

  afterEach(async function () {
    await revertToSnapshot(snapshotId)
  })

  it("delta B < 1", async function () {
    this.result = await mockBeanstalk.sunSunrise('-100', 8);
    await expect(this.result).to.emit(beanstalk, 'Soil').withArgs(3, '100');
  })

  it("delta B == 1", async function () {
    this.result = await mockBeanstalk.sunSunrise('0', 8);
    await expect(this.result).to.emit(beanstalk, 'Soil').withArgs(3, '0');
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
    await mockBeanstalk.setAbovePegE(true);
    await mockBeanstalk.incrementTotalPodsE('10000');
    this.result = await mockBeanstalk.sunSunrise('30000', 0);
    expect(await beanstalk.totalSoil()).to.be.equal('14850');
  })

  it("delta B > 1, medium pod rate", async function () {
    await mockBeanstalk.incrementTotalPodsE('10000');
    this.result = await mockBeanstalk.sunSunrise('30000', 8);
    expect(await beanstalk.totalSoil()).to.be.equal('9900'); 
  })

  it("delta B > 1, high pod rate", async function () {
    await mockBeanstalk.incrementTotalPodsE('10000');
    this.result = await mockBeanstalk.sunSunrise('30000', 25);
    expect(await beanstalk.totalSoil()).to.be.equal('4950');
    await expect(this.result).to.emit(beanstalk, 'Soil').withArgs(3, '4950');
  })

  it("only silo", async function () {
    this.result = await mockBeanstalk.sunSunrise('100', 8);
    await expect(this.result).to.emit(beanstalk, 'Soil').withArgs(3, '0');
    await expect(this.result).to.emit(beanstalk, 'Reward').withArgs(3, '0', '100', '0');
    expect(await beanstalk.totalStalk()).to.be.equal('1000000');
    expect(await beanstalk.totalEarnedBeans()).to.be.equal('100');
  })

  it("some harvestable", async function () {
    // issue 15000 macro-pods
    await mockBeanstalk.incrementTotalPodsE('15000');
    // 10000 microBeans to Field, 10000 microBeans to Silo 
    this.result = await mockBeanstalk.sunSunrise('20000', 8);
    await expect(this.result).to.emit(beanstalk, 'Soil').withArgs(3, '9900');
    expect(await beanstalk.totalSoil()).to.be.equal('9900');
    await expect(this.result).to.emit(beanstalk, 'Reward').withArgs(3, '10000', '10000', '0');
    expect(await beanstalk.totalHarvestable()).to.be.equal('10000');
    expect(await beanstalk.totalStalk()).to.be.equal('100000000');
    expect(await beanstalk.totalEarnedBeans()).to.be.equal('10000');
  })

  it("all harvestable", async function () {
    await mockBeanstalk.incrementTotalPodsE('5000');
    await mockBeanstalk.setAbovePegE(true);
    this.result = await mockBeanstalk.sunSunrise('15000', 8);
    // 5000 to barn, field, and silo
    // 5000/1.01 = 4950
    await expect(this.result).to.emit(beanstalk, 'Soil').withArgs(3, '4950');
    expect(await beanstalk.totalSoil()).to.be.equal('4950');
    await expect(this.result).to.emit(beanstalk, 'Reward').withArgs(3, '5000', '10000', '0');
    expect(await beanstalk.totalHarvestable()).to.be.equal('5000');
    expect(await beanstalk.totalStalk()).to.be.equal('100000000');
    expect(await beanstalk.totalEarnedBeans()).to.be.equal('10000');
  })

  it("all harvestable and all fertilizable", async function () {
    await mockBeanstalk.incrementTotalPodsE(to6('50'));
    await mockBeanstalk.connect(owner).addFertilizerOwner('6274', to18('0.02'), '0');
    this.result = await mockBeanstalk.sunSunrise(to6('200'), 8);
    
    expect(await beanstalk.totalSoil()).to.be.equal('49504950');
    await expect(this.result).to.emit(beanstalk, 'Soil').withArgs(3, 49504950);
    await expect(this.result).to.emit(beanstalk, 'Reward').withArgs(3, to6('50'), to6('100'), to6('50'));

    expect(await mockBeanstalk.isFertilizing()).to.be.equal(false);
    expect(await mockBeanstalk.totalFertilizedBeans()).to.be.equal(to6('50'));
    expect(await mockBeanstalk.getActiveFertilizer()).to.be.equal(to6('0'));
    expect(await mockBeanstalk.getFirst()).to.be.equal(0)
    expect(await mockBeanstalk.getLast()).to.be.equal(0)
    expect(await mockBeanstalk.beansPerFertilizer()).to.be.equal(to6('2.5'))

    expect(await beanstalk.totalHarvestable()).to.be.equal(to6('50'));

    expect(await beanstalk.totalStalk()).to.be.equal(toStalk('100'));
    expect(await beanstalk.totalEarnedBeans()).to.be.equal(to6('100'));
  })

  it("all harvestable, some fertilizable", async function () {
    await mockBeanstalk.incrementTotalPodsE('500');
    await mockBeanstalk.connect(owner).addFertilizerOwner('0', to18('0.001'), '0');
    this.result = await mockBeanstalk.sunSunrise('2000', 8);
    await expect(this.result).to.emit(beanstalk, 'Soil').withArgs(3, '495');
    expect(await beanstalk.totalSoil()).to.be.equal('495');
    await expect(this.result).to.emit(beanstalk, 'Reward').withArgs(3, '500', '834', '666');

    expect(await mockBeanstalk.isFertilizing()).to.be.equal(true);
    expect(await mockBeanstalk.totalFertilizedBeans()).to.be.equal('666');
    expect(await mockBeanstalk.getActiveFertilizer()).to.be.equal('1');
    expect(await mockBeanstalk.getFirst()).to.be.equal(to6('6'))
    expect(await mockBeanstalk.getLast()).to.be.equal(to6('6'))
    expect(await mockBeanstalk.beansPerFertilizer()).to.be.equal(666)

    expect(await beanstalk.totalHarvestable()).to.be.equal('500');

    expect(await beanstalk.totalStalk()).to.be.equal('8340000');
    expect(await beanstalk.totalEarnedBeans()).to.be.equal('834');
  })

  it("some harvestable, some fertilizable", async function () {
    // increments pods by 1000
    // temperature is 1% 
    await mockBeanstalk.incrementTotalPodsE('1000');
    // add 1 fertilizer owner, 1 fert (which is equal to 5 beans)
    await mockBeanstalk.connect(owner).addFertilizerOwner('0', to18('0.001'), '0')
    //sunrise with 1500 beans 500 given to field, silo, and barn
    this.result = await mockBeanstalk.sunSunrise('1500', 8);
    // emit a event that 495 soil was issued at season 3 
    // 500/1.01 = ~495 (rounded down)
    await expect(this.result).to.emit(beanstalk, 'Soil').withArgs(3, '495');

    expect(await beanstalk.totalSoil()).to.be.equal('495');

    await expect(this.result).to.emit(beanstalk, 'Reward').withArgs(3, '500', '500', '500');

    expect(await mockBeanstalk.isFertilizing()).to.be.equal(true);
    expect(await mockBeanstalk.totalFertilizedBeans()).to.be.equal('500');
    expect(await mockBeanstalk.getActiveFertilizer()).to.be.equal('1');
    expect(await mockBeanstalk.getFirst()).to.be.equal(to6('6'))
    expect(await mockBeanstalk.getLast()).to.be.equal(to6('6'))
    expect(await mockBeanstalk.beansPerFertilizer()).to.be.equal(500)

    expect(await beanstalk.totalHarvestable()).to.be.equal('500');

    expect(await beanstalk.totalStalk()).to.be.equal('5000000');
    expect(await beanstalk.totalEarnedBeans()).to.be.equal('500');
  })

  it("1 all and 1 some fertilizable", async function () {
    await mockBeanstalk.incrementTotalPodsE(to6('250'));
    await mockBeanstalk.connect(owner).addFertilizerOwner('0', to18('0.04'), '0')
    this.result = await mockBeanstalk.sunSunrise(to6('120'), 8);
    await mockBeanstalk.connect(owner).addFertilizerOwner('6374', to18('0.04'), '0')
    this.result = await mockBeanstalk.sunSunrise(to6('480'), 8);

    expect(await mockBeanstalk.isFertilizing()).to.be.equal(true);
    expect(await mockBeanstalk.totalFertilizedBeans()).to.be.equal(to6('200'));
    expect(await mockBeanstalk.getActiveFertilizer()).to.be.equal('40');
    expect(await mockBeanstalk.getFirst()).to.be.equal(to6('6'))
    expect(await mockBeanstalk.getLast()).to.be.equal(to6('6'))
    expect(await mockBeanstalk.beansPerFertilizer()).to.be.equal(to6('3'))

    expect(await beanstalk.totalHarvestable()).to.be.equal(to6('200'));

    expect(await beanstalk.totalStalk()).to.be.equal(toStalk('200'));
    expect(await beanstalk.totalEarnedBeans()).to.be.equal(to6('200'));
  })

  it("sunrise reward", async function() {

    const VERBOSE = false;
    // [[pool balances], base fee, secondsLate, toMode]

    const mockedValues = [
      [[to6('10000'), to18('6.666666')], 50 * Math.pow(10, 9), 0, EXTERNAL],
      [[to6('10000'), to18('4.51949333333335')], 30 * Math.pow(10, 9), 0, EXTERNAL],
      [[to6('50000'), to18('24.5848333333334')], 50 * Math.pow(10, 9), 0, EXTERNAL],
      [[to6('10000'), to18('3.33333')], 50 * Math.pow(10, 9), 0, INTERNAL],
      [[to6('10000'), to18('6.66666')], 50 * Math.pow(10, 9), 24, INTERNAL],
      [[to6('10000'), to18('6.666666')], 50 * Math.pow(10, 9), 500, INTERNAL]
    ];
    let START_TIME = (await ethers.provider.getBlock('latest')).timestamp;
    await timeSkip(START_TIME + 60*60*3);
    // Load some beans into the wallet's internal balance, and note the starting time
    // This also accomplishes initializing curve oracle
    const initial = await beanstalk.gm(owner.address, INTERNAL);
    const block = await ethers.provider.getBlock(initial.blockNumber);
    START_TIME = (await ethers.provider.getBlock('latest')).timestamp;
    await mockBeanstalk.setCurrentSeasonE(1);
    
    const startingBeanBalance = (await beanstalk.getAllBalance(owner.address, BEAN)).totalBalance.toNumber() / Math.pow(10, 6);
    for (const mockVal of mockedValues) {

      snapshotId = await takeSnapshot();

      // await this.pump.update(mockVal[0], 0x00);
      // await this.pump.update(mockVal[0], 0x00);

      // Time skip an hour after setting new balance (twap will be very close to whats in mockVal)
      await timeSkip(START_TIME + 60*60);

      await this.basefee.setAnswer(mockVal[1]);

      const secondsLate = mockVal[2];
      const effectiveSecondsLate = Math.min(secondsLate, 300);
      await mockBeanstalk.resetSeasonStart(secondsLate);

      // SUNRISE
      this.result = await beanstalk.gm(owner.address, mockVal[3]);
      
      // Verify that sunrise was profitable assuming a 50% average success rate
      
      const beanBalance = (await beanstalk.getAllBalance(owner.address, BEAN)).totalBalance.toNumber() / Math.pow(10, 6);
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

      await expect(this.result).to.emit(beanstalk, 'Incentivization')
          .withArgs(owner.address, Math.round(rewardAmount * Math.pow(10, 6)));
      await revertToSnapshot(snapshotId);
    }

  })

  it('ends germination', async function () {

    await mockBeanstalk.teleportSunrise(5);
    await mockBeanstalk.mockIncrementGermination(
      BEAN,
      to6('1000'),
      to6('1000'),
      1
    );
    expect((await beanstalk.getEvenGerminating(BEAN))[0]).to.be.equal(to6('1000'));
    expect((await beanstalk.getEvenGerminating(BEAN))[1]).to.be.equal(to6('1000'));
    this.result = await mockBeanstalk.siloSunrise(0);
    
    await expect(this.result).to.emit(beanstalk, 'TotalGerminatingBalanceChanged')
      .withArgs(
        '6',
        BEAN, 
        to6('-1000'), 
        to6('-1000')
      );
    expect((await beanstalk.getEvenGerminating(BEAN))[0]).to.be.equal(to6('0'));
    expect((await beanstalk.getEvenGerminating(BEAN))[1]).to.be.equal(to6('0'));
  });

  it("rewards more than type(uint128).max/10000 to silo", async function () {
    await expect(mockBeanstalk.siloSunrise('340282366920938463463374607431768211456')).to.be.revertedWith('SafeCast: value doesn\'t fit in 128 bits');
  })

  it("rewards more than type(uint128).max Soil below peg", async function () {
    await expect(mockBeanstalk.sunSunrise('-340282366920938463463374607431768211456', '0')).to.be.revertedWith('SafeCast: value doesn\'t fit in 128 bits');
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