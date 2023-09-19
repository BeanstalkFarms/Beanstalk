const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { BEAN, THREE_POOL, BEAN_3_CURVE, UNRIPE_LP, UNRIPE_BEAN, ZERO_ADDRESS, WETH, BEAN_ETH_WELL } = require('./utils/constants');
const { to18, to6 } = require('./utils/helpers.js');
const { deployMockPump, getWellContractFactory, whitelistWell } = require('../utils/well.js');
const { impersonateContract } = require('../scripts/impersonate.js');
const { toBN } = require('../utils/helpers.js');
let user,user2,owner;
let userAddress, ownerAddress, user2Address;
const ZERO_BYTES = ethers.utils.formatBytes32String('0x0')

let snapshotId;

describe('BDV', function () {
  before(async function () {

    [owner,user,user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address);
    this.diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', this.diamond.address)
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address)
    this.convert = await ethers.getContractAt('ConvertFacet', this.diamond.address)
    this.bean = await ethers.getContractAt('MockToken', BEAN);
    this.bdv = await ethers.getContractAt('BDVFacet', this.diamond.address)

    this.well = await impersonateContract('MockSetComponentsWell', BEAN_ETH_WELL)

    await this.season.siloSunrise(0);
    await this.bean.mint(userAddress, '1000000000');
    await this.bean.mint(ownerAddress, '1000000000');
    await this.well.connect(user).approve(this.silo.address, '100000000000');
    await this.bean.connect(user).approve(this.silo.address, '100000000000');
    await this.bean.connect(owner).approve(this.silo.address, '100000000000'); 
    await this.well.mint(userAddress, '10000');
    await this.well.mint(ownerAddress, to18('1000'));
    await this.well.approve(this.silo.address, to18('1000'));

    this.unripe = await ethers.getContractAt('MockUnripeFacet', this.silo.address)

    this.unripeLP = await ethers.getContractAt('MockToken', UNRIPE_LP)
    await this.unripeLP.connect(user).mint(userAddress, to18('10000'))
    await this.unripeLP.connect(user).approve(this.silo.address, to18('10000'))
    await this.unripe.addUnripeToken(UNRIPE_LP, this.well.address, ZERO_BYTES)
    await this.unripe.connect(owner).addUnderlying(
      UNRIPE_LP,
      to18('1000')
    )

    this.unripeBean = await ethers.getContractAt('MockToken', UNRIPE_BEAN);
    await this.unripeBean.connect(user).mint(userAddress, to6('10000'))
    await this.unripeBean.connect(user).approve(this.silo.address, to6('10000'))
    await this.unripe.addUnripeToken(UNRIPE_BEAN, this.bean.address, ZERO_BYTES)
    await this.unripe.connect(owner).addUnderlying(
      UNRIPE_BEAN,
      to6('1000')
    )

  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("Bean BDV", async function () {
    it("properly checks bdv", async function () {
      expect(await this.silo.bdv(BEAN, to6('200'))).to.equal(to6('200'));
    })
  })

  describe("Bean Metapool BDV", async function () {
    before(async function () {
      this.threePool = await ethers.getContractAt('Mock3Curve', THREE_POOL);
      await this.threePool.set_virtual_price(to18('1'));
      this.beanThreeCurve = await ethers.getContractAt('MockMeta3Curve', BEAN_3_CURVE);
      await this.beanThreeCurve.set_supply(to18('2000000'));
      await this.beanThreeCurve.set_balances([
        to6('1000000'),
        to18('1000000')
      ]);
      await this.beanThreeCurve.set_balances([
        to6('1200000'),
        to18('1000000')
      ]);
    });

    it("properly checks bdv", async function () {
      expect(await this.silo.bdv(BEAN_3_CURVE, to18('200'))).to.equal(to6('200'));
    })

    it("properly checks bdv", async function () {
      await this.threePool.set_virtual_price(to18('1.02'));
      expect(await this.silo.bdv(BEAN_3_CURVE, to18('2'))).to.equal('1998191');
    })
  })

  describe("Unripe Bean BDV", async function () {
    it("properly checks bdv", async function () {
      expect(await this.silo.bdv(UNRIPE_BEAN, to6('200'))).to.equal(to6('20'));
    })
  })

  describe("Unripe LP BDV", async function () {
    before(async function () {
      this.pump = await deployMockPump()

      this.wellFunction = await (await getWellContractFactory('ConstantProduct2')).deploy()
      await this.wellFunction.deployed()

      await this.well.setPumps([[this.pump.address, '0x']])
      await this.well.setWellFunction([this.wellFunction.address, '0x'])
      await this.well.setTokens([BEAN, WETH])
      this.pump.setInstantaneousReserves([to18('1'), to18('1')])
      await whitelistWell(this.well.address, '10000', to6('4'))
    });

    it("properly checks bdv", async function () {
      const wellBdv = await this.silo.bdv(this.well.address, to18('200'))
      expect(await this.bdv.unripeLPToBDV(to18('2000'))).to.eq(wellBdv);
      expect(await this.silo.bdv(UNRIPE_LP, to18('2000'))).to.equal(wellBdv);
    })

    it("properly checks bdv", async function () {
      this.pump.setInstantaneousReserves([to18('1.02'), to18('1')])
      const wellBdv = await this.silo.bdv(this.well.address, to18('2'))
      expect(await this.bdv.unripeLPToBDV(to18('20'))).to.equal(wellBdv);
      expect(await this.silo.bdv(UNRIPE_LP, to18('20'))).to.equal(wellBdv);
    })
  })

  it("reverts if not correct", async function () {
    await expect(this.silo.bdv(ZERO_ADDRESS, to18('2000'))).to.be.revertedWith('Silo: Token not whitelisted')
  })
});