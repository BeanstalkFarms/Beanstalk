const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { BEAN, THREE_CURVE, THREE_POOL, BEAN_3_CURVE } = require('./utils/constants')
const { ConvertEncoder } = require('./utils/encoder.js')
const { to18, toBean, toStalk, to6 } = require('./utils/helpers.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { impersonateCurveMetapool } = require('../scripts/impersonate.js');
let user, user2, owner;
let userAddress, ownerAddress, user2Address;

describe('Curve Convert', function () {
  before(async function () {
    [owner, user, user2, fakeMetapoolAccount] = await ethers.getSigners();
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
    this.threePool = await ethers.getContractAt('Mock3Curve', THREE_POOL);
    this.threeCurve = await ethers.getContractAt('MockToken', THREE_CURVE);
    this.beanMetapool = await ethers.getContractAt('IMockCurvePool', BEAN_3_CURVE);

    await impersonateCurveMetapool(fakeMetapoolAccount.address, 'FAKE');
    this.fakeMetapool = await ethers.getContractAt('IMockCurvePool', fakeMetapoolAccount.address);

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
    await this.season.teleportSunrise(10);
    this.season.deployStemsUpgrade();
    await this.season.teleportSunrise(12);
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe('calculates beans to peg', async function () {
    it('p > 1', async function () {
      await this.beanMetapool.connect(user).add_liquidity([toBean('0'), to18('200')], to18('150'));
      expect(await this.convertGet.getMaxAmountIn(this.bean.address, this.beanMetapool.address)).to.be.equal(ethers.utils.parseUnits('200', 6));
    });

    it('p = 1', async function () {
      expect(await this.convertGet.getMaxAmountIn(this.bean.address, this.beanMetapool.address)).to.be.equal('0');
    });

    it('p < 1', async function () {
      await this.beanMetapool.connect(user).add_liquidity([toBean('200'), to18('0')], to18('150'));
      expect(await this.convertGet.getMaxAmountIn(this.bean.address, this.beanMetapool.address)).to.be.equal('0');
    });
  });

  describe('calculates lp to peg', async function () {
    it('p > 1', async function () {
      await this.beanMetapool.connect(user2).add_liquidity([toBean('200'), to18('0')], to18('150'));
      expect(await this.convertGet.getMaxAmountIn(this.beanMetapool.address, this.bean.address)).to.be.equal('199185758314813528598');
    });

    it('p = 1', async function () {
      expect(await this.convertGet.getMaxAmountIn(this.beanMetapool.address, this.bean.address)).to.be.equal('0');
    });

    it('p < 1', async function () {
      await this.beanMetapool.connect(user).add_liquidity([toBean('0'), to18('200')], to18('150'));
      expect(await this.convertGet.getMaxAmountIn(this.beanMetapool.address, this.bean.address)).to.be.equal('0');
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

      it('Not whitelisted pool', async function () {
        const convertData = ConvertEncoder.convertBeansToCurveLP(toBean('200'), to18('190'), this.fakeMetapool.address)
        await expect(this.convert.connect(owner).convert(
          convertData,
          [],
          []
        )).to.be.revertedWith("Convert: Not a whitelisted Curve pool.")
      })


    });

  describe('below max', async function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(12);
        await this.silo.connect(user).deposit(this.bean.address, toBean('200'), EXTERNAL);
        await this.beanMetapool.connect(user).add_liquidity([toBean('0'), to18('200')], to18('150'));
      });

      it('it gets amount out', async function () {
        expect(await this.convertGet.getAmountOut(
          BEAN,
          BEAN_3_CURVE,
          toBean('100')
        )).to.be.equal('100634476734756985505')
      })

      it('returns correct values', async function () {
        const stemBean = await this.silo.seasonToStem(this.bean.address, '12');
        const stemMetapool = await this.silo.seasonToStem(this.beanMetapool.address, '12');
        this.result = await this.convert.connect(user).callStatic.convert(ConvertEncoder.convertBeansToCurveLP(toBean('100'), to18('99'), this.beanMetapool.address), [stemBean], [toBean('100')])


        expect(this.result.toStem).to.be.equal(stemMetapool);
        expect(this.result.fromAmount).to.be.equal(to6('100'))
        expect(this.result.toAmount).to.be.equal('100634476734756985505')
        expect(this.result.fromBdv).to.be.equal(to6('100'))
        expect(this.result.toBdv).to.be.equal(to6('100'))

      })

      describe('it converts', async function () {
        beforeEach(async function () {
          const stem = await this.silo.seasonToStem(this.bean.address, '12');
          this.result = await this.convert.connect(user).convert(ConvertEncoder.convertBeansToCurveLP(toBean('100'), to18('99'), this.beanMetapool.address), [stem], [toBean('100')])
        })

        it('properly updates total values', async function () {
          expect(await this.silo.getTotalDeposited(this.bean.address)).to.eq(toBean('100'));
          expect(await this.silo.getTotalDepositedBdv(this.bean.address)).to.eq(toBean('100'));
          expect(await this.silo.getTotalDeposited(this.beanMetapool.address)).to.eq('100634476734756985505');
          expect(await this.silo.getTotalDepositedBdv(this.beanMetapool.address)).to.eq(toBean('100'));
          //expect(await this.silo.totalSeeds()).to.eq(toBean('600'));
          expect(await this.silo.totalStalk()).to.eq(toStalk('200'));
        });

        it('properly updates user values', async function () {
          //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(toBean('600'));
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('200'));
        });

        it('properly updates user deposits', async function () {
          const stemBean = await this.silo.seasonToStem(this.bean.address, '12');
          const stemMetapool = await this.silo.seasonToStem(this.beanMetapool.address, '12');
          expect((await this.silo.getDeposit(userAddress, this.bean.address, stemBean))[0]).to.eq(toBean('100'));
          const deposit = await this.silo.getDeposit(userAddress, this.beanMetapool.address, stemMetapool);
          expect(deposit[0]).to.eq('100634476734756985505');
          expect(deposit[1]).to.eq(toBean('100'));
        });

        it('emits events', async function () {
          const stemBean = await this.silo.seasonToStem(this.bean.address, '12');
          const stemMetapool = await this.silo.seasonToStem(this.beanMetapool.address, '12');
          await expect(this.result).to.emit(this.silo, 'RemoveDeposits')
            .withArgs(userAddress, this.bean.address, [stemBean], [toBean('100')], toBean('100'), [toBean('100')]);
          await expect(this.result).to.emit(this.silo, 'AddDeposit')
            .withArgs(userAddress, this.beanMetapool.address, stemMetapool, '100634476734756985505', toBean('100'));
        });
      })
    });

    describe('above max', function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(12);
        await this.silo.connect(user).deposit(this.bean.address, toBean('300'), EXTERNAL);
        await this.beanMetapool.connect(user).add_liquidity([toBean('0'), to18('200')], to18('150'));
      });

      it('it gets amount out', async function () {
        expect(await this.convertGet.getAmountOut(
          BEAN,
          BEAN_3_CURVE,
          toBean('200')
        )).to.be.equal('200832430692705624354')
      })

      describe('it converts', async function () {
        beforeEach(async function () {
          const stemBean = await this.silo.seasonToStem(this.bean.address, '12');
          this.result = await this.convert.connect(user).convert(ConvertEncoder.convertBeansToCurveLP(toBean('250'), to18('190'), this.beanMetapool.address), [stemBean], [toBean('250')])
        });

        it('properly updates total values', async function () {
          expect(await this.silo.getTotalDeposited(this.bean.address)).to.eq(toBean('100'));
          expect(await this.silo.getTotalDepositedBdv(this.bean.address)).to.eq(toBean('100'));
          expect(await this.silo.getTotalDeposited(this.beanMetapool.address)).to.eq('200832430692705624354');
          expect(await this.silo.getTotalDepositedBdv(this.beanMetapool.address)).to.eq(toBean('200'));
          //expect(await this.silo.totalSeeds()).to.eq(toBean('1000'));
          expect(await this.silo.totalStalk()).to.eq(toStalk('300'));
        });

        it('properly updates user values', async function () {
          //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(toBean('1000'));
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('300'));
        });

        it('properly updates user deposits', async function () {
          const stemBean = await this.silo.seasonToStem(this.bean.address, '12');
          expect((await this.silo.getDeposit(userAddress, this.bean.address, stemBean))[0]).to.eq(toBean('100'));
          const stemMetapool = await this.silo.seasonToStem(this.beanMetapool.address, '12');
          const deposit = await this.silo.getDeposit(userAddress, this.beanMetapool.address, stemMetapool);
          expect(deposit[0]).to.eq('200832430692705624354');
          expect(deposit[1]).to.eq(toBean('200'));
        });

        it('emits events', async function () {
          const stemBean = await this.silo.seasonToStem(this.bean.address, '12');
          await expect(this.result).to.emit(this.silo, 'RemoveDeposits')
            .withArgs(userAddress, this.bean.address, [stemBean], [toBean('200')], toBean('200'), [toBean('200')]);
            const stemMetapool = await this.silo.seasonToStem(this.beanMetapool.address, '12');
          await expect(this.result).to.emit(this.silo, 'AddDeposit')
            .withArgs(userAddress, this.beanMetapool.address, stemMetapool, '200832430692705624354', toBean('200'));
        });
      });
    });

    describe('after one season', function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(12);
        await this.silo.connect(user).deposit(this.bean.address, toBean('200'), EXTERNAL);
        await this.season.siloSunrise(0);
        await this.beanMetapool.connect(user).add_liquidity([toBean('0'), to18('200')], to18('150'));
      });

      describe('it converts', async function () {
        beforeEach(async function () {
          await this.season.teleportSunrise(12);
          const stemBean = await this.silo.seasonToStem(this.bean.address, '12');
          this.result = await this.convert.connect(user).convert(ConvertEncoder.convertBeansToCurveLP(toBean('250'), to18('190'), this.beanMetapool.address), [stemBean], [toBean('250')])
        });

        it('properly updates total values', async function () {
          expect(await this.silo.getTotalDeposited(this.bean.address)).to.eq(toBean('0'));
          expect(await this.silo.getTotalDepositedBdv(this.bean.address)).to.eq(toBean('0'));
          expect(await this.silo.getTotalDeposited(this.beanMetapool.address)).to.eq('200832430692705624354');
          expect(await this.silo.getTotalDepositedBdv(this.beanMetapool.address)).to.eq(to6('200'));
          //expect(await this.silo.totalSeeds()).to.eq(toBean('800'));
          expect(await this.silo.totalStalk()).to.eq(toStalk('200'));
        });

        it('properly updates user values', async function () {
          //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(toBean('800'));
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('200'));
        });

        it('properly updates user deposits', async function () {
          const stemBean = await this.silo.seasonToStem(this.bean.address, '12');
          expect((await this.silo.getDeposit(userAddress, this.bean.address, stemBean))[0]).to.eq(toBean('0'));
          const stemMetapool = await this.silo.seasonToStem(this.beanMetapool.address, '12');
          const deposit = await this.silo.getDeposit(userAddress, this.beanMetapool.address, stemMetapool);
          expect(deposit[0]).to.eq('200832430692705624354');
          expect(deposit[1]).to.eq(toBean('200'));
        });

        it('emits events', async function () {
          const stemBean = await this.silo.seasonToStem(this.bean.address, '12');
          await expect(this.result).to.emit(this.silo, 'RemoveDeposits')
            .withArgs(userAddress, this.bean.address, [stemBean], [toBean('200')], toBean('200'), [toBean('200')]);
          const stemMetapool = await this.silo.seasonToStem(this.beanMetapool.address, '12');
          await expect(this.result).to.emit(this.silo, 'AddDeposit')
            .withArgs(userAddress, this.beanMetapool.address, stemMetapool, '200832430692705624354', toBean('200'));
        });
      })
    });

    describe('after multiple season', function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(12);
        
        await this.silo.connect(user).deposit(this.bean.address, toBean('200'), EXTERNAL);
        await this.season.siloSunrise(0);
        await this.season.siloSunrise(0);
        await this.beanMetapool.connect(user).add_liquidity([toBean('0'), to18('200')], to18('150'));
      });

      describe('it converts', async function () {
        beforeEach(async function () {
          
          const stemBean = await this.silo.seasonToStem(this.bean.address, '12');

          this.result = await this.convert.connect(user).convert(ConvertEncoder.convertBeansToCurveLP(toBean('250'), to18('190'), this.beanMetapool.address), [stemBean], [toBean('250')])
        });

        it('properly updates total values', async function () {
          expect(await this.silo.getTotalDeposited(this.bean.address)).to.eq(toBean('0'));
          expect(await this.silo.getTotalDepositedBdv(this.bean.address)).to.eq(toBean('0'));
          expect(await this.silo.getTotalDeposited(this.beanMetapool.address)).to.eq('200832430692705624354');
          expect(await this.silo.getTotalDepositedBdv(this.beanMetapool.address)).to.eq(to6('200'));
          //expect(await this.silo.totalSeeds()).to.eq(toBean('800'));
          expect(await this.silo.totalStalk()).to.eq(toStalk('200.08'));
        });

        it('properly updates user values', async function () {
          //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(toBean('800'));
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('200.08'));
        });

        it('properly updates user deposits', async function () {
          const stemBean = await this.silo.seasonToStem(this.bean.address, '12');
          expect((await this.silo.getDeposit(userAddress, this.bean.address, stemBean))[0]).to.eq(toBean('0'));
          const stemMetapool = await this.silo.seasonToStem(this.beanMetapool.address, '13');
          const deposit = await this.silo.getDeposit(userAddress, this.beanMetapool.address, stemMetapool);
          expect(deposit[0]).to.eq('200832430692705624354');
          expect(deposit[1]).to.eq(toBean('200'));
        });

        it('emits events', async function () {
          const stemBean = await this.silo.seasonToStem(this.bean.address, '12');
          await expect(this.result).to.emit(this.silo, 'RemoveDeposits')
            .withArgs(userAddress, this.bean.address, [stemBean], [toBean('200')], toBean('200'), [toBean('200')]);
            const stemMetapool = await this.silo.seasonToStem(this.beanMetapool.address, '13');
          await expect(this.result).to.emit(this.silo, 'AddDeposit')
            .withArgs(userAddress, this.beanMetapool.address, stemMetapool, '200832430692705624354', toBean('200'));
        });
      });
    })

    describe('multiple crates', function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(10);
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
          const stemBean10 = await this.silo.seasonToStem(this.bean.address, '10');
          const stemBean14 = await this.silo.seasonToStem(this.bean.address, '14');
          this.result = await this.convert.connect(user).convert(ConvertEncoder.convertBeansToCurveLP(toBean('250'), to18('190'), this.beanMetapool.address), [stemBean10, stemBean14], [toBean('100'), toBean('100')])
        });

        it('properly updates total values', async function () {
          expect(await this.silo.getTotalDeposited(this.bean.address)).to.eq(toBean('0'));
          expect(await this.silo.getTotalDepositedBdv(this.bean.address)).to.eq(toBean('0'));
          expect(await this.silo.getTotalDeposited(this.beanMetapool.address)).to.eq('200832430692705624354');
          expect(await this.silo.getTotalDepositedBdv(this.beanMetapool.address)).to.eq(to6('200'));
          //expect(await this.silo.totalSeeds()).to.eq(toBean('800'));
          expect(await this.silo.totalStalk()).to.eq(toStalk('200.08'));
        });

        it('properly updates user values', async function () {
          //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(toBean('800'));
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('200.08'));
        });

        it('properly updates user deposits', async function () {
          const stemBean10 = await this.silo.seasonToStem(this.bean.address, '10');
          const stemBean14 = await this.silo.seasonToStem(this.bean.address, '14');
          expect((await this.silo.getDeposit(userAddress, this.bean.address, stemBean10))[0]).to.eq(toBean('0'));
          expect((await this.silo.getDeposit(userAddress, this.bean.address, stemBean14))[0]).to.eq(toBean('0'));
          
          const deposit = await this.silo.getDeposit(userAddress, this.beanMetapool.address, 12); //someone else please do the math and verify that 12 is the expected season here
          expect(deposit[0]).to.eq('200832430692705624354');
          expect(deposit[1]).to.eq(toBean('200'));
        });

        it('emits events', async function () {
          const stemBean10 = await this.silo.seasonToStem(this.bean.address, '10');
          const stemBean14 = await this.silo.seasonToStem(this.bean.address, '14');
          await expect(this.result).to.emit(this.silo, 'RemoveDeposits')
            .withArgs(userAddress, this.bean.address, [stemBean10, stemBean14], [toBean('100'), toBean('100')], toBean('200'), [toBean('100'), toBean('100')]);
          await expect(this.result).to.emit(this.silo, 'AddDeposit')
            .withArgs(userAddress, this.beanMetapool.address, 12, '200832430692705624354', toBean('200'));
        });
      })
    });
  });

  describe('convert lp to beans', async function () {

    describe('revert', async function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(10);
      });
      it('not enough Beans', async function () {
        await this.beanMetapool.connect(user).add_liquidity([toBean('200'), to18('0')], to18('150'));
        await this.silo.connect(user).deposit(this.beanMetapool.address, to18('1000'), EXTERNAL);
        const stemMetapool = await this.silo.seasonToStem(this.beanMetapool.address, '10');

        await expect(this.convert.connect(user).convert(ConvertEncoder.convertCurveLPToBeans(to18('200'), toBean('250'), this.beanMetapool.address), [stemMetapool], [to18('200')]))
          .to.be.revertedWith('Curve: Insufficient Output');
      });

      it('p < 1', async function () {
        const stemMetapool = await this.silo.seasonToStem(this.beanMetapool.address, '10');
        await this.beanMetapool.connect(user).add_liquidity([toBean('0'), to18('1')], to18('0.5'));
        await this.silo.connect(user).deposit(this.beanMetapool.address, to18('1000'), EXTERNAL);
        await expect(this.convert.connect(user).convert(ConvertEncoder.convertCurveLPToBeans(to18('200'), toBean('190'), this.beanMetapool.address), [stemMetapool], ['1000']))
          .to.be.revertedWith('Convert: P must be < 1.');
      });

      it('Not whitelisted pool', async function () {
        const convertData = ConvertEncoder.convertCurveLPToBeans(to18('100'), toBean('99'), this.fakeMetapool.address)
        await expect(this.convert.connect(owner).convert(
          convertData,
          [],
          []
        )).to.be.revertedWith("Convert: Not a whitelisted Curve pool.")
      })
    });

    describe('below max', function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(10);
        await this.beanMetapool.connect(user).add_liquidity([toBean('200'), to18('0')], to18('150'));
        await this.silo.connect(user).deposit(this.beanMetapool.address, to18('1000'), EXTERNAL);
      });


      it('it gets amount out', async function () {
        expect(await this.convertGet.getAmountOut(
          BEAN_3_CURVE,
          BEAN,
          to18('100')
        )).to.be.equal('100618167')
      })

      describe('it converts', async function () {
        beforeEach(async function () {
          const stemMetapool = await this.silo.seasonToStem(this.beanMetapool.address, '10');
          this.result = await this.convert.connect(user).convert(ConvertEncoder.convertCurveLPToBeans(to18('100'), toBean('99'), this.beanMetapool.address), [stemMetapool], [to18('100')])
        });

        it('properly updates total values', async function () {
          expect(await this.silo.getTotalDeposited(this.bean.address)).to.eq('100618167');
          expect(await this.silo.getTotalDepositedBdv(this.bean.address)).to.eq('100618167');
          expect(await this.silo.getTotalDeposited(this.beanMetapool.address)).to.eq(to18('900'));
          expect(await this.silo.getTotalDepositedBdv(this.beanMetapool.address)).to.eq(to6('900'));
          //expect(await this.silo.totalSeeds()).to.eq('3801236334');
          expect(await this.silo.totalStalk()).to.eq('10006181670000');
        });

        it('properly updates user values', async function () {
          //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('3801236334');
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq('10006181670000');
        });

        it('properly updates user deposits', async function () {
          const stemMetapool = await this.silo.seasonToStem(this.beanMetapool.address, '10');
          const stemBean = await this.silo.seasonToStem(this.beanMetapool.address, '10');
          let deposit = await this.silo.getDeposit(userAddress, this.bean.address, stemBean);
          expect(deposit[0]).to.eq(toBean('100.618167'));
          expect(deposit[1]).to.eq(toBean('100.618167'));
          deposit = await this.silo.getDeposit(userAddress, this.beanMetapool.address, stemMetapool);
          expect(deposit[0]).to.eq(to18('900'));
          expect(deposit[1]).to.eq(toBean('900'));
        });

        it('emits events', async function () {
          const stemMetapool = await this.silo.seasonToStem(this.beanMetapool.address, '10');
          const stemBean = await this.silo.seasonToStem(this.beanMetapool.address, '10');
          await expect(this.result).to.emit(this.silo, 'RemoveDeposits')
            .withArgs(userAddress, this.beanMetapool.address, [stemMetapool], [to18('100')], to18('100'), [toBean('100')]);
          await expect(this.result).to.emit(this.silo, 'AddDeposit')
            .withArgs(userAddress, this.bean.address, stemBean, '100618167', '100618167');
        });
      });
    });

    describe('above max', function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(10);
        await this.beanMetapool.connect(user).add_liquidity([toBean('200'), to18('0')], to18('150'));
        await this.silo.connect(user).deposit(this.beanMetapool.address, to18('1000'), EXTERNAL);
      });


      it('it gets amount out', async function () {
        expect(await this.convertGet.getAmountOut(
          BEAN_3_CURVE,
          BEAN,
          '199185758314813528598',
        )).to.be.equal('200018189')
      })

      describe('it converts', async function () {
        beforeEach(async function () {
          const stemMetapool = await this.silo.seasonToStem(this.beanMetapool.address, '10');
          this.result = await this.convert.connect(user).convert(ConvertEncoder.convertCurveLPToBeans(to18('300'), toBean('150'), this.beanMetapool.address), [stemMetapool], [to18('300')])
        });

        it('properly updates total values', async function () {
          expect(await this.silo.getTotalDeposited(this.bean.address)).to.eq('200018189');
          expect(await this.silo.getTotalDepositedBdv(this.bean.address)).to.eq('200018189');
          expect(await this.silo.getTotalDeposited(this.beanMetapool.address)).to.eq('800814241685186471402');
          expect(await this.silo.getTotalDepositedBdv(this.beanMetapool.address)).to.eq('800814242');
          //expect(await this.silo.totalSeeds()).to.eq('3603293346');
          expect(await this.silo.totalStalk()).to.eq('10008324310000');
        });

        it('properly updates user values', async function () {
          //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('3603293346');
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq('10008324310000');
        });

        it('properly updates user deposits', async function () {
          const stemMetapool = await this.silo.seasonToStem(this.beanMetapool.address, '10');
          const stemBean = await this.silo.seasonToStem(this.bean.address, '10');
          let deposit = await this.silo.getDeposit(userAddress, this.bean.address, stemBean);
          expect(deposit[0]).to.eq('200018189');
          expect(deposit[1]).to.eq('200018189');
          deposit = await this.silo.getDeposit(userAddress, this.beanMetapool.address, stemMetapool);
          expect(deposit[0]).to.eq('800814241685186471402');
          expect(deposit[1]).to.eq('800814242');
        });

        it('emits events', async function () {
          const stemMetapool = await this.silo.seasonToStem(this.beanMetapool.address, '10');
          const stemBean = await this.silo.seasonToStem(this.bean.address, '10');
          await expect(this.result).to.emit(this.silo, 'RemoveDeposits')
            .withArgs(userAddress, this.beanMetapool.address, [stemMetapool], ['199185758314813528598'], '199185758314813528598', ['199185758']);
          await expect(this.result).to.emit(this.silo, 'AddDeposit')
            .withArgs(userAddress, this.bean.address, stemBean, '200018189', '200018189');
        });
      });
    });

    describe('after 1 season', function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(10);
        await this.beanMetapool.connect(user).add_liquidity([toBean('200'), to18('0')], to18('150'));
        await this.silo.connect(user).deposit(this.beanMetapool.address, to18('1000'), EXTERNAL);
        await this.season.siloSunrise(0);
      });


      it('it gets amount out', async function () {

      })

      describe('it converts', async function () {
        beforeEach(async function () {
          const stemMetapool = await this.silo.seasonToStem(this.beanMetapool.address, '10');
          this.result = await this.convert.connect(user).convert(ConvertEncoder.convertCurveLPToBeans(to18('100'), toBean('99'), this.beanMetapool.address), [stemMetapool], [to18('100')])
        });

        it('properly updates total values', async function () {
          expect(await this.silo.getTotalDeposited(this.bean.address)).to.eq('100618167');
          expect(await this.silo.getTotalDepositedBdv(this.bean.address)).to.eq('100618167');
          expect(await this.silo.getTotalDeposited(this.beanMetapool.address)).to.eq(to18('900'));
          expect(await this.silo.getTotalDepositedBdv(this.beanMetapool.address)).to.eq(to6('900'));

          // the seasons value for total stalk here was 10009982906334, because you would have
          // lost stalk when the deposit would have required a negative season
          // after this change, you get to keep more stalk!
          expect(await this.silo.totalStalk()).to.eq('10010083524501');
        });

        it('properly updates user values', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq('10010083524501');
        });

        it('properly updates user deposits', async function () {
          const stemMetapool = await this.silo.seasonToStem(this.beanMetapool.address, '10');
          expect((await this.silo.getDeposit(userAddress, this.bean.address, -1))[0]).to.eq('100618167');
          const deposit = await this.silo.getDeposit(userAddress, this.beanMetapool.address, stemMetapool);
          expect(deposit[0]).to.eq(to18('900'));
          expect(deposit[1]).to.eq(toBean('900'));
        });

        it('emits events', async function () {
          const stemMetapool = await this.silo.seasonToStem(this.beanMetapool.address, '10');
          const stemBean = await this.silo.seasonToStem(this.bean.address, '10');
          await expect(this.result).to.emit(this.silo, 'RemoveDeposits')
            .withArgs(userAddress, this.beanMetapool.address, [stemMetapool], [to18('100')], to18('100'), [toBean('100')]);
          await expect(this.result).to.emit(this.silo, 'AddDeposit')
            .withArgs(userAddress, this.bean.address, -1, '100618167', '100618167');
        });
      });
    });

    describe('multiple crates', function () {
      beforeEach(async function () {
        await this.season.teleportSunrise(10);
        await this.beanMetapool.connect(user).add_liquidity([toBean('200'), to18('0')], to18('150'));
        await this.silo.connect(user).deposit(this.beanMetapool.address, to18('500'), EXTERNAL);
        await this.season.siloSunrise(0);
        await this.silo.connect(user).deposit(this.beanMetapool.address, to18('500'), EXTERNAL);
      });


      it('it gets amount out', async function () {

      })

      describe('it converts', async function () {
        beforeEach(async function () {
          const stemMetapool10 = await this.silo.seasonToStem(this.beanMetapool.address, '10');
          const stemMetapool11 = await this.silo.seasonToStem(this.beanMetapool.address, '11');
          this.result = await this.convert.connect(user).convert(ConvertEncoder.convertCurveLPToBeans(to18('100'), toBean('99'), this.beanMetapool.address), [stemMetapool10, stemMetapool11], [to18('50'), to18('50')])
        });

        it('properly updates total values', async function () {
          expect(await this.silo.getTotalDeposited(this.bean.address)).to.eq('100618167');
          expect(await this.silo.getTotalDepositedBdv(this.bean.address)).to.eq('100618167');
          expect(await this.silo.getTotalDeposited(this.beanMetapool.address)).to.eq(to18('900'));
          expect(await this.silo.getTotalDepositedBdv(this.beanMetapool.address)).to.eq(to6('900'));
          expect(await this.silo.totalStalk()).to.eq('10008082288167'); //updated from 10007981670000 for season based system
        });

        it('properly updates user values', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq('10008082288167');
        });

        it('properly updates user deposits', async function () {
          const stemMetapool10 = await this.silo.seasonToStem(this.beanMetapool.address, '10');
          const stemBean10 = await this.silo.seasonToStem(this.beanMetapool.address, '10');
          expect((await this.silo.getDeposit(userAddress, this.bean.address, 1))[0]).to.eq('100618167');
          const deposit = await this.silo.getDeposit(userAddress, this.beanMetapool.address, stemMetapool10);
          expect(deposit[0]).to.eq(to18('450'));
          expect(deposit[1]).to.eq(toBean('450'));
        });

        it('emits events', async function () {
          const stemMetapool10 = await this.silo.seasonToStem(this.beanMetapool.address, '10');
          const stemMetapool11 = await this.silo.seasonToStem(this.beanMetapool.address, '11');

          await expect(this.result).to.emit(this.silo, 'RemoveDeposits')
            .withArgs(userAddress, this.beanMetapool.address, [stemMetapool10, stemMetapool11], [to18('50'), to18('50')], to18('100'), [toBean('50'), toBean('50')]);
          await expect(this.result).to.emit(this.silo, 'AddDeposit')
            .withArgs(userAddress, this.bean.address, 1, '100618167', '100618167');
        });
      });
    });
  });
});
