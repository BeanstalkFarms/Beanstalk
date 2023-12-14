const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { getAltBeanstalk } = require("../utils/contracts.js");
const { toBN, encodeAdvancedData } = require("../utils/index.js");
const {
  RATIO_FACTOR,
  initDrafter,
  signRequisition,
  getNormalBlueprintData,
  getAdvancedBlueprintData,
  generateCalldataCopyParams,
  draftDepositInternalBeanBalance,
  draftMow
} = require("./utils/tractor.js");
const { BEAN, BEAN_3_CURVE, THREE_CURVE, ZERO_ADDRESS } = require("./utils/constants.js");
const { EXTERNAL, INTERNAL } = require("./utils/balances.js");
const { to6, to18, toStalk } = require("./utils/helpers.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { ethers } = require("hardhat");
const { time, mine } = require("@nomicfoundation/hardhat-network-helpers");

let publisher, operator, user;

// async function reset() {
//   await network.provider.request({
//     method: "hardhat_reset",
//     params: [{
//       forking: {
//         jsonRpcUrl: process.env.FORKING_RPC,
//         blockNumber: ,
//       },
//     },],
//   });
// }

describe("Tractor", function () {
  before(async function () {
    [owner, publisher, operator, user] = await ethers.getSigners();
    console.log("publisher", publisher.address);
    console.log("operator", operator.address);
    const contracts = await deploy("Test", false, true);
    this.diamond = contracts.beanstalkDiamond;
    this.beanstalk = await getAltBeanstalk(this.diamond.address);
    this.tractorFacet = await ethers.getContractAt("TractorFacet", this.diamond.address);
    this.junctionFacet = await ethers.getContractAt("JunctionFacet", this.diamond.address);
    this.farmFacet = await ethers.getContractAt("FarmFacet", this.diamond.address);
    this.seasonFacet = await ethers.getContractAt("MockSeasonFacet", this.diamond.address);
    this.siloFacet = await ethers.getContractAt("MockSiloFacet", this.diamond.address);

    await initDrafter();

    // let libraryFactory = await (await (await ethers.getContractFactory("LibOperatorPasteInstr")).deploy()).deployed();
    // this.libOperatorPasteInstr = await ethers.getContractAt("LibOperatorPasteInstr", libraryFactory.address);
    // libraryFactory = await (await (await ethers.getContractFactory("LibClipboard")).deploy()).deployed();
    // this.libClipboard = await ethers.getContractAt("LibClipboard", libraryFactory.address);

    this.bean = await ethers.getContractAt("Bean", BEAN);

    this.depot = await ethers.getContractAt("DepotFacet", this.diamond.address);
    this.tokenFacet = await ethers.getContractAt("TokenFacet", this.diamond.address);

    await this.seasonFacet.lightSunrise();
    await this.bean.connect(publisher).approve(this.siloFacet.address, to6("20000"));
    // await this.bean.connect(user2).approve(this.siloFacet.address, to6("5000"));
    await this.bean.mint(publisher.address, to6("20000"));
    // await this.bean.mint(user2Address, to6("10000"));

    // await this.siloFacet.update(publisher.address);

    // await this.siloFacet
    //   .connect(user)
    //   .deposit(this.bean.address, to6("1000"), EXTERNAL);
    // await this.siloFacet
    //   .connect(user2)
    //   .deposit(this.bean.address, to6("1000"), EXTERNAL);

    // console.log("data");
    // console.log(data);
    // console.log("operatorPasteInstrs");
    // console.log(operatorPasteInstrs);

    this.blueprint = {
      publisher: publisher.address,
      data: ethers.utils.hexlify("0x"),
      operatorPasteInstrs: [],
      maxNonce: 100,
      startTime: Math.floor(Date.now() / 1000) - 10 * 3600,
      endTime: Math.floor(Date.now() / 1000) + 10 * 3600
    };

    // this.blueprintHash = await this.tractorFacet.connect(publisher).getBlueprintHash(this.blueprint);

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

  describe("Deposit Publisher Internal Beans", function () {
    it("should not fail", async function () {
      [this.blueprint.data, this.blueprint.operatorPasteInstrs] =
        await draftDepositInternalBeanBalance(to6("10"));
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

    // describe("Run Tractor", function () {
    //   it("Enroot publisher deposit", async function () {
    //     [this.blueprint.data, this.blueprint.operatorPasteInstrs] = await draftDepositInternalBeanBalance(ethers.BigNumber.from(0.01).mul(RATIO_FACTOR));
    //     this.requisition.blueprintHash = await this.tractorFacet.connect(publisher).getBlueprintHash(this.blueprint);
    //     await signRequisition(this.requisition, publisher);

    //     await this.tractorFacet.connect(publisher).publishRequisition(this.requisition);

    //     // Operator data matches shape expected by blueprint. Each item is in a 32 byte slot.
    //     // token, stem, amount
    //     let operatorData = ethers.util.defaultAbiCoder .encode(
    //       ["address", "int96", "uint256"],
    //       [BEAN,]
    //     );

    //     // Confirm init state.
    //     const initPublisherStalk = await this.siloFacet.balanceOfStalk(publisher.address);
    //     const initPublisherBeans = await this.bean.balanceOf(publisher.address);
    //     const initOperatorBeans = await this.bean.balanceOf(operator.address);

    //     await this.tractorFacet.connect(operator).tractor(this.requisition, operatorData);

    //     // Confirm final state.
    //     expect(
    //       await this.siloFacet.balanceOfStalk(publisher.address)
    //     ).to.be.gt(initPublisherStalk);
    //     expect(await this.bean.balanceOf(publisher.address)).to.be.lt(initPublisherBeans);
    //     expect(await this.bean.balanceOf(operator.address)).to.be.gt(initOperatorBeans);
    //   });

    it("Mow publisher", async function () {
      // Give publisher Grown Stalk.
      this.result = await this.siloFacet
        .connect(publisher)
        .deposit(this.bean.address, to6("10000"), EXTERNAL);
      console.log("HERE_JS_00");
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
      [this.blueprint.data, this.blueprint.operatorPasteInstrs] = await draftMow(tipRatio);
      this.requisition.blueprintHash = await this.tractorFacet
        .connect(publisher)
        .getBlueprintHash(this.blueprint);
      await signRequisition(this.requisition, publisher);

      console.log("HERE_JS_3");

      await this.tractorFacet.connect(publisher).publishRequisition(this.requisition);

      // Operator data matches shape expected by blueprint. Each item is in a 32 byte slot.
      // token, stem, amount
      let operatorData = ethers.utils.defaultAbiCoder.encode(
        ["address"], // token
        [BEAN]
      );

      console.log("HERE_JS_4");

      await this.tractorFacet.connect(operator).tractor(this.requisition, operatorData);

      console.log("HERE_JS_6");

      // Confirm final state.
      const publisherStalkGain =
        (await this.siloFacet.balanceOfStalk(publisher.address)) - initPublisherStalk;
      const operatorPaid = (await this.bean.balanceOf(operator.address)) - initOperatorBeans;
      console.log("Publisher Stalk increase: " + ethers.utils.formatUnits(operatorPaid, 10));
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
  });

  // struct AdvancedFarmCall {
  //   bytes callData;
  //   bytes clipboard;
  // }
});
