const { expect } = require('chai')
const { ethers } = require('hardhat')
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL, INTERNAL } = require('./utils/balances.js')
const { BEAN, THREE_CURVE, THREE_POOL, BEAN_3_CURVE, STABLE_FACTORY, USDC } = require('./utils/constants')
const { to18, to6 } = require('./utils/helpers.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot")
const { testIfRpcSet } = require('./utils/test.js')
const { getAllBeanstalkContracts } = require("../utils/contracts");

let user,user2,owner;


async function reset() {
  await network.provider.request({
    method: "hardhat_reset",
    params: [{
        forking: {
          jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
          blockNumber: 15148000,
        },
      },],
  });
}

// curve tests are skipped as the curveFacet is removed.
describe.skip('Curve', function () {
  before(async function () {
    [owner,user,user2] = await ethers.getSigners()
    
    const contracts = await deploy(verbose = false, mock = true, reset = true)
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [ beanstalk, mockBeanstalk ] = await getAllBeanstalkContracts(this.diamond.address);


    bean = await ethers.getContractAt('Bean', BEAN)
    this.threeCurve = await ethers.getContractAt('MockToken', THREE_CURVE)
    this.threePool = await ethers.getContractAt('Mock3Curve', THREE_POOL)
    this.beanMetapool = await ethers.getContractAt('MockMeta3Curve', BEAN_3_CURVE)
    
    this.usdc = await ethers.getContractAt('IERC20', USDC)    

    await mockBeanstalk.siloSunrise(0)
    await bean.connect(user).approve(this.diamond.address, '100000000000')
    await bean.connect(user2).approve(this.diamond.address, '100000000000') 
    await bean.connect(user).approve(this.beanMetapool.address, '100000000000')
    await bean.mint(user.address, to6('10000'))
    await bean.mint(user2.address, to6('10000'))

    await this.threeCurve.mint(user.address, to18('1000'))
    await this.threePool.set_virtual_price(to18('1'))
    await this.threeCurve.connect(user).approve(this.beanMetapool.address, to18('100000000000'))

    await this.beanMetapool.set_A_precise('1000')
    await this.beanMetapool.set_virtual_price(ethers.utils.parseEther('1'))
    await this.beanMetapool.connect(user).approve(this.threeCurve.address, to18('100000000000'))
    await this.beanMetapool.connect(user).approve(this.diamond.address, to18('100000000000'))
    await this.threeCurve.connect(user).approve(this.diamond.address, to18('100000000000'))

    this.result = await beanstalk.connect(user).addLiquidity(
      BEAN_3_CURVE,
      STABLE_FACTORY,
      [to6('1000'), to18('1000')],
      to18('2000'),
      EXTERNAL,
      EXTERNAL
    )

  })

  beforeEach(async function () {
    snapshotId = await takeSnapshot()
  })

  afterEach(async function () {
    await revertToSnapshot(snapshotId)
  })

  describe("Add Liquidity", async function () {
    describe("To external", async function () {
      it('adds liquidity to pool', async function () {
        const balances = await this.beanMetapool.get_balances();
        expect(balances[0]).to.be.equal(to6('1000'));
        expect(balances[1]).to.be.equal(to18('1000'));
      })

      it('updates beanstalk balances', async function () {
        expect(await bean.balanceOf(beanstalk.address)).to.be.eq('0');
        expect(await this.threeCurve.balanceOf(beanstalk.address)).to.be.eq('0');
        expect(await this.beanMetapool.balanceOf(beanstalk.address)).to.be.eq('0');
      })

      it('adds lp tokens to external balance', async function () {
        expect(await beanstalk.getExternalBalance(user.address, this.beanMetapool.address)).to.be.equal(to18('2000'))
      })

      it('adds lp tokens to internal balance', async function () {
        expect(await beanstalk.getInternalBalance(user.address, this.beanMetapool.address)).to.be.equal(to18('0'))
      })
    })

    describe("To internal", async function () {
      beforeEach(async function () {
        await this.threeCurve.mint(user.address, to18('500'))
        this.result = await beanstalk.connect(user).addLiquidity(
            BEAN_3_CURVE,
            STABLE_FACTORY,
            [to6('500'), to18('500')],
            to18('1000'),
            EXTERNAL,
            INTERNAL
        );
      })

      it('adds liquidity to pool', async function () {
        const balances = await this.beanMetapool.get_balances();
        expect(balances[0]).to.be.equal(to6('1500'));
        expect(balances[1]).to.be.equal(to18('1500'));
      })

      it('updates beanstalk balances', async function () {
        expect(await bean.balanceOf(beanstalk.address)).to.be.eq('0');
        expect(await this.threeCurve.balanceOf(beanstalk.address)).to.be.eq('0');
        expect(await this.beanMetapool.balanceOf(beanstalk.address)).to.be.eq(to18('1000'));
      })

      it('adds lp tokens to external balance', async function () {
        expect(await beanstalk.getExternalBalance(user.address, this.beanMetapool.address)).to.be.equal(to18('2000'))
      })

      it('adds lp tokens to internal balance', async function () {
        expect(await beanstalk.getInternalBalance(user.address, this.beanMetapool.address)).to.be.equal(to18('1000'))
      })
    })
  })

  describe("Exchange", async function () {
    describe("To external", async function () {
      beforeEach(async function () {
        await beanstalk.connect(user2).exchange(
          this.beanMetapool.address,
          STABLE_FACTORY,
          bean.address,
          this.threeCurve.address,
          to6('10'),
          to18('9'),
          EXTERNAL,
          EXTERNAL
        )
      })

      it('adds liquidity to pool', async function () {
        const balances = await this.beanMetapool.get_balances();
        expect(balances[0]).to.be.equal(to6('1010'));
        expect(balances[1]).to.be.within(to18('990'), to18('99001'));
      })

      it('updates beanstalk balances', async function () {
        expect(await bean.balanceOf(beanstalk.address)).to.be.eq('0')
        expect(await this.threeCurve.balanceOf(beanstalk.address)).to.be.eq('0')
        expect(await this.beanMetapool.balanceOf(beanstalk.address)).to.be.eq('0')
      })

      it('adds lp tokens to internal balance', async function () {
        expect(await beanstalk.getInternalBalance(user2.address, this.threeCurve.address)).to.be.equal('0')
      })

      it('adds lp tokens to external balance', async function () {
        expect(await beanstalk.getExternalBalance(user2.address, this.threeCurve.address)).to.be.equal('9990916598540524929')
      })
    })

    describe("To internal", async function () {
      beforeEach(async function () {
        await beanstalk.connect(user2).exchange(
          this.beanMetapool.address,
          STABLE_FACTORY,
          bean.address,
          this.threeCurve.address,
          to6('10'),
          to18('9'),
          EXTERNAL,
          INTERNAL
        )
      })

      it('adds liquidity to pool', async function () {
        const balances = await this.beanMetapool.get_balances()
        expect(balances[0]).to.be.equal(to6('1010'))
        expect(balances[1]).to.be.equal('990009083401459475071')
      })

      it('updates beanstalk balances', async function () {
        expect(await bean.balanceOf(beanstalk.address)).to.be.eq('0')
        expect(await this.threeCurve.balanceOf(beanstalk.address)).to.be.eq('9990916598540524929')
        expect(await this.beanMetapool.balanceOf(beanstalk.address)).to.be.eq('0')
      })

      it('adds lp tokens to internal balance', async function () {
        expect(await beanstalk.getInternalBalance(user2.address, this.threeCurve.address)).to.be.equal('9990916598540524929')
      })

      it('adds lp tokens to external balance', async function () {
        expect(await beanstalk.getExternalBalance(user2.address, this.threeCurve.address)).to.be.equal('0')
      })
    })
  })

  describe("Remove Liqudity", async function () {
    describe("To external", async function () {
      beforeEach(async function () {
        await beanstalk.connect(user).removeLiquidity(
          this.beanMetapool.address,
          STABLE_FACTORY,
          to18('500'),
          [to6('250'), to18('250')],
          EXTERNAL,
          EXTERNAL
        )
      })

      it('adds liquidity to pool', async function () {
        const balances = await this.beanMetapool.get_balances();
        expect(balances[0]).to.be.equal(to6('750'));
        expect(balances[1]).to.be.equal(to18('750'))
      })

      it('updates beanstalk balances', async function () {
        expect(await bean.balanceOf(beanstalk.address)).to.be.eq('0')
        expect(await this.threeCurve.balanceOf(beanstalk.address)).to.be.eq('0')
        expect(await this.beanMetapool.balanceOf(beanstalk.address)).to.be.eq('0')
      })

      it('adds lp tokens to internal balance', async function () {
        expect(await beanstalk.getInternalBalance(user.address, this.threeCurve.address)).to.be.equal('0')
        expect(await beanstalk.getInternalBalance(user.address, bean.address)).to.be.equal('0')
      })

      it('adds lp tokens to external balance', async function () {
        expect(await beanstalk.getExternalBalance(user.address, this.threeCurve.address)).to.be.equal(to18('250'))
        expect(await beanstalk.getExternalBalance(user.address, bean.address)).to.be.equal(to6('9250'))
      })
    })

    describe("To internal", async function () {
      beforeEach(async function () {
        await beanstalk.connect(user).removeLiquidity(
          this.beanMetapool.address,
          STABLE_FACTORY,
          to18('500'),
          [to6('250'), to18('250')],
          EXTERNAL,
          INTERNAL
        )
      })

      it('adds liquidity to pool', async function () {
        const balances = await this.beanMetapool.get_balances();
        expect(balances[0]).to.be.equal(to6('750'));
        expect(balances[1]).to.be.equal(to18('750'))
      })

      it('updates beanstalk balances', async function () {
        expect(await bean.balanceOf(beanstalk.address)).to.be.eq(to6('250'))
        expect(await this.threeCurve.balanceOf(beanstalk.address)).to.be.eq(to18('250'))
        expect(await this.beanMetapool.balanceOf(beanstalk.address)).to.be.eq('0')
      })

      it('adds lp tokens to internal balance', async function () {
        expect(await beanstalk.getInternalBalance(user.address, this.threeCurve.address)).to.be.equal(to18('250'))
        expect(await beanstalk.getInternalBalance(user.address, bean.address)).to.be.equal(to6('250'))
      })

      it('adds lp tokens to external balance', async function () {
        expect(await beanstalk.getExternalBalance(user.address, this.threeCurve.address)).to.be.equal(to18('0'))
        expect(await beanstalk.getExternalBalance(user.address, bean.address)).to.be.equal(to6('9000'))
      })
    })
  })

  describe("Remove Liqudity Inbalance", async function () {
    describe("To external", async function () {
      beforeEach(async function () {
        await beanstalk.connect(user).removeLiquidityImbalance(
          this.beanMetapool.address,
          STABLE_FACTORY,
          [to6('400'), to18('100')],
          to18('510'),
          EXTERNAL,
          EXTERNAL
        )
      })

      it('adds liquidity to pool', async function () {
        const balances = await this.beanMetapool.get_balances();
        expect(balances[0]).to.be.equal(to6('600'))
        expect(balances[1]).to.be.equal(to18('900'))
      })

      it('updates beanstalk balances', async function () {
        expect(await bean.balanceOf(beanstalk.address)).to.be.eq('0')
        expect(await this.threeCurve.balanceOf(beanstalk.address)).to.be.eq('0')
        expect(await this.beanMetapool.balanceOf(beanstalk.address)).to.be.eq('0')
      })

      it('adds lp tokens to internal balance', async function () {
        expect(await beanstalk.getInternalBalance(user.address, this.threeCurve.address)).to.be.equal('0')
        expect(await beanstalk.getInternalBalance(user.address, bean.address)).to.be.equal('0')
      })

      it('adds lp tokens to external balance', async function () {
        expect(await beanstalk.getExternalBalance(user.address, this.threeCurve.address)).to.be.equal(to18('100'))
        expect(await beanstalk.getExternalBalance(user.address, bean.address)).to.be.equal(to6('9400'))
      })
    })

    describe("To internal", async function () {
      beforeEach(async function () {
        await beanstalk.connect(user).removeLiquidityImbalance(
          this.beanMetapool.address,
          STABLE_FACTORY,
          [to6('400'), to18('100')],
          to18('510'),
          EXTERNAL,
          INTERNAL
        )
      })

      it('adds liquidity to pool', async function () {
        const balances = await this.beanMetapool.get_balances();
        expect(balances[0]).to.be.equal(to6('600'))
        expect(balances[1]).to.be.equal(to18('900'))
      })

      it('updates beanstalk balances', async function () {
        expect(await bean.balanceOf(beanstalk.address)).to.be.eq(to6('400'))
        expect(await this.threeCurve.balanceOf(beanstalk.address)).to.be.eq(to18('100'))
        expect(await this.beanMetapool.balanceOf(beanstalk.address)).to.be.eq('0')
      })

      it('adds lp tokens to internal balance', async function () {
        expect(await beanstalk.getInternalBalance(user.address, this.threeCurve.address)).to.be.equal(to18('100'))
        expect(await beanstalk.getInternalBalance(user.address, bean.address)).to.be.equal(to6('400'))
      })

      it('adds lp tokens to external balance', async function () {
        expect(await beanstalk.getExternalBalance(user.address, this.threeCurve.address)).to.be.equal(to18('0'))
        expect(await beanstalk.getExternalBalance(user.address, bean.address)).to.be.equal(to6('9000'))
      })
    })
  })

  describe("Remove Liqudity one token", async function () {
    describe("To external", async function () {
      beforeEach(async function () {
        await beanstalk.connect(user).removeLiquidityOneToken(
          this.beanMetapool.address,
          STABLE_FACTORY,
          bean.address,
          to18('500'),
          to6('480'),
          EXTERNAL,
          EXTERNAL
        )
      })

      it('adds liquidity to pool', async function () {
        const balances = await this.beanMetapool.get_balances();
        expect(balances[0]).to.be.equal('508039761');
        expect(balances[1]).to.be.equal(to18('1000'))
      })

      it('updates beanstalk balances', async function () {
        expect(await bean.balanceOf(beanstalk.address)).to.be.eq('0')
        expect(await this.threeCurve.balanceOf(beanstalk.address)).to.be.eq('0')
        expect(await this.beanMetapool.balanceOf(beanstalk.address)).to.be.eq('0')
      })

      it('adds lp tokens to internal balance', async function () {
        expect(await beanstalk.getInternalBalance(user.address, this.threeCurve.address)).to.be.equal('0')
        expect(await beanstalk.getInternalBalance(user.address, bean.address)).to.be.equal('0')
      })

      it('adds lp tokens to external balance', async function () {
        expect(await beanstalk.getExternalBalance(user.address, this.threeCurve.address)).to.be.equal('0')
        expect(await beanstalk.getExternalBalance(user.address, bean.address)).to.be.equal('9491960239')
      })
    })

    describe("To internal", async function () {
      beforeEach(async function () {
        await beanstalk.connect(user).removeLiquidityOneToken(
          this.beanMetapool.address,
          STABLE_FACTORY,
          bean.address,
          to18('500'),
          to6('480'),
          EXTERNAL,
          INTERNAL
        )
      })

      it('adds liquidity to pool', async function () {
        const balances = await this.beanMetapool.get_balances();
        expect(balances[0]).to.be.equal('508039761');
        expect(balances[1]).to.be.equal(to18('1000'))
      })

      it('updates beanstalk balances', async function () {
        expect(await bean.balanceOf(beanstalk.address)).to.be.eq('491960239')
        expect(await this.threeCurve.balanceOf(beanstalk.address)).to.be.eq('0')
        expect(await this.beanMetapool.balanceOf(beanstalk.address)).to.be.eq('0')
      })

      it('adds lp tokens to internal balance', async function () {
        expect(await beanstalk.getInternalBalance(user.address, this.threeCurve.address)).to.be.equal('0')
        expect(await beanstalk.getInternalBalance(user.address, bean.address)).to.be.equal('491960239')
      })

      it('adds lp tokens to external balance', async function () {
        expect(await beanstalk.getExternalBalance(user.address, this.threeCurve.address)).to.be.equal('0')
        expect(await beanstalk.getExternalBalance(user.address, bean.address)).to.be.equal(to6('9000'))
      })
    })
  })

  // skipped due to curve dewhitelisting.
  describe.skip("farm LP and Deposit", async function () {
    beforeEach('add LP and Deposits', async function () {
      await mockBeanstalk.teleportSunrise(10);
      mockBeanstalk.deployStemsUpgrade();
      const addLiquidity = await beanstalk.interface.encodeFunctionData("addLiquidity", [
        BEAN_3_CURVE,
        STABLE_FACTORY,
        [to6('500'), to18('500')],
        to18('1000'),
        EXTERNAL,
        INTERNAL
      ])
      const deposit = await beanstalk.interface.encodeFunctionData('deposit', [
        this.beanMetapool.address, 
        to18('1000'),
        INTERNAL
      ])

      await this.threeCurve.mint(user2.address, to18('500'))
      await bean.mint(user2.address, to6('500'))
      await this.threeCurve.connect(user2).approve(beanstalk.address, to18('5000000'))
      await bean.connect(user2).approve(beanstalk.address, to6('50000000'))
      // psuedo whitelist for testing purposes 
      await mockBeanstalk.mockWhitelistToken(
        BEAN_3_CURVE,
        beanstalk.interface.getSighash('curveToBDV'),
        10000,
        to6('1')
      );
      await beanstalk.connect(user2).farm([addLiquidity, deposit])
      await beanstalk.dewhitelistToken(BEAN_3_CURVE)
    })

    it('add lp and deposit', async function () {
      const season = await this.seasonGetter.season()
      const stemBean = await mockBeanstalk.mockSeasonToStem(this.beanMetapool.address, season);
      const dep = await beanstalk.getDeposit(user2.address, this.beanMetapool.address, stemBean)
      expect(dep[0]).to.be.equal(to18('1000'))
      expect(dep[1]).to.be.equal(to6('1000'))
    })
  })
})