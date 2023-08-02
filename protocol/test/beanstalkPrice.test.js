const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { to18, to6, toStalk, advanceTime } = require('./utils/helpers.js')
const { BEAN, BEANSTALK, BEAN_3_CURVE, THREE_CURVE, THREE_POOL, WETH, STABLE_FACTORY, BEAN_ETH_WELL } = require('./utils/constants')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { time, mineUpTo, mine } = require("@nomicfoundation/hardhat-network-helpers");
const ZERO_BYTES = ethers.utils.formatBytes32String('0x0')
const { deployWell, setReserves, whitelistWell } = require('../utils/well.js');
const { setEthUsdPrice, setEthUsdcPrice, setEthUsdtPrice } = require('../scripts/usdOracle.js');
const { getBeanstalk } = require('../utils/contracts.js');
const { impersonateBeanEthWell } = require('../scripts/impersonate.js')
const fs = require('fs');

let user, user2, owner;
let userAddress, ownerAddress, user2Address;

describe('BeanstalkPrice', function () {
  before(async function () {

    [owner, user] = await ethers.getSigners();
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    userAddress = user.address;


    this.diamond = contracts.beanstalkDiamond;
    this.beanstalk = await getBeanstalk(this.diamond.address);
    this.curve = await ethers.getContractAt('CurveFacet', this.diamond.address)
    await impersonateBeanEthWell()
    this.well = await ethers.getContractAt("IWell", BEAN_ETH_WELL);
    this.wellToken = await ethers.getContractAt("IERC20", this.well.address)
    this.threeCurve = await ethers.getContractAt('MockToken', THREE_CURVE)
    this.threePool = await ethers.getContractAt('Mock3Curve', THREE_POOL)
    this.beanThreeCurve = await ethers.getContractAt('MockMeta3Curve', BEAN_3_CURVE);
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address);
    this.bean = await ethers.getContractAt("MockToken", BEAN);
  
    await this.bean.connect(user).approve(this.diamond.address, ethers.constants.MaxUint256)
    await this.bean.connect(user).approve(this.beanThreeCurve.address, ethers.constants.MaxUint256);
    await this.bean.mint(userAddress, to6('10000000000'))

    await this.threeCurve.mint(userAddress, to18('10000000000'))
    await this.threePool.set_virtual_price(to18('1'))
    await this.threeCurve.connect(user).approve(this.beanThreeCurve.address, ethers.constants.MaxUint256)
    
    await this.bean.mint(ownerAddress, to6('1000000000'))
    await this.wellToken.connect(owner).approve(this.beanstalk.address, ethers.constants.MaxUint256)
    await this.bean.connect(owner).approve(this.beanstalk.address, ethers.constants.MaxUint256)
    
    await this.beanThreeCurve.set_A_precise('1000')
    await this.beanThreeCurve.set_virtual_price(ethers.utils.parseEther('1'))
    await this.beanThreeCurve.connect(user).approve(this.threeCurve.address, ethers.constants.MaxUint256)
    await this.beanThreeCurve.connect(user).approve(this.diamond.address, ethers.constants.MaxUint256)
    await this.threeCurve.connect(user).approve(this.diamond.address, ethers.constants.MaxUint256)

    this.result = await this.curve.connect(user).addLiquidity(
      BEAN_3_CURVE,
      STABLE_FACTORY,
      [to6('500000'), to18('500000')],
      to18('0'),
      EXTERNAL,
      EXTERNAL
    )

    this.result = await this.curve.connect(user).addLiquidity(
      BEAN_3_CURVE,
      STABLE_FACTORY,
      [to6('500000'), to18('500000')],
      to18('0'),
      EXTERNAL,
      EXTERNAL
    )

    await setEthUsdPrice('999.998018')
    await setEthUsdcPrice('1000')
    await setEthUsdtPrice('1000')
    
    await setReserves(
      owner,
      this.well,
      [to6('1000000'), to18('1000')]
    );

    await setReserves(
      owner,
      this.well,
      [to6('1000000'), to18('1000')]
    );
      
    await whitelistWell(this.well.address, '10000', to6('4'));
    await this.season.captureWellE(this.well.address);

    const BeanstalkPrice = await ethers.getContractFactory('BeanstalkPrice');
    const _beanstalkPrice = await BeanstalkPrice.deploy();
    await _beanstalkPrice.deployed();
    this.beanstalkPrice = await ethers.getContractAt('BeanstalkPrice', _beanstalkPrice.address);

  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("Price", async function () {
    it('deltaB = 0', async function () {      
      const p = await this.beanstalkPrice.price()
      // price is within +/- 1 due to curve rounding
      expect(p.price).to.equal('999999');
      expect(p.liquidity).to.equal('3999997000000');
      // 
      expect(p.deltaB).to.be.lt(to6('1'));
    })

    it('deltaB > 0, curve only', async function () {
      this.result = await this.curve.connect(user).addLiquidity(
        BEAN_3_CURVE,
        STABLE_FACTORY,
        [to6('0'), to18('1000')],
        to18('0'),
        EXTERNAL,
        EXTERNAL
      )
      const p = await this.beanstalkPrice.price()
      expect(p.price).to.equal('1000044');
      expect(p.liquidity).to.equal('4001088000000');
      expect(p.deltaB).to.equal('499988642');
    })

    it('deltaB > 0, wells only', async function () {
      await advanceTime(1800)
      await setReserves(
        owner,
        this.well,
        [to6('500000'), to18('1000')]
      );
      await advanceTime(1800)
      await user.sendTransaction({
        to: beanstalk.address,
        value: 0
      })

      const p = await this.beanstalkPrice.price()
      expect(p.price).to.equal('1499997');
      expect(p.liquidity).to.equal('3999995000000');
      expect(p.deltaB).to.equal('133679332828');
    })

    it('deltaB > 0, wells and curve', async function () {
      this.result = await this.curve.connect(user).addLiquidity(
        BEAN_3_CURVE,
        STABLE_FACTORY,
        [to6('0'), to18('1000')],
        to18('0'),
        EXTERNAL,
        EXTERNAL
      )
      await advanceTime(1800)
      await setReserves(
        owner,
        this.well,
        [to6('500000'), to18('1000')]
      );
      await advanceTime(1800)
      await user.sendTransaction({
        to: beanstalk.address,
        value: 0
      })

      const p = await this.beanstalkPrice.price()
      expect(p.price).to.equal('1499906');
      expect(p.liquidity).to.equal('4001086000000');
      expect(p.deltaB).to.equal('134151772934');
    })

    it('deltaB < 0, curve only', async function () {
      this.result = await this.curve.connect(user).addLiquidity(
        BEAN_3_CURVE,
        STABLE_FACTORY,
        [to6('1000'), to18('0')],
        to18('0'),
        EXTERNAL,
        EXTERNAL
      )
      
      // ~500 beans need be to be bought to get back to peg
      const p = await this.beanstalkPrice.price()
      expect(p.price).to.equal('999953');
      expect(p.liquidity).to.equal('4000906909000');
      expect(p.deltaB).to.equal('-500011358');
    })

    it('deltaB < 0, wells only', async function () {
      await advanceTime(1800)
      await setReserves(
        owner,
        this.well,
        [to6('2000000'), to18('1000')]
      );
      await advanceTime(1800)
      await user.sendTransaction({
        to: beanstalk.address,
        value: 0
      })

      const p = await this.beanstalkPrice.price()
      expect(p.price).to.equal('749999');
      expect(p.liquidity).to.equal('3999995000000');
      expect(p.deltaB).to.equal('-224612602483');
    })

    it('deltaB < 0, wells and curve', async function () {
      this.result = await this.curve.connect(user).addLiquidity(
        BEAN_3_CURVE,
        STABLE_FACTORY,
        [to6('1000'), to18('0')],
        to18('0'),
        EXTERNAL,
        EXTERNAL
      )
      await advanceTime(1800)
      await setReserves(
        owner,
        this.well,
        [to6('2000000'), to18('1000')]
      );
      await advanceTime(1800)
      await user.sendTransaction({
        to: beanstalk.address,
        value: 0
      })

      const p = await this.beanstalkPrice.price()
      expect(p.price).to.equal('750011');
      expect(p.liquidity).to.equal('4000904909000');
      expect(p.deltaB).to.equal('-225034006822');
    })

    it('well deltaB > 0, curve deltaB < 0', async function () {
      this.result = await this.curve.connect(user).addLiquidity(
        BEAN_3_CURVE,
        STABLE_FACTORY,
        [to6('10000'), to18('0')],
        to18('0'),
        EXTERNAL,
        EXTERNAL
      )
      await advanceTime(1800)
      await setReserves(
        owner,
        this.well,
        [to6('500000'), to18('1000')]
      );
      await advanceTime(1800)
      await user.sendTransaction({
        to: beanstalk.address,
        value: 0
      })

      const p = await this.beanstalkPrice.price()
      expect(p.price).to.equal('1498410');
      expect(p.liquidity).to.equal('4009081950000');
      expect(p.deltaB).to.equal('128623115719');
    })

    it('well deltaB < 0, curve deltaB > 0', async function () {
      this.result = await this.curve.connect(user).addLiquidity(
        BEAN_3_CURVE,
        STABLE_FACTORY,
        [to6('0'), to18('10000')],
        to18('0'),
        EXTERNAL,
        EXTERNAL
      )
      await advanceTime(1800)
      await setReserves(
        owner,
        this.well,
        [to6('2000000'), to18('1000')]
      );
      await advanceTime(1800)
      await user.sendTransaction({
        to: beanstalk.address,
        value: 0
      })

      const p = await this.beanstalkPrice.price()
      expect(p.price).to.equal('751133');
      expect(p.liquidity).to.equal('4010901000000');
      expect(p.deltaB).to.equal('-219456573040');
    })

  });

});
