const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { getBeanstalk } = require("../utils/contracts.js");
const {
  deployWell,
  setReserves,
  whitelistWell,
  impersonateBeanEthWell,
  deployMockWell,
  deployMockPump
} = require("../utils/well.js");
const {
  BEAN,
  BEAN_ETH_WELL,
  WETH,
  BEAN_WSTETH_WELL,
  BEANSTALK_PUMP,
  ZERO_BYTES
} = require("./utils/constants");
const { ConvertEncoder } = require("./utils/encoder.js");
const { to6, to18 } = require("./utils/helpers.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");

const {
  setStethEthChainlinkPrice,
  setWstethEthUniswapPrice,
  setEthUsdChainlinkPrice
} = require("../utils/oracle.js");
const { getAllBeanstalkContracts } = require("../utils/contracts");
let user, user2, owner;

describe("Well Convert", function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners();

    const contracts = await deploy((verbose = false), (mock = true), (reset = true));
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [beanstalk, mockBeanstalk] = await getAllBeanstalkContracts(this.diamond.address);

    this.well = await ethers.getContractAt("IWell", BEAN_ETH_WELL);
    this.wstethWell = await ethers.getContractAt("IWell", BEAN_WSTETH_WELL);
    this.fakeWell = await deployMockWell();
    this.wellToken = await ethers.getContractAt("IERC20", this.well.address);
    bean = await ethers.getContractAt("MockToken", BEAN);

    await bean.mint(ownerAddress, to18("1000000000"));
    await this.wellToken.connect(owner).approve(beanstalk.address, ethers.constants.MaxUint256);
    await bean.connect(owner).approve(beanstalk.address, ethers.constants.MaxUint256);

    await setEthUsdChainlinkPrice("1000");
    await setStethEthChainlinkPrice("1000");
    await setStethEthChainlinkPrice("1");
    await setWstethEthUniswapPrice("1");

    await deployMockPump();

    await setReserves(owner, this.well, [to6("1000000"), to18("1000")]);
    await setReserves(owner, this.wstethWell, [to6("1000000"), to18("1000")]);

    await setReserves(owner, this.well, [to6("1000000"), to18("1000")]);
    await setReserves(owner, this.wstethWell, [to6("1000000"), to18("1000")]);
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("calculates beans to peg", async function () {
    it("p > 1", async function () {
      await setReserves(owner, this.well, [to6("800000"), to18("1000")]);
      const maxAmountIn = await beanstalk.getMaxAmountIn(BEAN, this.well.address);
      expect(maxAmountIn).to.be.equal(to6("200000"));
      expect(await beanstalk.getAmountOut(BEAN, this.well.address, maxAmountIn)).to.be.equal(
        "3338505354221892343955"
      );
    });

    it("p = 1", async function () {
      expect(await beanstalk.getMaxAmountIn(BEAN, this.well.address)).to.be.equal("0");
    });

    it("p < 1", async function () {
      await setReserves(owner, this.well, [to6("1200000"), to18("1000")]);
      expect(await beanstalk.getMaxAmountIn(BEAN, this.well.address)).to.be.equal("0");
    });
  });

  describe("calclates lp to peg", async function () {
    it("p > 1", async function () {
      await setReserves(owner, this.well, [to6("800000"), to18("1000")]);
      expect(await beanstalk.getMaxAmountIn(this.well.address, BEAN)).to.be.equal("0");
    });

    it("p = 1", async function () {
      expect(await beanstalk.getMaxAmountIn(this.well.address, BEAN)).to.be.equal("0");
    });

    it("p < 1", async function () {
      await setReserves(owner, this.well, [to6("1200000"), to18("1000")]);
      const maxAmountIn = await beanstalk.getMaxAmountIn(this.well.address, BEAN);
      expect(maxAmountIn).to.be.equal("3018239549693752550560");
      expect(await beanstalk.getAmountOut(this.well.address, BEAN, maxAmountIn)).to.be.equal(
        to6("200000")
      );
    });
  });

  describe("convert beans to lp", async function () {
    describe("p > 1", async function () {
      beforeEach(async function () {
        await setReserves(owner, this.well, [to6("800000"), to18("1000")]);
        await setReserves(owner, this.well, [to6("800000"), to18("1000")]);
      });

      it("reverts if not whitelisted well", async function () {
        const convertData = ConvertEncoder.convertBeansToWellLP(
          to6("100000"),
          "1338505354221892343955",
          this.fakeWell.address
        );
        await expect(
          mockBeanstalk.connect(owner).convertInternalE(bean.address, to6("100000"), convertData)
        ).to.be.revertedWith("Convert: Invalid Well");
      });

      it("convert below max", async function () {
        const convertData = ConvertEncoder.convertBeansToWellLP(
          to6("100000"),
          "1338505354221892343955",
          this.well.address
        );
        const [toToken, fromToken, toAmount, fromAmount] = await mockBeanstalk
          .connect(owner)
          .callStatic.convertInternalE(bean.address, to6("100000"), convertData);
        expect(fromToken).to.be.equal(BEAN);
        expect(fromAmount).to.be.equal(to6("100000"));
        expect(toToken).to.be.equal(this.well.address);
        expect(toAmount).to.be.equal("1715728752538099023967");
      });

      it("convert equal to max", async function () {
        const convertData = ConvertEncoder.convertBeansToWellLP(
          to6("200000"),
          "3338505354221892343955",
          this.well.address
        );
        const [toToken, fromToken, toAmount, fromAmount] = await mockBeanstalk
          .connect(owner)
          .callStatic.convertInternalE(bean.address, to6("200000"), convertData);
        expect(fromToken).to.be.equal(BEAN);
        expect(fromAmount).to.be.equal(to6("200000"));
        expect(toToken).to.be.equal(this.well.address);
        expect(toAmount).to.be.equal("3338505354221892343955");
      });

      it("convert greater than max", async function () {
        const convertData = ConvertEncoder.convertBeansToWellLP(
          to6("600000"),
          "3338505354221892343955",
          this.well.address
        );
        const [toToken, fromToken, toAmount, fromAmount] = await mockBeanstalk
          .connect(owner)
          .callStatic.convertInternalE(bean.address, to6("600000"), convertData);
        expect(fromToken).to.be.equal(BEAN);
        expect(fromAmount).to.be.equal(to6("200000"));
        expect(toToken).to.be.equal(this.well.address);
        expect(toAmount).to.be.equal("3338505354221892343955");
      });

      it("deposit and convert below max", async function () {
        const convertData = ConvertEncoder.convertBeansToWellLP(
          to6("100000"),
          "1338505354221892343955",
          this.well.address
        );
        console.log("this.well.address", this.well.address);
        await bean.connect(owner).approve(beanstalk.address, to6("100000"));
        await beanstalk.connect(owner).deposit(BEAN, to6("100000"), 0);
        // call sunrise twice to finish germination (germinating deposits cannot convert).
        await mockBeanstalk.siloSunrise("0");
        await mockBeanstalk.siloSunrise("0");

        await beanstalk.connect(owner).convert(convertData, ["0"], [to6("100000")]);
        deposit = await beanstalk.getDeposit(owner.address, this.well.address, "4000000");
        expect(deposit[0]).to.be.equal("1715728752538099023967");
      });

      it("reverts when USD oracle is broken", async function () {
        await setEthUsdChainlinkPrice("0");
        const convertData = ConvertEncoder.convertBeansToWellLP(
          to6("100000"),
          "1338505354221892343955",
          this.well.address
        );
        await expect(
          mockBeanstalk
            .connect(owner)
            .callStatic.convertInternalE(bean.address, to6("100000"), convertData)
        ).to.be.revertedWith("Convert: USD Oracle failed");
      });
    });

    describe("p <= 1", async function () {
      it("convert revert", async function () {
        const convertData = ConvertEncoder.convertBeansToWellLP(
          to6("100000"),
          "1338505354221892343955",
          this.well.address
        );
        await expect(
          mockBeanstalk
            .connect(owner)
            .callStatic.convertInternalE(bean.address, to6("100000"), convertData)
        ).to.be.revertedWith("Convert: P must be >= 1.");
      });
    });
  });

  describe("convert lp to beans", async function () {
    describe("p <= 1", async function () {
      beforeEach(async function () {
        await setReserves(owner, this.well, [to6("1200000"), to18("1000")]);
      });

      it("reverts if not whitelisted well", async function () {
        const convertData = ConvertEncoder.convertWellLPToBeans(
          to18("2000"),
          to6("100000"),
          this.fakeWell.address
        );
        await expect(
          mockBeanstalk
            .connect(owner)
            .convertInternalE(this.well.address, "3018239549693752550560", convertData)
        ).to.be.revertedWith("Convert: Invalid Well");
      });

      it("convert below max", async function () {
        const convertData = ConvertEncoder.convertWellLPToBeans(
          to18("2000"),
          to6("100000"),
          this.well.address
        );
        const [toToken, fromToken, toAmount, fromAmount] = await mockBeanstalk
          .connect(owner)
          .callStatic.convertInternalE(this.well.address, "3018239549693752550560", convertData);
        expect(fromToken).to.be.equal(this.well.address);
        expect(fromAmount).to.be.equal(to18("2000"));
        expect(toToken).to.be.equal(BEAN);
        expect(toAmount).to.be.equal("134564064605");
      });

      it("convert equal to max", async function () {
        const convertData = ConvertEncoder.convertWellLPToBeans(
          "3018239549693752550560",
          to6("200000"),
          this.well.address
        );
        const [toToken, fromToken, toAmount, fromAmount] = await mockBeanstalk
          .connect(owner)
          .callStatic.convertInternalE(this.well.address, "3018239549693752550560", convertData);
        expect(fromToken).to.be.equal(this.well.address);
        expect(fromAmount).to.be.equal("3018239549693752550560");
        expect(toToken).to.be.equal(BEAN);
        expect(toAmount).to.be.equal(to6("200000"));
      });

      it("convert above max", async function () {
        const convertData = ConvertEncoder.convertWellLPToBeans(
          to18("5000"),
          to6("100000"),
          this.well.address
        );
        const [toToken, fromToken, toAmount, fromAmount] = await mockBeanstalk
          .connect(owner)
          .callStatic.convertInternalE(this.well.address, "3018239549693752550560", convertData);
        expect(fromToken).to.be.equal(this.well.address);
        expect(fromAmount).to.be.equal("3018239549693752550560");
        expect(toToken).to.be.equal(BEAN);
        expect(toAmount).to.be.equal(to6("200000"));
      });

      it("deposit and convert below max", async function () {
        const convertData = ConvertEncoder.convertWellLPToBeans(
          to18("2000"),
          to6("100000"),
          this.well.address
        );
        await beanstalk.connect(owner).deposit(this.well.address, to18("2000"), 0);
        // call sunrise twice to finish germination (germinating deposits cannot convert).
        await mockBeanstalk.siloSunrise("0");
        await mockBeanstalk.siloSunrise("0");
        await beanstalk.connect(owner).convert(convertData, ["0"], [to18("2000")]);

        deposit = await beanstalk.getDeposit(owner.address, BEAN, "-3520050");
        expect(deposit[0]).to.be.equal("134564064605");
      });

      it("reverts when USD oracle is broken", async function () {
        await setEthUsdChainlinkPrice("0");
        const convertData = ConvertEncoder.convertWellLPToBeans(
          "3018239549693752550560",
          to6("200000"),
          this.well.address
        );
        await expect(
          mockBeanstalk
            .connect(owner)
            .callStatic.convertInternalE(this.well.address, "3018239549693752550560", convertData)
        ).to.be.revertedWith("Convert: USD Oracle failed");
      });
    });

    describe("p > 1", async function () {
      it("convert revert", async function () {
        const convertData = ConvertEncoder.convertWellLPToBeans(
          to18("2000"),
          to6("100000"),
          this.well.address
        );
        await expect(
          mockBeanstalk
            .connect(owner)
            .callStatic.convertInternalE(this.well.address, "3018239549693752550560", convertData)
        ).to.be.revertedWith("Convert: P must be < 1.");
      });
    });
  });
});
