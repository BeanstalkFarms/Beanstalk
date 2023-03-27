const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js');
const { readPrune, toBN, signSiloDepositTokenPermit, signSiloDepositTokensPermit, getBean } = require('../utils');
const { getAltBeanstalk } = require('../utils/contracts.js');
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { BEAN, THREE_POOL, BEAN_3_CURVE, UNRIPE_LP, UNRIPE_BEAN, THREE_CURVE } = require('./utils/constants');
const { to18, to6, toStalk, toBean } = require('./utils/helpers.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const ZERO_BYTES = ethers.utils.formatBytes32String('0x0')

let user,user2,owner;
let userAddress, ownerAddress, user2Address;

let pru;

function pruneToSeeds(value, seeds = 2) {
  return prune(value).mul(seeds)
}

function pruneToStalk(value) {
  return prune(value).mul(toBN('10000'))
}

function prune(value) {
  return toBN(value).mul(toBN(pru)).div(to18('1'))
}

describe('Silo Enroot', function () {
  before(async function () {
    pru = await readPrune();
    [owner,user,user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address);
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address);
    this.unripe = await ethers.getContractAt('MockUnripeFacet', this.diamond.address);

    this.threeCurve = await ethers.getContractAt('MockToken', THREE_CURVE);
    this.beanMetapool = await ethers.getContractAt('IMockCurvePool', BEAN_3_CURVE);
    await this.beanMetapool.set_supply(ethers.utils.parseUnits('2000000', 6));
    await this.beanMetapool.set_balances([
      ethers.utils.parseUnits('1000000',6),
      ethers.utils.parseEther('1000000')
    ]);

    const SiloToken = await ethers.getContractFactory("MockToken");
    this.siloToken = await SiloToken.deploy("Silo", "SILO")
    await this.siloToken.deployed()

    this.siloToken2 = await SiloToken.deploy("Silo", "SILO")
    await this.siloToken2.deployed()

    await this.silo.mockWhitelistToken(
      this.siloToken.address, 
      this.silo.interface.getSighash("mockBDV(uint256 amount)"), 
      '10000',
      '1');

    await this.season.siloSunrise(0);
    await this.siloToken.connect(user).approve(this.silo.address, '100000000000');
    await this.siloToken.connect(user2).approve(this.silo.address, '100000000000'); 
    await this.siloToken.mint(userAddress, '10000');
    await this.siloToken.mint(user2Address, '10000');
    await this.siloToken2.connect(user).approve(this.silo.address, '100000000000');
    await this.siloToken2.mint(userAddress, '10000');

    await this.siloToken.connect(owner).approve(this.silo.address, to18('10000')); 
    await this.siloToken.mint(ownerAddress, to18('10000'));

    this.unripeBeans = await ethers.getContractAt('MockToken', UNRIPE_BEAN);
    await this.unripeBeans.connect(user).mint(userAddress, to6('10000'))
    await this.unripeBeans.connect(user).approve(this.silo.address, to18('10000'))
    await this.unripe.addUnripeToken(UNRIPE_BEAN, this.siloToken.address, ZERO_BYTES)
    await this.unripe.connect(owner).addUnderlying(
      UNRIPE_BEAN,
      to6('10000').mul(toBN(pru)).div(to18('1'))
    )

    this.unripeLP = await ethers.getContractAt('MockToken', UNRIPE_LP);
    await this.unripeLP.connect(user).mint(userAddress, to6('10000'))
    await this.unripeLP.connect(user).approve(this.silo.address, to18('10000'))
    await this.unripe.addUnripeToken(UNRIPE_LP, this.siloToken.address, ZERO_BYTES)
    await this.unripe.connect(owner).addUnderlying(
      UNRIPE_LP,
      toBN(pru).mul(toBN('10000'))
    )

    this.beanThreeCurve = await ethers.getContractAt('MockMeta3Curve', BEAN_3_CURVE);
    await this.beanThreeCurve.set_supply(ethers.utils.parseEther('2000000'));
    await this.beanThreeCurve.set_balances([
      ethers.utils.parseUnits('1000000',6),
      ethers.utils.parseEther('1000000')
    ]);
    await this.beanThreeCurve.set_balances([
      ethers.utils.parseUnits('1200000',6),
      ethers.utils.parseEther('1000000')
    ]);
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });


  it("enrootDeposit fails if not unripe token", async function () {
    await expect(this.silo.connect(user).enrootDeposit(BEAN, '1', '1')).to.be.revertedWith("Silo: token not unripe")
  })

  it("enrootDeposits fails if not unripe token", async function () {
    await expect(this.silo.connect(user).enrootDeposits(BEAN, ['1'], ['1'])).to.be.revertedWith("Silo: token not unripe")
  })

  describe("1 deposit, some", async function () {
    beforeEach(async function () {
      await this.silo.connect(user).deposit(UNRIPE_BEAN, to6('5'), EXTERNAL)
      await this.silo.connect(user).mockUnripeBeanDeposit('2', to6('5'))
      await this.unripe.connect(owner).addUnderlying(
        UNRIPE_BEAN,
        to6('1000')
      )

      this.result = await this.silo.connect(user).enrootDeposit(UNRIPE_BEAN, '2', to6('5'));
    })

    it('properly updates the total balances', async function () {
      expect(await this.silo.getTotalDeposited(UNRIPE_BEAN)).to.eq(to6('10'));
      expect(await this.silo.totalStalk()).to.eq(pruneToStalk(to6('10')).add(toStalk('0.5')));
      expect(await this.silo.totalSeeds()).to.eq(pruneToSeeds(to6('10')).add(to6('1')));
    });

    it('properly updates the user balance', async function () {
      expect(await this.silo.balanceOfStalk(userAddress)).to.eq(pruneToStalk(to6('10')).add(toStalk('0.5')));
      expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(pruneToSeeds(to6('10')).add(to6('1')));
    });

    it('properly removes the crate', async function () {
      let dep = await this.silo.getDeposit(userAddress, UNRIPE_BEAN, 2);
      expect(dep[0]).to.equal(to6('10'))
      expect(dep[1]).to.equal(prune(to6('10')).add(to6('0.5')))
    });

    it('emits Remove and Withdrawal event', async function () {
      await expect(this.result).to.emit(this.silo, 'RemoveDeposit').withArgs(userAddress, UNRIPE_BEAN, 2, to6('5'));
      await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(userAddress, UNRIPE_BEAN, 2, to6('5'), prune(to6('5')).add(to6('0.5')));
    });
  });

  describe("1 deposit after 1 sesaon, all", async function () {
    beforeEach(async function () {
      await this.silo.connect(user).deposit(UNRIPE_BEAN, to6('5'), EXTERNAL)
      await this.silo.connect(user).mockUnripeBeanDeposit('2', to6('5'))
      
      await this.season.lightSunrise()

      await this.unripe.connect(owner).addUnderlying(
        UNRIPE_BEAN,
        to6('5000').sub(to6('10000').mul(toBN(pru)).div(to18('1')))
      )

      this.result = await this.silo.connect(user).enrootDeposit(UNRIPE_BEAN, '2', to6('10'));
    })

    it('properly updates the total balances', async function () {
      expect(await this.silo.getTotalDeposited(UNRIPE_BEAN)).to.eq(to6('10'));
      expect(await this.silo.totalStalk()).to.eq(toStalk('5.001'));
      expect(await this.silo.totalSeeds()).to.eq(to6('10'));
    });

    it('properly updates the user balance', async function () {
      expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('5.001'));
      expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(to6('10'));
    });

    it('properly removes the crate', async function () {
      let dep = await this.silo.getDeposit(userAddress, UNRIPE_BEAN, 2);
      expect(dep[0]).to.equal(to6('10'))
      expect(dep[1]).to.equal(to6('5'))
    });

    it('emits Remove and Withdrawal event', async function () {
      await expect(this.result).to.emit(this.silo, 'RemoveDeposit').withArgs(userAddress, UNRIPE_BEAN, 2, to6('10'));
      await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(userAddress, UNRIPE_BEAN, 2, to6('10'), to6('5'));
    });
  });

  describe("2 deposit, all", async function () {
    beforeEach(async function () {
      await this.silo.connect(user).mockUnripeBeanDeposit('2', to6('5'))

      await this.season.lightSunrise()
      await this.silo.connect(user).deposit(UNRIPE_BEAN, to6('5'), EXTERNAL)
      
      
      await this.unripe.connect(owner).addUnderlying(
        UNRIPE_BEAN,
        to6('5000').sub(to6('10000').mul(toBN(pru)).div(to18('1')))
      )

      this.result = await this.silo.connect(user).enrootDeposits(UNRIPE_BEAN, ['2', '3'], [to6('5'), to6('5')]);
    })

    it('properly updates the total balances', async function () {
      expect(await this.silo.getTotalDeposited(UNRIPE_BEAN)).to.eq(to6('10'));
      expect(await this.silo.totalStalk()).to.eq(toStalk('5.0005'));
      expect(await this.silo.totalSeeds()).to.eq(to6('10'));
    });

    it('properly updates the user balance', async function () {
      expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('5.0005'));
      expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(to6('10'));
    });

    it('properly removes the crate', async function () {
      let dep = await this.silo.getDeposit(userAddress, UNRIPE_BEAN, 2);
      expect(dep[0]).to.equal(to6('5'))
      expect(dep[1]).to.equal(to6('2.5'))
    });

    it('emits Remove and Withdrawal event', async function () {
      await expect(this.result).to.emit(this.silo, 'RemoveDeposits').withArgs(userAddress, UNRIPE_BEAN, [2,3], [to6('5'), to6('5')], to6('10'));
      await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(userAddress, UNRIPE_BEAN, 2, to6('5'), to6('2.5'));
      await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(userAddress, UNRIPE_BEAN, 3, to6('5'), to6('2.5'));
    });
  });

  describe("2 deposit, round", async function () {

    beforeEach(async function () {
      // mockUnripeLPDeposit(uint256 t, uint32 _s, uint256 amount, uint256 bdv)
      await this.silo.connect(user).mockUnripeLPDeposit('0', '1', to18('0.000000083406453'), to6('10'))
      await this.silo.connect(user).mockUnripeLPDeposit('0', '2', to18('0.000000083406453'), to6('10'))

      const beanstalk = await getAltBeanstalk(this.silo.address)
      // await this.unripe.connect(owner).addUnderlying(
      //   UNRIPE_LP,
      //   toBN(pru).sub('60000000000').mul(toBN('10000'))
      //   // 1855646852202987000000
      //   // 1855646852202987000000
      // )

      await this.unripe.connect(owner).addUnderlying(
        UNRIPE_LP,
        '147796000000000'
      )

      this.result = await this.silo.connect(user).enrootDeposits(UNRIPE_LP, ['1', '2'], [to6('10'), to6('10')]);
    })

    it('properly updates the total balances', async function () {
      expect(await this.silo.getTotalDeposited(UNRIPE_LP)).to.eq(to6('20'));
      expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('3.7120342584'));
      expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(to6('14.845168'));
    });

    it('properly updates the user balance', async function () {
      expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('3.7120342584'));
      expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(to6('14.845168'));
    });

    it('properly updates the crate', async function () {
      let dep = await this.silo.getDeposit(userAddress, UNRIPE_LP, 1);
      expect(dep[0]).to.equal(to6('10'))
      expect(dep[1]).to.equal('1855646')
      dep = await this.silo.getDeposit(userAddress, UNRIPE_LP, 2);
      expect(dep[0]).to.equal(to6('10'))
      expect(dep[1]).to.equal('1855646')
    });
  })

