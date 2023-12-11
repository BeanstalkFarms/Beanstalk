const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { getAltBeanstalk } = require("../utils/contracts.js");
const { toBN, encodeAdvancedData } = require("../utils/index.js");
const {
  signRequisition,
  getNormalBlueprintData,
  getAdvancedBlueprintData,
  generateCalldataCopyParams
} = require("./utils/tractor.js");
const { EXTERNAL, INTERNAL } = require("./utils/balances.js");
const { BEAN, BEAN_3_CURVE, THREE_CURVE, ZERO_ADDRESS } = require("./utils/constants.js");
const { to6, to18 } = require("./utils/helpers.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { ethers } = require("hardhat");

let publisher, operator, user;

const ARRAY_LENGTH = 5;
const SLOT_SIZE = 32;
const SELECTOR_SIZE = 4;
const ARGS_START_INDEX = SELECTOR_SIZE + SLOT_SIZE; // shape of AdvancedFarmCall.callData: 32 bytes (length of callData), 4 bytes (selector), X bytes (args)
const ADDR_SLOT_OFFSET = 12; // 32 - 20
const PUBLISHER_COPY_INDEX = ethers.BigNumber.from(2).pow(80).sub(1); // ethers.constants.MaxUint80;
const OPERATOR_COPY_INDEX = PUBLISHER_COPY_INDEX.sub(1);

describe("Tractor", function () {
  before(async function () {
    [owner, publisher, operator, user] = await ethers.getSigners();
    const contracts = await deploy("Test", false, true);
    this.diamond = contracts.beanstalkDiamond;
    this.beanstalk = await getAltBeanstalk(this.diamond.address);
    this.tractorFacet = await ethers.getContractAt("TractorFacet", this.diamond.address);
    this.junctionFacet = await ethers.getContractAt("JunctionFacet", this.diamond.address);
    this.farmFacet = await ethers.getContractAt("FarmFacet", this.diamond.address);
    this.seasonFacet = await ethers.getContractAt("MockSeasonFacet", this.diamond.address);
    this.siloFacet = await ethers.getContractAt("MockSiloFacet", this.diamond.address);

    // this.LibOperatorPasteInstr = await ethers.getContractAt("LibOperatorPasteInstr", this.diamond.address);

    let contractFactory = await (
      await (await ethers.getContractFactory("Drafter")).deploy()
    ).deployed();
    this.drafter = await ethers.getContractAt("Drafter", contractFactory.address);

    // let libraryFactory = await (await (await ethers.getContractFactory("LibOperatorPasteInstr")).deploy()).deployed();
    // this.libOperatorPasteInstr = await ethers.getContractAt("LibOperatorPasteInstr", libraryFactory.address);
    // libraryFactory = await (await (await ethers.getContractFactory("LibClipboard")).deploy()).deployed();
    // this.libClipboard = await ethers.getContractAt("LibClipboard", libraryFactory.address);

    this.bean = await ethers.getContractAt("Bean", BEAN);

    this.depot = await ethers.getContractAt("DepotFacet", this.diamond.address);
    this.tokenFacet = await ethers.getContractAt("TokenFacet", this.diamond.address);

    await this.seasonFacet.lightSunrise();
    await this.bean.connect(publisher).approve(this.siloFacet.address, to6("5000"));
    // await this.bean.connect(user2).approve(this.siloFacet.address, to6("5000"));
    await this.bean.mint(publisher.address, to6("5000"));
    // await this.bean.mint(user2Address, to6("10000"));

    // await this.siloFacet.update(publisher.address);

    // await this.siloFacet
    //   .connect(user)
    //   .deposit(this.bean.address, to6("1000"), EXTERNAL);
    // await this.siloFacet
    //   .connect(user2)
    //   .deposit(this.bean.address, to6("1000"), EXTERNAL);

    /**
     * Encodes the userData parameter for removing BEAN/ETH lp, then converting that Bean to LP using Curve Pool
     * @param tip - amount of beans to tip to operator external balance
     */
    this.draftDepositAllBeans = async (tip) => {
      // AdvancedFarmCall[]
      let advancedFarmCalls = [];

      // bytes32[]
      let operatorPasteInstrs = [];

      // call[0] - Get publisher internal balance.
      advancedFarmCalls.push({
        callData: this.tokenFacet.interface.encodeFunctionData("getInternalBalance", [
          ZERO_ADDRESS,
          this.bean.address
        ]),
        clipboard: ethers.utils.hexlify("0x000000")
      });
      operatorPasteInstrs.push(
        await this.drafter.encodeOperatorPasteInstr(
          PUBLISHER_COPY_INDEX,
          0,
          ARGS_START_INDEX + ADDR_SLOT_OFFSET
        )
      );

      // call[1] - Get difference between publisher internal balance and tip.
      advancedFarmCalls.push({
        callData: this.junctionFacet.interface.encodeFunctionData("sub", [0, tip]),
        // must manually key in encode function to avoid ambiguity.
        clipboard: await this.drafter.encodeClipboard(0, [
          await this.drafter.encodeLibReturnPasteParam(0, SLOT_SIZE, ARGS_START_INDEX)
        ])
      });

      // call[2] - Deposit publisher internal balance, less tip.
      advancedFarmCalls.push({
        callData: this.siloFacet.interface.encodeFunctionData("deposit", [
          this.bean.address,
          0,
          INTERNAL
        ]),
        clipboard: await this.drafter.encodeClipboard(0, [
          await this.drafter.encodeLibReturnPasteParam(1, SLOT_SIZE, ARGS_START_INDEX + SLOT_SIZE)
        ])
      });

      // call[3] - Transfer tip to operator external balance.
      advancedFarmCalls.push({
        callData: this.tokenFacet.interface.encodeFunctionData("transferToken", [
          this.bean.address,
          ZERO_ADDRESS,
          tip,
          INTERNAL,
          EXTERNAL
        ]),
        clipboard: ethers.utils.hexlify("0x000000")
      });
      operatorPasteInstrs.push(
        await this.drafter.encodeOperatorPasteInstr(
          OPERATOR_COPY_INDEX,
          3,
          ARGS_START_INDEX + SLOT_SIZE + ADDR_SLOT_OFFSET
        )
      );

      console.log("advancedFarmCalls");
      console.log(advancedFarmCalls);
      blueprintData = ethers.utils.solidityPack(
        ["bytes1", "bytes"],
        [
          0, // data type
          this.farmFacet.interface.encodeFunctionData("advancedFarm", [advancedFarmCalls]) // data
        ]
      );

      return { data: blueprintData, operatorPasteInstrs: operatorPasteInstrs };
    };

    const { data, operatorPasteInstrs } = await this.draftDepositAllBeans(10);

    console.log("data");
    console.log(data);
    console.log("operatorPasteInstrs");
    console.log(operatorPasteInstrs);

    this.blueprint = {
      publisher: publisher.address,
      data: data,
      operatorPasteInstrs: operatorPasteInstrs,
      maxNonce: 100,
      startTime: Math.floor(Date.now() / 1000) - 10 * 3600,
      endTime: Math.floor(Date.now() / 1000) + 10 * 3600
    };

    // this.blueprintHash = await this.tractorFacet.connect(publisher).getBlueprintHash(this.blueprint);

    this.requisition = {
      blueprint: this.blueprint,
      blueprintHash: await this.tractorFacet.connect(publisher).getBlueprintHash(this.blueprint)
    };
    signRequisition(this.requisition, publisher);
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
      ).to.be.revertedWith("TractorFacet: invalid signer");
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
    it("should not fail when signature is valid", async function () {
      // Transfer Bean to internal balance.
      this.beanstalk
        .connect(publisher)
        .transferToken(this.bean.address, publisher.address, to6("1000"), 0, 1);
      expect(await this.bean.balanceOf(publisher.address)).to.be.eq(to6("4000"));
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
      expect(await this.bean.balanceOf(publisher.address)).to.be.eq(to6("4000"));
      expect(await this.bean.balanceOf(operator.address)).to.be.eq(to6(tip));
    });
  });

  // struct AdvancedFarmCall {
  //   bytes callData;
  //   bytes clipboard;
  // }
});
