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

    await this.bean.mint(userAddress, '200000')
    await this.bean.mint(user2Address, '200000')
    await this.field.incrementTotalSoilEE('100000');

    // await this.weth.mint(user2Address, '2000')

    // await this.pair.faucet(user2Address, '2000');

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
    await this.field.resetField()

    await this.season.siloSunrise(0)

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
    await this.marketplace.connect(user2).listPlot('5000', '500000', '2000', '500');

  }

  const getBuyOfferIndex = async function (tx) {
    let receipt = await tx.wait();
    let idx = (receipt.events?.filter((x) => { return x.event == "BuyOfferCreated" }))[0].args.buyOfferIndex;
    return idx;
  }



  describe("List Plot", async function () {

    beforeEach(async function () {
      await resetState();
    });

    it('Emits a List event', async function () {
      result = await this.marketplace.connect(user2).listPlot('5000', '100000', '0', '1000');
      await expect(result).to.emit(this.marketplace, 'ListingCreated').withArgs(user2Address, '5000', 1000, 100000, 0);

    });

    it('Fails to List Unowned Plot', async function () {
      await expect(this.marketplace.connect(user).listPlot('5000', '500000', '1000', '1000')).to.be.revertedWith('Marketplace: Invalid Plot/Amount.');
    });

    it('Lists partial Plot', async function () {
      const listing = await this.marketplace.listing(1000, user2Address);
      expect(listing.price).to.equal(100000);
      expect(listing.expiry.toString()).to.equal('0');
      expect(listing.amount.toString()).to.equal('500');
    });


    it('Lists full Plot', async function () {
      const listing = await this.marketplace.listing(0, userAddress);
      expect(listing.price).to.equal(500000);
      expect(listing.expiry.toString()).to.equal('0');
      expect(listing.amount.toString()).to.equal('1000');
    });



  });
  describe("Buy Listing", async function () {

    beforeEach(async function () {
      await resetState();
    });




    it('Buy Full Listing, Plots Transfer, Balances Update', async function () {
      let amountBeansBuyingWith = 500;

      const listing = await this.marketplace.listing(0, userAddress);

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

      const listingDeleted = await this.marketplace.listing(0, userAddress);
      expect(listingDeleted.price.toString()).to.equal('0');
      expect(listingDeleted.amount.toString()).to.equal('0');
    });



    it('Buy Partial Listing, Plots Transfer, Balances Update', async function () {
      let amountBeansBuyingWith = 250;

      expect((await this.field.plot(user2Address, 2000)).toString()).to.equal('0');
      expect((await this.field.plot(userAddress, 2000)).toString()).to.equal('1000');

      await this.marketplace.connect(user2).buyListing(2000, userAddress, amountBeansBuyingWith);

      expect((await this.field.plot(userAddress, 2000)).toString()).to.equal('0');
      expect((await this.field.plot(userAddress, 2500)).toString()).to.equal('500');
      expect((await this.field.plot(user2Address, 2000)).toString()).to.equal('500');

      const listingDeleted = await this.marketplace.listing(2000, userAddress);
      expect(listingDeleted.price.toString()).to.equal('0');
      expect(listingDeleted.amount.toString()).to.equal('0');

      const listingNew = await this.marketplace.listing(2500, userAddress);
      expect(listingNew.price.toString()).to.equal('500000');
      expect(listingNew.amount.toString()).to.equal('500');
    });

    it('Buy Listing with ETH and beans', async function () {

      let userBeanBalance = parseInt((await this.bean.balanceOf(userAddress)).toString())
      let user2BeanBalance = parseInt((await this.bean.balanceOf(user2Address)).toString())

      await this.pair.simulateTrade('4000', '1000');
      await this.marketplace.connect(user).buyBeansAndBuyListing(1000, user2Address, 0, 50, { value: 15 });

      expect((await this.field.plot(userAddress, 1000)).toString()).to.equal('500');

      expect((await this.field.plot(user2Address, 1000)).toString()).to.equal('0');

      let user2BeanBalanceAfter = parseInt((await this.bean.balanceOf(user2Address)).toString())
      expect(user2BeanBalanceAfter - user2BeanBalance).to.equal(50);
      let userBeanBalanceAfter = parseInt((await this.bean.balanceOf(userAddress)).toString())
      expect(userBeanBalanceAfter - userBeanBalance).to.equal(0);

      const listingDeleted = await this.marketplace.listing(1000, user2Address);
      expect(listingDeleted.price.toString()).to.equal('0');
      expect(listingDeleted.amount.toString()).to.equal('0');

    });

    it('Buy Partial Listing of Partial Plot With ETH and Beans', async function () {
      let userBeanBalance = parseInt((await this.bean.balanceOf(userAddress)).toString())
      let user2BeanBalance = parseInt((await this.bean.balanceOf(user2Address)).toString())

      await this.pair.simulateTrade('4000', '1000');
      await this.marketplace.connect(user).buyBeansAndBuyListing(5000, user2Address, 100, 100, { value: 30 });

      expect((await this.field.plot(userAddress, 5000)).toString()).to.equal('400');

      expect((await this.field.plot(user2Address, 5000)).toString()).to.equal('0');
      expect((await this.field.plot(user2Address, 5400)).toString()).to.equal('600');

      let user2BeanBalanceAfter = parseInt((await this.bean.balanceOf(user2Address)).toString())
      expect(user2BeanBalanceAfter - user2BeanBalance).to.equal(200);
      let userBeanBalanceAfter = parseInt((await this.bean.balanceOf(userAddress)).toString())
      expect(userBeanBalance - userBeanBalanceAfter).to.equal(100);


      const listingNew = await this.marketplace.listing(5400, user2Address);
      expect(listingNew.price.toString()).to.equal('500000');
      expect(listingNew.amount.toString()).to.equal('100');

      const listingDeleted = await this.marketplace.listing(5000, user2Address);
      expect(listingDeleted.price.toString()).to.equal('0');
      expect(listingDeleted.amount.toString()).to.equal('0');

    });

    it('Fails to buy Listing, not enough ETH used', async function () {
      await this.pair.simulateTrade('4000', '1000');
      await expect(this.marketplace.connect(user2).buyBeansAndBuyListing(4000, userAddress, 0, 100, { value: 24 })).to.be.revertedWith('UniswapV2Router: EXCESSIVE_INPUT_AMOUNT');
    });

    it('Buy Listing non-listed Index Fails', async function () {
      await expect(this.marketplace.connect(user).buyListing(1001, user2Address, 999)).to.be.revertedWith('Marketplace: Listing does not exist.');
    });

    it('Buy Listing after expired', async function () {
      await this.field.incrementTotalHarvestableE('2000');
      await expect(this.marketplace.connect(user2).buyListing(0, userAddress, 500)).to.be.revertedWith('Marketplace: Listing has expired');
    });

    it('Buy Listing not enough pods in plot', async function () {
      await expect(this.marketplace.connect(user2).buyListing(0, userAddress, 750)).to.be.revertedWith('Marketplace: Plot has insufficient amount.');
    });

    it('Buy Listing not enough pods in listing', async function () {
      await this.marketplace.connect(user).listPlot('0', '500000', '0', '500');
      await expect(this.marketplace.connect(user2).buyListing(0, userAddress, 500)).to.be.revertedWith('Marketplace: Not enough pods in listing');
    });


  });


  describe("Cancel Listing", async function () {

    beforeEach(async function () {
      await resetState();
    });

    it('Re-list plot cancels and re-lists', async function () {
      const listing = await this.marketplace.listing(3000, user2Address);
      expect(listing.price).to.equal(100000);
      result = await this.marketplace.connect(user2).listPlot('3000', '200000', '2000', '1000');
      await expect(result).to.emit(this.marketplace, 'ListingCreated').withArgs(user2Address, '3000', 1000, 200000, 2000);
      await expect(result).to.emit(this.marketplace, 'ListingCancelled').withArgs(user2Address, '3000');
      const listingRelisted = await this.marketplace.listing(3000, user2Address);
      expect(listingRelisted.price).to.equal(200000);

    });
    it('Fails to Cancel Listing, not owned by user', async function () {
      await expect(this.marketplace.connect(user).cancelListing('3000')).to.be.revertedWith('Marketplace: Listing not owned by user.');
    });

    it('Cancels Listing, Emits Listing Cancelled Event', async function () {
      const listing = await this.marketplace.listing(3000, user2Address);
      expect(listing.price).to.equal(100000);
      expect(listing.expiry.toString()).to.equal('2000');
      result = (await this.marketplace.connect(user2).cancelListing('3000'));
      const listingCancelled = await this.marketplace.listing(3000, user2Address);
      expect(listingCancelled.price).to.equal(0);
      expect(result).to.emit(this.marketplace, 'ListingCancelled').withArgs(user2Address, '3000');
    });


  });

  describe("Buy Offer", async function () {


    beforeEach(async function () {
      await resetState();
    });

    it('Lists Offer, Emits Event, Balance Updates', async function () {
      let user2BeanBalance = parseInt((await this.bean.balanceOf(user2Address)).toString())
      let result = (await this.marketplace.connect(user2).listBuyOffer('5000', '800000', '400'));
      let buyOfferIdx = await getBuyOfferIndex(result);
      await expect(result).to.emit(this.marketplace, 'BuyOfferCreated').withArgs(user2Address, buyOfferIdx, '500', 800000, '5000');
      let user2BeanBalanceAfterBuyOffer = parseInt((await this.bean.balanceOf(user2Address)).toString())
      expect(user2BeanBalance - user2BeanBalanceAfterBuyOffer).to.equal(400);
      const buyOffer = await this.marketplace.buyOffer(buyOfferIdx);
      expect(buyOffer.amount.toString()).to.equal('500');
      expect(buyOffer.price.toString()).to.equal('800000');
      expect(buyOffer.owner).to.equal(user2Address);
      expect(buyOffer.maxPlaceInLine.toString()).to.equal('5000');

    });

    it('Lists Offer using ETH + Beans', async function () {
      await this.pair.simulateTrade('4000000', '10000');
      let user2BeanBalance = parseInt((await this.bean.balanceOf(user2Address)).toString())
      result = await this.marketplace.connect(user2).buyBeansAndListBuyOffer('10000', '500000', '1000', '4000', { value: 11 });
      let buyOfferIdx = await getBuyOfferIndex(result);
      await expect(result).to.emit(this.marketplace, 'BuyOfferCreated').withArgs(user2Address, buyOfferIdx, '10000', 500000, '10000');
      let user2BeanBalanceAfterBuyOffer = parseInt((await this.bean.balanceOf(user2Address)).toString());
      expect(user2BeanBalance - user2BeanBalanceAfterBuyOffer).to.equal(1000);
      const buyOffer = await this.marketplace.buyOffer(buyOfferIdx);
      expect(buyOffer.amount.toString()).to.equal('10000');
      expect(buyOffer.price.toString()).to.equal('500000');
      expect(buyOffer.owner).to.equal(user2Address);
      expect(buyOffer.maxPlaceInLine.toString()).to.equal('10000');

    });

    it('Buy Offer Index different hash', async function () {
      result = await this.marketplace.connect(user2).listBuyOffer('5000', '800000', '400');
      let buyOfferIdx = await getBuyOfferIndex(result);
      await expect(result).to.emit(this.marketplace, 'BuyOfferCreated').withArgs(user2Address, buyOfferIdx, '500', 800000, '5000');
      result2 = await this.marketplace.connect(user2).listBuyOffer('5000', '500000', '100');
      let buyOfferIdx2 = await getBuyOfferIndex(result2);
      await expect(result2).to.emit(this.marketplace, 'BuyOfferCreated').withArgs(user2Address, buyOfferIdx2, '200', 500000, '5000');
      expect(result).to.not.equal(result2);

    });

    it('Sell, Partial Fill', async function () {
      result = await this.marketplace.connect(user2).listBuyOffer('5000', '800000', '400');
      let buyOfferIdx = await getBuyOfferIndex(result);

      const buyOfferAmountBefore = parseInt((await this.marketplace.buyOffer(buyOfferIdx)).amount.toString());
      let userBeanBalance = parseInt((await this.bean.balanceOf(userAddress)).toString());
      expect((await this.field.plot(userAddress, 4000)).toString()).to.equal('1000');
      expect((await this.field.plot(user2Address, 4000)).toString()).to.equal('0');
      this.result = await this.marketplace.connect(user).sellToBuyOffer('4000', '4000', buyOfferIdx, '250');
      let userBeanBalanceAfterSellToBuyOffer = parseInt((await this.bean.balanceOf(userAddress)).toString())
      expect(userBeanBalanceAfterSellToBuyOffer - userBeanBalance).to.equal(200);
      expect((await this.field.plot(userAddress, 4000)).toString()).to.equal('0');
      expect((await this.field.plot(user2Address, 4000)).toString()).to.equal('250');
      expect((await this.field.plot(userAddress, 4250)).toString()).to.equal('750');
      const buyOfferAmountAfter = parseInt((await this.marketplace.buyOffer(buyOfferIdx)).amount.toString());
      expect(buyOfferAmountBefore - buyOfferAmountAfter).to.equal(250);


    });

    it('Fails to sell plot, Harvestable plot', async function () {
      result = await this.marketplace.connect(user2).listBuyOffer('10000', '800000', '400');
      let buyOfferIdx = await getBuyOfferIndex(result);
      await this.field.connect(user).sowBeansAndIndex('1000');
      await this.field.incrementTotalHarvestableE('6100')
      await expect(this.marketplace.connect(user).sellToBuyOffer('6000', '6000', buyOfferIdx, '250')).to.be.revertedWith('Marketplace: Cannot send harvestable plot.');
    });


    it('Fails to sell plot, unowned plot', async function () {
      result = await this.marketplace.connect(user2).listBuyOffer('10000', '800000', '400');
      let buyOfferIdx = await getBuyOfferIndex(result);
      await this.field.connect(user2).sowBeansAndIndex('1000');
      await expect(this.marketplace.connect(user).sellToBuyOffer('6000', '6000', buyOfferIdx, '250')).to.be.revertedWith('Marketplace: Invaid Plot.');
    });

    it('Fails to list buy offer amount 0', async function () {
      await this.pair.simulateTrade('4000000', '10000');
      await expect(this.marketplace.connect(user2).listBuyOffer('10000', '800000', '0')).to.be.revertedWith('Marketplace: Must offer to buy non-zero amount');
    });

    it('Fails to sell plot, nonexistent buyoffer', async function () {
      result = await this.marketplace.connect(user2).listBuyOffer('10000', '800000', '400');
      await this.field.connect(user).sowBeansAndIndex('1000');
      let buyOfferIdx = await getBuyOfferIndex(result);
      result = await this.marketplace.connect(user2).cancelBuyOffer(buyOfferIdx);
      await expect(this.marketplace.connect(user).sellToBuyOffer('6000', '6000', buyOfferIdx, '250')).to.be.revertedWith('Marketplace: Buy Offer does not exist.');
    });

    it('Multiple partial fills, Offer Deletes', async function () {
      result = await this.marketplace.connect(user2).listBuyOffer('8000', '500000', '1000');
      let buyOfferIdx = await getBuyOfferIndex(result);
      await this.field.connect(user).sowBeansAndIndex('1000');
      await this.field.connect(user).sowBeansAndIndex('400');
      await this.field.connect(user).sowBeansAndIndex('600');

      let userBeanBalance = parseInt((await this.bean.balanceOf(userAddress)).toString())
      await this.marketplace.connect(user).sellToBuyOffer('6000', '6000', buyOfferIdx, '1000');
      await this.marketplace.connect(user).sellToBuyOffer('7000', '7000', buyOfferIdx, '400');
      await this.marketplace.connect(user).sellToBuyOffer('7400', '7400', buyOfferIdx, '600');

      let userBeanBalanceAfterBuyOffer = parseInt((await this.bean.balanceOf(userAddress)).toString());

      expect(userBeanBalanceAfterBuyOffer - userBeanBalance).to.equal(1000);

      const buyOffer = await this.marketplace.buyOffer(buyOfferIdx);
      expect(buyOffer.amount.toString()).to.equal('0');
      expect(buyOffer.price.toString()).to.equal('0');
      expect(buyOffer.maxPlaceInLine.toString()).to.equal('0');
    });

    it('Buy Offer accepts plot only at correct place in line', async function () {
      result = await this.marketplace.connect(user2).listBuyOffer('5000', '500000', '500');
      let buyOfferIdx = await getBuyOfferIndex(result);

      await this.field.connect(user).sowBeansAndIndex('1000');
      await expect(this.marketplace.connect(user).sellToBuyOffer('6000', '6000', buyOfferIdx, '1000')).to.be.revertedWith('Marketplace: Plot too far in line');
      await this.field.incrementTotalHarvestableE('2000');
      result = await this.marketplace.connect(user).sellToBuyOffer('6000', '6000', buyOfferIdx, '1000');
      expect(result).to.emit(this.marketplace, 'BuyOfferFilled').withArgs(userAddress, user2Address, buyOfferIdx, '6000', '1000', 500000);

      const buyOffer = await this.marketplace.buyOffer(buyOfferIdx);
      expect(buyOffer.amount.toString()).to.equal('0');
      expect(buyOffer.price.toString()).to.equal('0');

    });

    it('Cancel Buy Offer, returns beans', async function () {
      result = await this.marketplace.connect(user2).listBuyOffer('5000', '500000', '2000');
      let userBeanBalance = parseInt((await this.bean.balanceOf(user2Address)).toString())
      let buyOfferIdx = await getBuyOfferIndex(result);
      result = await this.marketplace.connect(user2).cancelBuyOffer(buyOfferIdx);
      let userBeanBalanceAfterBuyOffer = parseInt((await this.bean.balanceOf(user2Address)).toString());
      expect(userBeanBalanceAfterBuyOffer - userBeanBalance).to.equal(2000);
      expect(result).to.emit(this.marketplace, 'BuyOfferCancelled').withArgs(user2Address, buyOfferIdx);
    });



    it('Cancel Buy Offer fails unowned', async function () {
      result = await this.marketplace.connect(user2).listBuyOffer('5000', '500000', '2000');
      let buyOfferIdx = await getBuyOfferIndex(result);
      await expect(this.marketplace.connect(user).cancelBuyOffer(buyOfferIdx)).to.be.revertedWith('Field: Buy Offer not owned by user.');
    });


    it('Sell To Buy Offer ends at unowned index', async function () {
      result = await this.marketplace.connect(user2).listBuyOffer('10000', '500000', '2000');
      let buyOfferIdx = await getBuyOfferIndex(result);
      await this.field.connect(user).sowBeansAndIndex('1000');
      await expect(this.marketplace.connect(user).sellToBuyOffer('6000', '6100', buyOfferIdx, '1000')).to.be.revertedWith('Marketplace: Invaid Plot.');
    });

    it('Sell Buy Offer cancels listing', async function () {
      result = await this.marketplace.connect(user2).listBuyOffer('10000', '500000', '2000');
      await this.field.connect(user).sowBeansAndIndex('1000');
      await this.marketplace.connect(user).listPlot('6000', '50000', '5000', '1000');
      const listing = await this.marketplace.listing(6000, userAddress);
      expect(listing.price.toString()).to.equal('50000');
      let buyOfferIdx = await getBuyOfferIndex(result);
      await (this.marketplace.connect(user).sellToBuyOffer('6000', '6000', buyOfferIdx, '1000'));
      const listingDeleted = await this.marketplace.listing(6000, userAddress);
      expect(listingDeleted.price.toString()).to.equal('0');

    });

    it('Sell Buy Offer from end of index', async function () {
      result = await this.marketplace.connect(user2).listBuyOffer('8000', '500000', '1000');
      await this.field.connect(user).sowBeansAndIndex('1000');
      let buyOfferIdx = await getBuyOfferIndex(result);
      let userBeanBalance = parseInt((await this.bean.balanceOf(userAddress)).toString())
      await this.marketplace.connect(user).sellToBuyOffer('6000', '6100', buyOfferIdx, '900');
      let userBeanBalanceAfterBuyOffer = parseInt((await this.bean.balanceOf(userAddress)).toString());
      expect(userBeanBalanceAfterBuyOffer - userBeanBalance).to.equal(450);
      expect((await this.field.plot(userAddress, 6000)).toString()).to.equal('100');
      expect((await this.field.plot(user2Address, 6100)).toString()).to.equal('900');
      const buyOffer = await this.marketplace.buyOffer(buyOfferIdx);
      expect(buyOffer.amount.toString()).to.equal('1100');

    });

    it('Sell Buy Offer from middle of index', async function () {
      result = await this.marketplace.connect(user2).listBuyOffer('8000', '500000', '1000');
      await this.field.connect(user).sowBeansAndIndex('1000');
      let buyOfferIdx = await getBuyOfferIndex(result);
      let userBeanBalance = parseInt((await this.bean.balanceOf(userAddress)).toString())
      await this.marketplace.connect(user).sellToBuyOffer('6000', '6100', buyOfferIdx, '400');
      let userBeanBalanceAfterBuyOffer = parseInt((await this.bean.balanceOf(userAddress)).toString());
      expect(userBeanBalanceAfterBuyOffer - userBeanBalance).to.equal(200);
      expect((await this.field.plot(userAddress, 6000)).toString()).to.equal('100');
      expect((await this.field.plot(userAddress, 6500)).toString()).to.equal('500');
      expect((await this.field.plot(user2Address, 6100)).toString()).to.equal('400');
      const buyOffer = await this.marketplace.buyOffer(buyOfferIdx);
      expect(buyOffer.amount.toString()).to.equal('1600');
    });



  });

});


