const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { readPrune, toBN, signSiloDepositTokenPermit, signSiloDepositTokensPermit } = require("../utils");
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require("./utils/balances.js");
const { BEAN, THREE_POOL, BEAN_3_CURVE, UNRIPE_LP, UNRIPE_BEAN, THREE_CURVE } = require("./utils/constants");
const { to18, to6, toStalk, toBean } = require("./utils/helpers.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { time, mineUpTo, mine } = require("@nomicfoundation/hardhat-network-helpers");
const ZERO_BYTES = ethers.utils.formatBytes32String('0x0')

let user, user2, owner;
let userAddress, ownerAddress, user2Address;

let pru;


function pruneToStalk(value) {
  return prune(value).mul(toBN("10000"));
}

function prune(value) {
  return toBN(value).mul(toBN(pru)).div(to18("1"));
}

describe("Silo Token", function () {
  before(async function () {
    pru = await readPrune();
    [owner,user,user2,flashLoanExploiter] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    flashLoanExploiterAddress = flashLoanExploiter.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address);
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address);
    this.migrate = await ethers.getContractAt('MigrationFacet', this.diamond.address);
    this.convert = await ethers.getContractAt('ConvertFacet', this.diamond.address);
    this.approval = await ethers.getContractAt('ApprovalFacet', this.diamond.address);
    this.convert = await ethers.getContractAt('MockConvertFacet', this.diamond.address);
    this.unripe = await ethers.getContractAt('MockUnripeFacet', this.diamond.address);
    this.enroot = await ethers.getContractAt('EnrootFacet', this.diamond.address)

    this.threeCurve = await ethers.getContractAt("MockToken", THREE_CURVE);
    this.beanMetapool = await ethers.getContractAt("IMockCurvePool", BEAN_3_CURVE);
    await this.beanMetapool.set_supply(ethers.utils.parseUnits("2000000", 6));
    await this.beanMetapool.set_balances([ethers.utils.parseUnits("1000000", 6), ethers.utils.parseEther("1000000")]);

    const SiloToken = await ethers.getContractFactory("MockToken");
    this.siloToken = await SiloToken.deploy("Silo", "SILO");
    await this.siloToken.deployed();

    this.siloToken2 = await SiloToken.deploy("Silo", "SILO");
    await this.siloToken2.deployed();

    await this.season.teleportSunrise(10);
    this.season.deployStemsUpgrade();

    await this.silo.mockWhitelistToken(
      this.siloToken.address, 
      this.silo.interface.getSighash("mockBDV(uint256 amount)"), 
      '10000',
      1e6 //aka "1 seed"
      );

    await this.season.siloSunrise(0);
    await this.siloToken.connect(user).approve(this.silo.address, "100000000000");
    await this.siloToken.connect(user2).approve(this.silo.address, "100000000000");
    await this.siloToken.mint(userAddress, "10000");
    await this.siloToken.mint(user2Address, "10000");
    await this.siloToken2.connect(user).approve(this.silo.address, "100000000000");
    await this.siloToken2.mint(userAddress, "10000");

    await this.siloToken.connect(owner).approve(this.silo.address, to18("10000"));
    await this.siloToken.mint(ownerAddress, to18("10000"));

    this.unripeBeans = await ethers.getContractAt("MockToken", UNRIPE_BEAN);
    await this.unripeBeans.connect(user).mint(userAddress, to6("10000"));
    await this.unripeBeans.connect(user).approve(this.silo.address, to18("10000"));
    await this.unripe.addUnripeToken(UNRIPE_BEAN, this.siloToken.address, ZERO_BYTES);
    await this.unripe.connect(owner).addUnderlying(UNRIPE_BEAN, to6("10000").mul(toBN(pru)).div(to18("1")));

    this.unripeLP = await ethers.getContractAt("MockToken", UNRIPE_LP);
    await this.unripeLP.connect(user).mint(userAddress, to6("10000"));
    await this.unripeLP.connect(user).approve(this.silo.address, to18("10000"));
    await this.unripe.addUnripeToken(UNRIPE_LP, this.siloToken.address, ZERO_BYTES);
    await this.unripe.connect(owner).addUnderlying(UNRIPE_LP, toBN(pru).mul(toBN("10000")));

    this.beanThreeCurve = await ethers.getContractAt("MockMeta3Curve", BEAN_3_CURVE);
    await this.beanThreeCurve.set_supply(ethers.utils.parseEther("2000000"));
    await this.beanThreeCurve.set_balances([ethers.utils.parseUnits("1000000", 6), ethers.utils.parseEther("1000000")]);
    await this.beanThreeCurve.set_balances([ethers.utils.parseUnits("1200000", 6), ethers.utils.parseEther("1000000")]);
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("deposit", function () {
    describe("reverts", function () {
      it("reverts if BDV is 0", async function () {
        await expect(this.silo.connect(user).deposit(this.siloToken.address, "0", EXTERNAL)).to.revertedWith("Silo: No Beans under Token.");
      });

      it('reverts if deposits a non whitelisted token', async function () {
        await expect(this.silo.connect(user).deposit(this.siloToken2.address, '0', EXTERNAL)).to.revertedWith('Silo: Token not whitelisted');
      });
    });

    describe("single deposit", function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(10);
        this.season.deployStemsUpgrade();
        this.result = await this.silo.connect(user).deposit(this.siloToken.address, '1000', EXTERNAL)
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.eq('1000');
        expect(await this.silo.getTotalDepositedBdv(this.siloToken.address)).to.eq('1000');
        //expect(await this.silo.totalSeeds()).to.eq('1000');
        expect(await this.silo.totalStalk()).to.eq('10000000');
      });
  
      it('properly updates the user balance', async function () {
        //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('1000');
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq('10000000');
      });
  
      it('properly adds the crate', async function () {
        const stem = await this.silo.seasonToStem(this.siloToken.address, '10');

        const deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, stem);

        expect(deposit[0]).to.eq('1000');
        expect(deposit[1]).to.eq('1000');
      })

      it('emits Deposit event', async function () {
        const stem = await this.silo.seasonToStem(this.siloToken.address, '10');
        await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(userAddress, this.siloToken.address, stem, '1000', '1000');
      });

      //it uses grownStalkForDeposit to verify the deposit amount is correct
      it('verifies the grown stalk for deposit is correct', async function () {
        expect(await this.silo.grownStalkForDeposit(userAddress, this.siloToken.address, 0)).to.eq(to6('0'));
        //verify still correct after one season
        await this.season.lightSunrise();
        expect(await this.silo.grownStalkForDeposit(userAddress, this.siloToken.address, 0)).to.eq('1000');
      });
    });
  
    describe('2 deposits same grown stalk per bdv', function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(10);
        this.season.deployStemsUpgrade();
        this.result = await this.silo.connect(user).deposit(this.siloToken.address, '1000', EXTERNAL)
        this.result = await this.silo.connect(user).deposit(this.siloToken.address, '1000', EXTERNAL)
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.eq('2000');
        expect(await this.silo.getTotalDepositedBdv(this.siloToken.address)).to.eq('2000');
        //expect(await this.silo.totalSeeds()).to.eq('2000');
        expect(await this.silo.totalStalk()).to.eq('20000000');
      });
  
      it('properly updates the user balance', async function () {
        //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('2000');
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq('20000000');
      });
  
      it('properly adds the crate', async function () {
        const stem = await this.silo.seasonToStem(this.siloToken.address, '10');
        const deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, stem);
        expect(deposit[0]).to.eq('2000');
        expect(deposit[1]).to.eq('2000');
      })
    });

    describe("2 deposits 2 users", function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(10);
        this.season.deployStemsUpgrade();
        this.result = await this.silo.connect(user).deposit(this.siloToken.address, '1000', EXTERNAL);
        this.result = await this.silo.connect(user2).deposit(this.siloToken.address, '1000', EXTERNAL);
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.eq('2000');
        expect(await this.silo.getTotalDepositedBdv(this.siloToken.address)).to.eq('2000');
        //expect(await this.silo.totalSeeds()).to.eq('2000');
        expect(await this.silo.totalStalk()).to.eq('20000000');
      });
  
      it('properly updates the user balance', async function () {
        //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('1000');
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq('10000000');
      });
      it('properly updates the user2 balance', async function () {
        //expect(await this.silo.balanceOfSeeds(user2Address)).to.eq('1000');
        expect(await this.silo.balanceOfStalk(user2Address)).to.eq('10000000');
      });
  
      it('properly adds the crate', async function () {
        const stem = await this.silo.seasonToStem(this.siloToken.address, '10');
        let deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, stem);
        expect(deposit[0]).to.eq('1000');
        expect(deposit[1]).to.eq('1000');
        deposit = await this.silo.getDeposit(user2Address, this.siloToken.address, stem);
        expect(deposit[0]).to.eq('1000');
        expect(deposit[1]).to.eq('1000');
      });
    });
  });

  describe("withdraw", function () {
    beforeEach(async function () {
      await this.season.teleportSunrise(10);
      // this.season.deployStemsUpgrade();
      await this.silo.connect(user).deposit(this.siloToken.address, '1000', EXTERNAL);
      await mineUpTo((await ethers.provider.getBlockNumber()) + 11 + 1);
    })
    describe('reverts', function () {
      it('reverts if amount is 0', async function () {
        const stem = await this.silo.seasonToStem(this.siloToken.address, '10');
        await expect(this.silo.connect(user).withdrawDeposit(this.siloToken.address, stem, '1001', EXTERNAL)).to.revertedWith('Silo: Crate balance too low.');
      });

      it('reverts if deposits + withdrawals is a different length', async function () {
        await expect(this.silo.connect(user).withdrawDeposits(this.siloToken.address, ['1', '2'], ['1001'], EXTERNAL)).to.revertedWith('Silo: Crates, amounts are diff lengths.');
      });
    });

    describe("withdraw token by season", async function () {
      describe("withdraw 1 Bean crate", async function () {
        beforeEach(async function () {
          const stem = await this.silo.seasonToStem(this.siloToken.address, '10');
          userBalanceBefore = await this.siloToken.balanceOf(userAddress);
          this.result = await this.silo.connect(user).withdrawDeposit(this.siloToken.address, stem, '1000', EXTERNAL);
        });
    
        it('properly updates the total balances', async function () {
          expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.eq('0');
          expect(await this.silo.getTotalDepositedBdv(this.siloToken.address)).to.eq('0');
          expect(await this.silo.totalStalk()).to.eq('0');
          //expect(await this.silo.totalSeeds()).to.eq('0');
        });

        it('properly updates the user balance', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq('0');
          //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('0');
          expect((await this.siloToken.balanceOf(userAddress)).sub(userBalanceBefore)).to.eq('1000');
        });

        

        it('properly removes the deposit', async function () {
          const stem = await this.silo.seasonToStem(this.siloToken.address, '10');
          const deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, stem);
          expect(deposit[0]).to.eq('0');
          expect(deposit[1]).to.eq('0');
        });

        // it('properly adds the withdrawal', async function () {
        //   expect(await this.silo.getWithdrawal(userAddress, this.siloToken.address, 27)).to.eq('1000');
        // });
    
        it('emits RemoveDeposit event', async function () {
          const stem = await this.silo.seasonToStem(this.siloToken.address, '10');
          await expect(this.result).to.emit(this.silo, 'RemoveDeposit').withArgs(userAddress, this.siloToken.address, stem, '1000', '1000');
        });
      });

      describe("withdraw part of a bean crate", function () {
        beforeEach(async function () {
          const grownStalkPerBdv = await this.silo.seasonToStem(this.siloToken.address, '10');
          this.result = await this.silo.connect(user).withdrawDeposit(this.siloToken.address, grownStalkPerBdv, '500', EXTERNAL);
        });
    
        it('properly updates the total balances', async function () {
          expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.eq('500');
          expect(await this.silo.getTotalDepositedBdv(this.siloToken.address)).to.eq('500');
          expect(await this.silo.totalStalk()).to.eq('5000000');
          //expect(await this.silo.totalSeeds()).to.eq('500');
        });
        it('properly updates the user balance', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq('5000000');
          //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('500');
          expect((await this.siloToken.balanceOf(userAddress)).sub(userBalanceBefore)).to.eq('500');
        });

        it('properly removes the deposit', async function () {
          const stem = await this.silo.seasonToStem(this.siloToken.address, '10');
          const deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, stem);
          expect(deposit[0]).to.eq('500');
          expect(deposit[1]).to.eq('500');
        });

        // it('properly adds the withdrawal', async function () {
        //   expect(await this.silo.getWithdrawal(userAddress, this.siloToken.address, 27)).to.eq('500');
        // });

        it('emits RemoveDeposit event', async function () {
          const stem = await this.silo.seasonToStem(this.siloToken.address, '10');
          await expect(this.result).to.emit(this.silo, 'RemoveDeposit').withArgs(userAddress, this.siloToken.address, stem, '500', '500');
        });
      });
    });

    describe("withdraw token by seasons", async function () {
      describe("1 full and 1 partial token crates", function () {
        beforeEach(async function () {
          await this.season.teleportSunrise(10);
          this.season.deployStemsUpgrade();
          await this.season.siloSunrise(0);
          await this.silo.connect(user).deposit(this.siloToken.address, '1000', EXTERNAL);
          userBalanceBefore = await this.siloToken.balanceOf(userAddress);
          await mineUpTo((await ethers.provider.getBlockNumber()) + 11 + 1);
          this.result = await this.silo.connect(user).withdrawDeposits(this.siloToken.address, [0,1],['500','1000'], EXTERNAL);
        });
    
        it('properly updates the total balances', async function () {
          expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.eq('500');
          expect(await this.silo.getTotalDepositedBdv(this.siloToken.address)).to.eq('500');
          expect(await this.silo.totalStalk()).to.eq('5000500');
          //expect(await this.silo.totalSeeds()).to.eq('500');
        });
        it('properly updates the user balance', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq('5000500');
          //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('500');
          expect((await this.siloToken.balanceOf(userAddress)).sub(userBalanceBefore)).to.eq('1500');

        });
        it('properly removes the crate', async function () {
          let dep = await this.silo.getDeposit(userAddress, this.siloToken.address, 0);
          expect(dep[0]).to.equal('500')
          expect(dep[1]).to.equal('500')
          dep = await this.silo.getDeposit(userAddress, this.siloToken.address, 1);
          expect(dep[0]).to.equal('0')
          expect(dep[1]).to.equal('0')
        });
        it('emits RemoveDeposits event', async function () {
          await expect(this.result).to.emit(this.silo, 'RemoveDeposits').withArgs(userAddress, this.siloToken.address, [0,1], ['500', '1000'], '1500', ['500', '1000']);
        });
      });
      describe("2 token crates", function () {
        beforeEach(async function () {
          await this.season.teleportSunrise(10);
          this.season.deployStemsUpgrade();
          await this.season.siloSunrise(0);
          await this.silo.connect(user).deposit(this.siloToken.address, '1000', EXTERNAL);
          userBalanceBefore = await this.siloToken.balanceOf(userAddress);
          await mineUpTo((await ethers.provider.getBlockNumber()) + 11 + 1);
          this.result = await this.silo.connect(user).withdrawDeposits(this.siloToken.address, [0,1],['1000','1000'], EXTERNAL);
        });
    
        it('properly updates the total balances', async function () {
          expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.eq('0');
          expect(await this.silo.getTotalDepositedBdv(this.siloToken.address)).to.eq('0');
          expect(await this.silo.totalStalk()).to.eq('0');
          //expect(await this.silo.totalSeeds()).to.eq('0');
        });
        it('properly updates the user balance', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq('0');
          //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('0');
          expect((await this.siloToken.balanceOf(userAddress)).sub(userBalanceBefore)).to.eq('2000');
        });
        it('properly removes the crate', async function () {
          let dep = await this.silo.getDeposit(userAddress, this.siloToken.address, 0);
          expect(dep[0]).to.equal('0')
          expect(dep[1]).to.equal('0')
          dep = await this.silo.getDeposit(userAddress, this.siloToken.address, 1);
          expect(dep[0]).to.equal('0')
          expect(dep[1]).to.equal('0')
        });
        it('emits RemoveDeposits event', async function () {
          await expect(this.result).to.emit(this.silo, 'RemoveDeposits').withArgs(userAddress, this.siloToken.address, [0,1], ['1000', '1000'], '2000', ['1000', '1000']);
        });
      });
    });
  });

  describe("Curve BDV", async function () {
    before(async function () {
      this.threePool = await ethers.getContractAt("Mock3Curve", THREE_POOL);
      await this.threePool.set_virtual_price(ethers.utils.parseEther("1"));
      this.beanThreeCurve = await ethers.getContractAt("MockMeta3Curve", BEAN_3_CURVE);
      await this.beanThreeCurve.set_supply(ethers.utils.parseEther("2000000"));
      await this.beanThreeCurve.set_A_precise("1000");
      await this.beanThreeCurve.set_virtual_price(ethers.utils.parseEther("1"));
      await this.beanThreeCurve.set_balances([ethers.utils.parseUnits("1000000", 6), ethers.utils.parseEther("1000000")]);
      await this.beanThreeCurve.set_balances([ethers.utils.parseUnits("1200000", 6), ethers.utils.parseEther("1000000")]);
    });

    it("properly checks bdv", async function () {
      this.curveBDV = await ethers.getContractAt("BDVFacet", this.diamond.address);
      expect(await this.curveBDV.curveToBDV(ethers.utils.parseEther("200"))).to.equal(ethers.utils.parseUnits("200", 6));
    });

    it("properly checks bdv", async function () {
      await this.threePool.set_virtual_price(ethers.utils.parseEther("1.02"));
      this.curveBDV = await ethers.getContractAt("BDVFacet", this.diamond.address);
      expect(await this.curveBDV.curveToBDV(ethers.utils.parseEther("2"))).to.equal("1998191");
    });
  });

  /*
  //can no longer withdraw unripe beans without doing the stems migration
  describe('Withdraw Unripe Beans', async function () {
    describe("Just legacy Bean Deposit", async function () {
      beforeEach(async function () {
        //fast forward to season 10 because that's the zero point for our stem index
        await this.season.teleportSunrise(10);
        this.season.deployStemsUpgrade();

        await this.silo.connect(user).mockUnripeBeanDeposit('10', to6('10')) //deposit in season 10
        
      })

      it("Check mock works", async function () {
        expect(await this.silo.getTotalDeposited(UNRIPE_BEAN)).to.eq(to6('10'));
        expect(await this.silo.totalStalk()).to.eq(pruneToStalk(to6('10')));
        //expect(await this.silo.totalSeeds()).to.eq(pruneToSeeds(to6('10')));
      })

      it('get Deposit', async function () {
        //if the deposit season was 2, what should the stem be?
        //call silo.stemToSeason()
        const stem = await this.silo.seasonToStem(UNRIPE_BEAN, '10');

        const deposit = await this.silo.getDeposit(user.address, UNRIPE_BEAN, stem)
        expect(deposit[0]).to.equal(to6('10'))
        expect(deposit[1]).to.equal(prune(to6('10')))
      })
      
      it('revert if withdrawn too much', async function () {
        const grownStalkPerBdv = await this.silo.seasonToStem(UNRIPE_BEAN, '10');
        await expect(this.silo.connect(user).withdrawDeposit(UNRIPE_BEAN, grownStalkPerBdv, to6('11'), EXTERNAL)).to.be.revertedWith('Silo: Crate balance too low.')
      });

      it("revert if withdrawn too much", async function () {
        await expect(this.silo.connect(user).withdrawDeposit(UNRIPE_BEAN, "2", to6("11"))).to.be.revertedWith(
          "Silo: Crate balance too low."
        );
      });

      describe("Withdraw", async function () {
        beforeEach(async function () {
          userBalanceBefore = await this.unripeBeans.balanceOf(userAddress);

          const stem = await this.silo.seasonToStem(UNRIPE_BEAN, '10');

          this.result = await this.silo.connect(user).withdrawDeposit(UNRIPE_BEAN, grownStalkPerBdv, to6('1'), EXTERNAL)
        })

        it('properly updates the total balances', async function () {
          expect(await this.silo.getTotalDeposited(UNRIPE_BEAN)).to.eq(to6('9'));
          expect(await this.silo.totalStalk()).to.eq(pruneToStalk(to6('9')));
        });
        it('properly updates the user balance', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq(pruneToStalk(to6('9')));
          //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(pruneToSeeds(to6('9')));
          expect((await this.unripeBeans.balanceOf(userAddress)).sub(userBalanceBefore)).to.eq(to6('1'));
        });
        
        it('properly removes the crate', async function () {
          const stem = await this.silo.seasonToStem(UNRIPE_BEAN, '10');
          let dep = await this.silo.getDeposit(userAddress, UNRIPE_BEAN, stem);
          expect(dep[0]).to.equal(to6('9'))
          expect(dep[1]).to.equal(prune(to6('9')))
        });
        it('emits RemoveDeposit event', async function () {
          const stem = await this.silo.seasonToStem(UNRIPE_BEAN, '10');

          await expect(this.result).to.emit(this.silo, 'RemoveDeposit').withArgs(userAddress, UNRIPE_BEAN, stem, to6('1'), '185564');
        });
      });
    });
    describe("Legacy and new Bean Deposit", async function () {
      beforeEach(async function () {
        //fast forward to season 10 because that's the zero point for our stem index
        await this.season.teleportSunrise(10);
        this.season.deployStemsUpgrade();

        await this.silo.connect(user).deposit(UNRIPE_BEAN, to6('10'), EXTERNAL)

        await this.silo.connect(user).mockUnripeBeanDeposit('10', to6('10'))

      })

      it("Check mock works", async function () {
        expect(await this.silo.getTotalDeposited(UNRIPE_BEAN)).to.eq(to6('20'));
        expect(await this.silo.totalStalk()).to.eq(pruneToStalk(to6('10')).add(pruneToStalk(to6('10'))));
        //expect(await this.silo.totalSeeds()).to.eq(pruneToSeeds(to6('10')).add(pruneToSeeds(to6('10'))));
      })

      it('get Deposit', async function () {
        const stem = await this.silo.seasonToStem(UNRIPE_BEAN, '10');
        const deposit = await this.silo.getDeposit(user.address, UNRIPE_BEAN, stem)
        expect(deposit[0]).to.equal(to6('20'))
        expect(deposit[1]).to.equal(prune(to6('10')).add(prune(to6('10'))))
      })
      
      it('revert if withdrawn too much', async function () {
        const stem = await this.silo.seasonToStem(UNRIPE_BEAN, '10');
        await expect(this.silo.connect(user).withdrawDeposit(UNRIPE_BEAN, grownStalkPerBdv, to6('21'), EXTERNAL)).to.be.revertedWith('Silo: Crate balance too low.')
      });

      it("revert if withdrawn too much", async function () {
        await expect(this.silo.connect(user).withdrawDeposit(UNRIPE_BEAN, "2", to6("21"))).to.be.revertedWith(
          "Silo: Crate balance too low."
        );
      });

      describe("Withdraw", async function () {
        beforeEach(async function () {
          userBalanceBefore = await this.unripeBeans.balanceOf(userAddress);


          const stem = await this.silo.seasonToStem(UNRIPE_BEAN, '10');
          this.result = await this.silo.connect(user).withdrawDeposit(UNRIPE_BEAN, grownStalkPerBdv, to6('11'), EXTERNAL);


        })

        it('properly updates the total balances', async function () {
          
          expect(await this.silo.getTotalDeposited(UNRIPE_BEAN)).to.eq(to6('9'));
          
          expect(await this.silo.totalStalk()).to.eq(pruneToStalk(to6('9')));
          //expect(await this.silo.totalSeeds()).to.eq(pruneToSeeds(to6('9')));
        });
        it('properly updates the user balance', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq(pruneToStalk(to6('9')));
          //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(pruneToSeeds(to6('9')));
          expect((await this.unripeBeans.balanceOf(userAddress)).sub(userBalanceBefore)).to.eq(to6('11'));
        });
        it('properly removes the crate', async function () {
          const stem = await this.silo.seasonToStem(UNRIPE_BEAN, '10');
          let dep = await this.silo.getDeposit(userAddress, UNRIPE_BEAN, stem);
          expect(dep[0]).to.equal(to6('9'))
          expect(dep[1]).to.equal(prune(to6('9')))
        });
        it('emits RemoveDeposit event', async function () {
          const stem = await this.silo.seasonToStem(UNRIPE_BEAN, '10');
          await expect(this.result).to.emit(this.silo, 'RemoveDeposit').withArgs(userAddress, UNRIPE_BEAN, stem, to6('11'), '2041210');
        });
      })
    })
  });*/

