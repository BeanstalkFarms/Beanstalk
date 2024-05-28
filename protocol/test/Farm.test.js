const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require("./utils/balances.js");
const { to18, to6 } = require("./utils/helpers.js");
const {
  BEAN,
  USDT,
  WETH,
  USDC,
  WBTC,
  DAI,
  LUSD_3_CURVE,
  LUSD,
  MAX_UINT256
} = require("./utils/constants");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { testIfRpcSet } = require("./utils/test.js");
const { getAllBeanstalkContracts } = require("../utils/contracts.js");

let user, user2, owner;

testIfRpcSet("Farm", function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners();

    try {
      await network.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
              jsonRpcUrl: process.env.FORKING_RPC,
              blockNumber: 14602789
            }
          }
        ]
      });
    } catch (error) {
      console.log(error);
      return;
    }

    this.usdc = await ethers.getContractAt("IERC20", USDC);
    this.dai = await ethers.getContractAt("IERC20", DAI);
    this.wbtc = await ethers.getContractAt("IERC20", WBTC);
    this.lusd = await ethers.getContractAt("IERC20", LUSD);
    this.weth = await ethers.getContractAt("IERC20", WETH);
    this.usdt = await ethers.getContractAt("IERC20", USDT);
    const contracts = await deploy(
      (verbose = false),
      (mock = true),
      (reset = false),
      (impersonateERC20 = false),
      (curve = false)
    );
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [beanstalk, mockBeanstalk] = await getAllBeanstalkContracts(this.diamond.address);

    this.bean = await ethers.getContractAt("MockToken", BEAN);

    await mockBeanstalk.lightSunrise();
    await this.bean.connect(user).approve(beanstalk.address, MAX_UINT256);
    await this.bean.connect(user2).approve(beanstalk.address, MAX_UINT256);
    await this.bean.mint(user.address, to6("10000"));
    await this.bean.mint(user2.address, to6("10000"));

    wrapEth = await beanstalk.interface.encodeFunctionData("wrapEth", [to18("1"), INTERNAL]);
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("Farm Revert", async function () {
    it("revert if not valid selector", async function () {
      await expect(beanstalk.farm(["0xfd9f1e10"])).to.be.revertedWith(
        "Diamond: Function does not exist"
      );
    });

    it("revert if not function reverts", async function () {
      await expect(beanstalk.farm([wrapEth])).to.be.reverted;
    });
  });

  describe("Farm Deposit", function () {
    before(async function () {
      deposit = await beanstalk.interface.encodeFunctionData("deposit", [
        this.bean.address,
        to6("1"),
        EXTERNAL
      ]);
    });

    it("Wrap Eth", async function () {
      await beanstalk.connect(user).farm([wrapEth], { value: to18("1") });
    });

    it("Deposit", async function () {
      await beanstalk.connect(user).farm([deposit]);
    });

    it("Wrap Eth, Deposit", async function () {
      await beanstalk.connect(user).farm([wrapEth, deposit], { value: to18("1") });
    });
  });

  // TODO: reimplment with non-curve.
  describe.skip("Farm Exchange", async function () {
    describe("tri-crypto", async function () {
      it("Wrap Eth, Exchange WETH -> USDT external", async function () {
        exchange = await beanstalk.interface.encodeFunctionData("exchange", [
          TRI_CRYPTO_POOL, // tricrypto2
          CRYPTO_REGISTRY,
          WETH, // WETH
          USDT, // USDT
          to18("1"), // amountIn
          ethers.utils.parseUnits("100", 6), // minAmountOut
          INTERNAL_EXTERNAL,
          EXTERNAL
        ]);

        await beanstalk.connect(user).farm([wrapEth, exchange], { value: to18("1") });

        expect(await this.usdt.balanceOf(beanstalk.address)).to.be.equal("0");
        expect(await this.usdt.balanceOf(user.address)).to.be.equal("3043205584");
      });

      it("wraps Eth and exchanges to usdt internal", async function () {
        exchange = await beanstalk.interface.encodeFunctionData("exchange", [
          TRI_CRYPTO_POOL, // tricrypto2
          CRYPTO_REGISTRY,
          WETH, // WETH
          USDT, // USDT
          to18("1"), // amountIn
          ethers.utils.parseUnits("100", 6), // minAmountOut
          INTERNAL_EXTERNAL,
          INTERNAL
        ]);

        await beanstalk.connect(user).farm([wrapEth, exchange], { value: to18("1") });

        expect(await this.usdt.balanceOf(beanstalk.address)).to.be.equal("3043205584");
        expect(await beanstalk.getInternalBalance(user.address, this.usdt.address)).to.be.equal(
          "3043205584"
        );
        expect(await this.usdt.balanceOf(user.address)).to.be.equal("0");
      });

      it("Wrap Eth, Exchange WETH -> CRV external", async function () {
        exchange = await beanstalk.interface.encodeFunctionData("exchange", [
          "0x8301AE4fc9c624d1D396cbDAa1ed877821D7C511", // CRV:ETH
          CRYPTO_REGISTRY,
          WETH, // WETH
          "0xD533a949740bb3306d119CC777fa900bA034cd52", // CRV
          to18("1"), // amountIn
          to18("500"), // minAmountOut
          INTERNAL_EXTERNAL,
          EXTERNAL
        ]);

        this.crv = await ethers.getContractAt(
          "IERC20",
          "0xD533a949740bb3306d119CC777fa900bA034cd52"
        );

        await beanstalk.connect(user).farm([wrapEth, exchange], { value: to18("1") });

        expect(await this.crv.balanceOf(beanstalk.address)).to.be.equal("0");
        expect(await beanstalk.getInternalBalance(user.address, this.crv.address)).to.be.equal("0");
        expect(await this.crv.balanceOf(user.address)).to.be.equal("1338512415451289655561");
      });
    });

    describe("weth:crv", async function () {
      it("Wrap Eth, Exchange WETH -> CRV internal", async function () {
        exchange = await beanstalk.interface.encodeFunctionData("exchange", [
          "0x8301AE4fc9c624d1D396cbDAa1ed877821D7C511", // CRV:ETH
          CRYPTO_REGISTRY,
          WETH, // WETH
          "0xD533a949740bb3306d119CC777fa900bA034cd52", // CRV
          to18("1"), // amountIn
          to18("500"), // minAmountOut
          INTERNAL_EXTERNAL,
          INTERNAL
        ]);

        this.crv = await ethers.getContractAt(
          "IERC20",
          "0xD533a949740bb3306d119CC777fa900bA034cd52"
        );

        await beanstalk.connect(user).farm([wrapEth, exchange], { value: to18("1") });

        expect(await this.crv.balanceOf(beanstalk.address)).to.be.equal("1338512415451289655561");
        expect(await beanstalk.getInternalBalance(user.address, this.crv.address)).to.be.equal(
          "1338512415451289655561"
        );
        expect(await this.crv.balanceOf(user.address)).to.be.equal("0");
      });

      it("Wrap Eth, Exchange WETH -> USDT, Exchange USDT -> USDC", async function () {
        exchange = await beanstalk.interface.encodeFunctionData("exchange", [
          TRI_CRYPTO_POOL, // tricrypto2
          CRYPTO_REGISTRY,
          WETH, // WETH
          USDT, // USDT
          to18("1"), // amountIn
          ethers.utils.parseUnits("100", 6), // minAmountOut
          INTERNAL_EXTERNAL,
          INTERNAL
        ]);

        exchange2 = await beanstalk.interface.encodeFunctionData("exchange", [
          THREE_POOL, // tricrypto2
          CURVE_REGISTRY,
          USDT, // WETH
          USDC, // USDT
          ethers.utils.parseUnits("100", 6), // amountIn
          ethers.utils.parseUnits("99", 6), // minAmountOut
          INTERNAL_TOLERANT,
          EXTERNAL
        ]);

        await beanstalk.connect(user).farm([wrapEth, exchange, exchange2], { value: to18("1") });

        expect(await this.usdc.balanceOf(beanstalk.address)).to.be.equal("0");
        expect(await this.usdc.balanceOf(user.address)).to.be.equal("100980055");
      });
    });
  });

  // TODO: reimplment with non-curve.
  describe.skip("Farm Exchange Underlying", async function () {
    before(async function () {
      exchange = await beanstalk.interface.encodeFunctionData("exchange", [
        TRI_CRYPTO_POOL, // tricrypto2
        CRYPTO_REGISTRY,
        WETH, // WETH
        USDT, // USDT
        to18("1"), // amountIn
        ethers.utils.parseUnits("100", 6), // minAmountOut
        INTERNAL,
        INTERNAL
      ]);
    });

    it("Wrap Eth, Exchange WETH -> USDT, Exchange USDT -> LUSD external", async function () {
      eu = await beanstalk.interface.encodeFunctionData("exchangeUnderlying", [
        LUSD_3_CURVE,
        USDT,
        LUSD,
        to6("100"), // amountIn
        to18("99"), // minAmountOut
        INTERNAL_TOLERANT,
        EXTERNAL
      ]);

      await beanstalk.connect(user).farm([wrapEth, exchange, eu], { value: to18("1") });

      expect(await this.lusd.balanceOf(beanstalk.address)).to.be.equal("0");
      expect(await beanstalk.getInternalBalance(user.address, this.lusd.address)).to.be.equal("0");
      expect(await this.lusd.balanceOf(user.address)).to.be.equal("99791486902027823650");
    });

    it("Wrap Eth, Exchange WETH -> USDT, Exchange USDT -> LUSD internal", async function () {
      eu = await beanstalk.interface.encodeFunctionData("exchangeUnderlying", [
        LUSD_3_CURVE,
        USDT,
        LUSD,
        to6("100"), // amountIn
        to18("99"), // minAmountOut
        INTERNAL_TOLERANT,
        INTERNAL
      ]);

      await beanstalk.connect(user).farm([wrapEth, exchange, eu], { value: to18("1") });

      expect(await this.lusd.balanceOf(beanstalk.address)).to.be.equal("99791486902027823650");
      expect(await beanstalk.getInternalBalance(user.address, this.lusd.address)).to.be.equal(
        "99791486902027823650"
      );
      expect(await this.lusd.balanceOf(user.address)).to.be.equal("0");
    });
  });

  // TODO: reimplment with non-curve.
  describe.skip("Farm Liquidity ", async function () {
    before(async function () {
      exchange = await beanstalk.interface.encodeFunctionData("exchange", [
        TRI_CRYPTO_POOL, // tricrypto2
        CRYPTO_REGISTRY,
        WETH, // WETH
        USDT, // USDT
        to18("1"), // amountIn
        ethers.utils.parseUnits("100", 6), // minAmountOut
        INTERNAL_EXTERNAL,
        INTERNAL
      ]);
    });

    describe("tri-crypto", async function () {
      before(async function () {
        addLP = await beanstalk.interface.encodeFunctionData("addLiquidity", [
          TRI_CRYPTO_POOL, // tricrypto2
          CRYPTO_REGISTRY,
          [0, 0, to18("1")],
          "0", // minAmountOut
          INTERNAL_TOLERANT,
          INTERNAL
        ]);
      });

      it("Wraps Eth, Adds WETH as tri-crypto internal", async function () {
        this.triCrypto = await ethers.getContractAt("IERC20", TRI_CRYPTO);

        await beanstalk.connect(user).farm([wrapEth, addLP], { value: to18("1") });

        expect(await this.triCrypto.balanceOf(beanstalk.address)).to.be.equal(
          "2019589947833455380"
        );
        expect(
          await beanstalk.getInternalBalance(user.address, this.triCrypto.address)
        ).to.be.equal("2019589947833455380");
        expect(await this.triCrypto.balanceOf(user.address)).to.be.equal("0");
      });

      it("Wraps Eth, Adds WETH as tri-crypto internal, removes tri-crypto liquidity 1 token to WETH", async function () {
        removeLP = await beanstalk.interface.encodeFunctionData("removeLiquidityOneToken", [
          TRI_CRYPTO_POOL, // tricrypto2
          CRYPTO_REGISTRY,
          WETH,
          "2019589947833455380", // amountInt
          to18("0.1"), // minAmountOut
          INTERNAL_TOLERANT,
          INTERNAL
        ]);

        this.triCrypto = await ethers.getContractAt("IERC20", TRI_CRYPTO);

        await beanstalk.connect(user).farm([wrapEth, addLP, removeLP], { value: to18("1") });

        expect(await this.weth.balanceOf(beanstalk.address)).to.be.equal("999353626969234502");
        expect(await beanstalk.getInternalBalance(user.address, this.weth.address)).to.be.equal(
          "999353626969234502"
        );
        expect(await this.weth.balanceOf(user.address)).to.be.equal("0");
      });

      it("Wraps Eth, Adds WETH as tri-crypto internal, removes tri-crypto liquidity equally", async function () {
        removeLP = await beanstalk.interface.encodeFunctionData("removeLiquidity", [
          TRI_CRYPTO_POOL, // tricrypto2
          CRYPTO_REGISTRY,
          "2019589947833455380", // amountInt
          ["0", "0", "0"], // minAmountOut
          INTERNAL_TOLERANT,
          INTERNAL
        ]);

        this.triCrypto = await ethers.getContractAt("IERC20", TRI_CRYPTO);

        await beanstalk.connect(user).farm([wrapEth, addLP, removeLP], { value: to18("1") });

        expect(await this.weth.balanceOf(beanstalk.address)).to.be.equal("332554978398190452");
        expect(await beanstalk.getInternalBalance(user.address, this.weth.address)).to.be.equal(
          "332554978398190452"
        );
        expect(await this.weth.balanceOf(user.address)).to.be.equal("0");

        expect(await this.usdt.balanceOf(beanstalk.address)).to.be.equal("1019226369");
        expect(await beanstalk.getInternalBalance(user.address, this.usdt.address)).to.be.equal(
          "1019226369"
        );
        expect(await this.usdt.balanceOf(user.address)).to.be.equal("0");

        expect(await this.wbtc.balanceOf(beanstalk.address)).to.be.equal("2504936");
        expect(await beanstalk.getInternalBalance(user.address, this.wbtc.address)).to.be.equal(
          "2504936"
        );
        expect(await this.wbtc.balanceOf(user.address)).to.be.equal("0");
      });

      it("Wraps Eth, Adds WETH as tri-crypto internal, removes tri-crypto liquidity equally", async function () {
        removeLP = await beanstalk.interface.encodeFunctionData("removeLiquidity", [
          TRI_CRYPTO_POOL, // tricrypto2
          CRYPTO_REGISTRY,
          "2019589947833455380", // amountInt
          ["0", "0", "0"], // minAmountOut
          INTERNAL_TOLERANT,
          INTERNAL
        ]);

        this.triCrypto = await ethers.getContractAt("IERC20", TRI_CRYPTO);

        await beanstalk.connect(user).farm([wrapEth, addLP, removeLP], { value: to18("1") });

        expect(await this.weth.balanceOf(beanstalk.address)).to.be.equal("332554978398190452");
        expect(await beanstalk.getInternalBalance(user.address, this.weth.address)).to.be.equal(
          "332554978398190452"
        );
        expect(await this.weth.balanceOf(user.address)).to.be.equal("0");

        expect(await this.usdt.balanceOf(beanstalk.address)).to.be.equal("1019226369");
        expect(await beanstalk.getInternalBalance(user.address, this.usdt.address)).to.be.equal(
          "1019226369"
        );
        expect(await this.usdt.balanceOf(user.address)).to.be.equal("0");

        expect(await this.wbtc.balanceOf(beanstalk.address)).to.be.equal("2504936");
        expect(await beanstalk.getInternalBalance(user.address, this.wbtc.address)).to.be.equal(
          "2504936"
        );
        expect(await this.wbtc.balanceOf(user.address)).to.be.equal("0");
      });

      it("Wraps Eth, Adds WETH as tri-crypto internal, removes tri-crypto liquidity imbalance", async function () {
        removeLPImb = await beanstalk.interface.encodeFunctionData("removeLiquidityImbalance", [
          TRI_CRYPTO_POOL, // tricrypto2
          CRYPTO_REGISTRY,
          // [to6('1000'), '2500000', to18('0.3')],  // minAmountOut
          ["1", "1", "1"], // minAmountOut
          "2019589947833455380", // amountInt
          INTERNAL_TOLERANT,
          INTERNAL
        ]);

        this.triCrypto = await ethers.getContractAt("IERC20", TRI_CRYPTO);

        await expect(
          beanstalk.connect(user).farm([wrapEth, addLP, removeLPImb], { value: to18("1") })
        ).to.be.revertedWith("Curve: tri-crypto not supported");
      });
    });
    describe("3-pool", async function () {
      before(async function () {
        this.threeCurve = await ethers.getContractAt("IERC20", THREE_CURVE);

        addLP = await beanstalk.interface.encodeFunctionData("addLiquidity", [
          THREE_POOL, // 3pool
          CURVE_REGISTRY,
          ["0", "0", "3043205584"],
          ethers.utils.parseUnits("1", 18), // minAmountOut
          INTERNAL_TOLERANT,
          INTERNAL
        ]);
      });

      it("Wraps Eth, Exchange WETH -> USDT, add USDT as 3CRV internal", async function () {
        await beanstalk.connect(user).farm([wrapEth, exchange, addLP], { value: to18("1") });

        expect(await this.threeCurve.balanceOf(beanstalk.address)).to.be.equal(
          "2981268357742150365108"
        );
        expect(
          await beanstalk.getInternalBalance(user.address, this.threeCurve.address)
        ).to.be.equal("2981268357742150365108");
        expect(await this.threeCurve.balanceOf(user.address)).to.be.equal("0");
      });

      it("Wraps Eth, Exchange WETH -> USDT, add USDT as 3CRV external", async function () {
        addLP2 = await beanstalk.interface.encodeFunctionData("addLiquidity", [
          THREE_POOL, // 3pool
          CURVE_REGISTRY,
          ["0", "0", "3043205584"],
          ethers.utils.parseUnits("1", 18), // minAmountOut
          INTERNAL_TOLERANT,
          EXTERNAL
        ]);

        await beanstalk.connect(user).farm([wrapEth, exchange, addLP2], { value: to18("1") });

        expect(await this.threeCurve.balanceOf(beanstalk.address)).to.be.equal("0");
        expect(
          await beanstalk.getInternalBalance(user.address, this.threeCurve.address)
        ).to.be.equal("0");
        expect(await this.threeCurve.balanceOf(user.address)).to.be.equal("2981268357742150365108");
      });

      it("Wraps Eth, Exchange WETH -> USDT, add USDT as 3CRV, removes 3CRV equally", async function () {
        removeLP = await beanstalk.interface.encodeFunctionData("removeLiquidity", [
          THREE_POOL, // tricrypto2
          CURVE_REGISTRY,
          "2981268357742150365108", // amountIn
          ["1", "1", "1"], // minAmountOut
          INTERNAL_TOLERANT,
          INTERNAL
        ]);

        await beanstalk
          .connect(user)
          .farm([wrapEth, exchange, addLP, removeLP], { value: to18("1") });

        expect(await this.usdc.balanceOf(beanstalk.address)).to.be.equal("1096956614");
        expect(await beanstalk.getInternalBalance(user.address, this.usdc.address)).to.be.equal(
          "1096956614"
        );
        expect(await this.usdc.balanceOf(user.address)).to.be.equal("1000000");

        expect(await this.usdt.balanceOf(beanstalk.address)).to.be.equal("727891990");
        expect(await beanstalk.getInternalBalance(user.address, this.usdt.address)).to.be.equal(
          "727891990"
        );
        expect(await this.usdt.balanceOf(user.address)).to.be.equal("0");

        expect(await this.dai.balanceOf(beanstalk.address)).to.be.equal("1218092928789910236576");
        expect(await beanstalk.getInternalBalance(user.address, this.dai.address)).to.be.equal(
          "1218092928789910236576"
        );
        expect(await this.dai.balanceOf(user.address)).to.be.equal("0");
      });

      it("Wraps Eth, Exchange WETH -> USDT, add USDT as 3CRV, removes 3CRV to USDC", async function () {
        removeLP = await beanstalk.interface.encodeFunctionData("removeLiquidityOneToken", [
          THREE_POOL, // 3pool
          CURVE_REGISTRY,
          DAI,
          "2981268357742150365108", // amountInt
          to18("300"), // minAmountOut
          INTERNAL_TOLERANT,
          EXTERNAL
        ]);

        await beanstalk
          .connect(user)
          .farm([wrapEth, exchange, addLP, removeLP], { value: to18("1") });

        expect(await this.dai.balanceOf(beanstalk.address)).to.be.equal("0");
        expect(await beanstalk.getInternalBalance(user.address, this.dai.address)).to.be.equal("0");
        expect(await this.dai.balanceOf(user.address)).to.be.equal("3042640137009018638481");
      });

      it("Wraps Eth, Exchange WETH -> USDT, add USDT as 3CRV, removes 3CRV imbalance", async function () {
        removeLPImb = await beanstalk.interface.encodeFunctionData("removeLiquidityImbalance", [
          THREE_POOL, // 3pool
          CURVE_REGISTRY,
          [to6("100"), to6("100"), to6("100")], // minAmountOut
          "3042640137009018638481", // amountInt
          INTERNAL_TOLERANT,
          INTERNAL
        ]);

        await beanstalk
          .connect(user)
          .farm([wrapEth, exchange, addLP, removeLPImb], { value: to18("1") });

        expect(await this.usdc.balanceOf(beanstalk.address)).to.be.equal(to6("100"));
        expect(await beanstalk.getInternalBalance(user.address, this.usdc.address)).to.be.equal(
          to6("100")
        );
        expect(await this.usdc.balanceOf(user.address)).to.be.equal("1000000");

        expect(await this.usdt.balanceOf(beanstalk.address)).to.be.equal(to6("100"));
        expect(await beanstalk.getInternalBalance(user.address, this.usdt.address)).to.be.equal(
          to6("100")
        );
        expect(await this.usdt.balanceOf(user.address)).to.be.equal("0");

        expect(await this.dai.balanceOf(beanstalk.address)).to.be.equal(to6("100"));
        expect(await beanstalk.getInternalBalance(user.address, this.dai.address)).to.be.equal(
          to6("100")
        );
        expect(await this.dai.balanceOf(user.address)).to.be.equal("0");
      });
    });
  });
});
