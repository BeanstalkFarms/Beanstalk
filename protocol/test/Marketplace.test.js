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
    // Index, amount, start, price, expiry
    // Index [start, amount, price, expiry, toWallet]
    // ('0', '1000', '0', '500000', '0');
    await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', true);
    await this.marketplace.connect(user2).createPodListing('1000', '0', '500', '100000', '0', true);
    await this.marketplace.connect(user).createPodListing('2000', '0', '1000', '500000', '0', true);
    await this.marketplace.connect(user2).createPodListing('3000', '0', '1000', '100000', '2000', true);
    await this.marketplace.connect(user).createPodListing('4000', '0', '1000', '100000', '2000', true);
    await this.marketplace.connect(user2).createPodListing('5000', '500', '500', '500000', '2000', true);

  }

  const getOrderIndex = async function (tx) {
    let receipt = await tx.wait();
    let idx = (receipt.events?.filter((x) => { return x.event == "PodOrderCreated" }))[0].args.podOrderIndex;
    return idx;
  }
 
  describe("List Plot", async function () {

    beforeEach(async function () {
      await resetState();
    });

    it('Fails to List Unowned Plot', async function () {
      await expect(this.marketplace.connect(user).createPodListing('5000', '0', '1000', '100000', '0', false)).to.be.revertedWith('Marketplace: Invalid Plot/Amount.');
    });

    it('Fails if amount is 0', async function () {
      await expect(this.marketplace.connect(user2).createPodListing('5000', '0', '0', '100000', '0', false)).to.be.revertedWith('Marketplace: Invalid Plot/Amount.');
    });

    it('fails if price is 0', async function () {
      await expect(this.marketplace.connect(user2).createPodListing('5000', '0', '1000', '0', '0', false)).to.be.revertedWith('Marketplace: Pod price must be greater than 0.');
    });

    it('Fails if start + amount too large', async function () {
      await expect(this.marketplace.connect(user2).createPodListing('5000', '500', '1000', '100000', '0', false)).to.be.revertedWith('Marketplace: Invalid Plot/Amount.');
    });

    it('Lists partial Plot', async function () {
      const podListing = await this.marketplace.podListing(user2Address, 1000);
      expect(podListing.price).to.equal(100000);
      expect(podListing.maxHarvestableIndex.toString()).to.equal('0');
      expect(podListing.amount.toString()).to.equal('500');
      expect(podListing.start.toString()).to.equal('0');
      expect(podListing.toWallet).to.equal(true);
    });


    it('Lists full Plot', async function () {
      const podListing = await this.marketplace.podListing(userAddress, 0);
      expect(podListing.price).to.equal(500000);
      expect(podListing.maxHarvestableIndex.toString()).to.equal('0');
      expect(podListing.amount.toString()).to.equal('1000');
    });



  });
  describe("Buy Listing", async function () {

    beforeEach(async function () {
      await resetState();
    });

    it('Buy Full Listing, Plots Transfer, Balances Update', async function () {
      let amountBeansBuyingWith = 500;

      const podListing = await this.marketplace.podListing(userAddress, 0);

      expect((await this.field.plot(user2Address, 0)).toString()).to.equal('0');
      expect((await this.field.plot(userAddress, 0)).toString()).to.equal('1000');

      let userBeanBalance = parseInt((await this.bean.balanceOf(userAddress)).toString())
      let user2BeanBalance = parseInt((await this.bean.balanceOf(user2Address)).toString())

      await this.marketplace.connect(user2).buyPodListing(userAddress, 0, 0, amountBeansBuyingWith, '500000');

      expect((await this.field.plot(userAddress, 0)).toString()).to.equal('0');

      expect((await this.field.plot(user2Address, 0)).toString()).to.equal('1000');

      let user2BeanBalanceAfter = parseInt((await this.bean.balanceOf(user2Address)).toString())
      expect(user2BeanBalance - user2BeanBalanceAfter).to.equal(amountBeansBuyingWith);
      let userBeanBalanceAfter = parseInt((await this.bean.balanceOf(userAddress)).toString())
      expect(userBeanBalanceAfter - userBeanBalance).to.equal(amountBeansBuyingWith);

      const podListingDeleted = await this.marketplace.podListing(userAddress, 0);
      expect(podListingDeleted.price.toString()).to.equal('0');
      expect(podListingDeleted.amount.toString()).to.equal('0');
    });



    it('Buy Partial Listing, Plots Transfer, Balances Update', async function () {
      let amountBeansBuyingWith = 250;

      expect((await this.field.plot(user2Address, 2000)).toString()).to.equal('0');
      expect((await this.field.plot(userAddress, 2000)).toString()).to.equal('1000');

      await this.marketplace.connect(user2).buyPodListing(userAddress, 2000, 0, amountBeansBuyingWith, '500000');

      expect((await this.field.plot(userAddress, 2000)).toString()).to.equal('0');
      expect((await this.field.plot(userAddress, 2500)).toString()).to.equal('500');
      expect((await this.field.plot(user2Address, 2000)).toString()).to.equal('500');

      const podListingDeleted = await this.marketplace.podListing(userAddress, 2000);
      expect(podListingDeleted.price.toString()).to.equal('0');
      expect(podListingDeleted.amount.toString()).to.equal('0');

      const podListingNew = await this.marketplace.podListing(userAddress, 2500);
      expect(podListingNew.price.toString()).to.equal('500000');
      expect(podListingNew.amount.toString()).to.equal('500');
    });

    it('Buy Listing with ETH and beans from back of podListing', async function () {

      let userBeanBalance = parseInt((await this.bean.balanceOf(userAddress)).toString())
      let user2BeanBalance = parseInt((await this.bean.balanceOf(user2Address)).toString())

      await this.pair.simulateTrade('4000', '1000');
      await this.marketplace.connect(user).buyBeansAndBuyPodListing(user2Address, 1000, 0, 0, 50, '100000', { value: 15 });

      expect((await this.field.plot(userAddress, 1000)).toString()).to.equal('500');
      expect((await this.field.plot(user2Address, 1500)).toString()).to.equal('500');
      expect((await this.field.plot(userAddress, 1500)).toString()).to.equal('0');
      expect((await this.field.plot(user2Address, 1000)).toString()).to.equal('0');

      let user2BeanBalanceAfter = parseInt((await this.bean.balanceOf(user2Address)).toString())
      expect(user2BeanBalanceAfter - user2BeanBalance).to.equal(50);
      let userBeanBalanceAfter = parseInt((await this.bean.balanceOf(userAddress)).toString())
      expect(userBeanBalanceAfter - userBeanBalance).to.equal(0);

      const podListingDeleted = await this.marketplace.podListing(user2Address, 1000);
      expect(podListingDeleted.price.toString()).to.equal('0');
      expect(podListingDeleted.amount.toString()).to.equal('0');

    });

    it('Buy Partial Listing of Partial Plot With ETH and Beans', async function () {
      let userBeanBalance = parseInt((await this.bean.balanceOf(userAddress)).toString())
      let user2BeanBalance = parseInt((await this.bean.balanceOf(user2Address)).toString())

      await this.pair.simulateTrade('4000', '1000');
      await this.marketplace.connect(user).buyBeansAndBuyPodListing(user2Address, 5000, 500, 100, 100, '500000', { value: 30 });

      expect((await this.field.plot(userAddress, 5500)).toString()).to.equal('400');

      expect((await this.field.plot(user2Address, 5500)).toString()).to.equal('0');
      expect((await this.field.plot(userAddress, 5000)).toString()).to.equal('0');

      expect((await this.field.plot(user2Address, 5000)).toString()).to.equal('500');
      expect((await this.field.plot(user2Address, 5900)).toString()).to.equal('100');

      let user2BeanBalanceAfter = parseInt((await this.bean.balanceOf(user2Address)).toString())
      expect(user2BeanBalanceAfter - user2BeanBalance).to.equal(200);
      let userBeanBalanceAfter = parseInt((await this.bean.balanceOf(userAddress)).toString())
      expect(userBeanBalance - userBeanBalanceAfter).to.equal(100);


      const podListingNew = await this.marketplace.podListing(user2Address, 5900);
      expect(podListingNew.price.toString()).to.equal('500000');
      expect(podListingNew.amount.toString()).to.equal('100');

      const podListingDeleted = await this.marketplace.podListing(user2Address, 5000);
      expect(podListingDeleted.price.toString()).to.equal('0');
      expect(podListingDeleted.amount.toString()).to.equal('0');
    });

    it('Fails to buy Listing, not enough ETH used', async function () {
      await this.pair.simulateTrade('4000', '1000');
      await expect(this.marketplace.connect(user2).buyBeansAndBuyPodListing(userAddress, 4000, 0, 0, 100, '100000', { value: 24 })).to.be.revertedWith('UniswapV2Router: EXCESSIVE_INPUT_AMOUNT');
    });

    it('Buy Listing non-listed Index Fails', async function () {
      await expect(this.marketplace.connect(user).buyPodListing(user2Address, 1001, 0, 999, '100000')).to.be.revertedWith('Marketplace: Listing does not exist.');
    });

    it('Buy Listing after expired', async function () {
      await this.field.incrementTotalHarvestableE('2000');
      await expect(this.marketplace.connect(user2).buyPodListing(userAddress, 0, 0, 500, '500000')).to.be.revertedWith('Marketplace: Listing has expired');
    });

    it('Buy Listing not enough pods in plot', async function () {
      await expect(this.marketplace.connect(user2).buyPodListing(userAddress, 0, 0, 501, '500000')).to.be.revertedWith('Marketplace: Not enough pods in listing.');
    });

    it('Buy Listing not enough pods in listing', async function () {
      await this.marketplace.connect(user).createPodListing('0', '0', '500', '500000', '0', false);
      await expect(this.marketplace.connect(user2).buyPodListing(userAddress, 0, 0, 500, '500000')).to.be.revertedWith('Marketplace: Not enough pods in listing');
    });
  });


  describe("Cancel Listing", async function () {

    beforeEach(async function () {
      await resetState();
    });

    it('Re-list plot cancels and re-lists', async function () {
      const podListing = await this.marketplace.podListing(user2Address, 3000);
      expect(podListing.price).to.equal(100000);
      result = await this.marketplace.connect(user2).createPodListing('3000', '0', '1000', '200000', '2000', false);
      await expect(result).to.emit(this.marketplace, 'PodListingCreated').withArgs(user2Address, '3000', 0, 1000, 200000, 2000, false);
      await expect(result).to.emit(this.marketplace, 'PodListingCancelled').withArgs(user2Address, '3000');
      const podListingRelisted = await this.marketplace.podListing(user2Address, 3000);
      expect(podListingRelisted.price).to.equal(200000);

    });
    it('Fails to Cancel Listing, not owned by user', async function () {
      await expect(this.marketplace.connect(user).cancelPodListing('3000')).to.be.revertedWith('Marketplace: Listing not owned by user.');
    });

    it('Cancels Listing, Emits Listing Cancelled Event', async function () {
      const podListing = await this.marketplace.podListing(user2Address, 3000);
      expect(podListing.price).to.equal(100000);
      expect(podListing.maxHarvestableIndex.toString()).to.equal('2000');
      result = (await this.marketplace.connect(user2).cancelPodListing('3000'));
      const podListingCancelled = await this.marketplace.podListing(user2Address, 3000);
      expect(podListingCancelled.price).to.equal(0);
      expect(result).to.emit(this.marketplace, 'PodListingCancelled').withArgs(user2Address, '3000');
    });
  });

  // describe("Buy Offer", async function () {
  //   beforeEach(async function () {
  //     await resetState();
  //   });

  //   it('Lists Offer, Emits Event, Balance Updates', async function () {
  //     let user2BeanBalance = parseInt((await this.bean.balanceOf(user2Address)).toString())
  //     let result = (await this.marketplace.connect(user2).listOrder('5000', '800000', '400'));
  //     let podOrderIdx = await getOrderIndex(result);
  //     await expect(result).to.emit(this.marketplace, 'PodOrderCreated').withArgs(user2Address, podOrderIdx, '500', 800000, '5000');
  //     let user2BeanBalanceAfterOrder = parseInt((await this.bean.balanceOf(user2Address)).toString())
  //     expect(user2BeanBalance - user2BeanBalanceAfterOrder).to.equal(400);
  //     const podOrder = await this.marketplace.podOrder(podOrderIdx);
  //     expect(podOrder.amount.toString()).to.equal('500');
  //     expect(podOrder.price.toString()).to.equal('800000');
  //     expect(podOrder.owner).to.equal(user2Address);
  //     expect(podOrder.maxPlaceInLine.toString()).to.equal('5000');

  //   });

  //   it('Lists Offer using ETH + Beans', async function () {
  //     await this.pair.simulateTrade('4000000', '10000');
  //     let user2BeanBalance = parseInt((await this.bean.balanceOf(user2Address)).toString())
  //     result = await this.marketplace.connect(user2).buyBeansAndListOrder('10000', '500000', '1000', '4000', { value: 11 });
  //     let podOrderIdx = await getOrderIndex(result);
  //     await expect(result).to.emit(this.marketplace, 'PodOrderCreated').withArgs(user2Address, podOrderIdx, '10000', 500000, '10000');
  //     let user2BeanBalanceAfterOrder = parseInt((await this.bean.balanceOf(user2Address)).toString());
  //     expect(user2BeanBalance - user2BeanBalanceAfterOrder).to.equal(1000);
  //     const podOrder = await this.marketplace.podOrder(podOrderIdx);
  //     expect(podOrder.amount.toString()).to.equal('10000');
  //     expect(podOrder.price.toString()).to.equal('500000');
  //     expect(podOrder.owner).to.equal(user2Address);
  //     expect(podOrder.maxPlaceInLine.toString()).to.equal('10000');

  //   });

  //   it('Buy Offer Index different hash', async function () {
  //     result = await this.marketplace.connect(user2).listOrder('5000', '800000', '400');
  //     let podOrderIdx = await getOrderIndex(result);
  //     await expect(result).to.emit(this.marketplace, 'PodOrderCreated').withArgs(user2Address, podOrderIdx, '500', 800000, '5000');
  //     result2 = await this.marketplace.connect(user2).listOrder('5000', '500000', '100');
  //     let podOrderIdx2 = await getOrderIndex(result2);
  //     await expect(result2).to.emit(this.marketplace, 'PodOrderCreated').withArgs(user2Address, podOrderIdx2, '200', 500000, '5000');
  //     expect(result).to.not.equal(result2);

  //   });

  //   it('Sell, Partial Fill', async function () {
  //     result = await this.marketplace.connect(user2).listOrder('5000', '800000', '400');
  //     let podOrderIdx = await getOrderIndex(result);

  //     const podOrderAmountBefore = parseInt((await this.marketplace.podOrder(podOrderIdx)).amount.toString());
  //     let userBeanBalance = parseInt((await this.bean.balanceOf(userAddress)).toString());
  //     expect((await this.field.plot(userAddress, 4000)).toString()).to.equal('1000');
  //     expect((await this.field.plot(user2Address, 4000)).toString()).to.equal('0');
  //     this.result = await this.marketplace.connect(user).sellToOrder('4000', '4000', podOrderIdx, '250');
  //     let userBeanBalanceAfterSellToOrder = parseInt((await this.bean.balanceOf(userAddress)).toString())
  //     expect(userBeanBalanceAfterSellToOrder - userBeanBalance).to.equal(200);
  //     expect((await this.field.plot(userAddress, 4000)).toString()).to.equal('0');
  //     expect((await this.field.plot(user2Address, 4000)).toString()).to.equal('250');
  //     expect((await this.field.plot(userAddress, 4250)).toString()).to.equal('750');
  //     const podOrderAmountAfter = parseInt((await this.marketplace.podOrder(podOrderIdx)).amount.toString());
  //     expect(podOrderAmountBefore - podOrderAmountAfter).to.equal(250);


  //   });

  //   it('Fails to sell plot, buy offer not large enough', async function () {
  //     result = await this.marketplace.connect(user2).listOrder('10000', '800000', '400');
  //     let podOrderIdx = await getOrderIndex(result);
  //     await this.field.connect(user).sowBeansAndIndex('1000');
  //     await expect(this.marketplace.connect(user).sellToOrder('6000', '6000', podOrderIdx, '1000')).to.be.revertedWith('SafeMath: subtraction overflow');
  //   });


  //   it('Fails to sell plot, unowned plot', async function () {
  //     result = await this.marketplace.connect(user2).listOrder('10000', '800000', '400');
  //     let podOrderIdx = await getOrderIndex(result);
  //     await this.field.connect(user2).sowBeansAndIndex('1000');
  //     await expect(this.marketplace.connect(user).sellToOrder('6000', '6000', podOrderIdx, '250')).to.be.revertedWith('Marketplace: Invaid Plot.');
  //   });

  //   it('Fails to list buy offer amount 0', async function () {
  //     await this.pair.simulateTrade('4000000', '10000');
  //     await expect(this.marketplace.connect(user2).listOrder('10000', '800000', '0')).to.be.revertedWith('Marketplace: Must offer to buy non-zero amount');
  //   });

  //   it('Fails to sell plot, nonexistent pod order', async function () {
  //     result = await this.marketplace.connect(user2).listOrder('10000', '800000', '400');
  //     await this.field.connect(user).sowBeansAndIndex('1000');
  //     let podOrderIdx = await getOrderIndex(result);
  //     result = await this.marketplace.connect(user2).cancelOrder(podOrderIdx);
  //     await expect(this.marketplace.connect(user).sellToOrder('6000', '6000', podOrderIdx, '250')).to.be.revertedWith('Marketplace: Buy Offer does not exist.');
  //   });

  //   it('Multiple partial fills, Offer Deletes', async function () {
  //     result = await this.marketplace.connect(user2).listOrder('8000', '500000', '1000');
  //     let podOrderIdx = await getOrderIndex(result);
  //     await this.field.connect(user).sowBeansAndIndex('1000');
  //     await this.field.connect(user).sowBeansAndIndex('400');
  //     await this.field.connect(user).sowBeansAndIndex('600');

  //     let userBeanBalance = parseInt((await this.bean.balanceOf(userAddress)).toString())
  //     await this.marketplace.connect(user).sellToOrder('6000', '6000', podOrderIdx, '1000');
  //     await this.marketplace.connect(user).sellToOrder('7000', '7000', podOrderIdx, '400');
  //     await this.marketplace.connect(user).sellToOrder('7400', '7400', podOrderIdx, '600');

  //     let userBeanBalanceAfterOrder = parseInt((await this.bean.balanceOf(userAddress)).toString());

  //     expect(userBeanBalanceAfterOrder - userBeanBalance).to.equal(1000);

  //     const podOrder = await this.marketplace.podOrder(podOrderIdx);
  //     expect(podOrder.amount.toString()).to.equal('0');
  //     expect(podOrder.price.toString()).to.equal('0');
  //     expect(podOrder.maxPlaceInLine.toString()).to.equal('0');
  //   });

  //   it('Buy Offer accepts plot only at correct place in line', async function () {
  //     result = await this.marketplace.connect(user2).listOrder('5000', '500000', '500');
  //     let podOrderIdx = await getOrderIndex(result);

  //     await this.field.connect(user).sowBeansAndIndex('1000');
  //     await expect(this.marketplace.connect(user).sellToOrder('6000', '6000', podOrderIdx, '1000')).to.be.revertedWith('Marketplace: Plot too far in line');
  //     await this.field.incrementTotalHarvestableE('2000');
  //     result = await this.marketplace.connect(user).sellToOrder('6000', '6000', podOrderIdx, '1000');
  //     expect(result).to.emit(this.marketplace, 'PodOrderFilled').withArgs(userAddress, user2Address, podOrderIdx, '6000', '1000', 500000);

  //     const podOrder = await this.marketplace.podOrder(podOrderIdx);
  //     expect(podOrder.amount.toString()).to.equal('0');
  //     expect(podOrder.price.toString()).to.equal('0');

  //   });

  //   it('Cancel Buy Offer, returns beans', async function () {
  //     result = await this.marketplace.connect(user2).listOrder('5000', '500000', '2000');
  //     let userBeanBalance = parseInt((await this.bean.balanceOf(user2Address)).toString())
  //     let podOrderIdx = await getOrderIndex(result);
  //     result = await this.marketplace.connect(user2).cancelOrder(podOrderIdx);
  //     let userBeanBalanceAfterOrder = parseInt((await this.bean.balanceOf(user2Address)).toString());
  //     expect(userBeanBalanceAfterOrder - userBeanBalance).to.equal(2000);
  //     expect(result).to.emit(this.marketplace, 'PodOrderCancelled').withArgs(user2Address, podOrderIdx);
  //   });



  //   it('Cancel Buy Offer fails unowned', async function () {
  //     result = await this.marketplace.connect(user2).listOrder('5000', '500000', '2000');
  //     let podOrderIdx = await getOrderIndex(result);
  //     await expect(this.marketplace.connect(user).cancelOrder(podOrderIdx)).to.be.revertedWith('Field: Buy Offer not owned by user.');
  //   });


  //   it('Sell To Buy Offer ends at unowned index', async function () {
  //     result = await this.marketplace.connect(user2).listOrder('10000', '500000', '2000');
  //     let podOrderIdx = await getOrderIndex(result);
  //     await this.field.connect(user).sowBeansAndIndex('1000');
  //     await expect(this.marketplace.connect(user).sellToOrder('6000', '6100', podOrderIdx, '1000')).to.be.revertedWith('Marketplace: Invaid Plot.');
  //   });

  //   it('Sell Buy Offer cancels podListing', async function () {
  //     result = await this.marketplace.connect(user2).listOrder('10000', '500000', '2000');
  //     await this.field.connect(user).sowBeansAndIndex('1000');
  //     await this.marketplace.connect(user).createPodListing('6000', '1000', '0', '50000', '5000');
  //     const podListing = await this.marketplace.podListing(6000, userAddress);
  //     expect(podListing.price.toString()).to.equal('50000');
  //     let podOrderIdx = await getOrderIndex(result);
  //     await (this.marketplace.connect(user).sellToOrder('6000', '6000', podOrderIdx, '1000'));
  //     const podListingDeleted = await this.marketplace.podListing(6000, userAddress);
  //     expect(podListingDeleted.price.toString()).to.equal('0');

  //   });

  //   it('Sell Buy Offer from end of index', async function () {
  //     result = await this.marketplace.connect(user2).listOrder('8000', '500000', '1000');
  //     await this.field.connect(user).sowBeansAndIndex('1000');
  //     let podOrderIdx = await getOrderIndex(result);
  //     let userBeanBalance = parseInt((await this.bean.balanceOf(userAddress)).toString())
  //     await this.marketplace.connect(user).sellToOrder('6000', '6100', podOrderIdx, '900');
  //     let userBeanBalanceAfterOrder = parseInt((await this.bean.balanceOf(userAddress)).toString());
  //     expect(userBeanBalanceAfterOrder - userBeanBalance).to.equal(450);
  //     expect((await this.field.plot(userAddress, 6000)).toString()).to.equal('100');
  //     expect((await this.field.plot(user2Address, 6100)).toString()).to.equal('900');
  //     const podOrder = await this.marketplace.podOrder(podOrderIdx);
  //     expect(podOrder.amount.toString()).to.equal('1100');

  //   });

  //   it('Sell Buy Offer from middle of index', async function () {
  //     result = await this.marketplace.connect(user2).listOrder('8000', '500000', '1000');
  //     await this.field.connect(user).sowBeansAndIndex('1000');
  //     let podOrderIdx = await getOrderIndex(result);
  //     let userBeanBalance = parseInt((await this.bean.balanceOf(userAddress)).toString())
  //     await this.marketplace.connect(user).sellToOrder('6000', '6100', podOrderIdx, '400');
  //     let userBeanBalanceAfterOrder = parseInt((await this.bean.balanceOf(userAddress)).toString());
  //     expect(userBeanBalanceAfterOrder - userBeanBalance).to.equal(200);
  //     expect((await this.field.plot(userAddress, 6000)).toString()).to.equal('100');
  //     expect((await this.field.plot(userAddress, 6500)).toString()).to.equal('500');
  //     expect((await this.field.plot(user2Address, 6100)).toString()).to.equal('400');
  //     const podOrder = await this.marketplace.podOrder(podOrderIdx);
  //     expect(podOrder.amount.toString()).to.equal('1600');
  //   });
  });

});
