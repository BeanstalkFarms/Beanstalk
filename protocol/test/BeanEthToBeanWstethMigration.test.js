const { expect } = require("chai");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot.js");
const {
  BEAN,
  FERTILIZER,
  USDC,
  UNRIPE_BEAN,
  UNRIPE_LP,
  WETH,
  BEANSTALK,
  BEAN_ETH_WELL,
  BCM,
  STABLE_FACTORY,
  PUBLIUS,
  WSTETH,
  BEAN_WSTETH_WELL
} = require("./utils/constants.js");
const { setEthUsdcPrice, setEthUsdChainlinkPrice } = require("../utils/oracle.js");
const { to6, to18 } = require("./utils/helpers.js");
const {
  bipMigrateUnripeBeanEthToBeanSteth,
  bipSeedGauge
} = require("../scripts/bips.js");
const { getBeanstalk } = require("../utils/contracts.js");
const { impersonateBeanstalkOwner, impersonateSigner } = require("../utils/signer.js");
const { ethers } = require("hardhat");
const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const { mintEth, mintBeans } = require("../utils/mint.js");
const { ConvertEncoder } = require("./utils/encoder.js");
const { setReserves, getWellContractAt } = require("../utils/well.js");
const { toBN } = require("../utils/helpers.js");
const { impersonateBean, impersonateWsteth } = require("../scripts/impersonate.js");
const { testIfRpcSet } = require("./utils/test.js");
const { deployBasinV1_1Upgrade, deployBasinV1_1 } = require("../scripts/basinV1_1.js");
const { addAdminControls } = require("../utils/admin.js");
const {
  finishWstethMigration,
  migrateBeanEthToBeanWSteth
} = require("../scripts/beanWstethMigration.js");

let user, user2, owner;
let publius;

let underlyingBefore;
let beanEthUnderlying;
let snapshotId;

async function fastForwardHour() {
  const lastTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
  const hourTimestamp = parseInt(lastTimestamp / 3600 + 1) * 3600;
  await network.provider.send("evm_setNextBlockTimestamp", [hourTimestamp]);
}

