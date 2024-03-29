const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { readPrune, toBN, } = require("../utils");
const { EXTERNAL } = require("./utils/balances.js");
const { BEAN, BEAN_3_CURVE, UNRIPE_LP, UNRIPE_BEAN, BEAN_WSTETH_WELL, ZERO_BYTES, WSTETH } = require("./utils/constants");
const { to18, to6, toStalk } = require("./utils/helpers.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { impersonateMockWell, impersonateBeanWstethWell, deployMockWell, deployMockWellWithMockPump } = require("../utils/well.js");
const { getAllBeanstalkContracts } = require("../utils/contracts");

let user, user2, owner;


const ENROOT_FIX_SEASON = 12793

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

describe("Silo Enroot", function () {
  before(async function () {
    pru = await readPrune();
    [owner, user, user2] = await ethers.getSigners();

    // Setup mock facets for manipulating Beanstalk's state during tests
    const contracts = await deploy(verbose = false, mock = true, reset = true)    
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [ beanstalk, mockBeanstalk ] = await getAllBeanstalkContracts(this.diamond.address);

    await mockBeanstalk.teleportSunrise(ENROOT_FIX_SEASON)

    const SiloToken = await ethers.getContractFactory("MockToken");
    this.siloToken = await SiloToken.deploy("Silo", "SILO");
    await this.siloToken.deployed();
    await this.siloToken.connect(user).approve(beanstalk.address, '100000000000');
    await this.siloToken.connect(user2).approve(beanstalk.address, '100000000000');
    await this.siloToken.mint(user.address, '10000');
    await this.siloToken.mint(user2.address, '10000');
    await mockBeanstalk.mockWhitelistToken(this.siloToken.address, mockBeanstalk.interface.getSighash("mockBDV(uint256 amount)"), "10000", "1");
    
    await mockBeanstalk.teleportSunrise(ENROOT_FIX_SEASON);
    [this.well, this.wellfunction, this.pump] = await deployMockWellWithMockPump(BEAN_WSTETH_WELL, WSTETH);

    await this.siloToken.connect(owner).approve(beanstalk.address, to18('10000'));
    await this.siloToken.mint(ownerAddress, to18('10000'));

    this.unripeBeans = await ethers.getContractAt("MockToken", UNRIPE_BEAN);
    await this.unripeBeans.connect(user).mint(user.address, to6("10000"));
    await this.unripeBeans.connect(user).approve(beanstalk.address, to18("10000"));
    await mockBeanstalk.addUnripeToken(UNRIPE_BEAN, this.siloToken.address, ZERO_BYTES);
    await mockBeanstalk.connect(owner).addUnderlying(UNRIPE_BEAN, to6("10000").mul(toBN(pru)).div(to18("1")));

    this.unripeLP = await ethers.getContractAt("MockToken", UNRIPE_LP);
    await this.unripeLP.connect(user).mint(user.address, to6("10000"));
    await this.unripeLP.connect(user).approve(beanstalk.address, to18("10000"));
    await mockBeanstalk.addUnripeToken(UNRIPE_LP, this.siloToken.address, ZERO_BYTES);
    await mockBeanstalk.connect(owner).addUnderlying(UNRIPE_LP, toBN(pru).mul(toBN("10000")));

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


  describe("Update Unripe Deposit", async function () {

    it("enrootDeposit fails if not unripe token", async function () {
      await expect(beanstalk.connect(user).enrootDeposit(BEAN, '1', '1')).to.be.revertedWith("Silo: token not unripe")
    })

    it("enrootDeposits fails if not unripe token", async function () {
      await expect(beanstalk.connect(user).enrootDeposits(BEAN, ['1'], ['1'])).to.be.revertedWith("Silo: token not unripe")
    })

    describe("1 deposit, some", async function () {
      beforeEach(async function () {
        mockBeanstalk.deployStemsUpgrade();

        await mockBeanstalk.connect(user).depositLegacy(UNRIPE_BEAN, to6('5'), EXTERNAL)
        await mockBeanstalk.connect(user).mockUnripeBeanDeposit(ENROOT_FIX_SEASON, to6('5'))

        await mockBeanstalk.connect(owner).addUnderlying(
          UNRIPE_BEAN,
          to6('1000')
        )

        const stem10 = await mockBeanstalk.mockSeasonToStem(UNRIPE_BEAN, ENROOT_FIX_SEASON);
        // migrate to new deposit system since the mock stuff deposits in old one (still useful to test)
        await beanstalk.mowAndMigrate(user.address, [UNRIPE_BEAN], [[ENROOT_FIX_SEASON]], [[to6('10')]], 0, 0, []);
        // call sunrise twice to finish germination process.
        this.result = await beanstalk.connect(user).enrootDeposit(UNRIPE_BEAN, stem10, to6('5'));
      })

      it('properly updates the total balances', async function () {
        expect(await beanstalk.getTotalDeposited(UNRIPE_BEAN)).to.eq(to6('10'));
        expect(await beanstalk.getTotalDepositedBdv(UNRIPE_BEAN)).to.eq(pruneToStalk(to6('10')).add(toStalk('0.5')).div('10000'));
        expect(await beanstalk.totalStalk()).to.eq(pruneToStalk(to6('10')).add(toStalk('0.5')));
      });

      it('properly updates the user balance', async function () {
        expect(await beanstalk.balanceOfStalk(user.address)).to.eq(pruneToStalk(to6('10')).add(toStalk('0.5')));
        expect(await beanstalk.balanceOfGerminatingStalk(user.address)).to.eq('0');
      });

      it('properly removes the crate', async function () {
        const stem10 = await mockBeanstalk.mockSeasonToStem(this.siloToken.address, ENROOT_FIX_SEASON);
        let dep = await beanstalk.getDeposit(user.address, UNRIPE_BEAN, stem10);
        
        expect(dep[0]).to.equal(to6('10'))
        expect(dep[1]).to.equal(prune(to6('10')).add(to6('0.5')))
      });

      it('emits Remove and Add Deposit event', async function () {
        const stem10 = await mockBeanstalk.mockSeasonToStem(this.siloToken.address, ENROOT_FIX_SEASON);
        await expect(this.result).to.emit(beanstalk, 'RemoveDeposit').withArgs(user.address, UNRIPE_BEAN, stem10, to6('5'), '927823');
        await expect(this.result).to.emit(beanstalk, 'AddDeposit').withArgs(user.address, UNRIPE_BEAN, stem10, to6('5'), prune(to6('5')).add(to6('0.5')));
      });
    });

    describe("1 deposit after 1 season, all", async function () {
      beforeEach(async function () {
        mockBeanstalk.deployStemsUpgrade();

        await mockBeanstalk.connect(user).depositLegacy(UNRIPE_BEAN, to6('5'), EXTERNAL) //need to do legacy deposit to simulate pre-stems upgrade
        await mockBeanstalk.connect(user).mockUnripeBeanDeposit(ENROOT_FIX_SEASON, to6('5'))
        
        await mockBeanstalk.lightSunrise()

        await mockBeanstalk.connect(owner).addUnderlying(
          UNRIPE_BEAN,
          to6('5000').sub(to6('10000').mul(toBN(pru)).div(to18('1')))
        )

        // const stem10 = await mockBeanstalk.mockSeasonToStem(UNRIPE_BEAN, '10');

        await beanstalk.mowAndMigrate(user.address, [UNRIPE_BEAN], [[ENROOT_FIX_SEASON]], [[to6('10')]], 0, 0, []);

        this.result = await beanstalk.connect(user).enrootDeposit(UNRIPE_BEAN, '0', to6('10'));
      })

      it('properly updates the total balances', async function () {
        expect(await beanstalk.getTotalDeposited(UNRIPE_BEAN)).to.eq(to6('10'));
        expect(await beanstalk.getGerminatingTotalDeposited(UNRIPE_BEAN)).to.eq('0');

        expect(await beanstalk.getTotalDepositedBdv(UNRIPE_BEAN)).to.eq(to6('5'));
        expect(await beanstalk.getGerminatingTotalDepositedBdv(UNRIPE_BEAN)).to.eq('0');
        
        expect(await beanstalk.totalStalk()).to.eq(toStalk('5.001'));
      });

      it('properly updates the user balance', async function () {
        expect(await beanstalk.balanceOfStalk(user.address)).to.eq(toStalk('5.001'));
      });

      it('properly removes the crate', async function () {
        const stem10 = await mockBeanstalk.mockSeasonToStem(UNRIPE_BEAN, ENROOT_FIX_SEASON);
        let dep = await beanstalk.getDeposit(user.address, UNRIPE_BEAN, stem10);
        expect(dep[0]).to.equal(to6('10'))
        expect(dep[1]).to.equal(to6('5'))
      });

      it('emits Remove and Add Deposit event', async function () {
        const stem10 = await mockBeanstalk.mockSeasonToStem(UNRIPE_BEAN, ENROOT_FIX_SEASON);
        await expect(this.result).to.emit(beanstalk, 'RemoveDeposit').withArgs(user.address, UNRIPE_BEAN, stem10, to6('10'), '1855646');
        await expect(this.result).to.emit(beanstalk, 'AddDeposit').withArgs(user.address, UNRIPE_BEAN, stem10, to6('10'), to6('5'));
      });
    });

    describe("2 deposit, all", async function () {
      beforeEach(async function () {
        await mockBeanstalk.connect(user).mockUnripeBeanDeposit(ENROOT_FIX_SEASON, to6('5'))

        await mockBeanstalk.lightSunrise()
        await mockBeanstalk.connect(user).depositLegacy(UNRIPE_BEAN, to6('5'), EXTERNAL)
        
        mockBeanstalk.deployStemsUpgrade();
        
        await mockBeanstalk.connect(owner).addUnderlying(
          UNRIPE_BEAN,
          to6('5000').sub(to6('10000').mul(toBN(pru)).div(to18('1')))
        )


        await beanstalk.mowAndMigrate(user.address, [UNRIPE_BEAN], [[ENROOT_FIX_SEASON, ENROOT_FIX_SEASON+1]], [[to6('5'), to6('5')]], 0, 0, []);

        const stem10 = await mockBeanstalk.mockSeasonToStem(UNRIPE_BEAN, ENROOT_FIX_SEASON);

        const stem11 = await mockBeanstalk.mockSeasonToStem(UNRIPE_BEAN, ENROOT_FIX_SEASON+1);
        this.result = await beanstalk.connect(user).enrootDeposits(UNRIPE_BEAN, [stem10, stem11], [to6('5'), to6('5')]);
      })

      it('properly updates the total balances', async function () {
        expect(await beanstalk.getTotalDeposited(UNRIPE_BEAN)).to.eq(to6('10'));
        expect(await beanstalk.getTotalDepositedBdv(UNRIPE_BEAN)).to.eq(to6('5'));
        expect(await beanstalk.totalStalk()).to.eq(toStalk('5.0005'));
      });

      it('properly updates the user balance', async function () {
        expect(await beanstalk.balanceOfStalk(user.address)).to.eq(toStalk('5.0005'));
      });

      it('properly removes the crate', async function () {
        const stem10 = await mockBeanstalk.mockSeasonToStem(UNRIPE_BEAN, ENROOT_FIX_SEASON);
        let dep = await beanstalk.getDeposit(user.address, UNRIPE_BEAN, stem10);
        expect(dep[0]).to.equal(to6('5'))
        expect(dep[1]).to.equal(to6('2.5'))
      });

      it('emits Remove and Add Deposits event', async function () {
        const stem10 = await mockBeanstalk.mockSeasonToStem(UNRIPE_BEAN, ENROOT_FIX_SEASON);
        const stem11 = await mockBeanstalk.mockSeasonToStem(UNRIPE_BEAN, ENROOT_FIX_SEASON+1);
        await expect(this.result).to.emit(beanstalk, 'RemoveDeposits').withArgs(user.address, UNRIPE_BEAN, [stem10,stem11], [to6('5'), to6('5')], to6('10'), ['927823', '927823']);
        await expect(this.result).to.emit(beanstalk, 'AddDeposit').withArgs(user.address, UNRIPE_BEAN, stem10, to6('5'), to6('2.5'));
        await expect(this.result).to.emit(beanstalk, 'AddDeposit').withArgs(user.address, UNRIPE_BEAN, stem11, to6('5'), to6('2.5'));
      });
    });

    describe("2 deposit, round", async function () {

      beforeEach(async function () {
        await mockBeanstalk.connect(owner).addUnderlying(UNRIPE_LP, '147796000000000')
        await mockBeanstalk.setBarnRaiseWell(BEAN_WSTETH_WELL);
        await mockBeanstalk.connect(user).mockUnripeLPDeposit('0', ENROOT_FIX_SEASON, to18('0.000000083406453'), to6('10'))
        await mockBeanstalk.lightSunrise()
        await mockBeanstalk.connect(user).mockUnripeLPDeposit('0', ENROOT_FIX_SEASON+1, to18('0.000000083406453'), to6('10'))

        mockBeanstalk.deployStemsUpgrade();
        await beanstalk.mowAndMigrate(user.address, [UNRIPE_LP], [[ENROOT_FIX_SEASON, ENROOT_FIX_SEASON+1]], [[to6('10'), to6('10')]], 0, 0, []);

        const stem10 = await mockBeanstalk.mockSeasonToStem(UNRIPE_LP, ENROOT_FIX_SEASON);
        const stem11 = await mockBeanstalk.mockSeasonToStem(UNRIPE_LP, ENROOT_FIX_SEASON+1);
        this.result = await beanstalk.connect(user).enrootDeposits(UNRIPE_LP, [stem10, stem11], [to6('10'), to6('10')]);
      })
  
      it('properly updates the total balances', async function () {
        expect(await beanstalk.getTotalDeposited(UNRIPE_LP)).to.eq(to6('20'));
        expect(await beanstalk.totalStalk()).to.eq(toStalk('234.7697275564'));
      });
  
      it('properly updates the user balance', async function () {
        expect(await beanstalk.balanceOfStalk(user.address)).to.eq(toStalk('234.7697275564'));
      });
  
      it('properly updates the crate', async function () {
        const bdv = await beanstalk.bdv(UNRIPE_LP, to6('20'))
        const stem10 = await mockBeanstalk.mockSeasonToStem(UNRIPE_LP, ENROOT_FIX_SEASON);
        let dep = await beanstalk.getDeposit(user.address, UNRIPE_LP, stem10);
        expect(dep[0]).to.equal(to6('10'))
        expect(dep[1]).to.equal(bdv.div('2'))
        const stem11 = await mockBeanstalk.mockSeasonToStem(UNRIPE_LP, ENROOT_FIX_SEASON+1);
        dep = await beanstalk.getDeposit(user.address, UNRIPE_LP, stem11);
        expect(dep[0]).to.equal(to6('10'))
        expect(dep[1]).to.equal(bdv.sub('1').div('2').add('1'))
      });
    });
  });
});
