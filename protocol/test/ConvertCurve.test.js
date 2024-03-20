const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL } = require('./utils/balances.js')
const { BEAN, THREE_CURVE, THREE_POOL, BEAN_3_CURVE } = require('./utils/constants')
const { ConvertEncoder } = require('./utils/encoder.js')
const { to18, toStalk, to6 } = require('./utils/helpers.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { impersonateCurveMetapool } = require('../scripts/impersonate.js');
const { getAllBeanstalkContracts } = require("../utils/contracts");
const { getBean } = require('../utils/contracts.js');
const { initalizeUsersForToken, endGermination, endGerminationWithMockToken  } = require('./utils/testHelpers.js')


let user, user2, owner;


describe('Curve Convert', function () {
  before(async function () {
    [owner, user, user2, fakeMetapoolAccount] = await ethers.getSigners();
    
    const contracts = await deploy(verbose = false, mock = true, reset = true)
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [ beanstalk, mockBeanstalk ] = await getAllBeanstalkContracts(this.diamond.address);
    
    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [ beanstalk, mockBeanstalk ] = await getAllBeanstalkContracts(this.diamond.address);
    
    bean = await getBean()
    this.threePool = await ethers.getContractAt('Mock3Curve', THREE_POOL);
    this.threeCurve = await ethers.getContractAt('MockToken', THREE_CURVE);
    this.beanMetapool = await ethers.getContractAt('IMockCurvePool', BEAN_3_CURVE);
    await impersonateCurveMetapool(fakeMetapoolAccount.address, 'FAKE', BEAN);
    this.fakeMetapool = await ethers.getContractAt('IMockCurvePool', fakeMetapoolAccount.address);

    await this.threeCurve.mint(user.address, to18('100000'));
    await this.threePool.set_virtual_price(to18('1'));
    await this.threeCurve.connect(user).approve(this.beanMetapool.address, to18('100000000000'));

    await this.beanMetapool.set_A_precise('1000');
    await this.beanMetapool.set_virtual_price(ethers.utils.parseEther('1'));
    await this.beanMetapool.connect(user).approve(this.threeCurve.address, to18('100000000000'));
    await this.beanMetapool.connect(user).approve(beanstalk.address, to18('100000000000'));

    await initalizeUsersForToken(BEAN, [user, user2],  to6('1000000000'))
    await bean.connect(user).approve(this.beanMetapool.address, to18('100000000000'));
    await bean.connect(user2).approve(this.beanMetapool.address, to18('100000000000'));
    await this.beanMetapool.connect(user).add_liquidity([to6('1000'), to18('1000')], to18('2000'));
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  // bean3crv dewhitelisting means that people cannot convert bean to bean3crv LP.
  // tests are kept (and skipped) for legacy purposes.
  describe.skip('calculates beans to peg LEGACY', async function () {
    it('p > 1', async function () {
      await this.beanMetapool.connect(user).add_liquidity([to6('0'), to18('200')], to18('150'));
      expect(await beanstalk.getMaxAmountIn(bean.address, this.beanMetapool.address)).to.be.equal(ethers.utils.parseUnits('200', 6));
    });

    it('p = 1', async function () {
      expect(await beanstalk.getMaxAmountIn(bean.address, this.beanMetapool.address)).to.be.equal('0');
    });

    it('p < 1', async function () {
      await this.beanMetapool.connect(user).add_liquidity([to6('200'), to18('0')], to18('150'));
      expect(await beanstalk.getMaxAmountIn(bean.address, this.beanMetapool.address)).to.be.equal('0');
    });
  });

  // verify converting beans to bean3crv LP will fail.
  describe('calculates beans to peg', async function () {
    it('p > 1', async function () {
      await expect(beanstalk.getMaxAmountIn(bean.address, this.beanMetapool.address))
        .to.be.revertedWith("Convert: Tokens not supported");
    });

    it('p = 1', async function () {
      await expect(beanstalk.getMaxAmountIn(bean.address, this.beanMetapool.address))
        .to.be.revertedWith("Convert: Tokens not supported");
    });

    it('p < 1', async function () {
      await expect(beanstalk.getMaxAmountIn(bean.address, this.beanMetapool.address))
        .to.be.revertedWith("Convert: Tokens not supported");
    });
  });

  describe('calculates lp to peg', async function () {
    it('p > 1', async function () {
      await this.beanMetapool.connect(user2).add_liquidity([to6('200'), to18('0')], to18('150'));
      expect(await beanstalk.getMaxAmountIn(this.beanMetapool.address, bean.address)).to.be.equal('199185758314813528598');
    });

    it('p = 1', async function () {
      expect(await beanstalk.getMaxAmountIn(this.beanMetapool.address, bean.address)).to.be.equal('0');
    });

    it('p < 1', async function () {
      await this.beanMetapool.connect(user).add_liquidity([to6('0'), to18('200')], to18('150'));
      expect(await beanstalk.getMaxAmountIn(this.beanMetapool.address, bean.address)).to.be.equal('0');
    });
  })

  // bean3crv dewhitelisting means that people cannot convert bean to bean3crv LP. 
  // They are able to still convert legacy deposited bean3crv LP to bean.
  describe.skip('convert beans to lp LEGACY', async function () {

    describe('revert', async function () {
      it('not enough LP', async function () {
        await beanstalk.connect(user).deposit(bean.address, to6('200'), EXTERNAL);
        await this.beanMetapool.connect(user).add_liquidity([to6('0'), to18('200')], to18('150'));
        await expect(beanstalk.connect(user).convert(ConvertEncoder.convertBeansToCurveLP(to6('200'), to18('201'), this.beanMetapool.address), ['2'], [to6('200')]))
          .to.be.revertedWith('Curve: Not enough LP');
      });

      it('p >= 1', async function () {
        await beanstalk.connect(user).deposit(bean.address, '1000', EXTERNAL);
        await expect(beanstalk.connect(user).convert(ConvertEncoder.convertBeansToCurveLP(to6('200'), to18('190'), this.beanMetapool.address), ['1'], ['1000']))
          .to.be.revertedWith('Convert: P must be >= 1.');
      });

      it('Not whitelisted pool', async function () {
        const convertData = ConvertEncoder.convertBeansToCurveLP(to6('200'), to18('190'), this.fakeMetapool.address)
        await expect(beanstalk.connect(owner).convert(
          convertData,
          [],
          []
        )).to.be.revertedWith("Convert: Not a whitelisted Curve pool.")
      })


    });

    describe('below max', async function () {
      beforeEach(async function () {
        await mockBeanstalk.teleportSunrise(12);
        await beanstalk.connect(user).deposit(bean.address, to6('200'), EXTERNAL);
        await this.beanMetapool.connect(user).add_liquidity([to6('0'), to18('200')], to18('150'));
      });

      it('it gets amount out', async function () {
        expect(await beanstalk.getAmountOut(
          BEAN,
          BEAN_3_CURVE,
          to6('100')
        )).to.be.equal('100634476734756985505')
      })

      it('returns correct values', async function () {
        const stemBean = await beanstalk.seasonToStem(bean.address, '12');
        const stemMetapool = await beanstalk.seasonToStem(this.beanMetapool.address, '12');
        this.result = await beanstalk.connect(user).callStatic.convert(ConvertEncoder.convertBeansToCurveLP(to6('100'), to18('99'), this.beanMetapool.address), [stemBean], [to6('100')])


        expect(this.result.toStem).to.be.equal(stemMetapool);
        expect(this.result.fromAmount).to.be.equal(to6('100'))
        expect(this.result.toAmount).to.be.equal('100634476734756985505')
        expect(this.result.fromBdv).to.be.equal(to6('100'))
        expect(this.result.toBdv).to.be.equal(to6('100'))

      })

      describe('it converts', async function () {
        beforeEach(async function () {
          const stem = await beanstalk.seasonToStem(bean.address, '12');
          this.result = await beanstalk.connect(user).convert(ConvertEncoder.convertBeansToCurveLP(to6('100'), to18('99'), this.beanMetapool.address), [stem], [to6('100')])
        })

        it('properly updates total values', async function () {
          expect(await beanstalk.getTotalDeposited(bean.address)).to.eq(to6('100'));
          expect(await beanstalk.getTotalDepositedBdv(bean.address)).to.eq(to6('100'));
          expect(await beanstalk.getTotalDeposited(this.beanMetapool.address)).to.eq('100634476734756985505');
          expect(await beanstalk.getTotalDepositedBdv(this.beanMetapool.address)).to.eq(to6('100'));
          //expect(await beanstalk.totalSeeds()).to.eq(to6('600'));
          expect(await beanstalk.totalStalk()).to.eq(toStalk('200'));
        });

        it('properly updates user values', async function () {
          //expect(await beanstalk.balanceOfSeeds(user.address)).to.eq(to6('600'));
          expect(await beanstalk.balanceOfStalk(user.address)).to.eq(toStalk('200'));
        });

        it('properly updates user deposits', async function () {
          const stemBean = await beanstalk.seasonToStem(bean.address, '12');
          const stemMetapool = await beanstalk.seasonToStem(this.beanMetapool.address, '12');
          expect((await beanstalk.getDeposit(user.address, bean.address, stemBean))[0]).to.eq(to6('100'));
          const deposit = await beanstalk.getDeposit(user.address, this.beanMetapool.address, stemMetapool);
          expect(deposit[0]).to.eq('100634476734756985505');
          expect(deposit[1]).to.eq(to6('100'));
        });

        it('emits events', async function () {
          const stemBean = await beanstalk.seasonToStem(bean.address, '12');
          const stemMetapool = await beanstalk.seasonToStem(this.beanMetapool.address, '12');
          await expect(this.result).to.emit(beanstalk, 'RemoveDeposits')
            .withArgs(user.address, bean.address, [stemBean], [to6('100')], to6('100'), [to6('100')]);
          await expect(this.result).to.emit(beanstalk, 'AddDeposit')
            .withArgs(user.address, this.beanMetapool.address, stemMetapool, '100634476734756985505', to6('100'));
        });
      })
    });

    describe('above max', function () {
      beforeEach(async function () {
        await beanstalk.connect(user).deposit(bean.address, to6('300'), EXTERNAL);
        await this.beanMetapool.connect(user).add_liquidity([to6('0'), to18('200')], to18('150'));
      });

      it('it gets amount out', async function () {
        expect(await beanstalk.getAmountOut(
          BEAN,
          BEAN_3_CURVE,
          to6('200')
        )).to.be.equal('200832430692705624354')
      })

      describe('it converts', async function () {
        beforeEach(async function () {
          const stemBean = await beanstalk.seasonToStem(bean.address, '12');
          this.result = await beanstalk.connect(user).convert(ConvertEncoder.convertBeansToCurveLP(to6('250'), to18('190'), this.beanMetapool.address), [stemBean], [to6('250')])
        });

        it('properly updates total values', async function () {
          expect(await beanstalk.getTotalDeposited(bean.address)).to.eq(to6('100'));
          expect(await beanstalk.getTotalDepositedBdv(bean.address)).to.eq(to6('100'));
          expect(await beanstalk.getTotalDeposited(this.beanMetapool.address)).to.eq('200832430692705624354');
          expect(await beanstalk.getTotalDepositedBdv(this.beanMetapool.address)).to.eq(to6('200'));
          expect(await beanstalk.totalStalk()).to.eq(toStalk('300'));
        });

        it('properly updates user values', async function () {
          expect(await beanstalk.balanceOfStalk(user.address)).to.eq(toStalk('300'));
        });

        it('properly updates user deposits', async function () {
          const stemBean = await beanstalk.seasonToStem(bean.address, '12');
          expect((await beanstalk.getDeposit(user.address, bean.address, stemBean))[0]).to.eq(to6('100'));
          const stemMetapool = await beanstalk.seasonToStem(this.beanMetapool.address, '12');
          const deposit = await beanstalk.getDeposit(user.address, this.beanMetapool.address, stemMetapool);
          expect(deposit[0]).to.eq('200832430692705624354');
          expect(deposit[1]).to.eq(to6('200'));
        });

        it('emits events', async function () {
          const stemBean = await beanstalk.seasonToStem(bean.address, '12');
          await expect(this.result).to.emit(beanstalk, 'RemoveDeposits')
            .withArgs(user.address, bean.address, [stemBean], [to6('200')], to6('200'), [to6('200')]);
            const stemMetapool = await beanstalk.seasonToStem(this.beanMetapool.address, '12');
          await expect(this.result).to.emit(beanstalk, 'AddDeposit')
            .withArgs(user.address, this.beanMetapool.address, stemMetapool, '200832430692705624354', to6('200'));
        });
      });
    });

    describe('after one season', function () {
      beforeEach(async function () {
        await mockBeanstalk.teleportSunrise(12);
        await beanstalk.connect(user).deposit(bean.address, to6('200'), EXTERNAL);
        await mockBeanstalk.siloSunrise(0);
        await this.beanMetapool.connect(user).add_liquidity([to6('0'), to18('200')], to18('150'));
      });

      describe('it converts', async function () {
        beforeEach(async function () {
          await mockBeanstalk.teleportSunrise(12);
          const stemBean = await beanstalk.seasonToStem(bean.address, '12');
          this.result = await beanstalk.connect(user).convert(ConvertEncoder.convertBeansToCurveLP(to6('250'), to18('190'), this.beanMetapool.address), [stemBean], [to6('250')])
        });

        it('properly updates total values', async function () {
          expect(await beanstalk.getTotalDeposited(bean.address)).to.eq(to6('0'));
          expect(await beanstalk.getTotalDepositedBdv(bean.address)).to.eq(to6('0'));
          expect(await beanstalk.getTotalDeposited(this.beanMetapool.address)).to.eq('200832430692705624354');
          expect(await beanstalk.getTotalDepositedBdv(this.beanMetapool.address)).to.eq(to6('200'));
          //expect(await beanstalk.totalSeeds()).to.eq(to6('800'));
          expect(await beanstalk.totalStalk()).to.eq(toStalk('200'));
        });

        it('properly updates user values', async function () {
          //expect(await beanstalk.balanceOfSeeds(user.address)).to.eq(to6('800'));
          expect(await beanstalk.balanceOfStalk(user.address)).to.eq(toStalk('200'));
        });

        it('properly updates user deposits', async function () {
          const stemBean = await beanstalk.seasonToStem(bean.address, '12');
          expect((await beanstalk.getDeposit(user.address, bean.address, stemBean))[0]).to.eq(to6('0'));
          const stemMetapool = await beanstalk.seasonToStem(this.beanMetapool.address, '12');
          const deposit = await beanstalk.getDeposit(user.address, this.beanMetapool.address, stemMetapool);
          expect(deposit[0]).to.eq('200832430692705624354');
          expect(deposit[1]).to.eq(to6('200'));
        });

        it('emits events', async function () {
          const stemBean = await beanstalk.seasonToStem(bean.address, '12');
          await expect(this.result).to.emit(beanstalk, 'RemoveDeposits')
            .withArgs(user.address, bean.address, [stemBean], [to6('200')], to6('200'), [to6('200')]);
          const stemMetapool = await beanstalk.seasonToStem(this.beanMetapool.address, '12');
          await expect(this.result).to.emit(beanstalk, 'AddDeposit')
            .withArgs(user.address, this.beanMetapool.address, stemMetapool, '200832430692705624354', to6('200'));
        });
      })
    });

    describe('after multiple season', function () {
      beforeEach(async function () {
        await mockBeanstalk.teleportSunrise(12);
        
        await beanstalk.connect(user).deposit(bean.address, to6('200'), EXTERNAL);
        await endGermination()
        await this.beanMetapool.connect(user).add_liquidity([to6('0'), to18('200')], to18('150'));
      });

      describe('it converts', async function () {
        beforeEach(async function () {
          
          const stemBean = await beanstalk.seasonToStem(bean.address, '12');

          this.result = await beanstalk.connect(user).convert(ConvertEncoder.convertBeansToCurveLP(to6('250'), to18('190'), this.beanMetapool.address), [stemBean], [to6('250')])
        });

        it('properly updates total values', async function () {
          expect(await beanstalk.getTotalDeposited(bean.address)).to.eq(to6('0'));
          expect(await beanstalk.getTotalDepositedBdv(bean.address)).to.eq(to6('0'));
          expect(await beanstalk.getTotalDeposited(this.beanMetapool.address)).to.eq('200832430692705624354');
          expect(await beanstalk.getTotalDepositedBdv(this.beanMetapool.address)).to.eq(to6('200'));
          //expect(await beanstalk.totalSeeds()).to.eq(to6('800'));
          expect(await beanstalk.totalStalk()).to.eq(toStalk('200.08'));
        });

        it('properly updates user values', async function () {
          //expect(await beanstalk.balanceOfSeeds(user.address)).to.eq(to6('800'));
          expect(await beanstalk.balanceOfStalk(user.address)).to.eq(toStalk('200.08'));
        });

        it('properly updates user deposits', async function () {
          const stemBean = await beanstalk.seasonToStem(bean.address, '12');
          expect((await beanstalk.getDeposit(user.address, bean.address, stemBean))[0]).to.eq(to6('0'));
          const stemMetapool = await beanstalk.seasonToStem(this.beanMetapool.address, '13');
          const deposit = await beanstalk.getDeposit(user.address, this.beanMetapool.address, stemMetapool);
          expect(deposit[0]).to.eq('200832430692705624354');
          expect(deposit[1]).to.eq(to6('200'));
        });

        it('emits events', async function () {
          const stemBean = await beanstalk.seasonToStem(bean.address, '12');
          await expect(this.result).to.emit(beanstalk, 'RemoveDeposits')
            .withArgs(user.address, bean.address, [stemBean], [to6('200')], to6('200'), [to6('200')]);
            const stemMetapool = await beanstalk.seasonToStem(this.beanMetapool.address, '13');
          await expect(this.result).to.emit(beanstalk, 'AddDeposit')
            .withArgs(user.address, this.beanMetapool.address, stemMetapool, '200832430692705624354', to6('200'));
        });
      });
    })

    describe('multiple crates', function () {
      beforeEach(async function () {
        await mockBeanstalk.teleportSunrise(10);
        await beanstalk.connect(user).deposit(bean.address, to6('100'), EXTERNAL);
        await endGermination()
        await beanstalk.connect(user).deposit(bean.address, to6('100'), EXTERNAL);
        await this.beanMetapool.connect(user).add_liquidity([to6('0'), to18('200')], to18('150'));
      });

      describe('it converts', async function () {
        beforeEach(async function () {
          const stemBean10 = await beanstalk.seasonToStem(bean.address, '10');
          const stemBean14 = await beanstalk.seasonToStem(bean.address, '14');
          this.result = await beanstalk.connect(user).convert(ConvertEncoder.convertBeansToCurveLP(to6('250'), to18('190'), this.beanMetapool.address), [stemBean10, stemBean14], [to6('100'), to6('100')])
        });

        it('properly updates total values', async function () {
          expect(await beanstalk.getTotalDeposited(bean.address)).to.eq(to6('0'));
          expect(await beanstalk.getTotalDepositedBdv(bean.address)).to.eq(to6('0'));
          expect(await beanstalk.getTotalDeposited(this.beanMetapool.address)).to.eq('200832430692705624354');
          expect(await beanstalk.getTotalDepositedBdv(this.beanMetapool.address)).to.eq(to6('200'));
          //expect(await beanstalk.totalSeeds()).to.eq(to6('800'));
          expect(await beanstalk.totalStalk()).to.eq(toStalk('200.08'));
        });

        it('properly updates user values', async function () {
          //expect(await beanstalk.balanceOfSeeds(user.address)).to.eq(to6('800'));
          expect(await beanstalk.balanceOfStalk(user.address)).to.eq(toStalk('200.08'));
        });

        it('properly updates user deposits', async function () {
          const stemBean10 = await beanstalk.seasonToStem(bean.address, '10');
          const stemBean14 = await beanstalk.seasonToStem(bean.address, '14');
          expect((await beanstalk.getDeposit(user.address, bean.address, stemBean10))[0]).to.eq(to6('0'));
          expect((await beanstalk.getDeposit(user.address, bean.address, stemBean14))[0]).to.eq(to6('0'));
          
          const deposit = await beanstalk.getDeposit(user.address, this.beanMetapool.address, 12); //someone else please do the math and verify that 12 is the expected season here
          expect(deposit[0]).to.eq('200832430692705624354');
          expect(deposit[1]).to.eq(to6('200'));
        });

        it('emits events', async function () {
          const stemBean10 = await beanstalk.seasonToStem(bean.address, '10');
          const stemBean14 = await beanstalk.seasonToStem(bean.address, '14');
          await expect(this.result).to.emit(beanstalk, 'RemoveDeposits')
            .withArgs(user.address, bean.address, [stemBean10, stemBean14], [to6('100'), to6('100')], to6('200'), [to6('100'), to6('100')]);
          await expect(this.result).to.emit(beanstalk, 'AddDeposit')
            .withArgs(user.address, this.beanMetapool.address, 12, '200832430692705624354', to6('200'));
        });
      })
    });
  });

  // verify converting beans to bean3crv LP will fail.
  describe('convert beans to lp', async function () {
    describe('below max', async function () {
      beforeEach(async function () {
        await mockBeanstalk.teleportSunrise(12);
        await beanstalk.connect(user).deposit(bean.address, to6('200'), EXTERNAL);
        await this.beanMetapool.connect(user).add_liquidity([to6('0'), to18('200')], to18('150'));
      });

      it('it gets amount out', async function () {
        await expect(beanstalk.getAmountOut(
          BEAN,
          BEAN_3_CURVE,
          to6('100')
        )).to.be.revertedWith("Convert: Tokens not supported")
      })

      it('returns correct values', async function () {
        const stemBean = await beanstalk.seasonToStem(bean.address, '12');
        const stemMetapool = await beanstalk.seasonToStem(this.beanMetapool.address, '12');

        await expect(beanstalk.connect(user).convert(ConvertEncoder.convertBeansToCurveLP(to6('100'), to18('99'), this.beanMetapool.address), [stemBean], [to6('100')]))
          .to.be.revertedWith("Convert: Invalid payload");

      })
    });
  })

  // NOTE: since bean3crv dewhitelisting, this test is updated for legacy purposes only.
  describe('convert lp to beans', async function () {

    beforeEach(async function () {
      await mockBeanstalk.mockWhitelistToken(
        this.beanMetapool.address,
        beanstalk.interface.getSighash('curveToBDV'),
        '10000',
        to6('1')
      );
    });

    describe('revert', async function () {

      it('not enough Beans', async function () {
        await this.beanMetapool.connect(user).add_liquidity([to6('200'), to18('0')], to18('150'));
        
        await beanstalk.connect(user).deposit(this.beanMetapool.address, to18('1000'), EXTERNAL);
        await beanstalk.connect(owner).dewhitelistToken(this.beanMetapool.address);
        const stemMetapool = await beanstalk.seasonToStem(this.beanMetapool.address, '10');

        await expect(beanstalk.connect(user).convert(ConvertEncoder.convertCurveLPToBeans(to18('200'), to6('250'), this.beanMetapool.address), [stemMetapool], [to18('200')]))
          .to.be.revertedWith('Curve: Insufficient Output');
      });

      it('p > 1', async function () {
        const stemMetapool = await beanstalk.seasonToStem(this.beanMetapool.address, '10');
        await this.beanMetapool.connect(user).add_liquidity([to6('0'), to18('1')], to18('0.5'));
        await beanstalk.connect(user).deposit(this.beanMetapool.address, to18('1000'), EXTERNAL);
        await beanstalk.connect(owner).dewhitelistToken(this.beanMetapool.address);
        await expect(beanstalk.connect(user).convert(ConvertEncoder.convertCurveLPToBeans(to18('200'), to6('190'), this.beanMetapool.address), [stemMetapool], ['1000']))
          .to.be.revertedWith('Convert: P must be < 1.');
      });

      it('Not whitelisted pool', async function () {
        const convertData = ConvertEncoder.convertCurveLPToBeans(to18('100'), to6('99'), this.fakeMetapool.address)
        await expect(beanstalk.connect(owner).convert(
          convertData,
          [],
          []
        )).to.be.revertedWith("Convert: Not a whitelisted Curve pool.")
      })
    });

    describe('below max', function () {
      beforeEach(async function () {
        await this.beanMetapool.connect(user).add_liquidity([to6('200'), to18('0')], to18('150'));
        await beanstalk.connect(user).deposit(this.beanMetapool.address, to18('1000'), EXTERNAL);
        this.stem = await beanstalk.stemTipForToken(this.beanMetapool.address);
        
        // call sunrise twice to finish germination. 
        await endGermination()
        await beanstalk.connect(owner).dewhitelistToken(this.beanMetapool.address);
      });

      it('it gets amount out', async function () {
        expect(await beanstalk.getAmountOut(
          BEAN_3_CURVE,
          BEAN,
          to18('100')
        )).to.be.equal('100618167')
      })

      describe('it converts', async function () {
        beforeEach(async function () {
          this.result = await beanstalk.connect(user).convert(
            ConvertEncoder.convertCurveLPToBeans(
              to18('100'), 
              to6('99'), 
              this.beanMetapool.address
            ), 
            [this.stem], 
            [to18('100')]
          )
          this.beanStem = 2012288
        });

        it('properly updates total values', async function () {
          expect(await beanstalk.getTotalDeposited(this.beanMetapool.address)).to.eq(to18('900'));
          expect(await beanstalk.getTotalDepositedBdv(this.beanMetapool.address)).to.eq(to6('900'));
          expect(await beanstalk.getGerminatingTotalDeposited(bean.address)).to.eq('100618167');
          expect(await beanstalk.getTotalDeposited(bean.address)).to.eq('0');
          expect(await beanstalk.getGerminatingTotalDepositedBdv(bean.address)).to.eq('100618167');
          expect(await beanstalk.getTotalDepositedBdv(bean.address)).to.eq('0');
          expect(await beanstalk.totalStalk()).to.eq(toStalk('900.2'));
          expect(await beanstalk.getTotalGerminatingStalk()).to.eq('1006181670000');
        });

        it('properly updates user values', async function () {
          expect(await beanstalk.balanceOfStalk(user.address)).to.eq(toStalk('900.2'));
          expect(await beanstalk.balanceOfGerminatingStalk(user.address)).to.eq('1006181670000');
        });

        it('properly updates user deposits', async function () {
          let deposit = await beanstalk.getDeposit(user.address, bean.address, this.beanStem);
          expect(deposit[0]).to.eq(to6('100.618167'));
          expect(deposit[1]).to.eq(to6('100.618167'));
          deposit = await beanstalk.getDeposit(user.address, this.beanMetapool.address, this.stem);
          expect(deposit[0]).to.eq(to18('900'));
          expect(deposit[1]).to.eq(to6('900'));
        });

        it('emits events', async function () {
          await expect(this.result).to.emit(beanstalk, 'RemoveDeposits')
            .withArgs(user.address, this.beanMetapool.address, [this.stem], [to18('100')], to18('100'), [to6('100')]);
          await expect(this.result).to.emit(beanstalk, 'AddDeposit')
            .withArgs(user.address, bean.address, this.beanStem, '100618167', '100618167');
        });
      });
    });

    describe('above max', function () {
      beforeEach(async function () {
        await this.beanMetapool.connect(user).add_liquidity([to6('200'), to18('0')], to18('150'));
        await beanstalk.connect(user).deposit(this.beanMetapool.address, to18('1000'), EXTERNAL);
        this.stem = await beanstalk.stemTipForToken(this.beanMetapool.address);
        
        // call sunrise twice to finish germination. 
        await endGermination()
        await beanstalk.connect(owner).dewhitelistToken(this.beanMetapool.address);
      });


      it('it gets amount out', async function () {
        expect(await beanstalk.getAmountOut(
          BEAN_3_CURVE,
          BEAN,
          '199185758314813528598',
        )).to.be.equal('200018189')
      })

      describe('it converts', async function () {
        beforeEach(async function () {
          this.result = await beanstalk.connect(user).convert(
            ConvertEncoder.convertCurveLPToBeans(
              to18('300'),
              to6('150'), 
              this.beanMetapool.address
            ), 
            [this.stem],
            [to18('300')]
          )
          this.beanStem = 2008324
        });

        it('properly updates total values', async function () {
          expect(await beanstalk.getGerminatingTotalDeposited(bean.address)).to.eq('200018189');
          expect(await beanstalk.getTotalDeposited(bean.address)).to.eq('0');
          expect(await beanstalk.getGerminatingTotalDepositedBdv(bean.address)).to.eq('200018189');
          expect(await beanstalk.getTotalDepositedBdv(bean.address)).to.eq('0');
          expect(await beanstalk.getTotalDeposited(this.beanMetapool.address)).to.eq('800814241685186471402');
          expect(await beanstalk.getTotalDepositedBdv(this.beanMetapool.address)).to.eq('800814241');
          expect(await beanstalk.totalStalk()).to.eq('8010142410000');
          expect(await beanstalk.getTotalGerminatingStalk()).to.eq('2000181890000');
        });

        it('properly updates user values', async function () {
          expect(await beanstalk.balanceOfStalk(user.address)).to.eq('8010142410000');
          expect(await beanstalk.balanceOfGerminatingStalk(user.address)).to.eq('2000181890000');

        });

        it('properly updates user deposits', async function () {
          let deposit = await beanstalk.getDeposit(user.address, bean.address, this.beanStem);
          expect(deposit[0]).to.eq('200018189');
          expect(deposit[1]).to.eq('200018189');
          deposit = await beanstalk.getDeposit(user.address, this.beanMetapool.address, this.stem);
          expect(deposit[0]).to.eq('800814241685186471402');
          expect(deposit[1]).to.eq('800814241');
        });

        it('emits events', async function () {
          await expect(this.result).to.emit(beanstalk, 'RemoveDeposits')
            .withArgs(user.address, this.beanMetapool.address, [this.stem], ['199185758314813528598'], '199185758314813528598', ['199185759']);
          await expect(this.result).to.emit(beanstalk, 'AddDeposit')
            .withArgs(user.address, bean.address, this.beanStem, '200018189', '200018189');
        });
      });
    });

    describe('multiple crates', function () {
      beforeEach(async function () {
        await this.beanMetapool.connect(user).add_liquidity([to6('200'), to18('0')], to18('150'));
        await beanstalk.connect(user).deposit(this.beanMetapool.address, to18('500'), EXTERNAL);
        this.stem = await beanstalk.stemTipForToken(this.beanMetapool.address);
        await mockBeanstalk.siloSunrise(0);
        await beanstalk.connect(user).deposit(this.beanMetapool.address, to18('500'), EXTERNAL);
        this.stem2 = await beanstalk.stemTipForToken(this.beanMetapool.address);

        // call sunrise twice to finish germination. 
        await endGermination()
        await beanstalk.connect(owner).dewhitelistToken(this.beanMetapool.address);
      });

      describe('it converts', async function () {
        beforeEach(async function () {
          this.result = await beanstalk.connect(user).convert(
            ConvertEncoder.convertCurveLPToBeans(
              to18('100'), 
              to6('99'), 
              this.beanMetapool.address), 
              [this.stem, this.stem2], 
              [to18('50'), to18('50')]
            )
          this.beanStem = 3515360;
        });

        it('properly updates total values', async function () {
          expect(await beanstalk.getTotalDeposited(bean.address)).to.eq('100618167');
          expect(await beanstalk.getTotalDepositedBdv(bean.address)).to.eq('100618167');
          expect(await beanstalk.getTotalDeposited(this.beanMetapool.address)).to.eq(to18('900'));
          expect(await beanstalk.getTotalDepositedBdv(this.beanMetapool.address)).to.eq(to6('900'));
          expect(await beanstalk.totalStalk()).to.eq('10008681670000');
        });

        it('properly updates user values', async function () {
          expect(await beanstalk.balanceOfStalk(user.address)).to.eq('10008681670000');
        });

        it('properly updates user deposits', async function () {
          expect((await beanstalk.getDeposit(user.address, bean.address, this.beanStem))[0]).to.eq('100618167');
          const deposit = await beanstalk.getDeposit(user.address, this.beanMetapool.address, this.stem);
          expect(deposit[0]).to.eq(to18('450'));
          expect(deposit[1]).to.eq(to6('450'));
        });

        it('emits events', async function () {
          await expect(this.result).to.emit(beanstalk, 'RemoveDeposits')
            .withArgs(user.address, this.beanMetapool.address, [this.stem, this.stem2], [to18('50'), to18('50')], to18('100'), [to6('50'), to6('50')]);
          await expect(this.result).to.emit(beanstalk, 'AddDeposit')
            .withArgs(user.address, bean.address, this.beanStem, '100618167', '100618167');
        });
      });
    });
  });
});