// Skipping because this migration already occured.
describe.skip("Bean:Eth to Bean:Wsteth Migration", function () {
  before(async function () {
    // Skipping because this migration already occured.
    return;

    [user, user2] = await ethers.getSigners();

    try {
      await network.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
              jsonRpcUrl: process.env.FORKING_RPC,
              blockNumber: 19179000
            }
          }
        ]
      });
    } catch (error) {
      console.log("forking error in bean:eth -> bean:wsteth");
      console.log(error);
      return;
    }

    await impersonateBean();
    this.wsteth = await ethers.getContractAt("MockWsteth", WSTETH);
    const stethPerToken = await this.wsteth.stEthPerToken();
    await impersonateWsteth();
    await this.wsteth.setStEthPerToken(stethPerToken);

    let c = {
      wellImplementation: await getWellContractAt(
        "Well",
        "0xBA510e11eEb387fad877812108a3406CA3f43a4B"
      ),
      aquifer: await getWellContractAt("Aquifer", "0xBA51AAAA95aeEFc1292515b36D86C51dC7877773")
    };

    c = await deployBasinV1_1Upgrade(c, true, undefined, false, false, (mockPump = true));

    await bipSeedGauge(true, undefined, false);

    await addAdminControls();

    publius = await impersonateSigner(PUBLIUS, true);

    owner = await impersonateBeanstalkOwner();
    beanstalk = await getBeanstalk();
    this.well = await ethers.getContractAt("IWell", c.well.address);
    bean = await ethers.getContractAt("IBean", BEAN);
    this.beanEth = await ethers.getContractAt("IWell", BEAN_ETH_WELL);
    this.beanEthToken = await ethers.getContractAt("IERC20", BEAN_ETH_WELL);
    this.unripeLp = await ethers.getContractAt("IERC20", UNRIPE_LP);
    underlyingBefore = await beanstalk.getTotalUnderlying(UNRIPE_LP);

    this.beanWsteth = await ethers.getContractAt("IWell", BEAN_WSTETH_WELL);

    const pumps = await c.well.pumps();

    await bipMigrateUnripeBeanEthToBeanSteth(true, undefined, false);

    const reserves = await this.beanWsteth.getReserves();
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe.skip("Initializes migration", async function () {
    describe("Bean Eth minting", async function () {
      it("resets well oracle snapshot", async function () {
        expect(await beanstalk.wellOracleSnapshot(BEAN_ETH_WELL)).to.be.equal("0x");
      });

      it("doesn't start the oracle next season well oracle snapshot", async function () {
        await fastForwardHour();
        await beanstalk.sunrise();
        expect(await beanstalk.wellOracleSnapshot(BEAN_ETH_WELL)).to.be.equal("0x");
      });

      it("doesn't start the oracle after 24 season well oracle snapshot", async function () {
        for (let i = 0; i < 23; i++) {
          await fastForwardHour();
          await beanstalk.sunrise();
        }
        expect(await beanstalk.wellOracleSnapshot(BEAN_ETH_WELL)).to.be.equal("0x");
      });

      it("starts the oracle after 24 season well oracle snapshot", async function () {
        for (let i = 0; i < 24; i++) {
          await fastForwardHour();
          await beanstalk.sunrise();
        }
        expect(await beanstalk.wellOracleSnapshot(BEAN_ETH_WELL)).to.be.not.equal("0x");
      });
    });

    it("Changings underlying token", async function () {
      expect(await beanstalk.getBarnRaiseToken()).to.be.equal(WSTETH);
    });

    it("Barn Raise Token", async function () {
      expect(await beanstalk.getBarnRaiseWell()).to.be.equal(BEAN_WSTETH_WELL);
    });

    it("Removes underlying balance", async function () {
      expect(await beanstalk.getTotalUnderlying(UNRIPE_LP)).to.be.equal(0);
    });

    it("Sends underlying balance to BCM", async function () {
      expect(await beanstalk.getExternalBalance(BCM, BEAN_ETH_WELL)).to.be.equal(underlyingBefore);
    });

    describe("Interactions with Unripe fail", async function () {
      it("chop fails", async function () {
        await beanstalk.connect(publius).withdrawDeposit(UNRIPE_LP, "-56836000000", to6("1"), 1);
        await expect(beanstalk.connect(publius).chop(UNRIPE_LP, to6("1"), 1, 0)).to.be.revertedWith(
          "Chop: no underlying"
        );
      });

      it("deposit fails", async function () {
        await beanstalk.connect(publius).withdrawDeposit(UNRIPE_LP, "-56836000000", to6("1"), 1);
        await expect(beanstalk.connect(publius).deposit(UNRIPE_LP, to6("1"), 1)).to.be.revertedWith(
          "Silo: No Beans under Token."
        );
      });

      it("enrootDeposit fails", async function () {
        await expect(
          beanstalk.connect(publius).enrootDeposit(UNRIPE_LP, "-56836000000", to6("1"))
        ).to.be.revertedWith("panic code 0x11");
      });

      it("enrootDeposits fails", async function () {
        await expect(
          beanstalk.connect(publius).enrootDeposits(UNRIPE_LP, ["-56836000000"], [to6("1")])
        ).to.be.revertedWith("panic code 0x11");
      });

      it("convert Unripe Bean to LP fails", async function () {
        const liquidityAdder = await impersonateSigner(
          "0x7eaE23DD0f0d8289d38653BCE11b92F7807eFB64",
          true
        );
        await this.wsteth.mint(liquidityAdder.address, to18("0.05"));
        await this.wsteth.connect(liquidityAdder).approve(this.well.address, to18("0.05"));
        await this.beanWsteth
          .connect(liquidityAdder)
          .addLiquidity(
            ["0", to18("0.05")],
            "0",
            liquidityAdder.address,
            ethers.constants.MaxUint256
          );
        await expect(
          beanstalk
            .connect(publius)
            .convert(
              ConvertEncoder.convertUnripeBeansToLP(to6("200"), "0"),
              ["-16272000000"],
              [to6("200")]
            )
        ).to.be.revertedWith("panic code 0x12");
      });

      it("convert Unripe LP to Bean fails", async function () {
        const liquidityAdder = await impersonateSigner(
          "0x7eaE23DD0f0d8289d38653BCE11b92F7807eFB64",
          true
        );
        await expect(
          beanstalk
            .connect(publius)
            .convert(
              ConvertEncoder.convertUnripeLPToBeans(to6("200"), "0"),
              ["-56836000000"],
              [to6("200")]
            )
        ).to.be.revertedWith("panic code 0x12");
      });
    });
  });

  describe.skip("Completes Migration", async function () {
    beforeEach(async function () {
      this.beanWstethUnderlying = await finishWstethMigration(true, false);
    });

    it("successfully adds underlying", async function () {
      expect(await beanstalk.getTotalUnderlying(UNRIPE_LP)).to.be.equal(this.beanWstethUnderlying);
      expect(
        await beanstalk.getUnderlying(UNRIPE_LP, await this.unripeLp.totalSupply())
      ).to.be.equal(this.beanWstethUnderlying);
    });

    describe("Interactions with Unripe succeed", async function () {
      it("chop succeeds", async function () {
        await beanstalk.connect(publius).withdrawDeposit(UNRIPE_LP, "-56836000000", to6("1"), 1);
        await beanstalk.connect(publius).chop(UNRIPE_LP, to6("1"), 1, 0);
      });

      it("deposit succeeds", async function () {
        await beanstalk.connect(publius).withdrawDeposit(UNRIPE_LP, "-56836000000", to6("1"), 1);
        await beanstalk.connect(publius).deposit(UNRIPE_LP, to6("1"), 1);
      });

      it("enrootDeposit succeeds", async function () {
        await beanstalk.connect(publius).enrootDeposit(UNRIPE_LP, "-56836000000", to6("1"));
      });

      it("enrootDeposits succeeds", async function () {
        await beanstalk.connect(publius).enrootDeposits(UNRIPE_LP, ["-56836000000"], [to6("1")]);
      });

      it("convert Unripe Bean to LP succeeds", async function () {
        await beanstalk
          .connect(publius)
          .convert(
            ConvertEncoder.convertUnripeBeansToLP(to6("200"), "0"),
            ["-16272000000"],
            [to6("200")]
          );
      });

      it("convert Unripe LP to Bean succeeds", async function () {
        await impersonateBean();
        await bean.mint(user.address, to6("100000"));
        await bean.connect(user).approve(BEAN_WSTETH_WELL, to6("100000"));
        await this.beanWsteth
          .connect(user)
          .addLiquidity([to6("100000"), "0"], "0", user.address, ethers.constants.MaxUint256);
        await beanstalk
          .connect(publius)
          .convert(
            ConvertEncoder.convertUnripeLPToBeans(to6("200"), "0"),
            ["-56836000000"],
            [to6("200")]
          );
      });
    });
  });
});
