const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { EXTERNAL } = require("./utils/balances.js");
const { to6 } = require("./utils/helpers.js");
const { signDelegate } = require("./utils/sign.js");
const { BEAN } = require("./utils/constants");
const { ConvertEncoder } = require("./utils/encoder.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const {
  getBooleanApproval,
  getUint256Approval,
  getExternalApproval,
} = require("./utils/approval.js");

let user, user2, delegatee, owner;
let userAddress, user2Address, delegateeAddress, ownerAddress;

describe("FunctionApproval", function () {
  before(async function () {
    [owner, user, user2, delegatee] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    delegateeAddress = delegatee.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.season = await ethers.getContractAt(
      "MockSeasonFacet",
      this.diamond.address
    );
    this.silo = await ethers.getContractAt(
      "MockSiloFacet",
      this.diamond.address
    );
    this.field = await ethers.getContractAt(
      "MockFieldFacet",
      this.diamond.address
    );
    this.convert = await ethers.getContractAt(
      "MockConvertFacet",
      this.diamond.address
    );
    this.delegate = await ethers.getContractAt(
      "DelegateFacet",
      this.diamond.address
    );
    this.permit = await ethers.getContractAt(
      "MockPermitFacet",
      this.diamond.address
    );
    this.bean = await ethers.getContractAt("Bean", BEAN);

    this.siloToken = await ethers.getContractFactory("MockToken");
    this.siloToken = await this.siloToken.deploy("Silo", "SILO");
    await this.siloToken.deployed();

    this.checker = await ethers.getContractFactory("MockChecker");
    this.checker = await this.checker.deploy();
    await this.checker.deployed();

    await this.silo.mockWhitelistToken(
      this.siloToken.address,
      this.silo.interface.getSighash("mockBDV(uint256 amount)"),
      "10000",
      "1"
    );

    await this.siloToken
      .connect(user)
      .approve(this.silo.address, "100000000000");
    await this.siloToken.mint(userAddress, "10000");
    await this.season.siloSunrise(0);
    await this.silo
      .connect(user)
      .deposit(this.siloToken.address, "100", EXTERNAL);
    await this.season.siloSunrise(0);
    await this.silo
      .connect(user)
      .deposit(this.siloToken.address, "100", EXTERNAL);

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

    this.approveDelegate = async (user, selector, approval) => {
      await this.delegate.connect(user).approveDelegate(selector, approval);
    };
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("Set Function Approval", function () {
    it("invalid approval", async function () {
      const selector = await this.silo.PLANT_FOR_SELECTOR();
      const approval = "0x0001";
      await expect(
        this.approveDelegate(user, selector, approval)
      ).to.be.revertedWith("LibDelegate: Invalid Approval");
    });

    it("invalid approval place", async function () {
      const selector = await this.silo.PLANT_FOR_SELECTOR();
      const approval = "0x02010000";
      await expect(
        this.approveDelegate(user, selector, approval)
      ).to.be.revertedWith("LibDelegate: Invalid Approval Place");
    });

    it("invalid approval type", async function () {
      const selector = await this.silo.PLANT_FOR_SELECTOR();
      const approval = "0x00030000";
      await expect(
        this.approveDelegate(user, selector, approval)
      ).to.be.revertedWith("LibDelegate: Invalid Approval Type");
    });

    it("properly approves delegate", async function () {
      const selector = await this.silo.PLANT_FOR_SELECTOR();
      const approval = getBooleanApproval(true, delegateeAddress, true);
      await this.approveDelegate(user, selector, approval);
      expect(await this.delegate.delegateApproval(userAddress, selector)).to.eq(
        approval
      );
    });

    it("properly updates previous approval", async function () {
      const selector = await this.silo.PLANT_FOR_SELECTOR();
      const oldApproval = getBooleanApproval(true, delegateeAddress, true);
      await this.approveDelegate(user, selector, oldApproval);
      const newApproval = getUint256Approval(false, delegateeAddress, 100);
      await this.approveDelegate(user, selector, newApproval);
      expect(await this.delegate.delegateApproval(userAddress, selector)).to.eq(
        newApproval
      );
    });

    it("approve with permit", async function () {
      const selector = await this.silo.PLANT_FOR_SELECTOR();
      const approval = getUint256Approval(false, delegateeAddress, 100);
      const permitSelector =
        this.delegate.interface.getSighash("permitDelegate");
      const nonce = await this.permit.nonces(permitSelector, userAddress);
      const deadline = Math.floor(new Date().getTime() / 1000) + 10 * 60;

      let signature = await signDelegate(
        user,
        this.delegate.address,
        ownerAddress,
        selector,
        approval,
        nonce,
        deadline
      );
      await expect(
        this.delegate.permitDelegate(
          userAddress,
          selector,
          approval,
          deadline,
          signature
        )
      ).to.be.revertedWith("DelegateFacet: invalid signature");

      signature = await signDelegate(
        user,
        this.delegate.address,
        userAddress,
        selector,
        approval,
        nonce,
        deadline - 20 * 60
      );
      await expect(
        this.delegate.permitDelegate(
          userAddress,
          selector,
          approval,
          deadline - 20 * 60,
          signature
        )
      ).to.be.revertedWith("DelegateFacet: expired deadline");

      signature = await signDelegate(
        user,
        this.delegate.address,
        userAddress,
        selector,
        approval,
        nonce,
        deadline
      );
      await this.delegate.permitDelegate(
        userAddress,
        selector,
        approval,
        deadline,
        signature
      );

      expect(await this.delegate.delegateApproval(userAddress, selector)).to.eq(
        approval
      );
      expect(await this.permit.nonces(permitSelector, userAddress)).to.be.eq(
        nonce + 1
      );
    });
  });

  describe("External Approval", function () {
    it("external approval fail", async function () {
      const selector = await this.silo.PLANT_FOR_SELECTOR();
      const approval = getExternalApproval(true, this.checker.address, "0x");
      await this.approveDelegate(user, selector, approval);

      await this.checker.setApprove(false);

      await expect(
        this.silo.connect(delegatee).plantFor(userAddress)
      ).to.be.revertedWith("LibDelegate: Unauthorized");
    });

    it("external approval success", async function () {
      const selector = await this.silo.PLANT_FOR_SELECTOR();
      const approval = getExternalApproval(false, this.checker.address, "0x");
      await this.approveDelegate(user, selector, approval);

      await this.checker.setApprove(true);

      await this.silo.connect(delegatee).plantFor(userAddress);
    });
  });

  describe("PlantFor", function () {
    it("pre approval", async function () {
      const selector = await this.silo.PLANT_FOR_SELECTOR();
      const approval = getBooleanApproval(true, delegateeAddress, true);
      await this.approveDelegate(user, selector, approval);

      await this.silo.connect(delegatee).plantFor(userAddress);
    });

    it("post approval", async function () {
      const selector = await this.silo.PLANT_FOR_SELECTOR();
      const approval = getBooleanApproval(false, delegateeAddress, true);
      await this.approveDelegate(user, selector, approval);

      await this.silo.connect(delegatee).plantFor(userAddress);
    });
  });

  describe("SowWithMinFor", function () {
    beforeEach(async function () {
      await this.field.incrementTotalSoilE(to6("100"));
    });

    it("pre approval", async function () {
      const selector = await this.field.SOW_WITH_MIN_FOR_SELECTOR();
      const approval = getBooleanApproval(true, delegateeAddress, true);
      await this.approveDelegate(user, selector, approval);

      await expect(
        this.field
          .connect(user2)
          .sowWithMinFor(userAddress, to6("100"), EXTERNAL)
      ).to.be.revertedWith("LibDelegate: Unauthorized Caller");

      await this.field
        .connect(delegatee)
        .sowWithMinFor(userAddress, to6("100"), EXTERNAL);
    });

    it("post approval", async function () {
      const selector = await this.field.SOW_WITH_MIN_FOR_SELECTOR();
      const approval = getUint256Approval(
        false,
        ethers.constants.AddressZero,
        to6("1000")
      );
      await this.approveDelegate(user, selector, approval);

      await this.field
        .connect(user2)
        .sowWithMinFor(userAddress, to6("100"), EXTERNAL);
    });
  });

  describe("ConvertFor", function () {
    beforeEach(async function () {});

    it("pre approval", async function () {
      const selector = await this.convert.CONVERT_FOR_SELECTOR();
      const approval = getBooleanApproval(true, delegateeAddress, true);
      await this.approveDelegate(user, selector, approval);

      await this.convert
        .connect(delegatee)
        .convertFor(
          userAddress,
          ConvertEncoder.convertLambdaToLambda("100", this.siloToken.address),
          ["3"],
          ["100"]
        );
    });

    it("post approval", async function () {
      const selector = await this.convert.CONVERT_FOR_SELECTOR();
      const approval = getBooleanApproval(false, delegateeAddress, false);
      await this.approveDelegate(user, selector, approval);

      await expect(
        this.convert
          .connect(delegatee)
          .convertFor(
            userAddress,
            ConvertEncoder.convertLambdaToLambda("100", this.siloToken.address),
            ["3"],
            ["100"]
          )
      ).to.be.revertedWith("LibDelegate: Unauthorized");
    });
  });
});
