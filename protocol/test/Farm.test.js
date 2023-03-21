const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { to18, to6, toStalk } = require('./utils/helpers.js')
const { BEAN, USDT, WETH, CURVE_REGISTRY, CRYPTO_REGISTRY, THREE_POOL, TRI_CRYPTO, TRI_CRYPTO_POOL, THREE_CURVE, BEAN_3_CURVE, USDC, WBTC, DAI, LUSD_3_CURVE, LUSD, CRYPTO_FACTORY } = require('./utils/constants')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");

let user, user2, owner;
let userAddress, ownerAddress, user2Address;

describe('Farm', function () {
  if (!!process.env.FORKING_RPC) {
    before(async function () {
      [owner, user, user2] = await ethers.getSigners();
      userAddress = user.address;
      user2Address = user2.address;
      try {
        await network.provider.request({
          method: "hardhat_reset",
          params: [
            {
              forking: {
                jsonRpcUrl: process.env.FORKING_RPC,
                blockNumber: 14602789
              },
            },
          ],
        });
      } catch(error) {
        console.log(error);
        return
      }
      const contracts = await deploy("Test", false, true, false);
      ownerAddress = contracts.account;
      this.diamond = contracts.beanstalkDiamond;
      this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address);
      this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address);
      this.bean = await ethers.getContractAt('Bean', BEAN);
      this.tokenFacet = await ethers.getContractAt('TokenFacet', this.diamond.address)
      this.farm = await ethers.getContractAt('FarmFacet', this.diamond.address)
      this.curve = await ethers.getContractAt('CurveFacet', this.diamond.address)
      this.beanMetapool = await ethers.getContractAt('MockMeta3Curve', BEAN_3_CURVE)
      this.threeCurve = await ethers.getContractAt('IERC20', THREE_CURVE)

      await this.beanMetapool.set_A_precise('1000')
      await this.beanMetapool.set_virtual_price(to18('1'))
      await this.beanMetapool.set_balances(['1', ethers.utils.parseUnits('1', 12)])
      await this.beanMetapool.set_supply('0')

      await this.season.lightSunrise();
      await this.bean.connect(user).mint(user.address, '100000000000');
      await this.bean.connect(user).approve(this.silo.address, '100000000000');
      await this.bean.connect(user2).approve(this.silo.address, '100000000000');
      await this.bean.mint(userAddress, to6('10000'));
      await this.bean.mint(user2Address, to6('10000'));
      await this.silo.mow(userAddress, this.beanMetapool.address);

      this.usdt = await ethers.getContractAt('IERC20', USDT)
      this.usdc = await ethers.getContractAt('IERC20', USDC)
      this.dai = await ethers.getContractAt('IERC20', DAI)
      this.weth = await ethers.getContractAt('IERC20', WETH)
      this.wbtc = await ethers.getContractAt('IERC20', WBTC)
      this.lusd = await ethers.getContractAt('IERC20', LUSD)

      wrapEth = await this.tokenFacet.interface.encodeFunctionData(
        "wrapEth", [to18('1'), INTERNAL]
      );
    });

    beforeEach(async function () {
      snapshotId = await takeSnapshot();
    });

    afterEach(async function () {
      await revertToSnapshot(snapshotId);
    });

    describe('Farm Deposit', function () {
      before(async function () {
        deposit = await this.silo.interface.encodeFunctionData(
          "deposit", [this.bean.address, to6('1'), 0x0, EXTERNAL]
        );
      })

      it('Wrap Eth', async function () {
        await this.farm.connect(user).farm([wrapEth], { value: to18('1') })
      });

      it('Deposit', async function () {
        await this.farm.connect(user).farm([deposit])
      });

      it('Wrap Eth, Deposit', async function () {
        await this.farm.connect(user).farm([wrapEth, deposit], { value: to18('1') })
      });
    });

    describe('Farm Exchange', async function () {
      describe('tri-crypto', async function () {
        it('Wrap Eth, Exchange WETH -> USDT external', async function () {
          exchange = await this.curve.interface.encodeFunctionData('exchange', [
            TRI_CRYPTO_POOL, // tricrypto2
            CRYPTO_REGISTRY,
            WETH, // WETH
            USDT, // USDT
            to18('1'),        // amountIn
            ethers.utils.parseUnits('100', 6),  // minAmountOut
            INTERNAL_EXTERNAL,
            EXTERNAL
          ])

          await this.farm.connect(user).farm([wrapEth, exchange], { value: to18('1') })

          expect(await this.usdt.balanceOf(this.farm.address)).to.be.equal('0')
          expect(await this.usdt.balanceOf(user.address)).to.be.equal('3043205584')
        })

        it('wraps Eth and exchanges to usdt internal', async function () {
          exchange = await this.curve.interface.encodeFunctionData('exchange', [
            TRI_CRYPTO_POOL, // tricrypto2
            CRYPTO_REGISTRY,
            WETH, // WETH
            USDT, // USDT
            to18('1'),        // amountIn
            ethers.utils.parseUnits('100', 6),  // minAmountOut
            INTERNAL_EXTERNAL,
            INTERNAL
          ])

          await this.farm.connect(user).farm([wrapEth, exchange], { value: to18('1') })

          expect(await this.usdt.balanceOf(this.farm.address)).to.be.equal('3043205584')
          expect(await this.tokenFacet.getInternalBalance(user.address, this.usdt.address)).to.be.equal('3043205584')
          expect(await this.usdt.balanceOf(user.address)).to.be.equal('0')
        })

        it('Wrap Eth, Exchange WETH -> CRV external', async function () {
          exchange = await this.curve.interface.encodeFunctionData('exchange', [
            '0x8301AE4fc9c624d1D396cbDAa1ed877821D7C511', // CRV:ETH
            CRYPTO_REGISTRY,
            WETH, // WETH
            '0xD533a949740bb3306d119CC777fa900bA034cd52', // CRV
            to18('1'),        // amountIn
            to18('500'),  // minAmountOut
            INTERNAL_EXTERNAL,
            EXTERNAL
          ])

          this.crv = await ethers.getContractAt('IERC20', '0xD533a949740bb3306d119CC777fa900bA034cd52')

          await this.farm.connect(user).farm([wrapEth, exchange], { value: to18('1') })

          expect(await this.crv.balanceOf(this.farm.address)).to.be.equal('0')
          expect(await this.tokenFacet.getInternalBalance(user.address, this.crv.address)).to.be.equal('0')
          expect(await this.crv.balanceOf(user.address)).to.be.equal('1338512415451289655561')
        })
      })

      describe('weth:crv', async function () {
        it('Wrap Eth, Exchange WETH -> CRV internal', async function () {
          exchange = await this.curve.interface.encodeFunctionData('exchange', [
            '0x8301AE4fc9c624d1D396cbDAa1ed877821D7C511', // CRV:ETH
            CRYPTO_REGISTRY,
            WETH, // WETH
            '0xD533a949740bb3306d119CC777fa900bA034cd52', // CRV
            to18('1'),        // amountIn
            to18('500'),  // minAmountOut
            INTERNAL_EXTERNAL,
            INTERNAL
          ])

          this.crv = await ethers.getContractAt('IERC20', '0xD533a949740bb3306d119CC777fa900bA034cd52')

          await this.farm.connect(user).farm([wrapEth, exchange], { value: to18('1') })

          expect(await this.crv.balanceOf(this.farm.address)).to.be.equal('1338512415451289655561')
          expect(await this.tokenFacet.getInternalBalance(user.address, this.crv.address)).to.be.equal('1338512415451289655561')
          expect(await this.crv.balanceOf(user.address)).to.be.equal('0')
        })

        it('Wrap Eth, Exchange WETH -> USDT, Exchange USDT -> USDC', async function () {
          exchange = await this.curve.interface.encodeFunctionData('exchange', [
            TRI_CRYPTO_POOL, // tricrypto2
            CRYPTO_REGISTRY,
            WETH, // WETH
            USDT, // USDT
            to18('1'),        // amountIn
            ethers.utils.parseUnits('100', 6),  // minAmountOut
            INTERNAL_EXTERNAL,
            INTERNAL
          ])

          exchange2 = await this.curve.interface.encodeFunctionData('exchange', [
            THREE_POOL, // tricrypto2
            CURVE_REGISTRY,
            USDT, // WETH
            USDC, // USDT
            ethers.utils.parseUnits('100', 6),        // amountIn
            ethers.utils.parseUnits('99', 6),  // minAmountOut
            INTERNAL_TOLERANT,
            EXTERNAL
          ])

          await this.farm.connect(user).farm([wrapEth, exchange, exchange2], { value: to18('1') })

          expect(await this.usdc.balanceOf(this.farm.address)).to.be.equal('0')
          expect(await this.usdc.balanceOf(user.address)).to.be.equal('100980055')
        })
      })
    })

    describe("Farm Exchange Underlying", async function () {
      before(async function () {
        exchange = await this.curve.interface.encodeFunctionData('exchange', [
          TRI_CRYPTO_POOL, // tricrypto2
          CRYPTO_REGISTRY,
          WETH, // WETH
          USDT, // USDT
          to18('1'),        // amountIn
          ethers.utils.parseUnits('100', 6),  // minAmountOut
          INTERNAL,
          INTERNAL
        ])
      })

      it("Wrap Eth, Exchange WETH -> USDT, Exchange USDT -> LUSD external", async function () {
        eu = await this.curve.interface.encodeFunctionData('exchangeUnderlying', [
          LUSD_3_CURVE,
          USDT,
          LUSD,
          to6('100'),        // amountIn
          to18('99'),  // minAmountOut
          INTERNAL_TOLERANT,
          EXTERNAL
        ])

        await this.farm.connect(user).farm([wrapEth, exchange, eu], { value: to18('1') })

        expect(await this.lusd.balanceOf(this.farm.address)).to.be.equal('0')
        expect(await this.tokenFacet.getInternalBalance(user.address, this.lusd.address)).to.be.equal('0')
        expect(await this.lusd.balanceOf(user.address)).to.be.equal('99791486902027823650')
      })

      it("Wrap Eth, Exchange WETH -> USDT, Exchange USDT -> LUSD internal", async function () {
        eu = await this.curve.interface.encodeFunctionData('exchangeUnderlying', [
          LUSD_3_CURVE,
          USDT,
          LUSD,
          to6('100'),        // amountIn
          to18('99'),  // minAmountOut
          INTERNAL_TOLERANT,
          INTERNAL
        ])

        await this.farm.connect(user).farm([wrapEth, exchange, eu], { value: to18('1') })

        expect(await this.lusd.balanceOf(this.farm.address)).to.be.equal('99791486902027823650')
        expect(await this.tokenFacet.getInternalBalance(user.address, this.lusd.address)).to.be.equal('99791486902027823650')
        expect(await this.lusd.balanceOf(user.address)).to.be.equal('0')
      })

    })

    describe("Farm Liquidity ", async function () {
      before(async function () {
        exchange = await this.curve.interface.encodeFunctionData('exchange', [
          TRI_CRYPTO_POOL, // tricrypto2
          CRYPTO_REGISTRY,
          WETH, // WETH
          USDT, // USDT
          to18('1'),        // amountIn
          ethers.utils.parseUnits('100', 6),  // minAmountOut
          INTERNAL_EXTERNAL,
          INTERNAL
        ])
      })

      describe("tri-crypto", async function () {
        before(async function () {
          addLP = await this.curve.interface.encodeFunctionData('addLiquidity', [
            TRI_CRYPTO_POOL, // tricrypto2
            CRYPTO_REGISTRY,
            [0, 0, to18("1")],
            '0',  // minAmountOut
            INTERNAL_TOLERANT,
            INTERNAL
          ])
        })

        it('Wraps Eth, Adds WETH as tri-crypto internal', async function () {

          this.triCrypto = await ethers.getContractAt('IERC20', TRI_CRYPTO)

          await this.farm.connect(user).farm([wrapEth, addLP], { value: to18('1') })

          expect(await this.triCrypto.balanceOf(this.farm.address)).to.be.equal('2019589947833455380')
          expect(await this.tokenFacet.getInternalBalance(user.address, this.triCrypto.address)).to.be.equal('2019589947833455380')
          expect(await this.triCrypto.balanceOf(user.address)).to.be.equal('0')
        })

        it('Wraps Eth, Adds WETH as tri-crypto internal, removes tri-crypto liquidity 1 token to WETH', async function () {
          removeLP = await this.curve.interface.encodeFunctionData('removeLiquidityOneToken', [
            TRI_CRYPTO_POOL, // tricrypto2
            CRYPTO_REGISTRY,
            WETH,
            '2019589947833455380', // amountInt
            to18('0.1'),  // minAmountOut
            INTERNAL_TOLERANT,
            INTERNAL
          ])

          this.triCrypto = await ethers.getContractAt('IERC20', TRI_CRYPTO)

          await this.farm.connect(user).farm([wrapEth, addLP, removeLP], { value: to18('1') })

          expect(await this.weth.balanceOf(this.farm.address)).to.be.equal('999353626969234502')
          expect(await this.tokenFacet.getInternalBalance(user.address, this.weth.address)).to.be.equal('999353626969234502')
          expect(await this.weth.balanceOf(user.address)).to.be.equal('0')
        })

        it('Wraps Eth, Adds WETH as tri-crypto internal, removes tri-crypto liquidity equally', async function () {
          removeLP = await this.curve.interface.encodeFunctionData('removeLiquidity', [
            TRI_CRYPTO_POOL, // tricrypto2
            CRYPTO_REGISTRY,
            '2019589947833455380', // amountInt
            ['0', '0', '0'],  // minAmountOut
            INTERNAL_TOLERANT,
            INTERNAL
          ])

          this.triCrypto = await ethers.getContractAt('IERC20', TRI_CRYPTO)

          await this.farm.connect(user).farm([wrapEth, addLP, removeLP], { value: to18('1') })

          expect(await this.weth.balanceOf(this.farm.address)).to.be.equal('332554978398190452')
          expect(await this.tokenFacet.getInternalBalance(user.address, this.weth.address)).to.be.equal('332554978398190452')
          expect(await this.weth.balanceOf(user.address)).to.be.equal('0')

          expect(await this.usdt.balanceOf(this.farm.address)).to.be.equal('1019226369')
          expect(await this.tokenFacet.getInternalBalance(user.address, this.usdt.address)).to.be.equal('1019226369')
          expect(await this.usdt.balanceOf(user.address)).to.be.equal('0')

          expect(await this.wbtc.balanceOf(this.farm.address)).to.be.equal('2504936')
          expect(await this.tokenFacet.getInternalBalance(user.address, this.wbtc.address)).to.be.equal('2504936')
          expect(await this.wbtc.balanceOf(user.address)).to.be.equal('0')
        })

        it('Wraps Eth, Adds WETH as tri-crypto internal, removes tri-crypto liquidity equally', async function () {
          removeLP = await this.curve.interface.encodeFunctionData('removeLiquidity', [
            TRI_CRYPTO_POOL, // tricrypto2
            CRYPTO_REGISTRY,
            '2019589947833455380', // amountInt
            ['0', '0', '0'],  // minAmountOut
            INTERNAL_TOLERANT,
            INTERNAL
          ])

          this.triCrypto = await ethers.getContractAt('IERC20', TRI_CRYPTO)

          await this.farm.connect(user).farm([wrapEth, addLP, removeLP], { value: to18('1') })

          expect(await this.weth.balanceOf(this.farm.address)).to.be.equal('332554978398190452')
          expect(await this.tokenFacet.getInternalBalance(user.address, this.weth.address)).to.be.equal('332554978398190452')
          expect(await this.weth.balanceOf(user.address)).to.be.equal('0')

          expect(await this.usdt.balanceOf(this.farm.address)).to.be.equal('1019226369')
          expect(await this.tokenFacet.getInternalBalance(user.address, this.usdt.address)).to.be.equal('1019226369')
          expect(await this.usdt.balanceOf(user.address)).to.be.equal('0')

          expect(await this.wbtc.balanceOf(this.farm.address)).to.be.equal('2504936')
          expect(await this.tokenFacet.getInternalBalance(user.address, this.wbtc.address)).to.be.equal('2504936')
          expect(await this.wbtc.balanceOf(user.address)).to.be.equal('0')
        })

        it('Wraps Eth, Adds WETH as tri-crypto internal, removes tri-crypto liquidity imbalance', async function () {
          removeLPImb = await this.curve.interface.encodeFunctionData('removeLiquidityImbalance', [
            TRI_CRYPTO_POOL, // tricrypto2
            CRYPTO_REGISTRY,
            // [to6('1000'), '2500000', to18('0.3')],  // minAmountOut
            ['1', '1', '1'],  // minAmountOut
            '2019589947833455380', // amountInt
            INTERNAL_TOLERANT,
            INTERNAL
          ])

          this.triCrypto = await ethers.getContractAt('IERC20', TRI_CRYPTO)

          await expect(this.farm.connect(user).farm([wrapEth, addLP, removeLPImb], { value: to18('1') })).to.be.revertedWith('Curve: tri-crypto not supported')
        })
      })
      describe("3-pool", async function () {
        before(async function () {
          this.threeCurve = await ethers.getContractAt('IERC20', THREE_CURVE)

          addLP = await this.curve.interface.encodeFunctionData('addLiquidity', [
            THREE_POOL, // 3pool
            CURVE_REGISTRY,
            ["0", "0", "3043205584"],
            ethers.utils.parseUnits('1', 18),  // minAmountOut
            INTERNAL_TOLERANT,
            INTERNAL
          ])
        })

        it('Wraps Eth, Exchange WETH -> USDT, add USDT as 3CRV internal', async function () {

          await this.farm.connect(user).farm([wrapEth, exchange, addLP], { value: to18('1') })

          expect(await this.threeCurve.balanceOf(this.farm.address)).to.be.equal('2981268357742150365108')
          expect(await this.tokenFacet.getInternalBalance(user.address, this.threeCurve.address)).to.be.equal('2981268357742150365108')
          expect(await this.threeCurve.balanceOf(user.address)).to.be.equal('0')
        })

        it('Wraps Eth, Exchange WETH -> USDT, add USDT as 3CRV external', async function () {
          addLP2 = await this.curve.interface.encodeFunctionData('addLiquidity', [
            THREE_POOL, // 3pool
            CURVE_REGISTRY,
            ["0", "0", "3043205584"],
            ethers.utils.parseUnits('1', 18),  // minAmountOut
            INTERNAL_TOLERANT,
            EXTERNAL
          ])

          await this.farm.connect(user).farm([wrapEth, exchange, addLP2], { value: to18('1') })

          expect(await this.threeCurve.balanceOf(this.farm.address)).to.be.equal('0')
          expect(await this.tokenFacet.getInternalBalance(user.address, this.threeCurve.address)).to.be.equal('0')
          expect(await this.threeCurve.balanceOf(user.address)).to.be.equal('2981268357742150365108')
        })

        it('Wraps Eth, Exchange WETH -> USDT, add USDT as 3CRV, removes 3CRV equally', async function () {
          removeLP = await this.curve.interface.encodeFunctionData('removeLiquidity', [
            THREE_POOL, // tricrypto2
            CURVE_REGISTRY,
            '2981268357742150365108', // amountIn
            ['1', '1', '1'],  // minAmountOut
            INTERNAL_TOLERANT,
            INTERNAL
          ])

          await this.farm.connect(user).farm([wrapEth, exchange, addLP, removeLP], { value: to18('1') })

          expect(await this.usdc.balanceOf(this.farm.address)).to.be.equal('1096956614')
          expect(await this.tokenFacet.getInternalBalance(user.address, this.usdc.address)).to.be.equal('1096956614')
          expect(await this.usdc.balanceOf(user.address)).to.be.equal('1000000')

          expect(await this.usdt.balanceOf(this.farm.address)).to.be.equal('727891990')
          expect(await this.tokenFacet.getInternalBalance(user.address, this.usdt.address)).to.be.equal('727891990')
          expect(await this.usdt.balanceOf(user.address)).to.be.equal('0')

          expect(await this.dai.balanceOf(this.farm.address)).to.be.equal('1218092928789910236576')
          expect(await this.tokenFacet.getInternalBalance(user.address, this.dai.address)).to.be.equal('1218092928789910236576')
          expect(await this.dai.balanceOf(user.address)).to.be.equal('0')
        })

        it('Wraps Eth, Exchange WETH -> USDT, add USDT as 3CRV, removes 3CRV to USDC', async function () {
          removeLP = await this.curve.interface.encodeFunctionData('removeLiquidityOneToken', [
            THREE_POOL, // 3pool
            CURVE_REGISTRY,
            DAI,
            '2981268357742150365108', // amountInt
            to18('300'),  // minAmountOut
            INTERNAL_TOLERANT,
            EXTERNAL
          ])

          await this.farm.connect(user).farm([wrapEth, exchange, addLP, removeLP], { value: to18('1') })

          expect(await this.dai.balanceOf(this.farm.address)).to.be.equal('0')
          expect(await this.tokenFacet.getInternalBalance(user.address, this.dai.address)).to.be.equal('0')
          expect(await this.dai.balanceOf(user.address)).to.be.equal('3042640137009018638481')
        })

        it('Wraps Eth, Exchange WETH -> USDT, add USDT as 3CRV, removes 3CRV imbalance', async function () {
          removeLPImb = await this.curve.interface.encodeFunctionData('removeLiquidityImbalance', [
            THREE_POOL, // 3pool
            CURVE_REGISTRY,
            [to6('100'), to6('100'), to6('100')],  // minAmountOut
            '3042640137009018638481', // amountInt
            INTERNAL_TOLERANT,
            INTERNAL
          ])

          await this.farm.connect(user).farm([wrapEth, exchange, addLP, removeLPImb], { value: to18('1') })

          expect(await this.usdc.balanceOf(this.farm.address)).to.be.equal(to6('100'))
          expect(await this.tokenFacet.getInternalBalance(user.address, this.usdc.address)).to.be.equal(to6('100'))
          expect(await this.usdc.balanceOf(user.address)).to.be.equal('1000000')

          expect(await this.usdt.balanceOf(this.farm.address)).to.be.equal(to6('100'))
          expect(await this.tokenFacet.getInternalBalance(user.address, this.usdt.address)).to.be.equal(to6('100'))
          expect(await this.usdt.balanceOf(user.address)).to.be.equal('0')

          expect(await this.dai.balanceOf(this.farm.address)).to.be.equal(to6('100'))
          expect(await this.tokenFacet.getInternalBalance(user.address, this.dai.address)).to.be.equal(to6('100'))
          expect(await this.dai.balanceOf(user.address)).to.be.equal('0')
        })
      })
    })

    // Temporarily Disabled until new pool is deployed

    // it('wraps Eth and adds lp to 3pool external', async function () {
    //   addLP3Pool = await this.curve.interface.encodeFunctionData('addLiquidity', [
    //     THREE_POOL, // 3pool
    //     CURVE_REGISTRY,
    //     ["0", "0", "3043205584"],
    //     to18('1'),  // minAmountOut
    //     INTERNAL_TOLERANT,
    //     INTERNAL
    //   ])

    //   addLPBeanMetapool = await this.curve.interface.encodeFunctionData('addLiquidity', [
    //     BEAN_3_CURVE, // 3pool
    //     STABLE_FACTORY,
    //     [ to6('1'), to18('1') ],
    //     to18('2'),  // minAmountOut
    //     INTERNAL_EXTERNAL,
    //     INTERNAL
    //   ])

    //   deposit = await this.silo.interface.encodeFunctionData(
    //     "deposit", [BEAN_3_CURVE, to18('2'), INTERNAL]
    //   );

    //   withdraw = await this.silo.interface.encodeFunctionData(
    //     "withdrawDeposit", [BEAN_3_CURVE, 2, to18('2')]
    //   );

    //   await this.farm.connect(user).farm([
    //     wrapEth, 
    //     exchange, 
    //     addLP3Pool, 
    //     addLPBeanMetapool, 
    //     deposit, 
    //     withdraw
    //   ], { value: to18('1') })

    //   this.season.farmSunrises('30')

    //   const claimWithdrawal = await this.silo.interface.encodeFunctionData(
    //     "claimWithdrawal", [
    //       BEAN_3_CURVE,
    //       '27',
    //       INTERNAL
    //     ]
    //   );

    //   const removeLiquidity = await this.curve.interface.encodeFunctionData(
    //     "removeLiquidity", [
    //       BEAN_3_CURVE,
    //       STABLE_FACTORY,
    //       to18('2'),
    //       [0,0],
    //       INTERNAL,
    //       EXTERNAL,
    //     ]
    //   )

    //   await this.farm.connect(user).farm([claimWithdrawal, removeLiquidity])

    //   expect(await this.threeCurve.balanceOf(user.address)).to.be.equal('989769589977063077')
    // })
  } else {
    it('skip', async function () { 
      console.log('Set FORKING_RPC in .env file to run tests')
    })
  }
})