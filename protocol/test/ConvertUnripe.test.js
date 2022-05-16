const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { BEAN, THREE_CURVE, THREE_POOL, BEAN_3_CURVE, UNRIPE_BEAN, UNRIPE_LP } = require('./utils/constants')
const { ConvertEncoder } = require('./utils/encoder.js')
const { to6, to18, toBean, toStalk } = require('./utils/helpers.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const ZERO_BYTES = ethers.utils.formatBytes32String('0x0')
let user, user2, owner;
let userAddress, ownerAddress, user2Address;

describe('Unripe Convert', function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address);
    this.diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', this.diamond.address)
    this.silo = await ethers.getContractAt('SiloFacet', this.diamond.address);
    this.convert = await ethers.getContractAt('ConvertFacet', this.diamond.address);
    this.bean = await ethers.getContractAt('MockToken', BEAN);
    this.threePool = await ethers.getContractAt('Mock3Curve', THREE_POOL);
    this.threeCurve = await ethers.getContractAt('MockToken', THREE_CURVE);
    this.beanMetapool = await ethers.getContractAt('IMockCurvePool', BEAN_3_CURVE);

    await this.threeCurve.mint(userAddress, to18('100000'));
    await this.threePool.set_virtual_price(to18('1'));
    await this.threeCurve.connect(user).approve(this.beanMetapool.address, to18('100000000000'));

    await this.beanMetapool.connect(user).approve(this.threeCurve.address, to18('100000000000'));
    await this.beanMetapool.connect(user).approve(this.silo.address, to18('100000000000'));

    await this.season.siloSunrise(0);
    await this.bean.mint(userAddress, toBean('1000000000'));
    await this.bean.mint(user2Address, toBean('1000000000'));
    await this.bean.connect(user).approve(this.beanMetapool.address, to18('100000000000'));
    await this.bean.connect(user2).approve(this.beanMetapool.address, to18('100000000000'));
    await this.bean.connect(user).approve(this.silo.address, '100000000000');
    await this.bean.connect(user2).approve(this.silo.address, '100000000000');
    await this.beanMetapool.connect(user).add_liquidity([toBean('1000'), to18('1000')], to18('2000'));
    await this.beanMetapool.connect(user).transfer(ownerAddress, to18('1000'))

    this.unripe = await ethers.getContractAt('MockUnripeFacet', this.diamond.address)
    this.unripeBean = await ethers.getContractAt('MockToken', UNRIPE_BEAN)
    this.unripeLP = await ethers.getContractAt('MockToken', UNRIPE_LP)
    this.barnRaise = await ethers.getContractAt('MockBarnRaiseFacet', this.diamond.address)
    await this.unripeBean.mint(userAddress, to18('10000'))
    await this.unripeLP.mint(userAddress, to18('10000'))
    await this.unripeBean.connect(user).approve(this.diamond.address, to18('100000000'))
    await this.unripeLP.connect(user).approve(this.diamond.address, to18('100000000'))
    await this.barnRaise.setBarnRaiseE(true, to6('10000'))
    await this.unripe.addUnripeToken(UNRIPE_BEAN, BEAN, ZERO_BYTES)
    await this.unripe.addUnripeToken(UNRIPE_LP, BEAN_3_CURVE, ZERO_BYTES)
    await this.bean.mint(ownerAddress, to6('1000'))
    await this.bean.approve(this.diamond.address, to6('1000'))
    await this.beanMetapool.approve(this.diamond.address, to18('10000'))
    await this.unripe.connect(owner).addUnderlying(
      UNRIPE_BEAN,
      to6('1000')
    )
    await this.unripe.connect(owner).addUnderlying(
      UNRIPE_LP,
      to18('1000')
    )
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe('calclates beans to peg', async function () {
    it('p > 1', async function () {
      await this.beanMetapool.connect(user).add_liquidity([toBean('0'), to18('200')], to18('150'));
      expect(await this.convert.beansToPeg(UNRIPE_LP)).to.be.equal(to18('2000'));
    });

    it('p = 1', async function () {
      expect(await this.convert.beansToPeg(UNRIPE_LP)).to.be.equal('0');
    });

    it('p < 1', async function () {
      await this.beanMetapool.connect(user).add_liquidity([toBean('200'), to18('0')], to18('150'));
      expect(await this.convert.beansToPeg(UNRIPE_LP)).to.be.equal('0');
    });
  });

  describe('calclates lp to peg', async function () {
    it('p > 1', async function () {
      await this.beanMetapool.connect(user2).add_liquidity([toBean('200'), to18('0')], to18('150'));
      expect(await this.convert.lpToPeg(UNRIPE_LP)).to.be.within(to18('1990'), to18('2000'));
    });

    it('p = 1', async function () {
      expect(await this.convert.lpToPeg(UNRIPE_LP)).to.be.equal('0');
    });

    it('p < 1', async function () {
      await this.beanMetapool.connect(user).add_liquidity([toBean('0'), to18('200')], to18('150'));
      expect(await this.convert.lpToPeg(UNRIPE_LP)).to.be.equal('0');
    });
  })

  describe('convert beans to lp', async function () {

    describe('revert', async function () {
      it('not enough LP', async function () {
        await this.silo.connect(user).deposit(this.unripeBean.address, to18('200'), EXTERNAL);
        await this.beanMetapool.connect(user).add_liquidity([toBean('0'), to18('20')], to18('15'));
        await expect(this.convert.connect(user).convert(ConvertEncoder.convertUnripeBeansToLP(to18('200'), to18('200.1')), ['2'], [to18('200')]))
          .to.be.revertedWith('Curve: Not enough LP');
      });

      it('p >= 1', async function () {
        await this.silo.connect(user).deposit(this.unripeBean.address, to18('200'), EXTERNAL);
        await expect(this.convert.connect(user).convert(ConvertEncoder.convertUnripeBeansToLP(to18('200'), to18('190')), ['1'], ['1000']))
          .to.be.revertedWith('Convert: P must be >= 1.');
      });

    });

    describe('basic', function () {
      beforeEach(async function () {
        await this.silo.connect(user).deposit(this.unripeBean.address, to18('2000'), EXTERNAL);
        await this.beanMetapool.connect(user).add_liquidity([toBean('0'), to18('200')], to18('150'));
        this.result = await this.convert.connect(user).convert(ConvertEncoder.convertUnripeBeansToLP(to18('1000'), to18('1000')), ['2'], [to18('2000')])
      });

      it('properly updates total values', async function () {
        expect(await this.silo.getTotalDeposited(this.unripeBean.address)).to.eq(to18('1000'));
        expect(await this.silo.getTotalDeposited(this.unripeLP.address)).to.eq('1006344767347569855050');
        expect(await this.silo.totalSeeds()).to.eq(toBean('600'));
        expect(await this.silo.totalStalk()).to.eq(toStalk('200'));
      });

      it('properly updates user values', async function () {
        expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(toBean('600'));
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('200'));
      });

      it('properly updates user deposits', async function () {
        expect((await this.silo.getDeposit(userAddress, this.unripeBean.address, 2))[0]).to.eq(to18('1000'));
        const deposit = await this.silo.getDeposit(userAddress, this.unripeLP.address, 2);
        expect(deposit[0]).to.eq('1006344767347569855050');
        expect(deposit[1]).to.eq(toBean('100'));
      });

      it('emits events', async function () {
        await expect(this.result).to.emit(this.silo, 'RemoveDeposits')
          .withArgs(userAddress, this.unripeBean.address, [2], [to18('1000')], to18('1000'));
        await expect(this.result).to.emit(this.silo, 'AddDeposit')
          .withArgs(userAddress, this.unripeLP.address, 2, '1006344767347569855050', toBean('100'));
      });
    });

    describe('multiple crates', function () {
      beforeEach(async function () {
        await this.silo.connect(user).deposit(this.unripeBean.address, to18('1000'), EXTERNAL);
        await this.season.siloSunrise(0);
        await this.season.siloSunrise(0);
        await this.season.siloSunrise(0);
        await this.season.siloSunrise(0);
        await this.silo.connect(user).deposit(this.unripeBean.address, to18('1000'), EXTERNAL);
        await this.beanMetapool.connect(user).add_liquidity([toBean('0'), to18('200')], to18('150'));
        this.result = await this.convert.connect(user).convert(ConvertEncoder.convertUnripeBeansToLP(to18('2500'), to18('1900')), ['2', '6'], [to18('1000'), to18('1000')])
      });

      it('properly updates total values', async function () {
        expect(await this.silo.getTotalDeposited(this.unripeBean.address)).to.eq(to18('0'));
        expect(await this.silo.getTotalDeposited(this.unripeLP.address)).to.eq('2008324306927056243540');
        expect(await this.silo.totalSeeds()).to.eq(toBean('800'));
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('200.08'));
      });

      it('properly updates user values', async function () {
        expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(toBean('800'));
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('200.08'));
      });

      it('properly updates user deposits', async function () {
        expect((await this.silo.getDeposit(userAddress, this.unripeBean.address, 2))[0]).to.eq(toBean('0'));
        expect((await this.silo.getDeposit(userAddress, this.unripeBean.address, 6))[0]).to.eq(toBean('0'));
        const deposit = await this.silo.getDeposit(userAddress, this.unripeLP.address, 5);
        expect(deposit[0]).to.eq('2008324306927056243540');
        expect(deposit[1]).to.eq(toBean('200'));
      });

      it('emits events', async function () {
        await expect(this.result).to.emit(this.silo, 'RemoveDeposits')
          .withArgs(userAddress, this.unripeBean.address, [2, 6], [to18('1000'), to18('1000')], to18('2000'));
        await expect(this.result).to.emit(this.silo, 'AddDeposit')
          .withArgs(userAddress, this.unripeLP.address, 5, '2008324306927056243540', toBean('200'));
      });
    });
  });

  describe('convert lp to beans', async function () {
    describe('revert', async function () {
      it('not enough Beans', async function () {
        await this.beanMetapool.connect(user).add_liquidity([toBean('200'), to18('0')], to18('150'));
        await this.silo.connect(user).deposit(this.unripeLP.address, to18('1000'), EXTERNAL);

        await expect(this.convert.connect(user).convert(ConvertEncoder.convertUnripeLPToBeans(to18('2000'), to18('2500')), ['2'], [to18('2000')]))
          .to.be.revertedWith('Curve: Insufficient Output');
      });

      it('p >= 1', async function () {
        await this.beanMetapool.connect(user).add_liquidity([toBean('0'), to18('1')], to18('0.5'));
        await this.silo.connect(user).deposit(this.beanMetapool.address, to18('1000'), EXTERNAL);
        await expect(this.convert.connect(user).convert(ConvertEncoder.convertUnripeLPToBeans(to18('2000'), toBean('1900')), ['1'], ['1000']))
          .to.be.revertedWith('Convert: P must be < 1.');
      });
    });
  });

  describe('below max', function () {
    beforeEach(async function () {
      await this.beanMetapool.connect(user).add_liquidity([toBean('200'), to18('0')], to18('150'));
      await this.silo.connect(user).deposit(this.unripeLP.address, to18('1000'), EXTERNAL);
      this.result = await this.convert.connect(user).convert(ConvertEncoder.convertUnripeLPToBeans(to18('1000'), to18('990')), ['2'], [to18('1000')])
    });

    it('properly updates total values', async function () {
      expect(await this.silo.getTotalDeposited(this.unripeBean.address)).to.eq(to18('1006.18167'));
      expect(await this.silo.getTotalDeposited(this.unripeLP.address)).to.eq(to18('0'));
      expect(await this.silo.totalSeeds()).to.eq(to6('201.236334'));
      expect(await this.silo.totalStalk()).to.eq(toStalk('100.618167'));
    });

    it('properly updates user values', async function () {
      expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(to6('201.236334'));
      expect(await this.silo.totalStalk()).to.eq(toStalk('100.618167'));
    });
  });

  describe('multiple crates', function () {
    beforeEach(async function () {
      await this.beanMetapool.connect(user).add_liquidity([toBean('200'), to18('0')], to18('150'));
      await this.silo.connect(user).deposit(this.unripeLP.address, to18('500'), EXTERNAL);
      await this.season.siloSunrise(0);
      await this.season.siloSunrise(0);
      await this.silo.connect(user).deposit(this.unripeLP.address, to18('500'), EXTERNAL);
      this.result = await this.convert.connect(user).convert(ConvertEncoder.convertUnripeLPToBeans(to18('1000'), to18('990'), this.unripeLP.address), ['2', '4'], [to18('500'), to18('500')])
    });

    it('properly updates total values', async function () {
      expect(await this.silo.getTotalDeposited(this.unripeBean.address)).to.eq(to18('1006.18167'));
      expect(await this.silo.getTotalDeposited(this.unripeLP.address)).to.eq(to18('0'));
      expect(await this.silo.totalSeeds()).to.eq('201236334');
      expect(await this.silo.totalStalk()).to.eq(toStalk('100.6382906334'));
    });

    it('properly updates user values', async function () {
      expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('201236334');
      expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('100.6382906334'));
    });

    it('properly updates user deposits', async function () {
      expect((await this.silo.getDeposit(userAddress, this.unripeBean.address, 3))[0]).to.eq(to18('1006.18167'));
      const deposit = await this.silo.getDeposit(userAddress, this.unripeLP.address, 2);
      expect(deposit[0]).to.eq(to18('0'));
      expect(deposit[1]).to.eq(toBean('0'));
    });

    it('emits events', async function () {
      await expect(this.result).to.emit(this.silo, 'RemoveDeposits')
        .withArgs(userAddress, this.unripeLP.address, [2, 4], [to18('500'), to18('500')], to18('1000'));
      await expect(this.result).to.emit(this.silo, 'AddDeposit')
        .withArgs(userAddress, this.unripeBean.address, 3, to18('1006.18167'), to6('100.618167'));
    });
  });
});
