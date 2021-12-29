const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { BigNumber } = require('bignumber.js')
const { print } = require('./utils/print.js')

let user, user2, owner;
let userAddress, ownerAddress, user2Address, fundraiserAddress;

describe('Budget', function () {
  before(async function () {
    [owner,user,user2, fundraiser] = await ethers.getSigners()
    userAddress = user.address
    user2Address = user2.address
    fundraiserAddress = fundraiser.address
    const contracts = await deploy("Test", false, true)
    ownerAddress = contracts.account
    this.diamond = contracts.beanstalkDiamond
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
    this.field = await ethers.getContractAt('MockFieldFacet', this.diamond.address)
    this.bean = await ethers.getContractAt('MockToken', contracts.bean)
    this.budget = await ethers.getContractAt('MockBudgetFacet', this.diamond.address)

    await this.season.siloSunrise(0)
    await this.bean.mint(userAddress, '1000000000')
    await this.bean.mint(user2Address, '1000000000')
    await this.bean.connect(user).approve(this.budget.address, '100000000000');
    await this.bean.connect(user2).approve(this.budget.address, '100000000000'); 
  })

  beforeEach (async function () {
    await this.season.resetAccount(userAddress)
    await this.season.resetAccount(user2Address)
    await this.season.resetAccount(ownerAddress)
    await this.season.resetState()
    await this.season.siloSunrise(0)
    await this.budget.setIsBudgetE(userAddress);
  })

  describe('Is budget', async function () {
    it('Is not budget', async function () {
      expect(await this.budget.isBudget(user2Address)).to.be.equal(false)
    });

    it('Is budget', async function () {
      expect(await this.budget.isBudget(userAddress)).to.be.equal(true)
    });
  });

  describe('Sow', async function () {
    it('reverts if not budget', async function () {
      await expect(this.budget.connect(user2).budgetSow('1000')).to.be.revertedWith('Budget: sender must be budget')
    });

    describe('No Soil', async function () {
      beforeEach(async function () {
        const beanSupply = await this.bean.totalSupply();
        await this.budget.connect(user).budgetSow('1000');
        const postBeanSupply = await this.bean.totalSupply();
        this.deltaTotalBeans = postBeanSupply.sub(beanSupply)
      });

      it('creates a plot', async function () {
        expect(await this.field.plot(userAddress,0)).to.be.equal('1000')
      })

      it('updates total balances', async function () {
        expect(this.deltaTotalBeans).to.be.equal('-1000')
        expect(await this.field.podIndex()).to.be.equal('1000')
        expect(await this.field.totalSoil()).to.be.equal('0')
      })
    })

    describe('Some Soil', async function () {
      beforeEach(async function () {
        const beanSupply = await this.bean.totalSupply();
        await this.season.incrementTotalSoilE('500');
        await this.budget.connect(user).budgetSow('1000');
        const postBeanSupply = await this.bean.totalSupply();
        this.deltaTotalBeans = postBeanSupply.sub(beanSupply)
      });

      it('creates a plot', async function () {
        expect(await this.field.plot(userAddress,0)).to.be.equal('1000')
      })

      it('updates total balances', async function () {
        expect(this.deltaTotalBeans).to.be.equal('-1000')
        expect(await this.field.podIndex()).to.be.equal('1000')
        expect(await this.field.totalSoil()).to.be.equal('0')
      })
    })

    describe('A lot of Soil', async function () {
      beforeEach(async function () {
        const beanSupply = await this.bean.totalSupply();
        await this.season.incrementTotalSoilE('1500');
        await this.budget.connect(user).budgetSow('1000');
        const postBeanSupply = await this.bean.totalSupply();
        this.deltaTotalBeans = postBeanSupply.sub(beanSupply)
      });

      it('creates a plot', async function () {
        expect(await this.field.plot(userAddress,0)).to.be.equal('1000')
      })

      it('updates total balances', async function () {
        expect(this.deltaTotalBeans).to.be.equal('-1000')
        expect(await this.field.podIndex()).to.be.equal('1000')
        expect(await this.field.totalSoil()).to.be.equal('500')
      })
    })
  });
})
