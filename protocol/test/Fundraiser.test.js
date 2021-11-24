const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { BigNumber } = require('bignumber.js')
const { print } = require('./utils/print.js')

let user, user2, owner;
let userAddress, ownerAddress, user2Address, fundraiserAddress;

describe('Fundraiser', function () {
  before(async function () {
    [owner,user,user2, fundraiser] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    fundraiserAddress = fundraiser.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
    this.field = await ethers.getContractAt('MockFieldFacet', this.diamond.address)
    this.bean = await ethers.getContractAt('MockToken', contracts.bean)
    this.fundraiser = await ethers.getContractAt('MockFundraiserFacet', this.diamond.address)

    let tokenFacet = await ethers.getContractFactory('MockToken')
    this.token = await tokenFacet.deploy('MockToken', 'TOKEN')
    await this.token.deployed()

    await this.season.siloSunrise(0)
    await this.bean.mint(userAddress, '1000000000')
    await this.bean.mint(user2Address, '1000000000')
    await this.token.mint(userAddress, '1000000000')
    await this.token.mint(user2Address, '1000000000')
  });

  beforeEach (async function () {
    await this.season.resetAccount(userAddress)
    await this.season.resetAccount(user2Address)
    await this.season.resetAccount(ownerAddress)
    await this.season.resetState()
    await this.season.siloSunrise(0)
  });

  describe('create fundraiser', function () {
    describe('reverts if not owner', async function () {
      it('reverts ', async function () {
        await expect(this.fundraiser.createFundraiser(fundraiserAddress, this.token.address, '1000')).to.be.revertedWith('Fundraiser: sender must be Beanstalk.')
      });
    });

    describe('create a fundraiser', async function () {
      beforeEach(async function () {
        this.result = await this.fundraiser.createFundraiserE(fundraiserAddress, this.token.address, '1000');
      });

      it('gets listed as a fundraiser', async function () {
        expect(await this.fundraiser.remainingFunding(0)).to.be.equal('1000')
        expect(await this.fundraiser.totalFunding(0)).to.be.equal('1000')
        expect(await this.fundraiser.fundingToken(0)).to.be.equal(this.token.address)
      });

      it('emits a CreateFundraiser event', async function () {
        await expect(this.result).to.emit(this.fundraiser, 'CreateFundraiser').withArgs(0, fundraiserAddress, this.token.address, '1000');
      })
    });

    describe('create 2 fundraisers', async function () {
      beforeEach(async function () {
        await this.fundraiser.createFundraiserE(fundraiserAddress, this.token.address, '1000');
        this.result = await this.fundraiser.createFundraiserE(fundraiserAddress, this.token.address, '1000');
      });

      it('gets listed as a fundraiser', async function () {
        expect(await this.fundraiser.remainingFunding(1)).to.be.equal('1000')
        expect(await this.fundraiser.totalFunding(1)).to.be.equal('1000')
        expect(await this.fundraiser.fundingToken(1)).to.be.equal(this.token.address)
      });

      it('emits a CreateFundraiser event', async function () {
        await expect(this.result).to.emit(this.fundraiser, 'CreateFundraiser').withArgs(1, fundraiserAddress, this.token.address, '1000');
      })
    });
  });

  describe('fund fundraiser', async function () {
    beforeEach(async function () {
      console.log(this.token.address);
      await this.fundraiser.createFundraiserE(fundraiserAddress, this.token.address, '1000');
      this.result = await this.fundraiser.connect(user).fund(0, '500');
    });

    it('subtracts from totals', async function () {
      expect(await this.fundraiser.remainingFunding(0)).to.be.equal('500')
      expect(await this.fundraiser.totalFunding(0)).to.be.equal('1000')
      expect(await this.fundraiser.fundingToken(0)).to.be.equal(this.token.address)
    });
  });
});
