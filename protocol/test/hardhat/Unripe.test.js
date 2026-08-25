const { expect } = require("chai");
const fs = require("fs");
const hre = require("hardhat");
const { EXTERNAL, INTERNAL, INTERNAL_TOLERANT } = require("./utils/balances.js");
const { deploy } = require("../../scripts/deploy.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { BEAN, UNRIPE_BEAN, UNRIPE_LP, USDT, ZERO_BYTES } = require("./utils/constants");
const { to6 } = require("./utils/helpers.js");
const { getAllBeanstalkContracts } = require("../../utils/contracts");
const {
  BEGIN_BARN_RAISE_MIGRATION_SELECTOR,
  ENROOT_SELECTORS,
  appendEnrootFacetToArtifact,
  prepareProtectedUnderlying,
  upgradeProtectedUnderlying
} = require("../../scripts/protectedUnderlying");

let user, user2, owner;
let userAddress, ownerAddress, user2Address;

describe("Unripe", function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners();
    userAddress = await user.address;
    user2Address = await user2.address;

    const contracts = await deploy((verbose = false), (mock = true), (reset = true));
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    // `beanstalk` contains all functions that the regular beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [beanstalk, mockBeanstalk] = await getAllBeanstalkContracts(this.diamond.address);

    this.bean = await ethers.getContractAt("MockToken", BEAN);
    await this.bean.connect(owner).approve(this.diamond.address, to6("100000000"));
    this.unripeBean = await ethers.getContractAt("MockToken", UNRIPE_BEAN);
    this.unripeLP = await ethers.getContractAt("MockToken", UNRIPE_LP);
    await this.unripeLP.connect(user).approve(this.diamond.address, to6("10000000000"));
    await this.unripeBean.connect(user).approve(this.diamond.address, to6("1000000000"));
    await this.unripeLP.connect(owner).approve(this.diamond.address, to6("10000000000"));
    await this.unripeBean.connect(owner).approve(this.diamond.address, to6("1000000000"));
    await mockBeanstalk.setFertilizerE(true, to6("10000"));
    await mockBeanstalk.addUnripeToken(UNRIPE_BEAN, BEAN, ZERO_BYTES);
    await mockBeanstalk.addUnripeToken(UNRIPE_LP, BEAN, ZERO_BYTES);
    await this.bean.mint(ownerAddress, to6("1000"));
    await mockBeanstalk.siloSunrise(0);
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  it("reverts on non-unripe address", async function () {
    await expect(mockBeanstalk.getPenalty(this.bean.address)).to.be.reverted;
    await expect(mockBeanstalk.getRecapFundedPercent(this.bean.address)).to.be.reverted;
  });

  it("getters", async function () {
    await this.unripeBean.mint(userAddress, to6("1000"));
    await this.unripeLP.mint(userAddress, to6("1000"));
    expect(await mockBeanstalk.getRecapPaidPercent()).to.be.equal("0");
    expect(await mockBeanstalk.getUnderlyingPerUnripeToken(UNRIPE_BEAN)).to.be.equal("0");
    expect(await mockBeanstalk.getPenalty(UNRIPE_BEAN)).to.be.equal(to6("0"));
    expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal("0");
    expect(await mockBeanstalk.isUnripe(UNRIPE_BEAN)).to.be.equal(true);
    expect(await mockBeanstalk.getPenalizedUnderlying(UNRIPE_BEAN, to6("1"))).to.be.equal("0");
    expect(await mockBeanstalk.getUnderlying(UNRIPE_BEAN, to6("1"))).to.be.equal("0");
    expect(await mockBeanstalk.balanceOfUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal("0");
  });

  it("executes the protected backing diamond cut", async function () {
    await this.unripeLP.mint(userAddress, to6("100"));
    await mockBeanstalk.connect(owner).addUnderlying(UNRIPE_LP, to6("100"));

    await upgradeProtectedUnderlying({
      RFF: ownerAddress,
      amount: to6("90"),
      diamondAddress: this.diamond.address,
      account: owner,
      execute: true,
      verbose: false
    });

    const unripeFacet = await ethers.getContractAt("UnripeFacet", this.diamond.address);
    expect(await unripeFacet.getProtectedUnderlying(UNRIPE_LP)).to.equal(to6("90"));
    expect(await unripeFacet.getTotalUnderlying(UNRIPE_LP)).to.equal(to6("100"));

    const migrationCall = ethers.utils.hexConcat([
      BEGIN_BARN_RAISE_MIGRATION_SELECTOR,
      ethers.utils.defaultAbiCoder.encode(["address"], [BEAN])
    ]);
    await expect(
      owner.sendTransaction({ to: this.diamond.address, data: migrationCall })
    ).to.be.revertedWith("Diamond: Function does not exist");
  });

  it("threads the RFF custodian into generated initializer calldata", async function () {
    await this.unripeLP.mint(userAddress, to6("100"));
    await mockBeanstalk.connect(owner).addUnderlying(UNRIPE_LP, to6("100"));
    await network.provider.send("hardhat_setCode", [
      user2Address,
      "0x600260005260206000f3"
    ]);

    let prepared;
    try {
      prepared = await prepareProtectedUnderlying({
        hre,
        amount: "90",
        custodian: user2Address,
        diamondAddress: this.diamond.address,
        fork: true,
        confirm: true
      });

      const initFactory = await ethers.getContractFactory("InitProtectedUnderlying");
      const [recipient, amount] = initFactory.interface.decodeFunctionData(
        "init",
        prepared.diamondCut.functionCall
      );
      expect(recipient).to.equal(user2Address);
      expect(amount).to.equal(to6("90"));
    } finally {
      if (prepared?.outputPath && fs.existsSync(prepared.outputPath)) {
        fs.unlinkSync(prepared.outputPath);
      }
    }
  });

  it("appends an isolated EnrootFacet replacement to an existing Safe artifact", async function () {
    const existingFacet = ethers.Wallet.createRandom().address;
    const enrootFacet = ethers.Wallet.createRandom().address;
    const baseArtifact = {
      preflight: { chainId: 42161, diamond: this.diamond.address },
      diamondCut: {
        diamondCut: [[existingFacet, 1, ["0x12345678"]]],
        initFacetAddress: ownerAddress,
        functionCall: "0xabcdef"
      },
      safeTransaction: { to: this.diamond.address, value: "0", data: "0x", operation: 0 }
    };

    const updated = appendEnrootFacetToArtifact({
      baseArtifact,
      enrootFacet,
      ethers
    });

    expect(ENROOT_SELECTORS).to.deep.equal(["0xe43b44ee", "0x0b58f073", "0x88fcd169"]);
    expect(baseArtifact.diamondCut.diamondCut).to.have.length(1);
    expect(updated.diamondCut.diamondCut).to.deep.equal([
      [existingFacet, 1, ["0x12345678"]],
      [ethers.utils.getAddress(enrootFacet), 1, ENROOT_SELECTORS]
    ]);
    expect(updated.diamondCut.initFacetAddress).to.equal(ownerAddress);
    expect(updated.diamondCut.functionCall).to.equal("0xabcdef");
  });

  it("rejects an Enroot selector already present in the base cut", async function () {
    const facet = ethers.Wallet.createRandom().address;
    const baseArtifact = {
      preflight: { chainId: 42161, diamond: this.diamond.address },
      diamondCut: {
        diamondCut: [[facet, 1, [ENROOT_SELECTORS[0]]]],
        initFacetAddress: ethers.constants.AddressZero,
        functionCall: "0x"
      }
    };

    expect(() =>
      appendEnrootFacetToArtifact({ baseArtifact, enrootFacet: facet, ethers })
    ).to.throw("Enroot selector already exists in base cut");
  });

  describe("protected Unripe LP backing", function () {
    const totalUnderlying = to6("100");
    const protectedUnderlying = to6("90");

    beforeEach(async function () {
      await this.unripeLP.mint(userAddress, to6("100"));
      await mockBeanstalk.connect(owner).addUnderlying(UNRIPE_LP, totalUnderlying);

      const totalRecapDollarsNeeded = await mockBeanstalk.getTotalRecapDollarsNeeded();
      await mockBeanstalk.connect(owner).setPenaltyParams(totalRecapDollarsNeeded, 0);

      const initFactory = await ethers.getContractFactory("InitProtectedUnderlying");
      this.initProtectedUnderlying = await initFactory.deploy();
      await this.initProtectedUnderlying.deployed();

      const diamondCut = await ethers.getContractAt("DiamondCutFacet", this.diamond.address);
      const initData = this.initProtectedUnderlying.interface.encodeFunctionData("init", [
        user2Address,
        protectedUnderlying
      ]);
      await diamondCut
        .connect(owner)
        .diamondCut([], this.initProtectedUnderlying.address, initData);

      this.unripeFacet = await ethers.getContractAt("UnripeFacet", this.diamond.address);
    });

    it("moves LP to protected custody without changing holder claims", async function () {
      expect(await this.unripeFacet.getProtectedUnderlying(UNRIPE_LP)).to.equal(
        protectedUnderlying
      );
      expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_LP)).to.equal(totalUnderlying);
      expect(await mockBeanstalk.getUnderlying(UNRIPE_LP, to6("100"))).to.equal(
        totalUnderlying
      );
      expect(await mockBeanstalk.getUnderlyingPerUnripeToken(UNRIPE_LP)).to.equal(to6("1"));
      expect(await this.bean.balanceOf(this.diamond.address)).to.equal(to6("10"));
    });

    it("records the configured protected custodian", async function () {
      const custodianReader = await ethers.getContractAt(
        ["function getProtectedUnderlyingCustodian(address) view returns (address)"],
        this.diamond.address
      );

      expect(await custodianReader.getProtectedUnderlyingCustodian(UNRIPE_LP)).to.equal(
        user2Address
      );
    });

    it("does not allow a later initializer call to replace the protected custodian", async function () {
      const diamondCut = await ethers.getContractAt("DiamondCutFacet", this.diamond.address);
      const initData = this.initProtectedUnderlying.interface.encodeFunctionData("init", [
        userAddress,
        to6("1")
      ]);

      await expect(
        diamondCut.connect(owner).diamondCut([], this.initProtectedUnderlying.address, initData)
      ).to.be.reverted;
      expect(await this.unripeFacet.getProtectedUnderlyingCustodian(UNRIPE_LP)).to.equal(
        user2Address
      );
    });

    it("uses local backing for execution and total backing for chop math", async function () {
      await mockBeanstalk.connect(user).chop(UNRIPE_LP, to6("5"), EXTERNAL, EXTERNAL);

      expect(await this.bean.balanceOf(userAddress)).to.equal(to6("5"));
      expect(await this.bean.balanceOf(this.diamond.address)).to.equal(to6("5"));
      expect(await this.unripeFacet.getProtectedUnderlying(UNRIPE_LP)).to.equal(
        protectedUnderlying
      );
      expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_LP)).to.equal(to6("95"));
    });

    it("keeps the chop quote and payout constant across local and protected splits", async function () {
      await this.bean.connect(user2).approve(this.diamond.address, protectedUnderlying);
      await this.unripeFacet.connect(user2).restoreProtectedUnderlying(protectedUnderlying);

      const totalRecapDollarsNeeded = await mockBeanstalk.getTotalRecapDollarsNeeded();
      await mockBeanstalk
        .connect(owner)
        .setPenaltyParams(totalRecapDollarsNeeded.div(2), 0);

      const chopAmount = to6("10");
      const splits = [to6("0"), to6("50"), to6("90")];
      let expectedQuote;
      let expectedPayout;

      for (const amountProtected of splits) {
        const splitSnapshotId = await takeSnapshot();

        if (!amountProtected.isZero()) {
          const diamondCut = await ethers.getContractAt(
            "DiamondCutFacet",
            this.diamond.address
          );
          const initData = this.initProtectedUnderlying.interface.encodeFunctionData("init", [
            user2Address,
            amountProtected
          ]);
          await diamondCut
            .connect(owner)
            .diamondCut([], this.initProtectedUnderlying.address, initData);
        }

        const quote = await mockBeanstalk.getPenalizedUnderlying(UNRIPE_LP, chopAmount);
        const balanceBefore = await this.bean.balanceOf(userAddress);
        await mockBeanstalk.connect(user).chop(UNRIPE_LP, chopAmount, EXTERNAL, EXTERNAL);
        const payout = (await this.bean.balanceOf(userAddress)).sub(balanceBefore);

        if (expectedQuote === undefined) {
          expectedQuote = quote;
          expectedPayout = payout;
        } else {
          expect(quote).to.equal(expectedQuote);
          expect(payout).to.equal(expectedPayout);
        }
        expect(payout).to.equal(quote);

        await revertToSnapshot(splitSnapshotId);
      }
    });

    it("reduces recapitalization against total backing instead of only local backing", async function () {
      const totalRecapDollarsNeeded = await mockBeanstalk.getTotalRecapDollarsNeeded();
      const recapitalizedBefore = totalRecapDollarsNeeded.div(2);
      await mockBeanstalk.connect(owner).setPenaltyParams(recapitalizedBefore, 0);

      const expectedPayout = to6("5");
      const expectedRecapReduction = expectedPayout
        .mul(recapitalizedBefore)
        .div(totalUnderlying);

      await mockBeanstalk.connect(user).chop(UNRIPE_LP, to6("10"), EXTERNAL, EXTERNAL);

      expect(await this.bean.balanceOf(userAddress)).to.equal(expectedPayout);
      expect(await mockBeanstalk.getRecapitalized()).to.equal(
        recapitalizedBefore.sub(expectedRecapReduction)
      );
      expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_LP)).to.equal(to6("95"));
    });

    it("rejects a chop that exceeds local executable backing", async function () {
      await expect(
        mockBeanstalk.connect(user).chop(UNRIPE_LP, to6("11"), EXTERNAL, EXTERNAL)
      ).to.be.revertedWith("Unripe: Insufficient local underlying");
    });

    it("restores protected LP to local backing before a larger chop", async function () {
      await this.bean.connect(user2).approve(this.diamond.address, to6("20"));
      await this.unripeFacet.connect(user2).restoreProtectedUnderlying(to6("20"));

      expect(await this.unripeFacet.getProtectedUnderlying(UNRIPE_LP)).to.equal(to6("70"));
      expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_LP)).to.equal(totalUnderlying);
      expect(await this.bean.balanceOf(this.diamond.address)).to.equal(to6("30"));

      await mockBeanstalk.connect(user).chop(UNRIPE_LP, to6("30"), EXTERNAL, EXTERNAL);

      expect(await this.bean.balanceOf(userAddress)).to.equal(to6("30"));
      expect(await this.bean.balanceOf(this.diamond.address)).to.equal(0);
      expect(await this.unripeFacet.getProtectedUnderlying(UNRIPE_LP)).to.equal(to6("70"));
      expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_LP)).to.equal(to6("70"));
    });

    it("rejects restoration by the Diamond owner when the owner is not the custodian", async function () {
      await expect(
        this.unripeFacet.connect(owner).restoreProtectedUnderlying(to6("1"))
      ).to.be.revertedWith("Unripe: Not protected custodian");
    });

    it("rejects restoration by any other non-custodian", async function () {
      await expect(
        this.unripeFacet.connect(user).restoreProtectedUnderlying(to6("1"))
      ).to.be.revertedWith("Unripe: Not protected custodian");
    });
  });

  describe("deposit underlying", async function () {
    beforeEach(async function () {
      // but totalDollarsneeded = dollarPerUnripeLP * C.unripeLP().totalSupply() / DECIMALS
      // we need total dollars needed to be 100 * 1e6
      // solve for supply --> we get 188459494,4 --> round to nearest usdc = 189
      await this.unripeLP.mint(userAddress, to6("189"));
      await this.unripeBean.mint(userAddress, to6("100"));
      await mockBeanstalk.connect(owner).addUnderlying(UNRIPE_BEAN, to6("100"));
      await mockBeanstalk.connect(owner).addUnderlying(UNRIPE_LP, to6("100"));
      await mockBeanstalk.connect(owner).setPenaltyParams(to6("50"), to6("0"));
    });

    it("getters", async function () {
      // 100 urBeans | 100 underlying beans --> 1 urBean per 1 underlying bean ratio
      expect(await mockBeanstalk.getUnderlyingPerUnripeToken(UNRIPE_BEAN)).to.be.equal(to6("1"));
      // getPenalty calls getPenalizedUnderlying with amount = 1
      // formula: redeem = currentRipeUnderlying *  (usdValueRaised/totalUsdNeeded) * UnripeAmountIn/UnripeSupply;
      // redeem = 100 * 50 / 100 *  1 / 100 = 0.5
      expect(await mockBeanstalk.getPenalty(UNRIPE_BEAN)).to.be.equal(to6("0.5"));
      expect(await mockBeanstalk.getPenalizedUnderlying(UNRIPE_BEAN, to6("1"))).to.be.equal(
        to6("0.5")
      );
      expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6("100"));
      expect(await mockBeanstalk.isUnripe(UNRIPE_BEAN)).to.be.equal(true);
      expect(await mockBeanstalk.getUnderlying(UNRIPE_BEAN, to6("1"))).to.be.equal(to6("1"));
      expect(await mockBeanstalk.balanceOfUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(
        to6("100")
      );
      expect(await mockBeanstalk.balanceOfPenalizedUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(
        to6("50")
      );
    });

    it("gets percents", async function () {
      expect(await mockBeanstalk.getRecapPaidPercent()).to.be.equal("0");
      expect(await mockBeanstalk.getRecapFundedPercent(UNRIPE_BEAN)).to.be.equal(to6("1"));
      expect(await mockBeanstalk.getRecapFundedPercent(UNRIPE_LP)).to.be.equal(to6("0.498569"));
      expect(await mockBeanstalk.getPercentPenalty(UNRIPE_BEAN)).to.be.equal(to6("0.5"));
      expect(await mockBeanstalk.getPercentPenalty(UNRIPE_LP)).to.be.equal(to6("0.25"));
    });
  });

  describe("deposit underlying, change fertilizer penalty params and urBean supply", async function () {
    beforeEach(async function () {
      // but totalDollarsneeded = dollarPerUnripeLP * C.unripeLP().totalSupply() / DECIMALS
      // we need total dollars needed to be 100 * 1e6
      // solve for supply --> we get 188459494,4 --> round to nearest usdc = 189
      await this.unripeLP.mint(userAddress, to6("189"));
      // total supply of unripe bean == 1000
      await this.unripeBean.mint(userAddress, to6("1000"));

      await mockBeanstalk.connect(owner).addUnderlying(UNRIPE_BEAN, to6("100"));
      await mockBeanstalk.connect(owner).addUnderlying(UNRIPE_LP, to6("100"));
      await mockBeanstalk.connect(owner).setPenaltyParams(to6("100"), to6("100"));
    });

    it("getters", async function () {
      // 1000 urBeans | 100 underlying beans --> 0.1 urBean per 1 underlying bean ratio
      expect(await mockBeanstalk.getUnderlyingPerUnripeToken(UNRIPE_BEAN)).to.be.equal(to6("0.1"));
      expect(await mockBeanstalk.getPenalty(UNRIPE_BEAN)).to.be.equal(to6("0.1"));
      expect(await mockBeanstalk.getPenalizedUnderlying(UNRIPE_BEAN, to6("1"))).to.be.equal(
        to6("0.1")
      );
      expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6("100"));
      expect(await mockBeanstalk.isUnripe(UNRIPE_BEAN)).to.be.equal(true);
      expect(await mockBeanstalk.getUnderlying(UNRIPE_BEAN, to6("1"))).to.be.equal(to6("0.1"));
      expect(await mockBeanstalk.balanceOfUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(
        to6("100")
      );
      expect(await mockBeanstalk.balanceOfPenalizedUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(
        to6("100")
      );
    });

    it("gets percents", async function () {
      expect(await mockBeanstalk.getRecapPaidPercent()).to.be.equal(to6("0.01"));
      expect(await mockBeanstalk.getRecapFundedPercent(UNRIPE_BEAN)).to.be.equal(to6("0.1"));
      expect(await mockBeanstalk.getRecapFundedPercent(UNRIPE_LP)).to.be.equal(to6("0.997138"));
      expect(await mockBeanstalk.getPercentPenalty(UNRIPE_BEAN)).to.be.equal(to6("0.1"));
      expect(await mockBeanstalk.getPercentPenalty(UNRIPE_LP)).to.be.equal(to6("1"));
    });
  });

  //////////////////////////////////// CHOPS //////////////////////////////////////////////

  // Example 2: balanceOfUnderlying Max ≠ Unripe Total Supply, balanceOfUnderlying < 100

  // When all fertilizer is sold, balanceOfUnderlying is 50 tokens (totalusdneeded = 50)
  // Total Supply of unripe is 100. Assume 1 Fertilizer increases balanceOfUnderlying by 1 token.
  // If 50% of Fertilizer is sold, balanceOfUnderlying should be 25.
  // We want the user to redeem 50%^2 = 25% of their total amount
  // If the entire supply was chopped. They should get 12.5 tokens.

  // formula: redeem = currentRipeUnderlying *  (usdValueRaised/totalUsdNeeded) * UnripeAmountIn/UnripeSupply;
  // redeem = 25 * 0.5 * 100/100 = 12.5
  describe("chop whole supply with balanceOfUnderlying Max ≠ Unripe Total Supply, balanceOfUnderlying < 100, fert 50% sold", async function () {
    beforeEach(async function () {
      // we need total dollars needed to be 50 * 1e6
      // but totalDollarsneeded = dollarPerUnripeLP * C.unripeLP().totalSupply() / DECIMALS
      // 50 * 1e6 = 530618 * supply / 1e6
      // solve for supply --> we get 94229747,2 --> round to nearest usdc = 95
      // (contract rounds down, thus we round up when issuing unripeLP tokens).
      await this.unripeLP.mint(userAddress, to6("95"));
      // unripe bean supply == 100
      await this.unripeBean.mint(userAddress, to6("100"));
      await mockBeanstalk.connect(owner).addUnderlying(
        UNRIPE_BEAN,
        to6("25") // balanceOfUnderlying is 25
      );

      // s.recapitalized=25, getTotalDollarsNeeded = 50
      //(50% of Fertilizer is sold, balanceOfUnderlying=25.) s.recapitalized, s.fertilized
      await mockBeanstalk.connect(owner).setPenaltyParams(to6("25"), to6("100"));
      // user chops the whole unripe bean supply
      this.result = await mockBeanstalk
        .connect(user)
        .chop(UNRIPE_BEAN, to6("100"), EXTERNAL, EXTERNAL);
    });

    it("getters", async function () {
      // fertilizer recapitalization is independent of the recapitalization of unripe.
      expect(await mockBeanstalk.getRecapPaidPercent()).to.be.equal(to6("0.01"));

      expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6("12.5"));
      expect(await mockBeanstalk.isUnripe(UNRIPE_BEAN)).to.be.equal(true);
    });

    it("changes balances", async function () {
      expect(await this.unripeBean.balanceOf(userAddress)).to.be.equal(to6("0"));
      expect(await this.bean.balanceOf(userAddress)).to.be.equal(to6("12.5"));
      expect(await this.unripeBean.totalSupply()).to.be.equal(to6("0"));
      expect(await this.bean.balanceOf(mockBeanstalk.address)).to.be.equal(to6("12.5"));
    });

    it("urBean chop does not affect recapitalization", async function () {
      expect(await beanstalk.getRecapitalized()).to.be.equal(to6("25"));
      expect(await mockBeanstalk.remainingRecapitalization()).to.be.equal(to6("25"));
    });

    it("emits an event", async function () {
      await expect(this.result)
        .to.emit(mockBeanstalk, "Chop")
        .withArgs(user.address, UNRIPE_BEAN, to6("100"), to6("12.5"));
    });
  });

  // Still Example 2:

  // When all fertilizer is sold, balanceOfUnderlying is 50 tokens.
  // Total Supply of unripe is 100.
  // Assume 1 Fertilizer increases balanceOfUnderlying by 1 token.
  // If 25% of Fertilizer is sold, balanceOfUnderlying should be 12.5.
  // We want the user to redeem 25%^2 = 6.25% of their total amount
  // If the entire supply was chopped, they should get 3.125  tokens.

  // formula: redeem = currentRipeUnderlying *  (usdValueRaised/totalUsdNeeded) * UnripeAmountIn/UnripeSupply;
  // redeem = 12.5 * 0.25 * 100/100 = 3.125
  describe("chop whole supply with balanceOfUnderlying Max ≠ Unripe Total Supply, balanceOfUnderlying < 100, fert 25% sold", async function () {
    beforeEach(async function () {
      // we need total dollars needed to be 50 * 1e6
      // but totalDollarsneeded = dollarPerUnripeLP * C.unripeLP().totalSupply() / DECIMALS
      // 50 * 1e6 = 530618 * supply / 1e6
      // solve for supply --> we get 94229747,2 --> round to nearest usdc = 95
      await this.unripeLP.mint(userAddress, to6("95"));
      // unripe bean supply == 100
      await this.unripeBean.mint(userAddress, to6("100"));
      await mockBeanstalk.connect(owner).addUnderlying(
        UNRIPE_BEAN,
        to6("12.5") // balanceOfUnderlying is 12.5
      );

      // s.recapitalized=12.5, getTotalDollarsNeeded = 50
      //(25% of all Fertilizer is sold, balanceOfUnderlying=12.5.) s.recapitalized, s.fertilized
      await mockBeanstalk.connect(owner).setPenaltyParams(to6("12.5"), to6("100"));
      // user chops the whole unripe bean supply
      this.result = await mockBeanstalk
        .connect(user)
        .chop(UNRIPE_BEAN, to6("100"), EXTERNAL, EXTERNAL);
    });

    it("getters", async function () {
      expect(await mockBeanstalk.getRecapPaidPercent()).to.be.equal(to6("0.01"));
      // 12.5 - 3.125 = 9.375
      expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6("9.375"));
      expect(await mockBeanstalk.isUnripe(UNRIPE_BEAN)).to.be.equal(true);
    });

    it("changes balances", async function () {
      expect(await this.unripeBean.balanceOf(userAddress)).to.be.equal(to6("0"));
      expect(await this.bean.balanceOf(userAddress)).to.be.equal(to6("3.125"));
      expect(await this.unripeBean.totalSupply()).to.be.equal(to6("0"));
      expect(await this.bean.balanceOf(mockBeanstalk.address)).to.be.equal(to6("9.375"));
    });

    it("urBean chop does not affect recapitalization", async function () {
      expect(await beanstalk.getRecapitalized()).to.be.equal(to6("12.5"));
      expect(await mockBeanstalk.remainingRecapitalization()).to.be.equal(to6("37.5"));
    });

    it("emits an event", async function () {
      await expect(this.result)
        .to.emit(mockBeanstalk, "Chop")
        .withArgs(user.address, UNRIPE_BEAN, to6("100"), to6("3.125"));
    });
  });

  // ### Example 3: balanceOfUnderlying Max ≠ Unripe Total Supply, TotalSupply > 100
  // When all fertilizer is sold, balanceOfUnderlying is 100 tokens.
  // Total Supply of unripe is 200. Assume 1 Fertilizer increases balanceOfUnderlying by 1 token.
  // If 25% of Fertilizer is sold, balanceOfUnderlying should be 25.
  // We want the user to redeem 25%^2 = 6.25% of the underlying.
  // If half the supply was chopped, they should get 3.125 tokens.

  // formula: redeem = currentRipeUnderlying * (usdValueRaised/totalUsdNeeded) * UnripeAmountIn/UnripeSupply;
  // redeem = 25 * 0.25 * 100/200 = 3.125
  describe("chop half the supply balanceOfUnderlying Max ≠ Unripe Total Supply, TotalSupply > 100, fert 25% sold", async function () {
    beforeEach(async function () {
      // but totalDollarsneeded = dollarPerUnripeLP * C.unripeLP().totalSupply() / DECIMALS
      // we need total dollars needed to be 100 * 1e6
      // solve for supply --> we get 188459494,4 --> round to nearest usdc = 189
      await this.unripeLP.mint(userAddress, to6("189"));
      // unripe bean supply == 200
      await this.unripeBean.mint(userAddress, to6("200"));
      // approve
      await mockBeanstalk.connect(owner).addUnderlying(
        UNRIPE_BEAN,
        to6("25") // balanceOfUnderlying is 25
      );
      // s.recapitalized=25
      await mockBeanstalk.connect(owner).setPenaltyParams(to6("25"), to6("100"));
      // user chops half the unripe bean supply
      this.result = await mockBeanstalk
        .connect(user)
        .chop(UNRIPE_BEAN, to6("100"), EXTERNAL, EXTERNAL);
    });

    it("getters", async function () {
      // new rate for underlying per unripe token
      // redeem = currentRipeUnderlying * (usdValueRaised/totalUsdNeeded) * UnripeAmountIn/UnripeSupply;
      // redeem = 21.875 * 0.25 * 1/100 = 0.054687
      expect(await mockBeanstalk.getUnderlyingPerUnripeToken(UNRIPE_BEAN)).to.be.equal(
        to6("0.21875")
      );
      expect(await mockBeanstalk.getPenalty(UNRIPE_BEAN)).to.be.equal(to6("0.054687"));
      expect(await mockBeanstalk.getPenalizedUnderlying(UNRIPE_BEAN, to6("1"))).to.be.equal(
        to6("0.054687")
      );
      expect(await mockBeanstalk.getUnderlying(UNRIPE_BEAN, to6("1"))).to.be.equal(to6("0.21875"));
      expect(await mockBeanstalk.balanceOfUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(
        to6("21.875")
      );
      // 100urBeans balance * 0.054687 = 5.46875
      expect(await mockBeanstalk.balanceOfPenalizedUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(
        to6("5.46875")
      );
      expect(await mockBeanstalk.getRecapPaidPercent()).to.be.equal(to6("0.01"));
      expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6("21.875"));
      expect(await mockBeanstalk.isUnripe(UNRIPE_BEAN)).to.be.equal(true);
    });

    it("changes balances", async function () {
      expect(await this.unripeBean.balanceOf(userAddress)).to.be.equal(to6("100"));
      expect(await this.bean.balanceOf(userAddress)).to.be.equal(to6("3.125"));
      expect(await this.unripeBean.totalSupply()).to.be.equal(to6("100"));
      // 25 underlying at the start - 3.125 redeemed = 21.875
      expect(await this.bean.balanceOf(mockBeanstalk.address)).to.be.equal(to6("21.875"));
    });

    it("urBean chop does not affect recapitalization", async function () {
      expect(await beanstalk.getRecapitalized()).to.be.equal(to6("25"));
      expect(await mockBeanstalk.remainingRecapitalization()).to.be.equal(to6("75"));
    });

    it("emits an event", async function () {
      await expect(this.result)
        .to.emit(mockBeanstalk, "Chop")
        .withArgs(user.address, UNRIPE_BEAN, to6("100"), to6("3.125"));
    });
  });

  // ### Example 3: balanceOfUnderlying Max ≠ Unripe Total Supply, TotalSupply > 100
  // When all fertilizer is sold, balanceOfUnderlying is 189 tokens.
  // Total Supply of unripeLP is 189. Assume 1 Fertilizer increases balanceOfUnderlying by 1 token.
  // If 25% of Fertilizer is sold, balanceOfUnderlying should be 25.
  // We want the user to redeem 25%^2 = 6.25% of the underlying.
  // If ~half the supply was chopped, they should get 3.125 tokens.
  // formula: redeem = currentRipeUnderlying * (usdValueRaised/totalUsdNeeded) * UnripeAmountIn/UnripeSupply;
  // redeem = 25 * 0.25 * 1/2 ~= 3.125 --> slightly more than with urBean due to small supply discrepancy
  // since supply is smaller the user is entitled to more underlying per UnripeLP
  describe("LP chop half the supply, balanceOfUnderlying Max ≠ Unripe Total Supply, TotalSupply > 100, fert 25% sold", async function () {
    beforeEach(async function () {
      // totalDollarsneeded = 47
      await this.unripeLP.mint(userAddress, to6("189"));
      // approve the beanstalk to spend the unripe LP
      await this.unripeLP.connect(owner).approve(this.diamond.address, to6("1000000000"));
      await mockBeanstalk.connect(owner).addUnderlying(
        UNRIPE_LP,
        to6("25") // balanceOfUnderlying is 25
      );
      // s.recapitalized=25
      await mockBeanstalk.connect(user).setPenaltyParams(to6("25"), to6("100"));

      // remaining recapitalization = totalDollarsNeeded - s.recapitalized = 100 - 25 = 75
      expect(await mockBeanstalk.remainingRecapitalization()).to.be.equal(to6("75"));
      // s.recapitalized = 25
      expect(await beanstalk.getRecapitalized()).to.be.equal(to6("25"));

      // 25 * 0.25 * 1/189 ~= 0.03306878307
      expect(await mockBeanstalk.getPenalty(UNRIPE_LP)).to.be.equal(to6("0.033068"));
      // user chops ~ half the unripe LP supply
      this.result = await mockBeanstalk
        .connect(user)
        .chop(UNRIPE_LP, to6("94.5"), EXTERNAL, EXTERNAL);
    });

    it("getters", async function () {
      // 21.875 / 94.5
      expect(await mockBeanstalk.getUnderlyingPerUnripeToken(UNRIPE_LP)).to.be.equal(to6("0.231481"));
      // 21.876 * 0.43752 * 1/94.5 ~= 0.1012824076
      expect(await mockBeanstalk.getPenalty(UNRIPE_LP)).to.be.equal(to6("0.101273"));

      expect(await mockBeanstalk.getPenalizedUnderlying(UNRIPE_LP, to6("1"))).to.be.equal(
        to6("0.101273")
      );
      expect(await mockBeanstalk.getUnderlying(UNRIPE_LP, to6("1"))).to.be.equal(to6("0.231481"));
      expect(await mockBeanstalk.balanceOfUnderlying(UNRIPE_LP, userAddress)).to.be.equal(
        to6("21.875000")
      );
      // 94.5 * 0.101273 = 9.5702985
      expect(await mockBeanstalk.balanceOfPenalizedUnderlying(UNRIPE_LP, userAddress)).to.be.equal(
        to6("9.570312")
      );
      expect(await mockBeanstalk.getRecapPaidPercent()).to.be.equal(to6("0.01"));
      expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_LP)).to.be.equal(to6("21.875000"));
      expect(await mockBeanstalk.isUnripe(UNRIPE_LP)).to.be.equal(true);
    });

    it("reduces s.recapitalized proportionally to the amount LP chopped", async function () {
      // recapitalization has reduced proportionally to the dollar amount of unripe LP chopped
      // 21.875000/25 = 0.87500000
      // 12.5% or 3.125
      expect(await beanstalk.getRecapitalized()).to.be.equal(to6("21.875000"));
      // 50 - 21.875 = 28.125
      expect(await mockBeanstalk.remainingRecapitalization()).to.be.equal(to6("28.125000"));
    });

    it("changes balances", async function () {
      expect(await this.unripeLP.balanceOf(userAddress)).to.be.equal(to6("94.5"));
      expect(await this.bean.balanceOf(userAddress)).to.be.equal(to6("3.125"));
      expect(await this.unripeLP.totalSupply()).to.be.equal(to6("94.5"));
      // 25 underlying at the start - 3.125 redeemed = 21.875000
      expect(await this.bean.balanceOf(mockBeanstalk.address)).to.be.equal(to6("21.875000"));
    });

    it("emits an event", async function () {
      await expect(this.result)
        .to.emit(mockBeanstalk, "Chop")
        .withArgs(user.address, UNRIPE_LP, to6("94.5"), to6("3.125"));
    });
  });

  describe("LP chop all of supply", async function () {
    beforeEach(async function () {
      // totalDollarsneeded = 47
      await this.unripeLP.mint(userAddress, to6("189"));
      await mockBeanstalk.connect(owner).addUnderlying(
        UNRIPE_LP,
        to6("100") // balanceOfUnderlying is 25
      );
      // s.recapitalized=25
      await mockBeanstalk.connect(user).setPenaltyParams(to6("100"), to6("100"));

      // remaining recapitalization = totalDollarsNeeded - s.recapitalized = 100 - 100 = 0
      expect(await mockBeanstalk.remainingRecapitalization()).to.be.equal(to6("0"));
      // s.recapitalized = 100
      expect(await beanstalk.getRecapitalized()).to.be.equal(to6("100"));

      // 100000000*100000000/100000000*1000000/189000000 = 529100
      expect(await mockBeanstalk.getPenalty(UNRIPE_LP)).to.be.equal(to6("0.529100"));
      // user chops ~ all the unripe LP supply
      this.result = await mockBeanstalk.connect(user).chop(UNRIPE_LP, to6("189"), EXTERNAL, EXTERNAL);
    });

    it("emits an event, and chopping unripe bean works", async function () {
      await expect(this.result).to.emit(mockBeanstalk, "Chop").withArgs(
        user.address,
        UNRIPE_LP,
        to6("189"),
        to6("100.000000") // 100%
      );

      // attempt to chop unripe bean
    });
  });

  // Same as above but with different transfer modes used
  describe("chop, different transfer modes, half the supply, balanceOfUnderlying Max ≠ Unripe Total Supply, TotalSupply > 100, fert 25% sold", async function () {
    beforeEach(async function () {
      // but totalDollarsneeded = dollarPerUnripeLP * C.unripeLP().totalSupply() / DECIMALS
      // we need total dollars needed to be 100 * 1e6
      // solve for supply --> we get 188459494,4 --> round to nearest usdc = 189
      await this.unripeLP.mint(userAddress, to6("189"));
      // unripe bean supply == 200
      await this.unripeBean.mint(userAddress, to6("200"));
      await mockBeanstalk.connect(owner).addUnderlying(
        UNRIPE_BEAN,
        to6("25") // balanceOfUnderlying is 25
      );
      // s.recapitalized=25
      await mockBeanstalk.connect(owner).setPenaltyParams(to6("25"), to6("100"));
      await mockBeanstalk
        .connect(user)
        .transferToken(UNRIPE_BEAN, user.address, to6("100"), EXTERNAL, INTERNAL);
      this.result = await mockBeanstalk
        .connect(user)
        .chop(UNRIPE_BEAN, to6("100"), INTERNAL_TOLERANT, EXTERNAL);
    });

    it("getters", async function () {
      // new rate for underlying per unripe token
      // redeem = currentRipeUnderlying * (usdValueRaised/totalUsdNeeded) * UnripeAmountIn/UnripeSupply;
      // redeem = 21.875 * 0.25 * 1/100 = 0.054687
      expect(await mockBeanstalk.getUnderlyingPerUnripeToken(UNRIPE_BEAN)).to.be.equal(
        to6("0.21875")
      );
      expect(await mockBeanstalk.getPenalty(UNRIPE_BEAN)).to.be.equal(to6("0.054687"));
      expect(await mockBeanstalk.getPenalizedUnderlying(UNRIPE_BEAN, to6("1"))).to.be.equal(
        to6("0.054687")
      );
      expect(await mockBeanstalk.getUnderlying(UNRIPE_BEAN, to6("1"))).to.be.equal(to6("0.21875"));
      expect(await mockBeanstalk.balanceOfUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(
        to6("21.875")
      );
      // 100urBeans balance * 0.054687 = 5.46875
      expect(await mockBeanstalk.balanceOfPenalizedUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(
        to6("5.46875")
      );
      expect(await mockBeanstalk.getRecapPaidPercent()).to.be.equal(to6("0.01"));
      expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6("21.875"));
      expect(await mockBeanstalk.isUnripe(UNRIPE_BEAN)).to.be.equal(true);
    });

    it("changes balaces", async function () {
      expect(await this.unripeBean.balanceOf(userAddress)).to.be.equal(to6("100"));
      expect(await this.bean.balanceOf(userAddress)).to.be.equal(to6("3.125"));
      expect(await this.unripeBean.totalSupply()).to.be.equal(to6("100"));
      // 25 underlying at the start - 3.125 redeemed = 21.875
      expect(await this.bean.balanceOf(mockBeanstalk.address)).to.be.equal(to6("21.875"));
    });

    it("emits an event", async function () {
      await expect(this.result)
        .to.emit(mockBeanstalk, "Chop")
        .withArgs(user.address, UNRIPE_BEAN, to6("100"), to6("3.125"));
    });
  });

  describe("change underlying", async function () {
    it("changes underlying token", async function () {
      this.result = await mockBeanstalk.connect(owner).switchUnderlyingToken(UNRIPE_BEAN, USDT);
      expect(await mockBeanstalk.getUnderlyingToken(UNRIPE_BEAN)).to.be.equal(USDT);
      await expect(this.result)
        .to.emit(mockBeanstalk, "SwitchUnderlyingToken")
        .withArgs(UNRIPE_BEAN, USDT);
    });

    it("reverts if underlying balance > 0", async function () {
      await mockBeanstalk.connect(owner).addUnderlying(UNRIPE_BEAN, to6("100"));
      await expect(
        mockBeanstalk.connect(owner).switchUnderlyingToken(UNRIPE_BEAN, USDT)
      ).to.be.revertedWith("Unripe: Underlying balance > 0");
    });

    it("reverts if not owner", async function () {
      await expect(
        mockBeanstalk.connect(user).switchUnderlyingToken(UNRIPE_BEAN, USDT)
      ).to.be.revertedWith("LibDiamond: Must be contract owner");
    });
  });
});
