const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL } = require('./utils/balances.js')
const { to18, to6, advanceTime } = require('./utils/helpers.js')
const { BEAN, BEAN_3_CURVE, THREE_CURVE, THREE_POOL, STABLE_FACTORY, BEAN_ETH_WELL, BEAN_WSTETH_WELL } = require('./utils/constants.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot.js");
const { setReserves, impersonateBeanWstethWell, impersonateBeanEthWell } = require('../utils/well.js');
const { setEthUsdChainlinkPrice } = require('../utils/oracle.js');
const { getAllBeanstalkContracts } = require("../utils/contracts");
const fs = require('fs');

let user, user2, owner;


describe('BeanstalkPrice', function () {
  before(async function () {

    [owner, user] = await ethers.getSigners();
    const contracts = await deploy(verbose = false, mock = true, reset = true)    
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [ beanstalk, mockBeanstalk ] = await getAllBeanstalkContracts(this.diamond.address);

    await impersonateBeanEthWell();
    await impersonateBeanWstethWell();
    
    this.beanEthWell = await ethers.getContractAt("IWell", BEAN_ETH_WELL);
    this.beanWstethWell = await ethers.getContractAt("IWell", BEAN_WSTETH_WELL);
    this.wellToken = await ethers.getContractAt("IERC20", this.beanEthWell.address)
    this.threeCurve = await ethers.getContractAt('MockToken', THREE_CURVE)
    this.threePool = await ethers.getContractAt('Mock3Curve', THREE_POOL)
    this.beanThreeCurve = await ethers.getContractAt('MockMeta3Curve', BEAN_3_CURVE);
    bean = await ethers.getContractAt("MockToken", BEAN);
  
    await bean.connect(user).approve(this.diamond.address, ethers.constants.MaxUint256)
    await bean.connect(user).approve(this.beanThreeCurve.address, ethers.constants.MaxUint256);
    await bean.mint(user.address, to6('10000000000'))

    await this.threeCurve.mint(user.address, to18('10000000000'))
    await this.threePool.set_virtual_price(to18('1'))
    await this.threeCurve.connect(user).approve(this.beanThreeCurve.address, ethers.constants.MaxUint256)
    
    await bean.mint(ownerAddress, to6('1000000000'))
    await this.wellToken.connect(owner).approve(beanstalk.address, ethers.constants.MaxUint256)
    await bean.connect(owner).approve(beanstalk.address, ethers.constants.MaxUint256)
    
    await this.beanThreeCurve.set_A_precise('1000')
    await this.beanThreeCurve.set_virtual_price(ethers.utils.parseEther('1'))
    await this.beanThreeCurve.connect(user).approve(this.threeCurve.address, ethers.constants.MaxUint256)
    await this.beanThreeCurve.connect(user).approve(this.diamond.address, ethers.constants.MaxUint256)
    await this.threeCurve.connect(user).approve(this.diamond.address, ethers.constants.MaxUint256)

    this.result = await beanstalk.connect(user).addLiquidity(
      BEAN_3_CURVE,
      STABLE_FACTORY,
      [to6('500000'), to18('500000')],
      to18('0'),
      EXTERNAL,
      EXTERNAL
    )

    this.result = await beanstalk.connect(user).addLiquidity(
      BEAN_3_CURVE,
      STABLE_FACTORY,
      [to6('500000'), to18('500000')],
      to18('0'),
      EXTERNAL,
      EXTERNAL
    )

    // set reserves of bean eth and bean wsteth wells.
    await setReserves(owner, this.beanEthWell, [to6('1000000'), to18('1000')]);
    await setReserves(owner, this.beanWstethWell, [to6('1000000'), to18('1000')]);

    await setEthUsdChainlinkPrice('1000')

    const BeanstalkPrice = await ethers.getContractFactory('BeanstalkPrice');
    const _beanstalkPrice = await BeanstalkPrice.deploy(this.diamond.address);
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
      // price is within +/- 1 due to rounding
      expect(p.price).to.equal('999999');
      expect(p.liquidity).to.equal('3999997000000');
      expect(p.deltaB).to.be.eq('0');
    })

    it('deltaB > 0, curve only', async function () {
      this.result = await beanstalk.connect(user).addLiquidity(
        BEAN_3_CURVE,
        STABLE_FACTORY,
        [to6('0'), to18('100000')],
        to18('0'),
        EXTERNAL,
        EXTERNAL
      )
      const p = await this.beanstalkPrice.price()
      const c = await this.beanstalkPrice.getCurve()
      const w = await this.beanstalkPrice.getConstantProductWell(this.beanEthWell.address)

      expect(p.price).to.equal('1004479');
      expect(p.liquidity).to.equal('4108727000000');
      expect(p.deltaB).to.equal('49891561002');

      expect(c.price).to.equal('1008729');
      expect(c.liquidity).to.equal('2108729000000');
      expect(c.deltaB).to.equal('49891561002');

      expect(w.price).to.equal('999999');
      expect(w.liquidity).to.equal('1999998000000');
      expect(w.deltaB).to.equal('0');
    })

    it('deltaB > 0, wells only', async function () {
      await advanceTime(1800)
      await setReserves(
        owner,
        this.beanEthWell,
        [to6('500000'), to18('1000')]
      );
      await advanceTime(1800)
      await user.sendTransaction({
        to: beanstalk.address,
        value: 0
      })

      const p = await this.beanstalkPrice.price()
      const c = await this.beanstalkPrice.getCurve()
      const w = await this.beanstalkPrice.getConstantProductWell(this.beanEthWell.address)

      expect(p.price).to.equal('1499997');
      expect(p.liquidity).to.equal('3999995000000');
      expect(p.deltaB).to.equal('207106781186');

      expect(c.price).to.equal('999999');
      expect(c.liquidity).to.equal('1999999000000');
      expect(c.deltaB).to.equal('0');

      expect(w.price).to.equal('1999996');
      expect(w.liquidity).to.equal('1999996000000');
      expect(w.deltaB).to.equal('207106781186');
    })

    it('deltaB > 0, wells and curve', async function () {
      this.result = await beanstalk.connect(user).addLiquidity(
        BEAN_3_CURVE,
        STABLE_FACTORY,
        [to6('0'), to18('100000')],
        to18('0'),
        EXTERNAL,
        EXTERNAL
      )
      await advanceTime(1800)
      await setReserves(
        owner,
        this.beanEthWell,
        [to6('500000'), to18('1000')]
      );
      await advanceTime(1800)
      await user.sendTransaction({
        to: beanstalk.address,
        value: 0
      })

      const p = await this.beanstalkPrice.price()
      const c = await this.beanstalkPrice.getCurve()
      const w = await this.beanstalkPrice.getConstantProductWell(this.beanEthWell.address)

      expect(p.price).to.equal('1491246');
      expect(p.liquidity).to.equal('4108725000000');
      expect(p.deltaB).to.equal('256998342188');

      expect(c.price).to.equal('1008729');
      expect(c.liquidity).to.equal('2108729000000');
      expect(c.deltaB).to.equal('49891561002');

      expect(w.price).to.equal('1999996');
      expect(w.liquidity).to.equal('1999996000000');
      expect(w.deltaB).to.equal('207106781186');
    })

    it('deltaB < 0, curve only', async function () {
      this.result = await beanstalk.connect(user).addLiquidity(
        BEAN_3_CURVE,
        STABLE_FACTORY,
        [to6('100000'), to18('0')],
        to18('0'),
        EXTERNAL,
        EXTERNAL
      )
      
      // ~500 beans need be to be bought to get back to peg
      const p = await this.beanstalkPrice.price()
      const c = await this.beanstalkPrice.getCurve()
      const w = await this.beanstalkPrice.getConstantProductWell(this.beanEthWell.address)

      expect(p.price).to.equal('995576');
      expect(p.liquidity).to.equal('4090478600000');
      expect(p.deltaB).to.equal('-50108438998');

      expect(c.price).to.equal('991346');
      expect(c.liquidity).to.equal('2090480600000');
      expect(c.deltaB).to.equal('-50108438998');

      expect(w.price).to.equal('999999');
      expect(w.liquidity).to.equal('1999998000000');
      expect(w.deltaB).to.equal('0');
      
    })

    it('deltaB < 0, wells only', async function () {
      await advanceTime(1800)
      await setReserves(
        owner,
        this.beanEthWell,
        [to6('2000000'), to18('1000')]
      );
      await advanceTime(1800)
      await user.sendTransaction({
        to: beanstalk.address,
        value: 0
      })

      const p = await this.beanstalkPrice.price()
      const c = await this.beanstalkPrice.getCurve()
      const w = await this.beanstalkPrice.getConstantProductWell(this.beanEthWell.address)

      expect(p.price).to.equal('749999');
      expect(p.liquidity).to.equal('3999995000000');
      expect(p.deltaB).to.equal('-585786437627');

      expect(c.price).to.equal('999999');
      expect(c.liquidity).to.equal('1999999000000');
      expect(c.deltaB).to.equal('0');

      expect(w.price).to.equal('499999');
      expect(w.liquidity).to.equal('1999996000000');
      expect(w.deltaB).to.equal('-585786437627');
    })

    it('deltaB < 0, wells and curve', async function () {
      this.result = await beanstalk.connect(user).addLiquidity(
        BEAN_3_CURVE,
        STABLE_FACTORY,
        [to6('100000'), to18('0')],
        to18('0'),
        EXTERNAL,
        EXTERNAL
      )
      await advanceTime(1800)
      await setReserves(
        owner,
        this.beanEthWell,
        [to6('2000000'), to18('1000')]
      );
      await advanceTime(1800)
      await user.sendTransaction({
        to: beanstalk.address,
        value: 0
      })

      const p = await this.beanstalkPrice.price()
      const c = await this.beanstalkPrice.getCurve()
      const w = await this.beanstalkPrice.getConstantProductWell(this.beanEthWell.address)

      expect(p.price).to.equal('751106');
      expect(p.liquidity).to.equal('4090476600000');
      expect(p.deltaB).to.be.eq('-635894876625')

      expect(c.price).to.equal('991346');
      expect(c.liquidity).to.equal('2090480600000');
      expect(c.deltaB).to.equal('-50108438998');

      expect(w.price).to.equal('499999');
      expect(w.liquidity).to.equal('1999996000000');
      expect(w.deltaB).to.equal('-585786437627');
    })

    it('well deltaB > 0, curve deltaB < 0', async function () {
      this.result = await beanstalk.connect(user).addLiquidity(
        BEAN_3_CURVE,
        STABLE_FACTORY,
        [to6('100000'), to18('0')],
        to18('0'),
        EXTERNAL,
        EXTERNAL
      )
      await advanceTime(1800)
      await setReserves(
        owner,
        this.beanEthWell,
        [to6('500000'), to18('1000')]
      );
      await advanceTime(1800)
      await user.sendTransaction({
        to: beanstalk.address,
        value: 0
      })

      const p = await this.beanstalkPrice.price()
      const c = await this.beanstalkPrice.getCurve()
      const w = await this.beanstalkPrice.getConstantProductWell(this.beanEthWell.address)

      expect(p.price).to.equal('1484514');
      expect(p.liquidity).to.equal('4090476600000');
      expect(p.deltaB).to.equal('156998342188');

      expect(c.price).to.equal('991346');
      expect(c.liquidity).to.equal('2090480600000');
      expect(c.deltaB).to.equal('-50108438998');

      expect(w.price).to.equal('1999996');
      expect(w.liquidity).to.equal('1999996000000');
      expect(w.deltaB).to.be.eq('207106781186');
    })

    it('well deltaB < 0, curve deltaB > 0', async function () {
      this.result = await beanstalk.connect(user).addLiquidity(
        BEAN_3_CURVE,
        STABLE_FACTORY,
        [to6('0'), to18('100000')],
        to18('0'),
        EXTERNAL,
        EXTERNAL
      )
      await advanceTime(1800)
      await setReserves(
        owner,
        this.beanEthWell,
        [to6('2000000'), to18('1000')]
      );
      await advanceTime(1800)
      await user.sendTransaction({
        to: beanstalk.address,
        value: 0
      })

      const p = await this.beanstalkPrice.price()
      const c = await this.beanstalkPrice.getCurve()
      const w = await this.beanstalkPrice.getConstantProductWell(this.beanEthWell.address)

      expect(p.price).to.equal('761095');
      expect(p.liquidity).to.equal('4108725000000');
      expect(p.deltaB).to.be.eq('-535894876625');

      expect(c.price).to.equal('1008729');
      expect(c.liquidity).to.equal('2108729000000');
      expect(c.deltaB).to.equal('49891561002');

      expect(w.price).to.equal('499999');
      expect(w.liquidity).to.equal('1999996000000');
      expect(w.deltaB).to.equal('-585786437627');
    })

  });

});
