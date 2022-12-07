const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js');
const { getAltBeanstalk, getBean, getUsdc, getWeth } = require('../utils/contracts.js');
const { mintBeans, mintUsdc } = require('../utils/mint.js');
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { BEAN, USDC, WETH, ZERO_ADDRESS } = require('./utils/constants');
const { WellFunctionEncoder } = require('./utils/encoder.js');
const { to6, to18 } = require('./utils/helpers.js');
const { getEma } = require('./utils/ema.js');
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { toBN } = require('../utils/index.js');
const { readEmaAlpha } = require('../utils/read.js');
const { deployContract } = require('../scripts/contracts.js');

let user,user2,owner;
let timestamp;

async function getTimestamp() {
  return (await ethers.provider.getBlock('latest')).timestamp
}

async function getBlockNumber() {
  return (await ethers.provider.getBlock('latest')).number
}

async function fastForward(seconds = 1000) {
  // await network.provider.send("evm_increaseTime", [seconds])
  await network.provider.send("evm_setNextBlockTimestamp", [(await getTimestamp()) + seconds])
}

async function getCumulative(amount) {
  return (await getTimepassed()).mul(amount)
}

async function getTimepassed() {
  return ethers.BigNumber.from(`${(await getTimestamp()) - timestamp}`)
}

