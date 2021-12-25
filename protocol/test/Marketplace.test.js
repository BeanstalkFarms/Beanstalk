const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { expect, use } = require("chai");
const { waffleChai } = require("@ethereum-waffle/chai");
use(waffleChai);
const { deploy } = require('../scripts/deploy.js')
const { BigNumber } = require('bignumber.js')
const { print, printWeather } = require('./utils/print.js')

let user, user2, owner;
let userAddress, ownerAddress, user2Address;

describe('Marketplace', function () {
  let contracts
  let provider
  before(async function () {
    console.log('Starting test');
    contracts = await deploy("Test", false, true);
    [owner, user, user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    provider = ethers.getDefaultProvider();

    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond
    this.field = await ethers.getContractAt('MockFieldFacet', this.diamond.address);
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address);
    this.marketplace = await ethers.getContractAt('MarketplaceFacet', this.diamond.address);
    this.bean = await ethers.getContractAt('MockToken', contracts.bean);
    this.pair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pair);
  });

  const resetState = async function () {
    this.diamond = contracts.beanstalkDiamond

    this.field = await ethers.getContractAt('MockFieldFacet', this.diamond.address);
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address);
    this.marketplace = await ethers.getContractAt('MarketplaceFacet', this.diamond.address);
    this.bean = await ethers.getContractAt('MockToken', contracts.bean);
    this.pair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pair);
    this.weth = await ethers.getContractAt('MockToken', contracts.weth)

    await this.season.resetAccount(userAddress)
    await this.season.resetAccount(user2Address)
    await this.season.resetAccount(ownerAddress)
    await this.season.resetState()
    await this.season.siloSunrise(0)
    await this.bean.mint(userAddress, '10000')
    await this.bean.mint(user2Address, '10000')
    await this.weth.mint(user2Address, '2000')

    await this.pair.faucet(user2Address, '2000');

    await this.bean.connect(user).approve(this.field.address, '100000000000')
    await this.bean.connect(user2).approve(this.field.address, '100000000000')

    await this.field.incrementTotalSoilEE('100000');
    await this.field.connect(user).sowBeansAndIndex('1000');
    await this.field.connect(user2).sowBeansAndIndex('1000');
    await this.field.connect(user).sowBeansAndIndex('1000');
    await this.field.connect(user2).sowBeansAndIndex('1000');
    await this.field.connect(user).sowBeansAndIndex('1000');
    await this.field.connect(user2).sowBeansAndIndex('1000');
    await this.marketplace.connect(user).listPlot('0', '500000', '0', '1000');
    await this.marketplace.connect(user2).listPlot('1000', '100000', '0', '500');
    await this.marketplace.connect(user).listPlot('2000', '500000', '0', '1000');
    await this.marketplace.connect(user2).listPlot('3000', '100000', '2000', '1000');
    await this.marketplace.connect(user).listPlot('4000', '100000', '2000', '1000');
    await user2.sendTransaction({
      to: this.weth.address,
      value: ethers.utils.parseEther("1.0")
    });
  }



  describe("List Plot", async function () {

    beforeEach(async function () {
      await resetState();
    });

    it('Emits a List event', async function () {
      result = await this.marketplace.connect(user2).listPlot('5000', '100000', '0', '1000');
      await expect(result).to.emit(this.marketplace, 'ListingCreated').withArgs(user2Address, '5000', 100000, 0, 1000);
    });

    it('Fails to List Unowned Plot', async function () {
      await expect(this.marketplace.connect(user).listPlot('5000', '500000', '1000', '1000')).to.be.revertedWith('Marketplace: Invalid Plot/Amount.');
    });

    it('Fails to List Plot expiry too late', async function () {
      await expect(this.marketplace.connect(user2).listPlot('5000', '500000', '6000', '1000')).to.be.revertedWith('Marketplace: Invalid Expiry.');
    });


    it('Lists partial Plot', async function () {
      const listing = await this.marketplace.listing(1000);
      expect(listing.price).to.equal(100000);
      expect(listing.expiry.toString()).to.equal('0');
      expect(listing.amount.toString()).to.equal('500');
    });


    it('Lists full Plot', async function () {
      const listing = await this.marketplace.listing(0);
      expect(listing.price).to.equal(500000);
      expect(listing.expiry.toString()).to.equal('0');
      expect(listing.amount.toString()).to.equal('0');
    });



  });
  describe("Buy Listing", async function () {

    beforeEach(async function () {
      resetState();
    });

    it('Buy Full Listing, Plots Transfer, Balances Update', async function () {
      let amountBeansBuyingWith = 500;

      const listing = await this.marketplace.listing(0);

      expect((await this.field.plot(user2Address, 0)).toString()).to.equal('0');
      expect((await this.field.plot(userAddress, 0)).toString()).to.equal('1000');

      let userBeanBalance = parseInt((await this.bean.balanceOf(userAddress)).toString())
      let user2BeanBalance = parseInt((await this.bean.balanceOf(user2Address)).toString())

      await this.marketplace.connect(user2).buyListing(0, userAddress, amountBeansBuyingWith);

      expect((await this.field.plot(userAddress, 0)).toString()).to.equal('0');

      expect((await this.field.plot(user2Address, 0)).toString()).to.equal('1000');

      let user2BeanBalanceAfter = parseInt((await this.bean.balanceOf(user2Address)).toString())
      expect(user2BeanBalance - user2BeanBalanceAfter).to.equal(amountBeansBuyingWith);
      let userBeanBalanceAfter = parseInt((await this.bean.balanceOf(userAddress)).toString())
      expect(userBeanBalanceAfter - userBeanBalance).to.equal(amountBeansBuyingWith);

      const listingDeleted = await this.marketplace.listing(0);
      expect(listingDeleted.price.toString()).to.equal('0');
      expect(listingDeleted.amount.toString()).to.equal('0');
    });



    it('Buy Partial Listing, Plots Transfer, Balances Update', async function () {
      let amountBeansBuyingWith = 250;

      const listing = await this.marketplace.listing(0);
      expect((await this.field.plot(user2Address, 2000)).toString()).to.equal('0');
      expect((await this.field.plot(userAddress, 2000)).toString()).to.equal('1000');

      await this.marketplace.connect(user2).buyListing(2000, userAddress, amountBeansBuyingWith);

      expect((await this.field.plot(userAddress, 2000)).toString()).to.equal('0');
      expect((await this.field.plot(userAddress, 2500)).toString()).to.equal('500');
      expect((await this.field.plot(user2Address, 2000)).toString()).to.equal('500');

      const listingDeleted = await this.marketplace.listing(2000);
      expect(listingDeleted.price.toString()).to.equal('0');
      expect(listingDeleted.amount.toString()).to.equal('0');

      const listingNew = await this.marketplace.listing(2500);
      expect(listingNew.price.toString()).to.equal('500000');
      expect(listingNew.amount.toString()).to.equal('500');
    });


    // it('Buy Partial Listing of Partial Plot', async function () {

    // });

    // it('Buy Listing Fails after Expiry', async function () {
    //   //
    // });

    // TODO   Buy Listing w ETH

    // it('Buy Listing with ETH and beans', async function () {
    //   //
    // });

    // it('Buy Listing non-listed Index Fails', async function () {
    //   //
    // });

    // TODO

  });


  describe("Cancel Listing", async function () {

    beforeEach(async function () {
      resetState();
    });

    it('Re-list plot cancels and re-lists', async function () {
      const listing = await this.marketplace.listing(3000);
      expect(listing.price).to.equal(100000);
      result = await this.marketplace.connect(user2).listPlot('3000', '200000', '2000', '1000');
      await expect(result).to.emit(this.marketplace, 'ListingCreated').withArgs(user2Address, '3000', 200000, 2000, 1000);
      await expect(result).to.emit(this.marketplace, 'ListingCancelled').withArgs(user2Address, '3000');
      const listingRelisted = await this.marketplace.listing(3000);
      expect(listingRelisted.price).to.equal(200000);

    });
    it('Fails to Cancel Listing, not owned by user', async function () {
      await expect(this.marketplace.connect(user).cancelListing('3000')).to.be.revertedWith('Marketplace: Plot not owned by user.');
    });

    it('Cancels Listing, Emits Listing Cancelled Event', async function () {
      const listing = await this.marketplace.listing(3000);
      expect(listing.price).to.equal(200000);
      expect(listing.expiry.toString()).to.equal('2000');
      result = (await this.marketplace.connect(user2).cancelListing('3000'));
      const listingCancelled = await this.marketplace.listing(3000);
      expect(listingCancelled.price).to.equal(0);
      expect(result).to.emit(this.marketplace, 'ListingCancelled').withArgs(user2Address, '3000');
    });


  });

  describe("Buy Offer", async function () {

    beforeEach(async function () {
      resetState();
    });

    it('Lists Buy Offer, Sells Plot to Buy Offer', async function () {

      let user2BeanBalance = parseInt((await this.bean.balanceOf(user2Address)).toString())
      this.result = await this.marketplace.connect(user2).listBuyOffer('5000', '800000', '400');
      let user2BeanBalanceAfterBuyOffer = parseInt((await this.bean.balanceOf(user2Address)).toString())
      expect(user2BeanBalance - user2BeanBalanceAfterBuyOffer).to.equal(400);

      let userBeanBalance2 = parseInt((await this.bean.balanceOf(userAddress)).toString())
      this.result = await this.marketplace.connect(user).sellToBuyOffer('4000', '0', '250');
      let userBeanBalanceAfterBuyOffer2 = parseInt((await this.bean.balanceOf(userAddress)).toString())
      expect(userBeanBalanceAfterBuyOffer2 - userBeanBalance2).to.equal(200);

    });

    it('Lists Buy Offer using ETH', async function () {

      // const ethBalance = await provider.getBalance(user2Address);
      // console.log("ETH BALANCE", ethBalance.toString());

      await this.pair.simulateTrade('4000000', '10000');

      let user2BeanBalance = parseInt((await this.bean.balanceOf(user2Address)).toString())
      const options = { value: ethers.utils.parseEther("1") }
      this.result = await this.marketplace.connect(user2).buyBeansAndListBuyOffer('5000', '800000', '0', '4000', { value: 11 });

      // const ethBalanceAfter = await provider.getBalance(user2Address);
      // console.log(ethBalanceAfter.toString());

    });

    // TODO test that LibMarket.buyExact works
    // TO do this, need, to get balance of user ETH

    // TODO test moving the line forward



    // it('Sell to Buy Offer Fails, Too Far in Line', async function () {

    //   let user2BeanBalance = parseInt((await this.bean.balanceOf(user2Address)).toString())
    //   this.result = await this.marketplace.connect(user2).sellToBuyOffer('3000', '800000', '500', 0);
    //   let user2BeanBalanceAfterBuyOffer = parseInt((await this.bean.balanceOf(userAddress)).toString())
    //   expect(user2BeanBalance-user2BeanBalanceAfterBuyOffer).to.equal(400);
    // });

    it('Sells Plot to Buy Offer', async function () {

    });

    // Cancel Buy Offer
    // TODO more coverage



  });

});
