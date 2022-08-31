const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { readPrune, toBN } = require("../utils");
const {
  EXTERNAL,
  INTERNAL,
  INTERNAL_EXTERNAL,
  INTERNAL_TOLERANT,
} = require("./utils/balances.js");
const {
  BEAN,
  THREE_POOL,
  BEAN_3_CURVE,
  UNRIPE_LP,
  UNRIPE_BEAN,
  THREE_CURVE,
} = require("./utils/constants");
const { to18, to6, toStalk, toBean } = require("./utils/helpers.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const ZERO_BYTES = ethers.utils.formatBytes32String("0x0");

let user, user2, owner;
let userAddress, ownerAddress, user2Address;

let pru;

function pruneToSeeds(value, seeds = 2) {
  return prune(value).mul(seeds);
}

function pruneToStalk(value) {
  return prune(value).mul(toBN("10000"));
}

function prune(value) {
  return toBN(value).mul(toBN(pru)).div(to18("1"));
}

describe("Fungible Silo Token", function () {
  before(async function () {
    pru = await readPrune();
    [owner, user, user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
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
    this.unripe = await ethers.getContractAt(
      "MockUnripeFacet",
      this.diamond.address
    );

    this.siloToken = await ethers.getContractAt("MockToken", BEAN);

    const SiloToken = await ethers.getContractFactory("MockToken");

    this.siloToken2 = await SiloToken.deploy("Silo", "SILO");
    await this.siloToken2.deployed();

    await this.silo.mockWhitelistToken(
      this.siloToken.address,
      this.silo.interface.getSighash("mockBDV(uint256 amount)"),
      "10000",
      "1"
    );

    const FungibleSiloToken = await ethers.getContractFactory(
      "FungibleSiloToken"
    );
    this.fungibleSiloToken = await upgrades.deployProxy(
      FungibleSiloToken,
      [
        this.diamond.address,
        this.siloToken.address,
        await this.siloToken.decimals(),
        50,
        "Silo",
        "SILO",
      ],
      {
        initializer: "initialize",
      }
    );
    await this.siloToken.deployed();

    await this.season.siloSunrise(0);
    await this.siloToken
      .connect(user)
      .approve(this.silo.address, "100000000000");
    await this.siloToken
      .connect(user2)
      .approve(this.silo.address, "100000000000");
    await this.siloToken.mint(userAddress, "10000");
    await this.siloToken.mint(user2Address, "10000");
    await this.siloToken2
      .connect(user)
      .approve(this.silo.address, "100000000000");
    await this.siloToken2.mint(userAddress, "10000");

    await this.siloToken
      .connect(owner)
      .approve(this.silo.address, to18("10000"));
    await this.siloToken.mint(ownerAddress, to18("10000"));
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("init", function () {
    it("check if init value set correctly", async function () {
      expect(
        await this.fungibleSiloToken.connect(user).BEANSTALK_ADDRESS()
      ).to.be.equal(this.diamond.address);

      expect(await this.fungibleSiloToken.connect(user).name()).to.be.equal(
        "Silo"
      );

      expect(await this.fungibleSiloToken.connect(user).symbol()).to.be.equal(
        "SILO"
      );

      expect(
        await this.fungibleSiloToken.connect(user).depositedSiloSeason()
      ).to.be.equal(50);

      expect(
        await this.fungibleSiloToken.connect(user).depositedSiloAmount()
      ).to.be.equal(0);

      expect(
        await this.fungibleSiloToken.connect(user).siloTokenDecimals()
      ).to.be.equal(await this.siloToken.decimals());
    });
  });

  describe("earn", async function () {
    beforeEach(async function () {
      await this.season.fastForward(48);
      await this.silo
        .connect(user)
        .approveDeposit(
          this.fungibleSiloToken.address,
          this.siloToken.address,
          "1000000"
        );
      await this.silo
        .connect(user)
        .deposit(this.siloToken.address, "1000", EXTERNAL);
      this.result = await this.fungibleSiloToken
        .connect(user)
        .depositWithSeason(50, "1000", user.address);
      await this.season.siloSunrise(100);
      await this.fungibleSiloToken.connect(user).earn();
    });

    it("properly updates the stored season and amount", async function () {
      expect(await this.fungibleSiloToken.depositedSiloSeason()).to.eq(51);
      expect(await this.fungibleSiloToken.depositedSiloAmount()).to.eq("1100");
    });

    it("properly updates total assets", async function () {
      expect(await this.fungibleSiloToken.totalAssets()).to.eq("1100");
      expect(await this.fungibleSiloToken.totalSupply()).to.eq(
        "1000000000000000"
      );
    });

    it("properly updates preview", async function () {
      expect(await this.fungibleSiloToken.previewWithdraw("1100")).to.eq(
        "1000000000000000"
      );
      expect(
        await this.fungibleSiloToken.previewRedeem("1000000000000000")
      ).to.eq("1100");
    });
  });

  describe("mint", async function () {
    describe("mint with stored season", function () {
      beforeEach(async function () {
        await this.season.fastForward(48);
        await this.silo
          .connect(user)
          .approveDeposit(
            this.fungibleSiloToken.address,
            this.siloToken.address,
            "1000"
          );
        await this.silo
          .connect(user)
          .deposit(this.siloToken.address, "1000", EXTERNAL);

        this.result = await this.fungibleSiloToken
          .connect(user)
          .mint("1000000000000000", user.address);
      });

      it("properly updates the stored season and amount", async function () {
        expect(await this.fungibleSiloToken.depositedSiloSeason()).to.eq(50);
        expect(await this.fungibleSiloToken.depositedSiloAmount()).to.eq(
          "1000"
        );
      });

      it("properly updates the user shares", async function () {
        expect(await this.fungibleSiloToken.balanceOf(user.address)).to.eq(
          "1000000000000000"
        );
      });

      it("properly updates total assets", async function () {
        expect(await this.fungibleSiloToken.totalAssets()).to.eq("1000");
      });

      it("emits Deposit event", async function () {
        await expect(this.result)
          .to.emit(this.fungibleSiloToken, "Deposit")
          .withArgs(user.address, user.address, "1000", "1000000000000000");
      });
    });
  });

  describe("redeem", function () {
    describe("reverts", function () {
      beforeEach(async function () {
        await this.silo
          .connect(user)
          .approveDeposit(
            this.fungibleSiloToken.address,
            this.siloToken.address,
            "1000000"
          );
        await this.silo
          .connect(user)
          .deposit(this.siloToken.address, "1000", EXTERNAL);
        this.result = await this.fungibleSiloToken
          .connect(user)
          .depositWithSeason(2, "1000", user.address);
      });
      it("reverts if redeeming more than max", async function () {
        await expect(
          this.fungibleSiloToken
            .connect(user)
            .redeem("1500000000000000", user.address, user.address)
        ).to.revertedWith("ERC4626: redeem more than max");
      });

      it("reverts if spender insufficient allowance", async function () {
        await expect(
          this.fungibleSiloToken
            .connect(user2)
            .redeem("1000", user2.address, user.address)
        ).to.revertedWith("ERC20: insufficient allowance");
      });
    });

    describe("owner redeem all", async function () {
      beforeEach(async function () {
        await this.silo
          .connect(user)
          .approveDeposit(
            this.fungibleSiloToken.address,
            this.siloToken.address,
            "1000000"
          );
        await this.silo
          .connect(user)
          .deposit(this.siloToken.address, "1000", EXTERNAL);
        await this.fungibleSiloToken
          .connect(user)
          .depositWithSeason(2, "1000", user.address);

        this.result = await this.fungibleSiloToken
          .connect(user)
          .redeem("1000000000000000", user.address, user.address);
      });

      it("properly updates the stored amount and season", async function () {
        expect(await this.fungibleSiloToken.depositedSiloSeason()).to.eq(2);
        expect(await this.fungibleSiloToken.depositedSiloAmount()).to.eq("0");
      });

      it("properly updates the user balances", async function () {
        expect(await this.fungibleSiloToken.balanceOf(user.address)).to.eq("0");
        const deposit = await this.silo.getDeposit(
          user.address,
          this.siloToken.address,
          2
        );
        expect(deposit[0]).to.eq("1000");
        expect(deposit[1]).to.eq("1000");
      });

      it("properly updates total assets and supply", async function () {
        expect(await this.fungibleSiloToken.totalAssets()).to.eq("0");
        expect(await this.fungibleSiloToken.totalSupply()).to.eq("0");
      });

      it("emits Withdraw event", async function () {
        await expect(this.result)
          .to.emit(this.fungibleSiloToken, "Withdraw")
          .withArgs(
            user.address,
            user.address,
            user.address,
            "1000",
            "1000000000000000"
          );
      });
    });
    describe("owner redeem half", async function () {
      beforeEach(async function () {
        await this.silo
          .connect(user)
          .approveDeposit(
            this.fungibleSiloToken.address,
            this.siloToken.address,
            "1000000"
          );
        await this.silo
          .connect(user)
          .deposit(this.siloToken.address, "1000", EXTERNAL);
        await this.fungibleSiloToken
          .connect(user)
          .depositWithSeason(2, "1000", user.address);

        this.result = await this.fungibleSiloToken
          .connect(user)
          .redeem("500000000000000", user.address, user.address);
      });

      it("properly updates the stored amount and season", async function () {
        expect(await this.fungibleSiloToken.depositedSiloSeason()).to.eq(2);
        expect(await this.fungibleSiloToken.depositedSiloAmount()).to.eq("500");
      });

      it("properly updates the user balances", async function () {
        expect(await this.fungibleSiloToken.balanceOf(user.address)).to.eq(
          "500000000000000"
        );
        const deposit = await this.silo.getDeposit(
          user.address,
          this.siloToken.address,
          2
        );
        expect(deposit[0]).to.eq("500");
        expect(deposit[1]).to.eq("500");
      });

      it("properly updates total assets and supply", async function () {
        expect(await this.fungibleSiloToken.totalAssets()).to.eq("500");
        expect(await this.fungibleSiloToken.totalSupply()).to.eq(
          "500000000000000"
        );
      });

      it("emits Withdraw event", async function () {
        await expect(this.result)
          .to.emit(this.fungibleSiloToken, "Withdraw")
          .withArgs(
            user.address,
            user.address,
            user.address,
            "500",
            "500000000000000"
          );
      });
    });
    describe("owner redeem all with earn", async function () {
      beforeEach(async function () {
        await this.silo
          .connect(user)
          .approveDeposit(
            this.fungibleSiloToken.address,
            this.siloToken.address,
            "1000000"
          );
        await this.silo
          .connect(user)
          .deposit(this.siloToken.address, "1000", EXTERNAL);
        await this.fungibleSiloToken
          .connect(user)
          .depositWithSeason(2, "1000", user.address);

        await this.season.siloSunrise(100);
        await this.fungibleSiloToken.earn();
        this.result = await this.fungibleSiloToken
          .connect(user)
          .redeem("1000000000000000", user.address, user.address);
      });

      it("properly updates the stored amount and season", async function () {
        expect(await this.fungibleSiloToken.depositedSiloSeason()).to.eq(3);
        expect(await this.fungibleSiloToken.depositedSiloAmount()).to.eq("0");
      });

      it("properly updates the user balances", async function () {
        expect(await this.fungibleSiloToken.balanceOf(user.address)).to.eq("0");
        const deposit = await this.silo.getDeposit(
          user.address,
          this.siloToken.address,
          3
        );
        expect(deposit[0]).to.eq("1100");
        expect(deposit[1]).to.eq("1100");
      });

      it("properly updates total assets and supply", async function () {
        expect(await this.fungibleSiloToken.totalAssets()).to.eq("0");
        expect(await this.fungibleSiloToken.totalSupply()).to.eq("0");
      });

      it("emits Withdraw event", async function () {
        await expect(this.result)
          .to.emit(this.fungibleSiloToken, "Withdraw")
          .withArgs(
            user.address,
            user.address,
            user.address,
            "1100",
            "1000000000000000"
          );
      });
    });
    describe("owner redeem half with earn", async function () {
      beforeEach(async function () {
        await this.silo
          .connect(user)
          .approveDeposit(
            this.fungibleSiloToken.address,
            this.siloToken.address,
            "1000000"
          );
        await this.silo
          .connect(user)
          .deposit(this.siloToken.address, "1000", EXTERNAL);
        await this.fungibleSiloToken
          .connect(user)
          .depositWithSeason(2, "1000", user.address);

        await this.season.siloSunrise(100);
        await this.fungibleSiloToken.earn();
        this.result = await this.fungibleSiloToken
          .connect(user)
          .redeem("500000000000000", user.address, user.address);
      });

      it("properly updates the stored amount and season", async function () {
        expect(await this.fungibleSiloToken.depositedSiloSeason()).to.eq(3);
        expect(await this.fungibleSiloToken.depositedSiloAmount()).to.eq("550");
      });

      it("properly updates the user balances", async function () {
        expect(await this.fungibleSiloToken.balanceOf(user.address)).to.eq(
          "500000000000000"
        );
        const deposit = await this.silo.getDeposit(
          user.address,
          this.siloToken.address,
          3
        );
        expect(deposit[0]).to.eq("550");
        expect(deposit[1]).to.eq("550");
      });

      it("properly updates total assets and supply", async function () {
        expect(await this.fungibleSiloToken.totalAssets()).to.eq("550");
        expect(await this.fungibleSiloToken.totalSupply()).to.eq(
          "500000000000000"
        );
      });

      it("emits Withdraw event", async function () {
        await expect(this.result)
          .to.emit(this.fungibleSiloToken, "Withdraw")
          .withArgs(
            user.address,
            user.address,
            user.address,
            "550",
            "500000000000000"
          );
      });
    });
    describe("allowance spender redeem to user", async function () {
      beforeEach(async function () {
        await this.silo
          .connect(user)
          .approveDeposit(
            this.fungibleSiloToken.address,
            this.siloToken.address,
            "1000000"
          );
        await this.silo
          .connect(user)
          .deposit(this.siloToken.address, "1000", EXTERNAL);
        await this.fungibleSiloToken
          .connect(user)
          .depositWithSeason(2, "1000", user.address);

        await this.fungibleSiloToken
          .connect(user)
          .approve(user2.address, "1000000000000000");

        this.result = await this.fungibleSiloToken
          .connect(user2)
          .redeem("1000000000000000", user.address, user.address);
      });

      it("properly updates the stored amount and season", async function () {
        expect(await this.fungibleSiloToken.depositedSiloSeason()).to.eq(2);
        expect(await this.fungibleSiloToken.depositedSiloAmount()).to.eq("0");
      });

      it("properly updates the spender allowance", async function () {
        expect(
          await this.fungibleSiloToken.allowance(user.address, user2.address)
        ).to.eq("0");
      });

      it("properly updates the user balances", async function () {
        expect(await this.fungibleSiloToken.balanceOf(user.address)).to.eq("0");
        const deposit = await this.silo.getDeposit(
          user.address,
          this.siloToken.address,
          2
        );
        expect(deposit[0]).to.eq("1000");
        expect(deposit[1]).to.eq("1000");
      });

      it("properly updates total assets and supply", async function () {
        expect(await this.fungibleSiloToken.totalAssets()).to.eq("0");
        expect(await this.fungibleSiloToken.totalSupply()).to.eq("0");
      });

      it("emits Withdraw event", async function () {
        await expect(this.result)
          .to.emit(this.fungibleSiloToken, "Withdraw")
          .withArgs(
            user2.address,
            user.address,
            user.address,
            "1000",
            "1000000000000000"
          );
      });
    });
  });

  describe("withdraw", function () {
    describe("reverts", function () {
      beforeEach(async function () {
        await this.silo
          .connect(user)
          .approveDeposit(
            this.fungibleSiloToken.address,
            this.siloToken.address,
            "1000000"
          );
        await this.silo
          .connect(user)
          .deposit(this.siloToken.address, "1000", EXTERNAL);
        this.result = await this.fungibleSiloToken
          .connect(user)
          .depositWithSeason(2, "1000", user.address);
      });
      it("reverts if withdraw more than max", async function () {
        await expect(
          this.fungibleSiloToken
            .connect(user)
            .withdraw("1500", user.address, user.address)
        ).to.revertedWith("ERC4626: withdraw more than max");
      });

      it("reverts if spender insufficient allowance", async function () {
        await expect(
          this.fungibleSiloToken
            .connect(user2)
            .withdraw("1000", user2.address, user.address)
        ).to.revertedWith("ERC20: insufficient allowance");
      });
    });

    describe("owner withdraw all", async function () {
      beforeEach(async function () {
        await this.silo
          .connect(user)
          .approveDeposit(
            this.fungibleSiloToken.address,
            this.siloToken.address,
            "1000000"
          );
        await this.silo
          .connect(user)
          .deposit(this.siloToken.address, "1000", EXTERNAL);
        await this.fungibleSiloToken
          .connect(user)
          .depositWithSeason(2, "1000", user.address);

        this.result = await this.fungibleSiloToken
          .connect(user)
          .withdraw("1000", user.address, user.address);
      });

      it("properly updates the stored amount and season", async function () {
        expect(await this.fungibleSiloToken.depositedSiloSeason()).to.eq(2);
        expect(await this.fungibleSiloToken.depositedSiloAmount()).to.eq("0");
      });

      it("properly updates the user balances", async function () {
        expect(await this.fungibleSiloToken.balanceOf(user.address)).to.eq("0");
        const deposit = await this.silo.getDeposit(
          user.address,
          this.siloToken.address,
          2
        );
        expect(deposit[0]).to.eq("1000");
        expect(deposit[1]).to.eq("1000");
      });

      it("properly updates total assets and supply", async function () {
        expect(await this.fungibleSiloToken.totalAssets()).to.eq("0");
        expect(await this.fungibleSiloToken.totalSupply()).to.eq("0");
      });

      it("emits Withdraw event", async function () {
        await expect(this.result)
          .to.emit(this.fungibleSiloToken, "Withdraw")
          .withArgs(
            user.address,
            user.address,
            user.address,
            "1000",
            "1000000000000000"
          );
      });
    });
    describe("owner withdraw half", async function () {
      beforeEach(async function () {
        await this.silo
          .connect(user)
          .approveDeposit(
            this.fungibleSiloToken.address,
            this.siloToken.address,
            "1000000"
          );
        await this.silo
          .connect(user)
          .deposit(this.siloToken.address, "1000", EXTERNAL);
        await this.fungibleSiloToken
          .connect(user)
          .depositWithSeason(2, "1000", user.address);

        this.result = await this.fungibleSiloToken
          .connect(user)
          .withdraw("500", user.address, user.address);
      });

      it("properly updates the stored amount and season", async function () {
        expect(await this.fungibleSiloToken.depositedSiloSeason()).to.eq(2);
        expect(await this.fungibleSiloToken.depositedSiloAmount()).to.eq("500");
      });

      it("properly updates the user balances", async function () {
        expect(await this.fungibleSiloToken.balanceOf(user.address)).to.eq(
          "500000000000000"
        );
        const deposit = await this.silo.getDeposit(
          user.address,
          this.siloToken.address,
          2
        );
        expect(deposit[0]).to.eq("500");
        expect(deposit[1]).to.eq("500");
      });

      it("properly updates total assets and supply", async function () {
        expect(await this.fungibleSiloToken.totalAssets()).to.eq("500");
        expect(await this.fungibleSiloToken.totalSupply()).to.eq(
          "500000000000000"
        );
      });

      it("emits Withdraw event", async function () {
        await expect(this.result)
          .to.emit(this.fungibleSiloToken, "Withdraw")
          .withArgs(
            user.address,
            user.address,
            user.address,
            "500",
            "500000000000000"
          );
      });
    });
    describe("owner withdraw all with earn", async function () {
      beforeEach(async function () {
        await this.silo
          .connect(user)
          .approveDeposit(
            this.fungibleSiloToken.address,
            this.siloToken.address,
            "1000000"
          );
        await this.silo
          .connect(user)
          .deposit(this.siloToken.address, "1000", EXTERNAL);
        await this.fungibleSiloToken
          .connect(user)
          .depositWithSeason(2, "1000", user.address);

        await this.season.siloSunrise(100);
        await this.fungibleSiloToken.earn();
        this.result = await this.fungibleSiloToken
          .connect(user)
          .withdraw("1100", user.address, user.address);
      });

      it("properly updates the stored amount and season", async function () {
        expect(await this.fungibleSiloToken.depositedSiloSeason()).to.eq(3);
        expect(await this.fungibleSiloToken.depositedSiloAmount()).to.eq("0");
      });

      it("properly updates the user balances", async function () {
        expect(await this.fungibleSiloToken.balanceOf(user.address)).to.eq("0");
        const deposit = await this.silo.getDeposit(
          user.address,
          this.siloToken.address,
          3
        );
        expect(deposit[0]).to.eq("1100");
        expect(deposit[1]).to.eq("1100");
      });

      it("properly updates total assets and supply", async function () {
        expect(await this.fungibleSiloToken.totalAssets()).to.eq("0");
        expect(await this.fungibleSiloToken.totalSupply()).to.eq("0");
      });

      it("emits Withdraw event", async function () {
        await expect(this.result)
          .to.emit(this.fungibleSiloToken, "Withdraw")
          .withArgs(
            user.address,
            user.address,
            user.address,
            "1100",
            "1000000000000000"
          );
      });
    });
    describe("owner withdraw half with earn", async function () {
      beforeEach(async function () {
        await this.silo
          .connect(user)
          .approveDeposit(
            this.fungibleSiloToken.address,
            this.siloToken.address,
            "1000000"
          );
        await this.silo
          .connect(user)
          .deposit(this.siloToken.address, "1000", EXTERNAL);
        await this.fungibleSiloToken
          .connect(user)
          .depositWithSeason(2, "1000", user.address);

        await this.season.siloSunrise(100);
        await this.fungibleSiloToken.earn();
        this.result = await this.fungibleSiloToken
          .connect(user)
          .withdraw("550", user.address, user.address);
      });

      it("properly updates the stored amount and season", async function () {
        expect(await this.fungibleSiloToken.depositedSiloSeason()).to.eq(3);
        expect(await this.fungibleSiloToken.depositedSiloAmount()).to.eq("550");
      });

      it("properly updates the user balances", async function () {
        expect(await this.fungibleSiloToken.balanceOf(user.address)).to.eq(
          "500000000000000"
        );
        const deposit = await this.silo.getDeposit(
          user.address,
          this.siloToken.address,
          3
        );
        expect(deposit[0]).to.eq("550");
        expect(deposit[1]).to.eq("550");
      });

      it("properly updates total assets and supply", async function () {
        expect(await this.fungibleSiloToken.totalAssets()).to.eq("550");
        expect(await this.fungibleSiloToken.totalSupply()).to.eq(
          "500000000000000"
        );
      });

      it("emits Withdraw event", async function () {
        await expect(this.result)
          .to.emit(this.fungibleSiloToken, "Withdraw")
          .withArgs(
            user.address,
            user.address,
            user.address,
            "550",
            "500000000000000"
          );
      });
    });
    describe("allowance spender withdraw to user", async function () {
      beforeEach(async function () {
        await this.silo
          .connect(user)
          .approveDeposit(
            this.fungibleSiloToken.address,
            this.siloToken.address,
            "1000000"
          );
        await this.silo
          .connect(user)
          .deposit(this.siloToken.address, "1000", EXTERNAL);
        await this.fungibleSiloToken
          .connect(user)
          .depositWithSeason(2, "1000", user.address);

        await this.fungibleSiloToken
          .connect(user)
          .approve(user2.address, "1000000000000000");

        this.result = await this.fungibleSiloToken
          .connect(user2)
          .withdraw("1000", user.address, user.address);
      });

      it("properly updates the stored amount and season", async function () {
        expect(await this.fungibleSiloToken.depositedSiloSeason()).to.eq(2);
        expect(await this.fungibleSiloToken.depositedSiloAmount()).to.eq("0");
      });

      it("properly updates the spender allowance", async function () {
        expect(
          await this.fungibleSiloToken.allowance(user.address, user2.address)
        ).to.eq("0");
      });

      it("properly updates the user balances", async function () {
        expect(await this.fungibleSiloToken.balanceOf(user.address)).to.eq("0");
        const deposit = await this.silo.getDeposit(
          user.address,
          this.siloToken.address,
          2
        );
        expect(deposit[0]).to.eq("1000");
        expect(deposit[1]).to.eq("1000");
      });

      it("properly updates total assets and supply", async function () {
        expect(await this.fungibleSiloToken.totalAssets()).to.eq("0");
        expect(await this.fungibleSiloToken.totalSupply()).to.eq("0");
      });

      it("emits Withdraw event", async function () {
        await expect(this.result)
          .to.emit(this.fungibleSiloToken, "Withdraw")
          .withArgs(
            user2.address,
            user.address,
            user.address,
            "1000",
            "1000000000000000"
          );
      });
    });
  });

  describe("deposit", function () {
    describe("reverts", function () {
      beforeEach(async function () {
        await this.silo
          .connect(user)
          .deposit(this.siloToken.address, "1000", EXTERNAL);
        await this.season.fastForward(1);
        await this.silo
          .connect(user)
          .deposit(this.siloToken.address, "1000", EXTERNAL);
        await this.season.fastForward(47);
        await this.silo
          .connect(user)
          .deposit(this.siloToken.address, "1000", EXTERNAL);
      });

      it("reverts if deposit is 0", async function () {
        await expect(
          this.fungibleSiloToken.connect(user).deposit("0", user.address)
        ).to.revertedWith("Convert: BDV or amount is 0.");

        await expect(
          this.fungibleSiloToken
            .connect(user)
            .depositWithSeason(2, "0", user.address)
        ).to.revertedWith("Convert: BDV or amount is 0.");

        await expect(
          this.fungibleSiloToken
            .connect(user)
            .depositWithSeasons([2, 2], ["0", "0"], user.address)
        ).to.revertedWith("Convert: BDV or amount is 0.");
      });

      it("reverts if user doesn't have enough allowance", async function () {
        await expect(
          this.fungibleSiloToken.connect(user).deposit("1000", user.address)
        ).to.revertedWith("Silo: insufficient allowance");

        await expect(
          this.fungibleSiloToken
            .connect(user)
            .depositWithSeason(2, "1000", user.address)
        ).to.revertedWith("Silo: insufficient allowance");

        await expect(
          this.fungibleSiloToken
            .connect(user)
            .depositWithSeasons([2, 3], ["1000", "1000"], user.address)
        ).to.revertedWith("Silo: insufficient allowance");
      });

      it("reverts if user balance too low", async function () {
        await this.silo
          .connect(user)
          .approveDeposit(
            this.fungibleSiloToken.address,
            this.siloToken.address,
            "10000"
          );

        await expect(
          this.fungibleSiloToken.connect(user).deposit("1001", user.address)
        ).to.revertedWith("Silo: Crate balance too low.");

        await expect(
          this.fungibleSiloToken
            .connect(user)
            .depositWithSeason(2, "1001", user.address)
        ).to.revertedWith("Silo: Crate balance too low.");

        await expect(
          this.fungibleSiloToken
            .connect(user)
            .depositWithSeasons([2, 3], ["1001", "1001"], user.address)
        ).to.revertedWith("Silo: Crate balance too low.");
      });

      it("reverts if deposit is greater than stored season", async function () {
        await expect(
          this.fungibleSiloToken
            .connect(user)
            .depositWithSeason(51, "1000", user.address)
        ).to.revertedWith(
          "ERC4626: deposit season is greater than allowed season"
        );
      });

      it("reverts if deposits is greater than stored season", async function () {
        await expect(
          this.fungibleSiloToken
            .connect(user)
            .depositWithSeasons([1, 51], [1000, 1000], user.address)
        ).to.revertedWith(
          "ERC4626: deposit season is greater than allowed season"
        );
      });
    });

    describe("deposit with stored season", function () {
      beforeEach(async function () {
        await this.season.fastForward(48);
        await this.silo
          .connect(user)
          .approveDeposit(
            this.fungibleSiloToken.address,
            this.siloToken.address,
            "1000000"
          );
        await this.silo
          .connect(user)
          .deposit(this.siloToken.address, "1000", EXTERNAL);
        this.result = await this.fungibleSiloToken
          .connect(user)
          .deposit("1000", user.address);
      });

      it("properly updates the stored season and amount", async function () {
        expect(await this.fungibleSiloToken.depositedSiloSeason()).to.eq(50);
        expect(await this.fungibleSiloToken.depositedSiloAmount()).to.eq(
          "1000"
        );
      });

      it("properly updates the user shares", async function () {
        expect(await this.fungibleSiloToken.balanceOf(user.address)).to.eq(
          "1000000000000000"
        );
      });

      it("properly updates total assets", async function () {
        expect(await this.fungibleSiloToken.totalAssets()).to.eq("1000");
      });

      it("emits Deposit event", async function () {
        await expect(this.result)
          .to.emit(this.fungibleSiloToken, "Deposit")
          .withArgs(user.address, user.address, "1000", "1000000000000000");
      });
    });
  });

  describe("deposit with season", function () {
    beforeEach(async function () {
      await this.silo
        .connect(user)
        .approveDeposit(
          this.fungibleSiloToken.address,
          this.siloToken.address,
          "1000000"
        );
      await this.silo
        .connect(user)
        .deposit(this.siloToken.address, "1000", EXTERNAL);

      this.result = await this.fungibleSiloToken
        .connect(user)
        .depositWithSeason(2, "1000", user.address);
    });

    it("properly updates the stored season and amount", async function () {
      expect(await this.fungibleSiloToken.depositedSiloSeason()).to.eq(2);
      expect(await this.fungibleSiloToken.depositedSiloAmount()).to.eq("1000");
    });

    it("properly updates the user balance", async function () {
      expect(await this.fungibleSiloToken.balanceOf(user.address)).to.eq(
        "1000000000000000"
      );
    });

    it("properly updates total assets", async function () {
      expect(await this.fungibleSiloToken.totalAssets()).to.eq("1000");
    });

    it("emits Deposit event", async function () {
      await expect(this.result)
        .to.emit(this.fungibleSiloToken, "Deposit")
        .withArgs(user.address, user.address, "1000", "1000000000000000");
    });
  });

  describe("deposit with seasons", function () {
    beforeEach(async function () {
      await this.silo
        .connect(user)
        .approveDeposit(
          this.fungibleSiloToken.address,
          this.siloToken.address,
          "1000000"
        );
      await this.silo
        .connect(user)
        .deposit(this.siloToken.address, "1000", EXTERNAL);

      await this.season.fastForward(25);
      await this.silo
        .connect(user)
        .deposit(this.siloToken.address, "2000", EXTERNAL);

      this.result = await this.fungibleSiloToken
        .connect(user)
        .depositWithSeasons([2, 27], ["1000", "2000"], user.address);
    });

    it("properly updates the stored season and amount", async function () {
      expect(await this.fungibleSiloToken.depositedSiloSeason()).to.eq(19);
      expect(await this.fungibleSiloToken.depositedSiloAmount()).to.eq(3000);
    });

    it("properly updates the user balance", async function () {
      expect(await this.fungibleSiloToken.balanceOf(user.address)).to.eq(
        "3000000000000000"
      );
    });

    it("properly updates total assets", async function () {
      expect(await this.fungibleSiloToken.totalAssets()).to.eq("3000");
    });

    it("emits Deposit event", async function () {
      await expect(this.result)
        .to.emit(this.fungibleSiloToken, "Deposit")
        .withArgs(user.address, user.address, "3000", "3000000000000000");
    });
  });

  describe("multiple users deposit with stored season", async function () {
    beforeEach(async function () {
      await this.silo
        .connect(user)
        .approveDeposit(
          this.fungibleSiloToken.address,
          this.siloToken.address,
          "1000000"
        );

      await this.silo
        .connect(user2)
        .approveDeposit(
          this.fungibleSiloToken.address,
          this.siloToken.address,
          "1000000"
        );
      await this.season.fastForward(48);

      await this.silo
        .connect(user)
        .deposit(this.siloToken.address, "1000", EXTERNAL);

      await this.silo
        .connect(user2)
        .deposit(this.siloToken.address, "2000", EXTERNAL);

      this.result1 = await this.fungibleSiloToken
        .connect(user)
        .deposit("1000", user.address);

      this.result2 = await this.fungibleSiloToken
        .connect(user2)
        .deposit("2000", user2.address);
    });

    it("properly updates the stored season and amount", async function () {
      expect(await this.fungibleSiloToken.depositedSiloSeason()).to.eq(50);
      expect(await this.fungibleSiloToken.depositedSiloAmount()).to.eq(3000);
    });

    it("properly updates the user balance", async function () {
      expect(await this.fungibleSiloToken.balanceOf(user.address)).to.eq(
        "1000000000000000"
      );
      expect(await this.fungibleSiloToken.balanceOf(user2.address)).to.eq(
        "2000000000000000"
      );
    });

    it("properly updates total assets", async function () {
      expect(await this.fungibleSiloToken.totalAssets()).to.eq("3000");
    });

    it("emits Deposit event", async function () {
      await expect(this.result1)
        .to.emit(this.fungibleSiloToken, "Deposit")
        .withArgs(user.address, user.address, "1000", "1000000000000000");

      await expect(this.result2)
        .to.emit(this.fungibleSiloToken, "Deposit")
        .withArgs(user2.address, user2.address, "2000", "2000000000000000");
    });
  });

  describe("multiple users deposit with season", async function () {
    beforeEach(async function () {
      await this.silo
        .connect(user)
        .approveDeposit(
          this.fungibleSiloToken.address,
          this.siloToken.address,
          "1000000"
        );

      await this.silo
        .connect(user2)
        .approveDeposit(
          this.fungibleSiloToken.address,
          this.siloToken.address,
          "1000000"
        );

      await this.silo
        .connect(user)
        .deposit(this.siloToken.address, "1000", EXTERNAL);

      await this.season.fastForward(20);

      await this.silo
        .connect(user2)
        .deposit(this.siloToken.address, "5000", EXTERNAL);

      this.result2 = await this.fungibleSiloToken
        .connect(user2)
        .depositWithSeason(22, "5000", user2.address);

      this.result1 = await this.fungibleSiloToken
        .connect(user)
        .depositWithSeason(2, "1000", user.address);
    });

    it("properly updates the stored season and amount", async function () {
      expect(await this.fungibleSiloToken.depositedSiloSeason()).to.eq(19);
      expect(await this.fungibleSiloToken.depositedSiloAmount()).to.eq(6000);
    });

    it("properly updates the user balance", async function () {
      expect(await this.fungibleSiloToken.balanceOf(user.address)).to.eq(
        "1000000000000000"
      );
      expect(await this.fungibleSiloToken.balanceOf(user2.address)).to.eq(
        "5000000000000000"
      );
    });

    it("properly updates total assets", async function () {
      expect(await this.fungibleSiloToken.totalAssets()).to.eq("6000");
    });

    it("emits Deposit event", async function () {
      await expect(this.result1)
        .to.emit(this.fungibleSiloToken, "Deposit")
        .withArgs(user.address, user.address, "1000", "1000000000000000");

      await expect(this.result2)
        .to.emit(this.fungibleSiloToken, "Deposit")
        .withArgs(user2.address, user2.address, "5000", "5000000000000000");
    });
  });

  describe("multiple users deposit with seasons", async function () {
    beforeEach(async function () {
      await this.silo
        .connect(user)
        .approveDeposit(
          this.fungibleSiloToken.address,
          this.siloToken.address,
          "1000000"
        );

      await this.silo
        .connect(user2)
        .approveDeposit(
          this.fungibleSiloToken.address,
          this.siloToken.address,
          "1000000"
        );

      await this.silo
        .connect(user)
        .deposit(this.siloToken.address, "1000", EXTERNAL);

      await this.silo
        .connect(user2)
        .deposit(this.siloToken.address, "1000", EXTERNAL);

      await this.season.fastForward(5);

      await this.silo
        .connect(user)
        .deposit(this.siloToken.address, "1500", EXTERNAL);

      await this.season.fastForward(25);

      await this.silo
        .connect(user2)
        .deposit(this.siloToken.address, "5000", EXTERNAL);

      this.result2 = await this.fungibleSiloToken
        .connect(user2)
        .depositWithSeasons([2, 32], ["1000", "5000"], user2.address);

      this.result1 = await this.fungibleSiloToken
        .connect(user)
        .depositWithSeasons([2, 7], ["1000", "1500"], user.address);
    });

    it("properly updates the stored season and amount", async function () {
      expect(await this.fungibleSiloToken.depositedSiloSeason()).to.eq(21);
      expect(await this.fungibleSiloToken.depositedSiloAmount()).to.eq(8500);
    });

    it("properly updates the user balance", async function () {
      expect(await this.fungibleSiloToken.balanceOf(user.address)).to.eq(
        "2500000000000000"
      );
      expect(await this.fungibleSiloToken.balanceOf(user2.address)).to.eq(
        "6000000000000000"
      );
    });

    it("properly updates total assets", async function () {
      expect(await this.fungibleSiloToken.totalAssets()).to.eq("8500");
    });

    it("emits Deposit event", async function () {
      await expect(this.result1)
        .to.emit(this.fungibleSiloToken, "Deposit")
        .withArgs(user.address, user.address, "2500", "2500000000000000");

      await expect(this.result2)
        .to.emit(this.fungibleSiloToken, "Deposit")
        .withArgs(user2.address, user2.address, "6000", "6000000000000000");
    });
  });

  describe("2 single deposit with same season", async function () {
    beforeEach(async function () {
      await this.silo
        .connect(user)
        .approveDeposit(
          this.fungibleSiloToken.address,
          this.siloToken.address,
          "1000000"
        );

      await this.silo
        .connect(user)
        .deposit(this.siloToken.address, "2000", EXTERNAL);

      this.result1 = await this.fungibleSiloToken
        .connect(user)
        .depositWithSeason(2, "1000", user.address);
      this.result2 = await this.fungibleSiloToken
        .connect(user)
        .depositWithSeason(2, "1000", user.address);
    });

    it("properly updates the stored season and amount", async function () {
      expect(await this.fungibleSiloToken.depositedSiloSeason()).to.eq(2);
      expect(await this.fungibleSiloToken.depositedSiloAmount()).to.eq(2000);
    });

    it("properly updates the user balance", async function () {
      expect(await this.fungibleSiloToken.balanceOf(user.address)).to.eq(
        "2000000000000000"
      );
    });

    it("properly updates total assets", async function () {
      expect(await this.fungibleSiloToken.totalAssets()).to.eq("2000");
    });

    it("emits Deposit event", async function () {
      await expect(this.result1)
        .to.emit(this.fungibleSiloToken, "Deposit")
        .withArgs(user.address, user.address, "1000", "1000000000000000");

      await expect(this.result2)
        .to.emit(this.fungibleSiloToken, "Deposit")
        .withArgs(user.address, user.address, "1000", "1000000000000000");
    });
  });

  describe("deposits with same season", async function () {
    beforeEach(async function () {
      await this.silo
        .connect(user)
        .approveDeposit(
          this.fungibleSiloToken.address,
          this.siloToken.address,
          "1000000"
        );

      await this.silo
        .connect(user)
        .deposit(this.siloToken.address, "2000", EXTERNAL);

      this.result = await this.fungibleSiloToken
        .connect(user)
        .depositWithSeasons([2, 2], ["1000", "1000"], user.address);
    });

    it("properly updates the stored season and amount", async function () {
      expect(await this.fungibleSiloToken.depositedSiloSeason()).to.eq(2);
      expect(await this.fungibleSiloToken.depositedSiloAmount()).to.eq(2000);
    });

    it("properly updates the user balance", async function () {
      expect(await this.fungibleSiloToken.balanceOf(user.address)).to.eq(
        "2000000000000000"
      );
    });

    it("properly updates total assets", async function () {
      expect(await this.fungibleSiloToken.totalAssets()).to.eq("2000");
    });

    it("emits Deposit event", async function () {
      await expect(this.result)
        .to.emit(this.fungibleSiloToken, "Deposit")
        .withArgs(user.address, user.address, "2000", "2000000000000000");
    });
  });

  describe("deposits with earn in between", async function () {
    beforeEach(async function () {
      await this.silo
        .connect(user)
        .approveDeposit(
          this.fungibleSiloToken.address,
          this.siloToken.address,
          "1000000"
        );
      await this.silo
        .connect(user)
        .deposit(this.siloToken.address, "1000", EXTERNAL);

      await this.season.fastForward(10);

      await this.silo
        .connect(user)
        .deposit(this.siloToken.address, "1000", EXTERNAL);

      this.result = await this.fungibleSiloToken
        .connect(user)
        .depositWithSeason(12, "1000", user.address);

      await this.season.siloSunrise(25);
      await this.fungibleSiloToken.connect(user).earn();
      this.result = await this.fungibleSiloToken
        .connect(user)
        .depositWithSeason(2, "1000", user.address);
    });

    it("properly updates the stored season and amount", async function () {
      expect(await this.fungibleSiloToken.depositedSiloSeason()).to.eq(8);
      expect(await this.fungibleSiloToken.depositedSiloAmount()).to.eq(2012);
    });

    it("properly updates the user balance", async function () {
      expect(await this.fungibleSiloToken.balanceOf(user.address)).to.eq(
        "1988142292490118"
      );
    });

    it("properly updates total assets", async function () {
      expect(await this.fungibleSiloToken.totalAssets()).to.eq("2012");
    });

    it("check previews", async function () {
      expect(
        await this.fungibleSiloToken.previewRedeem("1988142292490118")
      ).to.eq("2012");
      expect(await this.fungibleSiloToken.previewWithdraw("2012")).to.eq(
        "1988142292490118"
      );
    });
  });
});
