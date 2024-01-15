const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { impersonateFertilizer } = require('../scripts/deployFertilizer.js')
const { EXTERNAL, INTERNAL } = require('./utils/balances.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot.js");
const { BEAN, FERTILIZER, USDC, BEAN_3_CURVE, THREE_CURVE, UNRIPE_BEAN, UNRIPE_LP, WETH, BEANSTALK } = require('./utils/constants.js');
const { setEthUsdcPrice, setEthUsdPrice } = require('../utils/oracle.js');
const { to6, to18 } = require('./utils/helpers.js');
const { deployBasin } = require('../scripts/basin.js');
const axios = require("axios");
let user,user2,owner,fert
let userAddress, ownerAddress, user2Address

let snapshotId

function beansForUsdc(amount) {
  return ethers.BigNumber.from(amount)
    .mul(ethers.BigNumber.from('32509005432722'))
    .div(ethers.BigNumber.from('77000000'))
}

function lpBeansForUsdc(amount) {
  return ethers.BigNumber.from(amount)
    .mul(ethers.BigNumber.from('866616'))
}

describe('Fertilize', function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners()
    userAddress = user.address
    user2Address = user2.address
    const contracts = await deploy("Test", false, true)
    // this.fert = await deployFertilizer(owner, false, mock=true)
    this.fert = await impersonateFertilizer()
    ownerAddress = contracts.account
    this.diamond = contracts.beanstalkDiamond
    await this.fert.transferOwnership(this.diamond.address)
    // await user.sendTransaction({to: FERTILIZER, value: ethers.utils.parseEther("0.1")});
    // await hre.network.provider.request({method: "hardhat_impersonateAccount", params: [FERTILIZER]});
    // fert = await ethers.getSigner(FERTILIZER)
    this.fertilizer = await ethers.getContractAt('MockFertilizerFacet', this.diamond.address)
    this.unripe = await ethers.getContractAt('MockUnripeFacet', this.diamond.address)
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
    this.token = await ethers.getContractAt('TokenFacet', this.diamond.address)
    this.usdc = await ethers.getContractAt('IBean', USDC)
    this.bean = await ethers.getContractAt('IBean', BEAN)
    this.weth = await ethers.getContractAt('IBean', WETH)

    this.unripeBean = await ethers.getContractAt('MockToken', UNRIPE_BEAN)
    this.unripeLP = await ethers.getContractAt('MockToken', UNRIPE_LP)
    await this.unripeBean.mint(user2.address, to6('1000'))
    await this.unripeLP.mint(user2.address, to6('942.297473'))

    this.weth = await ethers.getContractAt('IBean', WETH)

    await this.bean.mint(owner.address, to18('1000000000'));
    await this.weth.mint(owner.address, to18('1000000000'));
    await this.weth.mint(user.address, to18('1000000000'));
    await this.weth.mint(user2.address, to18('1000000000'));
    await this.bean.connect(owner).approve(this.diamond.address, to18('1000000000'));
    await this.weth.connect(owner).approve(this.diamond.address, to18('1000000000'));
    await this.weth.connect(user).approve(this.diamond.address, to18('1000000000'));
    await this.weth.connect(user2).approve(this.diamond.address, to18('1000000000'));

    this.well = await deployBasin(true, undefined, false, true)
    this.wellToken = await ethers.getContractAt("IERC20", this.well.address)
    await this.wellToken.connect(owner).approve(BEANSTALK, ethers.constants.MaxUint256)
    await this.bean.connect(owner).approve(BEANSTALK, ethers.constants.MaxUint256)

    await setEthUsdPrice('999.998018')
    await setEthUsdcPrice('1000')

    console.log(`Well Address: ${this.well.address}`)

  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot()
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId)
  });

  it('reverts if early Season', async function () {
    await expect(this.fertilizer.connect(owner).addFertilizerOwner('1', '1', '0')).to.be.revertedWith('SafeMath: subtraction overflow')
  })

  describe("Get Humidity", async function () {
    it('0th season', async function () {
      expect(await this.fertilizer.getHumidity('0')).to.be.equal(5000)
    })

    it('first season', async function () {
      expect(await this.fertilizer.getHumidity('6074')).to.be.equal(2500)
    })

    it('second season', async function () {
      expect(await this.fertilizer.getHumidity('6075')).to.be.equal(2495)
    })

    it('11th season', async function () {
      expect(await this.fertilizer.getHumidity('6084')).to.be.equal(2450)
    })

    it('2nd last scale season', async function () {
      expect(await this.fertilizer.getHumidity('6533')).to.be.equal(205)
    })

    it('last scale season', async function () {
      expect(await this.fertilizer.getHumidity('6534')).to.be.equal(200)
    })

    it('late season', async function () {
      expect(await this.fertilizer.getHumidity('10000')).to.be.equal(200)
    })
  })

  it('gets fertilizers', async function () {
    const fertilizers = await this.fertilizer.getFertilizers()
    expect(`${fertilizers}`).to.be.equal('')
  })

  describe('Add Fertilizer', async function () {
    describe('1 fertilizer', async function () {
      beforeEach(async function () {
        this.result = await this.fertilizer.connect(owner).addFertilizerOwner('10000', to18('0.001'), '0')
      })
  
      it("updates totals", async function () {
        expect(await this.fertilizer.totalUnfertilizedBeans()).to.be.equal(to6('1.2'))
        expect(await this.fertilizer.getFirst()).to.be.equal(to6('1.2'))
        expect(await this.fertilizer.getNext(to6('1.2'))).to.be.equal(0)
        expect(await this.fertilizer.getActiveFertilizer()).to.be.equal('1')
        expect(await this.fertilizer.isFertilizing()).to.be.equal(true)
        expect(await this.fertilizer.remainingRecapitalization()).to.be.equal(to6('499'))
      })

      it('updates token balances', async function () {
        expect(await this.bean.balanceOf(this.fertilizer.address)).to.be.equal(to6('2'))
        expect(await this.well.balanceOf(this.fertilizer.address)).to.be.equal('29438342344636187')

        expect(await this.weth.balanceOf(this.well.address)).to.be.equal(to18('0.001'))
        expect(await this.bean.balanceOf(this.well.address)).to.be.equal(lpBeansForUsdc('1'))
      })

      it('updates underlying balances', async function () {
        expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6('2'))
        expect(await this.unripe.getTotalUnderlying(UNRIPE_LP)).to.be.equal(await this.well.balanceOf(this.fertilizer.address))
      })

      it('updates fertizer amount', async function () {
        expect(await this.fertilizer.getFertilizer(to6('1.2'))).to.be.equal('1')
      })

      it('emits event', async function () {
        expect(this.result).to.emit('SetFertilizer').withArgs('10000', to6('1.2'), to6('1.2'))
      })

      it('gets fertilizers', async function () {
        const fertilizers = await this.fertilizer.getFertilizers()
        expect(`${fertilizers}`).to.be.equal('1200000,1')
      })
    })

    describe('1 fertilizer twice', async function () {
      beforeEach(async function () {
        await this.fertilizer.connect(owner).addFertilizerOwner('10000', to18('0.001'), '0')
        await this.fertilizer.connect(owner).addFertilizerOwner('10000', to18('0.001'), '0')
        this.depositedBeans = beansForUsdc('1').add(beansForUsdc('1'))
      })

      it("updates totals", async function () {
        expect(await this.fertilizer.totalUnfertilizedBeans()).to.be.equal(to6('2.4'))
        expect(await this.fertilizer.getFirst()).to.be.equal(to6('1.2'))
        expect(await this.fertilizer.getNext(to6('1.2'))).to.be.equal(0)
        expect(await this.fertilizer.getActiveFertilizer()).to.be.equal('2')
        expect(await this.fertilizer.remainingRecapitalization()).to.be.equal(to6('498'))
      })

      it('updates token balances', async function () {
        expect(await this.bean.balanceOf(this.fertilizer.address)).to.be.equal(to6('3.999999'))
        expect(await this.well.balanceOf(this.fertilizer.address)).to.be.equal('58876684689272374')

        expect(await this.weth.balanceOf(this.well.address)).to.be.equal(to18('0.002'))
        expect(await this.bean.balanceOf(this.well.address)).to.be.equal(lpBeansForUsdc('2'))
      })

      it('updates underlying balances', async function () {
        expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6('3.999999'))
        expect(await this.unripe.getTotalUnderlying(UNRIPE_LP)).to.be.equal(await this.well.balanceOf(this.fertilizer.address))
      })

      it('updates fertizer amount', async function () {
        expect(await this.fertilizer.getFertilizer(to6('1.2'))).to.be.equal('2')
      })
    })

    describe('2 fertilizers', async function () {
      beforeEach(async function () {
        await this.fertilizer.connect(owner).addFertilizerOwner('0', to18('0.005'), '0')
        await this.fertilizer.connect(owner).addFertilizerOwner('10000', to18('0.001'), '0')
        this.lpBeans = lpBeansForUsdc('5').add(lpBeansForUsdc('1'))
      })

      it("updates totals", async function () {
        expect(await this.fertilizer.totalUnfertilizedBeans()).to.be.equal(to6('31.2'))
        expect(await this.fertilizer.getFirst()).to.be.equal(to6('1.2'))
        expect(await this.fertilizer.getNext(to6('1.2'))).to.be.equal(to6('6'))
        expect(await this.fertilizer.getActiveFertilizer()).to.be.equal('6')
        expect(await this.fertilizer.isFertilizing()).to.be.equal(true)
        expect(await this.fertilizer.remainingRecapitalization()).to.be.equal(to6('494'))
      })

      it('updates token balances', async function () {
        expect(await this.bean.balanceOf(this.fertilizer.address)).to.be.equal(to6('11.999999'))
        expect(await this.well.balanceOf(this.fertilizer.address)).to.be.equal('176630054067817122')

        expect(await this.weth.balanceOf(this.well.address)).to.be.equal(to18('0.006'))
        expect(await this.bean.balanceOf(this.well.address)).to.be.equal(this.lpBeans)
      })

      it('updates underlying balances', async function () {
        expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6('11.999999'))
        expect(await this.unripe.getTotalUnderlying(UNRIPE_LP)).to.be.equal(await this.well.balanceOf(this.fertilizer.address))
      })

      it('updates fertizer amount', async function () {
        expect(await this.fertilizer.getFertilizer(to6('1.2'))).to.be.equal('1')
        expect(await this.fertilizer.getFertilizer(to6('6'))).to.be.equal('5')
      })
    })

    describe('Too much Fertilizer', async function () {
      it("reverts", async function () {
        expect(
          await this.fertilizer.connect(owner).addFertilizerOwner('0', to18('1'), '0')
        ).to.be.revertedWith("Fertilizer: No more fertilizer available")
      })

    })
  })

  describe('Sort fertilizer seasons', async function () {
    beforeEach(async function () {
      await this.fertilizer.connect(owner).addFertilizerOwner('10000', to18('0.001'), '0')
      await this.fertilizer.connect(owner).addFertilizerOwner('6374', to18('0.001'), '0')
      await this.fertilizer.connect(owner).addFertilizerOwner('6274', to18('0.001'), '0')
      await this.fertilizer.connect(owner).addFertilizerOwner('9000', to18('0.001'), '0')
      await this.fertilizer.connect(owner).addFertilizerOwner('6174', to18('0.001'), '0')
      await this.season.rewardToFertilizerE(to6('2.5'))
      await this.fertilizer.connect(owner).addFertilizerOwner('7000', to18('0.001'), '0')
      await this.fertilizer.connect(owner).addFertilizerOwner('0', to18('0.001'), '0')
    })

    it('properly sorts fertilizer', async function () {
      expect(await this.fertilizer.getFirst()).to.be.equal(to6('1.2'))
      expect(await this.fertilizer.getLast()).to.be.equal(to6('6.5'))
      expect(await this.fertilizer.getNext(to6('1.2'))).to.be.equal(to6('1.7'))
      expect(await this.fertilizer.getNext(to6('1.7'))).to.be.equal(to6('2'))
      expect(await this.fertilizer.getNext(to6('2'))).to.be.equal(to6('2.5'))
      expect(await this.fertilizer.getNext(to6('2.5'))).to.be.equal(to6('3'))
      expect(await this.fertilizer.getNext(to6('3'))).to.be.equal(to6('6.5'))
      expect(await this.fertilizer.getNext(to6('6.5'))).to.be.equal(0)
    })

    it('gets fertilizers', async function () {
      const fertilizers = await this.fertilizer.getFertilizers()
      expect(`${fertilizers}`).to.be.equal('1200000,2,1700000,1,2000000,1,2500000,1,3000000,1,6500000,1')
    })
  })

  describe("Mint Fertilizer", async function () {
    it('Reverts if mints 0', async function () {
      await this.season.teleportSunrise('6274')
      await expect(this.fertilizer.connect(user).mintFertilizer('0', '0', '0', EXTERNAL)).to.be.revertedWith('Fertilizer: None bought.')
    })

    describe('1 mint', async function () {
      beforeEach(async function () {
        await this.season.teleportSunrise('6274')
        this.result = await this.fertilizer.connect(user).mintFertilizer(to18('0.1'), '0', '0', EXTERNAL)
        this.lpBeans = lpBeansForUsdc('100')
      })

      it("updates totals", async function () {
        expect(await this.fertilizer.totalUnfertilizedBeans()).to.be.equal(to6('250'))
        expect(await this.fertilizer.getFirst()).to.be.equal(to6('2.5'))
        expect(await this.fertilizer.getNext(to6('2.5'))).to.be.equal(0)
        expect(await this.fertilizer.getActiveFertilizer()).to.be.equal('100')
        expect(await this.fertilizer.isFertilizing()).to.be.equal(true)
        expect(await this.fertilizer.remainingRecapitalization()).to.be.equal(to6('400'))
      })

      it('updates token balances', async function () {
        expect(await this.bean.balanceOf(this.fertilizer.address)).to.be.equal(to6('200'))
        expect(await this.well.balanceOf(this.fertilizer.address)).to.be.equal('2943834234463618707')

        expect(await this.weth.balanceOf(this.well.address)).to.be.equal(to18('0.1'))
        expect(await this.bean.balanceOf(this.well.address)).to.be.equal(this.lpBeans)
      })

      it('updates underlying balances', async function () {
        expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6('200'))
        expect(await this.unripe.getTotalUnderlying(UNRIPE_LP)).to.be.equal(await this.well.balanceOf(this.fertilizer.address))
      })

      it('updates fertizer amount', async function () {
        expect(await this.fertilizer.getFertilizer(to6('2.5'))).to.be.equal('100')
      })

      it ('mints fetilizer', async function () {
        expect(await this.fert.balanceOf(user.address, to6('2.5'))).to.be.equal('100')
        const balance = await this.fert.lastBalanceOf(user.address, to6('2.5'))
        expect(balance[0]).to.be.equal('100')
        expect(balance[1]).to.be.equal(0)
      })

      it('updates fertilizer getters', async function () {
        expect(await this.fert.remaining()).to.be.equal(to6('400'))
        expect(await this.fert.getMintId()).to.be.equal(to6('2.5'))
      })
    })

    describe('2 mints', async function () {
      beforeEach(async function () {
        await this.season.teleportSunrise('6274')
        this.result = await this.fertilizer.connect(user).mintFertilizer(to18('0.05'), '0', '0', EXTERNAL)
        this.result = await this.fertilizer.connect(user).mintFertilizer(to18('0.05'), '0', '0', EXTERNAL)
        this.lpBeans = lpBeansForUsdc('100');
      })

      it("updates totals", async function () {
        expect(await this.fertilizer.totalUnfertilizedBeans()).to.be.equal(to6('250'))
        expect(await this.fertilizer.getFirst()).to.be.equal(to6('2.5'))
        expect(await this.fertilizer.getNext(to6('2.5'))).to.be.equal(0)
        expect(await this.fertilizer.getActiveFertilizer()).to.be.equal('100')
        expect(await this.fertilizer.isFertilizing()).to.be.equal(true)
        expect(await this.fertilizer.remainingRecapitalization()).to.be.equal(to6('400'))
      })

      it('updates token balances', async function () {
        expect(await this.bean.balanceOf(this.fertilizer.address)).to.be.equal('199999999') // Rounds down
        expect(await this.well.balanceOf(this.fertilizer.address)).to.be.equal('2943834234463618707')

        expect(await this.weth.balanceOf(this.well.address)).to.be.equal(to18('0.1'))
        expect(await this.bean.balanceOf(this.well.address)).to.be.equal(this.lpBeans)
      })

      it('updates underlying balances', async function () {
        expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal('199999999') // Rounds down
        expect(await this.unripe.getTotalUnderlying(UNRIPE_LP)).to.be.equal(await this.well.balanceOf(this.fertilizer.address))
      })

      it('updates fertizer amount', async function () {
        expect(await this.fertilizer.getFertilizer(to6('2.5'))).to.be.equal('100')
      })

      it ('mints fetilizer', async function () {
        expect(await this.fert.balanceOf(user.address, to6('2.5'))).to.be.equal('100')
        const balance = await this.fert.lastBalanceOf(user.address, to6('2.5'))
        expect(balance[0]).to.be.equal('100')
        expect(balance[1]).to.be.equal(0)
      })

      it('updates fertilizer getters', async function () {
        expect(await this.fert.remaining()).to.be.equal(to6('400'))
        expect(await this.fert.getMintId()).to.be.equal(to6('2.5'))
      })
    })
    
    describe("2 mint with season in between", async function () {
      beforeEach(async function () {
        await this.season.teleportSunrise('6074')
        await this.fertilizer.connect(user).mintFertilizer(to18('0.1'), '0', '0', EXTERNAL)
        await this.season.rewardToFertilizerE(to6('50'))
        await this.season.teleportSunrise('6274')
        this.result = await this.fertilizer.connect(user).mintFertilizer(to18('0.1'), '0', '0', EXTERNAL)
        this.lpBeans = lpBeansForUsdc('100').add(lpBeansForUsdc('100'))
      })

      it("updates totals", async function () {
        expect(await this.fertilizer.totalFertilizerBeans()).to.be.equal(to6('600'))
        expect(await this.fertilizer.totalFertilizedBeans()).to.be.equal(to6('50'))
        expect(await this.fertilizer.getFirst()).to.be.equal(to6('3'))
        expect(await this.fertilizer.getNext(to6('3'))).to.be.equal(to6('3.5'))
        expect(await this.fertilizer.getActiveFertilizer()).to.be.equal('200')
        expect(await this.fertilizer.isFertilizing()).to.be.equal(true)
        expect(await this.fertilizer.remainingRecapitalization()).to.be.equal(to6('300'))
      })

      it('updates token balances', async function () {
        expect(await this.bean.balanceOf(this.fertilizer.address)).to.be.equal(to6('450'))
        expect(await this.well.balanceOf(this.fertilizer.address)).to.be.equal('5887668468927237414')

        expect(await this.weth.balanceOf(this.well.address)).to.be.equal(to18('0.2'))
        expect(await this.bean.balanceOf(this.well.address)).to.be.equal(this.lpBeans)
      })

      it('updates underlying balances', async function () {
        expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6('400'))
        expect(await this.unripe.getTotalUnderlying(UNRIPE_LP)).to.be.equal(await this.well.balanceOf(this.fertilizer.address))
      })

      it('updates fertizer amount', async function () {
        expect(await this.fertilizer.getFertilizer(to6('3.5'))).to.be.equal('100')
        expect(await this.fertilizer.getFertilizer(to6('3'))).to.be.equal('100')
      })

      it ('mints fetilizer', async function () {
        expect(await this.fert.balanceOf(user.address, to6('3.5'))).to.be.equal('100')
        let balance = await this.fert.lastBalanceOf(user.address, to6('3.5'))
        expect(balance[0]).to.be.equal('100')
        expect(balance[1]).to.be.equal(0)
        expect(await this.fert.balanceOf(user.address, to6('3'))).to.be.equal('100')
        balance = await this.fert.lastBalanceOf(user.address, to6('3'))
        expect(balance[0]).to.be.equal('100')
        expect(balance[1]).to.be.equal(to6('0.5'))
      })

      it('updates fertilizer getters', async function () {
        expect(await this.fert.remaining()).to.be.equal(to6('300'))
        expect(await this.fert.getMintId()).to.be.equal(to6('3'))
      })
    })

    describe("2 mint with same id", async function () {
      beforeEach(async function () {
        await this.season.teleportSunrise('6074')
        await this.fertilizer.connect(user).mintFertilizer(to18('0.1'), '0', '0', EXTERNAL)
        await this.season.rewardToFertilizerE(to6('50'))
        await this.season.teleportSunrise('6174')
        this.result = await this.fertilizer.connect(user).mintFertilizer(to18('0.1'), '0', '0', EXTERNAL)
        this.lpBeans = lpBeansForUsdc('100').add(lpBeansForUsdc('100'))
      })

      it("updates totals", async function () {
        expect(await this.fertilizer.totalFertilizerBeans()).to.be.equal(to6('650'))
        expect(await this.fertilizer.totalFertilizedBeans()).to.be.equal(to6('50'))
        expect(await this.fertilizer.getFirst()).to.be.equal(to6('3.5'))
        expect(await this.fertilizer.getNext(to6('3'))).to.be.equal(to6('0'))
        expect(await this.fertilizer.getActiveFertilizer()).to.be.equal('200')
        expect(await this.fertilizer.isFertilizing()).to.be.equal(true)
        expect(await this.fertilizer.remainingRecapitalization()).to.be.equal(to6('300'))
      })

      it('updates token balances', async function () {
        expect(await this.bean.balanceOf(this.fertilizer.address)).to.be.equal(to6('450'))
        expect(await this.well.balanceOf(this.fertilizer.address)).to.be.equal('5887668468927237414')

        expect(await this.weth.balanceOf(this.well.address)).to.be.equal(to18('0.2'))
        expect(await this.bean.balanceOf(this.well.address)).to.be.equal(this.lpBeans)
      })

      it('updates underlying balances', async function () {
        expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6('400'))
        expect(await this.unripe.getTotalUnderlying(UNRIPE_LP)).to.be.equal(await this.well.balanceOf(this.fertilizer.address))
      })

      it('updates fertizer amount', async function () {
        expect(await this.fertilizer.getFertilizer(to6('3.5'))).to.be.equal('200')
      })

      it('mints fetilizer', async function () {
        expect(await this.fert.balanceOf(user.address, to6('3.5'))).to.be.equal('200')
        let balance = await this.fert.lastBalanceOf(user.address, to6('3.5'))
        expect(balance[0]).to.be.equal('200')
        expect(balance[1]).to.be.equal(to6('0.5'))
      })

      it('updates fertilizer getters', async function () {
        expect(await this.fert.remaining()).to.be.equal(to6('300'))
        expect(await this.fert.getMintId()).to.be.equal(to6('3.5'))
      })

      it('updates claims fertilized Beans', async function () {
        expect(await this.token.getInternalBalance(user.address, this.bean.address)).to.be.equal(to6('50'))
      })
    })

    describe("2 mint with same id and claim", async function () {
      beforeEach(async function () {
        await this.season.teleportSunrise('6074')
        await this.fertilizer.connect(user).mintFertilizer(to18('0.1'), '0', '0', EXTERNAL)
        await this.season.rewardToFertilizerE(to6('50'))
        await this.season.teleportSunrise('6174')
        await this.fertilizer.connect(user).claimFertilized([to6('3.5')], INTERNAL)
        this.result = await this.fertilizer.connect(user).mintFertilizer(to18('0.1'), '0', '0', EXTERNAL)
      })

      it('updates claims fertilized Beans', async function () {
        expect(await this.token.getInternalBalance(user.address, this.bean.address)).to.be.equal(to6('50'))
      })
    })
  })

  describe("Fertilize", async function () {
    beforeEach(async function () {
      await this.season.teleportSunrise('6274')
      this.result = await this.fertilizer.connect(user).mintFertilizer(to18('0.1'), '0', '0', EXTERNAL)
    })

    it('gets fertilizable', async function () {
      expect(await this.fertilizer.balanceOfFertilized(userAddress, [to6('3.5')])).to.be.equal('0')
    })

    it('gets fertilizable', async function () {
      await this.season.rewardToFertilizerE(to6('50'))
      expect(await this.fertilizer.balanceOfFertilized(userAddress, [to6('2.5')])).to.be.equal(to6('50'))
    });

    describe("no Beans", async function () {
      beforeEach(async function() {
        const beansBefore = await this.bean.balanceOf(this.fertilizer.address)
        await this.fertilizer.connect(user).claimFertilized([to6('2.5')], EXTERNAL)
        this.deltaBeanstalkBeans = (await this.bean.balanceOf(this.fertilizer.address)).sub(beansBefore)
      })

      it('transfer balances', async function () {
        expect(await this.bean.balanceOf(user.address)).to.be.equal("0")
        expect(this.deltaBeanstalkBeans).to.be.equal('0')
      })

      it('gets balances', async function () {
        expect(await this.fertilizer.balanceOfFertilized(userAddress, [to6('2.5')])).to.be.equal('0')
        const f = await this.fertilizer.balanceOfFertilizer(userAddress, to6('2.5'))
        expect(f.amount).to.be.equal('100')
        expect(f.lastBpf).to.be.equal('0')
        const batchBalance = await this.fertilizer.balanceOfBatchFertilizer([userAddress], [to6('2.5')]);
        expect(batchBalance[0].amount).to.be.equal('100')
        expect(batchBalance[0].lastBpf).to.be.equal('0')
      })
    })

    describe("Some Beans", async function () {
      beforeEach(async function() {
        await this.season.rewardToFertilizerE(to6('50'))
        const beansBefore = await this.bean.balanceOf(this.fertilizer.address)
        await this.fertilizer.connect(user).claimFertilized([to6('2.5')], EXTERNAL)
        this.deltaBeanstalkBeans = (await this.bean.balanceOf(this.fertilizer.address)).sub(beansBefore)
      })

      it('transfer balances', async function () {
        expect(await this.bean.balanceOf(user.address)).to.be.equal(to6('50'))
        expect(this.deltaBeanstalkBeans).to.be.equal(to6('-50'))
      })

      it('gets balances', async function () {
        expect(await this.fertilizer.balanceOfFertilized(userAddress, [to6('2.5')])).to.be.equal('0')
        const f = await this.fertilizer.balanceOfFertilizer(userAddress, to6('2.5'))
        expect(f.amount).to.be.equal('100')
        expect(f.lastBpf).to.be.equal(to6('0.5'))
        const batchBalance = await this.fertilizer.balanceOfBatchFertilizer([userAddress], [to6('2.5')]);
        expect(batchBalance[0].amount).to.be.equal('100')
        expect(batchBalance[0].lastBpf).to.be.equal(to6('0.5'))
      })
    })

    describe("All Beans", async function () {
      beforeEach(async function() {
        await this.season.rewardToFertilizerE(to6('250'))
        const beansBefore = await this.bean.balanceOf(this.fertilizer.address)
        await this.fertilizer.connect(user).claimFertilized([to6('2.5')], EXTERNAL)
        this.deltaBeanstalkBeans = (await this.bean.balanceOf(this.fertilizer.address)).sub(beansBefore)
      })

      it('transfer balances', async function () {
        expect(await this.bean.balanceOf(user.address)).to.be.equal(to6('250'))
        expect(this.deltaBeanstalkBeans).to.be.equal(to6('-250'))
      })

      it('gets balances', async function () {
        expect(await this.fertilizer.balanceOfFertilized(userAddress, [to6('2.5')])).to.be.equal('0')
        expect(await this.fertilizer.balanceOfUnfertilized(userAddress, [to6('2.5'), to6('1.5')])).to.be.equal('0')
        const f = await this.fertilizer.balanceOfFertilizer(userAddress, to6('2.5'))
        expect(f.amount).to.be.equal('100')
        expect(f.lastBpf).to.be.equal(to6('2.5'))
        const batchBalance = await this.fertilizer.balanceOfBatchFertilizer([userAddress], [to6('2.5')]);
        expect(batchBalance[0].amount).to.be.equal('100')
        expect(batchBalance[0].lastBpf).to.be.equal(to6('2.5'))
      })
    })

    describe("Rest of Beans", async function () {
      beforeEach(async function() {
        await this.season.rewardToFertilizerE(to6('200'))
        await this.season.teleportSunrise('6474')
        this.result = await this.fertilizer.connect(user).mintFertilizer(to18('0.1'), '0', '0', EXTERNAL)
        await this.fertilizer.connect(user).claimFertilized([to6('2.5')], EXTERNAL)
        await this.season.rewardToFertilizerE(to6('150'))

        const beansBefore = await this.bean.balanceOf(this.fertilizer.address)
        await this.fertilizer.connect(user).claimFertilized([to6('2.5')], EXTERNAL)
        this.deltaBeanstalkBeans = (await this.bean.balanceOf(this.fertilizer.address)).sub(beansBefore)
      })

      it('transfer balances', async function () {
        expect(await this.bean.balanceOf(user.address)).to.be.equal(to6('250'))
        expect(this.deltaBeanstalkBeans).to.be.equal(to6('-50'))
      })

      it('gets balances', async function () {
        expect(await this.fertilizer.balanceOfFertilized(userAddress, [to6('2.5'), to6('3.5')])).to.be.equal(to6('100'))
        expect(await this.fertilizer.balanceOfUnfertilized(userAddress, [to6('2.5'), to6('3.5')])).to.be.equal(to6('50'))
        const batchBalance = await this.fertilizer.balanceOfBatchFertilizer([userAddress, userAddress], [to6('2.5'), to6('3.5')]);
        expect(batchBalance[0].amount).to.be.equal('100')
        expect(batchBalance[0].lastBpf).to.be.equal(to6('2.5'))
        expect(batchBalance[1].amount).to.be.equal('100')
        expect(batchBalance[1].lastBpf).to.be.equal(to6('2'))
      })
    })

    describe("Rest of Beans and new Fertilizer", async function () {
      beforeEach(async function() {
        await this.season.rewardToFertilizerE(to6('200'))
        await this.season.teleportSunrise('6474')
        this.result = await this.fertilizer.connect(user).mintFertilizer(to18('0.1'), '0', '0', EXTERNAL)
        await this.fertilizer.connect(user).claimFertilized([to6('2.5')], EXTERNAL)
        await this.season.rewardToFertilizerE(to6('150'))

        const beansBefore = await this.bean.balanceOf(this.fertilizer.address)
        await this.fertilizer.connect(user).claimFertilized([to6('2.5'), to6('3.5')], EXTERNAL)
        this.deltaBeanstalkBeans = (await this.bean.balanceOf(this.fertilizer.address)).sub(beansBefore)
      })

      it('transfer balances', async function () {
        expect(await this.bean.balanceOf(user.address)).to.be.equal(to6('350'))
        expect(this.deltaBeanstalkBeans).to.be.equal(to6('-150'))
      })

      it('gets balances', async function () {
        expect(await this.fertilizer.balanceOfFertilized(userAddress, [to6('2.5'), to6('3.5')])).to.be.equal('0')
        expect(await this.fertilizer.balanceOfUnfertilized(userAddress, [to6('2.5'), to6('3.5')])).to.be.equal(to6('50'))
        const batchBalance = await this.fertilizer.balanceOfBatchFertilizer([userAddress, userAddress], [to6('2.5'), to6('3.5')]);
        expect(batchBalance[0].amount).to.be.equal('100')
        expect(batchBalance[0].lastBpf).to.be.equal(to6('2.5'))
        expect(batchBalance[1].amount).to.be.equal('100')
        expect(batchBalance[1].lastBpf).to.be.equal(to6('3'))
      })
    })

    describe("all of both", async function () {
      beforeEach(async function() {
        await this.season.rewardToFertilizerE(to6('200'))
        await this.season.teleportSunrise('6474')
        this.result = await this.fertilizer.connect(user).mintFertilizer(to18('0.1'), '0', '0', EXTERNAL)
        await this.fertilizer.connect(user).claimFertilized([to6('2.5')], EXTERNAL)
        await this.season.rewardToFertilizerE(to6('200'))

        const beansBefore = await this.bean.balanceOf(this.fertilizer.address)
        await this.fertilizer.connect(user).claimFertilized([to6('2.5'), to6('3.5')], EXTERNAL)
        this.deltaBeanstalkBeans = (await this.bean.balanceOf(this.fertilizer.address)).sub(beansBefore)
      })

      it('transfer balances', async function () {
        expect(await this.bean.balanceOf(user.address)).to.be.equal(to6('400'))
        expect(this.deltaBeanstalkBeans).to.be.equal(to6('-200'))
      })

      it('gets balances', async function () {
        expect(await this.fertilizer.balanceOfFertilized(userAddress, [to6('2.5'), to6('3.5')])).to.be.equal('0')
        expect(await this.fertilizer.balanceOfUnfertilized(userAddress, [to6('2.5'), to6('3.5')])).to.be.equal(to6('0'))
        const batchBalance = await this.fertilizer.balanceOfBatchFertilizer([userAddress, userAddress], [to6('2.5'), to6('3.5')]);
        expect(batchBalance[0].amount).to.be.equal('100')
        expect(batchBalance[0].lastBpf).to.be.equal(to6('2.5'))
        expect(batchBalance[1].amount).to.be.equal('100')
        expect(batchBalance[1].lastBpf).to.be.equal(to6('3.5'))
      })
    })
  })

  describe("Transfer", async function () {
    beforeEach(async function () {
      await this.season.teleportSunrise('6274')
      this.result = await this.fertilizer.connect(user).mintFertilizer(to18('0.1'), '0', '0', EXTERNAL)
    })

    describe("no fertilized", async function () {
      beforeEach(async function () {
        await this.fert.connect(user).safeTransferFrom(user.address, user2.address, to6('2.5'), '50', ethers.constants.HashZero)
      })

      it("transfers fertilizer", async function () {
        expect(await this.fert.balanceOf(user.address, to6('2.5'))).to.equal('50')
        expect(await this.fert.balanceOf(user2.address, to6('2.5'))).to.equal('50')
      })
    })

    describe("Some Beans", async function () {
      beforeEach(async function() {
        await this.season.rewardToFertilizerE(to6('50'))
        await this.fert.connect(user).safeTransferFrom(user.address, user2.address, to6('2.5'), '50', ethers.constants.HashZero)
      })

      it('transfer balances', async function () {
        expect(await this.token.getInternalBalance(user.address, BEAN)).to.be.equal(to6('50'))
        expect(await this.token.getInternalBalance(user2.address, BEAN)).to.be.equal(to6('0'))
      })

      it('gets balances', async function () {
        expect(await this.fertilizer.balanceOfFertilized(userAddress, [to6('2.5')])).to.be.equal('0')
        expect(await this.fertilizer.balanceOfUnfertilized(userAddress, [to6('2.5')])).to.be.equal(to6('100'))
        expect(await this.fertilizer.balanceOfFertilized(user2Address, [to6('2.5')])).to.be.equal('0')
        expect(await this.fertilizer.balanceOfUnfertilized(user2Address, [to6('2.5')])).to.be.equal(to6('100'))
      })

      it("transfers fertilizer", async function () {
        expect(await this.fert.balanceOf(user.address, to6('2.5'))).to.equal('50')
        expect(await this.fert.balanceOf(user2.address, to6('2.5'))).to.equal('50')
      })
    })

    describe("All Beans", async function () {
      beforeEach(async function() {
        await this.season.rewardToFertilizerE(to6('250'))
        await this.fert.connect(user).safeTransferFrom(user.address, user2.address, to6('2.5'), '50', ethers.constants.HashZero)
      })

      it('transfer balances', async function () {
        expect(await this.token.getInternalBalance(user.address, BEAN)).to.be.equal(to6('250'))
        expect(await this.token.getInternalBalance(user2.address, BEAN)).to.be.equal(to6('0'))
      })

      it('gets balances', async function () {
        expect(await this.fertilizer.balanceOfFertilized(userAddress, [to6('2.5')])).to.be.equal('0')
        expect(await this.fertilizer.balanceOfUnfertilized(userAddress, [to6('2.5')])).to.be.equal(to6('0'))
        expect(await this.fertilizer.balanceOfFertilized(user2Address, [to6('2.5')])).to.be.equal('0')
        expect(await this.fertilizer.balanceOfUnfertilized(user2Address, [to6('2.5')])).to.be.equal(to6('0'))
      })

      it("transfers fertilizer", async function () {
        expect(await this.fert.balanceOf(user.address, to6('2.5'))).to.equal('50')
        expect(await this.fert.balanceOf(user2.address, to6('2.5'))).to.equal('50')
      })
    })

    describe("Both some Beans", async function () {
      beforeEach(async function() {
        this.result = await this.fertilizer.connect(user2).mintFertilizer(to18('0.1'), '0', '0', EXTERNAL)
        await this.season.rewardToFertilizerE(to6('100'))
        await this.fert.connect(user).safeTransferFrom(user.address, user2.address, to6('2.5'), '50', ethers.constants.HashZero)
      })

      it('transfer balances', async function () {
        expect(await this.token.getInternalBalance(user.address, BEAN)).to.be.equal(to6('50'))
        expect(await this.token.getInternalBalance(user2.address, BEAN)).to.be.equal(to6('50'))
      })

      it('gets balances', async function () {
        expect(await this.fertilizer.balanceOfFertilized(userAddress, [to6('2.5')])).to.be.equal('0')
        expect(await this.fertilizer.balanceOfUnfertilized(userAddress, [to6('2.5')])).to.be.equal(to6('100'))
        expect(await this.fertilizer.balanceOfFertilized(user2Address, [to6('2.5')])).to.be.equal('0')
        expect(await this.fertilizer.balanceOfUnfertilized(user2Address, [to6('2.5')])).to.be.equal(to6('300'))
      })

      it("transfers fertilizer", async function () {
        expect(await this.fert.balanceOf(user.address, to6('2.5'))).to.equal('50')
        expect(await this.fert.balanceOf(user2.address, to6('2.5'))).to.equal('150')
      })
    })

    describe("2 different types some Beans", async function () {
      beforeEach(async function() {
        await this.season.rewardToFertilizerE(to6('200'))
        await this.season.teleportSunrise('6474')
        this.result = await this.fertilizer.connect(user).mintFertilizer(to18('0.1'), '0', '0', EXTERNAL)
        await this.season.rewardToFertilizerE(to6('150'))
        await this.fert.connect(user).safeBatchTransferFrom(user.address, user2.address, [to6('2.5'), to6('3.5')], ['50', '50'], ethers.constants.HashZero)
      })

      it('transfer balances', async function () {
        expect(await this.token.getInternalBalance(user.address, BEAN)).to.be.equal(to6('350'))
        expect(await this.token.getInternalBalance(user2.address, BEAN)).to.be.equal(to6('0'))
      })

      it('gets balances', async function () {
        expect(await this.fertilizer.balanceOfFertilized(userAddress, [to6('2.5'), to6('3.5')])).to.be.equal('0')
        expect(await this.fertilizer.balanceOfUnfertilized(userAddress, [to6('2.5'), to6('3.5')])).to.be.equal(to6('25'))
        expect(await this.fertilizer.balanceOfFertilized(user2Address, [to6('2.5'), to6('3.5')])).to.be.equal('0')
        expect(await this.fertilizer.balanceOfUnfertilized(user2Address, [to6('2.5'), to6('3.5')])).to.be.equal(to6('25'))
      })

      it("transfers fertilizer", async function () {
        let b = await this.fert.balanceOfBatch([user.address, user.address, user2.address, user2.address], [to6('2.5'), to6('3.5'), to6('2.5'), to6('3.5')])
        expect(b[0]).to.be.equal('50')
        expect(b[1]).to.be.equal('50')
        expect(b[2]).to.be.equal('50')
        expect(b[3]).to.be.equal('50')
      })
    })

    describe("Both some Beans", async function () {
      beforeEach(async function() {
        this.result = await this.fertilizer.connect(user2).mintFertilizer(to18('0.1'), '0', '0', EXTERNAL)
        await this.season.rewardToFertilizerE(to6('400'))
        await this.season.teleportSunrise('6474')
        this.result = await this.fertilizer.connect(user).mintFertilizer(to18('0.1'), '0', '0', EXTERNAL)
        this.result = await this.fertilizer.connect(user2).mintFertilizer(to18('0.1'), '0', '0', EXTERNAL)
        await this.season.rewardToFertilizerE(to6('300'))
        await this.fert.connect(user).safeBatchTransferFrom(user.address, user2.address, [to6('2.5'), to6('3.5')], ['50', '50'], ethers.constants.HashZero)
      })

      it('transfer balances', async function () {
        expect(await this.token.getInternalBalance(user.address, BEAN)).to.be.equal(to6('350'))
        expect(await this.token.getInternalBalance(user2.address, BEAN)).to.be.equal(to6('350'))
      })

      it('gets balances', async function () {
        expect(await this.fertilizer.balanceOfFertilized(userAddress, [to6('2.5'), to6('3.5')])).to.be.equal('0')
        expect(await this.fertilizer.balanceOfUnfertilized(userAddress, [to6('2.5'), to6('3.5')])).to.be.equal(to6('25'))
        expect(await this.fertilizer.balanceOfFertilized(user2Address, [to6('2.5'), to6('3.5')])).to.be.equal('0')
        expect(await this.fertilizer.balanceOfUnfertilized(user2Address, [to6('2.5'), to6('3.5')])).to.be.equal(to6('75'))
      })

      it("transfers fertilizer", async function () {
        let b = await this.fert.balanceOfBatch([user.address, user.address, user2.address, user2.address], [to6('2.5'), to6('3.5'), to6('2.5'), to6('3.5')])
        expect(b[0]).to.be.equal('50')
        expect(b[1]).to.be.equal('50')
        expect(b[2]).to.be.equal('150')
        expect(b[3]).to.be.equal('150')
      })
    })

// ----------------- ON-CHAIN FERT METADATA -----------------------

    // describe("2 mints with different ids and uris", async function () {
    //   let mintOneReceipt, mintTwoReceipt;
    //   beforeEach(async function () {
    //     await this.season.teleportSunrise("6074");
    //     const mintOneTx = await this.fertilizer
    //       .connect(user)
    //       .mintFertilizer("100", "0", EXTERNAL);
    //     mintOneReceipt = await mintOneTx.wait();
    //     await this.season.rewardToFertilizerE(to6("50"));
    //     await this.season.teleportSunrise("6174");
    //     await this.fertilizer
    //       .connect(user)
    //       .claimFertilized([to6("3.5")], INTERNAL);
    //     const mintTwoTx = await this.fertilizer
    //       .connect(user)
    //       .mintFertilizer("25", "0", EXTERNAL);
    //     mintTwoReceipt = await mintTwoTx.wait();
    //   });
  
    //   it("sets on-chain metadata and token URIs", async function () {
    //     const tokenId = ethers.BigNumber.from(
    //       mintTwoReceipt.events[15].data.substring(0, 66)
    //     ).toString();
  
    //     const uri = await this.fert.uri(tokenId);
    //     const response = await axios.get(uri);
    //     jsonResponse = JSON.parse(response.data.toString());
  
    //     expect(jsonResponse.name).to.be.equal(`Fertilizer - ${tokenId}`);
    //     expect(jsonResponse.image).to.be.equal(dataImage);
    //   });
    // });

    describe.only('uri test', async function () {
      beforeEach(async function () {
        console.log('before each')
      })

      it("returns uri", async function () {
        const dataImage = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjk0IiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDI5NCA1MTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiPjxwYXRoIGQ9Ik0xNjQuNDcgMzI3LjI0MUwyOC42MjQ3IDQwNS43NjhMMjcuNzQ3MSAxODQuMjE3TDE2My41OTYgMTA1LjY1OEwxNjQuNDcgMzI3LjI0MVoiIGZpbGw9IiMzREFBNDciLz48cGF0aCBkPSJNMTE4LjA1OSAzNTQuMDc3TDc2Ljk1NzQgMzc3LjgyM0w3Ni4wODMgMTU2LjI3MkwxMTcuMTg0IDEzMi40OTRMMTE4LjA1OSAzNTQuMDc3WiIgZmlsbD0iIzNEQUE0NyIvPjxwYXRoIGQ9Ik0yNi44MjQ3IDE4NC4yNDJMMjcuNjk1OCA0MDUuODA5TDEyMS4wNjIgNDYwLjE0OEwxMjAuMTkxIDIzOC41ODRMMjYuODI0NyAxODQuMjQyWiIgZmlsbD0iIzNEQjU0MiIvPjxwYXRoIGQ9Ik0xNjMuMjU3IDEwNS45OEwxNjQuMTI4IDMyNy41NDhMMjU3LjQ5NSAzODEuODg2TDI1Ni42MjQgMTYwLjMyMkwxNjMuMjU3IDEwNS45OFoiIGZpbGw9IiMzREI1NDIiLz48cGF0aCBkPSJNMjU2Ljg5OCAzODEuNjA5TDEyMS4wNTIgNDYwLjEzNkwxMjAuMTc1IDIzOC41ODVMMjU2LjAyNCAxNjAuMDI1TDI1Ni44OTggMzgxLjYwOVoiIGZpbGw9IiM2RENCNjAiLz48cGF0aCBkPSJNMjEwLjQ4NiA0MDguNDQ1TDE2OS4zODUgNDMyLjE5TDE2OC41MSAyMTAuNjM5TDIwOS42MTIgMTg2Ljg2MUwyMTAuNDg2IDQwOC40NDVaIiBmaWxsPSIjM0RBQTQ3Ii8+PHBhdGggZD0iTTI0MC45MDEgMzY0Ljk0OUwxMzYuNDk0IDQyNS4zMzdMMTM2LjE3MSAyNjcuODU5TDI0MC41NzkgMjA3LjUwOEwyNDAuOTAxIDM2NC45NDlaIiBmaWxsPSJ3aGl0ZSIvPjxwYXRoIGQ9Ik0xOTUuNzg5IDI2OC4wMjVDMjE4LjkyNiAyNjEuMzExIDIzMi42NjQgMjc4LjY1NiAyMjguMDk1IDMwMy4yNThDMjI0LjA3NSAzMjQuOTEgMjA2Ljc0MyAzNDYuMTAzIDE4OC4zMjYgMzUzLjA3OUMxNjkuMTU1IDM2MC4zMzkgMTUyLjYwOSAzNTAuODExIDE1Mi4wMjkgMzI5LjExM0MxNTEuMzY0IDMwNC4xOTEgMTcxLjQ0MiAyNzUuMDkyIDE5NS43ODkgMjY4LjAyNVoiIGZpbGw9IiM0NkI5NTUiLz48cGF0aCBkPSJNMjA2LjQxNyAyNzUuNjE1TDE3OC4zMzcgMzQ5LjE5MkMxNzguMzM3IDM0OS4xOTIgMTUzLjc2OCAzMTMuNzk1IDIwNi40MTcgMjc1LjYxNVoiIGZpbGw9IndoaXRlIi8+PHBhdGggZD0iTTE4My4zOSAzNDMuOTc3TDIwMi45NTEgMjkzLjA2MUMyMDIuOTUxIDI5My4wNjEgMjI2Ljc4MiAzMTAuMjUgMTgzLjM5IDM0My45NzdaIiBmaWxsPSJ3aGl0ZSIvPjxyZWN0IHdpZHRoPSI3OC4zMjg0IiBoZWlnaHQ9IjY4LjQ3NjgiIHRyYW5zZm9ybT0ibWF0cml4KDAuOTk2NzMxIDAuMDgwNzk3NiAtMC4wODA1NjI3IDAuOTk2NzUgMTU0LjIxNiAzMzYuMTY2KSIgZmlsbD0idXJsKCNwYXR0ZXJuMCkiLz48ZGVmcz48cGF0dGVybiBpZD0icGF0dGVybjAiIHBhdHRlcm5Db250ZW50VW5pdHM9Im9iamVjdEJvdW5kaW5nQm94IiB3aWR0aD0iMSIgaGVpZ2h0PSIxIj48dXNlIHhsaW5rOmhyZWY9IiNpbWFnZTBfMTAzNDlfMTA1MDMxIiB0cmFuc2Zvcm09InNjYWxlKDAuMDAzMjU3MzMgMC4wMDM3MzEzNCkiLz48L3BhdHRlcm4+PC9kZWZzPjx0ZXh0IGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjIwIiB4PSIyMCIgeT0iNDkwIiBmaWxsPSJibGFjayIgPjx0c3BhbiBkeT0iMCIgeD0iMjAiPiAzNDAyODIzNjY5MjA5Mzg0NjM0NjMzNzQ2MDc0MzE3NjUyMTE0NTYgQlBGIFJlbWFpbmluZyA8L3RzcGFuPjwvdGV4dD48L3N2Zz4=";
        const tokenId = '1';
        const uri = await this.fert.uri(tokenId);
        console.log("------------------ URI RETURNED BY CONTRACT ------------------")
        console.log(uri)
        console.log("------------------ HTTP RESPONSE TO URI TO GET JSON OBJ ------------------")
        const response = await axios.get(uri);
        let jsonResponse = JSON.parse(response.data.toString());
        console.log(jsonResponse)
  
        expect(jsonResponse.name).to.be.equal(`Fertilizer - ${tokenId}`);
        expect(jsonResponse.image).to.be.equal(dataImage);

        
      })
    })


  })
})