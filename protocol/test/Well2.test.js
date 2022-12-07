const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js');
const { deployContract } = require('../scripts/contracts.js');
const { getAltBeanstalk, getBean, getUsdc } = require('../utils/contracts.js');
const { toBN } = require('../utils/index.js');
const { mintBeans, mintUsdc } = require('../utils/mint.js');
const { encodePump, decodePumpBalance } = require('../utils/pumps.js');
const { readEmaAlpha } = require('../utils/read.js');
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { BEAN, USDC, WETH, ZERO_ADDRESS } = require('./utils/constants');
const { getEma } = require('./utils/ema.js');
const { WellFunctionEncoder } = require('./utils/encoder.js');
const { to6, to18 } = require('./utils/helpers.js');
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");

let user,user2,owner;
let userAddress, ownerAddress, user2Address;
let timestamp;

async function getTimestamp() {
  return (await ethers.provider.getBlock('latest')).timestamp
}

async function getBlockNumber() {
  return (await ethers.provider.getBlock('latest')).number
}

async function fastForward(seconds = 1000) {
  // await network.provider.send("evm_increaseTime", [seconds])
  // await hre.network.provider.send("hardhat_mine", [`${ethers.utils.hexlify(seconds)}`]);
  // const blocks = ethers.utils.hexlify(seconds).toString()
  await hre.network.provider.send("hardhat_mine", [`0x${(seconds-1).toString(16)}`, `0x1`]);
  // await network.provider.send("evm_setNextBlockTimestamp", [(await getTimestamp()) + seconds])
}

async function getCumulative(amount) {
  return (await getTimepassed()).mul(amount)
}

async function getTimepassed() {
  return ethers.BigNumber.from(`${(await getTimestamp()) - timestamp}`)
}

