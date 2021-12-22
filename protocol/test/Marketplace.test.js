const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { expect, use } = require("chai");
const { waffleChai } = require("@ethereum-waffle/chai");
use(waffleChai);
const { deploy } = require('../scripts/deploy.js')
const { BigNumber } = require('bignumber.js')
const { print, printWeather } = require('./utils/print.js')

let user,user2,owner;
let userAddress, ownerAddress, user2Address ;

async function checkUserPlots(field, address, plots) {
  for (var i = 0; i < plots.length; i++) {
    expect(await field.plot(address, plots[i][0])).to.eq(plots[i][1])
  }
}



describe('Marketplace', function () {
  before(async function () {
    console.log('Starting test');
    [owner,user,user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true);
    const provider = ethers.getDefaultProvider();

    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond
    this.field = await ethers.getContractAt('MockFieldFacet', this.diamond.address);
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address);
    this.marketplace = await ethers.getContractAt('MarketplaceFacet', this.diamond.address);
    this.bean = await ethers.getContractAt('MockToken', contracts.bean);
    this.pair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pair);


    await this.season.resetAccount(userAddress)
    await this.season.resetAccount(user2Address)
    await this.season.resetAccount(ownerAddress)
    await this.season.resetState()
    await this.season.siloSunrise(0)

    await this.bean.mint(userAddress, '10000')
    await this.bean.mint(user2Address, '10000')

    await this.bean.connect(user).approve(this.field.address, '100000000000')
    await this.bean.connect(user2).approve(this.field.address, '100000000000')

    await this.field.incrementTotalSoilEE('10000');
    await this.field.connect(user).sowBeans('1000');
    await this.field.connect(user2).sowBeans('1000');
    await this.field.connect(user).sowBeans('1000');
    await this.field.connect(user2).sowBeans('1000');
    await this.field.connect(user).sowBeans('1000');
    await this.field.connect(user2).sowBeans('1000');
    
    this.result = await this.marketplace.connect(user2).listPlot('1000', '500000', '0', '500');
    this.result = await this.marketplace.connect(user).listPlot('2000', '500000', '0', '1000');
    this.result = await this.marketplace.connect(user2).listPlot('3000', '100000', '2000', '1000');
    this.result = await this.marketplace.connect(user).listPlot('4000', '100000', '2000', '1000');

  });


  beforeEach (async function () {
    await this.season.resetAccount(userAddress)
    await this.season.resetAccount(user2Address)
    await this.season.resetAccount(ownerAddress)
    await this.season.resetState()
    await this.season.siloSunrise(0)
  });


  describe("List Plot", async function () {

    
    it('Emits a List event', async function () {
      result = await this.marketplace.connect(user).listPlot('0', '500000', '0', '1000');
      await expect(result).to.emit(this.marketplace, 'ListingCreated').withArgs(userAddress, '0', 500000, 0, 1000);
    });

    it('Fails to List Unowned Plot', async function () {
      await expect(this.marketplace.connect(user).listPlot('1000', '500000', '1000', '1000')).to.be.revertedWith('Marketplace: Plot not large enough.');
    });


    it('Lists the product', async function () {
      const listing = await this.marketplace.listing(0);
      expect(listing.price).to.equal(500000);
      expect(listing.expiry.toString()).to.equal('0');
      expect(listing.amount.toString()).to.equal('0');
    });    


  });
  describe("Buy Listing", async function () {

    it('Buy Full Listing, Plots Transfer, Balances Update', async function () {
      const listing = await this.marketplace.listing(0);
      expect((await this.field.plot(user2Address, 0)).toString()).to.equal('0');
      expect((await this.field.plot(userAddress, 0)).toString()).to.equal('1000');
      expect((await this.bean.balanceOf(userAddress)).toString()).to.eq('7000');
      expect((await this.bean.balanceOf(user2Address)).toString()).to.eq('7000');
      await this.marketplace.connect(user2).buyListing(0, userAddress, '1000'); 
   
      expect((await this.field.plot(userAddress, 0)).toString()).to.equal('0');
      expect((await this.field.plot(user2Address, 0)).toString()).to.equal('1000');

      expect((await this.bean.balanceOf(userAddress)).toString()).to.eq('7500');
      expect((await this.bean.balanceOf(user2Address)).toString()).to.eq('6500');

      const listingDeleted = await this.marketplace.listing(0);
      expect(listingDeleted.price.toString()).to.equal('0');
      expect(listingDeleted.amount.toString()).to.equal('0');

    });



    it('Buy Partial Listing, Plots Transfer, Balances Update', async function () {
      const listing = await this.marketplace.listing(0);
      expect((await this.field.plot(user2Address, 2000)).toString()).to.equal('0');
      expect((await this.field.plot(userAddress, 2000)).toString()).to.equal('1000');
      expect((await this.bean.balanceOf(userAddress)).toString()).to.eq('7500');
      expect((await this.bean.balanceOf(user2Address)).toString()).to.eq('6500');

      await this.marketplace.connect(user2).buyListing(2000, userAddress, '500'); 
   
      expect((await this.field.plot(userAddress, 2000)).toString()).to.equal('0');
      expect((await this.field.plot(userAddress, 2500)).toString()).to.equal('500');
      expect((await this.field.plot(user2Address, 2000)).toString()).to.equal('500');

      expect((await this.bean.balanceOf(userAddress)).toString()).to.eq('7750');
      expect((await this.bean.balanceOf(user2Address)).toString()).to.eq('6250');
      const listingDeleted = await this.marketplace.listing(2000);
      expect(listingDeleted.price.toString()).to.equal('0');
      expect(listingDeleted.amount.toString()).to.equal('0');
      const listingNew = await this.marketplace.listing(2500);
      expect(listingNew.price.toString()).to.equal('500000');
      expect(listingNew.amount.toString()).to.equal('500');

    });

    //TODO List  Buy Listing w ETH




    // it('Buy Partial Listing of Partial Plot', async function () {

    //   this.result = await this.marketplace.connect(user2).listPlot('2500', '500000', '0', '500');

    //   const listing = await this.marketplace.listing(1000);
    //   expect((await this.field.plot(user2Address, 1000)).toString()).to.equal('1000');
    //   expect(listing.amount.toString()).to.equal('500');

    //   expect((await this.field.plot(userAddress, 1000)).toString()).to.equal('0');
    //   expect((await this.bean.balanceOf(userAddress)).toString()).to.eq('7000');
    //   expect((await this.bean.balanceOf(user2Address)).toString()).to.eq('7000');

    //   await this.marketplace.connect(user).buyListing(1000, user2Address, '300'); 
   
    //   expect((await this.field.plot(userAddress, 1000)).toString()).to.equal('300');
    //   expect((await this.field.plot(user2Address, 1000)).toString()).to.equal('0');
    //   expect((await this.field.plot(user2Address, 1300)).toString()).to.equal('700');

    //   expect((await this.bean.balanceOf(userAddress)).toString()).to.eq('7150');
    //   expect((await this.bean.balanceOf(user2Address)).toString()).to.eq('6950');

    //   const listingDeleted = await this.marketplace.listing(1000);
    //   expect(listingDeleted.price.toString()).to.equal('0');
    //   expect(listingDeleted.amount.toString()).to.equal('0');

    //   const listingNew = await this.marketplace.listing(1300);
    //   expect(listingNew.amount.toString()).to.equal('200');
    //   expect(listingNew.price.toString()).to.equal('500');
    // });

    // it('Buy Listing Fails after Expiry', async function () {
    //   //
    // });

    // it('Buy Listing with Ethereum and beans', async function () {
    //   //
    // });

    // it('Buy Listing non-listed Index', async function () {
    //   //
    // });


  });


  describe("Cancel Listing", async function () {

    it('Fails to Cancel Listing, not owned by user', async function () {
      await expect(this.marketplace.connect(user).cancelListing('3000')).to.be.revertedWith('Marketplace: Plot not owned by user.');
    });
    
    it('Cancels Listing, Emits Listing Cancelled Event', async function () {
      const listing = await this.marketplace.listing(3000);
      expect(listing.price).to.equal(100000);
      expect(listing.expiry.toString()).to.equal('2000');
      result = (await this.marketplace.connect(user2).cancelListing('3000'));
      const listingCancelled = await this.marketplace.listing(3000);
      expect(listingCancelled.price).to.equal(0);
      expect(result).to.emit(this.marketplace, 'ListingCancelled').withArgs(user2Address, '3000');
    });

  });

  describe("Buy Offer", async function () {

    it('Lists Buy Offer, Sells Plot to Buy Offer', async function () {
      await this.pair.simulateTrade('10000', '40000');

      let user2BeanBalance = parseInt((await this.bean.balanceOf(user2Address)).toString())
      this.result = await this.marketplace.connect(user2).listBuyOffer('5000', '800000', '500', 0);
      let user2BeanBalanceAfterBuyOffer = parseInt((await this.bean.balanceOf(user2Address)).toString())
      expect(user2BeanBalance-user2BeanBalanceAfterBuyOffer).to.equal(400);

      let userBeanBalance2 = parseInt((await this.bean.balanceOf(userAddress)).toString())
      this.result = await this.marketplace.connect(user).sellToBuyOffer('4000', '0', '250');
      let userBeanBalanceAfterBuyOffer2 = parseInt((await this.bean.balanceOf(userAddress)).toString())
      expect(userBeanBalanceAfterBuyOffer2-userBeanBalance2).to.equal(200);

    });

    it('Lists Buy Offer, usiing ETH', async function () {
      await this.pair.simulateTrade('10000', '40000');

      let user2BeanBalance = parseInt((await this.bean.balanceOf(user2Address)).toString())
      this.result = await this.marketplace.connect(user2).listBuyOffer('5000', '800000', '500', 0);
      let user2BeanBalanceAfterBuyOffer = parseInt((await this.bean.balanceOf(user2Address)).toString())
      expect(user2BeanBalance-user2BeanBalanceAfterBuyOffer).to.equal(400);

      let userBeanBalance2 = parseInt((await this.bean.balanceOf(userAddress)).toString())
      this.result = await this.marketplace.connect(user).sellToBuyOffer('4000', '0', '250');
      let userBeanBalanceAfterBuyOffer2 = parseInt((await this.bean.balanceOf(userAddress)).toString())
      expect(userBeanBalanceAfterBuyOffer2-userBeanBalance2).to.equal(200);

    });
    //TODO List  Buy offer w ETH



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