//   describe("2 deposit, round", async function () {

//     beforeEach(async function () {
//       // mockUnripeLPDeposit(uint256 t, uint32 _s, uint256 amount, uint256 bdv)
//       await this.silo.connect(user).mockUnripeLPDeposit('0', '1', to18('0.000000083406453'), to6('10'))
//       await this.silo.connect(user).mockUnripeLPDeposit('0', '2', to18('0.000000083406453'), to6('10'))

//       const beanstalk = await getAltBeanstalk(this.silo.address)
//       // await this.unripe.connect(owner).addUnderlying(
//       //   UNRIPE_LP,
//       //   toBN(pru).sub('60000000000').mul(toBN('10000'))
//       //   // 1855646852202987000000
//       //   // 1855646852202987000000
//       // )

//       expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('3.7120342584'));
//       await this.unripe.connect(owner).addUnderlying(
//         UNRIPE_LP,
//         '1477960000000000'
//       )

//       this.result = await this.silo.connect(user).enrootDeposits(UNRIPE_LP, ['1', '2'], [to6('10'), to6('10')]);
//     })

//     it('properly updates the total balances', async function () {
//       expect(await this.silo.getTotalDeposited(UNRIPE_LP)).to.eq(to6('20'));
//       expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('3.7120342584'));
//       expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(to6('14.845168'));
//     });
//   })
});