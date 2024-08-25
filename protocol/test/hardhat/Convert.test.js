const { expect } = require("chai");
const { deploy } = require("../../scripts/deploy.js");
const { EXTERNAL } = require("./utils/balances.js");
const { to6, to18 } = require("./utils/helpers.js");
const { ConvertEncoder } = require("./utils/encoder.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { getAllBeanstalkContracts } = require("../../utils/contracts");
const { getBean } = require("../../utils/contracts.js");
const { initializeUsersForToken, endGermination } = require("./utils/testHelpers.js");
let user, user2, owner;

describe("Convert", function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners();
    const contracts = await deploy((verbose = false), (mock = true), (reset = true));
    ownerAddress = contracts.account;
    userAddress = user.address;
    this.diamond = contracts.beanstalkDiamond;
    // `beanstalk` contains all functions that the regular beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [beanstalk, mockBeanstalk] = await getAllBeanstalkContracts(this.diamond.address);

    bean = await getBean();
    this.siloToken = await ethers.getContractFactory("MockToken");
    this.siloToken = await this.siloToken.deploy("Silo", "SILO");
    await this.siloToken.deployed();

    await initializeUsersForToken(bean.address, [user, user2], "1000000000");
    await initializeUsersForToken(this.siloToken.address, [user, user2], "10000");
    await mockBeanstalk.mockWhitelistToken(
      this.siloToken.address,
      mockBeanstalk.interface.getSighash("mockBDV(uint256 amount)"),
      "10000000000",
      1e6 // aka "1 seed"
    );

    // make 2 deposits, one at stem of 1, and another deposit at 2.
    await mockBeanstalk.siloSunrise(0);
    await beanstalk.connect(user).deposit(this.siloToken.address, "100", EXTERNAL);
    await mockBeanstalk.siloSunrise(0);
    await beanstalk.connect(user).deposit(this.siloToken.address, "100", EXTERNAL);
    
     // To isolate the anti lamda functionality, we will create and whitelist a new silo token
     this.newSiloToken = await ethers.getContractFactory("MockToken");
     this.newSiloToken = await this.newSiloToken.deploy("Silo2", "SILO2")
     await this.newSiloToken.deployed()
     await mockBeanstalk.mockWhitelistToken(
       this.newSiloToken.address, // token                        
       mockBeanstalk.interface.getSighash("newMockBDV()"), // selector (returns 1e6)
       '1', // stalkIssuedPerBdv
       1e6 //aka "1 seed" // stalkEarnedPerSeason
     );

    // To isolate the anti lamda functionality, we will create and whitelist a new silo token
    this.newSiloToken = await ethers.getContractFactory("MockToken");
    this.newSiloToken = await this.newSiloToken.deploy("Silo2", "SILO2");
    await this.newSiloToken.deployed();
    await mockBeanstalk.mockWhitelistToken(
      this.newSiloToken.address, // token
      mockBeanstalk.interface.getSighash("newMockBDV()"), // selector (returns 1e6)
      "1000000", // stalkIssuedPerBdv
      1e6 //aka "1 seed" // stalkEarnedPerSeason
    );

    // call sunrise twice, and end germination for the silo token.
    await endGermination();
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("Withdraw For Convert", async function () {
    describe("Revert", async function () {
      it("diff lengths", async function () {
        await expect(
          mockBeanstalk
            .connect(user)
            .withdrawForConvertE(this.siloToken.address, [to6("1"), to6("2")], ["100"], "100")
        ).to.be.revertedWith("Convert: stems, amounts are diff lengths.");
      });

      it("crate balance too low", async function () {
        //params are token, stem, amounts, maxtokens
        // await expect(mockBeanstalk.connect(user).withdrawForConvertE(this.siloToken.address, ['0'], ['150'], '150')).to.be.revertedWith('Silo: Crate balance too low.') //before moving to constants for the original 4 whitelisted tokens (post replant), this test would revert with 'Silo: Crate balance too low.', but now it reverts with 'Must line up with season' because there's no constant seeds amount hardcoded in for this test token
        await expect(
          mockBeanstalk
            .connect(user)
            .withdrawForConvertE(this.siloToken.address, [to6("2")], ["150"], "150")
        ).to.be.revertedWith("Silo: Crate balance too low.");
      });

      it("not enough removed", async function () {
        await expect(
          mockBeanstalk
            .connect(user)
            .withdrawForConvertE(this.siloToken.address, [to6("2")], ["100"], "150")
        ).to.be.revertedWith("Convert: Not enough tokens removed.");
      });
    });

    //this test withdraws from stem index of 2, verifies they are removed correctly and stalk balances updated
    describe("Withdraw 1 Crate", async function () {
      beforeEach(async function () {
        this.result = await mockBeanstalk
          .connect(user)
          .withdrawForConvertE(this.siloToken.address, [to6("2")], ["100"], "100", );
      });

      it("Emits event", async function () {
        await expect(this.result)
          .to.emit(beanstalk, "RemoveDeposits")
          .withArgs(user.address, this.siloToken.address, [2000000], ["100"], "100", ["100"]);
        await expect(this.result).to.emit(mockBeanstalk, "MockConvert").withArgs(to6("200"), "100");
      });

      it("Decrements totals", async function () {
        expect(await beanstalk.getTotalDeposited(this.siloToken.address)).to.equal("100");
        expect(await beanstalk.getTotalDepositedBdv(this.siloToken.address)).to.eq("100");
        expect(await beanstalk.totalStalk()).to.equal("1000300000000");
      });

      it("Decrements balances", async function () {
        expect(await beanstalk.balanceOfStalk(user.address)).to.equal("1000300000000");
      });

      it("properly removes the crate", async function () {
        let deposit = await beanstalk.getDeposit(user.address, this.siloToken.address, to6("1"));

        expect(deposit[0]).to.eq("100");
        expect(deposit[1]).to.eq("100");
        deposit = await beanstalk.getDeposit(user.address, this.siloToken.address, to6("2"));

        expect(deposit[0]).to.eq("0");
        expect(deposit[1]).to.eq("0");
      });
    });

    // this test withdraws from stem indexes of 2 and 1
    describe("Withdraw 1 Crate 2 input", async function () {
      beforeEach(async function () {
        this.result = await mockBeanstalk
          .connect(user)
          .withdrawForConvertE(this.siloToken.address, [to6("2"), to6("1")], ["100", "100"], "100");
      });

      it("Emits event", async function () {
        await expect(this.result)
          .to.emit(beanstalk, "RemoveDeposits")
          .withArgs(
            user.address,
            this.siloToken.address,
            [to6("2"), to6("1")],
            ["100", "0"],
            "100",
            ["100", "0"]
          );
        await expect(this.result).to.emit(mockBeanstalk, "MockConvert").withArgs(to6("200"), "100");
      });

      it("Decrements totals", async function () {
        expect(await beanstalk.getTotalDeposited(this.siloToken.address)).to.equal("100");
        expect(await beanstalk.getTotalDepositedBdv(this.siloToken.address)).to.eq("100");
        expect(await beanstalk.totalStalk()).to.equal("1000300000000");
      });

      it("Decrements balances", async function () {
        expect(await beanstalk.balanceOfStalk(user.address)).to.equal("1000300000000");
      });

      it("properly removes the crate", async function () {
        let deposit = await beanstalk.getDeposit(user.address, this.siloToken.address, to6("1"));
        expect(deposit[0]).to.eq("100");
        expect(deposit[1]).to.eq("100");
        deposit = await beanstalk.getDeposit(user.address, this.siloToken.address, to6("2"));
        expect(deposit[0]).to.eq("0");
        expect(deposit[1]).to.eq("0");
      });
    });

    //withdraws less than the full deposited amount from stem indexes of 2 and 1
    describe("Withdraw 2 Crates exact", async function () {
      beforeEach(async function () {
        this.result = await mockBeanstalk
          .connect(user)
          .withdrawForConvertE(this.siloToken.address, [to6("1"), to6("2")], ["100", "50"], "150");
      });

      it("Emits event", async function () {
        await expect(this.result)
          .to.emit(beanstalk, "RemoveDeposits")
          .withArgs(
            user.address,
            this.siloToken.address,
            [to6("1"), to6("2")],
            ["100", "50"],
            "150",
            ["100", "50"]
          );

        await expect(this.result).to.emit(mockBeanstalk, "MockConvert").withArgs(to6("400"), "150");
      });

      it("Decrements totals", async function () {
        expect(await beanstalk.getTotalDeposited(this.siloToken.address)).to.equal("50");
        expect(await beanstalk.getTotalDepositedBdv(this.siloToken.address)).to.eq("50");
        expect(await beanstalk.totalStalk()).to.equal("500100000000");
        //expect(await beanstalk.totalSeeds()).to.equal('50');
      });

      it("Decrements balances", async function () {
        expect(await beanstalk.balanceOfStalk(user.address)).to.equal("500100000000");
      });

      it("properly removes the crate", async function () {
        let deposit = await beanstalk.getDeposit(user.address, this.siloToken.address, to6("1"));
        expect(deposit[0]).to.eq("0");
        expect(deposit[1]).to.eq("0");
        deposit = await beanstalk.getDeposit(user.address, this.siloToken.address, to6("2"));
        expect(deposit[0]).to.eq("50");
        expect(deposit[1]).to.eq("50");
      });
    });

    describe("Withdraw 2 Crates under", async function () {
      beforeEach(async function () {
        this.result = await mockBeanstalk
          .connect(user)
          .withdrawForConvertE(this.siloToken.address, [to6("1"), to6("2")], ["100", "100"], "150");
      });

      it("Emits event", async function () {
        await expect(this.result)
          .to.emit(beanstalk, "RemoveDeposits")
          .withArgs(
            user.address,
            this.siloToken.address,
            [to6("1"), to6("2")],
            ["100", "50"],
            "150",
            ["100", "50"]
          );
        await expect(this.result).to.emit(mockBeanstalk, "MockConvert").withArgs(to6("400"), "150");
      });

      it("Decrements totals", async function () {
        expect(await beanstalk.getTotalDeposited(this.siloToken.address)).to.equal("50");
        expect(await beanstalk.getTotalDepositedBdv(this.siloToken.address)).to.eq("50");
        expect(await beanstalk.totalStalk()).to.equal("500100000000");
      });

      it("Decrements balances", async function () {
        expect(await beanstalk.balanceOfStalk(user.address)).to.equal("500100000000");
      });

      it("properly removes the crate", async function () {
        let deposit = await beanstalk.getDeposit(user.address, this.siloToken.address, to6("1"));
        expect(deposit[0]).to.eq("0");
        expect(deposit[1]).to.eq("0");
        deposit = await beanstalk.getDeposit(user.address, this.siloToken.address, to6("2"));
        expect(deposit[0]).to.eq("50");
        expect(deposit[1]).to.eq("50");
      });
    });
  });

  describe("Deposit For Convert", async function () {
    describe("Revert", async function () {
      it("Reverts if BDV is 0", async function () {
        await expect(
          mockBeanstalk
            .connect(user)
            .depositForConvertE(this.siloToken.address, "100", "0", "100000000")
        ).to.be.revertedWith("Convert: BDV or amount is 0.");
      });

      it("Reverts if amount is 0", async function () {
        await expect(
          mockBeanstalk
            .connect(user)
            .depositForConvertE(this.siloToken.address, "0", "100", "100000000")
        ).to.be.revertedWith("Convert: BDV or amount is 0.");
      });
    });

    // with the germination update, deposits that are germinating cannot be
    // converted. However, there are instances where a non-germinating deposit
    // is converted into a partially germinating deposit. This test checks that the
    // convert function properly handles this case.
    describe("Deposit not germinating", async function () {
      beforeEach(async function () {
        expect(await beanstalk.getTotalDeposited(this.siloToken.address)).to.equal("200");
        expect(await beanstalk.getTotalDepositedBdv(this.siloToken.address)).to.eq("200");
        expect(await beanstalk.totalStalk()).to.equal("2000100000000");
        expect(await beanstalk.getGerminatingTotalDeposited(this.siloToken.address)).to.equal("0");
        expect(await beanstalk.getGerminatingTotalDepositedBdv(this.siloToken.address)).to.eq("0");
        expect(await beanstalk.getTotalGerminatingStalk()).to.equal("0");
        this.result = await mockBeanstalk
          .connect(user2)
          .depositForConvertE(this.siloToken.address, "100", "100", "100000000");
      });

      it("Emits event", async function () {
        await expect(this.result)
          .to.emit(beanstalk, "AddDeposit")
          .withArgs(user2.address, this.siloToken.address, to6("3"), "100", "100");
      });

      it("Increment totals", async function () {
        expect(await beanstalk.getTotalDeposited(this.siloToken.address)).to.equal("200");
        expect(await beanstalk.getTotalDepositedBdv(this.siloToken.address)).to.eq("200");
        expect(await beanstalk.totalStalk()).to.equal("2000200000000");
        expect(await beanstalk.getGerminatingTotalDeposited(this.siloToken.address)).to.equal(
          "100"
        );
        expect(await beanstalk.getGerminatingTotalDepositedBdv(this.siloToken.address)).to.eq(
          "100"
        );
        expect(await beanstalk.getTotalGerminatingStalk()).to.equal("1000000000000");
      });
      // user 2 should have stalk == grown stalk
      it("Increment balances", async function () {
        expect(await beanstalk.balanceOfStalk(user2.address)).to.equal("100000000");
        expect(await beanstalk.balanceOfGerminatingStalk(user2.address)).to.equal("1000000000000");
      });

      it("properly adds the crate", async function () {
        const deposit = await beanstalk.getDeposit(user2.address, this.siloToken.address, to6("3"));
        expect(deposit[0]).to.eq("100");
        expect(deposit[1]).to.eq("100");
      });
    });

    describe("Deposit Tokens with grown stalk", async function () {
      beforeEach(async function () {
        expect(await beanstalk.getTotalDeposited(this.siloToken.address)).to.equal("200");
        expect(await beanstalk.getTotalDepositedBdv(this.siloToken.address)).to.eq("200");
        expect(await beanstalk.totalStalk()).to.equal("2000100000000");
        expect(await beanstalk.getGerminatingTotalDeposited(this.siloToken.address)).to.equal("0");
        expect(await beanstalk.getGerminatingTotalDepositedBdv(this.siloToken.address)).to.eq("0");
        expect(await beanstalk.getTotalGerminatingStalk()).to.equal("0");
        this.result = await mockBeanstalk
          .connect(user2)
          .depositForConvertE(this.siloToken.address, "100", "100", "300000000");
      });

      it("Emits event", async function () {
        // at 300 grown stalk, this would need to have been deposited 3 seasons ago, or at grown stalk index of 1.
        // with the current grown stalk index at 4, 3 seasons ago would be 1.
        await expect(this.result)
          .to.emit(beanstalk, "AddDeposit")
          .withArgs(user2.address, this.siloToken.address, to6("1"), "100", "100");
      });

      it("Increment totals", async function () {
        expect(await beanstalk.getTotalDeposited(this.siloToken.address)).to.equal("300");
        expect(await beanstalk.getTotalDepositedBdv(this.siloToken.address)).to.eq("300");
        expect(await beanstalk.totalStalk()).to.equal("3000400000000");
        expect(await beanstalk.getGerminatingTotalDeposited(this.siloToken.address)).to.equal("0");
        expect(await beanstalk.getGerminatingTotalDepositedBdv(this.siloToken.address)).to.eq("0");
        expect(await beanstalk.getTotalGerminatingStalk()).to.equal("0");
      });

      it("Increment balances", async function () {
        expect(await beanstalk.balanceOfStalk(user2.address)).to.equal("1000300000000");
        expect(await beanstalk.balanceOfGerminatingStalk(user2.address)).to.equal("0");
      });

      it("properly adds the crate", async function () {
        const deposit = await beanstalk.getDeposit(user2.address, this.siloToken.address, to6("1"));
        expect(deposit[0]).to.eq("100");
        expect(deposit[1]).to.eq("100");
      });
    });
  });

  describe("lambda convert", async function () {
    beforeEach(async function () {
      this.result = await beanstalk
        .connect(user)
        .callStatic.convert(
          ConvertEncoder.convertLambdaToLambda("100", this.siloToken.address),
          [to6("2")],
          ["100"]
        );
      expect(this.result.toStem).to.be.equal(to6("2"));
      expect(this.result.toAmount).to.be.equal("100");

      this.result = await beanstalk
        .connect(user)
        .convert(
          ConvertEncoder.convertLambdaToLambda("200", this.siloToken.address),
          [to6("1"), to6("2")],
          ["100", "100"]
        );
    });

    it("returns correct value", async function () {});

    it("removes and adds deposit", async function () {
      let deposit = await beanstalk.getDeposit(user.address, this.siloToken.address, to6("1"));
      expect(deposit[0]).to.eq("0");
      expect(deposit[1]).to.eq("0");

      deposit = await beanstalk.getDeposit(user.address, this.siloToken.address, to6("2"));
      expect(deposit[0]).to.eq("0");
      expect(deposit[1]).to.eq("0");

      deposit = await beanstalk.getDeposit(user.address, this.siloToken.address, to6("1.5"));
      expect(deposit[0]).to.eq("200");
      expect(deposit[1]).to.eq("200");
    });

    it("Increments balances", async function () {
      expect(await beanstalk.balanceOfStalk(user.address)).to.equal("2000500000000");
    });

    it("Increments totals", async function () {
      expect(await beanstalk.getTotalDeposited(this.siloToken.address)).to.equal("200");
      expect(await beanstalk.getTotalDepositedBdv(this.siloToken.address)).to.eq("200");
      expect(await beanstalk.totalStalk()).to.equal("2000500000000");
    });

    it("Emits events", async function () {
      await expect(this.result)
        .to.emit(beanstalk, "RemoveDeposits")
        .withArgs(
          user.address,
          this.siloToken.address,
          [to6("1"), to6("2")],
          ["100", "100"],
          "200",
          ["100", "100"]
        );
      await expect(this.result)
        .to.emit(beanstalk, "AddDeposit")
        .withArgs(user.address, this.siloToken.address, to6("1.5"), "200", "200");
    });
  });

  //  ------------------------------ ANTI LAMBDA CONVERT ----------------------------------

  describe("anti lambda convert bdv decrease", async function () {
    beforeEach(async function () {
      // ----------------------- SETUP ------------------------
      // user deposits 100 new silo token at stem 0 so 1000000 bdv
      await this.newSiloToken.mint(userAddress, "10000000");
      await this.newSiloToken.connect(user).approve(mockBeanstalk.address, "1000000000");
      await mockBeanstalk.connect(user).deposit(this.newSiloToken.address, "100", EXTERNAL);
      this.stem = await mockBeanstalk.stemTipForToken(this.newSiloToken.address);
      await endGermination();

      // simulate deposit bdv decrease for user by changing bdv selector to newMockBDVDecrease ie 0.9e6
      await mockBeanstalk.mockChangeBDVSelector(
        this.newSiloToken.address,
        mockBeanstalk.interface.getSighash("newMockBDVDecrease()")
      );
      const currentBdv = await mockBeanstalk.newMockBDVDecrease();
      let depositResult = await mockBeanstalk.getDeposit(
        userAddress,
        this.newSiloToken.address,
        this.stem
      );
      const depositBdv = depositResult[1];

      console.log("stem tip for new silo token: ", this.stem);
      console.log("current bdv: ", currentBdv);
      console.log("deposit bdv: ", depositBdv);

      // ----------------------- CONVERT ------------------------
      this.result = await mockBeanstalk.connect(user2).convert(
        // CALLDATA                              // amount, token ,account
        ConvertEncoder.convertAntiLambdaToLambda("100", this.newSiloToken.address, userAddress),
        // STEMS []
        [this.stem],
        // AMOUNTS []
        ["100"]
      );
      this.newStem = 1777778;
    });

    it("Correctly updates deposit stats", async function () {
      let deposit = await mockBeanstalk.getDeposit(
        userAddress,
        this.newSiloToken.address,
        this.newStem
      );
      expect(deposit[0]).to.eq("100"); // deposit[0] = amount of tokens
      expect(deposit[1]).to.eq("900000"); // deposit[1] = bdv
    });

    it("Correctly updates totals", async function () {
      expect(await mockBeanstalk.getTotalDeposited(this.newSiloToken.address)).to.equal("100");
      expect(await mockBeanstalk.getTotalDepositedBdv(this.newSiloToken.address)).to.eq("900000");
      // 100000 stalk removed = 1 stalk/bdv for newSiloToken * 100000 bdv removed from convert
      expect(await mockBeanstalk.totalStalk()).to.equal(to6("4900100"));
    });

    it("Emits events", async function () {
      await expect(this.result)
        .to.emit(mockBeanstalk, "RemoveDeposits")
        .withArgs(userAddress, this.newSiloToken.address, [this.stem], ["100"], "100", ["1000000"]);
      await expect(this.result)
        .to.emit(mockBeanstalk, "AddDeposit")
        .withArgs(userAddress, this.newSiloToken.address, this.newStem, "100", "900000"); // last param = updated bdv
      await expect(this.result)
        .to.emit(mockBeanstalk, "Convert")
        .withArgs(userAddress, this.newSiloToken.address, this.newSiloToken.address, "100", "100");
    });
  });

  describe("anti lambda convert bdv increase", async function () {
    beforeEach(async function () {
      // ----------------------- SETUP ------------------------
      // user deposits 100 new silo token at stem 0 so 1000000 bdv
      await this.newSiloToken.mint(userAddress, "10000000");
      await this.newSiloToken.connect(user).approve(mockBeanstalk.address, "1000000000");
      await mockBeanstalk.connect(user).deposit(this.newSiloToken.address, "100", EXTERNAL);
      this.stem = await mockBeanstalk.stemTipForToken(this.newSiloToken.address);

      // end germination:
      await mockBeanstalk.siloSunrise(0);
      await mockBeanstalk.siloSunrise(0);

      // simulate deposit bdv increase for user2 by changing bdv selector to mockBdvIncrease ie 1.1e6
      await mockBeanstalk.mockChangeBDVSelector(
        this.newSiloToken.address,
        mockBeanstalk.interface.getSighash("newMockBDVIncrease()")
      );
      currentBdv = await mockBeanstalk.newMockBDVIncrease();
      let depositResult = await mockBeanstalk.getDeposit(
        userAddress,
        this.newSiloToken.address,
        this.stem
      );
      const depositBdv = depositResult[1];

      // ----------------------- CONVERT ------------------------
      this.result = await mockBeanstalk.connect(user2).convert(
        // CALLDATA
        // amount, token ,account
        ConvertEncoder.convertAntiLambdaToLambda("100", this.newSiloToken.address, userAddress),
        // STEMS []
        [this.stem],
        // AMOUNTS []
        ["100"]
      );
      this.newStem = 2181819;
    });

    it("Correctly updates deposit stats", async function () {
      let deposit = await mockBeanstalk.getDeposit(
        userAddress,
        this.newSiloToken.address,
        this.newStem
      );
      expect(deposit[0]).to.eq("100"); // deposit[0] = amount of tokens
      expect(deposit[1]).to.eq("1100000"); // deposit[1] = bdv
    });

    it("Correctly updates totals", async function () {
      expect(await mockBeanstalk.getTotalDeposited(this.newSiloToken.address)).to.equal("100");
      expect(await mockBeanstalk.getTotalDepositedBdv(this.newSiloToken.address)).to.eq("1100000");
      // 100000 stalk added = 1 stalk/bdv for newSiloToken * 100000 bdv added from convert
      expect(await mockBeanstalk.totalStalk()).to.equal(to6("5100100"));
    });

    it("Emits events", async function () {
      await expect(this.result)
        .to.emit(mockBeanstalk, "RemoveDeposits")
        .withArgs(userAddress, this.newSiloToken.address, [this.stem], ["100"], "100", ["1000000"]);
      await expect(this.result)
        .to.emit(mockBeanstalk, "AddDeposit")
        .withArgs(userAddress, this.newSiloToken.address, this.newStem, "100", "1100000"); // last param = updated bdv
      await expect(this.result)
        .to.emit(mockBeanstalk, "Convert")
        .withArgs(userAddress, this.newSiloToken.address, this.newSiloToken.address, "100", "100");
    });
  });

  describe("anti lambda convert revert on multiple deposit update", async function () {
    it("Reverts on multiple deposit input", async function () {
      // ----------------------- SETUP ------------------------
      // user deposits 100 new silo token at stem 0 so 1000000 bdv
      await this.newSiloToken.mint(userAddress, "10000000");
      await this.newSiloToken.connect(user).approve(mockBeanstalk.address, "1000000000");
      await mockBeanstalk.connect(user).deposit(this.newSiloToken.address, "100", EXTERNAL);
      this.stem = await mockBeanstalk.stemTipForToken(this.newSiloToken.address);

      // end germination:
      await mockBeanstalk.siloSunrise(0);
      await mockBeanstalk.siloSunrise(0);

      // ----------------------- CONVERT ------------------------
      await expect(
        mockBeanstalk.connect(user2).convert(
          // CALLDATA
          // amount, token ,account
          ConvertEncoder.convertAntiLambdaToLambda("100", this.newSiloToken.address, userAddress),
          // STEMS []
          [this.stem, this.stem],
          // AMOUNTS []
          ["100", "100"]
        )
      ).to.be.revertedWith("Convert: DecreaseBDV only supports updating one deposit.");
    });
  });
});
