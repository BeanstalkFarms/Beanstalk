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
    this.beanstalk = await getAltBeanstalk(this.diamond.address);
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

    season = await this.season.season()
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("Unripe Bean Removal", async function () {
    describe("All but 1", async function () {
        beforeEach(async function () {
            // 158328 * 0.185564685220298701 ~= 29380.085
            // 158327 * 0.185564685220298701 ~= 29379.899
            // floor(29380.085) - floor(29379.899) = 1
            await this.silo.connect(user).mockUnripeBeanDeposit(season, '158328')
            await this.beanstalk.connect(user).withdrawDeposit(UNRIPE_BEAN, season, '158327');
        })
        it("should remove most of the deposit", async function () {
            const deposit = await this.beanstalk.connect(user).getDeposit(userAddress, UNRIPE_BEAN, season)
            expect(deposit[0]).to.equal('1')
            expect(deposit[1]).to.equal('1')
        });

        it("removes all stalk and seeds", async function () {
            const stalk = await this.beanstalk.balanceOfStalk(userAddress)
            const seeds = await this.beanstalk.balanceOfSeeds(userAddress)
            expect(stalk).to.equal('10000')
            expect(seeds).to.equal('2')
        })

    })
  })
});