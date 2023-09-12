const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { BEAN, THREE_CURVE, THREE_POOL, BEAN_3_CURVE, UNRIPE_BEAN, UNRIPE_LP, WETH, BEANSTALK, BEAN_ETH_WELL } = require('./utils/constants')
const { ConvertEncoder } = require('./utils/encoder.js')
const { to6, to18, toBean, toStalk } = require('./utils/helpers.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { setEthUsdcPrice, setEthUsdPrice, setEthUsdtPrice, setOracleFailure, printPrices } = require('../utils/oracle.js');
const { deployBasin } = require('../scripts/basin.js');
const { toBN } = require('../utils/helpers.js');
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
    this.convertGet = await ethers.getContractAt('ConvertGettersFacet', this.diamond.address);
    this.bean = await ethers.getContractAt('MockToken', BEAN);
    this.weth = await ethers.getContractAt('MockToken', WETH);

    this.well = await deployBasin(true, undefined, false, true)
    this.wellToken = await ethers.getContractAt("IERC20", this.well.address)
    await this.wellToken.connect(owner).approve(BEANSTALK, ethers.constants.MaxUint256)
    await this.bean.connect(owner).approve(BEANSTALK, ethers.constants.MaxUint256)

    await setEthUsdPrice('999.998018')
    await setEthUsdcPrice('1000')

    await this.season.siloSunrise(0);
    await this.bean.mint(userAddress, toBean('10000000000'));
    await this.bean.mint(user2Address, toBean('10000000000'));
    await this.weth.mint(userAddress, to18('1000000000'));
    await this.weth.mint(user2Address, to18('1000000000'));
  
    await this.bean.connect(user).approve(this.well.address, ethers.constants.MaxUint256);
    await this.bean.connect(user2).approve(this.well.address, ethers.constants.MaxUint256);
    await this.bean.connect(owner).approve(this.well.address, ethers.constants.MaxUint256);
    await this.weth.connect(user).approve(this.well.address, ethers.constants.MaxUint256);
    await this.weth.connect(user2).approve(this.well.address, ethers.constants.MaxUint256);
    await this.weth.connect(owner).approve(this.well.address, ethers.constants.MaxUint256);
    await this.bean.connect(user).approve(this.silo.address, ethers.constants.MaxUint256);
    await this.bean.connect(user2).approve(this.silo.address, ethers.constants.MaxUint256);
    await this.wellToken.connect(user).approve(this.silo.address, ethers.constants.MaxUint256);
    await this.wellToken.connect(user2).approve(this.silo.address, ethers.constants.MaxUint256);
  
    await this.well.connect(user).addLiquidity(
      [toBean('1000000'), to18('1000')],
      0,
      owner.address,
      ethers.constants.MaxUint256
    );

    this.unripe = await ethers.getContractAt('MockUnripeFacet', this.diamond.address)
    this.unripeBean = await ethers.getContractAt('MockToken', UNRIPE_BEAN)
    this.unripeLP = await ethers.getContractAt('MockToken', UNRIPE_LP)
    this.fertilizer = await ethers.getContractAt('MockFertilizerFacet', this.diamond.address)
    await this.unripeBean.mint(userAddress, to6('10000'))
    await this.unripeLP.mint(userAddress, to6('3162.277660'))
    await this.unripeBean.connect(user).approve(this.diamond.address, to18('100000000'))
    await this.unripeLP.connect(user).approve(this.diamond.address, to18('100000000'))
    await this.fertilizer.setFertilizerE(true, to6('10000'))
    await this.unripe.addUnripeToken(UNRIPE_BEAN, BEAN, ZERO_BYTES)
    await this.unripe.addUnripeToken(UNRIPE_LP, BEAN_ETH_WELL, ZERO_BYTES)
    await this.bean.mint(ownerAddress, to6('5000'))
    await this.fertilizer.setPenaltyParams(to6('500'), '0')
    await this.unripe.connect(owner).addUnderlying(
      UNRIPE_BEAN,
      to6('1000')
    )
    await this.unripe.connect(owner).addUnderlying(
      UNRIPE_LP,
      to18('3162.277660') // 3162.2776601683793319
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
      await this.well.connect(user).addLiquidity(
        [toBean('0'), to18('0.2')],
        '0',
        user.address, 
       ethers.constants.MaxUint256
      );
      expect(await this.convertGet.getMaxAmountIn(UNRIPE_BEAN, UNRIPE_LP)).to.be.equal(to6('2000'));
    });

    it('p = 1', async function () {
      expect(await this.convertGet.getMaxAmountIn(UNRIPE_BEAN, UNRIPE_LP)).to.be.equal('0');
    });

    it('p < 1', async function () {
      await this.well.connect(user).addLiquidity(
        [toBean('2000'), to18('0')],
        '0',
        user.address, 
       ethers.constants.MaxUint256
      );
      expect(await this.convertGet.getMaxAmountIn(UNRIPE_BEAN, UNRIPE_LP)).to.be.equal('0');
    });
  });

  describe('calclates lp to peg', async function () {
    it('p > 1', async function () {
      await this.well.connect(user).addLiquidity(
        [toBean('0'), to18('0.2')],
        '0',
        user.address, 
       ethers.constants.MaxUint256
      );
      expect(await this.convertGet.getMaxAmountIn(UNRIPE_LP, UNRIPE_BEAN)).to.be.equal('0');
    });

    it('p = 1', async function () {
      expect(await this.convertGet.getMaxAmountIn(UNRIPE_LP, UNRIPE_BEAN)).to.be.equal('0');
    });

    it('p < 1', async function () {
      await this.well.connect(user).addLiquidity(
        [toBean('2000'), to18('0')],
        '0',
        user.address, 
       ethers.constants.MaxUint256
      );
      expect(await this.convertGet.getMaxAmountIn(UNRIPE_LP, UNRIPE_BEAN)).to.be.equal(to6('31.606981'));
    });
  })

  describe('convert beans to lp', async function () {

    describe('revert', async function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(10);
        this.season.deployStemsUpgrade();
      });
      it('not enough LP', async function () {
        await this.silo.connect(user).deposit(this.unripeBean.address, to6('200'), EXTERNAL);
        await this.well.connect(user).addLiquidity([toBean('0'), to18('0.02')], '0', user.address, ethers.constants.MaxUint256);
        const amountOut = await this.well.getAddLiquidityOut([to6('200'), '0'])
        await expect(this.convert.connect(user).convert(ConvertEncoder.convertUnripeBeansToLP(to6('200'), amountOut.add(toBN('1'))), ['0'], [to6('200')]))
          .to.be.revertedWith('')
      });

      it('p >= 1', async function () {
        await this.silo.connect(user).deposit(this.unripeBean.address, to6('200'), EXTERNAL);
        await expect(this.convert.connect(user).convert(ConvertEncoder.convertUnripeBeansToLP(to6('200'), '0'), ['0'], ['1000']))
          .to.be.revertedWith('Convert: P must be >= 1.');
      });
    });

    describe('basic', function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(10);
        this.season.deployStemsUpgrade();
      });
      beforeEach(async function () {
        await this.silo.connect(user).deposit(
          this.unripeBean.address, to6('2000'), EXTERNAL
        );
        await this.well.connect(user).addLiquidity(
          [toBean('0'), to18('0.2')],
          '0',
          user.address,
          ethers.constants.MaxUint256
        );
        this.result = await this.convert.connect(user).convert(
          ConvertEncoder.convertUnripeBeansToLP(to6('1000'), '0'), ['0'], [to6('2000')]
        )
      });

      it('properly updates total values', async function () {
        expect(await this.silo.getTotalDeposited(this.unripeBean.address)).to.eq(to6('1000'));
        expect(await this.silo.getTotalDepositedBdv(this.unripeBean.address)).to.eq(to6('100'));
        expect(await this.silo.getTotalDeposited(this.unripeLP.address)).to.eq('4711829');
        const bdv = await this.silo.bdv(this.unripeLP.address, '4711829')
        expect(await this.silo.getTotalDepositedBdv(this.unripeLP.address)).to.eq(bdv);
        expect(await this.silo.totalStalk()).to.eq(toStalk('100').add(bdv.mul(to6('0.01'))));
      });

      it('properly updates user values -test', async function () {
        const bdv = await this.silo.bdv(this.unripeLP.address, '4711829')
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('100').add(bdv.mul(to6('0.01'))));
      });

      it('properly updates user deposits', async function () {
        expect((await this.silo.getDeposit(userAddress, this.unripeBean.address, 0))[0]).to.eq(to6('1000'));
        const deposit = await this.silo.getDeposit(userAddress, this.unripeLP.address, 0);
        expect(deposit[0]).to.eq('4711829');
        expect(deposit[1]).to.eq(await this.silo.bdv(this.unripeLP.address, '4711829'));
      });

      it('emits events', async function () {
        await expect(this.result).to.emit(this.silo, 'RemoveDeposits')
          .withArgs(userAddress, this.unripeBean.address, [0], [to6('1000')], to6('1000'), [to6('100')]);
        await expect(this.result).to.emit(this.silo, 'AddDeposit')
          .withArgs(userAddress, this.unripeLP.address, 0, '4711829', await this.silo.bdv(this.unripeLP.address, '4711829'));
      });
    });

