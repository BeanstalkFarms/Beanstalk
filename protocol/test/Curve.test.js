const { expect } = require('chai')
const { ethers } = require('hardhat')
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { BEAN, THREE_CURVE, THREE_POOL, BEAN_3_CURVE, STABLE_FACTORY, USDC } = require('./utils/constants')
const { to18, to6, toStalk } = require('./utils/helpers.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot")

let user,user2,owner;
let userAddress, ownerAddress, user2Address;

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

describe('Curve', function () {
  before(async function () {
    [owner,user,user2] = await ethers.getSigners()
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true)
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
    this.bean = await ethers.getContractAt('Bean', BEAN)
    this.threeCurve = await ethers.getContractAt('MockToken', THREE_CURVE)
    this.threePool = await ethers.getContractAt('Mock3Curve', THREE_POOL)
    this.beanMetapool = await ethers.getContractAt('MockMeta3Curve', BEAN_3_CURVE)
    this.curve = await ethers.getContractAt('CurveFacet', this.diamond.address)
    this.token = await ethers.getContractAt('TokenFacet', this.diamond.address)
    this.silo = await ethers.getContractAt('SiloFacet', this.diamond.address)
    this.farm = await ethers.getContractAt('FarmFacet', this.diamond.address)
    this.usdc = await ethers.getContractAt('IERC20', USDC)

    await this.season.siloSunrise(0)
    await this.bean.connect(user).approve(this.diamond.address, '100000000000')
    await this.bean.connect(user2).approve(this.diamond.address, '100000000000') 
    await this.bean.connect(user).approve(this.beanMetapool.address, '100000000000')
    await this.bean.mint(userAddress, to6('10000'))
    await this.bean.mint(user2Address, to6('10000'))

    await this.threeCurve.mint(userAddress, to18('1000'))
    await this.threePool.set_virtual_price(to18('1'))
    await this.threeCurve.connect(user).approve(this.beanMetapool.address, to18('100000000000'))

    await this.beanMetapool.set_A_precise('1000')
    await this.beanMetapool.set_virtual_price(ethers.utils.parseEther('1'))
    await this.beanMetapool.connect(user).approve(this.threeCurve.address, to18('100000000000'))
    await this.beanMetapool.connect(user).approve(this.diamond.address, to18('100000000000'))
    await this.threeCurve.connect(user).approve(this.diamond.address, to18('100000000000'))

    this.result = await this.curve.connect(user).addLiquidity(
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
        expect(await this.bean.balanceOf(this.token.address)).to.be.eq('0');
        expect(await this.threeCurve.balanceOf(this.token.address)).to.be.eq('0');
        expect(await this.beanMetapool.balanceOf(this.token.address)).to.be.eq('0');
      })

      it('adds lp tokens to external balance', async function () {
        expect(await this.token.getExternalBalance(userAddress, this.beanMetapool.address)).to.be.equal(to18('2000'))
      })

      it('adds lp tokens to internal balance', async function () {
        expect(await this.token.getInternalBalance(userAddress, this.beanMetapool.address)).to.be.equal(to18('0'))
      })
    })

    describe("To internal", async function () {
      beforeEach(async function () {
        await this.threeCurve.mint(userAddress, to18('500'))
        this.result = await this.curve.connect(user).addLiquidity(
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
        expect(await this.bean.balanceOf(this.token.address)).to.be.eq('0');
        expect(await this.threeCurve.balanceOf(this.token.address)).to.be.eq('0');
        expect(await this.beanMetapool.balanceOf(this.token.address)).to.be.eq(to18('1000'));
      })

      it('adds lp tokens to external balance', async function () {
        expect(await this.token.getExternalBalance(userAddress, this.beanMetapool.address)).to.be.equal(to18('2000'))
      })

      it('adds lp tokens to internal balance', async function () {
        expect(await this.token.getInternalBalance(userAddress, this.beanMetapool.address)).to.be.equal(to18('1000'))
      })
    })
  })

  describe("Exchange", async function () {
    describe("To external", async function () {
      beforeEach(async function () {
        await this.curve.connect(user2).exchange(
          this.beanMetapool.address,
          STABLE_FACTORY,
          this.bean.address,
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
        expect(await this.bean.balanceOf(this.token.address)).to.be.eq('0')
        expect(await this.threeCurve.balanceOf(this.token.address)).to.be.eq('0')
        expect(await this.beanMetapool.balanceOf(this.token.address)).to.be.eq('0')
      })

      it('adds lp tokens to internal balance', async function () {
        expect(await this.token.getInternalBalance(user2Address, this.threeCurve.address)).to.be.equal('0')
      })

      it('adds lp tokens to external balance', async function () {
        expect(await this.token.getExternalBalance(user2Address, this.threeCurve.address)).to.be.equal('9990916598540524929')
      })
    })

    describe("To internal", async function () {
      beforeEach(async function () {
        await this.curve.connect(user2).exchange(
          this.beanMetapool.address,
          STABLE_FACTORY,
          this.bean.address,
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
        expect(await this.bean.balanceOf(this.token.address)).to.be.eq('0')
        expect(await this.threeCurve.balanceOf(this.token.address)).to.be.eq('9990916598540524929')
        expect(await this.beanMetapool.balanceOf(this.token.address)).to.be.eq('0')
      })

      it('adds lp tokens to internal balance', async function () {
        expect(await this.token.getInternalBalance(user2Address, this.threeCurve.address)).to.be.equal('9990916598540524929')
      })

      it('adds lp tokens to external balance', async function () {
        expect(await this.token.getExternalBalance(user2Address, this.threeCurve.address)).to.be.equal('0')
      })
    })
  })

  describe("Remove Liqudity", async function () {
    describe("To external", async function () {
      beforeEach(async function () {
        await this.curve.connect(user).removeLiquidity(
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
        expect(await this.bean.balanceOf(this.token.address)).to.be.eq('0')
        expect(await this.threeCurve.balanceOf(this.token.address)).to.be.eq('0')
        expect(await this.beanMetapool.balanceOf(this.token.address)).to.be.eq('0')
      })

      it('adds lp tokens to internal balance', async function () {
        expect(await this.token.getInternalBalance(userAddress, this.threeCurve.address)).to.be.equal('0')
        expect(await this.token.getInternalBalance(userAddress, this.bean.address)).to.be.equal('0')
      })

      it('adds lp tokens to external balance', async function () {
        expect(await this.token.getExternalBalance(userAddress, this.threeCurve.address)).to.be.equal(to18('250'))
        expect(await this.token.getExternalBalance(userAddress, this.bean.address)).to.be.equal(to6('9250'))
      })
    })

    describe("To internal", async function () {
      beforeEach(async function () {
        await this.curve.connect(user).removeLiquidity(
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
        expect(await this.bean.balanceOf(this.token.address)).to.be.eq(to6('250'))
        expect(await this.threeCurve.balanceOf(this.token.address)).to.be.eq(to18('250'))
        expect(await this.beanMetapool.balanceOf(this.token.address)).to.be.eq('0')
      })

      it('adds lp tokens to internal balance', async function () {
        expect(await this.token.getInternalBalance(userAddress, this.threeCurve.address)).to.be.equal(to18('250'))
        expect(await this.token.getInternalBalance(userAddress, this.bean.address)).to.be.equal(to6('250'))
      })

      it('adds lp tokens to external balance', async function () {
        expect(await this.token.getExternalBalance(userAddress, this.threeCurve.address)).to.be.equal(to18('0'))
        expect(await this.token.getExternalBalance(userAddress, this.bean.address)).to.be.equal(to6('9000'))
      })
    })
  })

  describe("Remove Liqudity Inbalance", async function () {
    describe("To external", async function () {
      beforeEach(async function () {
        await this.curve.connect(user).removeLiquidityImbalance(
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
        expect(await this.bean.balanceOf(this.token.address)).to.be.eq('0')
        expect(await this.threeCurve.balanceOf(this.token.address)).to.be.eq('0')
        expect(await this.beanMetapool.balanceOf(this.token.address)).to.be.eq('0')
      })

      it('adds lp tokens to internal balance', async function () {
        expect(await this.token.getInternalBalance(userAddress, this.threeCurve.address)).to.be.equal('0')
        expect(await this.token.getInternalBalance(userAddress, this.bean.address)).to.be.equal('0')
      })

      it('adds lp tokens to external balance', async function () {
        expect(await this.token.getExternalBalance(userAddress, this.threeCurve.address)).to.be.equal(to18('100'))
        expect(await this.token.getExternalBalance(userAddress, this.bean.address)).to.be.equal(to6('9400'))
      })
    })

    describe("To internal", async function () {
      beforeEach(async function () {
        await this.curve.connect(user).removeLiquidityImbalance(
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
        expect(await this.bean.balanceOf(this.token.address)).to.be.eq(to6('400'))
        expect(await this.threeCurve.balanceOf(this.token.address)).to.be.eq(to18('100'))
        expect(await this.beanMetapool.balanceOf(this.token.address)).to.be.eq('0')
      })

      it('adds lp tokens to internal balance', async function () {
        expect(await this.token.getInternalBalance(userAddress, this.threeCurve.address)).to.be.equal(to18('100'))
        expect(await this.token.getInternalBalance(userAddress, this.bean.address)).to.be.equal(to6('400'))
      })

      it('adds lp tokens to external balance', async function () {
        expect(await this.token.getExternalBalance(userAddress, this.threeCurve.address)).to.be.equal(to18('0'))
        expect(await this.token.getExternalBalance(userAddress, this.bean.address)).to.be.equal(to6('9000'))
      })
    })
  })

  describe("Remove Liqudity one token", async function () {
    describe("To external", async function () {
      beforeEach(async function () {
        await this.curve.connect(user).removeLiquidityOneToken(
          this.beanMetapool.address,
          STABLE_FACTORY,
          this.bean.address,
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
        expect(await this.bean.balanceOf(this.token.address)).to.be.eq('0')
        expect(await this.threeCurve.balanceOf(this.token.address)).to.be.eq('0')
        expect(await this.beanMetapool.balanceOf(this.token.address)).to.be.eq('0')
      })

      it('adds lp tokens to internal balance', async function () {
        expect(await this.token.getInternalBalance(userAddress, this.threeCurve.address)).to.be.equal('0')
        expect(await this.token.getInternalBalance(userAddress, this.bean.address)).to.be.equal('0')
      })

      it('adds lp tokens to external balance', async function () {
        expect(await this.token.getExternalBalance(userAddress, this.threeCurve.address)).to.be.equal('0')
        expect(await this.token.getExternalBalance(userAddress, this.bean.address)).to.be.equal('9491960239')
      })
    })

    describe("To internal", async function () {
      beforeEach(async function () {
        await this.curve.connect(user).removeLiquidityOneToken(
          this.beanMetapool.address,
          STABLE_FACTORY,
          this.bean.address,
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
        expect(await this.bean.balanceOf(this.token.address)).to.be.eq('491960239')
        expect(await this.threeCurve.balanceOf(this.token.address)).to.be.eq('0')
        expect(await this.beanMetapool.balanceOf(this.token.address)).to.be.eq('0')
      })

      it('adds lp tokens to internal balance', async function () {
        expect(await this.token.getInternalBalance(userAddress, this.threeCurve.address)).to.be.equal('0')
        expect(await this.token.getInternalBalance(userAddress, this.bean.address)).to.be.equal('491960239')
      })

      it('adds lp tokens to external balance', async function () {
        expect(await this.token.getExternalBalance(userAddress, this.threeCurve.address)).to.be.equal('0')
        expect(await this.token.getExternalBalance(userAddress, this.bean.address)).to.be.equal(to6('9000'))
      })
    })
  })

  describe("farm LP and Deposit", async function () {
    beforeEach('add LP and Deposits', async function () {
      await this.season.teleportSunrise(10);
      this.season.deployStemsUpgrade();
      const addLiquidity = await this.curve.interface.encodeFunctionData("addLiquidity", [
        BEAN_3_CURVE,
        STABLE_FACTORY,
        [to6('500'), to18('500')],
        to18('1000'),
        EXTERNAL,
        INTERNAL
      ])
      const deposit = await this.silo.interface.encodeFunctionData('deposit', [
        this.beanMetapool.address, 
        to18('1000'), 
        INTERNAL
      ])

      await this.threeCurve.mint(user2Address, to18('500'))
      await this.bean.mint(user2Address, to6('500'))
      await this.threeCurve.connect(user2).approve(this.silo.address, to18('5000000'))
      await this.bean.connect(user2).approve(this.silo.address, to6('50000000'))

      await this.farm.connect(user2).farm([addLiquidity, deposit])
    })

    it('add lp and deposit', async function () {
      const season = await this.season.season()
      const stemBean = await this.silo.seasonToStem(this.beanMetapool.address, season);
      const dep = await this.silo.getDeposit(user2Address, this.beanMetapool.address, stemBean)
      expect(dep[0]).to.be.equal(to18('1000'))
      expect(dep[1]).to.be.equal(to6('1000'))
    })
  })
})