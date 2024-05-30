const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { readPrune, toBN } = require("../utils/index.js");
const { UNRIPE_LP, ZERO_ADDRESS } = require("./utils/constants.js");
const { to18, to6 } = require("./utils/helpers.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot.js");
const { deployMockWellWithMockPump, deployMockWell } = require("../utils/well.js");
const { getAllBeanstalkContracts } = require("../utils/contracts.js");

let user, user2, owner;

let pru;

function prune(value) {
  return toBN(value).mul(toBN(pru)).div(to18("1"));
}

// whitelists are skipped as whitelist.t.sol tests the same functionality.
describe.skip("Whitelist", function () {
  before(async function () {
    pru = await readPrune();
    [owner, user, user2, flashLoanExploiter] = await ethers.getSigners();

    flashLoanExploiterAddress = flashLoanExploiter.address;
    const contracts = await deploy((verbose = false), (mock = true), (reset = true));
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [beanstalk, mockBeanstalk] = await getAllBeanstalkContracts(this.diamond.address);

    [this.well, this.wellFunction, this.pump] = await deployMockWellWithMockPump(ZERO_ADDRESS);

    const SiloToken = await ethers.getContractFactory("MockToken");
    this.siloToken = await SiloToken.deploy("Silo", "SILO");
    await this.siloToken.deployed();
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("whitelist", async function () {
    it("reverts if not owner", async function () {
      await expect(
        beanstalk
          .connect(user2)
          .whitelistToken(
            this.well.address,
            beanstalk.interface.getSighash("wellBdv"),
            "10000",
            "1",
            beanstalk.interface.getSighash("defaultGaugePointFunction(uint256,uint256,uint256)"),
            beanstalk.interface.getSighash("maxWeight()"),
            "0",
            "0"
          )
      ).to.be.revertedWith("LibDiamond: Must be contract or owner");
    });

    it("whitelists token", async function () {
      this.result = await beanstalk
        .connect(owner)
        .whitelistTokenWithEncodeType(
          this.well.address,
          beanstalk.interface.getSighash("wellBdv"),
          "10000",
          "1",
          1,
          beanstalk.interface.getSighash("defaultGaugePointFunction(uint256,uint256,uint256)"),
          beanstalk.interface.getSighash("maxWeight()"),
          "0",
          "0"
        );
      const settings = await beanstalk.tokenSettings(this.well.address);

      expect(settings[0]).to.equal(beanstalk.interface.getSighash("wellBdv"));

      expect(settings[1]).to.equal(1);

      expect(settings[2]).to.equal(10000);
      await expect(this.result)
        .to.emit(beanstalk, "WhitelistToken")
        .withArgs(
          this.well.address,
          beanstalk.interface.getSighash("wellBdv"),
          1,
          10000,
          beanstalk.interface.getSighash("defaultGaugePointFunction(uint256,uint256,uint256)"),
          beanstalk.interface.getSighash("maxWeight()"),
          "0",
          "0"
        );
    });

    it("reverts on whitelisting same token again", async function () {
      this.resultFirst = await beanstalk
        .connect(owner)
        .whitelistTokenWithEncodeType(
          this.well.address,
          beanstalk.interface.getSighash("wellBdv"),
          "10000",
          "1",
          1,
          beanstalk.interface.getSighash("defaultGaugePointFunction(uint256,uint256,uint256)"),
          beanstalk.interface.getSighash("maxWeight()"),
          "0",
          "0"
        );

      await expect(
        beanstalk
          .connect(owner)
          .whitelistTokenWithEncodeType(
            this.well.address,
            beanstalk.interface.getSighash("wellBdv"),
            "10000",
            "1",
            1,
            beanstalk.interface.getSighash("defaultGaugePointFunction(uint256,uint256,uint256)"),
            beanstalk.interface.getSighash("maxWeight()"),
            "0",
            "0"
          )
      ).to.be.revertedWith("Whitelist: Token already whitelisted");
    });

    it("reverts on updating stalk per bdv per season for token that is not whitelisted", async function () {
      await expect(
        beanstalk.connect(owner).updateStalkPerBdvPerSeasonForToken(this.well.address, 1)
      ).to.be.revertedWith("Token not whitelisted");
    });

    it("reverts on whitelisting token with bad selector", async function () {
      await expect(
        beanstalk
          .connect(owner)
          .whitelistToken(
            this.well.address,
            beanstalk.interface.getSighash("wellBdv"),
            "10000",
            "1",
            beanstalk.interface.getSighash("defaultGaugePointFunction(uint256,uint256,uint256)"),
            beanstalk.interface.getSighash("maxWeight()"),
            "0",
            "0"
          )
      ).to.be.revertedWith("Whitelist: Invalid BDV selector");

      await expect(
        beanstalk
          .connect(owner)
          .whitelistTokenWithEncodeType(
            this.well.address,
            beanstalk.interface.getSighash("wellBdv"),
            "10000",
            "1",
            1,
            "0x00000000",
            beanstalk.interface.getSighash("maxWeight()"),
            "0",
            "0"
          )
      ).to.be.revertedWith("Whitelist: Invalid GaugePoint selector");

      await expect(
        beanstalk
          .connect(owner)
          .whitelistTokenWithEncodeType(
            this.well.address,
            beanstalk.interface.getSighash("wellBdv"),
            "10000",
            "1",
            1,
            beanstalk.interface.getSighash("defaultGaugePointFunction(uint256,uint256,uint256)"),
            "0x00000000",
            "0",
            "0"
          )
      ).to.be.revertedWith("Whitelist: Invalid LiquidityWeight selector");
    });

    it("reverts on updating stalk per bdv per season for token that is not whitelisted", async function () {
      await expect(
        beanstalk.connect(owner).updateStalkPerBdvPerSeasonForToken(this.well.address, 1)
      ).to.be.revertedWith("Token not whitelisted");
    });
  });

  describe("update stalk per bdv per season for token", async function () {
    it("reverts if not owner", async function () {
      await expect(
        beanstalk.connect(user2).updateStalkPerBdvPerSeasonForToken(this.well.address, 1)
      ).to.be.revertedWith("LibDiamond: Must be contract or owner");
    });

    it("updates stalk per bdv per season", async function () {
      //do initial whitelist so there's something to update
      beanstalk
        .connect(owner)
        .whitelistTokenWithEncodeType(
          this.well.address,
          beanstalk.interface.getSighash("wellBdv"),
          "10000",
          "1",
          1,
          beanstalk.interface.getSighash("defaultGaugePointFunction(uint256,uint256,uint256)"),
          beanstalk.interface.getSighash("maxWeight()"),
          "0",
          "0"
        );
      this.result = beanstalk
        .connect(owner)
        .updateStalkPerBdvPerSeasonForToken(this.well.address, "50000");
      const settings = await beanstalk.tokenSettings(this.well.address);

      expect(settings[1]).to.equal(50000);
      const currentSeason = await beanstalk.season();
      await expect(this.result)
        .to.emit(beanstalk, "UpdatedStalkPerBdvPerSeason")
        .withArgs(this.well.address, 50000, currentSeason);
    });

    it("reverts if wrong encode type", async function () {
      await expect(
        beanstalk
          .connect(owner)
          .whitelistTokenWithEncodeType(
            this.well.address,
            beanstalk.interface.getSighash("wellBdv"),
            1,
            1,
            2,
            beanstalk.interface.getSighash("defaultGaugePointFunction(uint256,uint256,uint256)"),
            beanstalk.interface.getSighash("maxWeight()"),
            "0",
            "0"
          )
      ).to.revertedWith("Silo: Invalid encodeType");
    });

    it("cannot whitelist with 0 seeds (sets to 1)", async function () {
      beanstalk
        .connect(owner)
        .whitelistTokenWithEncodeType(
          this.well.address,
          beanstalk.interface.getSighash("wellBdv"),
          "10000",
          "0",
          1,
          beanstalk.interface.getSighash("defaultGaugePointFunction(uint256,uint256,uint256)"),
          beanstalk.interface.getSighash("maxWeight()"),
          "0",
          "0"
        );
      const settings = await beanstalk.tokenSettings(this.well.address);

      expect(settings[1]).to.equal(1);
    });
  });

  describe("dewhitelist", async function () {
    it("reverts if not owner", async function () {
      await expect(beanstalk.connect(user2).dewhitelistToken(this.well.address)).to.be.revertedWith(
        "LibDiamond: Must be contract or owner"
      );
    });

    it("dewhitelists token", async function () {
      // Duplicate whitelisting possible, though not expected.
      await mockBeanstalk.mockWhitelistToken(
        UNRIPE_LP,
        beanstalk.interface.getSighash("unripeLPToBDV"), // Arbitrary BDV.
        10000,
        to6("1")
      );
      this.result = await beanstalk.connect(owner).dewhitelistToken(UNRIPE_LP);
      const settings = await beanstalk.tokenSettings(UNRIPE_LP);
      // milestone season, stem, or stalkIssuedPerBDV should not be cleared.
      expect(settings[0]).to.equal("0x00000000");
      expect(settings[1]).to.equal(1);
      expect(settings[2]).to.equal(10000);
      expect(settings[3]).to.equal(1);
      expect(settings[4]).to.equal(0);
      expect(settings[5]).to.equal("0x00");
      expect(settings[6]).to.equal(-999999);
      expect(settings[7]).to.equal("0x00000000");
      expect(settings[8]).to.equal("0x00000000");
      expect(settings[9]).to.equal(0);
      expect(settings[10]).to.equal(0);

      await expect(this.result).to.emit(beanstalk, "DewhitelistToken").withArgs(UNRIPE_LP);
    });
  });
});