//     describe('multiple crates', async function () {
//       beforeEach(async function () {
//         await this.season.teleportSunrise(10);
//         this.season.deployStemsUpgrade();
//         await this.silo.connect(user).deposit(this.unripeBean.address, to6('1000'), EXTERNAL);
//         await this.season.siloSunrise(0);
//         await this.season.siloSunrise(0);
//         await this.season.siloSunrise(0);
//         await this.season.siloSunrise(0); //season 14

//         await this.silo.connect(user).deposit(this.unripeBean.address, to6('1000'), EXTERNAL);


//         const stemUnripeBean = await this.silo.seasonToStem(this.unripeBean.address, '14');
//         await this.well.connect(user).addLiquidity(
//           [toBean('0'), to18('0.2')],
//           '0',
//           user.address,
//           ethers.constants.MaxUint256
//         );
//         this.result = await this.convert.connect(user).convert(ConvertEncoder.convertUnripeBeansToLP(to6('2500'), '0'), [0, stemUnripeBean], [to6('1000'), to6('1000')])
//       });

//       it('properly updates total values', async function () {
//         expect(await this.silo.getTotalDeposited(this.unripeBean.address)).to.eq(to18('0'));
//         expect(await this.silo.getTotalDepositedBdv(this.unripeBean.address)).to.eq(to18('0'));
//         expect(await this.silo.getTotalDeposited(this.unripeLP.address)).to.eq('2008324306');
//         expect(await this.silo.getTotalDepositedBdv(this.unripeLP.address)).to.eq(to6('200'));
//         expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('200.08'));
//       });

