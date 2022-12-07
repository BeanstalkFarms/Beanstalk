// const { expect } = require('chai');
// const { deploy } = require('../scripts/deploy.js');
// const { getAltBeanstalk, getBean, getUsdc, getWeth } = require('../utils/contracts.js');
// const { toBN, getEthUsdPrice } = require('../utils/index.js');
// const { mintBeans, mintUsdc, mintWeth } = require('../utils/mint.js');
// const { getLiquityEthUsdPrice } = require('../utils/oracle.js');
// const { readEmaAlpha } = require('../utils/read.js');
// const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
// const { BEAN, USDC, WETH, USD, LIQUITY_PRICE_FEED, LIQUITY_PRICE_FEED_SELECTOR } = require('./utils/constants');
// const { getEma } = require('./utils/ema.js');
// const { TypeEncoder } = require('./utils/encoder.js');
// const { to6, to18, toX } = require('./utils/helpers.js');
// const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");

// let user,user2,owner;
// let userAddress, ownerAddress, user2Address;
// let timestamp;

// async function getTimestamp() {
//   return (await ethers.provider.getBlock('latest')).timestamp
// }

// async function fastForward(seconds = 1000) {
//   // await network.provider.send("evm_increaseTime", [seconds])
//   await network.provider.send("evm_setNextBlockTimestamp", [(await getTimestamp()) + seconds])
// }

// async function getCumulative(amount) {
//   return (await getTimepassed()).mul(amount)
// }

// async function getTimepassed() {
//   return ethers.BigNumber.from(`${(await getTimestamp()) - timestamp}`)
// }

// describe('Well', function () {
//   before(async function () {
//     [owner,user,user2] = await ethers.getSigners();
//     userAddress = user.address;
//     user2Address = user2.address;
//     const contracts = await deploy("Test", false, true);
//     ownerAddress = contracts.account;
//     typeParams = TypeEncoder.constantProductType()
//     this.beanstalk = await getAltBeanstalk(contracts.beanstalkDiamond.address)
//     this.bean = await getBean()
//     this.usdc = await getUsdc()
//     this.weth = await getWeth()

//     await this.beanstalk.connect(owner).registerOracle(
//       WETH,
//       USD,
//       LIQUITY_PRICE_FEED,
//       LIQUITY_PRICE_FEED_SELECTOR,
//       18,
//       false,
//       true
//     )

//     A = toBN(await readEmaAlpha())

//     await this.bean.mint(user.address, to6('1000000'))
//     await this.bean.mint(user2.address, to6('1000000'))
//     await this.usdc.mint(user.address, to6('1000'))
//     await this.usdc.mint(user2.address, to6('100000'))
//     await mintWeth(user.address)
//     await mintWeth(user2.address)

//     await this.bean.connect(user2).approve(this.beanstalk.address, to18('1'))
//     await this.bean.connect(user).approve(this.beanstalk.address, to18('1'))
//     await this.usdc.connect(user2).approve(this.beanstalk.address, to18('1'))
//     await this.usdc.connect(user).approve(this.beanstalk.address, to18('1'))
//     await this.weth.connect(user2).approve(this.beanstalk.address, to18('1000000'))
//     await this.weth.connect(user).approve(this.beanstalk.address, to18('1000000'))

//     wellId = await this.beanstalk.callStatic.buildWell([USDC, BEAN], '0', typeParams, ['USDC', 'BEAN'], [6,6])
//     wellUsdc = {
//       wellId: wellId, 
//       tokens: [USDC, BEAN], 
//       data: await this.beanstalk.encodeWellData(0, '0x', [6,6])
//     }
//     wellHash = await this.beanstalk.computeWellHash(wellUsdc)
//     await this.beanstalk.buildWell([USDC, BEAN], '0', typeParams, ['USDC', 'BEAN'], [6,6])
//     this.lp = await ethers.getContractAt('WellToken', wellId)
//     await this.lp.connect(user).approve(this.beanstalk.address, to18('100000000'))
//     await this.lp.connect(user2).approve(this.beanstalk.address, to18('100000000'))

//     await this.beanstalk.connect(user2).addLiquidity(wellUsdc, [to6('100'), to6('100')], to6('200'), EXTERNAL, EXTERNAL)
//     timestamp = await getTimestamp();

