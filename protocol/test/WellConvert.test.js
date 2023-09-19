const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js');
const { getBeanstalk } = require('../utils/contracts.js');
const { deployWell, setReserves, whitelistWell } = require('../utils/well.js');
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { BEAN, WETH, UNRIPE_BEAN, UNRIPE_LP } = require('./utils/constants')
const { ConvertEncoder } = require('./utils/encoder.js')
const { to6, to18, toBean, toStalk } = require('./utils/helpers.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { setEthUsdPrice, setEthUsdcPrice, setEthUsdtPrice } = require('../scripts/usdOracle.js');
const ZERO_BYTES = ethers.utils.formatBytes32String('0x0')
let user, user2, owner;
let userAddress, ownerAddress, user2Address;

let salt = '0x0000000000000000000000000000000000000000000000000000000000000001'

describe('Well Convert', function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.beanstalk = await getBeanstalk(this.diamond.address);
    this.well = await deployWell([BEAN, WETH]);
    this.wellToken = await ethers.getContractAt("IERC20", this.well.address)
    this.convert = await ethers.getContractAt("MockConvertFacet", this.diamond.address)
    this.bean = await ethers.getContractAt("MockToken", BEAN);
    await this.bean.mint(ownerAddress, to18('1000000000'))
    await this.wellToken.connect(owner).approve(this.beanstalk.address, ethers.constants.MaxUint256)
    await this.bean.connect(owner).approve(this.beanstalk.address, ethers.constants.MaxUint256)

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

    await whitelistWell(this.well.address, '10000', to6('4'))
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe('calclates beans to peg', async function () {
    it('p > 1', async function () {
      await setReserves(owner, this.well, [to6('800000'), to18('1000')]);
      const maxAmountIn = await this.beanstalk.getMaxAmountIn(BEAN, this.well.address);
      expect(maxAmountIn).to.be.equal(to6('200000'));
      expect(await this.beanstalk.getAmountOut(BEAN, this.well.address, maxAmountIn)).to.be.equal('3338505354221892343955');

    });

    it('p = 1', async function () {
      expect(await this.beanstalk.getMaxAmountIn(BEAN, this.well.address)).to.be.equal('0');
    });

    it('p < 1', async function () {
      await setReserves(owner, this.well, [to6('1200000'), to18('1000')]);
      expect(await this.beanstalk.getMaxAmountIn(BEAN, this.well.address)).to.be.equal('0');
    });
  });

  describe('calclates lp to peg', async function () {
    it('p > 1', async function () {
      await setReserves(owner, this.well, [to6('800000'), to18('1000')]);
      expect(await this.beanstalk.getMaxAmountIn(this.well.address, BEAN)).to.be.equal('0');
    });

    it('p = 1', async function () {
      expect(await this.beanstalk.getMaxAmountIn(this.well.address, BEAN)).to.be.equal('0');
    });

    it('p < 1', async function () {
      await setReserves(owner, this.well, [to6('1200000'), to18('1000')]);
      const maxAmountIn = await this.beanstalk.getMaxAmountIn(this.well.address, BEAN)
      expect(maxAmountIn).to.be.equal('3018239549693752550560');
      expect(await this.beanstalk.getAmountOut(this.well.address, BEAN, maxAmountIn)).to.be.equal(to6('200000'));
    });
  })

  describe('convert beans to lp', async function () {
    describe('p > 1', async function () {
      beforeEach(async function () {
        await setReserves(owner, this.well, [to6('800000'), to18('1000')]);
      })

      it('convert below max', async function () {
        const convertData = ConvertEncoder.convertBeansToWellLP(to6('100000'), '1338505354221892343955', this.well.address)
        const [toToken, fromToken, toAmount, fromAmount] =
          await this.convert.connect(owner).callStatic.convertInternalE(
            this.bean.address,
            to6('100000'),
            convertData
          )
        expect(fromToken).to.be.equal(BEAN)
        expect(fromAmount).to.be.equal(to6('100000'))
        expect(toToken).to.be.equal(this.well.address)
        expect(toAmount).to.be.equal('1715728752538099023967')
      })

      it('convert equal to max', async function () {
        const convertData = ConvertEncoder.convertBeansToWellLP(to6('200000'), '3338505354221892343955', this.well.address)
        const [toToken, fromToken, toAmount, fromAmount] =
          await this.convert.connect(owner).callStatic.convertInternalE(
            this.bean.address,
            to6('200000'),
            convertData
          )
        expect(fromToken).to.be.equal(BEAN)
        expect(fromAmount).to.be.equal(to6('200000'))
        expect(toToken).to.be.equal(this.well.address)
        expect(toAmount).to.be.equal('3338505354221892343955')
      })

      it('convert greater than max', async function () {
        const convertData = ConvertEncoder.convertBeansToWellLP(to6('200000'), '3338505354221892343955', this.well.address)
        const [toToken, fromToken, toAmount, fromAmount] =
          await this.convert.connect(owner).callStatic.convertInternalE(
            this.bean.address,
            to6('400000'),
            convertData
          )
        expect(fromToken).to.be.equal(BEAN)
        expect(fromAmount).to.be.equal(to6('200000'))
        expect(toToken).to.be.equal(this.well.address)
        expect(toAmount).to.be.equal('3338505354221892343955')
      })

      it('deposit and convert below max', async function () {
        const convertData = ConvertEncoder.convertBeansToWellLP(to6('100000'), '1338505354221892343955', this.well.address)
        await this.bean.connect(owner).approve(this.beanstalk.address, to6('100000'))
        await this.beanstalk.connect(owner).deposit(BEAN, to6('100000'), 0)
        await this.convert.connect(owner).convert(
          convertData,
          ['0'],
          [to6('100000')]
        )
        deposit = await this.beanstalk.getDeposit(owner.address, this.well.address, '0')
        expect(deposit[0]).to.be.equal('1715728752538099023967')
      })

      it('reverts when USD oracle is broken', async function () {
        await setEthUsdPrice('0')
        const convertData = ConvertEncoder.convertBeansToWellLP(to6('100000'), '1338505354221892343955', this.well.address)
        await expect(this.convert.connect(owner).callStatic.convertInternalE(
          this.bean.address,
          to6('100000'),
          convertData
        )).to.be.revertedWith('Convert: USD Oracle failed')
      });
    });

    describe('p <= 1', async function () {

      it('convert revert', async function () {
        const convertData = ConvertEncoder.convertBeansToWellLP(to6('100000'), '1338505354221892343955', this.well.address)
        await expect(this.convert.connect(owner).callStatic.convertInternalE(
          this.bean.address,
          to6('100000'),
          convertData
        )).to.be.revertedWith('Convert: P must be >= 1.')
      })
    });
  })

  describe('convert lp to beans', async function () {
    describe('p <= 1', async function () {
      beforeEach(async function () {
        await setReserves(owner, this.well, [to6('1200000'), to18('1000')]);
      })

      it('convert below max', async function () {
        const convertData = ConvertEncoder.convertWellLPToBeans(to18('2000'), to6('100000'), this.well.address)
        const [toToken, fromToken, toAmount, fromAmount] =
          await this.convert.connect(owner).callStatic.convertInternalE(
            this.well.address,
            '3018239549693752550560',
            convertData
          )
        expect(fromToken).to.be.equal(this.well.address)
        expect(fromAmount).to.be.equal(to18('2000'))
        expect(toToken).to.be.equal(BEAN)
        expect(toAmount).to.be.equal('134564064605')
      })

      it('convert equal to max', async function () {
        const convertData = ConvertEncoder.convertWellLPToBeans('3018239549693752550560', to6('200000'), this.well.address)
        const [toToken, fromToken, toAmount, fromAmount] =
          await this.convert.connect(owner).callStatic.convertInternalE(
            this.well.address,
            '3018239549693752550560',
            convertData
          )
        expect(fromToken).to.be.equal(this.well.address)
        expect(fromAmount).to.be.equal('3018239549693752550560')
        expect(toToken).to.be.equal(BEAN)
        expect(toAmount).to.be.equal(to6('200000'))
      })

      it('convert above max', async function () {
        const convertData = ConvertEncoder.convertWellLPToBeans(to18('5000'), to6('100000'), this.well.address)
        const [toToken, fromToken, toAmount, fromAmount] =
          await this.convert.connect(owner).callStatic.convertInternalE(
            this.well.address,
            '3018239549693752550560',
            convertData
          )
        expect(fromToken).to.be.equal(this.well.address)
        expect(fromAmount).to.be.equal('3018239549693752550560')
        expect(toToken).to.be.equal(BEAN)
        expect(toAmount).to.be.equal(to6('200000'))
      })

      it('deposit and convert below max', async function () {
        const convertData = ConvertEncoder.convertWellLPToBeans(to18('2000'), to6('100000'), this.well.address)
        await this.beanstalk.connect(owner).deposit(this.well.address, to18('2000'), 0)
        await this.convert.connect(owner).convert(
          convertData,
          ['0'],
          [to18('2000')]
        )
        deposit = await this.beanstalk.getDeposit(owner.address, BEAN, '0')
        expect(deposit[0]).to.be.equal('134564064605')
      })

      it('reverts when USD oracle is broken', async function () {
        await setEthUsdPrice('0')
        const convertData = ConvertEncoder.convertWellLPToBeans('3018239549693752550560', to6('200000'), this.well.address)
        await expect(this.convert.connect(owner).callStatic.convertInternalE(
          this.well.address,
          '3018239549693752550560',
          convertData
        )).to.be.revertedWith('Convert: USD Oracle failed')
      });
    });

    describe('p > 1', async function () {
      it('convert revert', async function () {
        const convertData = ConvertEncoder.convertWellLPToBeans(to18('2000'), to6('100000'), this.well.address)
        await expect(this.convert.connect(owner).callStatic.convertInternalE(
            this.well.address,
            '3018239549693752550560',
            convertData
        )).to.be.revertedWith('Convert: P must be < 1.')
      })
    });
  })
});
