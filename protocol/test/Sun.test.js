const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { toStalk, to6, to18 } = require("./utils/helpers.js");
const {
  USDC,
  UNRIPE_BEAN,
  UNRIPE_LP,
  BEAN,
  ETH_USDC_UNISWAP_V3,
  BEAN_ETH_WELL,
  WSTETH,
  ZERO_BYTES,
  BEAN_WSTETH_WELL
} = require("./utils/constants.js");
const { ethers } = require("hardhat");
const { setEthUsdChainlinkPrice, setWstethUsdPrice } = require("../utils/oracle.js");
const { getAllBeanstalkContracts } = require("../utils/contracts");
const { getBean } = require("../utils/index.js");
const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const { mine } = require("@nomicfoundation/hardhat-network-helpers");

// TODO
// Tests to add
// - Route with no underlying field/receiver.

let user, user2, owner;

describe("Sun", function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners();

    const contracts = await deploy((verbose = false), (mock = true), (reset = true));
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [beanstalk, mockBeanstalk] = await getAllBeanstalkContracts(this.diamond.address);

    let contractFactory = await ethers.getContractFactory("ShipmentPlanner", owner);
    contractFactory = await contractFactory.deploy(this.diamond.address);
    await contractFactory.deployed();
    if (verbose) console.log(`ShipmentPlanner deployed at ${contractFactory.address}`);
    this.shipmentPlanner = await ethers.getContractAt("ShipmentPlanner", contractFactory.address);

    await upgradeWithNewFacets({
      diamondAddress: this.diamond.address,
      initFacetName: "InitDistribution",
      initArgs: [contractFactory.address],
      bip: false,
      object: false,
      verbose: false,
      account: owner
    });
    this.shipmentRoutes = await beanstalk.getShipmentRoutes();
    if (verbose) console.log(this.shipmentRoutes);

    this.usdc = await ethers.getContractAt("MockToken", USDC);
    this.wsteth = await ethers.getContractAt("MockToken", WSTETH);

    // These are needed for sunrise incentive test
    bean = await getBean();
    this.uniswapV3EthUsdc = await ethers.getContractAt("MockUniswapV3Pool", ETH_USDC_UNISWAP_V3);

    await this.usdc.mint(owner.address, to6("10000"));
    await bean.mint(owner.address, to6("10000"));
    await this.wsteth.mint(owner.address, to18("10000"));
    await this.usdc.connect(owner).approve(this.diamond.address, to6("10000"));
    await this.wsteth.connect(owner).approve(this.diamond.address, to18("10000"));
    this.unripeBean = await ethers.getContractAt("MockToken", UNRIPE_BEAN);

    // add unripe
    this.unripeLP = await ethers.getContractAt("MockToken", UNRIPE_LP);
    await this.unripeLP.mint(user.address, to6("1000"));
    await this.unripeLP.connect(user).approve(this.diamond.address, to6("100000000"));
    await this.unripeBean.mint(user.address, to6("1000"));
    await this.unripeBean.connect(user).approve(this.diamond.address, to6("100000000"));
    await mockBeanstalk.addUnripeToken(UNRIPE_BEAN, BEAN, ZERO_BYTES);
    await mockBeanstalk.addUnripeToken(UNRIPE_LP, BEAN_WSTETH_WELL, ZERO_BYTES);

    await setEthUsdChainlinkPrice("1000");
    await setWstethUsdPrice("1000");

    // let c = await deployBasin(true, undefined, false, true)
    // await c.multiFlowPump.update([to6('10000'), to18('10')], 0x00);
    // await c.multiFlowPump.update([to6('10000'), to18('10')], 0x00);
    // c = await deployBasinV1_1Upgrade(c, true, undefined, false, true, mockPump=true)
    // await c.multiFlowPump.update([to6('10000'), to18('10')], 0x00);
    // await c.multiFlowPump.update([to6('10000'), to18('10')], 0x00);
    // this.pump = c.multiFlowPump;

    await mockBeanstalk.siloSunrise(0);
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  it("delta B < 1", async function () {
    this.result = await mockBeanstalk.sunSunrise("-100", 8);
    await expect(this.result).to.emit(beanstalk, "Soil").withArgs(3, "100");
  });

  it("delta B == 1", async function () {
    this.result = await mockBeanstalk.sunSunrise("0", 8);
    await expect(this.result).to.emit(beanstalk, "Soil").withArgs(3, "0");
  });

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
    await mockBeanstalk.incrementTotalPodsE(0, "10000");
    this.result = await mockBeanstalk.sunSunrise("30000", 0);
    expect(await beanstalk.totalSoil()).to.be.equal("14850");
  });

  it("delta B > 1, low pod rate, High L2SR", async function () {
    await mockBeanstalk.setAbovePegE(true);
    await mockBeanstalk.incrementTotalPodsE(0, "10000");
    this.result = await mockBeanstalk.sunSunrise("30000", 108);
    expect(await beanstalk.totalSoil()).to.be.equal("14850");
  });

  it("delta B > 1, medium pod rate", async function () {
    await mockBeanstalk.incrementTotalPodsE(0, "10000");
    this.result = await mockBeanstalk.sunSunrise("30000", 8);
    expect(await beanstalk.totalSoil()).to.be.equal("9900");
  });

  it("delta B > 1, high pod rate", async function () {
    await mockBeanstalk.incrementTotalPodsE(0, "10000");
    this.result = await mockBeanstalk.sunSunrise("30000", 25);
    expect(await beanstalk.totalSoil()).to.be.equal("4950");
    await expect(this.result).to.emit(beanstalk, "Soil").withArgs(3, "4950");
  });

  it("delta B > 1, high pod rate, High L2SR", async function () {
    await mockBeanstalk.incrementTotalPodsE(0, "10000");
    this.result = await mockBeanstalk.sunSunrise("30000", 133);
    expect(await beanstalk.totalSoil()).to.be.equal("4950");
    await expect(this.result).to.emit(beanstalk, "Soil").withArgs(3, "4950");
  });

  it("only silo", async function () {
    this.result = await mockBeanstalk.sunSunrise("100", 8);
    await expect(this.result).to.emit(beanstalk, "Soil").withArgs(3, "0");
    // await expect(this.result).to.emit(beanstalk, "Reward").withArgs(3, "0", "100", "0");
    await expect(this.result).to.emit(beanstalk, "Shipped");
    expect(await beanstalk.totalStalk()).to.be.equal("1000000");
    expect(await beanstalk.totalEarnedBeans()).to.be.equal("100");
  });

  it("some harvestable", async function () {
    // issue 15000 macro-pods
    await mockBeanstalk.incrementTotalPodsE(0, "15000");
    // 10000 microBeans to Field, 10000 microBeans to Silo
    this.result = await mockBeanstalk.sunSunrise("20000", 8);
    await expect(this.result).to.emit(beanstalk, "Soil").withArgs(3, "9900");
    expect(await beanstalk.totalSoil()).to.be.equal("9900");
    // await expect(this.result).to.emit(beanstalk, "Reward").withArgs(3, "10000", "10000", "0");
    await expect(this.result).to.emit(beanstalk, "Shipped");
    expect(await beanstalk.totalHarvestable(0)).to.be.equal("10000");
    expect(await beanstalk.totalStalk()).to.be.equal("100000000");
    expect(await beanstalk.totalEarnedBeans()).to.be.equal("10000");
  });

  it("all harvestable", async function () {
    await mockBeanstalk.incrementTotalPodsE(0, "5000");
    await mockBeanstalk.setAbovePegE(true);
    this.result = await mockBeanstalk.sunSunrise("15000", 8);
    // 5000 to barn, field, and silo
    // 5000/1.01 = 4950
    await expect(this.result).to.emit(beanstalk, "Soil").withArgs(3, "4950");
    expect(await beanstalk.totalSoil()).to.be.equal("4950");
    // await expect(this.result).to.emit(beanstalk, "Reward").withArgs(3, "5000", "10000", "0");
    await expect(this.result).to.emit(beanstalk, "Shipped");
    expect(await beanstalk.totalHarvestable(0)).to.be.equal("5000");
    expect(await beanstalk.totalStalk()).to.be.equal("100000000");
    expect(await beanstalk.totalEarnedBeans()).to.be.equal("10000");
  });

  it("all harvestable and all fertilizable", async function () {
    await mockBeanstalk.incrementTotalPodsE(0, to6("50"));
    await mockBeanstalk.connect(owner).addFertilizerOwner("6274", to18("0.02"), "0");
    this.result = await mockBeanstalk.sunSunrise(to6("200"), 8);

    expect(await beanstalk.totalSoil()).to.be.equal("49504950");
    await expect(this.result).to.emit(beanstalk, "Soil").withArgs(3, 49504950);
    await expect(this.result).to.emit(beanstalk, "Shipped");

    expect(await mockBeanstalk.isFertilizing()).to.be.equal(false);
    expect(await mockBeanstalk.totalFertilizedBeans()).to.be.equal(to6("50"));
    expect(await mockBeanstalk.getActiveFertilizer()).to.be.equal(to6("0"));
    expect(await mockBeanstalk.getFirst()).to.be.equal(0);
    expect(await mockBeanstalk.getLast()).to.be.equal(0);
    expect(await mockBeanstalk.beansPerFertilizer()).to.be.equal(to6("2.5"));

    expect(await beanstalk.totalHarvestable(0)).to.be.equal(to6("50"));

    expect(await beanstalk.totalStalk()).to.be.equal(toStalk("100"));
    expect(await beanstalk.totalEarnedBeans()).to.be.equal(to6("100"));
  });

  it("all harvestable, some fertilizable", async function () {
    await mockBeanstalk.incrementTotalPodsE(0, "500");
    await mockBeanstalk.connect(owner).addFertilizerOwner("0", to18("0.001"), "0");
    this.result = await mockBeanstalk.sunSunrise("2000", 8);
    await expect(this.result).to.emit(beanstalk, "Soil").withArgs(3, "495");
    expect(await beanstalk.totalSoil()).to.be.equal("495");
    // await expect(this.result).to.emit(beanstalk, "Reward").withArgs(3, "500", "834", "666");
    await expect(this.result).to.emit(beanstalk, "Shipped");

    expect(await mockBeanstalk.isFertilizing()).to.be.equal(true);
    expect(await mockBeanstalk.totalFertilizedBeans()).to.be.equal("750");
    expect(await mockBeanstalk.getActiveFertilizer()).to.be.equal("1");
    expect(await mockBeanstalk.getFirst()).to.be.equal(to6("6"));
    expect(await mockBeanstalk.getLast()).to.be.equal(to6("6"));
    expect(await mockBeanstalk.beansPerFertilizer()).to.be.equal(750);

    expect(await beanstalk.totalHarvestable(0)).to.be.equal("500");

    expect(await beanstalk.totalStalk()).to.be.equal("7500000");

    expect(await beanstalk.totalEarnedBeans()).to.be.equal("750");
  });

  it("some harvestable, some fertilizable", async function () {
    // increments pods by 1000
    // temperature is 1%
    await mockBeanstalk.incrementTotalPodsE(0, "1000");
    // add 1 fertilizer owner, 1 fert (which is equal to 5 beans)
    await mockBeanstalk.connect(owner).addFertilizerOwner("0", to18("0.001"), "0");
    //sunrise with 1500 beans 500 given to field, silo, and barn
    this.result = await mockBeanstalk.sunSunrise("1500", 8);
    // emit a event that 495 soil was issued at season 3
    // 500/1.01 = ~495 (rounded down)
    await expect(this.result).to.emit(beanstalk, "Soil").withArgs(3, "495");

    expect(await beanstalk.totalSoil()).to.be.equal("495");

    // await expect(this.result).to.emit(beanstalk, "Reward").withArgs(3, "500", "500", "500");
    await expect(this.result).to.emit(beanstalk, "Shipped");

    expect(await mockBeanstalk.isFertilizing()).to.be.equal(true);
    expect(await mockBeanstalk.totalFertilizedBeans()).to.be.equal("500");
    expect(await mockBeanstalk.getActiveFertilizer()).to.be.equal("1");
    expect(await mockBeanstalk.getFirst()).to.be.equal(to6("6"));
    expect(await mockBeanstalk.getLast()).to.be.equal(to6("6"));
    expect(await mockBeanstalk.beansPerFertilizer()).to.be.equal(500);

    expect(await beanstalk.totalHarvestable(0)).to.be.equal("500");

    expect(await beanstalk.totalStalk()).to.be.equal("5000000");
    expect(await beanstalk.totalEarnedBeans()).to.be.equal("500");
  });

  it("1 all and 1 some fertilizable", async function () {
    await mockBeanstalk.incrementTotalPodsE(0, to6("250"));
    await mockBeanstalk.connect(owner).addFertilizerOwner("0", to18("0.04"), "0");
    this.result = await mockBeanstalk.sunSunrise(to6("120"), 8);
    await mockBeanstalk.connect(owner).addFertilizerOwner("6374", to18("0.04"), "0");
    this.result = await mockBeanstalk.sunSunrise(to6("480"), 8);

    expect(await mockBeanstalk.isFertilizing()).to.be.equal(true);
    expect(await mockBeanstalk.totalFertilizedBeans()).to.be.equal(to6("200"));
    expect(await mockBeanstalk.getActiveFertilizer()).to.be.equal("40");
    expect(await mockBeanstalk.getFirst()).to.be.equal(to6("6"));
    expect(await mockBeanstalk.getLast()).to.be.equal(to6("6"));
    expect(await mockBeanstalk.beansPerFertilizer()).to.be.equal(to6("3"));

    expect(await beanstalk.totalHarvestable(0)).to.be.equal(to6("200"));

    expect(await beanstalk.totalStalk()).to.be.equal(toStalk("200"));
    expect(await beanstalk.totalEarnedBeans()).to.be.equal(to6("200"));
  });

  it("dynamic shipments, harvestable & fertilizable", async function () {
    // increments pods by 1000
    // temperature is 1%
    await mockBeanstalk.incrementTotalPodsE(0, "2600");
    await mockBeanstalk.connect(owner).addFertilizerOwner("0", to18("0.001"), "0");
    this.result = await mockBeanstalk.sunSunrise("1500", 8);
    // add 1 fertilizer owner, 1 fert (which is equal to 5 beans)
    //sunrise with 1500 beans 500 given to field, silo, and barn
    // emit a event that 495 soil was issued at season 3
    // 500/1.01 = ~495 (rounded down)
    expect(await beanstalk.totalSoil()).to.be.equal("495");
    await expect(this.result).to.emit(beanstalk, "Soil").withArgs(3, "495");
    await expect(this.result).to.emit(beanstalk, "Shipped");
    expect(await beanstalk.totalHarvestable(0)).to.be.equal("500");

    expect(await beanstalk.totalEarnedBeans()).to.be.equal("500");
    expect(await mockBeanstalk.beansPerFertilizer()).to.be.equal(500);
    expect(await mockBeanstalk.totalFertilizedBeans()).to.be.equal("500");

    expect(await mockBeanstalk.isFertilizing()).to.be.equal(true);

    // Update shipping routes.
    let newShipmentRoute = [...this.shipmentRoutes[1]];
    delete newShipmentRoute[7];
    newShipmentRoute[3] = ethers.utils.defaultAbiCoder.encode(["uint8"], [1]);
    this.shipmentRoutes = [...this.shipmentRoutes, newShipmentRoute];
    await mockBeanstalk.connect(owner).setShipmentRoutes(this.shipmentRoutes);
    if (verbose) console.log(await beanstalk.getShipmentRoutes());
    // Add and Set active field.

    await mockBeanstalk.connect(owner).addField();
    await mockBeanstalk.connect(owner).setActiveField(1, 1);

    // New season, new rewards. No pods in new Field.
    await expect(this.result).to.emit(beanstalk, "Shipped");
    this.result = await mockBeanstalk.sunSunrise("2400", 8);
    expect(await beanstalk.totalHarvestable(0)).to.be.equal("1300");

    expect(await beanstalk.totalHarvestable(1)).to.be.equal("0");
    expect(await mockBeanstalk.totalFertilizedBeans()).to.be.equal("1300");
    expect(await mockBeanstalk.beansPerFertilizer()).to.be.equal(1300);
    expect(await beanstalk.totalEarnedBeans()).to.be.equal("1300");

    await mockBeanstalk.incrementTotalPodsE(1, "5000");
    // Pods in both Fields.
    this.result = await mockBeanstalk.sunSunrise("4000", 8);
    await expect(this.result).to.emit(beanstalk, "Shipped");

    expect(await beanstalk.totalHarvestable(0)).to.be.equal("2300");
    expect(await beanstalk.totalHarvestable(1)).to.be.equal("1000");
    expect(await mockBeanstalk.totalFertilizedBeans()).to.be.equal("2300");
    expect(await mockBeanstalk.beansPerFertilizer()).to.be.equal(2300);
    expect(await beanstalk.totalEarnedBeans()).to.be.equal("2300");

    // Field[0] at cap.
    this.result = await mockBeanstalk.sunSunrise("4000", 8);
    await expect(this.result).to.emit(beanstalk, "Shipped");
    expect(await beanstalk.totalHarvestable(0)).to.be.equal("2600");

    expect(await beanstalk.totalHarvestable(1)).to.be.equal("2233");
    expect(await mockBeanstalk.totalFertilizedBeans()).to.be.equal("3533");
    expect(await mockBeanstalk.beansPerFertilizer()).to.be.equal(3533);
    expect(await beanstalk.totalEarnedBeans()).to.be.equal("3533");
    expect(await mockBeanstalk.isFertilizing()).to.be.equal(true);
  });
  it("ends germination", async function () {
    await mockBeanstalk.teleportSunrise(5);
    await mockBeanstalk.mockIncrementGermination(BEAN, to6("1000"), to6("1000"), 1);
    expect((await beanstalk.getEvenGerminating(BEAN))[0]).to.be.equal(to6("1000"));
    expect((await beanstalk.getEvenGerminating(BEAN))[1]).to.be.equal(to6("1000"));
    this.result = await mockBeanstalk.siloSunrise(0);

    await expect(this.result)
      .to.emit(beanstalk, "TotalGerminatingBalanceChanged")
      .withArgs("4", BEAN, to6("-1000"), to6("-1000"));
    expect((await beanstalk.getEvenGerminating(BEAN))[0]).to.be.equal(to6("0"));
    expect((await beanstalk.getEvenGerminating(BEAN))[1]).to.be.equal(to6("0"));
  });

  it("rewards more than type(uint128).max/10000 to silo", async function () {
    await expect(
      mockBeanstalk.siloSunrise("340282366920938463463374607431768211456")
    ).to.be.revertedWith("SafeCastOverflowedUintDowncast");
  });

  it("rewards more than type(uint128).max Soil below peg", async function () {
    await expect(
      mockBeanstalk.sunSunrise("-340282366920938463463374607431768211456", "0")
    ).to.be.revertedWith("SafeCastOverflowedUintDowncast");
  });
});

function viewGenericUint256Logs(logs) {
  const uint256Topic = "0x925a839279bd49ac1cea4c9d376477744867c1a536526f8c2fd13858e78341fb";
  for (const log of logs) {
    if (log.topics.includes(uint256Topic)) {
      console.log("Value: ", parseInt(log.data.substring(2, 66), 16));
      console.log("Label: ", hexToAscii(log.data.substring(66)));
      console.log();
    }
  }
}

function hexToAscii(str1) {
  var hex = str1.toString();
  var str = "";
  for (var n = 0; n < hex.length; n += 2) {
    str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
  }
  return str;
}

async function timeSkip(timestamp) {
  await hre.network.provider.request({
    method: "evm_setNextBlockTimestamp",
    params: [timestamp]
  });
}
