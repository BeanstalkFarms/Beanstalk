const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js');
const { getAltBeanstalk, getBean, getUsdc } = require('../utils/contracts.js');
const { mintBeans, mintUsdc } = require('../utils/mint.js');
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { BEAN, USDC, WETH } = require('./utils/constants');
const { TypeEncoder } = require('./utils/encoder.js');
const { to6, to18 } = require('./utils/helpers.js');
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");

let user,user2,owner;
let userAddress, ownerAddress, user2Address;
let timestamp;

async function getTimestamp() {
  return (await ethers.provider.getBlock('latest')).timestamp
}

async function getCumulative(amount) {
  return (await getTimepassed()).mul(amount)
}

async function getTimepassed() {
  return ethers.BigNumber.from(`${(await getTimestamp()) - timestamp}`)
}

describe('Well', function () {
  before(async function () {
    [owner,user,user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    typeParams = TypeEncoder.constantProductType()
    this.beanstalk = await getAltBeanstalk(contracts.beanstalkDiamond.address)
    this.bean = await getBean()
    this.usdc = await getUsdc()


    await this.bean.mint(user.address, to6('1000'))
    await this.bean.mint(user2.address, to6('1000'))
    await this.usdc.mint(user.address, to6('1000'))
    await this.usdc.mint(user2.address, to6('1000'))

    await this.bean.connect(user2).approve(this.beanstalk.address, to18('1'))
    await this.bean.connect(user).approve(this.beanstalk.address, to18('1'))
    await this.usdc.connect(user2).approve(this.beanstalk.address, to18('1'))
    await this.usdc.connect(user).approve(this.beanstalk.address, to18('1'))

    this.register = await this.beanstalk.connect(owner).registerWellType(0, [])

    wellId = await this.beanstalk.callStatic.buildWell([USDC, BEAN], '0', typeParams, ['USDC', 'BEAN'])
    well = {
      wellId: wellId, 
      tokens: [USDC, BEAN], 
      wellType: 0,
      typeData: '0x'
    }
    wellHash = await this.beanstalk.computeWellHash(well)
  
    buildWellResult = await this.beanstalk.buildWell([USDC, BEAN], '0', typeParams, ['USDC', 'BEAN'])
    this.lp = await ethers.getContractAt('WellERC20', wellId)
    await this.lp.connect(user).approve(this.beanstalk.address, to18('100000000'))
    await this.lp.connect(user2).approve(this.beanstalk.address, to18('100000000'))

    await this.beanstalk.connect(user2).addLiquidity(well, [to6('100'), to6('100')], to6('200'), EXTERNAL, EXTERNAL)
    timestamp = await getTimestamp();
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("Register Types", async function () {
    describe("Successfully registers type", async function () {
      it("type token", async function () {
        const wellSignature = await this.beanstalk.getWellTypeSignature('0')
        expect(wellSignature.length).to.be.equal(0)
        expect(await this.beanstalk.isWellTypeRegistered('0')).to.be.equal(true)
      })

      it("emits event", async function () {
        await expect(this.register).to.emit(this.beanstalk, 'RegisterWellType').withArgs(well.wellType, []);
      })
    })

    it('reverts if not owner', async function () {
      await expect(this.beanstalk.connect(user2).registerWellType(0, [])).to.be.revertedWith("LibDiamond: Must be contract owner")
    })

    it('reverts if already registered', async function () {
      await expect(this.beanstalk.connect(owner).registerWellType(0, ['yo'])).to.be.revertedWith("LibWell: Already registered")
    })
  })

  describe('Build Well', async function () {
    it('reverts if not alphabetical', async function () {
      await expect(this.beanstalk.buildWell([BEAN, USDC], '0', typeParams, ["BEAN", "USDC"])).to.be.revertedWith("LibWell: Tokens not alphabetical")
    })

    it('reverts if type data', async function () {
      await expect(this.beanstalk.buildWell([USDC, BEAN], '0', TypeEncoder.testType('1'), ["USDC", "BEAN"])).to.be.revertedWith("LibWell: Well not valid.")
    })
    
    it('sets well info', async function () {
      const wellInfo = await this.beanstalk.getWellInfo(wellId);
      expect(wellInfo.wellId).to.be.equal(wellId)
      expect(wellInfo.tokens[0]).to.be.equal(well.tokens[0])
      expect(wellInfo.tokens[1]).to.be.equal(well.tokens[1])
      expect(wellInfo.wellType).to.be.equal(well.wellType)
      expect(wellInfo.typeData).to.be.equal(well.typeData)

      const tokens = await this.beanstalk.getTokens(wellId)
      expect(tokens[0]).to.be.equal(well.tokens[0])
      expect(tokens[1]).to.be.equal(well.tokens[1])
    })

    it('adds the well to the index', async function () {
      expect(await this.beanstalk.getWellIdAtIndex('0')).to.be.equal(wellId)
    })

    it('sets the well hash', async function () {
      expect(await this.beanstalk.getWellHash(wellId)).to.be.equal(wellHash)
    })

    it('sets the well state', async function () {
      const state = await this.beanstalk.getWellState(wellId)
      expect(state.balances[0]).to.be.equal(to6('100'))
      expect(state.balances[1]).to.be.equal(to6('100'))
      expect(state.cumulativeBalances[0]).to.be.equal('0')
      expect(state.cumulativeBalances[1]).to.be.equal('0')
      expect(state.lastTimestamp).to.be.equal(await getTimestamp())

      const hashState = await this.beanstalk.getWellStateFromHash(wellHash)
      expect(hashState.balances[0]).to.be.equal(to6('100'))
      expect(hashState.balances[1]).to.be.equal(to6('100'))
      expect(hashState.cumulativeBalances[0]).to.be.equal('0')
      expect(hashState.cumulativeBalances[1]).to.be.equal('0')
      expect(hashState.lastTimestamp).to.be.equal(await getTimestamp())

      const balances = await this.beanstalk.getWellBalances(wellId)
      expect(balances[0]).to.be.equal(to6('100'))
      expect(balances[1]).to.be.equal(to6('100'))

      const cumulativeBalances = await this.beanstalk.getLastCumulativeBalances(wellId)
      expect(cumulativeBalances[0]).to.be.equal(to6('0'))
      expect(cumulativeBalances[1]).to.be.equal(to6('0'))

      expect(await this.beanstalk.getLastTimestamp(wellId)).to.be.equal(await getTimestamp())

      expect(await this.beanstalk.getK(wellId)).to.be.equal(to6('200'))
    })

    it('returns the whole well', async function () {
      const wholeWells = await Promise.all([
        this.beanstalk.getWell(wellId),
        this.beanstalk.getWellAtIndex(0)
      ])
      for (let i = 0; i < 2; i++) {
        const wholeWell = wholeWells[i]
        expect(wholeWell.info.wellId).to.be.equal(wellId)
        expect(wholeWell.info.tokens[0]).to.be.equal(well.tokens[0])
        expect(wholeWell.info.tokens[1]).to.be.equal(well.tokens[1])
        expect(wholeWell.info.wellType).to.be.equal(well.wellType)
        expect(wholeWell.info.typeData).to.be.equal(well.typeData)

        expect(wholeWell.state.balances[0]).to.be.equal(to6('100'))
        expect(wholeWell.state.balances[1]).to.be.equal(to6('100'))
        expect(wholeWell.state.cumulativeBalances[0]).to.be.equal('0')
        expect(wholeWell.state.cumulativeBalances[1]).to.be.equal('0')
        expect(wholeWell.state.lastTimestamp).to.be.equal(await getTimestamp())

        expect(wholeWell.lpSupply).to.be.equal(to6('200'))
      }
    })

    it('emits event', async function () {
      await expect(buildWellResult).to.emit(this.beanstalk, 'BuildWell').withArgs(well.wellId, well.tokens, well.wellType, well.typeData, wellHash);
    })

    it('sets the name/symbol of well token', async function () {
      expect(await this.lp.symbol()).to.be.equal("USDCBEANwl")
      expect(await this.lp.name()).to.be.equal("USDC:BEAN Well")
    })
  })

  describe('Modify Well', async function () {
    // TODO: Can't really test this with only 1 whitelisted invariant.
  })

  describe("Swap from", async function () {
    it("Gets amount out", async function () {
      expect(await this.beanstalk.getSwapOut(well, USDC, BEAN, to6('100'))).to.be.equal(to6('50'))
      expect(await this.beanstalk.getSwapOut(well, USDC, BEAN, to6('9900'))).to.be.equal(to6('99'))
    })

    it("reverts if max amount in too low", async function () {
      await expect(this.beanstalk.connect(user).swapFrom(well, USDC, BEAN, to6('100'), to6('51'), EXTERNAL, EXTERNAL)).to.be.revertedWith("LibWell: too much slippage.")
    })

    describe("Basic Swap", async function () {
      beforeEach(async function () {
        this.result = await this.beanstalk.connect(user).swapFrom(well, USDC, BEAN, to6('100'), to6('49'), EXTERNAL, EXTERNAL)
      })

      it("transfers assets", async function () {
        expect(await this.bean.balanceOf(user.address)).to.be.equal(to6('1050'))
        expect(await this.usdc.balanceOf(user.address)).to.be.equal(to6('900'))
      })

      it("updates state", async function () {
        const state = await this.beanstalk.getWellState(wellId)
        expect(state.balances[0]).to.be.equal(to6('200'))
        expect(state.balances[1]).to.be.equal(to6('50'))
        expect(state.cumulativeBalances[0]).to.be.equal(await getCumulative(to6('100')))
        expect(state.cumulativeBalances[1]).to.be.equal(await getCumulative(to6('100')))
        expect(state.lastTimestamp).to.be.equal(await getTimestamp())
        expect(await this.beanstalk.getK(wellId)).to.be.equal(to6('200'))
      })

      it('updates lp balances', async function () {
        expect(await this.lp.totalSupply()).to.be.equal(to6('200'))
        expect(await this.lp.balanceOf(user2.address)).to.be.equal(to6('200'))
      })

      it('emits event', async function () {
        await expect(this.result).to.emit(this.beanstalk, 'Swap').withArgs(wellId, USDC, BEAN, to6('100'), to6('50'));
      })
    })
  })

  describe("Swap to", async function () {
    it("Gets amount in", async function () {
      expect(await this.beanstalk.getSwapIn(well, USDC, BEAN, to6('50'))).to.be.equal(to6('100'))
      expect(await this.beanstalk.getSwapIn(well, USDC, BEAN, to6('99'))).to.be.equal(to6('9900'))
    })

    it("reverts if max amount in too low", async function () {
      await expect(this.beanstalk.connect(user).swapTo(well, USDC, BEAN, to6('99'), to6('50'), EXTERNAL, EXTERNAL)).to.be.revertedWith("LibWell: too much slippage.")
    })

    describe("Basic Swap", async function () {
      beforeEach(async function () {
        this.result = await this.beanstalk.connect(user).swapTo(well, USDC, BEAN, to6('101'), to6('50'), EXTERNAL, EXTERNAL)
      })

      it("transfers assets", async function () {
        expect(await this.bean.balanceOf(user.address)).to.be.equal(to6('1050'))
        expect(await this.usdc.balanceOf(user.address)).to.be.equal(to6('900'))
      })

      it("updates state", async function () {
        const state = await this.beanstalk.getWellState(wellId)
        expect(state.balances[0]).to.be.equal(to6('200'))
        expect(state.balances[1]).to.be.equal(to6('50'))
        expect(state.cumulativeBalances[0]).to.be.equal(await getCumulative(to6('100')))
        expect(state.cumulativeBalances[1]).to.be.equal(await getCumulative(to6('100')))
        expect(state.lastTimestamp).to.be.equal(await getTimestamp())
        expect(await this.beanstalk.getK(wellId)).to.be.equal(to6('200'))
      })

      it('updates lp balances', async function () {
        expect(await this.lp.totalSupply()).to.be.equal(to6('200'))
        expect(await this.lp.balanceOf(user2.address)).to.be.equal(to6('200'))
      })

      it('emits event', async function () {
        await expect(this.result).to.emit(this.beanstalk, 'Swap').withArgs(wellId, USDC, BEAN, to6('100'), to6('50'));
      })
    })
  })

  describe("Add liquidity", async function () {
    it("Gets amount out", async function () {
      expect(await this.beanstalk.getAddLiquidityOut(well, [to6('90'), to6('110')])).to.be.equal(to6('199.499686'))
    })

    it("reverts if amount out too low", async function () {
      await expect(this.beanstalk.connect(user).addLiquidity(well, [to6('90'), to6('110')], to6('200'), EXTERNAL, EXTERNAL)).to.be.revertedWith("LibWell: Not enough LP.")
    })


    describe("Basic", async function () {
      beforeEach(async function () {
        this.result = await this.beanstalk.connect(user).addLiquidity(well, [to6('90'), to6('110')], to6('199.499686'), EXTERNAL, EXTERNAL)
      })

      it("transfers assets", async function () {
        expect(await this.bean.balanceOf(user.address)).to.be.equal(to6('890'))
        expect(await this.usdc.balanceOf(user.address)).to.be.equal(to6('910'))
      })

      it("updates state", async function () {
        const state = await this.beanstalk.getWellState(wellId)
        expect(state.balances[0]).to.be.equal(to6('190'))
        expect(state.balances[1]).to.be.equal(to6('210'))
        expect(state.cumulativeBalances[0]).to.be.equal(await getCumulative(to6('100')))
        expect(state.cumulativeBalances[1]).to.be.equal(await getCumulative(to6('100')))
        expect(state.lastTimestamp).to.be.equal(await getTimestamp())

        expect(await this.beanstalk.getK(wellId)).to.be.equal(to6('399.499686'))
      })

      it('updates lp balances', async function () {
        expect(await this.lp.totalSupply()).to.be.equal(to6('399.499686'))
        expect(await this.lp.balanceOf(user.address)).to.be.equal(to6('199.499686'))
      })

      it('emits event', async function () {
        await expect(this.result).to.emit(this.beanstalk, 'AddLiquidity').withArgs(wellId, [to6('90'), to6('110')]);
      })
    })
  })

  describe("Remove liquidity", async function () {
    it("Gets amount out", async function () {
      const tokensOut = await this.beanstalk.getRemoveLiquidityOut(well, to6('10'))
      expect(tokensOut[0]).to.be.equal(to6('5'))
      expect(tokensOut[1]).to.be.equal(to6('5'))
    })

    it("reverts if amount out too low", async function () {
      await expect(this.beanstalk.connect(user2).removeLiquidity(well, to6('10'), [to6('6'), to6('5')], EXTERNAL, EXTERNAL)).to.be.revertedWith("LibWell: Not enough out.")
    })

    describe("Basic", async function () {
      beforeEach(async function () {
        this.result = await this.beanstalk.connect(user2).removeLiquidity(well, to6('10'), [to6('5'), to6('5')], EXTERNAL, EXTERNAL)
      })

      it("transfers assets", async function () {
        expect(await this.bean.balanceOf(user2.address)).to.be.equal(to6('905'))
        expect(await this.usdc.balanceOf(user2.address)).to.be.equal(to6('905'))
      })

      it("updates state", async function () {
        const state = await this.beanstalk.getWellState(wellId)
        expect(state.balances[0]).to.be.equal(to6('95'))
        expect(state.balances[1]).to.be.equal(to6('95'))
        expect(state.cumulativeBalances[0]).to.be.equal(await getCumulative(to6('100')))
        expect(state.cumulativeBalances[1]).to.be.equal(await getCumulative(to6('100')))
        expect(state.lastTimestamp).to.be.equal(await getTimestamp())

        expect(await this.beanstalk.getK(wellId)).to.be.equal(to6('190'))
      })

      it('updates lp balances', async function () {
        expect(await this.lp.totalSupply()).to.be.equal(to6('190'))
        expect(await this.lp.balanceOf(user2.address)).to.be.equal(to6('190'))
      })

      it('emits event', async function () {
        await expect(this.result).to.emit(this.beanstalk, 'RemoveLiquidity').withArgs(wellId, [to6('5'), to6('5')]);
      })
    })
  })

  describe("Remove liquidity one token", async function () {
    it("Gets amount out", async function () {
      expect(await this.beanstalk.getRemoveLiquidityOneTokenOut(well, BEAN, to6('10'))).to.be.equal(to6('9.75'))
    })

    it("reverts if amount out too low", async function () {
      await expect(this.beanstalk.connect(user2).removeLiquidityOneToken(well, BEAN, to6('10'), to6('10'), EXTERNAL, EXTERNAL)).to.be.revertedWith("LibWell: out too low.")
    })

    describe("Basic", async function () {
      beforeEach(async function () {
        this.result = await this.beanstalk.connect(user2).removeLiquidityOneToken(well, BEAN, to6('10'), to6('5'), EXTERNAL, EXTERNAL)
      })

      it("transfers assets", async function () {
        expect(await this.bean.balanceOf(user2.address)).to.be.equal(to6('909.75'))
        expect(await this.usdc.balanceOf(user2.address)).to.be.equal(to6('900'))
      })

      it("updates state", async function () {
        const state = await this.beanstalk.getWellState(wellId)
        expect(state.balances[0]).to.be.equal(to6('100'))
        expect(state.balances[1]).to.be.equal(to6('90.25'))
        expect(state.cumulativeBalances[0]).to.be.equal(await getCumulative(to6('100')))
        expect(state.cumulativeBalances[1]).to.be.equal(await getCumulative(to6('100')))
        expect(state.lastTimestamp).to.be.equal(await getTimestamp())

        expect(await this.beanstalk.getK(wellId)).to.be.equal(to6('190'))
      })

      it('updates lp balances', async function () {
        expect(await this.lp.totalSupply()).to.be.equal(to6('190'))
        expect(await this.lp.balanceOf(user2.address)).to.be.equal(to6('190'))
      })

      it('emits event', async function () {
        await expect(this.result).to.emit(this.beanstalk, 'RemoveLiquidityOneToken').withArgs(wellId, BEAN, to6('9.75'));
      })
    })
  })

  describe("Remove liquidity one token 2", async function () {
    describe("Basic", async function () {
      beforeEach(async function () {
        this.result = await this.beanstalk.connect(user2).removeLiquidityOneToken(well, USDC, to6('10'), to6('5'), EXTERNAL, EXTERNAL)
      })

      it("transfers assets", async function () {
        expect(await this.bean.balanceOf(user2.address)).to.be.equal(to6('900'))
        expect(await this.usdc.balanceOf(user2.address)).to.be.equal(to6('909.75'))
      })

      it("updates state", async function () {
        const state = await this.beanstalk.getWellState(wellId)
        expect(state.balances[0]).to.be.equal(to6('90.25'))
        expect(state.balances[1]).to.be.equal(to6('100'))
        expect(state.cumulativeBalances[0]).to.be.equal(await getCumulative(to6('100')))
        expect(state.cumulativeBalances[1]).to.be.equal(await getCumulative(to6('100')))
        expect(state.lastTimestamp).to.be.equal(await getTimestamp())

        expect(await this.beanstalk.getK(wellId)).to.be.equal(to6('190'))
      })

      it('updates lp balances', async function () {
        expect(await this.lp.totalSupply()).to.be.equal(to6('190'))
        expect(await this.lp.balanceOf(user2.address)).to.be.equal(to6('190'))
      })

      it('emits event', async function () {
        await expect(this.result).to.emit(this.beanstalk, 'RemoveLiquidityOneToken').withArgs(wellId, USDC, to6('9.75'));
      })
    })
  })

  describe("Remove liquidity imbalanced", async function () {
    it("Gets amount out", async function () {
      expect(await this.beanstalk.getRemoveLiquidityImbalancedIn(well, [to6('5'), to6('5')])).to.be.equal(to6('10'))
      expect(await this.beanstalk.getRemoveLiquidityImbalancedIn(well, [to6('4'), to6('5')])).to.be.equal(to6('9.002618'))
    })

    it("reverts if amount out too low", async function () {
      await expect(this.beanstalk.connect(user2).removeLiquidityImbalanced(well, to6('10'), [to6('5'), to6('6')], EXTERNAL, EXTERNAL)).to.be.revertedWith("LibWell: in too high.")
    })

    describe("Basic", async function () {
      beforeEach(async function () {
        this.result = await this.beanstalk.connect(user2).removeLiquidityImbalanced(well, to6('10'), [to6('4'), to6('5')], EXTERNAL, EXTERNAL)
      })

      it("transfers assets", async function () {
        expect(await this.bean.balanceOf(user2.address)).to.be.equal(to6('905'))
        expect(await this.usdc.balanceOf(user2.address)).to.be.equal(to6('904'))
      })

      it("updates state", async function () {
        const state = await this.beanstalk.getWellState(wellId)
        expect(state.balances[0]).to.be.equal(to6('96'))
        expect(state.balances[1]).to.be.equal(to6('95'))
        expect(state.cumulativeBalances[0]).to.be.equal(await getCumulative(to6('100')))
        expect(state.cumulativeBalances[1]).to.be.equal(await getCumulative(to6('100')))
        expect(state.lastTimestamp).to.be.equal(await getTimestamp())

        expect(await this.beanstalk.getK(wellId)).to.be.equal(to6('190.997382'))
      })

      it('updates lp balances', async function () {
        expect(await this.lp.totalSupply()).to.be.equal(to6('190.997382'))
        expect(await this.lp.balanceOf(user2.address)).to.be.equal(to6('190.997382'))
      })

      it('emits event', async function () {
        await expect(this.result).to.emit(this.beanstalk, 'RemoveLiquidity').withArgs(wellId, [to6('4'), to6('5')]);
      })
    })
  })
})