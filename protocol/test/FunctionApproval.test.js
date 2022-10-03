const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { EXTERNAL } = require("./utils/balances.js");
const { to6 } = require("./utils/helpers.js");
const { signDelegate } = require("./utils/sign.js");
const { BEAN } = require("./utils/constants");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");

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
    this.delegate = await ethers.getContractAt(
      "DelegateFacet",
      this.diamond.address
    );
    this.permit = await ethers.getContractAt(
      "MockPermitFacet",
      this.diamond.address
    );
    this.bean = await ethers.getContractAt("Bean", BEAN);

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

    this.approveDelegate = async (
      user,
      selector,
      delegateeAddress,
      allowance
    ) => {
      const approval = ethers.utils.hexZeroPad(allowance.toHexString(), 32);
      await this.delegate
        .connect(user)
        .approveDelegate(selector, delegateeAddress, approval);
    };
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("Set Function Approval", function () {
    it("properly approves delegate", async function () {
      const selector = await this.silo.PLANT_DELEGATED_SELECTOR();
      const allowance = ethers.BigNumber.from(100);
      await this.approveDelegate(user, selector, delegateeAddress, allowance);
      expect(
        await this.delegate.delegateAllowance(
          userAddress,
          selector,
          delegateeAddress
        )
      ).to.eq(allowance);
    });

    it("properly approves delegate twice", async function () {
      const selector = await this.silo.PLANT_DELEGATED_SELECTOR();
      await this.approveDelegate(
        user,
        selector,
        delegateeAddress,
        ethers.BigNumber.from(100)
      );
      const allowance = ethers.BigNumber.from(1000);
      await this.approveDelegate(user, selector, delegateeAddress, allowance);
      expect(
        await this.delegate.delegateAllowance(
          userAddress,
          selector,
          delegateeAddress
        )
      ).to.eq(allowance);
    });

    it("appove with permit", async function () {
      const selector = await this.silo.PLANT_DELEGATED_SELECTOR();
      const allowance = ethers.BigNumber.from(100);
      const approval = ethers.utils.hexZeroPad(allowance.toHexString(), 32);
      const nonce = await this.permit.nonces(userAddress);
      const deadline = Math.floor(new Date().getTime() / 1000) + 10 * 60;

      let signature = await signDelegate(
        user,
        this.delegate.address,
        ownerAddress,
        selector,
        delegateeAddress,
        approval,
        nonce,
        deadline
      );
      await expect(
        this.delegate.permitDelegate(
          userAddress,
          selector,
          delegateeAddress,
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
        delegateeAddress,
        approval,
        nonce,
        deadline - 20 * 60
      );
      await expect(
        this.delegate.permitDelegate(
          userAddress,
          selector,
          delegateeAddress,
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
        delegateeAddress,
        approval,
        nonce,
        deadline
      );
      await this.delegate.permitDelegate(
        userAddress,
        selector,
        delegateeAddress,
        approval,
        deadline,
        signature
      );

      expect(
        await this.delegate.delegateAllowance(
          userAddress,
          selector,
          delegateeAddress
        )
      ).to.eq(allowance);
      expect(await this.permit.nonces(userAddress)).to.be.eq(nonce + 1);
    });
  });

  describe("Spend Allowance", function () {
    it("spend allowance - plantDelegated", async function () {
      await expect(
        this.silo.connect(delegatee).plantDelegated(userAddress)
      ).to.be.revertedWith("Silo: unauthorized");

      await this.season.siloSunrise(to6("100"));

      const selector = await this.silo.PLANT_DELEGATED_SELECTOR();
      await this.approveDelegate(user, selector, delegateeAddress, to6("40"));

      await expect(
        this.silo.connect(delegatee).plantDelegated(userAddress)
      ).to.be.revertedWith("Silo: not enough allowance");

      const allowance = to6("100");
      await this.approveDelegate(user, selector, delegateeAddress, allowance);

      const totalBeansBefore = await this.silo.totalEarnedBeans();

      await this.silo.connect(delegatee).plantDelegated(userAddress);

      const totalBeansAfter = await this.silo.totalEarnedBeans();
      const beans = totalBeansBefore.sub(totalBeansAfter);

      expect(
        await this.delegate.delegateAllowance(
          userAddress,
          selector,
          delegateeAddress
        )
      ).to.eq(allowance.sub(beans));
    });
  });
});
