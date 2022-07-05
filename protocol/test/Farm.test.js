const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { to18, to6, toStalk } = require('./utils/helpers.js')
const { BEAN, USDT, WETH, CURVE_REGISTRY, CRYPTO_REGISTRY, THREE_POOL, TRI_CRYPTO, THREE_CURVE } = require('./utils/constants')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");

let user, user2, owner;
let userAddress, ownerAddress, user2Address;

describe('Farm', function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
            blockNumber: 14602789
          },
        },
      ],
    });
    const contracts = await deploy("Test", false, true, false);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address);
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address);
    this.bean = await ethers.getContractAt('Bean', BEAN);
    this.tokenFacet = await ethers.getContractAt('TokenFacet', this.diamond.address)
    this.farm = await ethers.getContractAt('FarmFacet', this.diamond.address)
    this.curve = await ethers.getContractAt('CurveFacet', this.diamond.address)

    await this.season.lightSunrise();
    await this.bean.connect(user).approve(this.silo.address, '100000000000');
    await this.bean.connect(user2).approve(this.silo.address, '100000000000');
    await this.bean.mint(userAddress, to6('10000'));
    await this.bean.mint(user2Address, to6('10000'));
    await this.silo.update(userAddress);

    this.usdt = await ethers.getContractAt('IERC20', USDT)

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

  describe('Farm and Deposit', function () {
    before(async function () {
      deposit = await this.silo.interface.encodeFunctionData(
        "deposit", [this.bean.address, to6('1'), EXTERNAL]
      );
    })

    it('farms', async function () {
      await this.farm.connect(user).farm([wrapEth], { value: to18('1') })
    });

    it('farms', async function () {
      await this.farm.connect(user).farm([deposit])
    });

    it('farms', async function () {
      await this.farm.connect(user).farm([wrapEth, deposit], { value: to18('1') })
    });
  });

  it('wraps Eth and exchanges to usdt external', async function () {
    exchange = await this.curve.interface.encodeFunctionData('exchange', [
      '0xD51a44d3FaE010294C616388b506AcdA1bfAAE46', // tricrypto2
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

  describe("Wrap Eth and Exchange", async function () {
    it('wraps Eth and exchanges to usdt internal', async function () {
      exchange = await this.curve.interface.encodeFunctionData('exchange', [
        '0xD51a44d3FaE010294C616388b506AcdA1bfAAE46', // tricrypto2
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
  
    it('Wrap Eth and exchanges to CRV to internal', async function () {
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
  
    it('Wrap Eth and exchanges to CRV to external', async function () {
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
  })

  describe("Eth -> LP", async function () {
    before(async function () {
      exchange = await this.curve.interface.encodeFunctionData('exchange', [
        '0xD51a44d3FaE010294C616388b506AcdA1bfAAE46', // tricrypto2
        CRYPTO_REGISTRY,
        WETH, // WETH
        USDT, // USDT
        to18('1'),        // amountIn
        ethers.utils.parseUnits('100', 6),  // minAmountOut
        INTERNAL_EXTERNAL,
        INTERNAL
      ])
    })

    it('wraps Eth and adds lp to 3pool internal', async function () {
      addLP = await this.curve.interface.encodeFunctionData('addLiquidity', [
        THREE_POOL, // 3pool
        CURVE_REGISTRY,
        ["0", "0", "3043205584"],
        ethers.utils.parseUnits('1', 18),  // minAmountOut
        INTERNAL_TOLERANT,
        INTERNAL
      ])
  
      this.threeCurve = await ethers.getContractAt('IERC20', THREE_CURVE)
  
      await this.farm.connect(user).farm([wrapEth, exchange, addLP], { value: to18('1') })
      
      expect(await this.threeCurve.balanceOf(this.farm.address)).to.be.equal('2981268357742150365108')
      expect(await this.tokenFacet.getInternalBalance(user.address, this.threeCurve.address)).to.be.equal('2981268357742150365108')
      expect(await this.threeCurve.balanceOf(user.address)).to.be.equal('0')
    })
  
    it('wraps Eth and adds lp to 3pool external', async function () {
      addLP = await this.curve.interface.encodeFunctionData('addLiquidity', [
        THREE_POOL, // 3pool
        CURVE_REGISTRY,
        ["0", "0", "3043205584"],
        ethers.utils.parseUnits('1', 18),  // minAmountOut
        INTERNAL_TOLERANT,
        EXTERNAL
      ])
  
      this.threeCurve = await ethers.getContractAt('IERC20', THREE_CURVE)
  
      await this.farm.connect(user).farm([wrapEth, exchange, addLP], { value: to18('1') })
      
      expect(await this.threeCurve.balanceOf(this.farm.address)).to.be.equal('0')
      expect(await this.tokenFacet.getInternalBalance(user.address, this.threeCurve.address)).to.be.equal('0')
      expect(await this.threeCurve.balanceOf(user.address)).to.be.equal('2981268357742150365108')
    })
  })
})