//       it('properly updates user values', async function () {
//         expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('200.08'));
//       });

//       it('properly updates user deposits', async function () {
//         const stemUnripeBean = await this.silo.seasonToStem(this.unripeBean.address, '14');

//         expect((await this.silo.getDeposit(userAddress, this.unripeBean.address, 0))[0]).to.eq(toBean('0'));
//         expect((await this.silo.getDeposit(userAddress, this.unripeBean.address, stemUnripeBean))[0]).to.eq(toBean('0'));
//         const deposit = await this.silo.getDeposit(userAddress, this.unripeLP.address, 4);
//         expect(deposit[0]).to.eq('2008324306');
//         expect(deposit[1]).to.eq(toBean('200'));
//       });

//       it('emits events', async function () {
//         const stemUnripeBean = await this.silo.seasonToStem(this.unripeBean.address, '14');
//         await expect(this.result).to.emit(this.silo, 'RemoveDeposits')
//           .withArgs(userAddress, this.unripeBean.address, [0, stemUnripeBean], [to6('1000'), to6('1000')], to6('2000'), [to6('100'), to6('100')]);
//         await expect(this.result).to.emit(this.silo, 'AddDeposit')
//           .withArgs(userAddress, this.unripeLP.address, 4, '2008324306', toBean('200'));
//       });
//     });
//     //TODOSEEDS maybe write some tests that are not right on the zero index of grown stalk per bdv?
//     describe("bean more vested", async function () {
//       beforeEach(async function () {
//         await this.season.teleportSunrise(10);
//         this.season.deployStemsUpgrade();
//         await this.unripe.connect(owner).addUnderlying(
//           UNRIPE_BEAN,
//           to6('1000')
//         )
//         await this.silo.connect(user).deposit(this.unripeBean.address, to6('2000'), EXTERNAL);
//         await this.well.connect(user).addLiquidity(
//           [toBean('0'), to18('0.2')],
//           '0',
//           user.address,
//           ethers.constants.MaxUint256
//         );
//         this.result = await this.convert.connect(user).convert(ConvertEncoder.convertUnripeBeansToLP(to6('500'), '0'), ['0'], [to6('500')])
//       })