describe('2 Token Well', function () {
  before(async function () {
    [owner,user,user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.beanstalk = await getAltBeanstalk(contracts.beanstalkDiamond.address)
    this.bean = await getBean()
    this.usdc = await getUsdc()

    A = toBN(await readEmaAlpha())

    await this.bean.mint(user.address, to6('1000'))
    await this.bean.mint(user2.address, to6('100000'))
    await this.usdc.mint(user.address, to6('1000'))
    await this.usdc.mint(user2.address, to6('100000'))

    await this.bean.connect(user2).approve(this.beanstalk.address, to18('1'))
    await this.bean.connect(user).approve(this.beanstalk.address, to18('1'))
    await this.usdc.connect(user2).approve(this.beanstalk.address, to18('1'))
    await this.usdc.connect(user).approve(this.beanstalk.address, to18('1'))

    emaPump = await (await ethers.getContractFactory("EmaPump", owner)).deploy()
    await emaPump.deployed();

    this.pumps = [
      encodePump(1, 2, ['999444598700000000']), // Should be 32 not 64
      encodePump(2, 2),
      encodePump(0, 2, [emaPump.address, '999444598700000000'], ['uint128'])
    ]

    constantProduct = await deployContract("ConstantProduct", owner)
    wellFunction = WellFunctionEncoder.basicEncoder(constantProduct.address)

    wellId = await this.beanstalk.callStatic.buildWell(wellFunction, [USDC, BEAN], ['USDC', 'BEAN'], [6,6], this.pumps)
    well = {
      wellId: wellId,
      wellFunction: WellFunctionEncoder.basicEncoder(constantProduct.address),
      tokens: [USDC, BEAN],
      decimalData: await this.beanstalk.encodeWellDecimalData([6,6]),
      pumps: this.pumps
    }
    wellHash = await this.beanstalk.computeWellHash(well)
    buildWellResult = await this.beanstalk.buildWell(wellFunction, [USDC, BEAN], ['USDC', 'BEAN'], [6,6], this.pumps)

    this.lp = await ethers.getContractAt('WellToken', wellId)
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

  describe('Build Well', async function () {
    it('reverts if not alphabetical', async function () {
      await expect(this.beanstalk.buildWell(wellFunction, [BEAN, USDC], ["BEAN", "USDC"], [6,6], this.pumps)).to.be.revertedWith("LibWell: Tokens not alphabetical")
    })

    it('reverts if type data', async function () {
      await expect(this.beanstalk.buildWell(ZERO_ADDRESS, [USDC, BEAN], ['USDC', 'BEAN'], [6,6], this.pumps)).to.be.reverted
    })
    
    it('sets well info', async function () {
      const wellInfo = await this.beanstalk.getWellInfo(wellId);
      expect(wellInfo.wellId).to.be.equal(wellId)
      expect(wellInfo.tokens[0]).to.be.equal(well.tokens[0])
      expect(wellInfo.tokens[1]).to.be.equal(well.tokens[1])
      expect(wellInfo.data).to.be.equal(well.data)

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
      const balances = await this.beanstalk.getWellBalances(wellId)
      expect(balances[0]).to.be.equal(to6('100'))
      expect(balances[1]).to.be.equal(to6('100'))

      expect(await this.beanstalk.getWellBlockNumber(wellId)).to.be.equal(await getBlockNumber())

      expect(await this.beanstalk.getWellTokenSupply(wellId)).to.be.equal(to6('200'))
    })

    it('set the pump', async function () {
      const emaBalances = await this.beanstalk.readPump(wellHash, this.pumps[0]);
      expect(emaBalances[0]).to.be.equal('0')
      expect(emaBalances[1]).to.be.equal('0')
    })

    it('emits event', async function () {
      await expect(buildWellResult).to.emit(this.beanstalk, 'BuildWell').withArgs(well.wellId, well.wellFunction, well.tokens, well.decimalData, well.pumps, wellHash);
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

      it("updates balances", async function () {
        const balances = await this.beanstalk.getWellBalances(wellId)
        expect(balances[0]).to.be.equal(to6('200'))
        expect(balances[1]).to.be.equal(to6('50'))
        expect(await this.beanstalk.getWellBlockNumber(wellId)).to.be.equal(await getBlockNumber())
        expect(await this.beanstalk.getWellTokenSupply(wellId)).to.be.equal(to6('200'))
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

      it("updates balances", async function () {
        const balances = await this.beanstalk.getWellBalances(wellId)
        expect(balances[0]).to.be.equal(to6('200'))
        expect(balances[1]).to.be.equal(to6('50'))
        expect(await this.beanstalk.getWellTokenSupply(wellId)).to.be.equal(to6('200'))
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
        const balances = await this.beanstalk.getWellBalances(wellId)
        expect(balances[0]).to.be.equal(to6('190'))
        expect(balances[1]).to.be.equal(to6('210'))
        expect(await this.beanstalk.getWellBlockNumber(wellId)).to.be.equal(await getBlockNumber())
        expect(await this.beanstalk.getWellTokenSupply(wellId)).to.be.equal(to6('399.499686'))
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
        expect(await this.bean.balanceOf(user2.address)).to.be.equal(to6('99905'))
        expect(await this.usdc.balanceOf(user2.address)).to.be.equal(to6('99905'))
      })

      it("updates state", async function () {
        const balances = await this.beanstalk.getWellBalances(wellId)
        expect(balances[0]).to.be.equal(to6('95'))
        expect(balances[1]).to.be.equal(to6('95'))
        expect(await this.beanstalk.getWellBlockNumber(wellId)).to.be.equal(await getBlockNumber())
        expect(await this.beanstalk.getWellTokenSupply(wellId)).to.be.equal(to6('190'))
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
        expect(await this.bean.balanceOf(user2.address)).to.be.equal(to6('99909.75'))
        expect(await this.usdc.balanceOf(user2.address)).to.be.equal(to6('99900'))
      })

      it("updates state", async function () {
        const balances = await this.beanstalk.getWellBalances(wellId)
        expect(balances[0]).to.be.equal(to6('100'))
        expect(balances[1]).to.be.equal(to6('90.25'))
        expect(await this.beanstalk.getWellBlockNumber(wellId)).to.be.equal(await getBlockNumber())
        expect(await this.beanstalk.getWellTokenSupply(wellId)).to.be.equal(to6('190'))
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
        expect(await this.bean.balanceOf(user2.address)).to.be.equal(to6('99900'))
        expect(await this.usdc.balanceOf(user2.address)).to.be.equal(to6('99909.75'))
      })

      it("updates state", async function () {
        const balances = await this.beanstalk.getWellBalances(wellId)
        expect(balances[0]).to.be.equal(to6('90.25'))
        expect(balances[1]).to.be.equal(to6('100'))
        expect(await this.beanstalk.getWellBlockNumber(wellId)).to.be.equal(await getBlockNumber())
        expect(await this.beanstalk.getWellTokenSupply(wellId)).to.be.equal(to6('190'))
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
        expect(await this.bean.balanceOf(user2.address)).to.be.equal(to6('99905'))
        expect(await this.usdc.balanceOf(user2.address)).to.be.equal(to6('99904'))
      })

      it("updates state", async function () {
        const balances = await this.beanstalk.getWellBalances(wellId)
        expect(balances[0]).to.be.equal(to6('96'))
        expect(balances[1]).to.be.equal(to6('95'))
        expect(await this.beanstalk.getWellBlockNumber(wellId)).to.be.equal(await getBlockNumber())
        expect(await this.beanstalk.getWellTokenSupply(wellId)).to.be.equal(to6('190.997382'))
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

  // describe("Exp", async function () {
  //   it('calculates exp correctly', async function () {
  //     expect(await this.beanstalk.powu(A, 1000)).to.be.within('573753399578216471231120745157655437', '573753399578216471231120745157656437')
  //     expect(await this.beanstalk.powu(A, 5000)).to.be.within('62176512557204924377648285671939962', '62176512557204924377648285671940962')
  //     expect(await this.beanstalk.powu(A, 10000)).to.be.within('3865918713776261644529210082422339', '3865918713776261644529210082423339')
  //   })
  // })

  describe("Oracle", async function () {

    describe("add a liquidity", async function () {
      beforeEach(async function () {
        time = 10
        emaPre = getEma(toBN('0'), to6('100'), time-1, A)
        ema = getEma(toBN('0'), to6('100'), time, A)
        await fastForward(time)
      })

      it("updates and reads ema pump", async function () {
        const balances = await this.beanstalk.callStatic.readUpdatedPump(wellHash, this.pumps[0]);
        expect(balances[0]).to.be.within(emaPre,emaPre.add(toBN('10')))
        expect(balances[1]).to.be.within(emaPre, emaPre.add(toBN('10')))
      })

      it("updates and reads SMA pump", async function () {
        const balances = await this.beanstalk.callStatic.readUpdatedPump(wellHash, this.pumps[1]);
        expect(balances[0]).to.be.equal(to6('900'))
        expect(balances[1]).to.be.equal(to6('900'))
      })

      it("updates and reads external pump", async function () {
        const balances = await this.beanstalk.callStatic.readUpdatedPump(wellHash, this.pumps[2]);
        expect(balances[0]).to.be.within(emaPre, emaPre.add(toBN('10')))
        expect(balances[1]).to.be.within(emaPre, emaPre.add(toBN('10')))
      })

      describe('read pump', async function() {
        beforeEach(async function () {
          await this.beanstalk.connect(user2).addLiquidity(well, [to6('100'), to6('100')], to6('200'), EXTERNAL, EXTERNAL)
        })

        it("updates ema pump", async function () {
          const emaBalances = await this.beanstalk.readPump(wellHash, this.pumps[0]);
          expect(emaBalances[0]).to.be.within(ema, ema.add(toBN('10')))
          expect(emaBalances[1]).to.be.within(ema, ema.add(toBN('10')))
        })

        it("updates SMA pump", async function () {
          const smaBalances = await this.beanstalk.readPump(wellHash, this.pumps[1]);
          expect(smaBalances[0]).to.be.equal(to6('1000'))
          expect(smaBalances[1]).to.be.equal(to6('1000'))
        })

        it("updates external pump", async function () {
          const byteBalances = await this.beanstalk.readPump(wellHash, this.pumps[2]);
          expect(byteBalances[0]).to.be.within(ema, ema.add(toBN('10')))
          expect(byteBalances[1]).to.be.within(ema, ema.add(toBN('10')))
        })
      })
    })
    
    describe("add a couple liquiditys", async function () {
      beforeEach(async function () {
        ema = getEma(toBN('0'), to6('100'), 10, A)
        await fastForward(10)
        await this.beanstalk.connect(user2).addLiquidity(well, [to6('100'), to6('100')], to6('200'), EXTERNAL, EXTERNAL)
        ema = getEma(ema, to6('200'), 10, A)
        await fastForward(10)
        await this.beanstalk.connect(user2).addLiquidity(well, [to6('100'), to6('100')], to6('200'), EXTERNAL, EXTERNAL)
      })
    
      it("updates ema pump", async function () {
        const emaBalances = await this.beanstalk.readPump(wellHash, this.pumps[0]);
        expect(emaBalances[0]).to.be.within(ema, ema.add(toBN('1000')))
        expect(emaBalances[1]).to.be.within(ema, ema.add(toBN('1000')))
      })

      it("updates SMA pump", async function () {
        const smaBalances = await this.beanstalk.readPump(wellHash, this.pumps[1]);
        expect(smaBalances[0]).to.be.equal(to6('3000'))
        expect(smaBalances[1]).to.be.equal(to6('3000'))
      })

      it("updates external pump", async function () {
        const byteBalances = await this.beanstalk.readPump(wellHash, this.pumps[2]);
        expect(byteBalances[0]).to.be.within(ema, ema.add(toBN('1000')))
        expect(byteBalances[1]).to.be.within(ema, ema.add(toBN('1000')))
      })
    })

    describe("add a at different amounts", async function () {
      beforeEach(async function () {
        time = 50
        ema = getEma(toBN('0'), to6('100'), time, A)
        await fastForward(time)
        await this.beanstalk.connect(user2).addLiquidity(well, [to6('50'), to6('100')], to6('120'), EXTERNAL, EXTERNAL)

        time = 100000
        ema0 = getEma(ema, to6('150'), time, A)
        ema1 = getEma(ema, to6('200'), time, A)
        await fastForward(time)
        await this.beanstalk.connect(user2).addLiquidity(well, [to6('50'), to6('100')], to6('120'), EXTERNAL, EXTERNAL)

        time = 105323
        ema0 = getEma(ema0, to6('200'), time, A)
        ema1 = getEma(ema1, to6('300'), time, A)
        await fastForward(time)
        await this.beanstalk.connect(user2).addLiquidity(well, [to6('1000'), to6('1000')], to6('200'), EXTERNAL, EXTERNAL)

        time = 13141
        ema0 = getEma(ema0, to6('1200'), time, A)
        ema1 = getEma(ema1, to6('1300'), time, A)
        await fastForward(time)
        await this.beanstalk.connect(user2).addLiquidity(well, [to6('1000'), to6('1500')], to6('200'), EXTERNAL, EXTERNAL)

        time = 3114
        ema0 = getEma(ema0, to6('2200'), time, A)
        ema1 = getEma(ema1, to6('2800'), time, A)
        await fastForward(time)
        await this.beanstalk.connect(user2).addLiquidity(well, [to6('0'), to6('10000')], to6('200'), EXTERNAL, EXTERNAL)
      })

      it("updates pumps", async function () {
        const emaBalances = await this.beanstalk.readPump(wellHash, this.pumps[0]);
        expect(emaBalances[0]).to.be.within(ema0, ema0.add(toBN('1000')))
        expect(emaBalances[1]).to.be.within(ema1, ema1.add(toBN('1000')))

        const smaBalances = await this.beanstalk.readPump(wellHash, this.pumps[1]);
        expect(smaBalances[0]).to.be.equal(to6('58689600'))
        expect(smaBalances[1]).to.be.equal(to6('77404400'))
        
        const byteBalances = await this.beanstalk.readPump(wellHash, this.pumps[2]);
        expect(byteBalances[0]).to.be.within(ema0, ema0.add(toBN('1000')))
        expect(byteBalances[1]).to.be.within(ema1, ema1.add(toBN('1000')))
      })
    })
  })
})