describe('N Token Well', function () {
  before(async function () {
    [owner,user,user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;

    this.beanstalk = await getAltBeanstalk(contracts.beanstalkDiamond.address)
    this.bean = await getBean()
    this.usdc = await getUsdc()
    this.weth = await ethers.getContractAt('MockWETH', WETH);

    A = toBN(await readEmaAlpha())

    await this.bean.mint(user.address, to6('1000'))
    await this.bean.mint(user2.address, to6('100000'))
    await this.usdc.mint(user.address, to6('1000'))
    await this.usdc.mint(user2.address, to6('100000'))
    await this.weth.mint(user.address, to6('1000'))
    await this.weth.mint(user2.address, to6('100000'))

    await this.bean.connect(user2).approve(this.beanstalk.address, to18('1'))
    await this.bean.connect(user).approve(this.beanstalk.address, to18('1'))
    await this.usdc.connect(user2).approve(this.beanstalk.address, to18('1'))
    await this.usdc.connect(user).approve(this.beanstalk.address, to18('1'))
    await this.weth.connect(user2).approve(this.beanstalk.address, to18('1'))
    await this.weth.connect(user).approve(this.beanstalk.address, to18('1'))

    constantProduct = await deployContract("ConstantProduct", owner)
    wellFunction = WellFunctionEncoder.basicEncoder(constantProduct.address)

    this.pumps = []

    wellId = await this.beanstalk.callStatic.buildWell(wellFunction, [USDC, BEAN, WETH], ['USDC', 'BEAN', 'WETH'], [6,6,18], this.pumps)
    well = {
      wellId: wellId,
      wellFunction: WellFunctionEncoder.basicEncoder(constantProduct.address),
      tokens: [USDC, BEAN, WETH],
      decimalData: await this.beanstalk.encodeWellDecimalData([6,6,18]),
      pumps: this.pumps
    }
    wellHash = await this.beanstalk.computeWellHash(well)
    buildWellResult = await this.beanstalk.buildWell(wellFunction, [USDC, BEAN, WETH], ['USDC', 'BEAN', 'WETH'], [6,6,18], this.pumps)

    this.lp = await ethers.getContractAt('WellToken', wellId)
    await this.lp.connect(user).approve(this.beanstalk.address, to18('100000000'))
    await this.lp.connect(user2).approve(this.beanstalk.address, to18('100000000'))

    await this.beanstalk.connect(user2).addLiquidity(well, [to6('100'), to6('100'), to6('100')], to6('200'), EXTERNAL, EXTERNAL)
    timestamp = await getTimestamp();
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe('Build Well', async function () {
    it('reverts if not alphabetical', async function () {
      await expect(this.beanstalk.buildWell(wellFunction, [USDC, WETH, BEAN], ['USDC',  'WETH', 'BEAN'], [6,6,18], this.pumps)).to.be.revertedWith("LibWell: Tokens not alphabetical")
    })

    it('reverts if type data', async function () {
      await expect(this.beanstalk.buildWell(ZERO_ADDRESS, [USDC, BEAN, WETH], ['USDC', 'BEAN', 'WETH'], [6,6,18], this.pumps)).to.be.reverted
    })
    
    it('sets well info', async function () {
      const wellInfo = await this.beanstalk.getWellInfo(wellId);
      expect(wellInfo.wellId).to.be.equal(wellId)
      expect(wellInfo.tokens[0]).to.be.equal(well.tokens[0])
      expect(wellInfo.tokens[1]).to.be.equal(well.tokens[1])
      expect(wellInfo.tokens[2]).to.be.equal(well.tokens[2])
      expect(wellInfo.decimalData).to.be.equal(well.decimalData)

      const tokens = await this.beanstalk.getTokens(wellId)
      expect(tokens[0]).to.be.equal(well.tokens[0])
      expect(tokens[1]).to.be.equal(well.tokens[1])
      expect(tokens[2]).to.be.equal(well.tokens[2])
    })

    it('adds the well to the index', async function () {
      expect(await this.beanstalk.getWellIdAtIndex('0')).to.be.equal(wellId)
    })

    it('sets the well hash', async function () {
      expect(await this.beanstalk.getWellHash(wellId)).to.be.equal(wellHash)
    })

    it('sets the well state', async function () {
      const balances = await this.beanstalk.getWellBalances(wellId)
      expect(balances[0]).to.be.equal(to6('100'))
      expect(balances[1]).to.be.equal(to6('100'))
      expect(balances[2]).to.be.equal(to6('100'))
      expect(await this.beanstalk.getWellBlockNumber(wellId)).to.be.equal(await getBlockNumber())

      expect(await this.beanstalk.getWellTokenSupply(wellId)).to.be.equal(to6('300'))
    })

    it('returns the whole well', async function () {
      const wholeWells = await Promise.all([
        this.beanstalk.getWell(wellId),
        this.beanstalk.getWellAtIndex(0)
      ])
      for (let i = 0; i < 2; i++) {
        const wholeWell = wholeWells[i]
        expect(wholeWell[0].wellId).to.be.equal(wellId)
        expect(wholeWell[0].tokens[0]).to.be.equal(well.tokens[0])
        expect(wholeWell[0].tokens[1]).to.be.equal(well.tokens[1])
        expect(wholeWell[0].tokens[2]).to.be.equal(well.tokens[2])
        expect(wholeWell[0].decimalData).to.be.equal(well.decimalData)

        expect(wholeWell.balances[0]).to.be.equal(to6('100'))
        expect(wholeWell.balances[1]).to.be.equal(to6('100'))
        expect(wholeWell.balances[2]).to.be.equal(to6('100'))
        expect(wholeWell.lastBlockNumber).to.be.equal(await getBlockNumber())

        expect(wholeWell.totalSupply).to.be.equal(to6('300'))
      }
    })

    it('emits event', async function () {
      await expect(buildWellResult).to.emit(this.beanstalk, 'BuildWell').withArgs(well.wellId, well.wellFunction, well.tokens, well.decimalData, well.pumps, wellHash);
    })

    it('sets the name/symbol of well token', async function () {
      expect(await this.lp.symbol()).to.be.equal("USDCBEANWETHwl")
      expect(await this.lp.name()).to.be.equal("USDC:BEAN:WETH Well")
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
        const balances = await this.beanstalk.getWellBalances(wellId)
        expect(balances[0]).to.be.equal(to6('200'))
        expect(balances[1]).to.be.equal(to6('50'))
        expect(balances[2]).to.be.equal(to6('100'))
        expect(await this.beanstalk.getWellBlockNumber(wellId)).to.be.equal(await getBlockNumber())
        expect(await this.beanstalk.getWellTokenSupply(wellId)).to.be.equal(to6('300'))
      })

      it('updates lp balances', async function () {
        expect(await this.lp.totalSupply()).to.be.equal(to6('300'))
        expect(await this.lp.balanceOf(user2.address)).to.be.equal(to6('300'))
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
        const balances = await this.beanstalk.getWellBalances(wellId)
        expect(balances[0]).to.be.equal(to6('200'))
        expect(balances[1]).to.be.equal(to6('50'))
        expect(balances[2]).to.be.equal(to6('100'))
        expect(await this.beanstalk.getWellBlockNumber(wellId)).to.be.equal(await getBlockNumber())
        expect(await this.beanstalk.getWellTokenSupply(wellId)).to.be.equal(to6('300'))
      })

      it('updates lp balances', async function () {
        expect(await this.lp.totalSupply()).to.be.equal(to6('300'))
        expect(await this.lp.balanceOf(user2.address)).to.be.equal(to6('300'))
      })

      it('emits event', async function () {
        await expect(this.result).to.emit(this.beanstalk, 'Swap').withArgs(wellId, USDC, BEAN, to6('100'), to6('50'));
      })
    })
  })

  describe("Add liquidity", async function () {
    it("Gets amount out", async function () {
      expect(await this.beanstalk.getAddLiquidityOut(well, [to6('90'), to6('110'), '0'])).to.be.equal(to6('175.823133'))
    })

    it("reverts if amount out too low", async function () {
      await expect(this.beanstalk.connect(user).addLiquidity(well, [to6('90'), to6('110'), '0'], to6('200'), EXTERNAL, EXTERNAL)).to.be.revertedWith("LibWell: Not enough LP.")
    })


    describe("Basic", async function () {
      beforeEach(async function () {
        this.result = await this.beanstalk.connect(user).addLiquidity(well, [to6('90'), to6('110'), '0'], to6('175'), EXTERNAL, EXTERNAL)
      })

      it("transfers assets", async function () {
        expect(await this.bean.balanceOf(user.address)).to.be.equal(to6('890'))
        expect(await this.usdc.balanceOf(user.address)).to.be.equal(to6('910'))
      })

      it("updates state", async function () {
        const balances = await this.beanstalk.getWellBalances(wellId)
        expect(balances[0]).to.be.equal(to6('190'))
        expect(balances[1]).to.be.equal(to6('210'))
        expect(balances[2]).to.be.equal(to6('100'))
        expect(await this.beanstalk.getWellBlockNumber(wellId)).to.be.equal(await getBlockNumber())
        expect(await this.beanstalk.getWellTokenSupply(wellId)).to.be.equal(to6('475.823133'))
      })

      it('updates lp balances', async function () {
        expect(await this.lp.totalSupply()).to.be.equal(to6('475.823133'))
        expect(await this.lp.balanceOf(user.address)).to.be.equal(to6('175.823133'))
      })

      it('emits event', async function () {
        await expect(this.result).to.emit(this.beanstalk, 'AddLiquidity').withArgs(wellId, [to6('90'), to6('110'), '0']);
      })
    })
  })

  describe("Remove liquidity", async function () {
    it("Gets amount out", async function () {
      const tokensOut = await this.beanstalk.getRemoveLiquidityOut(well, to6('15'))
      expect(tokensOut[0]).to.be.equal(to6('5'))
      expect(tokensOut[1]).to.be.equal(to6('5'))
      expect(tokensOut[2]).to.be.equal(to6('5'))
    })

    it("reverts if amount out too low", async function () {
      await expect(this.beanstalk.connect(user2).removeLiquidity(well, to6('10'), [to6('6'), to6('5'), to6('5')], EXTERNAL, EXTERNAL)).to.be.revertedWith("LibWell: Not enough out.")
    })

    describe("Basic", async function () {
      beforeEach(async function () {
        this.result = await this.beanstalk.connect(user2).removeLiquidity(well, to6('15'), [to6('5'), to6('5'), to6('5')], EXTERNAL, EXTERNAL)
      })

      it("transfers assets", async function () {
        expect(await this.bean.balanceOf(user2.address)).to.be.equal(to6('99905'))
        expect(await this.usdc.balanceOf(user2.address)).to.be.equal(to6('99905'))
        expect(await this.weth.balanceOf(user2.address)).to.be.equal(to6('99905'))
      })

      it("updates state", async function () {
        const balances = await this.beanstalk.getWellBalances(wellId)
        expect(balances[0]).to.be.equal(to6('95'))
        expect(balances[1]).to.be.equal(to6('95'))
        expect(balances[2]).to.be.equal(to6('95'))
        expect(await this.beanstalk.getWellBlockNumber(wellId)).to.be.equal(await getBlockNumber())
        expect(await this.beanstalk.getWellTokenSupply(wellId)).to.be.equal(to6('285'))
      })

      it('updates lp balances', async function () {
        expect(await this.lp.totalSupply()).to.be.equal(to6('285'))
        expect(await this.lp.balanceOf(user2.address)).to.be.equal(to6('285'))
      })

      it('emits event', async function () {
        await expect(this.result).to.emit(this.beanstalk, 'RemoveLiquidity').withArgs(wellId, [to6('5'), to6('5'), to6('5')]);
      })
    })
  })

  describe("Remove liquidity one token", async function () {
    it("Gets amount out", async function () {
      expect(await this.beanstalk.getRemoveLiquidityOneTokenOut(well, BEAN, to6('10'))).to.be.equal(to6('9.670373'))
    })

    it("reverts if amount out too low", async function () {
      await expect(this.beanstalk.connect(user2).removeLiquidityOneToken(well, BEAN, to6('10'), to6('10'), EXTERNAL, EXTERNAL)).to.be.revertedWith("LibWell: out too low.")
    })

    describe("Basic", async function () {
      beforeEach(async function () {
        this.result = await this.beanstalk.connect(user2).removeLiquidityOneToken(well, BEAN, to6('10'), to6('5'), EXTERNAL, EXTERNAL)
      })

      it("transfers assets", async function () {
        expect(await this.bean.balanceOf(user2.address)).to.be.equal(to6('99909.670373'))
        expect(await this.usdc.balanceOf(user2.address)).to.be.equal(to6('99900'))
      })

      it("updates state", async function () {
        const balances = await this.beanstalk.getWellBalances(wellId)
        expect(balances[0]).to.be.equal(to6('100'))
        expect(balances[1]).to.be.equal(to6('90.329627'))
        expect(balances[2]).to.be.equal(to6('100'))
        expect(await this.beanstalk.getWellBlockNumber(wellId)).to.be.equal(await getBlockNumber())
        expect(await this.beanstalk.getWellTokenSupply(wellId)).to.be.equal(to6('290'))
      })

      it('updates lp balances', async function () {
        expect(await this.lp.totalSupply()).to.be.equal(to6('290'))
        expect(await this.lp.balanceOf(user2.address)).to.be.equal(to6('290'))
      })

      it('emits event', async function () {
        await expect(this.result).to.emit(this.beanstalk, 'RemoveLiquidityOneToken').withArgs(wellId, BEAN, to6('9.670373'));
      })
    })
  })

  describe("Remove liquidity imbalanced", async function () {
    it("Gets amount out", async function () {
      expect(await this.beanstalk.getRemoveLiquidityImbalancedIn(well, [to6('5'), to6('5'), to6('5')])).to.be.equal(to6('15'))
      expect(await this.beanstalk.getRemoveLiquidityImbalancedIn(well, [to6('4'), to6('5'), to6('5')])).to.be.equal(to6('14.003487'))
    })

    it("reverts if amount out too low", async function () {
      await expect(this.beanstalk.connect(user2).removeLiquidityImbalanced(well, to6('10'), [to6('5'), to6('5'), to6('5')], EXTERNAL, EXTERNAL)).to.be.revertedWith("LibWell: in too high.")
    })

    describe("Basic", async function () {
      beforeEach(async function () {
        this.result = await this.beanstalk.connect(user2).removeLiquidityImbalanced(well, to6('15'), [to6('4'), to6('5'), to6('5')], EXTERNAL, EXTERNAL)
      })

      it("transfers assets", async function () {
        expect(await this.bean.balanceOf(user2.address)).to.be.equal(to6('99905'))
        expect(await this.usdc.balanceOf(user2.address)).to.be.equal(to6('99904'))
      })

      it("updates state", async function () {
        const balances = await this.beanstalk.getWellBalances(wellId)
        expect(balances[0]).to.be.equal(to6('96'))
        expect(balances[1]).to.be.equal(to6('95'))
        expect(balances[2]).to.be.equal(to6('95'))
        expect(await this.beanstalk.getWellBlockNumber(wellId)).to.be.equal(await getBlockNumber())
        expect(await this.beanstalk.getWellTokenSupply(wellId)).to.be.equal(to6('285.996513'))
      })

      it('updates lp balances', async function () {
        expect(await this.lp.totalSupply()).to.be.equal(to6('285.996513'))
        expect(await this.lp.balanceOf(user2.address)).to.be.equal(to6('285.996513'))
      })

      it('emits event', async function () {
        await expect(this.result).to.emit(this.beanstalk, 'RemoveLiquidity').withArgs(wellId, [to6('4'), to6('5'), to6('5')]);
      })
    })
  })

  // describe("Oracle", async function () {

  //   describe("add a couple liquiditys", async function () {
  //     beforeEach(async function () {
  //       time = 3
  //       ema = getEma(toBN('0'), to6('100'), time, A)
  //       await fastForward(time)
  //       await this.beanstalk.connect(user2).addLiquidity(well, [to6('100'), to6('100'), to6('100')], to6('200'), EXTERNAL, EXTERNAL)
  //     })
  //     it("updates ema balance", async function () {
  //       const emaBalances = await this.beanstalk.getWellEmaBalances(wellId)
  //       expect(emaBalances[0]).to.be.within(ema, ema.add(toBN('10')))
  //       expect(emaBalances[1]).to.be.within(ema, ema.add(toBN('10')))
  //       expect(emaBalances[2]).to.be.within(ema, ema.add(toBN('10')))
  //     })
  //   })
    
  //   describe("add a couple liquiditys", async function () {
  //     beforeEach(async function () {
  //       ema = getEma(toBN('0'), to6('100'), 10, A)
  //       await fastForward(10)
  //       await this.beanstalk.connect(user2).addLiquidity(well, [to6('100'), to6('100'), to6('100')], to6('200'), EXTERNAL, EXTERNAL)
  //       ema = getEma(ema, to6('200'), 10, A)
  //       await fastForward(10)
  //       await this.beanstalk.connect(user2).addLiquidity(well, [to6('100'), to6('100'), to6('100')], to6('200'), EXTERNAL, EXTERNAL)
  //     })
  //     it("updates ema balance", async function () {
  //       const emaBalances = await this.beanstalk.getWellEmaBalances(wellId)
  //       expect(emaBalances[0]).to.be.within(ema, ema.add(toBN('1000')))
  //       expect(emaBalances[1]).to.be.within(ema, ema.add(toBN('1000')))
  //       expect(emaBalances[2]).to.be.within(ema, ema.add(toBN('1000')))
  //     })
  //   })

  //   describe("add a at different amounts", async function () {
  //     beforeEach(async function () {
  //       time = 50
  //       ema = getEma(toBN('0'), to6('100'), time, A)
  //       await fastForward(time)
  //       await this.beanstalk.connect(user2).addLiquidity(well, [to6('50'), to6('100'), to6('200')], to6('120'), EXTERNAL, EXTERNAL)

  //       time = 100000
  //       ema0 = getEma(ema, to6('150'), time, A)
  //       ema1 = getEma(ema, to6('200'), time, A)
  //       ema2 = getEma(ema, to6('300'), time, A)
  //       await fastForward(time)
  //       await this.beanstalk.connect(user2).addLiquidity(well, [to6('50'), to6('100'), to6('0')], to6('120'), EXTERNAL, EXTERNAL)

  //       time = 105323
  //       ema0 = getEma(ema0, to6('200'), time, A)
  //       ema1 = getEma(ema1, to6('300'), time, A)
  //       ema2 = getEma(ema2, to6('300'), time, A)
  //       await fastForward(time)
  //       await this.beanstalk.connect(user2).addLiquidity(well, [to6('1000'), to6('1000'), to6('500')], to6('200'), EXTERNAL, EXTERNAL)

  //       time = 13141
  //       ema0 = getEma(ema0, to6('1200'), time, A)
  //       ema1 = getEma(ema1, to6('1300'), time, A)
  //       ema2 = getEma(ema2, to6('800'), time, A)
  //       await fastForward(time)
  //       await this.beanstalk.connect(user2).addLiquidity(well, [to6('1000'), to6('1500'), to6('2000')], to6('200'), EXTERNAL, EXTERNAL)

  //       time = 3114
  //       ema0 = getEma(ema0, to6('2200'), time, A)
  //       ema1 = getEma(ema1, to6('2800'), time, A)
  //       ema2 = getEma(ema2, to6('2800'), time, A)
  //       await fastForward(time)
  //       await this.beanstalk.connect(user2).addLiquidity(well, [to6('0'), to6('10000'), to6('5000')], to6('200'), EXTERNAL, EXTERNAL)
  //     })
  //     it("updates ema balance", async function () {
  //       const emaBalances = await this.beanstalk.getWellEmaBalances(wellId)
  //       expect(emaBalances[0]).to.be.within(ema0, ema0.add(toBN('1000')))
  //       expect(emaBalances[1]).to.be.within(ema1, ema1.add(toBN('1000')))
  //       expect(emaBalances[2]).to.be.within(ema2, ema2.add(toBN('1000')))
  //     })
  //   })
  // })
})