//       it('properly updates total values', async function () {
//         expect(await this.silo.getTotalDeposited(this.unripeBean.address)).to.eq(to6('1500'));
//         expect(await this.silo.getTotalDepositedBdv(this.unripeBean.address)).to.eq(to6('300'));
//         expect(await this.silo.getTotalDeposited(this.unripeLP.address)).to.eq('503172383');
//         expect(await this.silo.getTotalDepositedBdv(this.unripeLP.address)).to.eq(to6('100'));
//         //expect(await this.silo.totalSeeds()).to.eq(toBean('1000'));
//         expect(await this.silo.totalStalk()).to.eq(toStalk('400'));
//       });

//       it('properly updates user values', async function () {
//         //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(toBean('1000'));
//         expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('400'));
//       });

//       it('properly updates user deposits', async function () {
//         expect((await this.silo.getDeposit(userAddress, this.unripeBean.address, 0))[0]).to.eq(to6('1500'));
//         const deposit = await this.silo.getDeposit(userAddress, this.unripeLP.address, 0);
//         expect(deposit[0]).to.eq('503172383');
//         expect(deposit[1]).to.eq(toBean('100'));
//       });

//       it('emits events', async function () {
//         await expect(this.result).to.emit(this.silo, 'RemoveDeposits')
//           .withArgs(userAddress, this.unripeBean.address, [0], [to6('500')], to6('500'), [to6('100')]);
//         await expect(this.result).to.emit(this.silo, 'AddDeposit')
//           .withArgs(userAddress, this.unripeLP.address, 0, '503172383', toBean('100'));
//       });
//     })

//     describe("lp more vested", async function () {
//       beforeEach(async function () {
//         await this.season.teleportSunrise(10);
//         this.season.deployStemsUpgrade();
//         await this.unripe.connect(user).addUnderlyingWithRecap(
//           UNRIPE_LP,
//           to18('942.2960000')
//         )
//         await this.silo.connect(user).deposit(this.unripeBean.address, to6('2000'), EXTERNAL);
//         await this.well.connect(user).addLiquidity(
//           [toBean('0'), to18('0.2')],
//           '0',
//           user.address,
//           ethers.constants.MaxUint256
//         );
//         this.result = await this.convert.connect(user).convert(ConvertEncoder.convertUnripeBeansToLP(to6('500'), '0'), ['0'], [to6('500')])
//       })

//       it('properly updates total values', async function () {
//         expect(await this.silo.getTotalDeposited(this.unripeBean.address)).to.eq(to6('1500'));
//         expect(await this.silo.getTotalDepositedBdv(this.unripeBean.address)).to.eq(to6('150'));
//         expect(await this.silo.getTotalDeposited(this.unripeLP.address)).to.eq('503761210');
//         expect(await this.silo.getTotalDepositedBdv(this.unripeLP.address)).to.eq('97342214');
//         expect(await this.silo.totalStalk()).to.eq('2473422140000');
//       });

//       it('properly updates user values', async function () {
//         expect(await this.silo.balanceOfStalk(userAddress)).to.eq('2473422140000');
//       });

//       it('properly updates user deposits', async function () {
//         expect((await this.silo.getDeposit(userAddress, this.unripeBean.address, 0))[0]).to.eq(to6('1500'));
//         const deposit = await this.silo.getDeposit(userAddress, this.unripeLP.address, 0);
//         expect(deposit[0]).to.eq('503761210');
//         expect(deposit[1]).to.eq('97342214');
//       });

