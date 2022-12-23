const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { getAltBeanstalk } = require("../utils/contracts.js");
const { toBN, encodeAdvancedData } = require("../utils/index.js");
const {
  getBlueprintHash,
  signBlueprint,
  getNormalBlueprintData,
  getAdvancedBlueprintData,
  generateCalldataCopyParams,
} = require("./utils/tractor.js");
const { EXTERNAL } = require("./utils/balances.js");
const {
  BEAN,
  BEAN_3_CURVE,
  THREE_CURVE,
  ZERO_ADDRESS,
} = require("./utils/constants.js");
const { to6, to18 } = require("./utils/helpers.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { ethers } = require("hardhat");

let user, user2, user3, publisher, owner;
let userAddress, user2Address;

describe("Tractor", function () {
  before(async function () {
    [owner, user, user2, user3, publisher] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true);
    this.diamond = contracts.beanstalkDiamond;
    this.beanstalk = await getAltBeanstalk(this.diamond.address);
    this.tractor = await ethers.getContractAt(
      "TractorFacet",
      this.diamond.address
    );
    this.season = await ethers.getContractAt(
      "MockSeasonFacet",
      this.diamond.address
    );
    this.silo = await ethers.getContractAt(
      "MockSiloFacet",
      this.diamond.address
    );
    this.mockContract = await (
      await ethers.getContractFactory("MockContract", owner)
    ).deploy();
    await this.mockContract.deployed();
    await this.mockContract.setAccount(user2.address);
    this.bean = await ethers.getContractAt("Bean", BEAN);
    const OracleFactory = await ethers.getContractFactory(
      "CheckEarnedBeanBalanceOracle"
    );
    this.oracle = await OracleFactory.deploy(
      this.diamond.address,
      this.bean.address
    );
    await this.oracle.deployed();
    this.depot = await ethers.getContractAt("DepotFacet", this.diamond.address);
    this.tokenFacet = await ethers.getContractAt(
      "TokenFacet",
      this.diamond.address
    );
    this.farm = await ethers.getContractAt("FarmFacet", this.diamond.address);
    this.curve = await ethers.getContractAt("CurveFacet", this.diamond.address);
    this.beanMetapool = await ethers.getContractAt(
      "MockMeta3Curve",
      BEAN_3_CURVE
    );
    this.threeCurve = await ethers.getContractAt("IERC20", THREE_CURVE);

    await this.beanMetapool.set_A_precise("1000");
    await this.beanMetapool.set_virtual_price(to18("1"));
    await this.beanMetapool.set_balances([
      "1",
      ethers.utils.parseUnits("1", 12),
    ]);
    await this.beanMetapool.set_supply("0");

    await this.season.lightSunrise();
    await this.bean.connect(user).approve(this.silo.address, "100000000000");
    await this.bean.connect(user2).approve(this.silo.address, "100000000000");
    await this.bean.mint(userAddress, to6("10000"));
    await this.bean.mint(user2Address, to6("10000"));
    await this.silo.update(userAddress);
    await this.silo
      .connect(user)
      .deposit(this.bean.address, to6("1000"), EXTERNAL);
    await this.silo
      .connect(user2)
      .deposit(this.bean.address, to6("1000"), EXTERNAL);

    this.blueprint = {
      publisher: publisher.address,
      data: "0x1234567890",
      calldataCopyParams: [],
      maxNonce: 100,
      startTime: Math.floor(Date.now() / 1000) - 10 * 3600,
      endTime: Math.floor(Date.now() / 1000) + 10 * 3600,
    };
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("Publish Blueprint", function () {
    it("should not fail when signature is invalid #1", async function () {
      this.blueprint.signature = "0x0000";
      await expect(
        this.tractor.connect(publisher).publishBlueprint(this.blueprint)
      ).to.be.revertedWith("ECDSA: invalid signature length");
    });

    it("should not fail when signature is invalid #2", async function () {
      this.blueprint.signature =
        "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
      await expect(
        this.tractor.connect(publisher).publishBlueprint(this.blueprint)
      ).to.be.revertedWith("ECDSA: invalid signature 'v' value");
    });

    it("should not fail when signature is invalid #3", async function () {
      await signBlueprint(this.blueprint, user);
      await expect(
        this.tractor.connect(publisher).publishBlueprint(this.blueprint)
      ).to.be.revertedWith("TractorFacet: invalid signature");
    });

    it("should fail new blueprint", async function () {
      await signBlueprint(this.blueprint, publisher);
      await this.tractor.connect(publisher).publishBlueprint(this.blueprint);
    });
  });

  describe("Destroy Blueprint", function () {
    it("should not fail when signature is invalid #1", async function () {
      this.blueprint.signature = "0x0000";
      await expect(
        this.tractor.connect(publisher).destroyBlueprint(this.blueprint)
      ).to.be.revertedWith("ECDSA: invalid signature length");
    });

    it("should not fail when signature is invalid #2", async function () {
      this.blueprint.signature =
        "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
      await expect(
        this.tractor.connect(publisher).destroyBlueprint(this.blueprint)
      ).to.be.revertedWith("ECDSA: invalid signature 'v' value");
    });

    it("should not fail when signature is invalid #3", async function () {
      await signBlueprint(this.blueprint, user);
      await expect(
        this.tractor.connect(publisher).destroyBlueprint(this.blueprint)
      ).to.be.revertedWith("TractorFacet: invalid signature");
    });

    it("should destroy blueprint", async function () {
      await signBlueprint(this.blueprint, publisher);
      const tx = await this.tractor
        .connect(publisher)
        .destroyBlueprint(this.blueprint);

      const hash = getBlueprintHash(this.blueprint);
      await expect(tx).to.emit(this.tractor, "DestroyBlueprint").withArgs(hash);

      const nonce = await this.tractor.blueprintNonce(this.blueprint);
      expect(nonce).to.be.eq(ethers.constants.MaxUint256);
    });
  });

  describe("Tractor Operation", function () {
    it("when blueprint is not active #1", async function () {
      const blueprint = {
        ...this.blueprint,
        startTime: Math.floor(Date.now() / 1000) + 3600,
      };
      await signBlueprint(blueprint, publisher);

      await expect(
        this.tractor.connect(user).tractor(blueprint, "0x")
      ).to.be.revertedWith("TractorFacet: blueprint is not active");
    });

    it("when blueprint is not active #2", async function () {
      const blueprint = {
        ...this.blueprint,
        endTime: Math.floor(Date.now() / 1000) - 3600,
      };
      await signBlueprint(blueprint, publisher);

      await expect(
        this.tractor.connect(user).tractor(blueprint, "0x")
      ).to.be.revertedWith("TractorFacet: blueprint is not active");
    });

    it("when maxNonce is reached", async function () {
      const blueprint = {
        ...this.blueprint,
        maxNonce: 0,
      };
      await signBlueprint(blueprint, publisher);

      await expect(
        this.tractor.connect(user).tractor(blueprint, "0x")
      ).to.be.revertedWith("TractorFacet: maxNonce reached");
    });

    it("blueprint type - unknown", async function () {
      const blueprint = {
        ...this.blueprint,
        data: "0x0203040506070809",
      };
      await signBlueprint(blueprint, publisher);

      await expect(
        this.tractor.connect(user).tractor(blueprint, "0x")
      ).to.be.revertedWith("TractorFacet: unknown blueprint type");
    });

    it("blueprint type - normal", async function () {
      const data = getNormalBlueprintData([]);
      const blueprint = {
        ...this.blueprint,
        data,
      };

      await signBlueprint(blueprint, publisher);

      const tx = await this.tractor.connect(user).tractor(blueprint, "0x");

      const hash = getBlueprintHash(blueprint);
      await expect(tx)
        .to.emit(this.tractor, "Tractor")
        .withArgs(userAddress, hash);
    });

    it("blueprint type - advanced", async function () {
      const data = getAdvancedBlueprintData([]);
      const blueprint = {
        ...this.blueprint,
        data,
      };

      await signBlueprint(blueprint, publisher);

      const tx = await this.tractor.connect(user).tractor(blueprint, "0x");

      const hash = getBlueprintHash(blueprint);
      await expect(tx)
        .to.emit(this.tractor, "Tractor")
        .withArgs(userAddress, hash);
    });
  });

  it("Plant Tractor", async function () {
    const checkEarnedBean = await this.oracle.interface.encodeFunctionData(
      "checkEarnedBeanBalance",
      [userAddress, to6("50")]
    );
    const validPipe = await this.depot.interface.encodeFunctionData(
      "validPipe",
      [[this.oracle.address, checkEarnedBean]]
    );
    const plant = await this.silo.interface.encodeFunctionData(
      "tractorPlant",
      []
    );
    const transferToken = await this.tokenFacet.interface.encodeFunctionData(
      "tractorTransferToken",
      [BEAN, ZERO_ADDRESS, to6("1"), 0, 0]
    );

    const blueprint = {
      publisher: userAddress,
      data: getNormalBlueprintData([validPipe, plant, transferToken]),
      calldataCopyParams: generateCalldataCopyParams([
        [-1, 612, 0],
        [32, 708, 32],
      ]),
      maxNonce: 100,
      startTime: Math.floor(Date.now() / 1000) - 10 * 3600,
      endTime: Math.floor(Date.now() / 1000) + 10 * 3600,
    };
    const calldata = ethers.utils.hexZeroPad(
      ethers.BigNumber.from(1).toHexString(),
      32
    );

    await signBlueprint(blueprint, user);

    await this.season.siloSunrise(to6("100"));

    await this.tractor.connect(user3).tractor(blueprint, calldata);
  });

  it("Advanced Farm - 1 Return Data", async function () {
    await this.beanstalk
      .connect(user)
      .transferToken(this.bean.address, user.address, to6("100"), 0, 1);

    const selector = this.beanstalk.interface.encodeFunctionData(
      "getInternalBalance",
      [user.address, this.bean.address]
    );
    const data = encodeAdvancedData(0);
    const selector2 = this.tokenFacet.interface.encodeFunctionData(
      "tractorTransferToken",
      [this.bean.address, ZERO_ADDRESS, to6("0"), 1, 0]
    );
    const data2 = encodeAdvancedData(1, (value = to6("0")), [0, 32, 100]);

    const blueprint = {
      publisher: userAddress,
      data: getAdvancedBlueprintData([
        [selector, data],
        [selector2, data2],
      ]),
      calldataCopyParams: generateCalldataCopyParams([
        [-1, 548, 0],
        [32, 644, 32],
      ]),
      maxNonce: 100,
      startTime: Math.floor(Date.now() / 1000) - 10 * 3600,
      endTime: Math.floor(Date.now() / 1000) + 10 * 3600,
    };

    const calldata = ethers.utils.hexZeroPad(
      ethers.BigNumber.from(1).toHexString(),
      32
    );

    await signBlueprint(blueprint, user);

    await this.tractor.connect(user3).tractor(blueprint, calldata);

    expect(
      await this.beanstalk.getInternalBalance(user.address, this.bean.address)
    ).to.be.equal(toBN("0"));
    expect(
      await this.beanstalk.getInternalBalance(user3.address, this.bean.address)
    ).to.be.equal(to6("100"));
  });

  it("Advanced Farm - Multiple Return Data", async function () {
    await this.beanstalk
      .connect(user)
      .transferToken(this.bean.address, user.address, to6("100"), 0, 1);
    const selector = this.beanstalk.interface.encodeFunctionData(
      "getInternalBalance",
      [user.address, this.bean.address]
    );
    const pipe = this.mockContract.interface.encodeFunctionData(
      "getAccount",
      []
    );
    const selector2 = this.beanstalk.interface.encodeFunctionData("readPipe", [
      [this.mockContract.address, pipe],
    ]);
    const data12 = encodeAdvancedData(0);
    const selector3 = this.tokenFacet.interface.encodeFunctionData(
      "tractorTransferToken",
      [this.bean.address, ZERO_ADDRESS, to6("0"), 1, 1]
    );
    const data3 = encodeAdvancedData(2, toBN("0"), [
      [0, 32, 100],
      [1, 96, 68],
    ]);

    const blueprint = {
      publisher: userAddress,
      data: getAdvancedBlueprintData([
        [selector, data12],
        [selector2, data12],
        [selector3, data3],
      ]),
      calldataCopyParams: [],
      maxNonce: 100,
      startTime: Math.floor(Date.now() / 1000) - 10 * 3600,
      endTime: Math.floor(Date.now() / 1000) + 10 * 3600,
    };

    await signBlueprint(blueprint, user);

    await this.tractor.connect(user3).tractor(blueprint, "0x");

    expect(
      await this.beanstalk.getInternalBalance(user.address, this.bean.address)
    ).to.be.equal(toBN("0"));
    expect(
      await this.beanstalk.getInternalBalance(user2.address, this.bean.address)
    ).to.be.equal(to6("100"));
  });

  it("Advanced Farm - Invalid advanced type", async function () {
    const selector = this.beanstalk.interface.encodeFunctionData("sunrise", []);
    const data = encodeAdvancedData(9);

    const blueprint = {
      publisher: userAddress,
      data: getAdvancedBlueprintData([[selector, data]]),
      calldataCopyParams: [],
      maxNonce: 100,
      startTime: Math.floor(Date.now() / 1000) - 10 * 3600,
      endTime: Math.floor(Date.now() / 1000) + 10 * 3600,
    };

    await signBlueprint(blueprint, user);

    await expect(
      this.tractor.connect(user3).tractor(blueprint, "0x")
    ).to.be.revertedWith("Function: Advanced Type not supported");
  });
});
