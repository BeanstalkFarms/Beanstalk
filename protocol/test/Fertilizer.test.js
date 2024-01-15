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
        const dataImage = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjk0IiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDI5NCA1MTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiPjxwYXRoIGQ9Ik0yNi44MjQ3IDE4NC4yNDRMMjcuNjk1OCA0MDUuODExTDEyMS4wNjIgNDYwLjE1TDEyMC4xOTEgMjM4LjU4NkwyNi44MjQ3IDE4NC4yNDRaIiBmaWxsPSIjM0RCNTQyIi8+PHBhdGggZD0iTTI1Ni44OTggMzgxLjYxMUwxMjEuMDUyIDQ2MC4xMzhMMTIwLjE3NSAyMzguNTg3TDI1Ni4wMjQgMTYwLjAyN0wyNTYuODk4IDM4MS42MTFaIiBmaWxsPSIjNkRDQjYwIi8+PHBhdGggZD0iTTIxMC40ODYgNDA4LjQ0NUwxNjkuMzg1IDQzMi4xOUwxNjguNTEgMjEwLjYzOUwyMDkuNjEyIDE4Ni44NjFMMjEwLjQ4NiA0MDguNDQ1WiIgZmlsbD0iIzNEQUE0NyIvPjxwYXRoIGQ9Ik03Ni42MzQzIDE2Mi45MTVMMjExLjk5OSA4NC4xMzI4TDI1Ni4wMzMgMTYwLjA0MkwxMjAuMTkxIDIzOC41ODZMNzYuNjM0MyAxNjIuOTE1WiIgZmlsbD0iIzgxRDY3MiIvPjxwYXRoIGQ9Ik0xMjQuOTY2IDEzNC45N0wxNjUuNTkgMTEwLjk2OUwyMDkuNjIxIDE4Ni44NzVMMTY4LjUyMyAyMTAuNjRMMTI0Ljk2NiAxMzQuOTdaIiBmaWxsPSIjNDZCOTU1Ii8+PHBhdGggZD0iTTIxMi4xMjUgNDcuOTE4M0wyMTIuMDA5IDg0LjE0Nkw3Ni42MTUxIDE2Mi45MTJMNzYuNzMxMiAxMjYuNzQyQzc2LjczMTIgMTI0LjcxIDc1LjM0MDYgMTIyLjMyOSA3My42MDE2IDEyMS4yODVDNzIuNzMwNCAxMjAuNzYyIDcxLjkyMDYgMTIwLjc2MiA3MS4zMzk4IDEyMS4wNTJMMjA2LjczNCA0Mi4yODY0QzIwNy4zMTQgNDEuOTM3NCAyMDguMDY2IDQxLjk5NTYgMjA4LjkzNyA0Mi41MTlDMjEwLjY3MyA0My41MDc3IDIxMi4xMjUgNDUuOTQ0IDIxMi4xMjUgNDcuOTE4M1oiIGZpbGw9IiM2RENCNjAiLz48cGF0aCBkPSJNMTY1LjcxMyA3NC43NTIzTDE2NS41OTcgMTEwLjk4TDEyNC45NDcgMTM0Ljk2OEwxMjUuMDYzIDk4Ljc5ODZDMTI1LjA2MyA5Ni43NjYyIDEyMy42NzMgOTQuMzg0OCAxMjEuOTM0IDkzLjM0MTFDMTIxLjA2MiA5Mi44MTc3IDEyMC4yNTMgOTIuODE3NyAxMTkuNjcyIDkzLjEwODVMMTYwLjMyMiA2OS4xMjAzQzE2MC45MDIgNjguNzcxNCAxNjEuNjU0IDY4LjgyOTUgMTYyLjUyNSA2OS4zNTNDMTY0LjI2NCA3MC4zMzg1IDE2NS43MTMgNzIuNzc4IDE2NS43MTMgNzQuNzUyM1oiIGZpbGw9IiM0MkE4NEMiLz48cGF0aCBkPSJNNzMuNTc4OSAxMjEuMjk4Qzc1LjMxNzkgMTIyLjMwMyA3Ni43NDA4IDEyNC43MiA3Ni43Mzc2IDEyNi43MjNMNzYuNjM0MyAxNjIuOTE2TDEyMC4xOTEgMjM4LjU4M0wyNi44MjQ3IDE4NC4yNDRMNzAuMzQ2IDE1OS4yMjZMNzAuNDQ5MyAxMjMuMDg1QzcwLjQ1MjUgMTIxLjA4NSA3MS44Mzk5IDEyMC4yOSA3My41Nzg5IDEyMS4yOThaIiBmaWxsPSIjMkM5QTJDIi8+PHBhdGggZD0iTTEwNy44NzkgMjI2Ljc2NkwzNi42MjAxIDE4NS41NjVMNzIuMzYyNSAxNjUuMTdMODMuNzkwNSAxODQuOTY0TDEwNy44NzkgMjI2Ljc2NloiIGZpbGw9IiM2RENCNjAiLz48cGF0aCBkPSJNODEuMzQ4MSAxODAuNzMxTDM2LjYyMDEgMTg1LjU2NUw3Mi4zNjI1IDE2NS4xN0w4MS4zNDgxIDE4MC43MzFaIiBmaWxsPSIjODFENjcyIi8+PHBhdGggZD0iTTI0MC45MDEgMzY0Ljk0OUwxMzYuNDk0IDQyNS4zMzdMMTM2LjE3MSAyNjcuODU5TDI0MC41NzkgMjA3LjUwOEwyNDAuOTAxIDM2NC45NDlaIiBmaWxsPSJ3aGl0ZSIvPjxwYXRoIGQ9Ik05NS40OTMgMjA5LjIzN0M4Ni4wNDYgMjEyLjIwMyA3Ny42NDc2IDIxOS44NzQgNzMuODcyNyAyMzAuNzg5QzczLjM3NTkgMjMyLjM3OCA3MS4xOTQ4IDIzMi4zNzggNzAuNjAxMSAyMzAuNzg5QzY3LjMyOTUgMjIwLjU1OSA1OS4xOTU3IDIxMi41MTMgNDkuMDgwOCAyMDkuMjM3QzQ3LjI5NjYgMjA4LjYzOSA0Ny4yOTY2IDIwNi40NTUgNDkuMDgwOCAyMDUuODZDNTkuMTk1NyAyMDIuNTQ4IDY3LjI1NTMgMTk0LjM1NCA3MC42MDExIDE4NC4zMDhDNzEuMTk0OCAxODIuNjE5IDczLjM3OTEgMTgyLjYxOSA3My44NzI3IDE4NC4zMDhDNzcuNjQxMiAxOTQuOTk3IDg1LjQzNjIgMjAyLjUwMyA5NS40OTMgMjA1Ljg2Qzk3LjE4MDQgMjA2LjQ1NSA5Ny4xODA0IDIwOC42MzkgOTUuNDkzIDIwOS4yMzdaIiBmaWxsPSJ3aGl0ZSIvPjxwYXRoIGQ9Ik0xOTUuNzg5IDI2NC4yNTdDMjE4LjkyNiAyNTcuNTQzIDIzMi42NjQgMjc0Ljg4OCAyMjguMDk2IDI5OS40OUMyMjQuMDc1IDMyMS4xNDIgMjA2Ljc0MyAzNDIuMzM1IDE4OC4zMjcgMzQ5LjMxMUMxNjkuMTU1IDM1Ni41NzIgMTUyLjYxIDM0Ny4wNDMgMTUyLjAyOSAzMjUuMzQ2QzE1MS4zNjUgMzAwLjQyNCAxNzEuNDQzIDI3MS4zMjQgMTk1Ljc4OSAyNjQuMjU3WiIgZmlsbD0iIzQ2Qjk1NSIvPjxwYXRoIGQ9Ik0yMDYuNDE3IDI3MS44NDhMMTc4LjMzNyAzNDUuNDI0QzE3OC4zMzcgMzQ1LjQyNCAxNTMuNzY4IDMxMC4wMjcgMjA2LjQxNyAyNzEuODQ4WiIgZmlsbD0id2hpdGUiLz48cGF0aCBkPSJNMTgzLjM5IDM0MC4yMUwyMDIuOTUyIDI4OS4yOTNDMjAyLjk1MiAyODkuMjkzIDIyNi43ODIgMzA2LjQ4MyAxODMuMzkgMzQwLjIxWiIgZmlsbD0id2hpdGUiLz48cmVjdCB3aWR0aD0iNzguMzI4NCIgaGVpZ2h0PSI2OC40NzY4IiB0cmFuc2Zvcm09Im1hdHJpeCgwLjk5NjczMSAwLjA4MDc5NzYgLTAuMDgwNTYyNyAwLjk5Njc1IDE1NC4yMTYgMzM2LjE2NikiIGZpbGw9InVybCgjcGF0dGVybjApIi8+PGRlZnM+PHBhdHRlcm4gaWQ9InBhdHRlcm4wIiBwYXR0ZXJuQ29udGVudFVuaXRzPSJvYmplY3RCb3VuZGluZ0JveCIgd2lkdGg9IjEiIGhlaWdodD0iMSI+PHVzZSB4bGluazpocmVmPSIjaW1hZ2UwXzEwMzQ5XzEwNDk2MCIgdHJhbnNmb3JtPSJzY2FsZSgwLjAwMzI1NzMzIDAuMDAzNzMxMzQpIi8+PC9wYXR0ZXJuPjwvZGVmcz48dGV4dCBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIyMCIgeD0iMjAiIHk9IjQ5MCIgZmlsbD0iYmxhY2siID48dHNwYW4gZHk9IjAiIHg9IjIwIj4gMzQwMjgyMzY2OTIwOTM4NDYzNDYzMzc0NjA3NDMxNzY4MjExNDU1IEJQRiBSZW1haW5pbmcgPC90c3Bhbj48L3RleHQ+PC9zdmc+";
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