//       it('emits events', async function () {
//         await expect(this.result).to.emit(this.silo, 'RemoveDeposits')
//           .withArgs(userAddress, this.unripeBean.address, [0], [to6('500')], to6('500'), [to6('50')]);
//         await expect(this.result).to.emit(this.silo, 'AddDeposit')
//           .withArgs(userAddress, this.unripeLP.address, 0, '503761210', '97342214');
//       });
//     })
  });

  describe('convert lp to beans', async function () {
    beforeEach(async function () {
      await this.season.teleportSunrise(10);
      this.season.deployStemsUpgrade();
    });

    describe('revert', async function () {
      it('not enough Beans', async function () {
        await this.well.connect(user).addLiquidity(
          [toBean('200'), '0'],
          '0',
          user.address,
          ethers.constants.MaxUint256
        );
        await this.silo.connect(user).deposit(this.unripeLP.address, to6('1000'), EXTERNAL);
        await expect(this.convert.connect(user).convert(ConvertEncoder.convertUnripeLPToBeans(to6('2000'), to6('2500')), ['0'], [to6('2000')]))
          .to.be.revertedWith('');
      });

      it('p >= 1', async function () {
        await this.well.connect(user).addLiquidity([toBean('0'), to18('1')], to18('0.5'), user.address, ethers.constants.MaxUint256);
        await this.silo.connect(user).deposit(this.unripeLP.address, to6('1000'), EXTERNAL);
        await expect(this.convert.connect(user).convert(ConvertEncoder.convertUnripeLPToBeans(to6('2000'), to6('2500')), ['0'], [to6('2000')]))
          .to.be.revertedWith('Convert: P must be < 1.');
      });
    });

    describe('below max', function () {
      beforeEach(async function () {
        await this.well.connect(user).addLiquidity(
          [toBean('200'), '0'],
          '0',
          user.address,
          ethers.constants.MaxUint256
        );
        await this.silo.connect(user).deposit(this.unripeLP.address, to6('3'), EXTERNAL);
        this.bdv = await this.silo.getTotalDepositedBdv(this.unripeLP.address);
        this.result = await this.convert.connect(user).convert(ConvertEncoder.convertUnripeLPToBeans(to6('3'), toBN('0')), ['0'], [to6('1000')])
      });

      it('properly updates total values', async function () {
        const bdv = await this.silo.bdv(this.unripeBean.address, '636776401')
        expect(await this.silo.getTotalDeposited(this.unripeBean.address)).to.eq('636776401');
        expect(await this.silo.getTotalDepositedBdv(this.unripeBean.address)).to.eq(this.bdv);
        expect(await this.silo.getTotalDeposited(this.unripeLP.address)).to.eq(to6('0'));
        expect(await this.silo.getTotalDepositedBdv(this.unripeLP.address)).to.eq(to6('0'));
        //expect(await this.silo.totalSeeds()).to.eq(to6('201.236334'));
        expect(await this.silo.totalStalk()).to.eq(this.bdv.mul('10000'));
      });

      it('properly updates user values', async function () {
        //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(to6('201.236334'));
        expect(await this.silo.totalStalk()).to.eq(this.bdv.mul('10000'));
      });
    });

//     //these tests use the new 2 seeds per bdv instead of previous 4 (note in the beforeEach above that deployStemsUpgrade is called)
//     describe('multiple crates', function () {
//       beforeEach(async function () {
//         await this.well.connect(user).addLiquidity(
//           [toBean('200'), '0'],
//           '0',
//           user.address,
//           ethers.constants.MaxUint256
//         );
//         await this.silo.connect(user).deposit(this.unripeLP.address, to6('500'), EXTERNAL);

//         await this.season.siloSunrise(0);
//         await this.season.siloSunrise(0);
//         await this.silo.connect(user).deposit(this.unripeLP.address, to6('500'), EXTERNAL);

//         this.result = await this.convert.connect(user).convert(ConvertEncoder.convertUnripeLPToBeans(to6('1000'), to6('990'), this.unripeLP.address), ['0', '4'], [to6('500'), to6('500')])
//       });

//       it('properly updates total values', async function () {
//         expect(await this.silo.getTotalDeposited(this.unripeBean.address)).to.eq(to6('1006.18167'));
//         expect(await this.silo.getTotalDepositedBdv(this.unripeBean.address)).to.eq(to6('100.618167'));
//         expect(await this.silo.getTotalDeposited(this.unripeLP.address)).to.eq(to6('0'));
//         expect(await this.silo.getTotalDepositedBdv(this.unripeLP.address)).to.eq(to6('0'));
//         expect(await this.silo.totalStalk()).to.eq(toStalk('100.6282288167'));
//         //same as normal curve convert tests, old value was 100.6382906334 but now with rounding it's a bit different
//       });

//       it('properly updates user values', async function () {
//         expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('100.6282288167'));
//       });

//       it('properly updates user deposits', async function () {
//         expect((await this.silo.getDeposit(userAddress, this.unripeBean.address, 3))[0]).to.eq(to6('1006.18167'));
//         const deposit = await this.silo.getDeposit(userAddress, this.unripeLP.address, 2);
//         expect(deposit[0]).to.eq(to6('0'));
//         expect(deposit[1]).to.eq(toBean('0'));
//       });

//       it('emits events', async function () {
//         await expect(this.result).to.emit(this.silo, 'RemoveDeposits')
//           .withArgs(userAddress, this.unripeLP.address, [0, 4], [to6('500'), to6('500')], to6('1000'), [to6('50'), to6('50')]);
//         await expect(this.result).to.emit(this.silo, 'AddDeposit')
//           .withArgs(userAddress, this.unripeBean.address, 3, to6('1006.18167'), to6('100.618167'));
//       });
//     });

//     describe('bean over vested', function () {
//       beforeEach(async function () {
//         await this.unripe.connect(owner).addUnderlying(
//           UNRIPE_BEAN,
//           to6('1000')
//         )
//         await this.well.connect(user).addLiquidity(
//           [toBean('200'), '0'],
//           '0',
//           user.address,
//           ethers.constants.MaxUint256
//         );
//         await this.silo.connect(user).deposit(this.unripeLP.address, to6('1000'), EXTERNAL);
//         this.result = await this.convert.connect(user).convert(ConvertEncoder.convertUnripeLPToBeans(to6('1000'), to6('1000')), ['0'], [to6('1000')])
//       });

//       it('properly updates total values', async function () {
//         expect(await this.silo.getTotalDeposited(this.unripeBean.address)).to.eq(to6('1006.18167'));
//         expect(await this.silo.getTotalDepositedBdv(this.unripeBean.address)).to.eq(to6('192.037852'));
//         expect(await this.silo.getTotalDeposited(this.unripeLP.address)).to.eq(to6('0'));
//         expect(await this.silo.getTotalDepositedBdv(this.unripeLP.address)).to.eq(to6('0'));
//         //expect(await this.silo.totalSeeds()).to.eq(to6('384.075704'));
//         expect(await this.silo.totalStalk()).to.eq(toStalk('192.037852'));
//       });

//       it('properly updates user values', async function () {
//         //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(to6('384.075704'));
//         expect(await this.silo.totalStalk()).to.eq(toStalk('192.037852'));
//       });
//     });

//     describe('bean under vested', function () {
//       beforeEach(async function () {
//         await this.unripe.connect(user).addUnderlyingWithRecap(
//           UNRIPE_LP,
//           to18('942.2960000')
//         )
//         await this.well.connect(user).addLiquidity(
//           [toBean('200'), '0'],
//           '0',
//           user.address,
//           ethers.constants.MaxUint256
//         );
//         await this.silo.connect(user).deposit(this.unripeLP.address, to6('1000'), EXTERNAL);
//         this.result = await this.convert.connect(user).convert(ConvertEncoder.convertUnripeLPToBeans(to6('500'), to6('500')), ['0'], [to6('1000')])
//       });

//       it('properly updates total values', async function () {
//         expect(await this.silo.getTotalDeposited(this.unripeBean.address)).to.eq(to6('503.090835'));
//         expect(await this.silo.getTotalDepositedBdv(this.unripeBean.address)).to.eq(to6('100'));
//         expect(await this.silo.getTotalDeposited(this.unripeLP.address)).to.eq(to6('500'));
//         expect(await this.silo.getTotalDepositedBdv(this.unripeLP.address)).to.eq(to6('100'));
//         //expect(await this.silo.totalSeeds()).to.eq(to6('600'));
//         expect(await this.silo.totalStalk()).to.eq(toStalk('200'));
//       });

//       it('properly updates user values', async function () {
//         //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(to6('600'));
//         expect(await this.silo.totalStalk()).to.eq(toStalk('200'));
//       });
//     });
  });
});
