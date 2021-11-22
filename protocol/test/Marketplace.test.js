const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { BigNumber } = require('bignumber.js')
const { print } = require('./utils/print.js')

let user,user2,owner;
let userAddress, ownerAddress, user2Address;

describe('Marketplace', function () {
  before(async function () {
    [owner,user,user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond
    this.field = await ethers.getContractAt('MockFieldFacet', this.diamond.address);
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address);
    this.marketplace = await ethers.getContractAt('MarketplaceFacet', this.diamond.address);
    this.bean = await ethers.getContractAt('MockToken', contracts.bean);

    await this.bean.mint(userAddress, '1000000000')
    await this.bean.mint(user2Address, '1000000000')
    await this.bean.connect(user).approve(this.field.address, '100000000000')
    await this.bean.connect(user2).approve(this.field.address, '100000000000')
  });

  beforeEach (async function () {
    await this.season.resetAccount(userAddress)
    await this.season.resetAccount(user2Address)
    await this.season.resetAccount(ownerAddress)
    await this.season.resetState()
    await this.season.siloSunrise(0)
  });

  describe("List Plot", async function () {
    beforeEach (async function () {
      await this.field.incrementTotalSoilEE('1000');
      await this.field.connect(user).sowBeans('1000');

      this.result = await this.marketplace.connect(user).list('0', '1', '1000000');
    });

    it('Emits a List event', async function () {
      expect(this.result).to.emit(this.marketplace, 'CreateListing').withArgs(userAddress, '0', 1, '1000000');
    });

    it('Lists the product', async function () {
      const listing = await this.marketplace.listing(0);
      expect(listing.price).to.equal(1);
      expect(listing.expiry).to.equal('1000000');
    });

  });

});