//     await this.beanstalk.connect(owner).whitelistToken(wellId, '0xebc4d079', 10000, 4, true, '0x00000000000000000000000000000001')

//     wellId2 = await this.beanstalk.callStatic.buildWell([BEAN, WETH], '0', typeParams, ['BEAN', 'WETH'], [6,18])
//     wellEth = {
//       wellId: wellId, 
//       tokens: [BEAN, WETH], 
//       data: await this.beanstalk.encodeWellData(0, '0x', [6,18])
//     }
//     wellHash = await this.beanstalk.computeWellHash(wellEth)
//     await this.beanstalk.buildWell([BEAN, WETH], '0', typeParams, ['BEAN', 'WETH'], [6,18])

//     const ethAmount = to18('100')
//     const price = await getEthUsdPrice()
//     const well = await this.beanstalk.getWellAtIndex(0)
//     const beanAmount = ethAmount.mul(price).div(toX('1', 20))
  
//     const amountOut = await this.beanstalk.getAddLiquidityOut(wellEth, [beanAmount, ethAmount])
//     console.log(`${beanAmount}`)
//     await this.beanstalk.connect(user2).addLiquidity(
//       wellEth,
//       [beanAmount, ethAmount],
//       amountOut.mul(toBN('999')).div(toBN('1000')),
//       '0',
//       '1'
//     )
//   });

//   beforeEach(async function () {
//     snapshotId = await takeSnapshot();
//   });

//   afterEach(async function () {
//     await revertToSnapshot(snapshotId);
//   });

//   describe("Gets LP Value", async function () {
//     it("Get instant LP Value", async function () {
//       expect(await this.beanstalk.getInstantLPValue(wellId, to6('1'), toBN('0'))).to.be.equal(to6('1'))
//       expect(await this.beanstalk.getInstantLPValue(wellId, to6('1'), '1')).to.be.equal(to6('1'))
//     })
//   })

//   describe("Gets BDV", async function () {
//     it("Gets BDV", async function () {
//       expect(await this.beanstalk.callStatic.bdv(wellId, to6('1'))).to.be.equal(to6('1'))
//     })
//   })
  
//   describe("Sell X to peg", async function () {
//     it("Gets amount", async function () {
//       expect(await this.beanstalk.getSellXToPeg(wellEth, BEAN, USD)).to.be.equal('0')
//     })

//     it("Gets amount", async function () {
//       await this.beanstalk.connect(user).swapTo(wellEth, WETH, BEAN, to18('20'), to6('10000'), 0, 0)
//       expect(await this.beanstalk.getSellXToPeg(wellEth, BEAN, USD)).to.be.within(to6('9999'), to6('10001'))
//     })
//   })

//   describe("Add X To peg", async function () {
//     it("Gets amount", async function () {
//       expect(await this.beanstalk.getAddXToPeg(wellEth, BEAN, USD)).to.be.equal('0')
//     })

//     it("Gets amount", async function () {
//       await this.beanstalk.connect(user).swapTo(wellEth, WETH, BEAN, to18('2'), to6('1000'), 0, 0)
//       expect(await this.beanstalk.getAddXToPeg(wellEth, BEAN, USD)).to.be.equal('2010101010')
//     })
//   })


//   describe("Remove D to peg", async function () {
//     it("Gets amount", async function () {
//       expect(await this.beanstalk.getRemoveDToPeg(wellEth, BEAN, USD)).to.be.equal('0')
//     })

//     it("Gets amount", async function () {
//       await this.beanstalk.connect(user).swapTo(wellEth, WETH, BEAN, to18('2'), to6('1000'), 0, 0)
//       console.log()
//       expect(await this.beanstalk.getRemoveDToPeg(wellEth, BEAN, USD)).to.be.equal('-63884397171926')
//     })
//   })

//   describe("Gets deltaXD", async function () {
//     it("Gets deltaXD", async function () {
//       const wt = await ethers.getContractAt('IERC20', wellId);
//       expect(await this.beanstalk.getXDAtRatio(['100', '200', '400'], 0, ['2','2', '4'])).to.be.equal('200')
//     })
//   })
// })