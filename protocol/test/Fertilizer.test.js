const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { impersonateFertilizer } = require('../scripts/deployFertilizer.js')
const { EXTERNAL, INTERNAL } = require('./utils/balances.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot.js");
const { BEAN, USDC, UNRIPE_BEAN, UNRIPE_LP, BEANSTALK, BARN_RAISE_TOKEN } = require('./utils/constants.js');
const { setWstethUsdPrice } = require('../utils/oracle.js');
const { to6, to18 } = require('./utils/helpers.js');
const { deployBasinV1_1 } = require('../scripts/basinV1_1.js');
const axios = require('axios')

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
    this.barnRaiseToken = await ethers.getContractAt('IBean', BARN_RAISE_TOKEN)

    this.unripeBean = await ethers.getContractAt('MockToken', UNRIPE_BEAN)
    this.unripeLP = await ethers.getContractAt('MockToken', UNRIPE_LP)
    await this.unripeBean.mint(user2.address, to6('1000'))
    await this.unripeLP.mint(user2.address, to6('942.297473'))

    await this.bean.mint(owner.address, to18('1000000000'));
    await this.barnRaiseToken.mint(owner.address, to18('1000000000'));
    await this.barnRaiseToken.mint(user.address, to18('1000000000'));
    await this.barnRaiseToken.mint(user2.address, to18('1000000000'));
    await this.bean.connect(owner).approve(this.diamond.address, to18('1000000000'));
    await this.barnRaiseToken.connect(owner).approve(this.diamond.address, to18('1000000000'));
    await this.barnRaiseToken.connect(user).approve(this.diamond.address, to18('1000000000'));
    await this.barnRaiseToken.connect(user2).approve(this.diamond.address, to18('1000000000'));

    await setWstethUsdPrice('1000')

    this.well = (await deployBasinV1_1(true, undefined, false, true)).well
    

    this.wellToken = await ethers.getContractAt("IERC20", this.well.address)
    await this.wellToken.connect(owner).approve(BEANSTALK, ethers.constants.MaxUint256)
    await this.bean.connect(owner).approve(BEANSTALK, ethers.constants.MaxUint256)
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

        expect(await this.barnRaiseToken.balanceOf(this.well.address)).to.be.equal(to18('0.001'))
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

        expect(await this.barnRaiseToken.balanceOf(this.well.address)).to.be.equal(to18('0.002'))
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

        expect(await this.barnRaiseToken.balanceOf(this.well.address)).to.be.equal(to18('0.006'))
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
      await expect(this.fertilizer.connect(user).mintFertilizer('0', '0', '0')).to.be.revertedWith('Fertilizer: None bought.')
    })

    describe('1 mint', async function () {
      beforeEach(async function () {
        await this.season.teleportSunrise('6274')
        this.result = await this.fertilizer.connect(user).mintFertilizer(to18('0.1'), '0', '0')
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

        expect(await this.barnRaiseToken.balanceOf(this.well.address)).to.be.equal(to18('0.1'))
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
        this.result = await this.fertilizer.connect(user).mintFertilizer(to18('0.05'), '0', '0')
        this.result = await this.fertilizer.connect(user).mintFertilizer(to18('0.05'), '0', '0')
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

        expect(await this.barnRaiseToken.balanceOf(this.well.address)).to.be.equal(to18('0.1'))
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
        await this.fertilizer.connect(user).mintFertilizer(to18('0.1'), '0', '0')
        await this.season.rewardToFertilizerE(to6('50'))
        await this.season.teleportSunrise('6274')
        this.result = await this.fertilizer.connect(user).mintFertilizer(to18('0.1'), '0', '0')
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

        expect(await this.barnRaiseToken.balanceOf(this.well.address)).to.be.equal(to18('0.2'))
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
        await this.fertilizer.connect(user).mintFertilizer(to18('0.1'), '0', '0')
        await this.season.rewardToFertilizerE(to6('50'))
        await this.season.teleportSunrise('6174')
        this.result = await this.fertilizer.connect(user).mintFertilizer(to18('0.1'), '0', '0')
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

        expect(await this.barnRaiseToken.balanceOf(this.well.address)).to.be.equal(to18('0.2'))
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
        await this.fertilizer.connect(user).mintFertilizer(to18('0.1'), '0', '0')
        await this.season.rewardToFertilizerE(to6('50'))
        await this.season.teleportSunrise('6174')
        await this.fertilizer.connect(user).claimFertilized([to6('3.5')], INTERNAL)
        this.result = await this.fertilizer.connect(user).mintFertilizer(to18('0.1'), '0', '0')
      })

      it('updates claims fertilized Beans', async function () {
        expect(await this.token.getInternalBalance(user.address, this.bean.address)).to.be.equal(to6('50'))
      })
    })
  })

  describe("Fertilize", async function () {
    beforeEach(async function () {
      await this.season.teleportSunrise('6274')
      this.result = await this.fertilizer.connect(user).mintFertilizer(to18('0.1'), '0', '0')
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
        this.result = await this.fertilizer.connect(user).mintFertilizer(to18('0.1'), '0', '0')
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
        this.result = await this.fertilizer.connect(user).mintFertilizer(to18('0.1'), '0', '0')
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
        this.result = await this.fertilizer.connect(user).mintFertilizer(to18('0.1'), '0', '0')
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
      this.result = await this.fertilizer.connect(user).mintFertilizer(to18('0.1'), '0', '0')
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
        this.result = await this.fertilizer.connect(user2).mintFertilizer(to18('0.1'), '0', '0')
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
        this.result = await this.fertilizer.connect(user).mintFertilizer(to18('0.1'), '0', '0')
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
        this.result = await this.fertilizer.connect(user2).mintFertilizer(to18('0.1'), '0', '0')
        await this.season.rewardToFertilizerE(to6('400'))
        await this.season.teleportSunrise('6474')
        this.result = await this.fertilizer.connect(user).mintFertilizer(to18('0.1'), '0', '0')
        this.result = await this.fertilizer.connect(user2).mintFertilizer(to18('0.1'), '0', '0')
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

    describe("1 mint with uri", async function () {

      let mintReceipt;

      beforeEach(async function () {

        // Humidity 25000  
        await this.season.teleportSunrise("6074");

        // getFertilizers returns array with [fertid, supply] values
        // before mint 2500000,100 so only 1 fert has been minted before this test

        // Maths:
        // uint128 current season bpf = Humidity + 1000 * 1,000 // so 2500 + 1000 * 1,000 = 3500000 correct
        // uint128 endBpf = totalbpf (s.bpf) + current season bpf; // so 0 + 3500000 = 3500000 correct
        // uint128 bpfRemaining = totalbpf (s.bpf) - id; // so 0 - 3500000 = -3500000 correct but since it is uint128 it is 340282366920938463463374607431764711456 --> loops back
        // uint128 fertilizer id = current season bpf + totalbpf  // so 3500000 + 0 = 3500000 correct
        // uint128 s.bpf // 0
        // Humidity // 2500

        // Svg choice:
        // If Fertilizer is not sold yet (fertilizer[id] == getFertilizer(id) == default == 0), it’s Available.
        // If Fertilizer still has Sprouts (is owed Bean mints), it’s Active. bpfRemaining > 0
        // If Fertilizer has no more Sprouts (is done earning Bean mints), it’s Used. bpfRemaining = 0

        // mint fert with id 3500000 and supply 50
        mintTx = await this.fertilizer.connect(user).mintFertilizer(to18('0.05'), '0', '0')

        mintReceipt = await mintTx.wait();

      });

      // Available fert test
      it("returns an available fertilizer svg and stats when supply (fertilizer[id]) is 0", async function () {

        // Manipulate bpf to 5000000
        // new bpfremaining for id 350001 = 5000000 - 3500001 = 1499999
        await this.fertilizer.setBpf(5000000);

        // This returns an available image of fert
        const availableDataImage = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjk0IiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDI5NCA1MTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiPjxwYXRoIGQ9Ik0xNjQuNDcgMzI3LjI0MSAyOC42MjUgNDA1Ljc2OGwtLjg3OC0yMjEuNTUxIDEzNS44NDktNzguNTU5Ljg3NCAyMjEuNTgzWiIgZmlsbD0iIzNEQUE0NyIvPjxwYXRoIGQ9Im0xMTguMDU5IDM1NC4wNzctNDEuMTAyIDIzLjc0Ni0uODc0LTIyMS41NTEgNDEuMTAxLTIzLjc3OC44NzUgMjIxLjU4M1oiIGZpbGw9IiMzREFBNDciLz48cGF0aCBkPSJtMjYuODI1IDE4NC4yNDIuODcgMjIxLjU2NyA5My4zNjcgNTQuMzM5LS44NzEtMjIxLjU2NC05My4zNjYtNTQuMzQyWm0xMzYuNDMyLTc4LjI2Mi44NzEgMjIxLjU2OCA5My4zNjcgNTQuMzM4LS44NzEtMjIxLjU2NC05My4zNjctNTQuMzQyWiIgZmlsbD0iIzNEQjU0MiIvPjxwYXRoIGQ9Ik03Ni42MzQgMTYyLjkxNSAyMTIgODQuMTMzbDQ0LjAzNCA3NS45MDktMTM1Ljg0MiA3OC41NDQtNDMuNTU3LTc1LjY3MVoiIGZpbGw9IiM4MUQ2NzIiLz48cGF0aCBkPSJtMTI0Ljk2NiAxMzQuOTcgNDAuNjI0LTI0LjAwMSA0NC4wMzEgNzUuOTA2LTQxLjA5OCAyMy43NjUtNDMuNTU3LTc1LjY3WiIgZmlsbD0iIzQ2Qjk1NSIvPjxwYXRoIGQ9Im0yMTIuMTI1IDQ3LjkxOC0uMTE2IDM2LjIyOC0xMzUuMzk0IDc4Ljc2Ni4xMTYtMzYuMTdjMC0yLjAzMi0xLjM5LTQuNDEzLTMuMTMtNS40NTctLjg3LS41MjMtMS42OC0uNTIzLTIuMjYxLS4yMzNsMTM1LjM5NC03OC43NjZjLjU4LS4zNDkgMS4zMzItLjI5IDIuMjAzLjIzMyAxLjczNi45ODkgMy4xODggMy40MjUgMy4xODggNS40WiIgZmlsbD0iIzZEQ0I2MCIvPjxwYXRoIGQ9Im0xNjUuNzEzIDc0Ljc1Mi0uMTE2IDM2LjIyOC00MC42NSAyMy45ODguMTE2LTM2LjE3YzAtMi4wMzItMS4zOS00LjQxMy0zLjEyOS01LjQ1Ny0uODcyLS41MjMtMS42ODEtLjUyMy0yLjI2Mi0uMjMybDQwLjY1LTIzLjk4OWMuNTgtLjM0OSAxLjMzMi0uMjkgMi4yMDMuMjMzIDEuNzM5Ljk4NiAzLjE4OCAzLjQyNSAzLjE4OCA1LjRaIiBmaWxsPSIjNDJBODRDIi8+PHBhdGggZD0iTTczLjU3OSAxMjEuMjk4YzEuNzM5IDEuMDA1IDMuMTYyIDMuNDIyIDMuMTU5IDUuNDI1bC0uMTA0IDM2LjE5MyA0My41NTcgNzUuNjY3LTkzLjM2Ni01NC4zMzkgNDMuNTIxLTI1LjAxOC4xMDMtMzYuMTQxYy4wMDQtMiAxLjM5LTIuNzk1IDMuMTMtMS43ODdaIiBmaWxsPSIjMkM5QTJDIi8+PHBhdGggZD0iTTEwNy44NzkgMjI2Ljc2NiAzNi42MiAxODUuNTY1bDM1Ljc0Mi0yMC4zOTUgMTEuNDI4IDE5Ljc5NCAyNC4wODkgNDEuODAyWiIgZmlsbD0iIzZEQ0I2MCIvPjxwYXRoIGQ9Im04MS4zNDggMTgwLjczMS00NC43MjggNC44MzQgMzUuNzQyLTIwLjM5NSA4Ljk4NiAxNS41NjFaIiBmaWxsPSIjODFENjcyIi8+ICA8cGF0aCBkPSJNOTUuNDkzIDIwOS4yMzdjLTkuNDQ3IDIuOTY2LTE3Ljg0NSAxMC42MzctMjEuNjIgMjEuNTUyLS40OTcgMS41ODktMi42NzggMS41ODktMy4yNzIgMC0zLjI3Mi0xMC4yMy0xMS40MDUtMTguMjc2LTIxLjUyLTIxLjU1Mi0xLjc4NC0uNTk4LTEuNzg0LTIuNzgyIDAtMy4zNzcgMTAuMTE1LTMuMzEyIDE4LjE3NC0xMS41MDYgMjEuNTItMjEuNTUyLjU5NC0xLjY4OSAyLjc3OC0xLjY4OSAzLjI3MiAwIDMuNzY4IDEwLjY4OSAxMS41NjMgMTguMTk1IDIxLjYyIDIxLjU1MiAxLjY4Ny41OTUgMS42ODcgMi43NzkgMCAzLjM3N1oiIGZpbGw9IiNmZmYiLz48cGF0aCBkPSJtMjU2Ljg5OCAzODEuNjA5LTEzNS44NDYgNzguNTI3LS44NzctMjIxLjU1MSAxMzUuODQ5LTc4LjU2Ljg3NCAyMjEuNTg0WiIgZmlsbD0iIzZEQ0I2MCIvPjxwYXRoIGQ9Im0yMTAuNDg2IDQwOC40NDUtNDEuMTAxIDIzLjc0NS0uODc1LTIyMS41NTEgNDEuMTAyLTIzLjc3OC44NzQgMjIxLjU4NFoiIGZpbGw9IiMzREFBNDciLz48cGF0aCBkPSJtMjQwLjkwMSAzNjQuOTQ5LTEwNC40MDcgNjAuMzg3LS4zMjMtMTU3LjQ3NyAxMDQuNDA4LTYwLjM1MS4zMjIgMTU3LjQ0MVoiIGZpbGw9IiNmZmYiLz48cGF0aCBkPSJNMTk1Ljc4OSAyNjguMDI1YzIzLjEzNy02LjcxNCAzNi44NzUgMTAuNjMxIDMyLjMwNiAzNS4yMzMtNC4wMiAyMS42NTItMjEuMzUyIDQyLjg0NS0zOS43NjkgNDkuODIxLTE5LjE3MSA3LjI2LTM1LjcxNy0yLjI2OC0zNi4yOTctMjMuOTY2LS42NjUtMjQuOTIyIDE5LjQxMy01NC4wMjEgNDMuNzYtNjEuMDg4WiIgZmlsbD0iIzQ2Qjk1NSIvPjxwYXRoIGQ9Im0yMDYuNDE3IDI3NS42MTUtMjguMDggNzMuNTc3cy0yNC41NjktMzUuMzk3IDI4LjA4LTczLjU3N1ptLTIzLjAyNyA2OC4zNjIgMTkuNTYxLTUwLjkxNnMyMy44MzEgMTcuMTg5LTE5LjU2MSA1MC45MTZaIiBmaWxsPSIjZmZmIi8+PHRleHQgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIHg9IjIwIiB5PSI0OTAiIGZpbGw9ImJsYWNrIiA+PHRzcGFuIGR5PSIwIiB4PSIyMCI+MS40OSBCUEYgUmVtYWluaW5nIDwvdHNwYW4+PC90ZXh0Pjwvc3ZnPg=="

        const availabletokenId = 3500001; // non minted fert id
        const uri = await this.fert.uri(availabletokenId);

        const response = await axios.get(uri);
        jsonResponse = JSON.parse(response.data.toString());

        // id and image check
        expect(jsonResponse.name).to.be.equal(`Fertilizer - ${availabletokenId}`);
        expect(jsonResponse.image).to.be.equal(availableDataImage);

        // BPF Remaining json attribute check
        expect(jsonResponse.attributes[0].trait_type).to.be.equal(`BPF Remaining`);
        expect(jsonResponse.attributes[0].value.toString()).to.be.equal(`1.49`);
      });

      // Active fert test
      it("returns an active fertilizer svg and stats when bpfRemaining > 0 and fert supply > 0", async function () {

        // Manipulate bpf to 5000000
        await this.fertilizer.setBpf(5000000);

        // uint128 endBpf = totalbpf (s.bpf) + current season bpf;
        // So endbpf = 5000000 + 3500000 = 8500000
        // bpfRemaining = (s.bpf) - id;
        // bpfRemaining for id 3500000 = 5000000 - 3500000 = 1500000
        // so bpfRemaining > 0 --> and fertsupply = 50 --> Active
        // s.bpf = bpfremaining + id

        // This returns a active image of fert
        const activeDataImage = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjk0IiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDI5NCA1MTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiPjxwYXRoIGQ9Ik0xNjQuNDcgMzI3LjI0MSAyOC42MjUgNDA1Ljc2OGwtLjg3OC0yMjEuNTUxIDEzNS44NDktNzguNTU5Ljg3NCAyMjEuNTgzWiIgZmlsbD0iIzNEQUE0NyIvPjxwYXRoIGQ9Im0xMTguMDU5IDM1NC4wNzctNDEuMTAyIDIzLjc0Ni0uODc0LTIyMS41NTEgNDEuMTAxLTIzLjc3OC44NzUgMjIxLjU4M1oiIGZpbGw9IiMzREFBNDciLz48cGF0aCBkPSJtMjYuODI1IDE4NC4yNDIuODcgMjIxLjU2NyA5My4zNjcgNTQuMzM5LS44NzEtMjIxLjU2NC05My4zNjYtNTQuMzQyWm0xMzYuNDMyLTc4LjI2Mi44NzEgMjIxLjU2OCA5My4zNjcgNTQuMzM4LS44NzEtMjIxLjU2NC05My4zNjctNTQuMzQyWiIgZmlsbD0iIzNEQjU0MiIvPjxlbGxpcHNlIGN4PSIxMTMuMjQ3IiBjeT0iMjIwLjY4OCIgcng9IjM4LjcxNyIgcnk9IjM4Ljc3NCIgZmlsbD0iIzdGNTUzMyIvPjxlbGxpcHNlIGN4PSIxMTMuMjQ3IiBjeT0iMjIwLjY4OCIgcng9IjM4LjcxNyIgcnk9IjM4Ljc3NCIgZmlsbD0iIzdGNTUzMyIvPjxlbGxpcHNlIGN4PSI3MC4wMTMiIGN5PSIyMzYuODQ0IiByeD0iMzguNzE3IiByeT0iMzguNzc0IiBmaWxsPSIjN0Y1NTMzIi8+PHBhdGggZD0ibTI2LjgyNSAxODQuMjQyLjg3IDIyMS41NjcgOTMuMzY3IDU0LjMzOS0uODcxLTIyMS41NjQtOTMuMzY2LTU0LjM0MlptMTM2LjQzMi03OC4yNjIuODcxIDIyMS41NjggOTMuMzY3IDU0LjMzOC0uODcxLTIyMS41NjQtOTMuMzY3LTU0LjM0MloiIGZpbGw9IiMzREI1NDIiLz48ZWxsaXBzZSBjeD0iMTU2LjgwNSIgY3k9IjE5OC43MTUiIHJ4PSIzOC43MTciIHJ5PSIzOC43NzQiIGZpbGw9IiM3RjU1MzMiLz48ZWxsaXBzZSBjeD0iMTk4LjEwMyIgY3k9IjE4OS42NjgiIHJ4PSIzOC43MTciIHJ5PSIzOC43NzQiIGZpbGw9IiM3RjU1MzMiLz48cGF0aCBkPSJtMjU2Ljg5OCAzODEuNjA5LTEzNS44NDYgNzguNTI3LS44NzctMjIxLjU1MSAxMzUuODQ5LTc4LjU2Ljg3NCAyMjEuNTg0WiIgZmlsbD0iIzZEQ0I2MCIvPjxwYXRoIGQ9Im0yMTAuNDg2IDQwOC40NDUtNDEuMTAxIDIzLjc0NS0uODc1LTIyMS41NTEgNDEuMTAyLTIzLjc3OC44NzQgMjIxLjU4NFoiIGZpbGw9IiMzREFBNDciLz48cGF0aCBkPSJtMjQwLjkwMSAzNjQuOTQ5LTEwNC40MDcgNjAuMzg3LS4zMjMtMTU3LjQ3NyAxMDQuNDA4LTYwLjM1MS4zMjIgMTU3LjQ0MVoiIGZpbGw9IiNmZmYiLz48cGF0aCBkPSJNMTk1Ljc4OSAyNjguMDI1YzIzLjEzNy02LjcxNCAzNi44NzUgMTAuNjMxIDMyLjMwNiAzNS4yMzMtNC4wMiAyMS42NTItMjEuMzUyIDQyLjg0NS0zOS43NjkgNDkuODIxLTE5LjE3MSA3LjI2LTM1LjcxNy0yLjI2OC0zNi4yOTctMjMuOTY2LS42NjUtMjQuOTIyIDE5LjQxMy01NC4wMjEgNDMuNzYtNjEuMDg4WiIgZmlsbD0iIzQ2Qjk1NSIvPjxwYXRoIGQ9Im0yMDYuNDE3IDI3NS42MTUtMjguMDggNzMuNTc3cy0yNC41NjktMzUuMzk3IDI4LjA4LTczLjU3N1ptLTIzLjAyNyA2OC4zNjIgMTkuNTYxLTUwLjkxNnMyMy44MzEgMTcuMTg5LTE5LjU2MSA1MC45MTZaIiBmaWxsPSIjZmZmIi8+PHRleHQgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIHg9IjIwIiB5PSI0OTAiIGZpbGw9ImJsYWNrIiA+PHRzcGFuIGR5PSIwIiB4PSIyMCI+MS41MCBCUEYgUmVtYWluaW5nIDwvdHNwYW4+PC90ZXh0Pjwvc3ZnPg=="

        // FertilizerFacet.mintFertilizer: id: 3500000
        const activeTokenId = 3500000

        const uri = await this.fert.uri(activeTokenId);

        const response = await axios.get(uri);
        jsonResponse = JSON.parse(response.data.toString());

        // id and image check
        expect(jsonResponse.name).to.be.equal(`Fertilizer - ${activeTokenId}`);
        expect(jsonResponse.image).to.be.equal(activeDataImage);

        // BPF Remaining json attribute check
        expect(jsonResponse.attributes[0].trait_type).to.be.equal(`BPF Remaining`);
        expect(jsonResponse.attributes[0].value.toString()).to.be.equal(`1.5`);
      });

      // Used fert test
      it("returns a used fertilizer svg and stats when bpfRemaining = 0", async function () {

        // bpf is 0
        // uint128 endBpf = totalbpf (s.bpf) + current season bpf;
        // endbpf = 0 + 3500000 = 3500000
        // bpfRemaining = (s.bpf) - id; ---> 0 - 3500000 = -3500000 --> 340282366920938... because of underflow
        // bpfremaining --> now returns 0 beacause of calcualte bpfRemaining function check
        // so bpfRemaining = 0 --> Used

        // This returns a used image of fert
        const usedDataImage = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjk0IiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDI5NCA1MTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiPjxwYXRoIGQ9Ik0xNjQuNDcgMzI3LjI0MSAyOC42MjUgNDA1Ljc2OGwtLjg3OC0yMjEuNTUxIDEzNS44NDktNzguNTU5Ljg3NCAyMjEuNTgzWiIgZmlsbD0iIzNEQUE0NyIvPjxwYXRoIGQ9Im0xMTguMDU5IDM1NC4wNzctNDEuMTAyIDIzLjc0Ni0uODc0LTIyMS41NTEgNDEuMTAxLTIzLjc3OC44NzUgMjIxLjU4M1oiIGZpbGw9IiMzREFBNDciLz48cGF0aCBkPSJtMjYuODI1IDE4NC4yNDIuODcgMjIxLjU2NyA5My4zNjcgNTQuMzM5LS44NzEtMjIxLjU2NC05My4zNjYtNTQuMzQyWm0xMzYuNDMyLTc4LjI2Mi44NzEgMjIxLjU2OCA5My4zNjcgNTQuMzM4LS44NzEtMjIxLjU2NC05My4zNjctNTQuMzQyWiIgZmlsbD0iIzNEQjU0MiIvPjxwYXRoIGQ9Im0yNTYuODk4IDM4MS42MDktMTM1Ljg0NiA3OC41MjctLjg3Ny0yMjEuNTUxIDEzNS44NDktNzguNTYuODc0IDIyMS41ODRaIiBmaWxsPSIjNkRDQjYwIi8+PHBhdGggZD0ibTIxMC40ODYgNDA4LjQ0NS00MS4xMDEgMjMuNzQ1LS44NzUtMjIxLjU1MSA0MS4xMDItMjMuNzc4Ljg3NCAyMjEuNTg0WiIgZmlsbD0iIzNEQUE0NyIvPjxwYXRoIGQ9Im0yNDAuOTAxIDM2NC45NDktMTA0LjQwNyA2MC4zODctLjMyMy0xNTcuNDc3IDEwNC40MDgtNjAuMzUxLjMyMiAxNTcuNDQxWiIgZmlsbD0iI2ZmZiIvPjxwYXRoIGQ9Ik0xOTUuNzg5IDI2OC4wMjVjMjMuMTM3LTYuNzE0IDM2Ljg3NSAxMC42MzEgMzIuMzA2IDM1LjIzMy00LjAyIDIxLjY1Mi0yMS4zNTIgNDIuODQ1LTM5Ljc2OSA0OS44MjEtMTkuMTcxIDcuMjYtMzUuNzE3LTIuMjY4LTM2LjI5Ny0yMy45NjYtLjY2NS0yNC45MjIgMTkuNDEzLTU0LjAyMSA0My43Ni02MS4wODhaIiBmaWxsPSIjNDZCOTU1Ii8+PHBhdGggZD0ibTIwNi40MTcgMjc1LjYxNS0yOC4wOCA3My41NzdzLTI0LjU2OS0zNS4zOTcgMjguMDgtNzMuNTc3Wm0tMjMuMDI3IDY4LjM2MiAxOS41NjEtNTAuOTE2czIzLjgzMSAxNy4xODktMTkuNTYxIDUwLjkxNloiIGZpbGw9IiNmZmYiLz48dGV4dCBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIyMCIgeD0iMjAiIHk9IjQ5MCIgZmlsbD0iYmxhY2siID48dHNwYW4gZHk9IjAiIHg9IjIwIj4wLjAwIEJQRiBSZW1haW5pbmcgPC90c3Bhbj48L3RleHQ+PC9zdmc+"

        // FertilizerFacet.mintFertilizer: id: 3500000
        const usedTokenId = 3500000

        const uri = await this.fert.uri(usedTokenId);

        const response = await axios.get(uri);

        jsonResponse = JSON.parse(response.data.toString());

        // id and image check
        expect(jsonResponse.name).to.be.equal(`Fertilizer - ${usedTokenId}`);
        expect(jsonResponse.image).to.be.equal(usedDataImage);

        // BPF Remaining json attribute check
        expect(jsonResponse.attributes[0].trait_type).to.be.equal(`BPF Remaining`);
        expect(jsonResponse.attributes[0].value.toString()).to.be.equal(`0`);
      });

    });

  })
})