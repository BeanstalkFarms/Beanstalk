const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { deployPipeline } = require("../scripts/pipeline.js");
const { getAltBeanstalk, getBean, getUsdc } = require("../utils/contracts.js");
const { toBN, encodeAdvancedData } = require("../utils/index.js");
const { impersonateSigner } = require("../utils/signer.js");
const { getBlueprintHash } = require("./utils/tractor.js");
const {
  EXTERNAL,
  INTERNAL,
  INTERNAL_EXTERNAL,
  INTERNAL_TOLERANT,
} = require("./utils/balances.js");
const {
  BEAN_3_CURVE,
  THREE_POOL,
  THREE_CURVE,
  STABLE_FACTORY,
  WETH,
  ZERO_ADDRESS,
} = require("./utils/constants.js");
const { to6, to18 } = require("./utils/helpers.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");

let user, user2, publisher, owner;
let userAddress, ownerAddress, user2Address;

describe("Tractor", function () {
  before(async function () {
    [owner, user, user2, publisher] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true);
    this.beanstalk = await getAltBeanstalk(contracts.beanstalkDiamond.address);
    this.tractor = await ethers.getContractAt(
      "TractorFacet",
      contracts.beanstalkDiamond.address
    );
    this.bean = await getBean();
    this.usdc = await getUsdc();
    this.threeCurve = await ethers.getContractAt("MockToken", THREE_CURVE);
    this.threePool = await ethers.getContractAt("Mock3Curve", THREE_POOL);
    this.beanMetapool = await ethers.getContractAt(
      "MockMeta3Curve",
      BEAN_3_CURVE
    );
    this.weth = await ethers.getContractAt("MockWETH", WETH);

    const account = impersonateSigner(
      "0x533545dE45Bd44e6B5a6D649256CCfE3b6E1abA6"
    );
    pipeline = await deployPipeline(account);

    this.mockContract = await (
      await ethers.getContractFactory("MockContract", owner)
    ).deploy();
    await this.mockContract.deployed();
    await this.mockContract.setAccount(user2.address);

    await this.bean.mint(user.address, to6("1000"));
    await this.usdc.mint(user.address, to6("1000"));

    await this.bean.connect(user).approve(this.beanstalk.address, to18("1"));
    await this.usdc.connect(user).approve(this.beanstalk.address, to18("1"));

    await this.bean
      .connect(user)
      .approve(this.beanstalk.address, "100000000000");
    await this.bean
      .connect(user)
      .approve(this.beanMetapool.address, "100000000000");
    await this.bean.mint(userAddress, to6("10000"));

    await this.threeCurve.mint(userAddress, to18("1000"));
    await this.threePool.set_virtual_price(to18("1"));
    await this.threeCurve
      .connect(user)
      .approve(this.beanMetapool.address, to18("100000000000"));

    await this.beanMetapool.set_A_precise("1000");
    await this.beanMetapool.set_virtual_price(ethers.utils.parseEther("1"));
    await this.beanMetapool
      .connect(user)
      .approve(this.threeCurve.address, to18("100000000000"));
    await this.beanMetapool
      .connect(user)
      .approve(this.beanstalk.address, to18("100000000000"));
    await this.threeCurve
      .connect(user)
      .approve(this.beanstalk.address, to18("100000000000"));

    this.mockBlueprint = {
      predicates: ["0x1234567890", "0x1234567890"],
      data: "0x1234567890",
      calldataCopyParams: [],
      initialPredicateStates: ["0x1234567890", "0x1234567890", "0x1234567890"],
    };
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("Publish Blueprint", function () {
    it("should publish new blueprint", async function () {
      const tx = await this.tractor
        .connect(publisher)
        .publishBlueprint(
          this.mockBlueprint.predicates,
          this.mockBlueprint.data,
          this.mockBlueprint.calldataCopyParams,
          this.mockBlueprint.initialPredicateStates
        );

      await expect(tx)
        .to.emit(this.tractor, "PublishBlueprint")
        .withArgs(
          publisher.address,
          this.mockBlueprint.predicates,
          this.mockBlueprint.data,
          this.mockBlueprint.calldataCopyParams
        );
    });

    it("should not publish same blueprint twice", async function () {
      await this.tractor
        .connect(publisher)
        .publishBlueprint(
          this.mockBlueprint.predicates,
          this.mockBlueprint.data,
          this.mockBlueprint.calldataCopyParams,
          this.mockBlueprint.initialPredicateStates
        );

      await expect(
        this.tractor
          .connect(publisher)
          .publishBlueprint(
            this.mockBlueprint.predicates,
            this.mockBlueprint.data,
            this.mockBlueprint.calldataCopyParams,
            this.mockBlueprint.initialPredicateStates
          )
      ).to.be.revertedWith("TractorFacet: Blueprint already exist");
    });
  });

  describe("Destroy Blueprint", function () {
    it("should revert when destroying unpublished blueprint", async function () {
      await expect(
        this.tractor
          .connect(publisher)
          .destroyBlueprint(
            this.mockBlueprint.predicates,
            this.mockBlueprint.data,
            this.mockBlueprint.calldataCopyParams
          )
      ).to.be.revertedWith("TractorFacet: Blueprint does not exist");
    });

    it("should destroy blueprint", async function () {
      await this.tractor
        .connect(publisher)
        .publishBlueprint(
          this.mockBlueprint.predicates,
          this.mockBlueprint.data,
          this.mockBlueprint.calldataCopyParams,
          this.mockBlueprint.initialPredicateStates
        );

      const tx = await this.tractor
        .connect(publisher)
        .destroyBlueprint(
          this.mockBlueprint.predicates,
          this.mockBlueprint.data,
          this.mockBlueprint.calldataCopyParams
        );

      const hash = getBlueprintHash(
        publisher.address,
        this.mockBlueprint.predicates,
        this.mockBlueprint.data,
        this.mockBlueprint.calldataCopyParams
      );

      await expect(tx).to.emit(this.tractor, "DestroyBlueprint").withArgs(hash);
    });
  });

  describe("View Blueprint", function () {
    it("when blueprint exists", async function () {
      await this.tractor
        .connect(publisher)
        .publishBlueprint(
          this.mockBlueprint.predicates,
          this.mockBlueprint.data,
          this.mockBlueprint.calldataCopyParams,
          this.mockBlueprint.initialPredicateStates
        );

      const { isActive, predicateStates } = await this.tractor[
        "viewBlueprint(address,bytes[],bytes,bytes32[])"
      ](
        publisher.address,
        this.mockBlueprint.predicates,
        this.mockBlueprint.data,
        this.mockBlueprint.calldataCopyParams
      );

      expect(isActive).to.be.eq(true);
      expect(predicateStates.length).to.be.eq(this.mockBlueprint.predicates.length);
      for (let i = 0; i < predicateStates.length; ++i) {
        expect(predicateStates[i]).to.be.eq(this.mockBlueprint.predicates[i]);
      }

      const hash = getBlueprintHash(
        publisher.address,
        this.mockBlueprint.predicates,
        this.mockBlueprint.data,
        this.mockBlueprint.calldataCopyParams
      );
      expect(await this.tractor["viewBlueprint(bytes32)"](hash)).to.be.eq(true);
    });

    it("when blueprint does not exist", async function () {
      const { isActive, predicateStates } = await this.tractor[
        "viewBlueprint(address,bytes[],bytes,bytes32[])"
      ](
        publisher.address,
        this.mockBlueprint.predicates,
        this.mockBlueprint.data,
        this.mockBlueprint.calldataCopyParams
      );

      expect(isActive).to.be.eq(false);
      expect(predicateStates.length).to.be.eq(0);

      const hash = getBlueprintHash(
        publisher.address,
        this.mockBlueprint.predicates,
        this.mockBlueprint.data,
        this.mockBlueprint.calldataCopyParams
      );
      expect(await this.tractor["viewBlueprint(bytes32)"](hash)).to.be.eq(false);
    });
  });
});
