const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { BEAN, THREE_POOL, BEAN_3_CURVE, UNRIPE_LP, UNRIPE_BEAN, ZERO_ADDRESS } = require('./utils/constants');
const { to18, to6 } = require('./utils/helpers.js')
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

    this.siloToken = await ethers.getContractFactory("MockToken");
    this.siloToken = await this.siloToken.deploy("Silo", "SILO")
    await this.siloToken.deployed()

    await this.silo.mockWhitelistToken(
      this.siloToken.address, 
      this.silo.interface.getSighash("mockBDV(uint256 amount)"), 
      '10000', 
      1e6 //aka "1 seed"
      );

    await this.season.siloSunrise(0);
    await this.bean.mint(userAddress, '1000000000');
    await this.bean.mint(ownerAddress, '1000000000');
    await this.siloToken.connect(user).approve(this.silo.address, '100000000000');
    await this.bean.connect(user).approve(this.silo.address, '100000000000');
    await this.bean.connect(owner).approve(this.silo.address, '100000000000'); 
    await this.siloToken.mint(userAddress, '10000');
    await this.siloToken.mint(ownerAddress, to18('1000'));
    await this.siloToken.approve(this.silo.address, to18('1000'));

    this.unripe = await ethers.getContractAt('MockUnripeFacet', this.silo.address)

    this.unripeLP = await ethers.getContractAt('MockToken', UNRIPE_LP)
    await this.unripeLP.connect(user).mint(userAddress, to18('10000'))
    await this.unripeLP.connect(user).approve(this.silo.address, to18('10000'))
    await this.unripe.addUnripeToken(UNRIPE_LP, this.siloToken.address, ZERO_BYTES)
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
      this.threePool = await ethers.getContractAt('Mock3Curve', THREE_POOL);
      await this.threePool.set_virtual_price(to18('1'));
      this.beanThreeCurve = await ethers.getContractAt('MockMeta3Curve', BEAN_3_CURVE);
      await this.beanThreeCurve.set_supply(to18('2000000'));
      await this.beanThreeCurve.set_A_precise('1000');
      await this.beanThreeCurve.set_virtual_price(to18('1'));
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
      expect(await this.silo.bdv(UNRIPE_LP, to18('2000'))).to.equal(to6('200'));
    })

    it("properly checks bdv", async function () {
      await this.threePool.set_virtual_price(to18('1.02'));
      expect(await this.silo.bdv(UNRIPE_LP, to18('20'))).to.equal('1998191');
    })
  })

  it("reverts if not correct", async function () {
    await expect(this.silo.bdv(ZERO_ADDRESS, to18('2000'))).to.be.revertedWith('Silo: Token not whitelisted')
  })
});