const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { EXTERNAL } = require("./utils/balances.js");
const {
  BEAN,
  UNRIPE_BEAN,
  UNRIPE_LP,
  WETH,
  BEANSTALK,
  BEAN_ETH_WELL,
  ZERO_BYTES
} = require("./utils/constants");
const { ConvertEncoder } = require("./utils/encoder.js");
const { to18, to6, toStalk } = require("./utils/helpers.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { setEthUsdChainlinkPrice } = require("../utils/oracle.js");
const { deployBasin } = require("../scripts/basin.js");
const { toBN } = require("../utils/helpers.js");
const { getAllBeanstalkContracts } = require("../utils/contracts");
const { setRecapitalizationParams, endGermination } = require("./utils/testHelpers.js");
const { getBean } = require("../utils/contracts.js");

let user, user2, owner;

describe("Unripe Convert", function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners();

    const contracts = await deploy((verbose = false), (mock = true), (reset = true));
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [beanstalk, mockBeanstalk] = await getAllBeanstalkContracts(this.diamond.address);

    mockBeanstalk.setBarnRaiseWell(BEAN_ETH_WELL);
    bean = await getBean();
    this.weth = await ethers.getContractAt("MockToken", WETH);

    await setEthUsdChainlinkPrice("1000");

    this.well = await ethers.getContractAt("IWell", BEAN_ETH_WELL);
    this.wellToken = await ethers.getContractAt("IERC20", BEAN_ETH_WELL);
    await this.wellToken.connect(owner).approve(BEANSTALK, ethers.constants.MaxUint256);
    await bean.connect(owner).approve(BEANSTALK, ethers.constants.MaxUint256);

    await mockBeanstalk.siloSunrise(0);
    await bean.mint(user.address, to6("10000000000"));
    await bean.mint(user2.address, to6("10000000000"));
    await this.weth.mint(user.address, to18("1000000000"));
    await this.weth.mint(user2.address, to18("1000000000"));

    await bean.connect(user).approve(this.well.address, ethers.constants.MaxUint256);
    await bean.connect(user2).approve(this.well.address, ethers.constants.MaxUint256);
    await bean.connect(owner).approve(this.well.address, ethers.constants.MaxUint256);
    await this.weth.connect(user).approve(this.well.address, ethers.constants.MaxUint256);
    await this.weth.connect(user2).approve(this.well.address, ethers.constants.MaxUint256);
    await this.weth.connect(owner).approve(this.well.address, ethers.constants.MaxUint256);
    await bean.connect(user).approve(beanstalk.address, ethers.constants.MaxUint256);
    await bean.connect(user2).approve(beanstalk.address, ethers.constants.MaxUint256);
    await this.wellToken.connect(user).approve(beanstalk.address, ethers.constants.MaxUint256);
    await this.wellToken.connect(user2).approve(beanstalk.address, ethers.constants.MaxUint256);

    await this.well
      .connect(user)
      .addLiquidity([to6("1000000"), to18("1000")], 0, owner.address, ethers.constants.MaxUint256);

    this.unripeBean = await ethers.getContractAt("MockToken", UNRIPE_BEAN);
    this.unripeLP = await ethers.getContractAt("MockToken", UNRIPE_LP);

    await this.unripeBean.mint(user.address, to6("10000"));
    await this.unripeLP.mint(user.address, to6("3162.277660"));
    await this.unripeBean.connect(user).approve(this.diamond.address, to18("100000000"));
    await this.unripeLP.connect(user).approve(this.diamond.address, to18("100000000"));

    // Set recapitalization parameters (see function for default values).
    await setRecapitalizationParams(owner);
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("calclates beans to peg", async function () {
    it("p > 1", async function () {
      await this.well
        .connect(user)
        .addLiquidity([to6("0"), to18("0.2")], "0", user.address, ethers.constants.MaxUint256);
      expect(await beanstalk.getMaxAmountIn(UNRIPE_BEAN, UNRIPE_LP)).to.be.equal(to6("2000"));
    });

    it("p = 1", async function () {
      expect(await beanstalk.getMaxAmountIn(UNRIPE_BEAN, UNRIPE_LP)).to.be.equal("0");
    });

    it("p < 1", async function () {
      await this.well
        .connect(user)
        .addLiquidity([to6("2000"), to18("0")], "0", user.address, ethers.constants.MaxUint256);
      expect(await beanstalk.getMaxAmountIn(UNRIPE_BEAN, UNRIPE_LP)).to.be.equal("0");
    });
  });

  describe("calclates lp to peg", async function () {
    it("p > 1", async function () {
      await this.well
        .connect(user)
        .addLiquidity([to6("0"), to18("0.2")], "0", user.address, ethers.constants.MaxUint256);
      expect(await beanstalk.getMaxAmountIn(UNRIPE_LP, UNRIPE_BEAN)).to.be.equal("0");
    });

    it("p = 1", async function () {
      expect(await beanstalk.getMaxAmountIn(UNRIPE_LP, UNRIPE_BEAN)).to.be.equal("0");
    });

    it("p < 1", async function () {
      await this.well
        .connect(user)
        .addLiquidity([to6("2000"), to18("0")], "0", user.address, ethers.constants.MaxUint256);
      expect(await beanstalk.getMaxAmountIn(UNRIPE_LP, UNRIPE_BEAN)).to.be.equal(to6("31.606981"));
    });
  });

  describe("convert beans to lp", async function () {
    describe("revert", async function () {
      beforeEach(async function () {
        await mockBeanstalk.teleportSunrise(10);
        mockBeanstalk.deployStemsUpgrade();
      });
      it("not enough LP", async function () {
        await beanstalk.connect(user).deposit(this.unripeBean.address, to6("200"), EXTERNAL);
        await this.well
          .connect(user)
          .addLiquidity([to6("0"), to18("0.02")], "0", user.address, ethers.constants.MaxUint256);
        const amountOut = await this.well.getAddLiquidityOut([to6("200"), "0"]);
        await expect(
          beanstalk
            .connect(user)
            .convert(
              ConvertEncoder.convertUnripeBeansToLP(to6("200"), amountOut.add(toBN("1"))),
              ["0"],
              [to6("200")]
            )
        ).to.be.revertedWith("");
      });

      it("p >= 1", async function () {
        await beanstalk.connect(user).deposit(this.unripeBean.address, to6("200"), EXTERNAL);
        await expect(
          beanstalk
            .connect(user)
            .convert(ConvertEncoder.convertUnripeBeansToLP(to6("200"), "0"), ["0"], ["1000"])
        ).to.be.revertedWith("Convert: P must be >= 1.");
      });
    });

    describe("basic", function () {
      beforeEach(async function () {
        await beanstalk.connect(user).deposit(this.unripeBean.address, to6("2000"), EXTERNAL);
        this.stem = await beanstalk.stemTipForToken(this.unripeBean.address);
        await this.well
          .connect(user)
          .addLiquidity([to6("0"), to18("0.2")], "0", user.address, ethers.constants.MaxUint256);
        // call sunrise twice to finish germination.
        await endGermination();
        this.result = await beanstalk
          .connect(user)
          .convert(
            ConvertEncoder.convertUnripeBeansToLP(to6("1000"), "0"),
            [this.stem],
            [to6("2000")]
          );
      });

      // note: LP bdv has decreased, but beanstalk takes the max of the prev and new bdv
      // when determining the bdv of the deposit.
      it("properly updates total values", async function () {
        const bdv = await beanstalk.bdv(this.unripeLP.address, "4711829");

        // updates unripeBean.
        expect(await beanstalk.getTotalDeposited(this.unripeBean.address)).to.eq(to6("1000"));
        expect(await beanstalk.getTotalDepositedBdv(this.unripeBean.address)).to.eq(to6("100"));

        // updates unripeLP (active and germinating).
        expect(await beanstalk.getTotalDeposited(this.unripeLP.address)).to.eq("0");
        expect(await beanstalk.getTotalDepositedBdv(this.unripeLP.address)).to.eq("0");
        expect(await beanstalk.getGerminatingTotalDeposited(this.unripeLP.address)).to.eq(
          "4711829"
        );
        expect(await beanstalk.getGerminatingTotalDepositedBdv(this.unripeLP.address)).to.eq(bdv);

        expect(await beanstalk.totalStalk()).to.eq("1000000000400");
        expect(await beanstalk.getTotalGerminatingStalk()).to.eq(bdv.mul("10000"));
      });

      it("properly updates user values", async function () {
        const bdv = await beanstalk.bdv(this.unripeLP.address, "4711829");
        expect(await beanstalk.balanceOfStalk(user.address)).to.eq("1000000000400");
        expect(await beanstalk.balanceOfGerminatingStalk(user.address)).to.eq(bdv.mul("10000"));
      });

      it("properly updates user deposits", async function () {
        expect(
          (await beanstalk.getDeposit(user.address, this.unripeBean.address, this.stem))[0]
        ).to.eq(to6("1000"));
        const bdv = await beanstalk.bdv(this.unripeLP.address, "4711829");
        const deposit = await beanstalk.getDeposit(user.address, this.unripeLP.address, 3);
        expect(deposit[0]).to.eq("4711829");
        expect(deposit[1]).to.eq(bdv);
      });

      it("emits events", async function () {
        await expect(this.result)
          .to.emit(beanstalk, "RemoveDeposits")
          .withArgs(user.address, this.unripeBean.address, ["1"], [to6("1000")], to6("1000"), [
            to6("100")
          ]);
        await expect(this.result)
          .to.emit(beanstalk, "AddDeposit")
          .withArgs(user.address, this.unripeLP.address, 3, "4711829", 297699514);
      });
    });
  });

  describe("convert lp to beans", async function () {
    describe("revert", async function () {
      it("not enough Beans", async function () {
        await this.well
          .connect(user)
          .addLiquidity([to6("200"), "0"], "0", user.address, ethers.constants.MaxUint256);
        await beanstalk.connect(user).deposit(this.unripeLP.address, to6("1000"), EXTERNAL);
        await expect(
          beanstalk
            .connect(user)
            .convert(
              ConvertEncoder.convertUnripeLPToBeans(to6("2000"), to6("2500")),
              ["0"],
              [to6("2000")]
            )
        ).to.be.revertedWith("");
      });

      it("p >= 1", async function () {
        await this.well
          .connect(user)
          .addLiquidity(
            [to6("0"), to18("1")],
            to18("0.5"),
            user.address,
            ethers.constants.MaxUint256
          );
        await beanstalk.connect(user).deposit(this.unripeLP.address, to6("1000"), EXTERNAL);
        await expect(
          beanstalk
            .connect(user)
            .convert(
              ConvertEncoder.convertUnripeLPToBeans(to6("2000"), to6("2500")),
              ["0"],
              [to6("2000")]
            )
        ).to.be.revertedWith("Convert: P must be < 1.");
      });
    });

    describe("below max", function () {
      beforeEach(async function () {
        await this.well
          .connect(user)
          .addLiquidity([to6("200"), "0"], "0", user.address, ethers.constants.MaxUint256);
        await beanstalk.connect(user).deposit(this.unripeLP.address, to6("3"), EXTERNAL);
        this.stem = await beanstalk.stemTipForToken(this.unripeLP.address);
        // call sunrise twice to finish germination.
        await endGermination();
        this.result = await beanstalk
          .connect(user)
          .convert(
            ConvertEncoder.convertUnripeLPToBeans(to6("3"), toBN("0")),
            [this.stem],
            [to6("1000")]
          );
      });

      it("properly updates total values", async function () {
        const bdv = await beanstalk.bdv(this.unripeBean.address, "636776401");
        // const oldBdv = await beanstalk.bdv(this.unripeLP.address, to6('3'))

        expect(await beanstalk.getTotalDeposited(this.unripeBean.address)).to.eq("0");
        expect(await beanstalk.getGerminatingTotalDeposited(this.unripeBean.address)).to.eq(
          "636776401"
        );

        expect(await beanstalk.getTotalDepositedBdv(this.unripeBean.address)).to.eq("0");
        expect(await beanstalk.getGerminatingTotalDepositedBdv(this.unripeBean.address)).to.eq(
          189738509
        );
        expect(await beanstalk.getTotalDeposited(this.unripeLP.address)).to.eq(to6("0"));
        expect(await beanstalk.getGerminatingTotalDeposited(this.unripeLP.address)).to.eq(to6("0"));

        expect(await beanstalk.getTotalDepositedBdv(this.unripeLP.address)).to.eq(to6("0"));
        expect(await beanstalk.getGerminatingTotalDepositedBdv(this.unripeLP.address)).to.eq(
          to6("0")
        );

        // 379 comes from grown stalk. (189738509/1e6 * 2)
        expect(await beanstalk.totalStalk()).to.eq(379);
        expect(await beanstalk.getTotalGerminatingStalk()).to.eq(1897385090000);
      });

      it("properly updates user values", async function () {
        const bdv = await beanstalk.bdv(this.unripeBean.address, "636776401");
        const oldBdv = await beanstalk.bdv(this.unripeLP.address, to6("3"));
        expect(await beanstalk.balanceOfGerminatingStalk(user.address)).to.eq(1897385090000);
        expect(await beanstalk.balanceOfStalk(user.address)).to.eq(379);
      });
    });
  });

  // Unripe to Ripe test
  describe("convert unripe beans to beans", async function () {
    beforeEach(async function () {
      // GO TO SEASON 10
      await mockBeanstalk.teleportSunrise(10);
      mockBeanstalk.deployStemsUpgrade();
    });

    describe("basic urBEAN-->BEAN convert", function () {
      // PERFORM A DEPOSIT AND A CONVERT BEFORE EVERY TEST
      beforeEach(async function () {
        // user deposits 200 UrBEAN to the silo from external account
        await beanstalk.connect(user).deposit(this.unripeBean.address, to6("200"), EXTERNAL);
        // GO FORWARD 3 SEASONs AND DONT DISTRIBUTE ANY REWARDS TO SILO
        // season 11
        await endGermination();
        await mockBeanstalk.siloSunrise(0);
        // SET FERT PARAMS
        await mockBeanstalk.connect(owner).setPenaltyParams(to6("100"), to6("100"));
        // INTERACTING WITH THE CONVERT FACET CONVERT(bytes calldata convertData, int96[] memory stems,uint256[] memory amounts) FUNCTION
        this.result = await beanstalk
          .connect(user)
          .convert(
            ConvertEncoder.convertUnripeToRipe(to6("100"), this.unripeBean.address),
            ["0"],
            [to6("100")]
          );
      });

      // CHECK TO SEE THAT RECAP AND PENALTY VALUES ARE UPDATED AFTER THE CONVERT
      it("getters", async function () {
        expect(await mockBeanstalk.getRecapPaidPercent()).to.be.equal(to6("0.01"));
        expect(await mockBeanstalk.getUnderlyingPerUnripeToken(UNRIPE_BEAN)).to.be.equal("101000");
        expect(await mockBeanstalk.getPenalty(UNRIPE_BEAN)).to.be.equal(to6("0.00101"));
        expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6("999.90"));
        expect(await mockBeanstalk.isUnripe(UNRIPE_BEAN)).to.be.equal(true);
        // same fert , less supply --> penalty goes down
        expect(await mockBeanstalk.getPenalizedUnderlying(UNRIPE_BEAN, to6("1"))).to.be.equal(
          to6("0.00101")
        );
        expect(await mockBeanstalk.getUnderlying(UNRIPE_BEAN, to6("1"))).to.be.equal(to6("0.1010"));
      });

      // TOTALS
      it("properly updates total values", async function () {
        // UNRIPE BEAN DEPOSIT TEST
        expect(await beanstalk.getTotalDeposited(this.unripeBean.address)).to.eq(to6("100"));
        // RIPE BEAN CONVERTED TEST
        expect(await beanstalk.getTotalDeposited(bean.address)).to.eq(to6("0.1"));
        // TOTAL STALK TEST
        // 0.004 * 3 seasons = 0.012
        expect(await beanstalk.totalStalk()).to.eq(toStalk("20.012"));
        // VERIFY urBEANS ARE BURNED
        expect(await this.unripeBean.totalSupply()).to.be.equal(to6("9900"));
      });

      // USER VALUES TEST
      it("properly updates user values", async function () {
        // USER STALK TEST
        // 1 urBEAN yields 2/10000 grown stalk every season witch is claimable with mow()
        // after every silo interaction(here --> convert).
        // Since we go forward 3 seasons after the deposit, the user should now have 1200/10000 grown stalk
        // not affected by the unripe --> ripe convert
        expect(await beanstalk.balanceOfStalk(user.address)).to.eq(toStalk("20.012"));
      });

      // USER DEPOSITS TEST
      it("properly updates user deposits", async function () {
        expect((await beanstalk.getDeposit(user.address, this.unripeBean.address, 0))[0]).to.eq(
          to6("100")
        );
        expect((await beanstalk.getDeposit(user.address, bean.address, 0))[0]).to.eq(to6("0.1"));
      });

      // EVENTS TEST
      it("emits events", async function () {
        await expect(this.result)
          .to.emit(beanstalk, "RemoveDeposits")
          .withArgs(user.address, this.unripeBean.address, [0], [to6("100")], to6("100"), [
            to6("10")
          ]);
        await expect(this.result)
          .to.emit(beanstalk, "AddDeposit")
          .withArgs(user.address, bean.address, 0, to6("0.1"), to6("10"));
        await expect(this.result)
          .to.emit(beanstalk, "Convert")
          .withArgs(user.address, this.unripeBean.address, bean.address, to6("100"), to6("0.1"));
      });
    });
  });
});
