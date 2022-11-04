const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const {
  readPrune,
  toBN,
  signSiloDepositTokenPermit,
  signSiloDepositTokensPermit,
  signTokenPermit,
} = require("../utils");
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
  STABLE_FACTORY,
  ZERO_ADDRESS,
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

describe("Root", function () {
  before(async function () {
    pru = await readPrune();
    [owner, user, user2, user3] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    user3Address = user3.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.season = await ethers.getContractAt(
      "MockSeasonFacet",
      this.diamond.address
    );
    this.tokenFacet = await ethers.getContractAt(
      "TokenFacet",
      this.diamond.address
    );

    this.silo = await ethers.getContractAt(
      "MockSiloFacet",
      this.diamond.address
    );

    this.tokenFacet = await ethers.getContractAt(
      "TokenFacet",
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

    const RootToken = await ethers.getContractFactory("Root", {
      signer: owner,
    });
    this.rootToken = await upgrades.deployProxy(RootToken, ["Root", "ROOT"], {
      initializer: "initialize",
    });
    await this.siloToken.deployed();

    await this.season.siloSunrise(0);
    await this.siloToken
      .connect(user)
      .approve(this.silo.address, to6("100000000000"));
    await this.siloToken
      .connect(user2)
      .approve(this.silo.address, to6("100000000000"));
    await this.siloToken
      .connect(user3)
      .approve(this.silo.address, to6("100000000000"));
    await this.siloToken.mint(userAddress, to6("10000"));
    await this.siloToken.mint(user2Address, to6("10000"));
    await this.siloToken.mint(user3Address, to6("10000"));
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
        await this.rootToken.connect(user).BEANSTALK_ADDRESS()
      ).to.be.equal(this.diamond.address);

      expect(await this.rootToken.connect(user).name()).to.be.equal("Root");

      expect(await this.rootToken.connect(user).symbol()).to.be.equal("ROOT");
    });
  });

  describe("ownership", function () {
    describe("renounce", async function () {
      describe("reverts", async function () {
        it("reverts if not owner try to renounce", async function () {
          await expect(
            this.rootToken.connect(user).renounceOwnership()
          ).to.revertedWith("Ownable: caller is not the owner");
        });
        it("reverts if owner try to renounce", async function () {
          await expect(
            this.rootToken.connect(owner).renounceOwnership()
          ).to.revertedWith("Ownable: Can't renounceOwnership here");
        });
      });
    });

    describe("transfer", async function () {
      describe("reverts", async function () {
        it("reverts if not owner", async function () {
          await expect(
            this.rootToken.connect(user).transferOwnership(user.address)
          ).to.revertedWith("Ownable: caller is not the owner");
        });

        it("reverts if transfer ownership to a zero address", async function () {
          await expect(
            this.rootToken.connect(owner).transferOwnership(ZERO_ADDRESS)
          ).to.revertedWith("Ownable: Non-zero owner address required");
        });
      });

      describe("transfers owner", async function () {
        beforeEach(async function () {
          await this.rootToken.connect(owner).transferOwnership(user.address);
        });

        it("property update ownerCandidate", async function () {
          expect(await this.rootToken.ownerCandidate()).to.be.eq(user.address);
        });
      });
    });

    describe("claim", async function () {
      describe("reverts", async function () {
        it("reverts if not a candidate", async function () {
          await expect(
            this.rootToken.connect(user).claimOwnership()
          ).to.revertedWith(
            "Ownable: sender must be ownerCandidate to accept ownership"
          );
        });
      });

      describe("claims ownership", async function () {
        beforeEach(async function () {
          await this.rootToken.connect(owner).transferOwnership(user.address);
          await this.rootToken.connect(user).claimOwnership();
        });
        it("property update ownership", async function () {
          expect(await this.rootToken.owner()).to.be.eq(user.address);
        });
        it("property update ownerCandidate", async function () {
          expect(await this.rootToken.ownerCandidate()).to.be.eq(ZERO_ADDRESS);
        });
      });
    });
  });

  describe("whitelist", async function () {
    describe("reverts", async function () {
      it("reverts if non-owner add token", async function () {
        await expect(
          this.rootToken.connect(user).addWhitelistToken(this.siloToken.address)
        ).to.revertedWith("Ownable: caller is not the owner");
      });

      it("reverts if adding zero address token", async function () {
        await expect(
          this.rootToken.connect(owner).addWhitelistToken(ZERO_ADDRESS)
        ).to.revertedWith("Non-zero token address required");
      });

      it("reverts if removing zero address token", async function () {
        await expect(
          this.rootToken.connect(owner).removeWhitelistToken(ZERO_ADDRESS)
        ).to.revertedWith("Non-zero token address required");
      });

      it("reverts if non-owner remove token", async function () {
        await expect(
          this.rootToken
            .connect(user)
            .removeWhitelistToken(this.siloToken.address)
        ).to.revertedWith("Ownable: caller is not the owner");
      });
    });
    describe("add token", async function () {
      beforeEach(async function () {
        this.result = await this.rootToken
          .connect(owner)
          .addWhitelistToken(this.siloToken.address);
      });

      it("property add token to whitelist", async function () {
        expect(
          await this.rootToken.connect(user).whitelisted(this.siloToken.address)
        ).to.be.eq(true);
      });

      it("emits AddWhitelistToken event", async function () {
        await expect(this.result)
          .to.emit(this.rootToken, "AddWhitelistToken")
          .withArgs(this.siloToken.address);
      });
    });

    describe("remove token", async function () {
      beforeEach(async function () {
        await this.rootToken
          .connect(owner)
          .addWhitelistToken(this.siloToken.address);

        this.result = await this.rootToken
          .connect(owner)
          .removeWhitelistToken(this.siloToken.address);
      });

      it("property remove token from whitelist", async function () {
        expect(
          await this.rootToken.connect(user).whitelisted(this.siloToken.address)
        ).to.be.equal(false);
      });

      it("emits RemoveWhitelistToken event", async function () {
        await expect(this.result)
          .to.emit(this.rootToken, "RemoveWhitelistToken")
          .withArgs(this.siloToken.address);
      });
    });
  });

  describe("earn", async function () {
    beforeEach(async function () {
      await this.silo
        .connect(user)
        .approveDeposit(
          this.rootToken.address,
          this.siloToken.address,
          "1000000"
        );

      await this.rootToken
        .connect(owner)
        .addWhitelistToken(this.siloToken.address);

      await this.silo
        .connect(user)
        .deposit(this.siloToken.address, "1000", EXTERNAL);

      this.result = await this.rootToken.connect(user).mint(
        [
          {
            token: this.siloToken.address,
            seasons: ["2"],
            amounts: ["1000"],
          },
        ],
        EXTERNAL,
        1
      );

      await this.season.fastForward(48);
      await this.season.siloSunrise(100);

      await this.rootToken.connect(user).earn();
    });

    it("properly updates underlyingBdv", async function () {
      expect(await this.rootToken.underlyingBdv()).to.eq("1100");
    });

    it("properly updates balances", async function () {
      const deposit = await this.silo.getDeposit(
        this.rootToken.address,
        this.siloToken.address,
        51
      );
      expect(deposit[0]).to.eq("100");
      expect(deposit[1]).to.eq("100");
    });
  });

  describe("borrow loan", async function () {
    describe("reverts", async function () {
      it("reverts if non-owner borrow loan", async function () {
        await expect(
          this.rootToken.connect(user).borrowLoan(1000)
        ).to.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("simple borrow", async function () {
      beforeEach(async function () {
        await this.rootToken.connect(owner).borrowLoan(1000);
      });
      it("properly updates outstandingLoanBalance", async function () {
        expect(await this.rootToken.outstandingLoanBalance()).to.eq("1000");
      });
      it("properly updates totalSupply", async function () {
        expect(await this.rootToken.totalSupply()).to.eq("1000");
      });
      it("properly updates totalSupplyMinusOutstandingLoanBalance", async function () {
        expect(
          await this.rootToken.totalSupplyMinusOutstandingLoanBalance()
        ).to.eq("0");
      });
      it("properly updates borrower balance", async function () {
        expect(await this.rootToken.balanceOf(owner.address)).to.eq("1000");
      });
    });

    describe("borrow loan with existings ROOT", async function () {
      beforeEach(async function () {
        await this.silo
          .connect(user)
          .approveDeposit(
            this.rootToken.address,
            this.siloToken.address,
            "1000000"
          );

        await this.rootToken
          .connect(owner)
          .addWhitelistToken(this.siloToken.address);

        await this.silo
          .connect(user)
          .deposit(this.siloToken.address, "1000", EXTERNAL);

        this.result = await this.rootToken.connect(user).mint(
          [
            {
              token: this.siloToken.address,
              seasons: ["2"],
              amounts: ["1000"],
            },
          ],
          EXTERNAL,
          1
        );

        await this.rootToken.connect(owner).borrowLoan(1000);
      });
      it("properly updates outstandingLoanBalance", async function () {
        expect(await this.rootToken.outstandingLoanBalance()).to.eq("1000");
      });
      it("properly updates totalSupply", async function () {
        expect(await this.rootToken.totalSupply()).to.eq("10001000");
      });
      it("properly updates totalSupplyMinusOutstandingLoanBalance", async function () {
        expect(
          await this.rootToken.totalSupplyMinusOutstandingLoanBalance()
        ).to.eq("10000000");
      });
      it("properly updates borrower balance", async function () {
        expect(await this.rootToken.balanceOf(owner.address)).to.eq("1000");
      });
    });
  });

  describe("repay loan", async function () {
    describe("reverts", async function () {
      it("reverts if non-owner repay loan", async function () {
        await expect(
          this.rootToken.connect(user).repayLoan(1000)
        ).to.revertedWith("Ownable: caller is not the owner");
      });
      it("reverts if repay more than owe", async function () {
        await expect(
          this.rootToken.connect(user).repayLoan(1000)
        ).to.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("simple repay in full", async function () {
      beforeEach(async function () {
        await this.rootToken.connect(owner).borrowLoan(1000);
        await this.rootToken.connect(owner).repayLoan(1000);
      });
      it("properly updates outstandingLoanBalance", async function () {
        expect(await this.rootToken.outstandingLoanBalance()).to.eq("0");
      });
      it("properly updates totalSupply", async function () {
        expect(await this.rootToken.totalSupply()).to.eq("0");
      });
      it("properly updates totalSupplyMinusOutstandingLoanBalance", async function () {
        expect(
          await this.rootToken.totalSupplyMinusOutstandingLoanBalance()
        ).to.eq("0");
      });
      it("properly updates borrower balance", async function () {
        expect(await this.rootToken.balanceOf(owner.address)).to.eq("0");
      });
    });

    describe("simple repay 1/2", async function () {
      beforeEach(async function () {
        await this.rootToken.connect(owner).borrowLoan(1000);
        await this.rootToken.connect(owner).repayLoan(500);
      });
      it("properly updates outstandingLoanBalance", async function () {
        expect(await this.rootToken.outstandingLoanBalance()).to.eq("500");
      });
      it("properly updates totalSupply", async function () {
        expect(await this.rootToken.totalSupply()).to.eq("500");
      });
      it("properly updates totalSupplyMinusOutstandingLoanBalance", async function () {
        expect(
          await this.rootToken.totalSupplyMinusOutstandingLoanBalance()
        ).to.eq("0");
      });
      it("properly updates borrower balance", async function () {
        expect(await this.rootToken.balanceOf(owner.address)).to.eq("500");
      });
    });

    describe("repay 1/2 loan with existings ROOT", async function () {
      beforeEach(async function () {
        await this.silo
          .connect(user)
          .approveDeposit(
            this.rootToken.address,
            this.siloToken.address,
            "1000000"
          );

        await this.rootToken
          .connect(owner)
          .addWhitelistToken(this.siloToken.address);

        await this.silo
          .connect(user)
          .deposit(this.siloToken.address, "1000", EXTERNAL);

        this.result = await this.rootToken.connect(user).mint(
          [
            {
              token: this.siloToken.address,
              seasons: ["2"],
              amounts: ["1000"],
            },
          ],
          EXTERNAL,
          1
        );

        await this.rootToken.connect(owner).borrowLoan(1000);
        await this.rootToken.connect(owner).repayLoan(500);
      });
      it("properly updates outstandingLoanBalance", async function () {
        expect(await this.rootToken.outstandingLoanBalance()).to.eq("500");
      });
      it("properly updates totalSupply", async function () {
        expect(await this.rootToken.totalSupply()).to.eq("10000500");
      });
      it("properly updates totalSupplyMinusOutstandingLoanBalance", async function () {
        expect(
          await this.rootToken.totalSupplyMinusOutstandingLoanBalance()
        ).to.eq("10000000");
      });
      it("properly updates borrower balance", async function () {
        expect(await this.rootToken.balanceOf(owner.address)).to.eq("500");
      });
    });

    describe("repay loan in full with existings ROOT", async function () {
      beforeEach(async function () {
        await this.silo
          .connect(user)
          .approveDeposit(
            this.rootToken.address,
            this.siloToken.address,
            "1000000"
          );

        await this.rootToken
          .connect(owner)
          .addWhitelistToken(this.siloToken.address);

        await this.silo
          .connect(user)
          .deposit(this.siloToken.address, "1000", EXTERNAL);

        this.result = await this.rootToken.connect(user).mint(
          [
            {
              token: this.siloToken.address,
              seasons: ["2"],
              amounts: ["1000"],
            },
          ],
          EXTERNAL,
          1
        );

        await this.rootToken.connect(owner).borrowLoan(1000);
        await this.rootToken.connect(owner).repayLoan(1000);
      });
      it("properly updates outstandingLoanBalance", async function () {
        expect(await this.rootToken.outstandingLoanBalance()).to.eq("0");
      });
      it("properly updates totalSupply", async function () {
        expect(await this.rootToken.totalSupply()).to.eq("10000000");
      });
      it("properly updates totalSupplyMinusOutstandingLoanBalance", async function () {
        expect(
          await this.rootToken.totalSupplyMinusOutstandingLoanBalance()
        ).to.eq("10000000");
      });
      it("properly updates borrower balance", async function () {
        expect(await this.rootToken.balanceOf(owner.address)).to.eq("0");
      });
    });
  });

  describe("updateBdv", async function () {
    beforeEach(async function () {
      await this.silo
        .connect(user)
        .approveDeposit(
          this.rootToken.address,
          this.siloToken.address,
          "1000000"
        );

      await this.rootToken
        .connect(owner)
        .addWhitelistToken(this.siloToken.address);

      await this.silo
        .connect(user)
        .deposit(this.siloToken.address, "1000", EXTERNAL);

      this.result = await this.rootToken.connect(user).mint(
        [
          {
            token: this.siloToken.address,
            seasons: ["2"],
            amounts: ["1000"],
          },
        ],
        EXTERNAL,
        1
      );

      await this.season.fastForward(48);
      await this.season.siloSunrise(100);
    });

    describe("reverts", async function () {
      it("reverts if token is a zero address", async function () {
        await expect(
          this.rootToken.updateBdv(ZERO_ADDRESS, 22)
        ).to.revertedWith("Bdv: Non-zero token address required");
      });
      it("reverts if convert non-deposited season", async function () {
        await expect(
          this.rootToken.updateBdv(this.siloToken.address, 22)
        ).to.revertedWith("Convert: BDV or amount is 0.");
      });
    });

    describe("single convert p = 1", async function () {
      it("properly updates underlyingBdv", async function () {
        await this.rootToken.updateBdv(this.siloToken.address, 2);
        expect(await this.rootToken.underlyingBdv()).to.eq("1000");
      });
    });

    describe("single convert", async function () {
      it("properly updates underlyingBdv", async function () {
        await this.silo.mockWhitelistToken(
          this.siloToken.address,
          this.silo.interface.getSighash("mockBDVIncrease(uint256 amount)"),
          "10000",
          "1"
        );
        await this.rootToken.updateBdv(this.siloToken.address, 2);
        expect(await this.rootToken.underlyingBdv()).to.eq("1500");
      });
    });

    describe("multiple convert", async function () {
      it("properly updates underlyingBdv", async function () {
        await this.silo.mockWhitelistToken(
          this.siloToken.address,
          this.silo.interface.getSighash("mockBDVIncrease(uint256 amount)"),
          "10000",
          "1"
        );
        await this.silo
          .connect(user)
          .deposit(this.siloToken.address, "1000", EXTERNAL);

        this.result = await this.rootToken.connect(user).mint(
          [
            {
              token: this.siloToken.address,
              seasons: ["51"],
              amounts: ["1000"],
            },
          ],
          EXTERNAL,
          1
        );
        await this.rootToken.updateBdvs([this.siloToken.address], [2, 51]);
        expect(await this.rootToken.underlyingBdv()).to.eq("3000");
      });
    });
  });

  describe("redeem", async function () {
    describe("redeem", async function () {
      describe("reverts", async function () {
        beforeEach(async function () {
          await this.silo
            .connect(user)
            .deposit(this.siloToken.address, "1000", EXTERNAL);
        });
        it("reverts if token is not whitelisted", async function () {
          await expect(
            this.rootToken.connect(user).redeem(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              1000000000
            )
          ).to.revertedWith("Token is not whitelisted");
        });

        it("reverts if contract does not have enough deposit to redeem", async function () {
          await this.rootToken
            .connect(owner)
            .addWhitelistToken(this.siloToken.address);

          const nonce = await this.silo
            .connect(user)
            .depositPermitNonces(userAddress);
          this.signature = await signSiloDepositTokenPermit(
            user,
            userAddress,
            this.rootToken.address,
            this.siloToken.address,
            "1000",
            nonce
          );

          await this.rootToken.connect(user).mintWithTokenPermit(
            [
              {
                token: this.siloToken.address,
                seasons: ["2"],
                amounts: ["1000"],
              },
            ],
            EXTERNAL,
            1,
            this.signature.token,
            this.signature.value,
            this.signature.deadline,
            this.signature.split.v,
            this.signature.split.r,
            this.signature.split.s
          );

          await expect(
            this.rootToken.connect(user2).redeem(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["2000"],
                },
              ],
              EXTERNAL,
              1000000000
            )
          ).to.revertedWith("Silo: Crate balance too low.");
        });

        it("reverts if user does not have sufficient balance", async function () {
          await this.rootToken
            .connect(owner)
            .addWhitelistToken(this.siloToken.address);

          const nonce = await this.silo
            .connect(user)
            .depositPermitNonces(userAddress);
          this.signature = await signSiloDepositTokenPermit(
            user,
            userAddress,
            this.rootToken.address,
            this.siloToken.address,
            "1000",
            nonce
          );

          await this.rootToken.connect(user).mintWithTokenPermit(
            [
              {
                token: this.siloToken.address,
                seasons: ["2"],
                amounts: ["1000"],
              },
            ],
            EXTERNAL,
            1,
            this.signature.token,
            this.signature.value,
            this.signature.deadline,
            this.signature.split.v,
            this.signature.split.r,
            this.signature.split.s
          );

          await expect(
            this.rootToken.connect(user2).redeem(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              1000000000
            )
          ).to.revertedWith("ERC20: burn amount exceeds balance");
        });

        it("reverts if user does not have sufficient balance in farm balance", async function () {
          await this.rootToken
            .connect(owner)
            .addWhitelistToken(this.siloToken.address);

          const nonce = await this.silo
            .connect(user)
            .depositPermitNonces(userAddress);
          this.signature = await signSiloDepositTokenPermit(
            user,
            userAddress,
            this.rootToken.address,
            this.siloToken.address,
            "1000",
            nonce
          );

          await this.rootToken.connect(user).mintWithTokenPermit(
            [
              {
                token: this.siloToken.address,
                seasons: ["2"],
                amounts: ["1000"],
              },
            ],
            EXTERNAL,
            1,
            this.signature.token,
            this.signature.value,
            this.signature.deadline,
            this.signature.split.v,
            this.signature.split.r,
            this.signature.split.s
          );

          await expect(
            this.rootToken.connect(user2).redeem(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              INTERNAL,
              1000000000
            )
          ).to.revertedWith("Balance: Insufficient internal balance");
        });

        it("reverts if user does not have sufficient balance in farm balance tolerant", async function () {
          await this.rootToken
            .connect(owner)
            .addWhitelistToken(this.siloToken.address);

          const nonce = await this.silo
            .connect(user)
            .depositPermitNonces(userAddress);
          this.signature = await signSiloDepositTokenPermit(
            user,
            userAddress,
            this.rootToken.address,
            this.siloToken.address,
            "1000",
            nonce
          );

          await this.rootToken.connect(user).mintWithTokenPermit(
            [
              {
                token: this.siloToken.address,
                seasons: ["2"],
                amounts: ["1000"],
              },
            ],
            EXTERNAL,
            1,
            this.signature.token,
            this.signature.value,
            this.signature.deadline,
            this.signature.split.v,
            this.signature.split.r,
            this.signature.split.s
          );

          await expect(
            this.rootToken.connect(user2).redeem(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              INTERNAL_TOLERANT,
              1000000000
            )
          ).to.revertedWith("ERC20: burn amount exceeds balance");
        });

        it("reverts if user does not have sufficient allowance for root contract", async function () {
          await this.rootToken
            .connect(owner)
            .addWhitelistToken(this.siloToken.address);

          const nonce = await this.silo
            .connect(user)
            .depositPermitNonces(userAddress);
          this.signature = await signSiloDepositTokenPermit(
            user,
            userAddress,
            this.rootToken.address,
            this.siloToken.address,
            "1000",
            nonce
          );

          await this.rootToken.connect(user).mintWithTokenPermit(
            [
              {
                token: this.siloToken.address,
                seasons: ["2"],
                amounts: ["1000"],
              },
            ],
            INTERNAL,
            1,
            this.signature.token,
            this.signature.value,
            this.signature.deadline,
            this.signature.split.v,
            this.signature.split.r,
            this.signature.split.s
          );

          await expect(
            this.rootToken.connect(user2).redeem(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              INTERNAL_EXTERNAL,
              1000000000
            )
          ).to.revertedWith("ERC20: insufficient allowance");
        });

        it("reverts if amounts is empty", async function () {
          await this.rootToken
            .connect(owner)
            .addWhitelistToken(this.siloToken.address);

          await expect(
            this.rootToken.connect(user).redeem(
              [
                {
                  token: this.siloToken.address,
                  seasons: [],
                  amounts: [],
                },
              ],
              EXTERNAL,
              1000000000
            )
          ).to.revertedWith("Silo: amounts array is empty");
        });

        it("reverts if redeem shares greater than maxRootsIn", async function () {
          await this.rootToken
            .connect(owner)
            .addWhitelistToken(this.siloToken.address);

          const nonce = await this.silo
            .connect(user)
            .depositPermitNonces(userAddress);
          this.signature = await signSiloDepositTokenPermit(
            user,
            userAddress,
            this.rootToken.address,
            this.siloToken.address,
            "1000",
            nonce
          );

          await this.rootToken.connect(user).mintWithTokenPermit(
            [
              {
                token: this.siloToken.address,
                seasons: ["2"],
                amounts: ["1000"],
              },
            ],
            EXTERNAL,
            1,
            this.signature.token,
            this.signature.value,
            this.signature.deadline,
            this.signature.split.v,
            this.signature.split.r,
            this.signature.split.s
          );

          await expect(
            this.rootToken.connect(user).redeem(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              9000000
            )
          ).to.revertedWith("Redeem: shares is greater than maxRootsIn");
        });
      });

      describe("start redeem", async function () {
        beforeEach(async function () {
          await this.rootToken
            .connect(owner)
            .addWhitelistToken(this.siloToken.address);

          const nonce = await this.silo
            .connect(user)
            .depositPermitNonces(userAddress);

          this.signature = await signSiloDepositTokenPermit(
            user,
            userAddress,
            this.rootToken.address,
            this.siloToken.address,
            "50000",
            nonce
          );
          const nonce2 = await this.silo
            .connect(user2)
            .depositPermitNonces(user2Address);
          this.signature2 = await signSiloDepositTokenPermit(
            user2,
            user2Address,
            this.rootToken.address,
            this.siloToken.address,
            "50000",
            nonce2
          );
          const nonce3 = await this.silo
            .connect(user3)
            .depositPermitNonces(user3Address);
          this.signature3 = await signSiloDepositTokenPermit(
            user3,
            user3Address,
            this.rootToken.address,
            this.siloToken.address,
            "50000",
            nonce3
          );
        });

        describe("empty redeem no existings deposit", async function () {
          beforeEach(async function () {
            this.result = await this.rootToken
              .connect(user)
              .redeem([], EXTERNAL, 1000000000);
          });

          it("properly updates the root total balances", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("0");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("0");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("0");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("0");
          });

          it("properly updates the user balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("0");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq("0");
            expect(await this.rootToken.balanceOf(userAddress)).to.eq("0");
          });

          it("emits Redeem event", async function () {
            await expect(this.result)
              .to.emit(this.rootToken, "Redeem")
              .withArgs(user.address, [], "0", "0", "0", "0");
          });
        });

        describe("redeem original deposit in same season and burn token from internal balance", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.rootToken.connect(user).mintWithTokenPermit(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              INTERNAL,
              1,
              this.signature.token,
              this.signature.value,
              this.signature.deadline,
              this.signature.split.v,
              this.signature.split.r,
              this.signature.split.s
            );

            await this.tokenFacet
              .connect(user)
              .approveToken(
                this.rootToken.address,
                this.rootToken.address,
                "10000000"
              );

            await this.rootToken.connect(user).redeem(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              INTERNAL,
              1000000000
            );
          });

          it("properly updates the total balances", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("0");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("0");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("0");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("0");
          });

          it("properly updates the user balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("1000");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq(
              "10000000"
            );
            expect(
              await this.tokenFacet.getInternalBalance(
                userAddress,
                this.rootToken.address
              )
            ).to.eq("0");
          });
        });

        describe("redeem original deposit in same season and burn token from internal balance with permit", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.rootToken.connect(user).mintWithTokenPermit(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              INTERNAL,
              1,
              this.signature.token,
              this.signature.value,
              this.signature.deadline,
              this.signature.split.v,
              this.signature.split.r,
              this.signature.split.s
            );

            const nonce = await this.tokenFacet
              .connect(user)
              .tokenPermitNonces(userAddress);

            const sig = await signTokenPermit(
              user,
              userAddress,
              this.rootToken.address,
              this.rootToken.address,
              "10000000",
              nonce
            );

            await this.rootToken.connect(user).redeemWithFarmBalancePermit(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              INTERNAL,
              1000000000,
              sig.token,
              sig.value,
              sig.deadline,
              sig.split.v,
              sig.split.r,
              sig.split.s
            );
          });

          it("properly updates the total balances", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("0");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("0");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("0");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("0");
          });

          it("properly updates the user balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("1000");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq(
              "10000000"
            );
            expect(
              await this.tokenFacet.getInternalBalance(
                userAddress,
                this.rootToken.address
              )
            ).to.eq("0");
          });
        });

        describe("redeem original deposit in same season", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.rootToken.connect(user).mintWithTokenPermit(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              1,
              this.signature.token,
              this.signature.value,
              this.signature.deadline,
              this.signature.split.v,
              this.signature.split.r,
              this.signature.split.s
            );

            await this.rootToken.connect(user).redeem(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              1000000000
            );
          });

          it("properly updates the total balances", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("0");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("0");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("0");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("0");
          });

          it("properly updates the user balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("1000");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq(
              "10000000"
            );
            expect(await this.rootToken.balanceOf(userAddress)).to.eq("0");
          });
        });

        describe("redeem original deposit at later season", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.rootToken.connect(user).mintWithTokenPermit(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              1,
              this.signature.token,
              this.signature.value,
              this.signature.deadline,
              this.signature.split.v,
              this.signature.split.r,
              this.signature.split.s
            );

            await this.season.fastForward(10);

            await this.rootToken.connect(user).redeem(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              1000000000
            );
          });

          it("properly updates the total balances", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("0");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("0");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("0");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("0");
          });

          it("properly updates the user balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("1000");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq(
              "10010000"
            );
            expect(await this.rootToken.balanceOf(userAddress)).to.eq("0");
          });
        });

        describe("2 mints earliest first redeem earliest all", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.rootToken.connect(user).mintWithTokenPermit(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              1,
              this.signature.token,
              this.signature.value,
              this.signature.deadline,
              this.signature.split.v,
              this.signature.split.r,
              this.signature.split.s
            );

            await this.season.fastForward(100);

            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.rootToken.connect(user).mint(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["102"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              1
            );

            await this.rootToken.connect(user).redeem(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              1000000000
            );
          });

          it("properly updates the total balances", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("1000");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("10000000");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("9950495");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("1000");
          });

          it("properly updates the user balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("1000");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq(
              "10100000"
            );
            expect(await this.rootToken.balanceOf(userAddress)).to.eq(
              "9950495"
            );
          });
        });

        describe("2 mints earliest first redeem all", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.rootToken.connect(user).mintWithTokenPermit(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              1,
              this.signature.token,
              this.signature.value,
              this.signature.deadline,
              this.signature.split.v,
              this.signature.split.r,
              this.signature.split.s
            );

            await this.season.fastForward(100);

            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.rootToken.connect(user).mint(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["102"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              1
            );

            await this.rootToken.connect(user).redeem(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2", "102"],
                  amounts: ["1000", "1000"],
                },
              ],
              EXTERNAL,
              1000000000
            );
          });

          it("properly updates the total balances", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("0");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("0");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("0");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("0");
          });

          it("properly updates the user balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("2000");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq(
              "20100000"
            );
            expect(await this.rootToken.balanceOf(userAddress)).to.eq("0");
          });
        });

        describe("2 mints earliest last redeem earliest all", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.season.fastForward(100);
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.rootToken.connect(user).mintWithTokenPermit(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["102"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              1,
              this.signature.token,
              this.signature.value,
              this.signature.deadline,
              this.signature.split.v,
              this.signature.split.r,
              this.signature.split.s
            );

            await this.rootToken.connect(user).mint(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              1
            );

            await this.rootToken.connect(user).redeem(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              1000000000
            );
          });

          it("properly updates the total balances", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("1000");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("10000000");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("10000000");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("1000");
          });

          it("properly updates the user balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("1000");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq(
              "10100000"
            );
            expect(await this.rootToken.balanceOf(userAddress)).to.eq(
              "10000000"
            );
          });
        });

        describe("2 mints earliest last redeem all", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.season.fastForward(100);

            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);
            await this.rootToken.connect(user).mintWithTokenPermit(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["102"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              1,
              this.signature.token,
              this.signature.value,
              this.signature.deadline,
              this.signature.split.v,
              this.signature.split.r,
              this.signature.split.s
            );

            await this.rootToken.connect(user).mint(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              1
            );

            await this.rootToken.connect(user).redeem(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2", "102"],
                  amounts: ["1000", "1000"],
                },
              ],
              EXTERNAL,
              1000000000
            );
          });

          it("properly updates the total balances", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("0");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("0");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("0");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("0");
          });

          it("properly updates the user balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("2000");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq(
              "20100000"
            );
            expect(await this.rootToken.balanceOf(userAddress)).to.eq("0");
          });
        });
      });
    });
  });

  describe("mint", async function () {
    describe("mints", async function () {
      describe("reverts", async function () {
        beforeEach(async function () {
          await this.silo
            .connect(user)
            .deposit(this.siloToken.address, "1000", EXTERNAL);
        });
        it("reverts if token is not whitelisted", async function () {
          await expect(
            this.rootToken.connect(user).mint(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              1
            )
          ).to.revertedWith("Token is not whitelisted");
        });

        it("reverts if insufficient balance", async function () {
          await this.rootToken
            .connect(owner)
            .addWhitelistToken(this.siloToken.address);

          await this.silo
            .connect(user)
            .approveDeposit(
              this.rootToken.address,
              this.siloToken.address,
              "5000"
            );

          await expect(
            this.rootToken.connect(user).mint(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["2000"],
                },
              ],
              EXTERNAL,
              1
            )
          ).to.revertedWith("Silo: Crate balance too low.");
        });

        it("reverts if insufficient allowance", async function () {
          await this.rootToken
            .connect(owner)
            .addWhitelistToken(this.siloToken.address);

          await expect(
            this.rootToken.connect(user).mint(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              1
            )
          ).to.revertedWith("Silo: insufficient allowance");
        });

        it("reverts if amounts is empty", async function () {
          await this.rootToken
            .connect(owner)
            .addWhitelistToken(this.siloToken.address);

          await expect(
            this.rootToken.connect(user).mint(
              [
                {
                  token: this.siloToken.address,
                  seasons: [],
                  amounts: [],
                },
              ],
              EXTERNAL,
              1
            )
          ).to.revertedWith("Silo: amounts array is empty");
        });

        it("reverts if mint shares is less than minRootsOut", async function () {
          await this.rootToken
            .connect(owner)
            .addWhitelistToken(this.siloToken.address);

          await this.silo
            .connect(user)
            .approveDeposit(
              this.rootToken.address,
              this.siloToken.address,
              "5000"
            );

          await this.silo
            .connect(user)
            .deposit(this.siloToken.address, "1000", EXTERNAL);

          await expect(
            this.rootToken.connect(user).mint([], EXTERNAL, 10000001)
          ).to.revertedWith("Mint: shares is less than minRootsOut");
        });
      });

      describe("start", async function () {
        beforeEach(async function () {
          await this.rootToken
            .connect(owner)
            .addWhitelistToken(this.siloToken.address);

          await this.silo
            .connect(user)
            .approveDeposit(
              this.rootToken.address,
              this.siloToken.address,
              "5000"
            );

          await this.silo
            .connect(user2)
            .approveDeposit(
              this.rootToken.address,
              this.siloToken.address,
              "5000"
            );

          await this.silo
            .connect(user3)
            .approveDeposit(
              this.rootToken.address,
              this.siloToken.address,
              "5000"
            );
        });

        describe("empty mint", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            this.result = await this.rootToken
              .connect(user)
              .mint([], EXTERNAL, 0);
          });

          it("properly updates the root total balances", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("0");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("0");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("0");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("0");
          });

          it("properly updates the user balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("1000");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq(
              "10000000"
            );
            expect(await this.rootToken.balanceOf(userAddress)).to.eq("0");
          });

          it("emits Mint event", async function () {
            await expect(this.result)
              .to.emit(this.rootToken, "Mint")
              .withArgs(user.address, [], "0", "0", "0", "0");
          });
        });

        describe("mint with a single season with INTERNAL from mode", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            this.deposits = [
              {
                token: this.siloToken.address,
                seasons: ["2"],
                amounts: ["1000"],
              },
            ];
            this.result = await this.rootToken.connect(user).mint(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              INTERNAL,
              1
            );
          });

          it("properly updates the total balances", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("1000");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("10000000");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("10000000");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("1000");
          });

          it("properly updates the user balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("0");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq("0");
            expect(
              await this.tokenFacet.getInternalBalance(
                userAddress,
                this.rootToken.address
              )
            ).to.eq("10000000");
          });
        });

        describe("mint with a single season", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            this.deposits = [
              {
                token: this.siloToken.address,
                seasons: ["2"],
                amounts: ["1000"],
              },
            ];
            this.result = await this.rootToken.connect(user).mint(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              1
            );
          });

          it("properly updates the total balances", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("1000");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("10000000");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("10000000");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("1000");
          });

          it("properly updates the user balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("0");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq("0");
            expect(await this.rootToken.balanceOf(userAddress)).to.eq(
              "10000000"
            );
          });
        });

        describe("mint with multiple same season", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            this.deposits = [
              {
                token: this.siloToken.address,
                seasons: ["2", "2"],
                amounts: ["400", "500"],
              },
            ];
            this.result = await this.rootToken
              .connect(user)
              .mint(this.deposits, EXTERNAL, 1);
          });

          it("properly updates the total balances", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("900");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("9000000");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("9000000");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("900");
          });

          it("properly updates the user balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("100");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq(
              "1000000"
            );
            expect(await this.rootToken.balanceOf(userAddress)).to.eq(
              "9000000"
            );
          });
        });

        describe("mint with multiple different season", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.season.fastForward(5);

            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            this.deposits = [
              {
                token: this.siloToken.address,
                seasons: ["2", "7"],
                amounts: ["500", "500"],
              },
            ];
            this.result = await this.rootToken
              .connect(user)
              .mint(this.deposits, EXTERNAL, 1);
          });

          it("properly updates the total balances", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("1000");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("10002500");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("10002500");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("1000");
          });

          it("properly updates the user balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("1000");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq(
              "10002500"
            );
            expect(await this.rootToken.balanceOf(userAddress)).to.eq(
              "10002500"
            );
          });
        });

        describe("2 users mint with same season", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.silo
              .connect(user2)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            this.deposits1 = [
              {
                token: this.siloToken.address,
                seasons: ["2"],
                amounts: ["1000"],
              },
            ];
            this.result = await this.rootToken
              .connect(user)
              .mint(this.deposits1, EXTERNAL, 1);

            this.deposits2 = [
              {
                token: this.siloToken.address,
                seasons: ["2"],
                amounts: ["1000"],
              },
            ];
            this.result2 = await this.rootToken
              .connect(user2)
              .mint(this.deposits2, EXTERNAL, 1);
          });

          it("properly updates the total balances on root", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("2000");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("20000000");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("20000000");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("2000");
          });

          it("properly updates the users balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("0");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq("0");
            expect(await this.rootToken.balanceOf(userAddress)).to.eq(
              "10000000"
            );

            expect(await this.silo.balanceOfSeeds(user2Address)).to.eq("0");
            expect(await this.silo.balanceOfStalk(user2Address)).to.eq("0");
            expect(await this.rootToken.balanceOf(user2Address)).to.eq(
              "10000000"
            );
          });
        });

        describe("2 users mint with different season earliest first", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.season.fastForward(10);

            await this.silo
              .connect(user2)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            this.deposits1 = [
              {
                token: this.siloToken.address,
                seasons: ["2"],
                amounts: ["1000"],
              },
            ];
            this.result = await this.rootToken
              .connect(user)
              .mint(this.deposits1, EXTERNAL, 1);

            this.deposits2 = [
              {
                token: this.siloToken.address,
                seasons: ["12"],
                amounts: ["1000"],
              },
            ];
            this.result2 = await this.rootToken
              .connect(user2)
              .mint(this.deposits2, EXTERNAL, 1);
          });

          it("properly updates the total balances on root", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("2000");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("20010000");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("20009999");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("2000");
          });

          it("properly updates the users balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("0");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq("0");
            expect(await this.rootToken.balanceOf(userAddress)).to.eq(
              "10010000"
            );

            expect(await this.silo.balanceOfSeeds(user2Address)).to.eq("0");
            expect(await this.silo.balanceOfStalk(user2Address)).to.eq("0");
            expect(await this.rootToken.balanceOf(user2Address)).to.eq(
              "9999999"
            );
          });
        });

        describe("2 users mint with different season earliest last", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.season.fastForward(10);

            await this.silo
              .connect(user2)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            this.deposits2 = [
              {
                token: this.siloToken.address,
                seasons: ["12"],
                amounts: ["1000"],
              },
            ];
            this.result2 = await this.rootToken
              .connect(user2)
              .mint(this.deposits2, EXTERNAL, 1);

            this.deposits1 = [
              {
                token: this.siloToken.address,
                seasons: ["2"],
                amounts: ["1000"],
              },
            ];
            this.result = await this.rootToken
              .connect(user)
              .mint(this.deposits1, EXTERNAL, 1);
          });

          it("properly updates the total balances on root", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("2000");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("20010000");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("20000000");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("2000");
          });

          it("properly updates the users balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("0");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq("0");
            expect(await this.rootToken.balanceOf(userAddress)).to.eq(
              "10000000"
            );

            expect(await this.silo.balanceOfSeeds(user2Address)).to.eq("0");
            expect(await this.silo.balanceOfStalk(user2Address)).to.eq("0");
            expect(await this.rootToken.balanceOf(user2Address)).to.eq(
              "10000000"
            );
          });
        });

        describe("3 users mint with different season earliest last", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.season.fastForward(10);

            await this.silo
              .connect(user2)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.season.fastForward(10);

            await this.silo
              .connect(user3)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            this.deposits3 = [
              {
                token: this.siloToken.address,
                seasons: ["22"],
                amounts: ["1000"],
              },
            ];
            this.result3 = await this.rootToken
              .connect(user3)
              .mint(this.deposits3, EXTERNAL, 1);

            this.deposits2 = [
              {
                token: this.siloToken.address,
                seasons: ["12"],
                amounts: ["1000"],
              },
            ];
            this.result2 = await this.rootToken
              .connect(user2)
              .mint(this.deposits2, EXTERNAL, 1);

            this.deposits1 = [
              {
                token: this.siloToken.address,
                seasons: ["2"],
                amounts: ["1000"],
              },
            ];
            this.result = await this.rootToken
              .connect(user)
              .mint(this.deposits1, EXTERNAL, 1);
          });

          it("properly updates the total balances on root", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("3000");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("30030000");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("30000000");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("3000");
          });

          it("properly updates the users balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("0");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq("0");
            expect(await this.rootToken.balanceOf(userAddress)).to.eq(
              "10000000"
            );

            expect(await this.silo.balanceOfSeeds(user2Address)).to.eq("0");
            expect(await this.silo.balanceOfStalk(user2Address)).to.eq("0");
            expect(await this.rootToken.balanceOf(user2Address)).to.eq(
              "10000000"
            );

            expect(await this.silo.balanceOfSeeds(user3Address)).to.eq("0");
            expect(await this.silo.balanceOfStalk(user3Address)).to.eq("0");
            expect(await this.rootToken.balanceOf(user3Address)).to.eq(
              "10000000"
            );
          });
        });

        describe("3 users mint with different season earliest first", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.season.fastForward(10);

            await this.silo
              .connect(user2)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.season.fastForward(10);

            await this.silo
              .connect(user3)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            this.deposits1 = [
              {
                token: this.siloToken.address,
                seasons: ["2"],
                amounts: ["1000"],
              },
            ];
            this.result = await this.rootToken
              .connect(user)
              .mint(this.deposits1, EXTERNAL, 1);

            this.deposits2 = [
              {
                token: this.siloToken.address,
                seasons: ["12"],
                amounts: ["1000"],
              },
            ];
            this.result2 = await this.rootToken
              .connect(user2)
              .mint(this.deposits2, EXTERNAL, 1);

            this.deposits3 = [
              {
                token: this.siloToken.address,
                seasons: ["22"],
                amounts: ["1000"],
              },
            ];
            this.result3 = await this.rootToken
              .connect(user3)
              .mint(this.deposits3, EXTERNAL, 1);
          });

          it("properly updates the total balances on root", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("3000");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("30030000");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("30029998");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("3000");
          });

          it("properly updates the users balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("0");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq("0");
            expect(await this.rootToken.balanceOf(userAddress)).to.eq(
              "10020000"
            );

            expect(await this.silo.balanceOfSeeds(user2Address)).to.eq("0");
            expect(await this.silo.balanceOfStalk(user2Address)).to.eq("0");
            expect(await this.rootToken.balanceOf(user2Address)).to.eq(
              "10009999"
            );

            expect(await this.silo.balanceOfSeeds(user3Address)).to.eq("0");
            expect(await this.silo.balanceOfStalk(user3Address)).to.eq("0");
            expect(await this.rootToken.balanceOf(user3Address)).to.eq(
              "9999999"
            );
          });
        });
      });
    });

    describe("deposits with token permit", async function () {
      describe("reverts", async function () {
        beforeEach(async function () {
          await this.silo
            .connect(user)
            .deposit(this.siloToken.address, "1000", EXTERNAL);
        });
        it("reverts if token is not whitelisted", async function () {
          const nonce = await this.silo
            .connect(user)
            .depositPermitNonces(userAddress);
          this.signature = await signSiloDepositTokenPermit(
            user,
            userAddress,
            this.rootToken.address,
            this.siloToken.address,
            "1000",
            nonce
          );

          await expect(
            this.rootToken.connect(user).mintWithTokenPermit(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              1,
              this.signature.token,
              this.signature.value,
              this.signature.deadline,
              this.signature.split.v,
              this.signature.split.r,
              this.signature.split.s
            )
          ).to.revertedWith("Token is not whitelisted");
        });

        it("reverts if insufficient balance", async function () {
          await this.rootToken
            .connect(owner)
            .addWhitelistToken(this.siloToken.address);

          const nonce = await this.silo
            .connect(user)
            .depositPermitNonces(userAddress);
          this.signature = await signSiloDepositTokenPermit(
            user,
            userAddress,
            this.rootToken.address,
            this.siloToken.address,
            "2000",
            nonce
          );

          await expect(
            this.rootToken.connect(user).mintWithTokenPermit(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["2000"],
                },
              ],
              EXTERNAL,
              1,
              this.signature.token,
              this.signature.value,
              this.signature.deadline,
              this.signature.split.v,
              this.signature.split.r,
              this.signature.split.s
            )
          ).to.revertedWith("Silo: Crate balance too low.");
        });

        it("reverts if insufficient allowance", async function () {
          await this.rootToken
            .connect(owner)
            .addWhitelistToken(this.siloToken.address);

          const nonce = await this.silo
            .connect(user)
            .depositPermitNonces(userAddress);
          this.signature = await signSiloDepositTokenPermit(
            user,
            userAddress,
            this.rootToken.address,
            this.siloToken.address,
            "500",
            nonce
          );

          await expect(
            this.rootToken.connect(user).mintWithTokenPermit(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              1,
              this.signature.token,
              this.signature.value,
              this.signature.deadline,
              this.signature.split.v,
              this.signature.split.r,
              this.signature.split.s
            )
          ).to.revertedWith("Silo: insufficient allowance");
        });

        it("reverts if amounts is empty", async function () {
          await this.rootToken
            .connect(owner)
            .addWhitelistToken(this.siloToken.address);

          const nonce = await this.silo
            .connect(user)
            .depositPermitNonces(userAddress);
          this.signature = await signSiloDepositTokenPermit(
            user,
            userAddress,
            this.rootToken.address,
            this.siloToken.address,
            "500",
            nonce
          );

          await expect(
            this.rootToken.connect(user).mintWithTokenPermit(
              [
                {
                  token: this.siloToken.address,
                  seasons: [],
                  amounts: [],
                },
              ],
              EXTERNAL,
              1,
              this.signature.token,
              this.signature.value,
              this.signature.deadline,
              this.signature.split.v,
              this.signature.split.r,
              this.signature.split.s
            )
          ).to.revertedWith("Silo: amounts array is empty");
        });

        it("reverts if invalid permit", async function () {
          await this.rootToken
            .connect(owner)
            .addWhitelistToken(this.siloToken.address);

          const nonce = await this.silo
            .connect(user)
            .depositPermitNonces(userAddress);
          this.signature = await signSiloDepositTokenPermit(
            user,
            userAddress,
            user2Address,
            this.siloToken.address,
            "1000",
            nonce
          );

          await expect(
            this.rootToken.connect(user).mintWithTokenPermit(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              1,
              this.signature.token,
              this.signature.value,
              this.signature.deadline,
              this.signature.split.v,
              this.signature.split.r,
              this.signature.split.s
            )
          ).to.revertedWith("Silo: permit invalid signature");
        });

        it("reverts if deadline expired", async function () {
          await this.rootToken
            .connect(owner)
            .addWhitelistToken(this.siloToken.address);

          const nonce = await this.silo
            .connect(user)
            .depositPermitNonces(userAddress);

          this.signature = await signSiloDepositTokenPermit(
            user,
            userAddress,
            this.rootToken.address,
            this.siloToken.address,
            "1000",
            nonce,
            100
          );

          await expect(
            this.rootToken.connect(user).mintWithTokenPermit(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              1,
              this.signature.token,
              this.signature.value,
              this.signature.deadline,
              this.signature.split.v,
              this.signature.split.r,
              this.signature.split.s
            )
          ).to.revertedWith("Silo: permit expired deadline");
        });

        it("reverts if deposit is empty", async function () {
          await this.rootToken
            .connect(owner)
            .addWhitelistToken(this.siloToken.address);

          const nonce = await this.silo
            .connect(user)
            .depositPermitNonces(userAddress);

          this.signature = await signSiloDepositTokenPermit(
            user,
            userAddress,
            this.rootToken.address,
            this.siloToken.address,
            "1000",
            nonce
          );

          await expect(
            this.rootToken.connect(user).mintWithTokenPermit(
              [
                {
                  token: this.siloToken.address,
                  seasons: [],
                  amounts: [],
                },
              ],
              EXTERNAL,
              1,
              this.signature.token,
              this.signature.value,
              this.signature.deadline,
              this.signature.split.v,
              this.signature.split.r,
              this.signature.split.s
            )
          ).to.revertedWith("Silo: amounts array is empty");
        });
      });
      describe("start", async function () {
        beforeEach(async function () {
          await this.rootToken
            .connect(owner)
            .addWhitelistToken(this.siloToken.address);

          const nonce = await this.silo
            .connect(user)
            .depositPermitNonces(userAddress);

          this.signature = await signSiloDepositTokenPermit(
            user,
            userAddress,
            this.rootToken.address,
            this.siloToken.address,
            "5000",
            nonce
          );
          const nonce2 = await this.silo
            .connect(user2)
            .depositPermitNonces(user2Address);
          this.signature2 = await signSiloDepositTokenPermit(
            user2,
            user2Address,
            this.rootToken.address,
            this.siloToken.address,
            "5000",
            nonce2
          );
          const nonce3 = await this.silo
            .connect(user3)
            .depositPermitNonces(user3Address);
          this.signature3 = await signSiloDepositTokenPermit(
            user3,
            user3Address,
            this.rootToken.address,
            this.siloToken.address,
            "5000",
            nonce3
          );
        });

        describe("mint with a single season", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            this.deposits = [
              {
                token: this.siloToken.address,
                seasons: ["2"],
                amounts: ["1000"],
              },
            ];
            this.result = await this.rootToken
              .connect(user)
              .mintWithTokenPermit(
                [
                  {
                    token: this.siloToken.address,
                    seasons: ["2"],
                    amounts: ["1000"],
                  },
                ],
                EXTERNAL,
                1,
                this.signature.token,
                this.signature.value,
                this.signature.deadline,
                this.signature.split.v,
                this.signature.split.r,
                this.signature.split.s
              );
          });

          it("properly updates the total balances", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("1000");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("10000000");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("10000000");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("1000");
          });

          it("properly updates the user balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("0");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq("0");
            expect(await this.rootToken.balanceOf(userAddress)).to.eq(
              "10000000"
            );
          });
        });

        describe("mint with multiple same season", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            this.deposit = {
              token: this.siloToken.address,
              seasons: ["2", "2"],
              amounts: ["400", "500"],
            };
            this.result = await this.rootToken
              .connect(user)
              .mintWithTokenPermit(
                [this.deposit],
                EXTERNAL,
                1,
                this.signature.token,
                this.signature.value,
                this.signature.deadline,
                this.signature.split.v,
                this.signature.split.r,
                this.signature.split.s
              );
          });

          it("properly updates the total balances", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("900");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("9000000");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("9000000");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("900");
          });

          it("properly updates the user balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("100");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq(
              "1000000"
            );
            expect(await this.rootToken.balanceOf(userAddress)).to.eq(
              "9000000"
            );
          });
        });

        describe("mint with multiple different season", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.season.fastForward(5);

            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            this.deposit = {
              token: this.siloToken.address,
              seasons: ["2", "7"],
              amounts: ["500", "500"],
            };
            this.result = await this.rootToken
              .connect(user)
              .mintWithTokenPermit(
                [this.deposit],
                EXTERNAL,
                1,
                this.signature.token,
                this.signature.value,
                this.signature.deadline,
                this.signature.split.v,
                this.signature.split.r,
                this.signature.split.s
              );
          });

          it("properly updates the total balances", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("1000");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("10002500");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("10002500");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("1000");
          });

          it("properly updates the user balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("1000");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq(
              "10002500"
            );
            expect(await this.rootToken.balanceOf(userAddress)).to.eq(
              "10002500"
            );
          });
        });

        describe("2 users mint with same season", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.silo
              .connect(user2)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            this.deposit1 = {
              token: this.siloToken.address,
              seasons: ["2"],
              amounts: ["1000"],
            };

            this.result = await this.rootToken
              .connect(user)
              .mintWithTokenPermit(
                [this.deposit1],
                EXTERNAL,
                1,
                this.signature.token,
                this.signature.value,
                this.signature.deadline,
                this.signature.split.v,
                this.signature.split.r,
                this.signature.split.s
              );

            this.deposit2 = {
              token: this.siloToken.address,
              seasons: ["2"],
              amounts: ["1000"],
            };
            this.result2 = await this.rootToken
              .connect(user2)
              .mintWithTokenPermit(
                [this.deposit2],
                EXTERNAL,
                1,
                this.signature2.token,
                this.signature2.value,
                this.signature2.deadline,
                this.signature2.split.v,
                this.signature2.split.r,
                this.signature2.split.s
              );
          });

          it("properly updates the total balances on root", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("2000");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("20000000");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("20000000");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("2000");
          });

          it("properly updates the users balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("0");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq("0");
            expect(await this.rootToken.balanceOf(userAddress)).to.eq(
              "10000000"
            );

            expect(await this.silo.balanceOfSeeds(user2Address)).to.eq("0");
            expect(await this.silo.balanceOfStalk(user2Address)).to.eq("0");
            expect(await this.rootToken.balanceOf(user2Address)).to.eq(
              "10000000"
            );
          });
        });

        describe("2 users mint with different season earliest first", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.season.fastForward(10);

            await this.silo
              .connect(user2)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            this.deposit1 = {
              token: this.siloToken.address,
              seasons: ["2"],
              amounts: ["1000"],
            };
            this.result = await this.rootToken
              .connect(user)
              .mintWithTokenPermit(
                [this.deposit1],
                EXTERNAL,
                1,
                this.signature.token,
                this.signature.value,
                this.signature.deadline,
                this.signature.split.v,
                this.signature.split.r,
                this.signature.split.s
              );

            this.deposit2 = {
              token: this.siloToken.address,
              seasons: ["12"],
              amounts: ["1000"],
            };
            this.result2 = await this.rootToken
              .connect(user2)
              .mintWithTokenPermit(
                [this.deposit2],
                EXTERNAL,
                1,
                this.signature2.token,
                this.signature2.value,
                this.signature2.deadline,
                this.signature2.split.v,
                this.signature2.split.r,
                this.signature2.split.s
              );
          });

          it("properly updates the total balances on root", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("2000");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("20010000");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("20009999");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("2000");
          });

          it("properly updates the users balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("0");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq("0");
            expect(await this.rootToken.balanceOf(userAddress)).to.eq(
              "10010000"
            );

            expect(await this.silo.balanceOfSeeds(user2Address)).to.eq("0");
            expect(await this.silo.balanceOfStalk(user2Address)).to.eq("0");
            expect(await this.rootToken.balanceOf(user2Address)).to.eq(
              "9999999"
            );
          });
        });

        describe("2 users mint with different season earliest last", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.season.fastForward(10);

            await this.silo
              .connect(user2)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            this.deposit2 = {
              token: this.siloToken.address,
              seasons: ["12"],
              amounts: ["1000"],
            };
            this.result2 = await this.rootToken
              .connect(user2)
              .mintWithTokenPermit(
                [this.deposit2],
                EXTERNAL,
                1,
                this.signature2.token,
                this.signature2.value,
                this.signature2.deadline,
                this.signature2.split.v,
                this.signature2.split.r,
                this.signature2.split.s
              );
            this.deposit1 = {
              token: this.siloToken.address,
              seasons: ["2"],
              amounts: ["1000"],
            };
            this.result = await this.rootToken
              .connect(user)
              .mintWithTokenPermit(
                [this.deposit1],
                EXTERNAL,
                1,
                this.signature.token,
                this.signature.value,
                this.signature.deadline,
                this.signature.split.v,
                this.signature.split.r,
                this.signature.split.s
              );
          });

          it("properly updates the total balances on root", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("2000");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("20010000");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("20000000");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("2000");
          });

          it("properly updates the users balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("0");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq("0");
            expect(await this.rootToken.balanceOf(userAddress)).to.eq(
              "10000000"
            );

            expect(await this.silo.balanceOfSeeds(user2Address)).to.eq("0");
            expect(await this.silo.balanceOfStalk(user2Address)).to.eq("0");
            expect(await this.rootToken.balanceOf(user2Address)).to.eq(
              "10000000"
            );
          });
        });

        describe("3 users mint with different season earliest last", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.season.fastForward(10);

            await this.silo
              .connect(user2)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.season.fastForward(10);

            await this.silo
              .connect(user3)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            this.deposit3 = {
              token: this.siloToken.address,
              seasons: ["22"],
              amounts: ["1000"],
            };
            this.result3 = await this.rootToken
              .connect(user3)
              .mintWithTokenPermit(
                [this.deposit3],
                EXTERNAL,
                1,
                this.signature3.token,
                this.signature3.value,
                this.signature3.deadline,
                this.signature3.split.v,
                this.signature3.split.r,
                this.signature3.split.s
              );

            this.deposit2 = {
              token: this.siloToken.address,
              seasons: ["12"],
              amounts: ["1000"],
            };
            this.result2 = await this.rootToken
              .connect(user2)
              .mintWithTokenPermit(
                [this.deposit2],
                EXTERNAL,
                1,
                this.signature2.token,
                this.signature2.value,
                this.signature2.deadline,
                this.signature2.split.v,
                this.signature2.split.r,
                this.signature2.split.s
              );

            this.deposit1 = {
              token: this.siloToken.address,
              seasons: ["2"],
              amounts: ["1000"],
            };
            this.result = await this.rootToken
              .connect(user)
              .mintWithTokenPermit(
                [this.deposit1],
                EXTERNAL,
                1,
                this.signature.token,
                this.signature.value,
                this.signature.deadline,
                this.signature.split.v,
                this.signature.split.r,
                this.signature.split.s
              );
          });

          it("properly updates the total balances on root", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("3000");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("30030000");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("30000000");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("3000");
          });

          it("properly updates the users balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("0");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq("0");
            expect(await this.rootToken.balanceOf(userAddress)).to.eq(
              "10000000"
            );

            expect(await this.silo.balanceOfSeeds(user2Address)).to.eq("0");
            expect(await this.silo.balanceOfStalk(user2Address)).to.eq("0");
            expect(await this.rootToken.balanceOf(user2Address)).to.eq(
              "10000000"
            );

            expect(await this.silo.balanceOfSeeds(user3Address)).to.eq("0");
            expect(await this.silo.balanceOfStalk(user3Address)).to.eq("0");
            expect(await this.rootToken.balanceOf(user3Address)).to.eq(
              "10000000"
            );
          });
        });

        describe("3 users mint with different season earliest first", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.season.fastForward(10);

            await this.silo
              .connect(user2)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.season.fastForward(10);

            await this.silo
              .connect(user3)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            this.deposit1 = {
              token: this.siloToken.address,
              seasons: ["2"],
              amounts: ["1000"],
            };
            this.result = await this.rootToken
              .connect(user)
              .mintWithTokenPermit(
                [this.deposit1],
                EXTERNAL,
                1,
                this.signature.token,
                this.signature.value,
                this.signature.deadline,
                this.signature.split.v,
                this.signature.split.r,
                this.signature.split.s
              );

            this.deposit2 = {
              token: this.siloToken.address,
              seasons: ["12"],
              amounts: ["1000"],
            };
            this.result2 = await this.rootToken
              .connect(user2)
              .mintWithTokenPermit(
                [this.deposit2],
                EXTERNAL,
                1,
                this.signature2.token,
                this.signature2.value,
                this.signature2.deadline,
                this.signature2.split.v,
                this.signature2.split.r,
                this.signature2.split.s
              );

            this.deposit3 = {
              token: this.siloToken.address,
              seasons: ["22"],
              amounts: ["1000"],
            };
            this.result3 = await this.rootToken
              .connect(user3)
              .mintWithTokenPermit(
                [this.deposit3],
                EXTERNAL,
                1,
                this.signature3.token,
                this.signature3.value,
                this.signature3.deadline,
                this.signature3.split.v,
                this.signature3.split.r,
                this.signature3.split.s
              );
          });

          it("properly updates the total balances on root", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("3000");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("30030000");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("30029998");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("3000");
          });

          it("properly updates the users balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("0");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq("0");
            expect(await this.rootToken.balanceOf(userAddress)).to.eq(
              "10020000"
            );

            expect(await this.silo.balanceOfSeeds(user2Address)).to.eq("0");
            expect(await this.silo.balanceOfStalk(user2Address)).to.eq("0");
            expect(await this.rootToken.balanceOf(user2Address)).to.eq(
              "10009999"
            );

            expect(await this.silo.balanceOfSeeds(user3Address)).to.eq("0");
            expect(await this.silo.balanceOfStalk(user3Address)).to.eq("0");
            expect(await this.rootToken.balanceOf(user3Address)).to.eq(
              "9999999"
            );
          });
        });
      });
    });

    describe("mint with tokens permit", async function () {
      describe("reverts", async function () {
        it("reverts if token is not whitelisted", async function () {
          await this.silo
            .connect(user)
            .deposit(this.siloToken.address, "1000", EXTERNAL);

          const nonce = await this.silo
            .connect(user)
            .depositPermitNonces(userAddress);

          this.signature = await signSiloDepositTokensPermit(
            user,
            userAddress,
            this.rootToken.address,
            [this.siloToken.address],
            ["1000"],
            nonce
          );

          await expect(
            this.rootToken.connect(user).mintWithTokensPermit(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              1,
              this.signature.tokens,
              this.signature.values,
              this.signature.deadline,
              this.signature.split.v,
              this.signature.split.r,
              this.signature.split.s
            )
          ).to.revertedWith("Token is not whitelisted");
        });

        it("reverts if insufficient balance", async function () {
          await this.rootToken
            .connect(owner)
            .addWhitelistToken(this.siloToken.address);
          await this.silo
            .connect(user)
            .deposit(this.siloToken.address, "1000", EXTERNAL);

          const nonce = await this.silo
            .connect(user)
            .depositPermitNonces(userAddress);
          this.signature = await signSiloDepositTokensPermit(
            user,
            userAddress,
            this.rootToken.address,
            [this.siloToken.address],
            ["2000"],
            nonce
          );

          await expect(
            this.rootToken.connect(user).mintWithTokensPermit(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["2000"],
                },
              ],
              EXTERNAL,
              1,
              this.signature.tokens,
              this.signature.values,
              this.signature.deadline,
              this.signature.split.v,
              this.signature.split.r,
              this.signature.split.s
            )
          ).to.revertedWith("Silo: Crate balance too low.");
        });

        it("reverts if insufficient allowance", async function () {
          await this.rootToken
            .connect(owner)
            .addWhitelistToken(this.siloToken.address);
          await this.silo
            .connect(user)
            .deposit(this.siloToken.address, "1000", EXTERNAL);

          const nonce = await this.silo
            .connect(user)
            .depositPermitNonces(userAddress);
          this.signature = await signSiloDepositTokensPermit(
            user,
            userAddress,
            this.rootToken.address,
            [this.siloToken.address],
            ["500"],
            nonce
          );

          await expect(
            this.rootToken.connect(user).mintWithTokensPermit(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              1,
              this.signature.tokens,
              this.signature.values,
              this.signature.deadline,
              this.signature.split.v,
              this.signature.split.r,
              this.signature.split.s
            )
          ).to.revertedWith("Silo: insufficient allowance");
        });

        it("reverts if amounts is empty", async function () {
          await this.rootToken
            .connect(owner)
            .addWhitelistToken(this.siloToken.address);

          const nonce = await this.silo
            .connect(user)
            .depositPermitNonces(userAddress);
          this.signature = await signSiloDepositTokensPermit(
            user,
            userAddress,
            this.rootToken.address,
            [this.siloToken.address],
            ["500"],
            nonce
          );

          await expect(
            this.rootToken.connect(user).mintWithTokensPermit(
              [
                {
                  token: this.siloToken.address,
                  seasons: [],
                  amounts: [],
                },
              ],
              EXTERNAL,
              1,
              this.signature.tokens,
              this.signature.values,
              this.signature.deadline,
              this.signature.split.v,
              this.signature.split.r,
              this.signature.split.s
            )
          ).to.revertedWith("Silo: amounts array is empty");
        });

        it("reverts if invalid permit", async function () {
          await this.rootToken
            .connect(owner)
            .addWhitelistToken(this.siloToken.address);

          const nonce = await this.silo
            .connect(user)
            .depositPermitNonces(userAddress);
          this.signature = await signSiloDepositTokensPermit(
            user,
            userAddress,
            user2Address,
            [this.siloToken.address],
            ["1000"],
            nonce
          );

          await expect(
            this.rootToken.connect(user).mintWithTokensPermit(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              1,
              this.signature.tokens,
              this.signature.values,
              this.signature.deadline,
              this.signature.split.v,
              this.signature.split.r,
              this.signature.split.s
            )
          ).to.revertedWith("Silo: permit invalid signature");
        });

        it("reverts if deadline expired", async function () {
          await this.rootToken
            .connect(owner)
            .addWhitelistToken(this.siloToken.address);

          const nonce = await this.silo
            .connect(user)
            .depositPermitNonces(userAddress);

          this.signature = await signSiloDepositTokensPermit(
            user,
            userAddress,
            this.rootToken.address,
            [this.siloToken.address],
            ["1000"],
            nonce,
            100
          );

          await expect(
            this.rootToken.connect(user).mintWithTokensPermit(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              1,
              this.signature.tokens,
              this.signature.values,
              this.signature.deadline,
              this.signature.split.v,
              this.signature.split.r,
              this.signature.split.s
            )
          ).to.revertedWith("Silo: permit expired deadline");
        });

        it("reverts if mint shares is less than minRootsOut", async function () {
          await this.rootToken
            .connect(owner)
            .addWhitelistToken(this.siloToken.address);

          const nonce = await this.silo
            .connect(user)
            .depositPermitNonces(userAddress);
          this.signature = await signSiloDepositTokensPermit(
            user,
            userAddress,
            this.rootToken.address,
            [this.siloToken.address],
            ["5000"],
            nonce
          );

          await this.silo
            .connect(user)
            .deposit(this.siloToken.address, "1000", EXTERNAL);

          await expect(
            this.rootToken.connect(user).mintWithTokensPermit(
              [
                {
                  token: this.siloToken.address,
                  seasons: ["2"],
                  amounts: ["1000"],
                },
              ],
              EXTERNAL,
              10000001,
              this.signature.tokens,
              this.signature.values,
              this.signature.deadline,
              this.signature.split.v,
              this.signature.split.r,
              this.signature.split.s
            )
          ).to.revertedWith("Mint: shares is less than minRootsOut");
        });
      });

      describe("start", async function () {
        beforeEach(async function () {
          await this.rootToken
            .connect(owner)
            .addWhitelistToken(this.siloToken.address);

          const nonce = await this.silo
            .connect(user)
            .depositPermitNonces(userAddress);
          this.signature = await signSiloDepositTokensPermit(
            user,
            userAddress,
            this.rootToken.address,
            [this.siloToken.address],
            ["5000"],
            nonce
          );
          const nonce2 = await this.silo
            .connect(user2)
            .depositPermitNonces(user2Address);
          this.signature2 = await signSiloDepositTokensPermit(
            user2,
            user2Address,
            this.rootToken.address,
            [this.siloToken.address],
            ["5000"],
            nonce2
          );
          const nonce3 = await this.silo
            .connect(user3)
            .depositPermitNonces(user3Address);
          this.signature3 = await signSiloDepositTokensPermit(
            user3,
            user3Address,
            this.rootToken.address,
            [this.siloToken.address],
            ["5000"],
            nonce3
          );
        });

        describe("empty mint", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            this.result = await this.rootToken
              .connect(user)
              .mintWithTokensPermit(
                [],
                EXTERNAL,
                0,
                this.signature.tokens,
                this.signature.values,
                this.signature.deadline,
                this.signature.split.v,
                this.signature.split.r,
                this.signature.split.s
              );
          });

          it("properly updates the root total balances", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("0");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("0");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("0");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("0");
          });

          it("properly updates the user balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("1000");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq(
              "10000000"
            );
            expect(await this.rootToken.balanceOf(userAddress)).to.eq("0");
          });

          it("emits Mint event", async function () {
            await expect(this.result)
              .to.emit(this.rootToken, "Mint")
              .withArgs(user.address, [], "0", "0", "0", "0");
          });
        });

        describe("mint with a single season", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            this.deposits = [
              {
                token: this.siloToken.address,
                seasons: ["2"],
                amounts: ["1000"],
              },
            ];
            this.result = await this.rootToken
              .connect(user)
              .mintWithTokensPermit(
                [
                  {
                    token: this.siloToken.address,
                    seasons: ["2"],
                    amounts: ["1000"],
                  },
                ],
                EXTERNAL,
                1,
                this.signature.tokens,
                this.signature.values,
                this.signature.deadline,
                this.signature.split.v,
                this.signature.split.r,
                this.signature.split.s
              );
          });

          it("properly updates the total balances", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("1000");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("10000000");
          });

          it("properly updates the rootPerBdv", async function () {
            expect(await this.rootToken.bdvPerRoot()).to.eq(to18("0.0001"));
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("10000000");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("1000");
          });

          it("properly updates the user balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("0");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq("0");
            expect(await this.rootToken.balanceOf(userAddress)).to.eq(
              "10000000"
            );
          });
        });

        describe("mint with multiple same season", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            this.deposits = [
              {
                token: this.siloToken.address,
                seasons: ["2", "2"],
                amounts: ["400", "500"],
              },
            ];
            this.result = await this.rootToken
              .connect(user)
              .mintWithTokensPermit(
                this.deposits,
                EXTERNAL,
                1,
                this.signature.tokens,
                this.signature.values,
                this.signature.deadline,
                this.signature.split.v,
                this.signature.split.r,
                this.signature.split.s
              );
          });

          it("properly updates the total balances", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("900");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("9000000");
          });

          it("properly updates the rootPerBdv", async function () {
            expect(await this.rootToken.bdvPerRoot()).to.eq(to18("0.0001"));
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("9000000");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("900");
          });

          it("properly updates the user balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("100");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq(
              "1000000"
            );
            expect(await this.rootToken.balanceOf(userAddress)).to.eq(
              "9000000"
            );
          });
        });

        describe("mint with multiple different season", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.season.fastForward(5);

            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            this.deposits = [
              {
                token: this.siloToken.address,
                seasons: ["2", "7"],
                amounts: ["500", "500"],
              },
            ];
            this.result = await this.rootToken
              .connect(user)
              .mintWithTokensPermit(
                this.deposits,
                EXTERNAL,
                1,
                this.signature.tokens,
                this.signature.values,
                this.signature.deadline,
                this.signature.split.v,
                this.signature.split.r,
                this.signature.split.s
              );
          });

          it("properly updates the total balances", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("1000");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("10002500");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("10002500");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("1000");
          });

          it("properly updates the user balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("1000");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq(
              "10002500"
            );
            expect(await this.rootToken.balanceOf(userAddress)).to.eq(
              "10002500"
            );
          });
        });

        describe("2 users mint with same season", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.silo
              .connect(user2)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            this.deposits1 = [
              {
                token: this.siloToken.address,
                seasons: ["2"],
                amounts: ["1000"],
              },
            ];
            this.result = await this.rootToken
              .connect(user)
              .mintWithTokensPermit(
                this.deposits1,
                EXTERNAL,
                1,
                this.signature.tokens,
                this.signature.values,
                this.signature.deadline,
                this.signature.split.v,
                this.signature.split.r,
                this.signature.split.s
              );

            this.deposits2 = [
              {
                token: this.siloToken.address,
                seasons: ["2"],
                amounts: ["1000"],
              },
            ];
            this.result2 = await this.rootToken
              .connect(user2)
              .mintWithTokensPermit(
                this.deposits2,
                EXTERNAL,
                1,
                this.signature2.tokens,
                this.signature2.values,
                this.signature2.deadline,
                this.signature2.split.v,
                this.signature2.split.r,
                this.signature2.split.s
              );
          });

          it("properly updates the total balances on root", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("2000");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("20000000");
          });

          it("properly updates the rootPerBdv", async function () {
            expect(await this.rootToken.bdvPerRoot()).to.eq(to18("0.0001"));
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("20000000");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("2000");
          });

          it("properly updates the users balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("0");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq("0");
            expect(await this.rootToken.balanceOf(userAddress)).to.eq(
              "10000000"
            );

            expect(await this.silo.balanceOfSeeds(user2Address)).to.eq("0");
            expect(await this.silo.balanceOfStalk(user2Address)).to.eq("0");
            expect(await this.rootToken.balanceOf(user2Address)).to.eq(
              "10000000"
            );
          });
        });

        describe("2 users mint with different season earliest first", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.season.fastForward(10);

            await this.silo
              .connect(user2)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            this.deposits1 = [
              {
                token: this.siloToken.address,
                seasons: ["2"],
                amounts: ["1000"],
              },
            ];
            this.result = await this.rootToken
              .connect(user)
              .mintWithTokensPermit(
                this.deposits1,
                EXTERNAL,
                1,
                this.signature.tokens,
                this.signature.values,
                this.signature.deadline,
                this.signature.split.v,
                this.signature.split.r,
                this.signature.split.s
              );

            this.deposits2 = [
              {
                token: this.siloToken.address,
                seasons: ["12"],
                amounts: ["1000"],
              },
            ];
            this.result2 = await this.rootToken
              .connect(user2)
              .mintWithTokensPermit(
                this.deposits2,
                EXTERNAL,
                1,
                this.signature2.tokens,
                this.signature2.values,
                this.signature2.deadline,
                this.signature2.split.v,
                this.signature2.split.r,
                this.signature2.split.s
              );
          });

          it("properly updates the total balances on root", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("2000");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("20010000");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("20009999");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("2000");
          });

          it("properly updates the users balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("0");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq("0");
            expect(await this.rootToken.balanceOf(userAddress)).to.eq(
              "10010000"
            );

            expect(await this.silo.balanceOfSeeds(user2Address)).to.eq("0");
            expect(await this.silo.balanceOfStalk(user2Address)).to.eq("0");
            expect(await this.rootToken.balanceOf(user2Address)).to.eq(
              "9999999"
            );
          });
        });

        describe("2 users mint with different season earliest last", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.season.fastForward(10);

            await this.silo
              .connect(user2)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            this.deposits2 = [
              {
                token: this.siloToken.address,
                seasons: ["12"],
                amounts: ["1000"],
              },
            ];
            this.result2 = await this.rootToken
              .connect(user2)
              .mintWithTokensPermit(
                this.deposits2,
                EXTERNAL,
                1,
                this.signature2.tokens,
                this.signature2.values,
                this.signature2.deadline,
                this.signature2.split.v,
                this.signature2.split.r,
                this.signature2.split.s
              );
            this.deposits1 = [
              {
                token: this.siloToken.address,
                seasons: ["2"],
                amounts: ["1000"],
              },
            ];
            this.result = await this.rootToken
              .connect(user)
              .mintWithTokensPermit(
                this.deposits1,
                EXTERNAL,
                1,
                this.signature.tokens,
                this.signature.values,
                this.signature.deadline,
                this.signature.split.v,
                this.signature.split.r,
                this.signature.split.s
              );
          });

          it("properly updates the total balances on root", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("2000");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("20010000");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("20000000");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("2000");
          });

          it("properly updates the users balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("0");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq("0");
            expect(await this.rootToken.balanceOf(userAddress)).to.eq(
              "10000000"
            );

            expect(await this.silo.balanceOfSeeds(user2Address)).to.eq("0");
            expect(await this.silo.balanceOfStalk(user2Address)).to.eq("0");
            expect(await this.rootToken.balanceOf(user2Address)).to.eq(
              "10000000"
            );
          });
        });

        describe("3 users mint with different season earliest last", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.season.fastForward(10);

            await this.silo
              .connect(user2)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.season.fastForward(10);

            await this.silo
              .connect(user3)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            this.deposits3 = [
              {
                token: this.siloToken.address,
                seasons: ["22"],
                amounts: ["1000"],
              },
            ];
            this.result3 = await this.rootToken
              .connect(user3)
              .mintWithTokensPermit(
                this.deposits3,
                EXTERNAL,
                1,
                this.signature3.tokens,
                this.signature3.values,
                this.signature3.deadline,
                this.signature3.split.v,
                this.signature3.split.r,
                this.signature3.split.s
              );

            this.deposits2 = [
              {
                token: this.siloToken.address,
                seasons: ["12"],
                amounts: ["1000"],
              },
            ];
            this.result2 = await this.rootToken
              .connect(user2)
              .mintWithTokensPermit(
                this.deposits2,
                EXTERNAL,
                1,
                this.signature2.tokens,
                this.signature2.values,
                this.signature2.deadline,
                this.signature2.split.v,
                this.signature2.split.r,
                this.signature2.split.s
              );

            this.deposits1 = [
              {
                token: this.siloToken.address,
                seasons: ["2"],
                amounts: ["1000"],
              },
            ];
            this.result = await this.rootToken
              .connect(user)
              .mintWithTokensPermit(
                this.deposits1,
                EXTERNAL,
                1,
                this.signature.tokens,
                this.signature.values,
                this.signature.deadline,
                this.signature.split.v,
                this.signature.split.r,
                this.signature.split.s
              );
          });

          it("properly updates the total balances on root", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("3000");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("30030000");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("30000000");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("3000");
          });

          it("properly updates the users balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("0");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq("0");
            expect(await this.rootToken.balanceOf(userAddress)).to.eq(
              "10000000"
            );

            expect(await this.silo.balanceOfSeeds(user2Address)).to.eq("0");
            expect(await this.silo.balanceOfStalk(user2Address)).to.eq("0");
            expect(await this.rootToken.balanceOf(user2Address)).to.eq(
              "10000000"
            );

            expect(await this.silo.balanceOfSeeds(user3Address)).to.eq("0");
            expect(await this.silo.balanceOfStalk(user3Address)).to.eq("0");
            expect(await this.rootToken.balanceOf(user3Address)).to.eq(
              "10000000"
            );
          });
        });

        describe("3 users mint with different season earliest first", async function () {
          beforeEach(async function () {
            await this.silo
              .connect(user)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.season.fastForward(10);

            await this.silo
              .connect(user2)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            await this.season.fastForward(10);

            await this.silo
              .connect(user3)
              .deposit(this.siloToken.address, "1000", EXTERNAL);

            this.deposits1 = [
              {
                token: this.siloToken.address,
                seasons: ["2"],
                amounts: ["1000"],
              },
            ];
            this.result = await this.rootToken
              .connect(user)
              .mintWithTokensPermit(
                this.deposits1,
                EXTERNAL,
                1,
                this.signature.tokens,
                this.signature.values,
                this.signature.deadline,
                this.signature.split.v,
                this.signature.split.r,
                this.signature.split.s
              );

            this.deposits2 = [
              {
                token: this.siloToken.address,
                seasons: ["12"],
                amounts: ["1000"],
              },
            ];
            this.result2 = await this.rootToken
              .connect(user2)
              .mintWithTokensPermit(
                this.deposits2,
                EXTERNAL,
                1,
                this.signature2.tokens,
                this.signature2.values,
                this.signature2.deadline,
                this.signature2.split.v,
                this.signature2.split.r,
                this.signature2.split.s
              );

            this.deposits3 = [
              {
                token: this.siloToken.address,
                seasons: ["22"],
                amounts: ["1000"],
              },
            ];
            this.result3 = await this.rootToken
              .connect(user3)
              .mintWithTokensPermit(
                this.deposits3,
                EXTERNAL,
                1,
                this.signature3.tokens,
                this.signature3.values,
                this.signature3.deadline,
                this.signature3.split.v,
                this.signature3.split.r,
                this.signature3.split.s
              );
          });

          it("properly updates the total balances on root", async function () {
            expect(
              await this.silo.balanceOfSeeds(this.rootToken.address)
            ).to.eq("3000");
            expect(
              await this.silo.balanceOfStalk(this.rootToken.address)
            ).to.eq("30030000");
          });

          it("correctly update total supply", async function () {
            expect(await this.rootToken.totalSupply()).to.be.eq("30029998");
          });

          it("correctly update underlyingBdv", async function () {
            expect(await this.rootToken.underlyingBdv()).to.be.eq("3000");
          });

          it("properly updates the users balance", async function () {
            expect(await this.silo.balanceOfSeeds(userAddress)).to.eq("0");
            expect(await this.silo.balanceOfStalk(userAddress)).to.eq("0");
            expect(await this.rootToken.balanceOf(userAddress)).to.eq(
              "10020000"
            );

            expect(await this.silo.balanceOfSeeds(user2Address)).to.eq("0");
            expect(await this.silo.balanceOfStalk(user2Address)).to.eq("0");
            expect(await this.rootToken.balanceOf(user2Address)).to.eq(
              "10009999"
            );

            expect(await this.silo.balanceOfSeeds(user3Address)).to.eq("0");
            expect(await this.silo.balanceOfStalk(user3Address)).to.eq("0");
            expect(await this.rootToken.balanceOf(user3Address)).to.eq(
              "9999999"
            );
          });
        });
      });
    });
  });
});
