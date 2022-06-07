const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { deployFertilizer, impersonateFertilizer } = require('../scripts/deployFertilizer.js')
const { EXTERNAL } = require('./utils/balances.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { BEAN, FERTILIZER, USDC, BEAN_3_CURVE, THREE_CURVE, UNRIPE_BEAN, UNRIPE_LP } = require('./utils/constants');
const { to6, to18 } = require('./utils/helpers.js');
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
    .mul(ethers.BigNumber.from('824296'))
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
    this.beanMetapool = await ethers.getContractAt('IBean', BEAN_3_CURVE)
    this.threeCurve = await ethers.getContractAt('IBean', THREE_CURVE)

    this.unripeBean = await ethers.getContractAt('MockToken', UNRIPE_BEAN)
    this.unripeLP = await ethers.getContractAt('MockToken', UNRIPE_LP)
    await this.unripeBean.mint(user2.address, to6('1000'))
    await this.unripeLP.mint(user2.address, to6('1000'))

    this.threeCurve = await ethers.getContractAt('IBean', THREE_CURVE)
    this.threeCurve = await ethers.getContractAt('IBean', THREE_CURVE)

    await this.usdc.mint(owner.address, to18('1000000000'));
    await this.usdc.mint(user.address, to6('1000'));
    await this.usdc.mint(user2.address, to6('1000'));
    await this.usdc.connect(owner).approve(this.diamond.address, to18('1000000000'));
    await this.usdc.connect(user).approve(this.diamond.address, to18('1000000000'));
    await this.usdc.connect(user2).approve(this.diamond.address, to18('1000000000'));
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot()
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId)
  });

  it('reverts if early Season', async function () {
    await expect(this.fertilizer.connect(owner).addFertilizerOwner('1000', '1', '0')).to.be.revertedWith('SafeMath: subtraction overflow')
  })

  describe("Get Humidity", async function () {
    it('first season', async function () {
      expect(await this.fertilizer.getHumidity('6074')).to.be.equal(5000)
    })

    it('second season', async function () {
      expect(await this.fertilizer.getHumidity('6075')).to.be.equal(2500)
    })

    it('11th season', async function () {
      expect(await this.fertilizer.getHumidity('6085')).to.be.equal(2450)
    })

    it('2nd last scale season', async function () {
      expect(await this.fertilizer.getHumidity('6534')).to.be.equal(205)
    })

    it('last scale season', async function () {
      expect(await this.fertilizer.getHumidity('6535')).to.be.equal(200)
    })

    it('late season', async function () {
      expect(await this.fertilizer.getHumidity('10000')).to.be.equal(200)
    })
  })

  describe('Add Fertilizer', async function () {
    describe('1 fertilizer', async function () {
      beforeEach(async function () {
        this.result = await this.fertilizer.connect(owner).addFertilizerOwner('10000', '1', '0')
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
        expect(await this.beanMetapool.balanceOf(this.fertilizer.address)).to.be.equal('1823520531850802708')

        expect(await this.threeCurve.balanceOf(this.beanMetapool.address)).to.be.equal(to18('1'))
        expect(await this.bean.balanceOf(this.beanMetapool.address)).to.be.equal(lpBeansForUsdc('1'))
      })

      it('updates underlying balances', async function () {
        expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6('2'))
        expect(await this.unripe.getTotalUnderlying(UNRIPE_LP)).to.be.equal('1823520531850802708')
      })

      it('updates fertizer amount', async function () {
        expect(await this.fertilizer.getFertilizer(to6('1.2'))).to.be.equal('1')
      })

      it('emits event', async function () {
        expect(this.result).to.emit('SetFertilizer').withArgs('10000', to6('1.2'), to6('1.2'))
      })
    })

    describe('1 fertilizer twice', async function () {
      beforeEach(async function () {
        await this.fertilizer.connect(owner).addFertilizerOwner('10000', '1', '0')
        await this.fertilizer.connect(owner).addFertilizerOwner('10000', '1', '0')
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
        expect(await this.beanMetapool.balanceOf(this.fertilizer.address)).to.be.equal('3647041063701605416')

        expect(await this.threeCurve.balanceOf(this.beanMetapool.address)).to.be.equal(to18('2'))
        expect(await this.bean.balanceOf(this.beanMetapool.address)).to.be.equal(lpBeansForUsdc('2'))
      })

      it('updates underlying balances', async function () {
        expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6('3.999999'))
        expect(await this.unripe.getTotalUnderlying(UNRIPE_LP)).to.be.equal('3647041063701605416')
      })

      it('updates fertizer amount', async function () {
        expect(await this.fertilizer.getFertilizer(to6('1.2'))).to.be.equal('2')
      })
    })

    describe('2 fertilizers', async function () {
      beforeEach(async function () {
        await this.fertilizer.connect(owner).addFertilizerOwner('6074', '5', '0')
        await this.fertilizer.connect(owner).addFertilizerOwner('10000', '1', '0')
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
        expect(await this.beanMetapool.balanceOf(this.fertilizer.address)).to.be.equal('10941123191104816250')

        expect(await this.threeCurve.balanceOf(this.beanMetapool.address)).to.be.equal(to18('6'))
        expect(await this.bean.balanceOf(this.beanMetapool.address)).to.be.equal(this.lpBeans)
      })

      it('updates underlying balances', async function () {
        expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6('11.999999'))
        expect(await this.unripe.getTotalUnderlying(UNRIPE_LP)).to.be.equal('10941123191104816250')
      })

      it('updates fertizer amount', async function () {
        expect(await this.fertilizer.getFertilizer(to6('1.2'))).to.be.equal('1')
        expect(await this.fertilizer.getFertilizer(to6('6'))).to.be.equal('5')
      })
    })
  })

  describe('Sort fertilizer seasons', async function () {
    beforeEach(async function () {
      await this.fertilizer.connect(owner).addFertilizerOwner('10000', '1', '0')
      await this.fertilizer.connect(owner).addFertilizerOwner('6375', '1', '0')
      await this.fertilizer.connect(owner).addFertilizerOwner('6275', '1', '0')
      await this.fertilizer.connect(owner).addFertilizerOwner('9000', '1', '0')
      await this.fertilizer.connect(owner).addFertilizerOwner('6175', '1', '0')
      await this.season.rewardToFertilizerE(to6('2.5'))
      await this.fertilizer.connect(owner).addFertilizerOwner('7000', '1', '0')
      await this.fertilizer.connect(owner).addFertilizerOwner('6074', '1', '0')
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
  })

  describe("Mint Fertilizer", async function () {
    describe('1 mint', async function () {
      beforeEach(async function () {
        await this.season.teleportSunrise('6275')
        this.result = await this.fertilizer.connect(user).mintFertilizer('100', '0', EXTERNAL)
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
        expect(await this.beanMetapool.balanceOf(this.fertilizer.address)).to.be.equal('182352053185080270837')

        expect(await this.threeCurve.balanceOf(this.beanMetapool.address)).to.be.equal(to18('100'))
        expect(await this.bean.balanceOf(this.beanMetapool.address)).to.be.equal(this.lpBeans)
      })

      it('updates underlying balances', async function () {
        expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6('200'))
        expect(await this.unripe.getTotalUnderlying(UNRIPE_LP)).to.be.equal('182352053185080270837')
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
        await this.season.teleportSunrise('6275')
        this.result = await this.fertilizer.connect(user).mintFertilizer('50', '0', EXTERNAL)
        this.result = await this.fertilizer.connect(user).mintFertilizer('50', '0', EXTERNAL)
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
        expect(await this.beanMetapool.balanceOf(this.fertilizer.address)).to.be.equal('182352053185080270837')

        expect(await this.threeCurve.balanceOf(this.beanMetapool.address)).to.be.equal(to18('100'))
        expect(await this.bean.balanceOf(this.beanMetapool.address)).to.be.equal(this.lpBeans)
      })

      it('updates underlying balances', async function () {
        expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal('199999999') // Rounds down
        expect(await this.unripe.getTotalUnderlying(UNRIPE_LP)).to.be.equal('182352053185080270837')
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
        await this.season.teleportSunrise('6075')
        await this.fertilizer.connect(user).mintFertilizer('100', '0', EXTERNAL)
        await this.season.rewardToFertilizerE(to6('50'))
        await this.season.teleportSunrise('6275')
        this.result = await this.fertilizer.connect(user).mintFertilizer('100', '0', EXTERNAL)
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
        expect(await this.beanMetapool.balanceOf(this.fertilizer.address)).to.be.equal('364704106370160541675')

        expect(await this.threeCurve.balanceOf(this.beanMetapool.address)).to.be.equal(to18('200'))
        expect(await this.bean.balanceOf(this.beanMetapool.address)).to.be.equal(this.lpBeans)
      })

      it('updates underlying balances', async function () {
        expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6('400'))
        expect(await this.unripe.getTotalUnderlying(UNRIPE_LP)).to.be.equal('364704106370160541675')
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
  })

  describe("Fertilize", async function () {
    beforeEach(async function () {
      await this.season.teleportSunrise('6275')
      this.result = await this.fertilizer.connect(user).mintFertilizer('100', '0', EXTERNAL)
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
        await this.season.teleportSunrise('6475')
        this.result = await this.fertilizer.connect(user).mintFertilizer('100', '0', EXTERNAL)
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
        await this.season.teleportSunrise('6475')
        this.result = await this.fertilizer.connect(user).mintFertilizer('100', '0', EXTERNAL)
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
        await this.season.teleportSunrise('6475')
        this.result = await this.fertilizer.connect(user).mintFertilizer('100', '0', EXTERNAL)
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
      await this.season.teleportSunrise('6275')
      this.result = await this.fertilizer.connect(user).mintFertilizer('100', '0', EXTERNAL)
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
        this.result = await this.fertilizer.connect(user2).mintFertilizer('100', '0', EXTERNAL)
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
        await this.season.teleportSunrise('6475')
        this.result = await this.fertilizer.connect(user).mintFertilizer('100', '0', EXTERNAL)
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
        this.result = await this.fertilizer.connect(user2).mintFertilizer('100', '0', EXTERNAL)
        await this.season.rewardToFertilizerE(to6('400'))
        await this.season.teleportSunrise('6475')
        this.result = await this.fertilizer.connect(user).mintFertilizer('100', '0', EXTERNAL)
        this.result = await this.fertilizer.connect(user2).mintFertilizer('100', '0', EXTERNAL)
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
  })

})