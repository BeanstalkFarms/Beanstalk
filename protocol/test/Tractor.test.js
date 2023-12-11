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
const { EXTERNAL } = require("./utils/balances.js");
const { BEAN, BEAN_3_CURVE, THREE_CURVE, ZERO_ADDRESS } = require("./utils/constants.js");
const { to6, to18 } = require("./utils/helpers.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { ethers } = require("hardhat");

let publisher, operator, user;

describe("Tractor", function () {
  before(async function () {
    [owner, publisher, operator, user] = await ethers.getSigners();
    const contracts = await deploy("Test", false, true);
    this.diamond = contracts.beanstalkDiamond;
    this.beanstalk = await getAltBeanstalk(this.diamond.address);
    this.tractor = await ethers.getContractAt("TractorFacet", this.diamond.address);
    this.season = await ethers.getContractAt("MockSeasonFacet", this.diamond.address);
    this.silo = await ethers.getContractAt("MockSiloFacet", this.diamond.address);

    this.bean = await ethers.getContractAt("Bean", BEAN);

    this.depot = await ethers.getContractAt("DepotFacet", this.diamond.address);
    this.tokenFacet = await ethers.getContractAt("TokenFacet", this.diamond.address);

    await this.season.lightSunrise();
    // await this.bean.connect(user).approve(this.silo.address, "100000000000");
    // await this.bean.connect(user2).approve(this.silo.address, "100000000000");
    // await this.bean.mint(userAddress, to6("10000"));
    // await this.bean.mint(user2Address, to6("10000"));
    // // await this.silo.update(userAddress);

    // await this.silo
    //   .connect(user)
    //   .deposit(this.bean.address, to6("1000"), EXTERNAL);
    // await this.silo
    //   .connect(user2)
    //   .deposit(this.bean.address, to6("1000"), EXTERNAL);

    this.blueprint = {
      publisher: publisher.address,
      data: "0x1234567890",
      operatorPasteInstrs: [],
      maxNonce: 100,
      startTime: Math.floor(Date.now() / 1000) - 10 * 3600,
      endTime: Math.floor(Date.now() / 1000) + 10 * 3600
    };

    // this.blueprintHash = await this.tractor.connect(publisher).getBlueprintHash(this.blueprint);

    this.requisition = {
      blueprint: this.blueprint,
      // blueprintHash: ethers.utils.arrayify(await this.tractor.connect(publisher).getBlueprintHash(this.blueprint)) // getBlueprintHash(this.blueprint)
      // blueprintHash: await getBlueprintHash(this.tractor, this.blueprint) // getBlueprintHash(this.blueprint)
      blueprintHash: await this.tractor.connect(publisher).getBlueprintHash(this.blueprint)
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
        this.tractor.connect(publisher).publishRequisition(this.requisition)
      ).to.be.revertedWith("ECDSA: invalid signature length");
    });

    it("should fail when signature is invalid #2", async function () {
      this.requisition.signature =
        "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
      await expect(
        this.tractor.connect(publisher).publishRequisition(this.requisition)
      ).to.be.revertedWith("ECDSA: invalid signature 'v' value");
    });

    it("should fail when signature is invalid #3", async function () {
      await signRequisition(this.requisition, user);
      await expect(
        this.tractor.connect(publisher).publishRequisition(this.requisition)
      ).to.be.revertedWith("TractorFacet: invalid signer");
    });

    it("should publish blueprint", async function () {
      await signRequisition(this.requisition, publisher);
      await this.tractor.connect(publisher).publishRequisition(this.requisition);
    });
  });

  describe("Cancel Requisition", function () {
    it("should fail when signature is invalid #1", async function () {
      this.requisition.signature = "0x0000";
      await expect(
        this.tractor.connect(publisher).cancelBlueprint(this.requisition)
      ).to.be.revertedWith("ECDSA: invalid signature length");
    });

    it("should fail when signature is invalid #2", async function () {
      this.requisition.signature =
        "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
      await expect(
        this.tractor.connect(publisher).cancelBlueprint(this.requisition)
      ).to.be.revertedWith("ECDSA: invalid signature 'v' value");
    });

    it("should fail when signature is invalid #3", async function () {
      await signRequisition(this.requisition, publisher);
      await expect(this.tractor.connect(user).cancelBlueprint(this.requisition)).to.be.revertedWith(
        "TractorFacet: not publisher"
      );
    });

    it("should cancel Requisition", async function () {
      await signRequisition(this.requisition, publisher);
      const tx = await this.tractor.connect(publisher).cancelBlueprint(this.requisition);

      await expect(tx)
        .to.emit(this.tractor, "CancelBlueprint")
        .withArgs(this.requisition.blueprintHash);

      const nonce = await this.tractor.getBlueprintNonce(this.requisition.blueprintHash);
      expect(nonce).to.be.eq(ethers.constants.MaxUint256);
    });
  });
});
