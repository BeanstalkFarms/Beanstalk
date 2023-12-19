const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { deployBasin } = require("../scripts/basin.js");
const { getAltBeanstalk } = require("../utils/contracts.js");
const { deployPipeline, impersonatePipeline } = require("../scripts/pipeline.js");
const { impersonateSigner } = require("../utils/signer.js");
const { setEthUsdcPrice, setEthUsdPrice, printPrices } = require("../utils/oracle.js");
const { toBN, encodeAdvancedData } = require("../utils/index.js");
const {
  initContracts,
  signRequisition,
  encodeBlueprintData,
  draftDepositInternalBeanBalance,
  draftMow,
  draftPlant,
  draftConvertUrBeanToUrLP,
  draftConvert,
  draftDepositInternalBeansWithLimit,
  RATIO_FACTOR,
  ConvertKind
} = require("./utils/tractor.js");
const {
  BEAN,
  UNRIPE_LP,
  UNRIPE_BEAN,
  BEAN_ETH_WELL,
  WETH,
  ZERO_ADDRESS
} = require("./utils/constants.js");
const { EXTERNAL, INTERNAL } = require("./utils/balances.js");
const { to6, to18, toStalk } = require("./utils/helpers.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { ethers } = require("hardhat");
const { time, mine } = require("@nomicfoundation/hardhat-network-helpers");

const ZERO_BYTES = ethers.utils.formatBytes32String("0x0");

let publisher, operator, user;
let advancedFarmCalls;

// TODO remove old convert tractor test

describe("Tractor", function () {
  before(async function () {
    [owner, publisher, operator, user] = await ethers.getSigners();
    console.log("publisher", publisher.address);
    console.log("operator", operator.address);
    const contracts = await deploy("Test", false, true);
    this.diamond = contracts.beanstalkDiamond;
    this.beanstalk = await getAltBeanstalk(this.diamond.address);
    this.tractorFacet = await ethers.getContractAt("TractorFacet", this.diamond.address);
    this.farmFacet = await ethers.getContractAt("FarmFacet", this.diamond.address);
    this.seasonFacet = await ethers.getContractAt("MockSeasonFacet", this.diamond.address);
    this.siloFacet = await ethers.getContractAt("MockSiloFacet", this.diamond.address);
    this.depot = await ethers.getContractAt("DepotFacet", this.diamond.address);
    this.tokenFacet = await ethers.getContractAt("TokenFacet", this.diamond.address);
    // this.convertFacet = await ethers.getContractAt('ConvertFacet', this.diamond.address);
    // this.convertGet = await ethers.getContractAt('ConvertGettersFacet', this.diamond.address);
    this.unripeFacet = await ethers.getContractAt("MockUnripeFacet", this.diamond.address);
    this.unripeBean = await ethers.getContractAt("MockToken", UNRIPE_BEAN);
    this.unripeLP = await ethers.getContractAt("MockToken", UNRIPE_LP);
    this.fertilizer = await ethers.getContractAt("MockFertilizerFacet", this.diamond.address);

    const pipeAccount = impersonateSigner("0x533545dE45Bd44e6B5a6D649256CCfE3b6E1abA6");
    pipeline = await impersonatePipeline(pipeAccount);

    await initContracts();

    this.bean = await ethers.getContractAt("Bean", BEAN);
    this.weth = await ethers.getContractAt("MockToken", WETH);

    this.well = await deployBasin(true, undefined, false, true);
    this.wellToken = await ethers.getContractAt("IERC20", this.well.address);
    await this.wellToken.connect(owner).approve(this.diamond.address, ethers.constants.MaxUint256);
    await this.bean.connect(owner).approve(this.diamond.address, ethers.constants.MaxUint256);

    await setEthUsdPrice("999.998018");
    await setEthUsdcPrice("1000");

    // await this.seasonFacet.lightSunrise();
    await this.seasonFacet.siloSunrise(0);

    await this.bean.mint(owner.address, to6("10000000000"));
    await this.weth.mint(owner.address, to18("1000000000"));
    await this.bean.mint(publisher.address, to6("20000"));
    await this.unripeBean.mint(publisher.address, to6("10000"));
    await this.unripeLP.mint(publisher.address, to6("3162.277660"));

    await this.bean.connect(publisher).approve(this.diamond.address, ethers.constants.MaxUint256);
    await this.weth.connect(publisher).approve(this.diamond.address, ethers.constants.MaxUint256);
    await this.wellToken
      .connect(publisher)
      .approve(this.diamond.address, ethers.constants.MaxUint256);
    await this.unripeBean
      .connect(publisher)
      .approve(this.diamond.address, ethers.constants.MaxUint256);
    await this.unripeLP
      .connect(publisher)
      .approve(this.diamond.address, ethers.constants.MaxUint256);

    await this.bean.connect(owner).approve(this.well.address, ethers.constants.MaxUint256);
    await this.weth.connect(owner).approve(this.well.address, ethers.constants.MaxUint256);
    await this.bean.connect(publisher).approve(this.well.address, ethers.constants.MaxUint256);
    await this.weth.connect(publisher).approve(this.well.address, ethers.constants.MaxUint256);

    // P > 1.
    await this.well
      .connect(owner)
      .addLiquidity([to6("1000000"), to18("2000")], 0, owner.address, ethers.constants.MaxUint256);

    // Handle configuration of recapitalization?
    this.fertilizerFacet = await ethers.getContractAt("MockFertilizerFacet", this.diamond.address);
    await this.fertilizerFacet.setFertilizerE(true, to6("10000"));
    await this.fertilizerFacet.setPenaltyParams(to6("500"), "0");

    await this.unripeFacet.addUnripeToken(UNRIPE_BEAN, BEAN, ZERO_BYTES);
    await this.unripeFacet.addUnripeToken(UNRIPE_LP, BEAN_ETH_WELL, ZERO_BYTES);
    await this.unripeFacet.connect(owner).addUnderlying(UNRIPE_BEAN, to6("10000"));
    await this.unripeFacet.connect(owner).addUnderlying(
      UNRIPE_LP,
      to18("3162.277660") // 3162.2776601683793319
    );

    // await this.siloFacet.update(publisher.address);

    this.blueprint = {
      publisher: publisher.address,
      data: ethers.utils.hexlify("0x"),
      operatorPasteInstrs: [],
      maxNonce: 100,
      startTime: Math.floor(Date.now() / 1000) - 10 * 3600,
      endTime: Math.floor(Date.now() / 1000) + 10 * 3600
    };

    this.requisition = {
      blueprint: this.blueprint,
      blueprintHash: await this.tractorFacet.connect(publisher).getBlueprintHash(this.blueprint)
    };
    await signRequisition(this.requisition, publisher);
    console.log(this.requisition);
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("Publish Blueprint", function () {
    it("should fail when signature is invalid #1", async function () {
      this.requisition.signature = "0x0000";
      await expect(
        this.tractorFacet.connect(publisher).publishRequisition(this.requisition)
      ).to.be.revertedWith("ECDSA: invalid signature length");
    });

    it("should fail when signature is invalid #2", async function () {
      this.requisition.signature =
        "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
      await expect(
        this.tractorFacet.connect(publisher).publishRequisition(this.requisition)
      ).to.be.revertedWith("ECDSA: invalid signature 'v' value");
    });

    it("should fail when signature is invalid #3", async function () {
      await signRequisition(this.requisition, user);
      await expect(
        this.tractorFacet.connect(publisher).publishRequisition(this.requisition)
      ).to.be.revertedWith("TractorFacet: signer mismatch");
    });

    it("should publish blueprint", async function () {
      await signRequisition(this.requisition, publisher);
      await this.tractorFacet.connect(publisher).publishRequisition(this.requisition);
    });
  });

  describe("Cancel Requisition", function () {
    it("should fail when signature is invalid #1", async function () {
      this.requisition.signature = "0x0000";
      await expect(
        this.tractorFacet.connect(publisher).cancelBlueprint(this.requisition)
      ).to.be.revertedWith("ECDSA: invalid signature length");
    });

    it("should fail when signature is invalid #2", async function () {
      this.requisition.signature =
        "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
      await expect(
        this.tractorFacet.connect(publisher).cancelBlueprint(this.requisition)
      ).to.be.revertedWith("ECDSA: invalid signature 'v' value");
    });

    it("should fail when signature is invalid #3", async function () {
      await signRequisition(this.requisition, publisher);
      await expect(
        this.tractorFacet.connect(user).cancelBlueprint(this.requisition)
      ).to.be.revertedWith("TractorFacet: not publisher");
    });

    it("should cancel Requisition", async function () {
      await signRequisition(this.requisition, publisher);
      const tx = await this.tractorFacet.connect(publisher).cancelBlueprint(this.requisition);

      await expect(tx)
        .to.emit(this.tractorFacet, "CancelBlueprint")
        .withArgs(this.requisition.blueprintHash);

      const nonce = await this.tractorFacet.getBlueprintNonce(this.requisition.blueprintHash);
      expect(nonce).to.be.eq(ethers.constants.MaxUint256);
    });
  });

  describe("Run Tractor", function () {
    afterEach(async function () {
      await revertToSnapshot(snapshotId);
    });

    it("Deposit Publisher Internal Beans", async function () {
      [advancedFarmCalls, this.blueprint.operatorPasteInstrs] =
        await draftDepositInternalBeanBalance(to6("10"));
      this.blueprint.data = this.farmFacet.interface.encodeFunctionData("advancedFarm", [
        advancedFarmCalls
      ]);
      this.requisition.blueprintHash = await this.tractorFacet
        .connect(publisher)
        .getBlueprintHash(this.blueprint);
      await signRequisition(this.requisition, publisher);

      // Transfer Bean to internal balance.
      this.beanstalk
        .connect(publisher)
        .transferToken(this.bean.address, publisher.address, to6("1000"), 0, 1);
      expect(
        await this.tokenFacet.getInternalBalance(publisher.address, this.bean.address)
      ).to.be.eq(to6("1000"));

      await this.tractorFacet.connect(publisher).publishRequisition(this.requisition);

      // No operator calldata used.
      operatorData = ethers.utils.hexlify("0x");
      await this.tractorFacet.connect(operator).tractor(this.requisition, operatorData);

      // Confirm final state.
      expect(
        await this.tokenFacet.getInternalBalance(publisher.address, this.bean.address)
      ).to.be.eq(to6("0"));
      expect(await this.bean.balanceOf(operator.address)).to.be.eq(to6("10"));
    });

    it("Deposit with Counter Limit", async function () {
      [advancedFarmCalls, this.blueprint.operatorPasteInstrs] =
        await draftDepositInternalBeansWithLimit(to6("1000"));
      this.blueprint.data = this.farmFacet.interface.encodeFunctionData("advancedFarm", [
        advancedFarmCalls
      ]);
      this.requisition.blueprintHash = await this.tractorFacet
        .connect(publisher)
        .getBlueprintHash(this.blueprint);
      await signRequisition(this.requisition, publisher);

      // Transfer Bean to internal balance.
      this.beanstalk
        .connect(publisher)
        .transferToken(this.bean.address, publisher.address, to6("2000"), 0, 1);
      expect(
        await this.tokenFacet.getInternalBalance(publisher.address, this.bean.address)
      ).to.be.eq(to6("2000"));

      await this.tractorFacet.connect(publisher).publishRequisition(this.requisition);

      // No operator calldata used.
      const operatorData = ethers.utils.hexlify("0x");

      for (let i = 0; i < 9; i++) {
        await this.tractorFacet.connect(operator).tractor(this.requisition, operatorData);
      }

      // Confirm final state.
      expect(
        this.tractorFacet.connect(operator).tractor(this.requisition, operatorData)
      ).to.be.revertedWith("Junction: check failed");
      expect(
        await this.tokenFacet.getInternalBalance(publisher.address, this.bean.address)
      ).to.be.eq(to6("1000"));
    });

    it("Mow publisher", async function () {
      // Give publisher Grown Stalk.
      this.result = await this.siloFacet
        .connect(publisher)
        .deposit(this.bean.address, to6("10000"), EXTERNAL);
      await this.seasonFacet.siloSunrise(to6("0"));
      await time.increase(3600); // wait until end of season to get earned
      await mine(25);
      expect(await this.siloFacet.balanceOfGrownStalk(publisher.address, this.bean.address)).to.eq(
        toStalk("2")
      );

      // Capture init state.
      const initPublisherStalk = await this.siloFacet.balanceOfStalk(publisher.address);
      const initPublisherBeans = await this.bean.balanceOf(publisher.address);
      const initOperatorBeans = await this.bean.balanceOf(operator.address);

      // Tip operator 50% of Stalk change in Beans. Factor in decimal difference of Stalk and Bean.
      const tipRatio = ethers.BigNumber.from(1)
        .mul(RATIO_FACTOR)
        .div(2)
        .mul(ethers.BigNumber.from(10).pow(6))
        .div(ethers.BigNumber.from(10).pow(10));
      [advancedFarmCalls, this.blueprint.operatorPasteInstrs] = await draftMow(tipRatio);
      this.blueprint.data = this.farmFacet.interface.encodeFunctionData("advancedFarm", [
        advancedFarmCalls
      ]);
      this.requisition.blueprintHash = await this.tractorFacet
        .connect(publisher)
        .getBlueprintHash(this.blueprint);
      await signRequisition(this.requisition, publisher);

      await this.tractorFacet.connect(publisher).publishRequisition(this.requisition);

      // Operator data matches shape expected by blueprint. Each item is in a 32 byte slot.
      let operatorData = ethers.utils.defaultAbiCoder.encode(
        ["address"], // token
        [BEAN]
      );

      await this.tractorFacet.connect(operator).tractor(this.requisition, operatorData);

      // Confirm final state.
      const publisherStalkGain =
        (await this.siloFacet.balanceOfStalk(publisher.address)) - initPublisherStalk;
      const operatorPaid = (await this.bean.balanceOf(operator.address)) - initOperatorBeans;
      console.log("Publisher Stalk increase: " + ethers.utils.formatUnits(publisherStalkGain, 10));
      console.log("Operator Payout: " + ethers.utils.formatUnits(operatorPaid, 6) + " Beans");

      expect(
        await this.siloFacet.balanceOfGrownStalk(publisher.address, this.bean.address),
        "publisher Grown Stalk did not decrease"
      ).to.eq(toStalk("0"));
      expect(publisherStalkGain, "publisher Stalk did not increase").to.be.gt(0);
      expect(await this.bean.balanceOf(publisher.address), "publisher did not pay").to.be.lt(
        initPublisherBeans
      );
      expect(operatorPaid, "unpaid operator").to.be.gt(0);
    });

    it("Plant publisher", async function () {
      // Give publisher Earned Beans.
      this.result = await this.siloFacet
        .connect(publisher)
        .deposit(this.bean.address, to6("10000"), EXTERNAL);
      await this.seasonFacet.siloSunrise(to6("1000"));
      await time.increase(3600); // wait until end of season to get earned
      await mine(25);
      expect(await this.siloFacet.balanceOfEarnedBeans(publisher.address)).to.gt(0);

      // Capture init state.
      const initPublisherStalkBalance = await this.siloFacet.balanceOfStalk(publisher.address);
      const initPublisherBeans = await this.bean.balanceOf(publisher.address);
      const initOperatorBeans = await this.bean.balanceOf(operator.address);

      // Tip operator 50% of Bean change in Beans.
      const tipRatio = ethers.BigNumber.from(1).mul(RATIO_FACTOR).div(2);
      [advancedFarmCalls, this.blueprint.operatorPasteInstrs] = await draftPlant(tipRatio);
      this.blueprint.data = this.farmFacet.interface.encodeFunctionData("advancedFarm", [
        advancedFarmCalls
      ]);
      this.requisition.blueprintHash = await this.tractorFacet
        .connect(publisher)
        .getBlueprintHash(this.blueprint);
      await signRequisition(this.requisition, publisher);

      await this.tractorFacet.connect(publisher).publishRequisition(this.requisition);

      // Operator data matches shape expected by blueprint. Each item is in a 32 byte slot.
      let operatorData = ethers.utils.hexlify("0x000000");

      await this.tractorFacet.connect(operator).tractor(this.requisition, operatorData);

      // Confirm final state.
      expect(
        await this.siloFacet.balanceOfEarnedBeans(publisher.address),
        "publisher Earned Bean did not go to 0"
      ).to.eq(0);

      const publisherStalkGain =
        (await this.siloFacet.balanceOfStalk(publisher.address)) - initPublisherStalkBalance;
      const operatorPaid = (await this.bean.balanceOf(operator.address)) - initOperatorBeans;
      console.log("Publisher Stalk increase: " + ethers.utils.formatUnits(publisherStalkGain, 10));
      console.log("Operator Payout: " + ethers.utils.formatUnits(operatorPaid, 6) + " Beans");

      expect(publisherStalkGain, "publisher stalk balance did not increase").to.be.gt(0);
      expect(await this.bean.balanceOf(publisher.address), "publisher did not pay").to.be.lt(
        initPublisherBeans
      );
      expect(operatorPaid, "unpaid operator").to.be.gt(0);
    });
  });

  describe("Bi-directional unripe convert of publisher", async function () {
    // before(async function () {

    //   this.urBeanToUrLpBlueprint = this.blueprint;
    //   this.urBeanToUrLpRequisition;

    // });

    // // Compose blueprint and operator data
    // beforeEach(async function () {

    // });

    // Prepare Beanstalk
    beforeEach(async function () {
      // await this.seasonFacet.teleportSunrise(10);
      this.seasonFacet.deployStemsUpgrade();
      await this.siloFacet
        .connect(publisher)
        .deposit(this.unripeBean.address, to6("2000"), EXTERNAL);
      await this.seasonFacet.siloSunrise(0);
      await this.seasonFacet.siloSunrise(0);
      await this.seasonFacet.siloSunrise(0);
      await this.seasonFacet.siloSunrise(0);
    });
    beforeEach(async function () {
      // Transfer Bean to publisher internal balance.
      this.beanstalk
        .connect(publisher)
        .transferToken(this.bean.address, publisher.address, to6("100"), 0, 1);
    });
    // Confirm initial state.
    beforeEach(async function () {
      expect(
        await this.siloFacet.getTotalDeposited(this.unripeBean.address),
        "initial totalDeposited urBean"
      ).to.eq(to6("2000"));
      expect(
        await this.siloFacet.getTotalDepositedBdv(this.unripeBean.address),
        "initial totalDepositedBDV urBean"
      ).to.eq(to6("2000"));
      expect(
        await this.siloFacet.getTotalDeposited(this.unripeLP.address),
        "initial totalDeposited urLP"
      ).to.eq("0");
      // const bdv = await this.siloFacet.bdv(this.unripeLP.address, '4711829')
      expect(
        await this.siloFacet.getTotalDepositedBdv(this.unripeLP.address),
        "initial totalDepositedBDV urLP"
      ).to.eq("0");
      // expect(await this.siloFacet.totalStalk()).to.eq(toStalk('100').add(bdv.mul(to6('0.01'))));
      expect(await this.siloFacet.totalStalk(), "initial totalStalk").to.gt("0");
      expect(
        await this.siloFacet.balanceOfStalk(publisher.address),
        "initial publisher balanceOfStalk"
      ).to.eq(toStalk("2000"));

      let deposit = await this.siloFacet.getDeposit(publisher.address, this.unripeBean.address, 0);
      expect(deposit[0], "initial publisher urBean deposit amount").to.eq(to6("2000"));
      expect(deposit[1], "initial publisher urBean deposit BDV").to.eq(to6("2000"));
      deposit = await this.siloFacet.getDeposit(publisher.address, this.unripeLP.address, 0);
      expect(deposit[0], "initial publisher urLP deposit amount").to.eq("0");
      expect(deposit[1], "initial publisher urLP deposit BDV").to.eq("0");
    });

    afterEach(async function () {
      await revertToSnapshot(snapshotId);
    });

    it("Convert urBean to urLP", async function () {
      [advancedFarmCalls, this.blueprint.operatorPasteInstrs] = await draftConvertUrBeanToUrLP(
        to6("20"),
        // RATIO_FACTOR.div(10)
        0
      );
      this.blueprint.data = this.farmFacet.interface.encodeFunctionData("advancedFarm", [
        advancedFarmCalls
      ]);
      this.requisition.blueprintHash = await this.tractorFacet
        .connect(publisher)
        .getBlueprintHash(this.blueprint);
      await signRequisition(this.requisition, publisher);
      await this.tractorFacet.connect(publisher).publishRequisition(this.requisition);

      // Operator data matches shape expected by blueprint. Each item is in a 32 byte slot.
      let operatorData = ethers.utils.defaultAbiCoder.encode(
        ["int96"], // stem
        [0]
      );

      await this.tractorFacet.connect(operator).tractor(this.requisition, operatorData);

      // Confirm final state.
      expect(
        await this.siloFacet.getTotalDeposited(this.unripeBean.address),
        "mid totalDeposited urBean"
      ).to.eq("0");
      expect(
        await this.siloFacet.getTotalDepositedBdv(this.unripeBean.address),
        "mid totalDepositedBDV urBean"
      ).to.eq("0");
      expect(
        await this.siloFacet.getTotalDeposited(this.unripeLP.address),
        "mid totalDeposited urLP"
      ).to.gt("0");
      expect(
        await this.siloFacet.getTotalDepositedBdv(this.unripeLP.address),
        "mid totalDepositedBDV urLP"
      ).to.gt("0");
      expect(await this.siloFacet.totalStalk(), "mid totalStalk").to.gt(toStalk("2000"));
      expect(
        await this.siloFacet.balanceOfStalk(publisher.address),
        "mid publisher balanceOfStalk"
      ).to.gt(toStalk("2000"));

      let deposit = await this.siloFacet.getDeposit(publisher.address, this.unripeBean.address, 0);
      expect(deposit[0], "mid publisher urBean deposit amount").to.eq("0");
      expect(deposit[1], "mid publisher urBean deposit BDV").to.eq("0");
      deposit = await this.siloFacet.getDeposit(publisher.address, this.unripeLP.address, 0);
      expect(deposit[0], "mid publisher urLP deposit amount").to.gt("0");
      expect(deposit[1], "mid publisher urLP deposit BDV").to.eq(to6("2000"));
    });

    it("Generalized UR convert", async function () {
      [advancedFarmCalls, this.blueprint.operatorPasteInstrs] = await draftConvert(
        to6("20"),
        // RATIO_FACTOR.div(2), // minUrLpPerUrBeanRatio = 50%
        // RATIO_FACTOR.div(2) // minUrBeanPerUrLpRatio = 50%
        0,
        0
      );
      this.blueprint.data = this.farmFacet.interface.encodeFunctionData("advancedFarm", [
        advancedFarmCalls
      ]);
      this.requisition.blueprintHash = await this.tractorFacet
        .connect(publisher)
        .getBlueprintHash(this.blueprint);
      await signRequisition(this.requisition, publisher);
      await this.tractorFacet.connect(publisher).publishRequisition(this.requisition);

      // Operator data matches shape expected by blueprint. Each item is in a 32 byte slot.
      let operatorData = ethers.utils.defaultAbiCoder.encode(
        ["int96", "uint8"], // stem, convertKind
        [0, ConvertKind.UNRIPE_BEANS_TO_LP]
      );
      await this.tractorFacet.connect(operator).tractor(this.requisition, operatorData);

      // Confirm mid state.
      expect(
        await this.siloFacet.getTotalDeposited(this.unripeBean.address),
        "mid totalDeposited urBean"
      ).to.eq("0");
      expect(
        await this.siloFacet.getTotalDepositedBdv(this.unripeBean.address),
        "mid totalDepositedBDV urBean"
      ).to.eq("0");
      expect(
        await this.siloFacet.getTotalDeposited(this.unripeLP.address),
        "mid totalDeposited urLP"
      ).to.gt("1");
      expect(
        await this.siloFacet.getTotalDepositedBdv(this.unripeLP.address),
        "mid totalDepositedBDV urLP"
      ).to.gt("0");
      expect(await this.siloFacet.totalStalk(), "mid totalStalk").to.gt(toStalk("2000"));
      expect(
        await this.siloFacet.balanceOfStalk(publisher.address),
        "mid publisher balanceOfStalk"
      ).to.gt(toStalk("2000"));
      let deposit = await this.siloFacet.getDeposit(publisher.address, this.unripeBean.address, 0);
      expect(deposit[0], "mid publisher urBean deposit amount").to.eq("0");
      expect(deposit[1], "mid publisher urBean deposit BDV").to.eq("0");
      deposit = await this.siloFacet.getDeposit(publisher.address, this.unripeLP.address, 0);
      expect(deposit[0], "mid publisher urLP deposit amount").to.gt("0");
      expect(deposit[1], "mid publisher urLP deposit BDV").to.eq(to6("2000"));

      // Make P < 1.
      await this.well
        .connect(owner)
        .addLiquidity([to6("3000000"), to18("0")], 0, owner.address, ethers.constants.MaxUint256);

      // Convert in other direction (LP->Bean).
      operatorData = ethers.utils.defaultAbiCoder.encode(
        ["int96", "uint8"], // stem, convertKind
        [0, ConvertKind.UNRIPE_LP_TO_BEANS]
      );
      await this.tractorFacet.connect(operator).tractor(this.requisition, operatorData);

      // Confirm final state.
      expect(
        await this.siloFacet.getTotalDeposited(this.unripeBean.address),
        "final totalDeposited urBean"
      ).to.gte(to6("2000"));
      expect(
        await this.siloFacet.getTotalDepositedBdv(this.unripeBean.address),
        "final totalDepositedBDV urBean"
      ).to.gt("0");
      expect(
        await this.siloFacet.getTotalDeposited(this.unripeLP.address),
        "final totalDeposited urLP"
      ).to.eq("1"); // rounding quirk
      expect(
        await this.siloFacet.getTotalDepositedBdv(this.unripeLP.address),
        "final totalDepositedBDV urLP"
      ).to.gte("1"); // rounding quirk
      expect(await this.siloFacet.totalStalk(), "final totalStalk").to.gt(toStalk("2000"));
      expect(
        await this.siloFacet.balanceOfStalk(publisher.address),
        "final publisher balanceOfStalk"
      ).to.gt(toStalk("2000"));
      deposit = await this.siloFacet.getDeposit(publisher.address, this.unripeBean.address, 3);
      expect(deposit[0], "final publisher urBean deposit amount").to.gt(to6("2000"));
      expect(deposit[1], "final publisher urBean deposit BDV").to.gt(to6("2000"));
      deposit = await this.siloFacet.getDeposit(publisher.address, this.unripeLP.address, 0);
      expect(deposit[0], "final publisher urLP deposit amount").to.eq("1"); // rounding quirk
      expect(deposit[1], "final publisher urLP deposit BDV").to.gte("1"); // rounding quirk
    });
  });
});
