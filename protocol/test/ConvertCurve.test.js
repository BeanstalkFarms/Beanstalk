const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { BEAN, THREE_CURVE, THREE_POOL, BEAN_3_CURVE } = require('./utils/constants')
const { ConvertEncoder } = require('./utils/encoder.js')
const { to18, toBean, toStalk, to6 } = require('./utils/helpers.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
let user, user2, owner;
let userAddress, ownerAddress, user2Address;

describe('Curve Convert', function () {
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

    await this.beanMetapool.set_A_precise('1000');
    await this.beanMetapool.set_virtual_price(ethers.utils.parseEther('1'));
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
      expect(await this.convert.getMaxAmountIn(this.bean.address, this.beanMetapool.address)).to.be.equal(ethers.utils.parseUnits('200', 6));
    });

    it('p = 1', async function () {
      expect(await this.convert.getMaxAmountIn(this.bean.address, this.beanMetapool.address)).to.be.equal('0');
    });

    it('p < 1', async function () {
      await this.beanMetapool.connect(user).add_liquidity([toBean('200'), to18('0')], to18('150'));
      expect(await this.convert.getMaxAmountIn(this.bean.address, this.beanMetapool.address)).to.be.equal('0');
    });
  });

  describe('calclates lp to peg', async function () {
    it('p > 1', async function () {
      await this.beanMetapool.connect(user2).add_liquidity([toBean('200'), to18('0')], to18('150'));
      expect(await this.convert.getMaxAmountIn(this.beanMetapool.address, this.bean.address)).to.be.equal('199185758314813528598');
    });

    it('p = 1', async function () {
      expect(await this.convert.getMaxAmountIn(this.beanMetapool.address, this.bean.address)).to.be.equal('0');
    });

    it('p < 1', async function () {
      await this.beanMetapool.connect(user).add_liquidity([toBean('0'), to18('200')], to18('150'));
      expect(await this.convert.getMaxAmountIn(this.beanMetapool.address, this.bean.address)).to.be.equal('0');
    });
  })

  describe('convert beans to lp', async function () {

    describe('revert', async function () {
      it('not enough LP', async function () {
        await this.silo.connect(user).deposit(this.bean.address, toBean('200'), EXTERNAL);
        await this.beanMetapool.connect(user).add_liquidity([toBean('0'), to18('200')], to18('150'));
        await expect(this.convert.connect(user).convert(ConvertEncoder.convertBeansToCurveLP(toBean('200'), to18('201'), this.beanMetapool.address), ['2'], [toBean('200')]))
          .to.be.revertedWith('Curve: Not enough LP');
      });

      it('p >= 1', async function () {
        await this.silo.connect(user).deposit(this.bean.address, '1000', EXTERNAL);
        await expect(this.convert.connect(user).convert(ConvertEncoder.convertBeansToCurveLP(toBean('200'), to18('190'), this.beanMetapool.address), ['1'], ['1000']))
          .to.be.revertedWith('Convert: P must be >= 1.');
      });

    });

    describe('below max', async function () {
      beforeEach(async function () {
        await this.silo.connect(user).deposit(this.bean.address, toBean('200'), EXTERNAL);
        await this.beanMetapool.connect(user).add_liquidity([toBean('0'), to18('200')], to18('150'));
      });

      it('it gets amount out', async function () {
        expect(await this.convert.getAmountOut(
          BEAN,
          BEAN_3_CURVE,
          toBean('100')
        )).to.be.equal('100634476734756985505')
      })

      it('returns correct values', async function () {
        this.result = await this.convert.connect(user).callStatic.convert(ConvertEncoder.convertBeansToCurveLP(toBean('100'), to18('99'), this.beanMetapool.address), ['2'], [toBean('100')])
        expect(this.result.toSeason).to.be.equal(2)
        expect(this.result.fromAmount).to.be.equal(to6('100'))
        expect(this.result.toAmount).to.be.equal('100634476734756985505')
        expect(this.result.fromBdv).to.be.equal(to6('100'))
        expect(this.result.toBdv).to.be.equal(to6('100'))

      })

      describe('it converts', async function () {
        beforeEach(async function () {
          this.result = await this.convert.connect(user).convert(ConvertEncoder.convertBeansToCurveLP(toBean('100'), to18('99'), this.beanMetapool.address), ['2'], [toBean('100')])
        })

        it('properly updates total values', async function () {
          expect(await this.silo.getTotalDeposited(this.bean.address)).to.eq(toBean('100'));
          expect(await this.silo.getTotalDeposited(this.beanMetapool.address)).to.eq('100634476734756985505');
          expect(await this.silo.totalSeeds()).to.eq(toBean('600'));
          expect(await this.silo.totalStalk()).to.eq(toStalk('200'));
        });

        it('properly updates user values', async function () {
          // expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(toBean('600'));
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('200'));
        });

        it('properly updates user deposits', async function () {
          expect((await this.silo.getDeposit(userAddress, this.bean.address, 2))[0]).to.eq(toBean('100'));
          const deposit = await this.silo.getDeposit(userAddress, this.beanMetapool.address, 2);
          expect(deposit[0]).to.eq('100634476734756985505');
          expect(deposit[1]).to.eq(toBean('100'));
        });

        it('emits events', async function () {
          await expect(this.result).to.emit(this.silo, 'RemoveDeposits')
            .withArgs(userAddress, this.bean.address, [2], [toBean('100')], toBean('100'));
          await expect(this.result).to.emit(this.silo, 'AddDeposit')
            .withArgs(userAddress, this.beanMetapool.address, 2, '100634476734756985505', toBean('100'));
        });
      })
    });

    describe('above max', function () {
      beforeEach(async function () {
        await this.silo.connect(user).deposit(this.bean.address, toBean('300'), EXTERNAL);
        await this.beanMetapool.connect(user).add_liquidity([toBean('0'), to18('200')], to18('150'));
      });

      it('it gets amount out', async function () {
        expect(await this.convert.getAmountOut(
          BEAN,
          BEAN_3_CURVE,
          toBean('200')
        )).to.be.equal('200832430692705624354')
      })

      describe('it converts', async function () {
        beforeEach(async function () {
          this.result = await this.convert.connect(user).convert(ConvertEncoder.convertBeansToCurveLP(toBean('250'), to18('190'), this.beanMetapool.address), ['2'], [toBean('250')])
        });

        it('properly updates total values', async function () {
          expect(await this.silo.getTotalDeposited(this.bean.address)).to.eq(toBean('100'));
          expect(await this.silo.getTotalDeposited(this.beanMetapool.address)).to.eq('200832430692705624354');
          expect(await this.silo.totalSeeds()).to.eq(toBean('1000'));
          expect(await this.silo.totalStalk()).to.eq(toStalk('300'));
        });

        it('properly updates user values', async function () {
          // expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(toBean('1000'));
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('300'));
        });

        it('properly updates user deposits', async function () {
          expect((await this.silo.getDeposit(userAddress, this.bean.address, 2))[0]).to.eq(toBean('100'));
          const deposit = await this.silo.getDeposit(userAddress, this.beanMetapool.address, 2);
          expect(deposit[0]).to.eq('200832430692705624354');
          expect(deposit[1]).to.eq(toBean('200'));
        });

        it('emits events', async function () {
          await expect(this.result).to.emit(this.silo, 'RemoveDeposits')
            .withArgs(userAddress, this.bean.address, [2], [toBean('200')], toBean('200'));
          await expect(this.result).to.emit(this.silo, 'AddDeposit')
            .withArgs(userAddress, this.beanMetapool.address, 2, '200832430692705624354', toBean('200'));
        });
      });
    });

    describe('after one season', function () {
      beforeEach(async function () {
        await this.silo.connect(user).deposit(this.bean.address, toBean('200'), EXTERNAL);
        await this.season.siloSunrise(0);
        await this.beanMetapool.connect(user).add_liquidity([toBean('0'), to18('200')], to18('150'));
      });

      describe('it converts', async function () {
        beforeEach(async function () {
          this.result = await this.convert.connect(user).convert(ConvertEncoder.convertBeansToCurveLP(toBean('250'), to18('190'), this.beanMetapool.address), ['2'], [toBean('250')])
        });

        it('properly updates total values', async function () {
          expect(await this.silo.getTotalDeposited(this.bean.address)).to.eq(toBean('0'));
          expect(await this.silo.getTotalDeposited(this.beanMetapool.address)).to.eq('200832430692705624354');
          expect(await this.silo.totalSeeds()).to.eq(toBean('800'));
          expect(await this.silo.totalStalk()).to.eq(toStalk('200'));
        });

        it('properly updates user values', async function () {
          // expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(toBean('800'));
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('200'));
        });

        it('properly updates user deposits', async function () {
          expect((await this.silo.getDeposit(userAddress, this.bean.address, 2))[0]).to.eq(toBean('0'));
          const deposit = await this.silo.getDeposit(userAddress, this.beanMetapool.address, 3);
          expect(deposit[0]).to.eq('200832430692705624354');
          expect(deposit[1]).to.eq(toBean('200'));
        });

        it('emits events', async function () {
          await expect(this.result).to.emit(this.silo, 'RemoveDeposits')
            .withArgs(userAddress, this.bean.address, [2], [toBean('200')], toBean('200'));
          await expect(this.result).to.emit(this.silo, 'AddDeposit')
            .withArgs(userAddress, this.beanMetapool.address, 3, '200832430692705624354', toBean('200'));
        });
      })
    });

    describe('after multiple season', function () {
      beforeEach(async function () {
        await this.silo.connect(user).deposit(this.bean.address, toBean('200'), EXTERNAL);
        await this.season.siloSunrise(0);
        await this.season.siloSunrise(0);
        await this.beanMetapool.connect(user).add_liquidity([toBean('0'), to18('200')], to18('150'));
      });

      describe('it converts', async function () {
        beforeEach(async function () {
          this.result = await this.convert.connect(user).convert(ConvertEncoder.convertBeansToCurveLP(toBean('250'), to18('190'), this.beanMetapool.address), ['2'], [toBean('250')])
        });

        it('properly updates total values', async function () {
          expect(await this.silo.getTotalDeposited(this.bean.address)).to.eq(toBean('0'));
          expect(await this.silo.getTotalDeposited(this.beanMetapool.address)).to.eq('200832430692705624354');
          expect(await this.silo.totalSeeds()).to.eq(toBean('800'));
          expect(await this.silo.totalStalk()).to.eq(toStalk('200.08'));
        });

        it('properly updates user values', async function () {
          // expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(toBean('800'));
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('200.08'));
        });

        it('properly updates user deposits', async function () {
          expect((await this.silo.getDeposit(userAddress, this.bean.address, 2))[0]).to.eq(toBean('0'));
          const deposit = await this.silo.getDeposit(userAddress, this.beanMetapool.address, 3);
          expect(deposit[0]).to.eq('200832430692705624354');
          expect(deposit[1]).to.eq(toBean('200'));
        });

        it('emits events', async function () {
          await expect(this.result).to.emit(this.silo, 'RemoveDeposits')
            .withArgs(userAddress, this.bean.address, [2], [toBean('200')], toBean('200'));
          await expect(this.result).to.emit(this.silo, 'AddDeposit')
            .withArgs(userAddress, this.beanMetapool.address, 3, '200832430692705624354', toBean('200'));
        });
      });
    })

    describe('multiple crates', function () {
      beforeEach(async function () {
        await this.silo.connect(user).deposit(this.bean.address, toBean('100'), EXTERNAL);
        await this.season.siloSunrise(0);
        await this.season.siloSunrise(0);
        await this.season.siloSunrise(0);
        await this.season.siloSunrise(0);
        await this.silo.connect(user).deposit(this.bean.address, toBean('100'), EXTERNAL);
        await this.beanMetapool.connect(user).add_liquidity([toBean('0'), to18('200')], to18('150'));
      });

      describe('it converts', async function () {
        beforeEach(async function () {
          this.result = await this.convert.connect(user).convert(ConvertEncoder.convertBeansToCurveLP(toBean('250'), to18('190'), this.beanMetapool.address), ['2', '6'], [toBean('100'), toBean('100')])
        });

        it('properly updates total values', async function () {
          expect(await this.silo.getTotalDeposited(this.bean.address)).to.eq(toBean('0'));
          expect(await this.silo.getTotalDeposited(this.beanMetapool.address)).to.eq('200832430692705624354');
          expect(await this.silo.totalSeeds()).to.eq(toBean('800'));
          expect(await this.silo.totalStalk()).to.eq(toStalk('200.08'));
        });

        it('properly updates user values', async function () {
          // expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(toBean('800'));
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('200.08'));
        });

        it('properly updates user deposits', async function () {
          expect((await this.silo.getDeposit(userAddress, this.bean.address, 2))[0]).to.eq(toBean('0'));
          expect((await this.silo.getDeposit(userAddress, this.bean.address, 6))[0]).to.eq(toBean('0'));
          const deposit = await this.silo.getDeposit(userAddress, this.beanMetapool.address, 5);
          expect(deposit[0]).to.eq('200832430692705624354');
          expect(deposit[1]).to.eq(toBean('200'));
        });

        it('emits events', async function () {
          await expect(this.result).to.emit(this.silo, 'RemoveDeposits')
            .withArgs(userAddress, this.bean.address, [2, 6], [toBean('100'), toBean('100')], toBean('200'));
          await expect(this.result).to.emit(this.silo, 'AddDeposit')
            .withArgs(userAddress, this.beanMetapool.address, 5, '200832430692705624354', toBean('200'));
        });
      })
    });
  });

  describe('convert lp to beans', async function () {

    describe('revert', async function () {
      it('not enough Beans', async function () {
        await this.beanMetapool.connect(user).add_liquidity([toBean('200'), to18('0')], to18('150'));
        await this.silo.connect(user).deposit(this.beanMetapool.address, to18('1000'), EXTERNAL);

        await expect(this.convert.connect(user).convert(ConvertEncoder.convertCurveLPToBeans(to18('200'), toBean('250'), this.beanMetapool.address), ['2'], [to18('200')]))
          .to.be.revertedWith('Curve: Insufficient Output');
      });

      it('p < 1', async function () {
        await this.beanMetapool.connect(user).add_liquidity([toBean('0'), to18('1')], to18('0.5'));
        await this.silo.connect(user).deposit(this.beanMetapool.address, to18('1000'), EXTERNAL);
        await expect(this.convert.connect(user).convert(ConvertEncoder.convertCurveLPToBeans(to18('200'), toBean('190'), this.beanMetapool.address), ['1'], ['1000']))
          .to.be.revertedWith('Convert: P must be < 1.');
      });
    });

    describe('below max', function () {
      beforeEach(async function () {
        await this.beanMetapool.connect(user).add_liquidity([toBean('200'), to18('0')], to18('150'));
        await this.silo.connect(user).deposit(this.beanMetapool.address, to18('1000'), EXTERNAL);
      });


      it('it gets amount out', async function () {
        expect(await this.convert.getAmountOut(
          BEAN_3_CURVE,
          BEAN,
          to18('100')
        )).to.be.equal('100618167')
      })

      describe('it converts', async function () {
        beforeEach(async function () {
          this.result = await this.convert.connect(user).convert(ConvertEncoder.convertCurveLPToBeans(to18('100'), toBean('99'), this.beanMetapool.address), ['2'], [to18('100')])
        });

        it('properly updates total values', async function () {
          expect(await this.silo.getTotalDeposited(this.bean.address)).to.eq('100618167');
          expect(await this.silo.getTotalDeposited(this.beanMetapool.address)).to.eq(to18('900'));
          expect(await this.silo.totalSeeds()).to.eq('3801236334');
          expect(await this.silo.totalStalk()).to.eq('10006181670000');
        });

        it('properly updates user values', async function () {
          // expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('3801236334');
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq('10006181670000');
        });

        it('properly updates user deposits', async function () {
          let deposit = await this.silo.getDeposit(userAddress, this.bean.address, 2);
          expect(deposit[0]).to.eq(toBean('100.618167'));
          expect(deposit[1]).to.eq(toBean('100.618167'));
          deposit = await this.silo.getDeposit(userAddress, this.beanMetapool.address, 2);
          expect(deposit[0]).to.eq(to18('900'));
          expect(deposit[1]).to.eq(toBean('900'));
        });

        it('emits events', async function () {
          await expect(this.result).to.emit(this.silo, 'RemoveDeposits')
            .withArgs(userAddress, this.beanMetapool.address, [2], [to18('100')], to18('100'));
          await expect(this.result).to.emit(this.silo, 'AddDeposit')
            .withArgs(userAddress, this.bean.address, 2, '100618167', '100618167');
        });
      });
    });

    describe('above max', function () {
      beforeEach(async function () {
        await this.beanMetapool.connect(user).add_liquidity([toBean('200'), to18('0')], to18('150'));
        await this.silo.connect(user).deposit(this.beanMetapool.address, to18('1000'), EXTERNAL);
      });


      it('it gets amount out', async function () {
        expect(await this.convert.getAmountOut(
          BEAN_3_CURVE,
          BEAN,
          '199185758314813528598',
        )).to.be.equal('200018189')
      })

      describe('it converts', async function () {
        beforeEach(async function () {
          this.result = await this.convert.connect(user).convert(ConvertEncoder.convertCurveLPToBeans(to18('300'), toBean('150'), this.beanMetapool.address), ['2'], [to18('300')])
        });

        it('properly updates total values', async function () {
          expect(await this.silo.getTotalDeposited(this.bean.address)).to.eq('200018189');
          expect(await this.silo.getTotalDeposited(this.beanMetapool.address)).to.eq('800814241685186471402');
          expect(await this.silo.totalSeeds()).to.eq('3603293346');
          expect(await this.silo.totalStalk()).to.eq('10008324310000');
        });

        it('properly updates user values', async function () {
          // expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('3603293346');
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq('10008324310000');
        });

        it('properly updates user deposits', async function () {
          let deposit = await this.silo.getDeposit(userAddress, this.bean.address, 2);
          expect(deposit[0]).to.eq('200018189');
          expect(deposit[1]).to.eq('200018189');
          deposit = await this.silo.getDeposit(userAddress, this.beanMetapool.address, 2);
          expect(deposit[0]).to.eq('800814241685186471402');
          expect(deposit[1]).to.eq('800814242');
        });

        it('emits events', async function () {
          await expect(this.result).to.emit(this.silo, 'RemoveDeposits')
            .withArgs(userAddress, this.beanMetapool.address, [2], ['199185758314813528598'], '199185758314813528598');
          await expect(this.result).to.emit(this.silo, 'AddDeposit')
            .withArgs(userAddress, this.bean.address, 2, '200018189', '200018189');
        });
      });
    });

    describe('after 1 season', function () {
      beforeEach(async function () {
        await this.beanMetapool.connect(user).add_liquidity([toBean('200'), to18('0')], to18('150'));
        await this.silo.connect(user).deposit(this.beanMetapool.address, to18('1000'), EXTERNAL);
        await this.season.siloSunrise(0);
      });


      it('it gets amount out', async function () {

      })

      describe('it converts', async function () {
        beforeEach(async function () {
          this.result = await this.convert.connect(user).convert(ConvertEncoder.convertCurveLPToBeans(to18('100'), toBean('99'), this.beanMetapool.address), ['2'], [to18('100')])
        });

        it('properly updates total values', async function () {
          expect(await this.silo.getTotalDeposited(this.bean.address)).to.eq('100618167');
          expect(await this.silo.getTotalDeposited(this.beanMetapool.address)).to.eq(to18('900'));
          expect(await this.silo.totalSeeds()).to.eq('3801236334');
          expect(await this.silo.totalStalk()).to.eq('10009982906334');
        });

        it('properly updates user values', async function () {
          // expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('3801236334');
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq('10009982906334');
        });

        it('properly updates user deposits', async function () {
          expect((await this.silo.getDeposit(userAddress, this.bean.address, 2))[0]).to.eq('100618167');
          const deposit = await this.silo.getDeposit(userAddress, this.beanMetapool.address, 2);
          expect(deposit[0]).to.eq(to18('900'));
          expect(deposit[1]).to.eq(toBean('900'));
        });

        it('emits events', async function () {
          await expect(this.result).to.emit(this.silo, 'RemoveDeposits')
            .withArgs(userAddress, this.beanMetapool.address, [2], [to18('100')], to18('100'));
          await expect(this.result).to.emit(this.silo, 'AddDeposit')
            .withArgs(userAddress, this.bean.address, 2, '100618167', '100618167');
        });
      });
    });

    describe('multiple crates', function () {
      beforeEach(async function () {
        await this.beanMetapool.connect(user).add_liquidity([toBean('200'), to18('0')], to18('150'));
        await this.silo.connect(user).deposit(this.beanMetapool.address, to18('500'), EXTERNAL);
        await this.season.siloSunrise(0);
        await this.silo.connect(user).deposit(this.beanMetapool.address, to18('500'), EXTERNAL);
      });


      it('it gets amount out', async function () {

      })

      describe('it converts', async function () {
        beforeEach(async function () {
          this.result = await this.convert.connect(user).convert(ConvertEncoder.convertCurveLPToBeans(to18('100'), toBean('99'), this.beanMetapool.address), ['2', '3'], [to18('50'), to18('50')])
        });

        it('properly updates total values', async function () {
          expect(await this.silo.getTotalDeposited(this.bean.address)).to.eq('100618167');
          expect(await this.silo.getTotalDeposited(this.beanMetapool.address)).to.eq(to18('900'));
          expect(await this.silo.totalSeeds()).to.eq('3801236334');
          expect(await this.silo.totalStalk()).to.eq('10007981670000');
        });

        it('properly updates user values', async function () {
          // expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('3801236334');
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq('10007981670000');
        });

        it('properly updates user deposits', async function () {
          expect((await this.silo.getDeposit(userAddress, this.bean.address, 3))[0]).to.eq('100618167');
          const deposit = await this.silo.getDeposit(userAddress, this.beanMetapool.address, 2);
          expect(deposit[0]).to.eq(to18('450'));
          expect(deposit[1]).to.eq(toBean('450'));
        });

        it('emits events', async function () {
          await expect(this.result).to.emit(this.silo, 'RemoveDeposits')
            .withArgs(userAddress, this.beanMetapool.address, [2, 3], [to18('50'), to18('50')], to18('100'));
          await expect(this.result).to.emit(this.silo, 'AddDeposit')
            .withArgs(userAddress, this.bean.address, 3, '100618167', '100618167');
        });
      });
    });
  });
});