/*
  describe('Withdraw Unripe LP from BDV', async function () {
    describe("Just legacy LP Deposit BDV", async function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(10);
        this.season.deployStemsUpgrade();
        await this.silo.connect(user).mockUnripeLPDeposit('0', '10', to18('0.000000083406453'), to6('10'))
      })

      it("Check mock works", async function () {
        expect(await this.silo.getTotalDeposited(UNRIPE_LP)).to.eq(to6('10'));
        expect(await this.silo.totalStalk()).to.eq(pruneToStalk(to6('10')));
        //expect(await this.silo.totalSeeds()).to.eq(pruneToSeeds(to6('10'), 4));
      })

      it('get Deposit', async function () {
        const stem = await this.silo.seasonToStem(UNRIPE_LP, '10');
        const deposit = await this.silo.getDeposit(user.address, UNRIPE_LP, stem)
        expect(deposit[0]).to.equal(to6('10'))
        expect(deposit[1]).to.equal(prune(to6('10')))
      })
      
      it('revert if withdrawn too much', async function () {
        userBalanceBefore = await this.unripeLP.balanceOf(userAddress);
        const stem = await this.silo.seasonToStem(UNRIPE_LP, '10');
        await expect(this.silo.connect(user).withdrawDeposit(UNRIPE_LP, grownStalkPerBdv, to6('11'), EXTERNAL)).to.be.revertedWith('Silo: Crate balance too low.')
      });

      it("revert if withdrawn too much", async function () {
        await expect(this.silo.connect(user).withdrawDeposit(UNRIPE_LP, "2", to6("11"))).to.be.revertedWith("Silo: Crate balance too low.");
      });

      describe("Withdraw", async function () {
        beforeEach(async function () {
          const stem = await this.silo.seasonToStem(UNRIPE_LP, '10');
          this.result = await this.silo.connect(user).withdrawDeposit(UNRIPE_LP, grownStalkPerBdv, to6('1'), EXTERNAL)
        })

        it('properly updates the total balances', async function () {
          expect(await this.silo.getTotalDeposited(UNRIPE_LP)).to.eq(to6('9'));
          expect(await this.silo.totalStalk()).to.eq(pruneToStalk(to6('9')));
          //expect(await this.silo.totalSeeds()).to.eq(pruneToSeeds(to6('9'), 4));
        });

        it('properly updates the user balance', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq(pruneToStalk(to6('9')));
          //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(pruneToSeeds(to6('9'), 4));
          expect((await this.unripeLP.balanceOf(userAddress)).sub(userBalanceBefore)).to.eq(to6('1'));
        });

        it('properly removes the crate', async function () {
          const stem = await this.silo.seasonToStem(UNRIPE_LP, '10');
          let dep = await this.silo.getDeposit(userAddress, UNRIPE_LP, stem);
          expect(dep[0]).to.equal(to6('9'))
          expect(dep[1]).to.equal(prune(to6('9')))
        });

        it('emits RemoveDeposit event', async function () {
          const stem = await this.silo.seasonToStem(UNRIPE_LP, '10');
          await expect(this.result).to.emit(this.silo, 'RemoveDeposit').withArgs(userAddress, UNRIPE_LP, stem, to6('1'), '185564');
        });
      });
    });

    describe("Just 3CRV LP Deposit", async function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(10);

        const stemTip = await this.silo.stemTipForToken(this.unripeLP.address);

        // const seasonToDepositIn = await this.silo.stemToSeason(this.unripeLP.address, stemTip);

        await this.silo.connect(user).mockUnripeLPDeposit('1', '10', to18('10.08028951'), to6('10'))
      })

      it("Check mock works", async function () {
        expect(await this.silo.getTotalDeposited(UNRIPE_LP)).to.eq(to6('10'));
        expect(await this.silo.totalStalk()).to.eq(pruneToStalk(to6('10')));
        //expect(await this.silo.totalSeeds()).to.eq(pruneToSeeds(to6('10'), 4));
      })

      it('get Deposit', async function () {
        const stem = await this.silo.seasonToStem(UNRIPE_LP, '10');

        const deposit = await this.silo.getDeposit(user.address, UNRIPE_LP, stem);
        expect(deposit[0]).to.equal(to6('10'))
        expect(deposit[1]).to.equal(prune(to6('10')))
      })
      
      it('revert if withdrawn too much', async function () {
        const stem = await this.silo.seasonToStem(UNRIPE_LP, '10');
        await expect(this.silo.connect(user).withdrawDeposit(UNRIPE_LP, grownStalkPerBdv, to6('11'), EXTERNAL)).to.be.revertedWith('Silo: Crate balance too low.')
      });

      it("revert if withdrawn too much", async function () {
        await expect(this.silo.connect(user).withdrawDeposit(UNRIPE_LP, "2", to6("11"))).to.be.revertedWith("Silo: Crate balance too low.");
      });

      describe("Withdraw", async function () {
        beforeEach(async function () {
          userBalanceBefore = await this.unripeLP.balanceOf(userAddress);
          const stem = await this.silo.seasonToStem(UNRIPE_LP, '10');
          this.result = await this.silo.connect(user).withdrawDeposit(UNRIPE_LP, grownStalkPerBdv, to6('1'), EXTERNAL)
        })

        it('properly updates the total balances', async function () {
          expect(await this.silo.getTotalDeposited(UNRIPE_LP)).to.eq(to6('9'));
          expect(await this.silo.totalStalk()).to.eq(pruneToStalk(to6('9')));
          //expect(await this.silo.totalSeeds()).to.eq(pruneToSeeds(to6('9'), 4));
        });

        it('properly updates the user balance', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq(pruneToStalk(to6('9')));
          //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(pruneToSeeds(to6('9'), 4));
          expect((await this.unripeLP.balanceOf(userAddress)).sub(userBalanceBefore)).to.eq(to6('1'));
        });

        it('properly removes the crate', async function () {
          const stem = await this.silo.seasonToStem(UNRIPE_LP, '10');
          let dep = await this.silo.getDeposit(userAddress, UNRIPE_LP, stem);
          expect(dep[0]).to.equal(to6('9'))
          expect(dep[1]).to.equal(prune(to6('9')))
        });

        it('emits RemoveDeposit event', async function () {
          const stem = await this.silo.seasonToStem(UNRIPE_LP, '10');
          await expect(this.result).to.emit(this.silo, 'RemoveDeposit').withArgs(userAddress, UNRIPE_LP, stem, to6('1'), '185564');
        });
      });
    });

    describe("Just BEAN:LUSD LP Deposit", async function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(10);
        this.season.deployStemsUpgrade();
        await this.silo.connect(user).mockUnripeLPDeposit('2', '10', to18('10.17182243'), to6('10'))
      })

      it("Check mock works", async function () {
        expect(await this.silo.getTotalDeposited(UNRIPE_LP)).to.eq(to6('10'));
        expect(await this.silo.totalStalk()).to.eq(pruneToStalk(to6('10')));
        //expect(await this.silo.totalSeeds()).to.eq(pruneToSeeds(to6('10'), 4));
      })

      it('get Deposit', async function () {
        const stem = await this.silo.seasonToStem(UNRIPE_LP, '10');
        const deposit = await this.silo.getDeposit(user.address, UNRIPE_LP, stem)
        expect(deposit[0]).to.equal(to6('10'))
        expect(deposit[1]).to.equal(prune(to6('10')))
      })
      
      it('revert if withdrawn too much', async function () {
        const stem = await this.silo.seasonToStem(UNRIPE_LP, '10');
        await expect(this.silo.connect(user).withdrawDeposit(UNRIPE_LP, grownStalkPerBdv, to6('11'), EXTERNAL)).to.be.revertedWith('Silo: Crate balance too low.')
      });

      it("revert if withdrawn too much", async function () {
        await expect(this.silo.connect(user).withdrawDeposit(UNRIPE_LP, "2", to6("11"))).to.be.revertedWith("Silo: Crate balance too low.");
      });

      describe("Withdraw", async function () {
        beforeEach(async function () {
          userBalanceBefore = await this.unripeLP.balanceOf(userAddress);
          const stem = await this.silo.seasonToStem(UNRIPE_LP, '10');
          this.result = await this.silo.connect(user).withdrawDeposit(UNRIPE_LP, grownStalkPerBdv, to6('1'), EXTERNAL)
        })

        it('properly updates the total balances', async function () {
          expect(await this.silo.getTotalDeposited(UNRIPE_LP)).to.eq(to6('9'));
          expect(await this.silo.totalStalk()).to.eq(pruneToStalk(to6('9')));
          //expect(await this.silo.totalSeeds()).to.eq(pruneToSeeds(to6('9'), 4));
        });

        it('properly updates the user balance', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq(pruneToStalk(to6('9')));
          //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(pruneToSeeds(to6('9'), 4));
          expect((await this.unripeLP.balanceOf(userAddress)).sub(userBalanceBefore)).to.eq(to6('1'));

        });

        it('properly removes the crate', async function () {
          const stem = await this.silo.seasonToStem(UNRIPE_LP, '10');
          let dep = await this.silo.getDeposit(userAddress, UNRIPE_LP, stem);
          expect(dep[0]).to.equal(to6('9'))
          expect(dep[1]).to.equal(prune(to6('9')))
        });

        it('emits RemoveDeposit event', async function () {
          const stem = await this.silo.seasonToStem(UNRIPE_LP, '10');
          await expect(this.result).to.emit(this.silo, 'RemoveDeposit').withArgs(userAddress, UNRIPE_LP, stem, to6('1'), '185564');
        });
      });
    });

    describe("All 4 LP Deposit", async function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(10);
        this.season.deployStemsUpgrade();
        await this.silo.connect(user).mockUnripeLPDeposit('0', '10', to18('0.000000020851613'), to6('2.5'))
        await this.silo.connect(user).mockUnripeLPDeposit('1', '10', to18('2.5200723775'), to6('2.5'))
        await this.silo.connect(user).mockUnripeLPDeposit('2', '10', to18('2.5429556075'), to6('2.5'))
        await this.silo.connect(user).deposit(UNRIPE_LP, to6('2.5'), EXTERNAL)
      })

      it("Check mock works", async function () {
        expect(await this.silo.getTotalDeposited(UNRIPE_LP)).to.eq(to6('10'));
        expect(await this.silo.totalStalk()).to.eq(pruneToStalk(to6('2.5')).mul(toBN('4')).sub(toBN('10000')));
        //expect(await this.silo.totalSeeds()).to.eq(pruneToSeeds(to6('2.5'), 4).mul(toBN('4')).sub(toBN('4')));
      })

      it('get Deposit', async function () {
        const stem = await this.silo.seasonToStem(UNRIPE_LP, '10');
        const deposit = await this.silo.getDeposit(user.address, UNRIPE_LP, stem)
        expect(deposit[0]).to.equal(to6('10'))
        expect(deposit[1]).to.equal(prune(to6('7.5')).add(prune(to6('2.5'))).sub(toBN('1')))
      })
      
      it('revert if withdrawn too much', async function () {
        const stem = await this.silo.seasonToStem(UNRIPE_LP, '10');
        await expect(this.silo.connect(user).withdrawDeposit(UNRIPE_LP, grownStalkPerBdv, to6('11'), EXTERNAL)).to.be.revertedWith('Silo: Crate balance too low.')
      });

      it("revert if withdrawn too much", async function () {
        await expect(this.silo.connect(user).withdrawDeposit(UNRIPE_LP, "2", to6("11"))).to.be.revertedWith("Silo: Crate balance too low.");
      });

      describe("Withdraw", async function () {
        beforeEach(async function () {
          userBalanceBefore = await this.unripeLP.balanceOf(userAddress);
          const stem = await this.silo.seasonToStem(UNRIPE_LP, '10');
          this.result = await this.silo.connect(user).withdrawDeposit(UNRIPE_LP, grownStalkPerBdv, to6('9'), EXTERNAL)
        })

        it('properly updates the total balances', async function () {
          expect(await this.silo.getTotalDeposited(UNRIPE_LP)).to.eq(to6('1'));
          expect(await this.silo.totalStalk()).to.eq(pruneToStalk(to6('1')).sub(toBN('10000')));
          //expect(await this.silo.totalSeeds()).to.eq(pruneToSeeds(to6('1'), 4).sub(toBN('4')));
        });

        it('properly updates the user balance', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq(pruneToStalk(to6('1')).sub(toBN('10000')));
          //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(pruneToSeeds(to6('1'), 4).sub(toBN('4')));
          expect((await this.unripeLP.balanceOf(userAddress)).sub(userBalanceBefore)).to.eq(to6('9'));
        });

        it('properly removes the crate', async function () {
          const stem = await this.silo.seasonToStem(UNRIPE_LP, '10');
          let dep = await this.silo.getDeposit(userAddress, UNRIPE_LP, stem);
          expect(dep[0]).to.equal(to6('1'))
          expect(dep[1]).to.equal(this.bdvBefore.sub(this.bdvBefore.mul('9').div('10')))
        });

        it('emits RemoveDeposit event', async function () {
          const stem = await this.silo.seasonToStem(UNRIPE_LP, '10');
          await expect(this.result).to.emit(this.silo, 'RemoveDeposit').withArgs(userAddress, UNRIPE_LP, stem, to6('9'), '1670080');
        });
      })
    })
  })*/

  describe("Transfer", async function () {
    describe("reverts", async function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(10);
        this.season.deployStemsUpgrade();
        await this.silo.connect(user).deposit(this.siloToken.address, '100', EXTERNAL)
        await this.season.siloSunrise('0')
        await this.silo.connect(user).deposit(this.siloToken.address, '100', EXTERNAL)
      })

      it("reverts if the amounts array is empty", async function () {
        await expect(this.silo.connect(user).transferDeposits(userAddress, user2Address, this.siloToken.address, [], [])).to.revertedWith(
          "Silo: amounts array is empty"
        );
      });

      it("reverts if the amount in array is 0", async function () {
        await expect(
          this.silo.connect(user).transferDeposits(userAddress, user2Address, this.siloToken.address, ["2", "3"], ["100", "0"])
        ).to.revertedWith("Silo: amount in array is 0");
      });
    });
    describe("Single", async function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(10);
        this.season.deployStemsUpgrade();
      })
      
      it('returns the correct value', async function () {
        await this.silo.connect(user).deposit(this.siloToken.address, '100', EXTERNAL)
        const grownStalkPerBdv = await this.silo.seasonToStem(this.siloToken.address, '10');
        this.result = await this.silo.connect(user).callStatic.transferDeposit(userAddress, user2Address, this.siloToken.address, grownStalkPerBdv, '50')
        expect(this.result).to.be.equal('50')
      })

      beforeEach(async function () {
        await this.silo.connect(user).deposit(this.siloToken.address, '100', EXTERNAL)
        const stem = await this.silo.seasonToStem(this.siloToken.address, '10');
        this.result = await this.silo.connect(user).transferDeposit(userAddress, user2Address, this.siloToken.address, stem, '50')
      })

      it('removes the deposit from the sender', async function () {
        const stem = await this.silo.seasonToStem(this.siloToken.address, '10');
        const deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, stem)
        expect(deposit[0]).to.equal('50');
        expect(deposit[0]).to.equal('50');
      })

      it('updates users stalk and seeds', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.be.equal('500000')
        //expect(await this.silo.balanceOfSeeds(userAddress)).to.be.equal('50')
      })

      it('add the deposit to the recipient', async function () {
        const stem = await this.silo.seasonToStem(this.siloToken.address, '10');
        const deposit = await this.silo.getDeposit(user2Address, this.siloToken.address, stem)
        expect(deposit[0]).to.equal('50');
        expect(deposit[0]).to.equal('50');
      })

      it('updates users stalk and seeds', async function () {
        expect(await this.silo.balanceOfStalk(user2Address)).to.be.equal('500000')
        //expect(await this.silo.balanceOfSeeds(user2Address)).to.be.equal('50')
      })

      it('updates total stalk and seeds', async function () {
        expect(await this.silo.totalStalk()).to.be.equal('1000000')
        // //expect(await this.silo.totalSeeds()).to.be.equal('100')
      })
    })

    describe("Single all", async function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(10);
        this.season.deployStemsUpgrade();
        await this.silo.connect(user).deposit(this.siloToken.address, '100', EXTERNAL)
        const grownStalkPerBdv = await this.silo.seasonToStem(this.siloToken.address, '10');
        await this.silo.connect(user).transferDeposit(userAddress, user2Address, this.siloToken.address, grownStalkPerBdv, '100')
      })

      it('removes the deposit from the sender', async function () {
        const stem = await this.silo.seasonToStem(this.siloToken.address, '10');
        const deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, stem)
        expect(deposit[0]).to.equal('0');
        expect(deposit[0]).to.equal('0');
      })

      it('updates users stalk and seeds', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.be.equal('0')
        //expect(await this.silo.balanceOfSeeds(userAddress)).to.be.equal('0')
      })

      it('add the deposit to the recipient', async function () {
        const stem = await this.silo.seasonToStem(this.siloToken.address, '10');
        const deposit = await this.silo.getDeposit(user2Address, this.siloToken.address, stem)
        expect(deposit[0]).to.equal('100');
        expect(deposit[0]).to.equal('100');
      })

      it('updates users stalk and seeds', async function () {
        expect(await this.silo.balanceOfStalk(user2Address)).to.be.equal('1000000')
        //expect(await this.silo.balanceOfSeeds(user2Address)).to.be.equal('100')
      })

      it('updates total stalk and seeds', async function () {
        expect(await this.silo.totalStalk()).to.be.equal('1000000')
        //expect(await this.silo.totalSeeds()).to.be.equal('100')
      })
    })

    describe("Multiple", async function () {
      it('returns the correct value', async function () {
        
        // await this.season.teleportSunrise(10);
        // await this.silo.connect(user).deposit(this.siloToken.address, '100', EXTERNAL)
        // await this.season.siloSunrise('0')
        // await this.silo.connect(user).deposit(this.siloToken.address, '100', EXTERNAL)

        const stem10 = await this.silo.seasonToStem(this.siloToken.address, '10');
        const stem11 = await this.silo.seasonToStem(this.siloToken.address, '11');
        this.result = await this.silo.connect(user).callStatic.transferDeposits(userAddress, user2Address, this.siloToken.address, [stem10, stem11], ['50','25'])
      })

      beforeEach(async function () {
        await this.season.teleportSunrise(10);
        this.season.deployStemsUpgrade();
        await this.silo.connect(user).deposit(this.siloToken.address, '100', EXTERNAL)
        await this.season.siloSunrise('0')
        await this.silo.connect(user).deposit(this.siloToken.address, '100', EXTERNAL)

        const stem10 = await this.silo.seasonToStem(this.siloToken.address, '10');
        const stem11 = await this.silo.seasonToStem(this.siloToken.address, '11');
        
        this.result = await this.silo.connect(user).transferDeposits(userAddress, user2Address, this.siloToken.address, [stem10, stem11], ['50','25'])
      })

      it('removes the deposit from the sender', async function () {

        const stem10 = await this.silo.seasonToStem(this.siloToken.address, '10');
        let deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, stem10)
        expect(deposit[0]).to.equal('50');
        expect(deposit[0]).to.equal('50');
        const stem11 = await this.silo.seasonToStem(this.siloToken.address, '11');
        deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, stem11)
        expect(deposit[0]).to.equal('75');
        expect(deposit[0]).to.equal('75');
      })

      it('updates users stalk and seeds', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.be.equal('1250050')
        //expect(await this.silo.balanceOfSeeds(userAddress)).to.be.equal('125')
      })

      it('add the deposit to the recipient', async function () {
        const stem10 = await this.silo.seasonToStem(this.siloToken.address, '10');
        let deposit = await this.silo.getDeposit(user2Address, this.siloToken.address, stem10)
        expect(deposit[0]).to.equal('50');
        expect(deposit[0]).to.equal('50');
        const stem11 = await this.silo.seasonToStem(this.siloToken.address, '11');
        deposit = await this.silo.getDeposit(user2Address, this.siloToken.address, stem11)
        expect(deposit[0]).to.equal('25');
        expect(deposit[0]).to.equal('25');
      })

      it('updates users stalk and seeds', async function () {
        expect(await this.silo.balanceOfStalk(user2Address)).to.be.equal('750050')
        //expect(await this.silo.balanceOfSeeds(user2Address)).to.be.equal('75')
      })

      it('updates total stalk and seeds', async function () {
        expect(await this.silo.totalStalk()).to.be.equal('2000100')
        //expect(await this.silo.totalSeeds()).to.be.equal('200')
      })
    })

    describe("Single with allowance", async function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(10);
        this.season.deployStemsUpgrade();
        await this.silo.connect(user).deposit(this.siloToken.address, '100', EXTERNAL)
        await this.approval.connect(user).increaseDepositAllowance(ownerAddress, this.siloToken.address, '100');
        const stem = await this.silo.seasonToStem(this.siloToken.address, '10');
        await this.silo.connect(owner).transferDeposit(userAddress, user2Address, this.siloToken.address, stem, '50')
      })

      it('removes the deposit from the sender', async function () {
        const stem = await this.silo.seasonToStem(this.siloToken.address, '10');
        const deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, stem)
        expect(deposit[0]).to.equal('50');
        expect(deposit[0]).to.equal('50');
      })

      it('updates users stalk and seeds', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.be.equal('500000')
        //expect(await this.silo.balanceOfSeeds(userAddress)).to.be.equal('50')
      })

      it('add the deposit to the recipient', async function () {
        const stem = await this.silo.seasonToStem(this.siloToken.address, '10');
        const deposit = await this.silo.getDeposit(user2Address, this.siloToken.address, stem)
        expect(deposit[0]).to.equal('50');
        expect(deposit[0]).to.equal('50');
      })

      it('updates users stalk and seeds', async function () {
        expect(await this.silo.balanceOfStalk(user2Address)).to.be.equal('500000')
        //expect(await this.silo.balanceOfSeeds(user2Address)).to.be.equal('50')
      })

      it('updates total stalk and seeds', async function () {
        expect(await this.silo.totalStalk()).to.be.equal('1000000')
        //expect(await this.silo.totalSeeds()).to.be.equal('100')
      })

      it('properly updates users token allowance', async function () {
        expect(await this.approval.depositAllowance(userAddress, ownerAddress, this.siloToken.address)).to.be.equal('50')
      })
    })

    describe("Single with no allowance", async function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(10);
        this.season.deployStemsUpgrade();
        await this.silo.connect(user).deposit(this.siloToken.address, '100', EXTERNAL)
      })

      it('reverts with no allowance', async function () {
        const grownStalkPerBdv = await this.silo.seasonToStem(this.siloToken.address, '10');
        await expect(this.silo.connect(owner).transferDeposit(userAddress, user2Address, this.siloToken.address, grownStalkPerBdv, '50')).to.revertedWith('Silo: insufficient allowance');
      })
    })

    describe("Single all with allowance", async function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(10);
        this.season.deployStemsUpgrade();
        await this.silo.connect(user).deposit(this.siloToken.address, '100', EXTERNAL)
        await this.approval.connect(user).increaseDepositAllowance(ownerAddress, this.siloToken.address, '100');
        const stem = await this.silo.seasonToStem(this.siloToken.address, '10');
        await this.silo.connect(owner).transferDeposit(userAddress, user2Address, this.siloToken.address, stem, '100');
      })

      it('removes the deposit from the sender', async function () {
        const stem = await this.silo.seasonToStem(this.siloToken.address, '10');
        const deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, stem)
        expect(deposit[0]).to.equal('0');
        expect(deposit[0]).to.equal('0');
      })

      it('updates users stalk and seeds', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.be.equal('0')
        //expect(await this.silo.balanceOfSeeds(userAddress)).to.be.equal('0')
      })

      it('add the deposit to the recipient', async function () {
        const stem = await this.silo.seasonToStem(this.siloToken.address, '10');
        const deposit = await this.silo.getDeposit(user2Address, this.siloToken.address, stem)
        expect(deposit[0]).to.equal('100');
        expect(deposit[0]).to.equal('100');
      })

      it('updates users stalk and seeds', async function () {
        expect(await this.silo.balanceOfStalk(user2Address)).to.be.equal('1000000')
        //expect(await this.silo.balanceOfSeeds(user2Address)).to.be.equal('100')
      })

      it('updates total stalk and seeds', async function () {
        expect(await this.silo.totalStalk()).to.be.equal('1000000')
        //expect(await this.silo.totalSeeds()).to.be.equal('100')
      })

      it('properly updates users token allowance', async function () {
        expect(await this.approval.depositAllowance(userAddress, ownerAddress, this.siloToken.address)).to.be.equal('0')
      })
    })

    describe("Multiple with allowance", async function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(10);
        this.season.deployStemsUpgrade();
        await this.silo.connect(user).deposit(this.siloToken.address, '100', EXTERNAL)
        await this.season.siloSunrise('0')
        await this.silo.connect(user).deposit(this.siloToken.address, '100', EXTERNAL)
        await this.approval.connect(user).increaseDepositAllowance(ownerAddress, this.siloToken.address, '200');
        const stem10 = await this.silo.seasonToStem(this.siloToken.address, '10');
        const stem11 = await this.silo.seasonToStem(this.siloToken.address, '11');
        await this.silo.connect(owner).transferDeposits(userAddress, user2Address, this.siloToken.address, [stem10, stem11], ['50','25'])
      })

      it('removes the deposit from the sender', async function () {
        const stem10 = await this.silo.seasonToStem(this.siloToken.address, '10');
        let deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, stem10)
        expect(deposit[0]).to.equal('50');
        expect(deposit[0]).to.equal('50');
        const stem11 = await this.silo.seasonToStem(this.siloToken.address, '11');
        deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, stem11)
        expect(deposit[0]).to.equal('75');
        expect(deposit[0]).to.equal('75');
      })

      it('updates users stalk and seeds', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.be.equal('1250050')
        //expect(await this.silo.balanceOfSeeds(userAddress)).to.be.equal('125')
      })

      it('add the deposit to the recipient', async function () {
        const stem10 = await this.silo.seasonToStem(this.siloToken.address, '10');
        let deposit = await this.silo.getDeposit(user2Address, this.siloToken.address, stem10)
        expect(deposit[0]).to.equal('50');
        expect(deposit[0]).to.equal('50');
        const stem11 = await this.silo.seasonToStem(this.siloToken.address, '11');
        deposit = await this.silo.getDeposit(user2Address, this.siloToken.address, stem11)
        expect(deposit[0]).to.equal('25');
        expect(deposit[0]).to.equal('25');
      })

      it('updates users stalk and seeds', async function () {
        expect(await this.silo.balanceOfStalk(user2Address)).to.be.equal('750050')
        //expect(await this.silo.balanceOfSeeds(user2Address)).to.be.equal('75')
      })

      it('updates total stalk and seeds', async function () {
        expect(await this.silo.totalStalk()).to.be.equal('2000100')
        // //expect(await this.silo.totalSeeds()).to.be.equal('200')
      })

      it('properly updates users token allowance', async function () {
        expect(await this.approval.depositAllowance(userAddress, ownerAddress, this.siloToken.address)).to.be.equal('125')
      })
    })

    describe("Multiple with no allowance", async function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(10);
        this.season.deployStemsUpgrade();
        await this.silo.connect(user).deposit(this.siloToken.address, '100', EXTERNAL)
        await this.season.siloSunrise('0')
        await this.silo.connect(user).deposit(this.siloToken.address, '100', EXTERNAL)
      })

      it('reverts with no allowance', async function () {
        const stem10 = await this.silo.seasonToStem(this.siloToken.address, '10');
        const stem11 = await this.silo.seasonToStem(this.siloToken.address, '11');
        await expect(this.silo.connect(owner).transferDeposits(userAddress, user2Address, this.siloToken.address, [stem10, stem11], ['50','25'])).to.revertedWith('Silo: insufficient allowance');
      })
    })
  })

  describe("Update Unripe Deposit", async function () {

    it("enrootDeposit fails if not unripe token", async function () {
      await expect(this.enroot.connect(user).enrootDeposit(BEAN, '1', '1')).to.be.revertedWith("Silo: token not unripe")
    })

    it("enrootDeposits fails if not unripe token", async function () {
      await expect(this.enroot.connect(user).enrootDeposits(BEAN, ['1'], ['1'])).to.be.revertedWith("Silo: token not unripe")
    })

    describe("1 deposit, some", async function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(10);
        this.season.deployStemsUpgrade();

        await this.silo.connect(user).depositLegacy(UNRIPE_BEAN, to6('5'), EXTERNAL)
        await this.silo.connect(user).mockUnripeBeanDeposit(10, to6('5'))

        await this.unripe.connect(owner).addUnderlying(
          UNRIPE_BEAN,
          to6('1000')
        )

        const stem10 = await this.silo.seasonToStem(UNRIPE_BEAN, '10');
        //migrate to new deposit system since the mock stuff deposits in old one (still useful to test)
        await this.migrate.mowAndMigrate(user.address, [UNRIPE_BEAN], [['10']], [[to6('10')]], 0, 0, []);
        
        this.result = await this.enroot.connect(user).enrootDeposit(UNRIPE_BEAN, stem10, to6('5'));
      })

      it('properly updates the total balances', async function () {
        expect(await this.silo.getTotalDeposited(UNRIPE_BEAN)).to.eq(to6('10'));
        expect(await this.silo.totalStalk()).to.eq(pruneToStalk(to6('10')).add(toStalk('0.5')));
      });

      it('properly updates the user balance', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq(pruneToStalk(to6('10')).add(toStalk('0.5')));
      });

      it('properly removes the crate', async function () {
        const stem10 = await this.silo.seasonToStem(this.siloToken.address, '10');
        let dep = await this.silo.getDeposit(userAddress, UNRIPE_BEAN, stem10);
        
        expect(dep[0]).to.equal(to6('10'))
        expect(dep[1]).to.equal(prune(to6('10')).add(to6('0.5')))
      });

      it('emits Remove and Add Deposit event', async function () {
        const stem10 = await this.silo.seasonToStem(this.siloToken.address, '10');
        await expect(this.result).to.emit(this.enroot, 'RemoveDeposit').withArgs(userAddress, UNRIPE_BEAN, stem10, to6('5'), '927823');
        await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(userAddress, UNRIPE_BEAN, stem10, to6('5'), prune(to6('5')).add(to6('0.5')));
      });
    });

    describe("1 deposit after 1 season, all", async function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(10);
        this.season.deployStemsUpgrade();

        await this.silo.connect(user).depositLegacy(UNRIPE_BEAN, to6('5'), EXTERNAL) //need to do legacy deposit to simulate pre-stems upgrade
        await this.silo.connect(user).mockUnripeBeanDeposit('10', to6('5'))
        
        await this.season.lightSunrise()

        await this.unripe.connect(owner).addUnderlying(
          UNRIPE_BEAN,
          to6('5000').sub(to6('10000').mul(toBN(pru)).div(to18('1')))
        )

        // const stem10 = await this.silo.seasonToStem(UNRIPE_BEAN, '10');

        await this.migrate.mowAndMigrate(user.address, [UNRIPE_BEAN], [['10']], [[to6('10')]], 0, 0, []);

        this.result = await this.enroot.connect(user).enrootDeposit(UNRIPE_BEAN, '0', to6('10'));
      })

      it('properly updates the total balances', async function () {
        expect(await this.silo.getTotalDeposited(UNRIPE_BEAN)).to.eq(to6('10'));
        expect(await this.silo.totalStalk()).to.eq(toStalk('5.001'));
      });

      it('properly updates the user balance', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('5.001'));
      });

      it('properly removes the crate', async function () {
        const stem10 = await this.silo.seasonToStem(UNRIPE_BEAN, '10');
        let dep = await this.silo.getDeposit(userAddress, UNRIPE_BEAN, stem10);
        expect(dep[0]).to.equal(to6('10'))
        expect(dep[1]).to.equal(to6('5'))
      });

      it('emits Remove and Add Deposit event', async function () {
        const stem10 = await this.silo.seasonToStem(UNRIPE_BEAN, '10');
        await expect(this.result).to.emit(this.enroot, 'RemoveDeposit').withArgs(userAddress, UNRIPE_BEAN, stem10, to6('10'), '1855646');
        await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(userAddress, UNRIPE_BEAN, stem10, to6('10'), to6('5'));
      });
    });

    describe("2 deposit, all", async function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(10);
        await this.silo.connect(user).mockUnripeBeanDeposit('10', to6('5'))

        await this.season.lightSunrise()
        await this.silo.connect(user).depositLegacy(UNRIPE_BEAN, to6('5'), EXTERNAL)
        
        this.season.deployStemsUpgrade();
        
        await this.unripe.connect(owner).addUnderlying(
          UNRIPE_BEAN,
          to6('5000').sub(to6('10000').mul(toBN(pru)).div(to18('1')))
        )


        await this.migrate.mowAndMigrate(user.address, [UNRIPE_BEAN], [['10', '11']], [[to6('5'), to6('5')]], 0, 0, []);

        const stem10 = await this.silo.seasonToStem(UNRIPE_BEAN, '10');

        const stem11 = await this.silo.seasonToStem(UNRIPE_BEAN, '11');
        this.result = await this.enroot.connect(user).enrootDeposits(UNRIPE_BEAN, [stem10, stem11], [to6('5'), to6('5')]);
      })

      it('properly updates the total balances', async function () {
        expect(await this.silo.getTotalDeposited(UNRIPE_BEAN)).to.eq(to6('10'));
        expect(await this.silo.totalStalk()).to.eq(toStalk('5.0005'));
        //expect(await this.silo.totalSeeds()).to.eq(to6('10'));
      });

      it('properly updates the user balance', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('5.0005'));
        //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(to6('10'));
      });

      it('properly removes the crate', async function () {
        const stem10 = await this.silo.seasonToStem(UNRIPE_BEAN, '10');
        let dep = await this.silo.getDeposit(userAddress, UNRIPE_BEAN, stem10);
        expect(dep[0]).to.equal(to6('5'))
        expect(dep[1]).to.equal(to6('2.5'))
      });

      it('emits Remove and Add Deposits event', async function () {
        const stem10 = await this.silo.seasonToStem(UNRIPE_BEAN, '10');
        const stem11 = await this.silo.seasonToStem(UNRIPE_BEAN, '11');
        await expect(this.result).to.emit(this.silo, 'RemoveDeposits').withArgs(userAddress, UNRIPE_BEAN, [stem10,stem11], [to6('5'), to6('5')], to6('10'), ['927823', '927823']);
        await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(userAddress, UNRIPE_BEAN, stem10, to6('5'), to6('2.5'));
        await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(userAddress, UNRIPE_BEAN, stem11, to6('5'), to6('2.5'));
      });
    });
  });

  describe("Deposit Approval", async function () {
    describe("approve allowance", async function () {
      beforeEach(async function () {
        this.result = await this.approval.connect(user).increaseDepositAllowance(user2Address, this.siloToken.address, '100');
      })

      it('properly updates users token allowance', async function () {
        expect(await this.approval.depositAllowance(userAddress, user2Address, this.siloToken.address)).to.be.equal('100')
      })

      it('emits DepositApproval event', async function () {
        await expect(this.result).to.emit(this.approval, 'DepositApproval').withArgs(userAddress ,user2Address, this.siloToken.address, '100');
      });
    });

    describe("increase and decrease allowance", async function () {
      beforeEach(async function () {
        await this.approval.connect(user).increaseDepositAllowance(user2Address, this.siloToken.address, '100');
      })

      it('properly increase users token allowance', async function () {
        await this.approval.connect(user).increaseDepositAllowance(user2Address, this.siloToken.address, '100');
        expect(await this.approval.depositAllowance(userAddress, user2Address, this.siloToken.address)).to.be.equal('200')
      })

      it('properly decrease users token allowance', async function () {
        await this.approval.connect(user).decreaseDepositAllowance(user2Address, this.siloToken.address, '25')
        expect(await this.approval.depositAllowance(userAddress, user2Address, this.siloToken.address)).to.be.equal('75')
      })

      it('decrease users token allowance below zero', async function () {
        await expect(this.approval.connect(user).decreaseDepositAllowance(user2Address, this.siloToken.address, '101')).to.revertedWith('Silo: decreased allowance below zero');
      })

      it('emits DepositApproval event on increase', async function () {
        const result = await this.approval.connect(user).increaseDepositAllowance(user2Address, this.siloToken.address, '25');
        await expect(result).to.emit(this.approval, 'DepositApproval').withArgs(userAddress ,user2Address, this.siloToken.address, '125');
      });

      it('emits DepositApproval event on decrease', async function () {
        const result = await this.approval.connect(user).decreaseDepositAllowance(user2Address, this.siloToken.address, '25');
        await expect(result).to.emit(this.approval, 'DepositApproval').withArgs(userAddress ,user2Address, this.siloToken.address, '75');
      });
    });

    describe("Approve Deposit Permit", async function () {
      describe('reverts', function () {
        it('reverts if depositPermitDomainSeparator is invalid', async function () {
          expect(await this.approval.connect(user).depositPermitDomainSeparator()).to.be.equal("0xf47372c4b0d604ded919ee3604a1b1e88c7cd7d7d2fcfffc36f016e19bede4ef");
        });
      });
  
      describe("single token permit", async function() {
        describe('reverts', function () {
          it('reverts if permit expired', async function () {
            const nonce = await this.approval.connect(user).depositPermitNonces(userAddress);
            const signature = await signSiloDepositTokenPermit(user, userAddress, user2Address, this.siloToken.address, '1000', nonce, 1000);
            await expect(this.approval.connect(user).permitDeposit(
              signature.owner, 
              signature.spender, 
              signature.token, 
              signature.value, 
              signature.deadline, 
              signature.split.v, 
              signature.split.r, 
              signature.split.s
            )).to.be.revertedWith("Silo: permit expired deadline")
          });
  
          it('reverts if permit invalid signature', async function () {
            const nonce = await this.approval.connect(user).depositPermitNonces(userAddress);
            const signature = await signSiloDepositTokenPermit(user, userAddress, user2Address, this.siloToken.address, '1000', nonce);
            await expect(this.approval.connect(user).permitDeposit(
              user2Address, 
              signature.spender, 
              signature.token, 
              signature.value, 
              signature.deadline, 
              signature.split.v, 
              signature.split.r, 
              signature.split.s
            )).to.be.revertedWith("Silo: permit invalid signature")
          });
  
          it("reverts when transfer too much", async function() {
            await this.season.teleportSunrise(10);
            this.season.deployStemsUpgrade();
            await this.silo.connect(user).deposit(this.siloToken.address, '1000', EXTERNAL)
            const nonce = await this.approval.connect(user).depositPermitNonces(userAddress);
            const signature = await signSiloDepositTokenPermit(user, userAddress, user2Address, this.siloToken.address, '500', nonce);
            await this.approval.connect(user2).permitDeposit(
              signature.owner, 
              signature.spender, 
              signature.token, 
              signature.value, 
              signature.deadline, 
              signature.split.v, 
              signature.split.r, 
              signature.split.s
            )
  
            const stem10 = await this.silo.seasonToStem(UNRIPE_BEAN, '10');
            await expect(
              this.silo.connect(user2).transferDeposit(userAddress, user2Address, this.siloToken.address, stem10, '1000')
            ).to.be.revertedWith("Silo: insufficient allowance")
  
            await expect(
              this.silo.connect(user2).transferDeposits(userAddress, user2Address, this.siloToken.address, [stem10], ['1000'])
            ).to.be.revertedWith("Silo: insufficient allowance")
          });
        });

        describe("approve permit", async function () {
          beforeEach(async function () {
            // Create permit
            await this.season.teleportSunrise(10);
            this.season.deployStemsUpgrade();
            const nonce = await this.approval.connect(user).depositPermitNonces(userAddress);
            const signature = await signSiloDepositTokenPermit(user, userAddress, user2Address, this.siloToken.address, '1000', nonce);
            this.result = await this.approval.connect(user).permitDeposit(
              signature.owner, 
              signature.spender, 
              signature.token, 
              signature.value, 
              signature.deadline, 
              signature.split.v, 
              signature.split.r, 
              signature.split.s
            );
          });
  
          it("allow transfer all single deposit", async function() {
            const stem10 = await this.silo.seasonToStem(UNRIPE_BEAN, '10');
            await this.silo.connect(user).deposit(this.siloToken.address, '1000', EXTERNAL)
            await this.silo.connect(user2).transferDeposit(userAddress, user2Address, this.siloToken.address, stem10, '1000')
  
            const user1Deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, stem10)
            expect(user1Deposit[0]).to.equal('0');
            expect(user1Deposit[1]).to.equal('0');
  
            const user2Deposit = await this.silo.getDeposit(user2Address, this.siloToken.address, stem10)
            expect(user2Deposit[0]).to.equal('1000');
            expect(user2Deposit[1]).to.equal('1000');
          });
  
          it("allow transfer all multiple deposits", async function() {
            const stem10 = await this.silo.seasonToStem(UNRIPE_BEAN, '10');
            await this.silo.connect(user).deposit(this.siloToken.address, '1000', EXTERNAL)
            await this.silo.connect(user2).transferDeposits(userAddress, user2Address, this.siloToken.address, [stem10], ['1000'])
  
            const user1Deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, stem10)
            expect(user1Deposit[0]).to.equal('0');
            expect(user1Deposit[1]).to.equal('0');
  
            const user2Deposit = await this.silo.getDeposit(user2Address, this.siloToken.address, stem10)
            expect(user2Deposit[0]).to.equal('1000');
            expect(user2Deposit[1]).to.equal('1000');
          });
  
          it("allow transfer some deposit", async function() {
            const stem10 = await this.silo.seasonToStem(UNRIPE_BEAN, '10');
            await this.silo.connect(user).deposit(this.siloToken.address, '1000', EXTERNAL)
            await this.silo.connect(user2).transferDeposit(userAddress, user2Address, this.siloToken.address, stem10, '400')
  
            const user1Deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, stem10)
            expect(user1Deposit[0]).to.equal('600');
            expect(user1Deposit[1]).to.equal('600');
  
            const user2Deposit = await this.silo.getDeposit(user2Address, this.siloToken.address, stem10)
            expect(user2Deposit[0]).to.equal('400');
            expect(user2Deposit[1]).to.equal('400');
          });
  
          it("properly updates user permit nonce", async function() {
            expect(await this.approval.depositPermitNonces(userAddress)).to.be.equal('1')
          });
  
          it('properly updates user token allowance', async function () {
            expect(await this.approval.depositAllowance(userAddress, user2Address, this.siloToken.address)).to.be.equal('1000')
          });
  
          it('emits DepositApproval event', async function () {
            await expect(this.result).to.emit(this.approval, 'DepositApproval').withArgs(userAddress ,user2Address, this.siloToken.address, '1000');
          });
        });
      });
  
      describe("multiple tokens permit", async function() {
        describe('reverts', function () {
          beforeEach(async function () {
            await this.season.teleportSunrise(10);
            this.season.deployStemsUpgrade();
          });

          it('reverts if permit expired', async function () {
            const nonce = await this.approval.connect(user).depositPermitNonces(userAddress);
            const signature = await signSiloDepositTokensPermit(user, userAddress, user2Address, [this.siloToken.address], ['1000'], nonce, 1000);
            await expect(this.approval.connect(user).permitDeposits(
              signature.owner, 
              signature.spender, 
              signature.tokens, 
              signature.values, 
              signature.deadline, 
              signature.split.v, 
              signature.split.r, 
              signature.split.s
            )).to.be.revertedWith("Silo: permit expired deadline")
          });
  
          it('reverts if permit invalid signature', async function () {
            const nonce = await this.approval.connect(user).depositPermitNonces(userAddress);
            const signature = await signSiloDepositTokensPermit(user, userAddress, user2Address, [this.siloToken.address], ['1000'], nonce);
            await expect(this.approval.connect(user).permitDeposits(
              user2Address, 
              signature.spender, 
              signature.tokens, 
              signature.values, 
              signature.deadline, 
              signature.split.v, 
              signature.split.r, 
              signature.split.s
            )).to.be.revertedWith("Silo: permit invalid signature")
          });
  
          it("reverts when transfer too much", async function() {
            await this.silo.connect(user).deposit(this.siloToken.address, '1000', EXTERNAL)
            const nonce = await this.approval.connect(user).depositPermitNonces(userAddress);
            const signature = await signSiloDepositTokensPermit(user, userAddress, user2Address, [this.siloToken.address], ['500'], nonce);
            await this.approval.connect(user2).permitDeposits(
              signature.owner, 
              signature.spender, 
              signature.tokens, 
              signature.values, 
              signature.deadline, 
              signature.split.v, 
              signature.split.r, 
              signature.split.s
            )

            const stem10 = await this.silo.seasonToStem(UNRIPE_BEAN, '10');
  
            await expect(
              this.silo.connect(user2).transferDeposit(userAddress, user2Address, this.siloToken.address, stem10, '1000')
            ).to.be.revertedWith("Silo: insufficient allowance")
  
            await expect(
              this.silo.connect(user2).transferDeposits(userAddress, user2Address, this.siloToken.address, [stem10], ['1000'])
            ).to.be.revertedWith("Silo: insufficient allowance")
          });
        });

        describe("approve permit", async function () {
          beforeEach(async function () {
            await this.season.teleportSunrise(10);
            this.season.deployStemsUpgrade();

            // Create permit
            const nonce = await this.approval.connect(user).depositPermitNonces(userAddress);
            const signature = await signSiloDepositTokensPermit(user, userAddress, user2Address, [this.siloToken.address], ['1000'], nonce);
            this.result = await this.approval.connect(user).permitDeposits(
              signature.owner, 
              signature.spender, 
              signature.tokens, 
              signature.values, 
              signature.deadline, 
              signature.split.v, 
              signature.split.r, 
              signature.split.s
            );
          });
  
          it("allow transfer all deposit", async function() {
            const stem10 = await this.silo.seasonToStem(UNRIPE_BEAN, '10');
            await this.silo.connect(user).deposit(this.siloToken.address, '1000', EXTERNAL)
            await this.silo.connect(user2).transferDeposit(userAddress, user2Address, this.siloToken.address, stem10, '1000')
  
            const user1Deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, stem10)
            expect(user1Deposit[0]).to.equal('0');
            expect(user1Deposit[1]).to.equal('0');
  
            const user2Deposit = await this.silo.getDeposit(user2Address, this.siloToken.address, stem10)
            expect(user2Deposit[0]).to.equal('1000');
            expect(user2Deposit[1]).to.equal('1000');
          });
  
          it("allow transfer all deposits", async function() {
            const stem10 = await this.silo.seasonToStem(UNRIPE_BEAN, '10');
            await this.silo.connect(user).deposit(this.siloToken.address, '1000', EXTERNAL)
            await this.silo.connect(user2).transferDeposits(userAddress, user2Address, this.siloToken.address, [stem10], ['1000'])
  
            const user1Deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, stem10)
            expect(user1Deposit[0]).to.equal('0');
            expect(user1Deposit[1]).to.equal('0');
  
            const user2Deposit = await this.silo.getDeposit(user2Address, this.siloToken.address, stem10)
            expect(user2Deposit[0]).to.equal('1000');
            expect(user2Deposit[1]).to.equal('1000');
          });
  
          it("allow transfer some deposit", async function() {
            const stem10 = await this.silo.seasonToStem(UNRIPE_BEAN, '10');
            await this.silo.connect(user).deposit(this.siloToken.address, '1000', EXTERNAL)
            await this.silo.connect(user2).transferDeposit(userAddress, user2Address, this.siloToken.address, stem10, '400')
  
            const user1Deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, stem10)
            expect(user1Deposit[0]).to.equal('600');
            expect(user1Deposit[1]).to.equal('600');
  
            const user2Deposit = await this.silo.getDeposit(user2Address, this.siloToken.address, stem10)
            expect(user2Deposit[0]).to.equal('400');
            expect(user2Deposit[1]).to.equal('400');
          });
  
          it("properly updates user permit nonce", async function() {
            expect(await this.approval.depositPermitNonces(userAddress)).to.be.equal('1')
          });
  
          it('properly updates user token allowance', async function () {
            expect(await this.approval.depositAllowance(userAddress, user2Address, this.siloToken.address)).to.be.equal('1000')
          });
  
          it('emits DepositApproval event', async function () {
            await expect(this.result).to.emit(this.approval, 'DepositApproval').withArgs(userAddress ,user2Address, this.siloToken.address, '1000');
          });
        });
      });
    });
  });

  /**
   * Vesting period now reverts and thus tests are skipped/invalid.
   */
  describe.skip("flash loan exploit", async function () {
    before(async function () {
      await this.siloToken.mint(flashLoanExploiterAddress, '1000');
      await this.siloToken.connect(flashLoanExploiter).approve(this.silo.address, '100000000000'); 
    })
    beforeEach(async function () {
      await this.season.teleportSunrise(10);
      this.season.deployStemsUpgrade();
      await network.provider.send("evm_setAutomine", [false]);
      await this.silo.connect(flashLoanExploiter).deposit(this.siloToken.address, '1000', EXTERNAL);
      await this.season.connect(user).siloSunrise(100);
      const stem10 = await this.silo.seasonToStem(this.siloToken.address, '10');
      this.result = await this.silo.connect(flashLoanExploiter).withdrawDeposit(this.siloToken.address, stem10, '1000', EXTERNAL)
      await network.provider.send("evm_mine");
      await network.provider.send("evm_setAutomine", [true]);
      getStartTime = await time.latest();
    });

    it('0 grown stalk', async function () {
      await expect(await this.silo.balanceOfGrownStalk(flashLoanExploiterAddress, this.siloToken.address)).to.eq('0');
      await expect(await this.silo.balanceOfRoots(flashLoanExploiterAddress)).to.eq('0');
    });

    it('does not allocate bean mints to the user', async function () {
      await expect( await this.silo.balanceOfEarnedBeans(flashLoanExploiterAddress)).to.eq('0');
    });

    it('does not allocate bean mints to user after the vesting period', async function () {
      await mineUpTo((await ethers.provider.getBlockNumber()) + 25 + 1);
      await expect(await this.silo.balanceOfGrownStalk(flashLoanExploiterAddress, this.siloToken.address)).to.eq('0');
      await expect(await this.silo.balanceOfEarnedBeans(flashLoanExploiterAddress)).to.eq('0');
      await expect(await this.silo.balanceOfRoots(flashLoanExploiterAddress)).to.eq('0');
    });
  });
});
