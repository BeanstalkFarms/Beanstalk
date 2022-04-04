const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { expect, use } = require("chai");
const { waffleChai } = require("@ethereum-waffle/chai");
use(waffleChai);
const { deploy } = require('../scripts/deploy.js')
const { BigNumber } = require('bignumber.js')
const { print, printWeather } = require('./utils/print.js')
const { createInterpolant } = require('./utils/pchip.js')


const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000'
let user, user2, owner;
let userAddress, ownerAddress, user2Address;

describe('Marketplace', function () {
  let contracts
  before(async function () {
    contracts = await deploy("Test", false, true);
    [owner, user, user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    provider = ethers.getDefaultProvider();

    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond
    this.field = await ethers.getContractAt('MockFieldFacet', this.diamond.address);
    this.silo = await ethers.getContractAt('SiloFacet', this.diamond.address);
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address);
    this.marketplace = await ethers.getContractAt('MockMarketplaceFacet', this.diamond.address);
    this.claim = await ethers.getContractAt('ClaimFacet', this.diamond.address);
    this.bean = await ethers.getContractAt('MockToken', contracts.bean);
    this.pair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pair);

    await this.bean.mint(userAddress, '500000')
    await this.bean.mint(user2Address, '500000')
    await this.field.incrementTotalSoilEE('100000');
    this.orderIds = []
  })

  const resetState = async function () {
    this.diamond = contracts.beanstalkDiamond

    this.field = await ethers.getContractAt('MockFieldFacet', this.diamond.address);
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address);
    this.claim = await ethers.getContractAt('ClaimFacet', this.diamond.address);
    this.silo = await ethers.getContractAt('SiloFacet', this.diamond.address);
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

    await this.field.deletePlot(user2Address, 0);
    await this.field.incrementTotalSoilEE('100000');
    await this.field.connect(user).sowBeansAndIndex('1000');
    await this.field.connect(user2).sowBeansAndIndex('1000');
  }

  const getHash = async function (tx) {
    let receipt = await tx.wait();
    const args = (receipt.events?.filter((x) => { return x.event == "PodListingCreated" }))[0].args;
    return ethers.utils.solidityKeccak256(
      ['uint256', 'uint256', 'uint24', 'uint256', 'bool'],
      [args.start, args.amount, args.pricePerPod, args.maxHarvestableIndex, args.toWallet]
    );
  }

  const getDynamicHash = async function (tx) {
    let receipt = await tx.wait();
    const args = (receipt.events?.filter((x) => { return x.event == "DynamicPodListingCreated" }))[0].args;
    return ethers.utils.solidityKeccak256(
      ['uint256', 'uint256', 'uint256', 'bool', 'uint256[10]', 'uint256[40]', 'uint8[40]', 'bool[40]'],
      [args.start, args.amount, args.maxHarvestableIndex, args.toWallet, args.subIntervalIndex, args.constants, args.shifts, args.signs]
    );
  }

  const getHashFromListing = function (l) {
    return ethers.utils.solidityKeccak256(['uint256', 'uint256', 'uint24', 'uint256', 'bool'], l);
  }

  const getHashFromDynamicListing = function (l) {
    return ethers.utils.solidityKeccak256(['uint256', 'uint256', 'uint256', 'bool', 'uint256[10]', 'uint256[40]', 'uint8[40]', 'bool[40]'], l);
  }

  const getOrderId = async function (tx) {
    let receipt = await tx.wait();
    let idx = (receipt.events?.filter((x) => { return x.event == "PodOrderCreated" }))[0].args.id;
    return idx;
  }

  const getDynamicOrderId = async function (tx) {
    let receipt = await tx.wait();
    let idx = (receipt.events?.filter((x) => { return x.event == "DynamicPodOrderCreated" }))[0].args.id;
    return idx;
  }

  const linearSet = {
    xs:[0,500,1000,1500,2000,2500,3000, 3500, 4000, 4500],
    ys:[1000000,900000,800000,700000,600000,500000,400000,300000,200000,100000]
  }

  beforeEach(async function () {
    await resetState();
    await this.marketplace.deleteOrders(this.orderIds);
    this.orderIds = []
  })

  describe("Pod Listings", async function () {
    describe("Create", async function () {
      it('Fails to List Unowned Plot', async function () {
        await expect(this.marketplace.connect(user).createPodListing('5000', '0', '1000', '100000', '0', false)).to.be.revertedWith('Marketplace: Invalid Plot/Amount.');
      })
      
      it('Fails if already expired', async function () {
        await this.field.incrementTotalHarvestableE('2000');
        await expect(this.marketplace.connect(user).createPodListing('0', '0', '500', '100000', '0', false)).to.be.revertedWith('Marketplace: Expired.');
      })

      it('Fails if amount is 0', async function () {
        await expect(this.marketplace.connect(user2).createPodListing('1000', '0', '0', '100000', '0', false)).to.be.revertedWith('Marketplace: Invalid Plot/Amount.');
      })

      it('fails if price is 0', async function () {
        await expect(this.marketplace.connect(user2).createPodListing('1000', '0', '1000', '0', '0', false)).to.be.revertedWith('Marketplace: Pod price must be greater than 0.');
      })

      it('Fails if start + amount too large', async function () {
        await expect(this.marketplace.connect(user2).createPodListing('1000', '500', '1000', '100000', '0', false)).to.be.revertedWith('Marketplace: Invalid Plot/Amount.');
      })
    
      describe("List full plot", async function () {
        beforeEach(async function () {
          this.result = await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', true);
        })

        it('Lists Plot properly', async function () {
          expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(this.result));
        })

        it('Emits event', async function () {
          await expect(this.result).to.emit(this.marketplace, 'PodListingCreated').withArgs(userAddress, 0, 0, '1000', 500000, 0, true);
        })
      })

      describe("List partial plot", async function () {
        beforeEach(async function () {
          this.result = await this.marketplace.connect(user).createPodListing('0', '0', '500', '500000', '0', true);
        })

        it('Lists Plot properly', async function () {
          expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(this.result));
        })

        it('Emits event', async function () {
          await expect(this.result).to.emit(this.marketplace, 'PodListingCreated').withArgs(userAddress, 0, 0, '500', 500000, 0, true);
        })
      })

      describe("List partial plot from middle", async function () {
        beforeEach(async function () {
          this.result = await this.marketplace.connect(user).createPodListing('0', '500', '500', '500000', '2000', false);
        })

        it('Lists Plot properly', async function () {
          expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(this.result));
        })

        it('Emits event', async function () {
          await expect(this.result).to.emit(this.marketplace, 'PodListingCreated').withArgs(userAddress, 0, 500, '500', 500000, 2000, false);
        })
      })

      describe("Relist plot from middle", async function () {
        beforeEach(async function () {
          this.result = await this.marketplace.connect(user).createPodListing('0', '0', '500', '500000', '0', false);
          this.result = await this.marketplace.connect(user).createPodListing('0', '500', '100', '500000', '2000', false);
        })

        it('Lists Plot properly', async function () {
          expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(this.result));
        })

        it('Emits event', async function () {
          await expect(this.result).to.emit(this.marketplace, 'PodListingCancelled').withArgs(userAddress, 0);
          await expect(this.result).to.emit(this.marketplace, 'PodListingCreated').withArgs(userAddress, 0, 500, '100', 500000, 2000, false);
        })
      })

    })

    describe("Create Dynamic", async function () {
    
      it('Fails to List Unowned Dynamic Plot', async function () {
        let interp = createInterpolant(linearSet.xs, linearSet.ys);
        await expect(this.marketplace.connect(user).createDynamicPodListing('5000', '0', '1000', '0', false,[interp.subIntervalIndex.map(String), interp.constants.map(String), interp.shifts.map(String), interp.signs])).to.be.revertedWith('Marketplace: Invalid Plot/Amount.');
      })

      it('Fails if already expired - dynamic', async function () {
        await this.field.incrementTotalHarvestableE('2000');
        let interp = createInterpolant(linearSet.xs, linearSet.ys);
        await expect(this.marketplace.connect(user).createDynamicPodListing('0', '0', '500', '0', false, [interp.subIntervalIndex.map(String), interp.constants.map(String), interp.shifts.map(String), interp.signs])).to.be.revertedWith('Marketplace: Expired.');
      })

      it('Fails if amount is 0 - dynamic', async function () {
        let interp = createInterpolant(linearSet.xs, linearSet.ys);
        await expect(this.marketplace.connect(user2).createDynamicPodListing('1000', '0', '0', '0', false, [interp.subIntervalIndex.map(String), interp.constants.map(String), interp.shifts.map(String), interp.signs])).to.be.revertedWith('Marketplace: Invalid Plot/Amount.');
      })

      it('Fails if start + amount too large - dynamic', async function () {
        let interp = createInterpolant(linearSet.xs, linearSet.ys);
        await expect(this.marketplace.connect(user2).createDynamicPodListing('1000', '500', '1000', '0', false, [interp.subIntervalIndex.map(String), interp.constants.map(String), interp.shifts.map(String), interp.signs.map(String)])).to.be.revertedWith('Marketplace: Invalid Plot/Amount.');
      })

      describe("List full dynamic plot", async function () {
        beforeEach(async function () {
          let interp = createInterpolant(linearSet.xs, linearSet.ys);
          this.result = await this.marketplace.connect(user).createDynamicPodListing('0', '0', '1000','0', true, [linearSet.xs.map(String), interp.constants.map(String), interp.shifts.map(String), interp.signs]);
        })

        it('Lists Dynamic Plot properly', async function () {
          expect(await this.marketplace.podListing(0)).to.be.equal(await getDynamicHash(this.result));
        })

        it('Emits event', async function () {
          let interp = createInterpolant(linearSet.xs, linearSet.ys);
          await expect(this.result).to.emit(this.marketplace, 'DynamicPodListingCreated').withArgs(userAddress, 0, 0, '1000', 0, true, linearSet.xs.map(String), interp.constants.map(String), interp.shifts, interp.signs);
        })
      })

      describe("List partial dynamic plot", async function () {
        beforeEach(async function () {
          this.interp = createInterpolant(linearSet.xs, linearSet.ys);
          this.result = await this.marketplace.connect(user).createDynamicPodListing('0', '0', '500', '0', true, [linearSet.xs.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]);
        })

        it('Lists Plot properly', async function () {
          expect(await this.marketplace.podListing(0)).to.be.equal(await getDynamicHash(this.result));
        })

        it('Emits event', async function () {
          await expect(this.result).to.emit(this.marketplace, 'DynamicPodListingCreated').withArgs(userAddress, 0, 0, '500', 0, true, linearSet.xs.map(String), this.interp.constants.map(String), this.interp.shifts, this.interp.signs);
        })
      })
  

      describe("List partial dynamic plot from middle", async function () {
        beforeEach(async function () {
          this.interp = createInterpolant(linearSet.xs, linearSet.ys);
          this.result = await this.marketplace.connect(user).createDynamicPodListing('0', '500', '500', '2000', false, [linearSet.xs.map(String),this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]);
        })

        it('Lists Plot properly', async function () {
          expect(await this.marketplace.podListing(0)).to.be.equal(await getDynamicHash(this.result));
        })

        it('Emits event', async function () {
          // let interp = createInterpolant(linearSet.xs, linearSet.ys);
          await expect(this.result).to.emit(this.marketplace, 'DynamicPodListingCreated').withArgs(userAddress, 0, 500, '500', 2000, false, this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts, this.interp.signs);
        })
      })

      describe("Relist dynamic plot from middle", async function () {
        beforeEach(async function () {
          this.interp = createInterpolant(linearSet.xs, linearSet.ys);
          this.result = await this.marketplace.connect(user).createDynamicPodListing('0', '0', '500', '0', false, [linearSet.xs.map(String),this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]);
          this.result = await this.marketplace.connect(user).createDynamicPodListing('0', '500', '100', '2000', false, [linearSet.xs.map(String),this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]);
        })

        it('Lists Plot properly', async function () {
          expect(await this.marketplace.podListing(0)).to.be.equal(await getDynamicHash(this.result));
        })

        it('Emits event', async function () {
          await expect(this.result).to.emit(this.marketplace, 'PodListingCancelled').withArgs(userAddress, 0);
          await expect(this.result).to.emit(this.marketplace, 'DynamicPodListingCreated').withArgs(userAddress, 0, 500, '100', 2000, false, linearSet.xs.map(String), this.interp.constants.map(String), this.interp.shifts, this.interp.signs);
        })
      })
    })

    describe("Fill", async function () {
      describe('revert', async function () {

        beforeEach(async function () {
          this.result = await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', true);
          this.listing = [userAddress, '0', '0', '1000', 500000, '0', true];
        })

        it('Lists Plot properly', async function () {
          expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(this.result));
        })

        it('Fails to fill Listing, not enough ETH used', async function () {
          await this.pair.simulateTrade('4000', '1000');
          await expect(this.marketplace.connect(user2).buyBeansAndFillPodListing(this.listing, 0, 100, { value: '24' })).to.be.revertedWith('UniswapV2Router: EXCESSIVE_INPUT_AMOUNT');
        })

        it('Fill Listing non-listed Index Fails', async function () {
          let brokenListing = this.listing;
          brokenListing[1] = '1'
          await expect(this.marketplace.connect(user).fillPodListing(brokenListing, 500)).to.be.revertedWith('Marketplace: Listing does not exist.');
        })

        it('Fill Listing wrong start Index Fails', async function () {
          let brokenListing = this.listing;
          brokenListing[2] = '1'
          await expect(this.marketplace.connect(user).fillPodListing(brokenListing, 500)).to.be.revertedWith('Marketplace: Listing does not exist.');
        })

        it('Fill Listing wrong price Fails', async function () {
          let brokenListing = this.listing;
          brokenListing[4] = '100001'
          await expect(this.marketplace.connect(user).fillPodListing(brokenListing, 500)).to.be.revertedWith('Marketplace: Listing does not exist.');
        })

        it('Fill Listing after expired', async function () {
          await this.field.incrementTotalHarvestableE('2000');
          await expect(this.marketplace.connect(user2).fillPodListing(this.listing, 500)).to.be.revertedWith('Marketplace: Listing has expired.');
        })

        it('Fill Listing not enough pods in plot', async function () {
          await expect(this.marketplace.connect(user2).fillPodListing(this.listing, 501)).to.be.revertedWith('Marketplace: Not enough pods in Listing');
        })

        it('Fill Listing not enough pods in listing', async function () {
          const l = [userAddress, '0', '0', '500', '500000', '0', false]
          await this.marketplace.connect(user).createPodListing('0', '0', '500', '500000', '0', false);
          await expect(this.marketplace.connect(user2).fillPodListing(l, 500)).to.be.revertedWith('Marketplace: Not enough pods in Listing.');
        })
      })

      describe("Fill listing", async function () {
        beforeEach(async function () {
          this.listing = [userAddress, '0', '0', '1000', '500000', '0', true]
          await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', true);
          this.amountBeansBuyingWith = 500;

          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)

          this.result = await this.marketplace.connect(user2).fillPodListing(this.listing, this.amountBeansBuyingWith);

          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(this.amountBeansBuyingWith);
          expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(this.amountBeansBuyingWith);
          expect(await this.claim.wrappedBeans(userAddress)).to.equal(0);
        })

        it('Deletes Pod Listing', async function () {
          expect(await this.marketplace.podListing(0)).to.equal(ZERO_HASH);
        })

        it('transfer pod listing', async function () {
          expect((await this.field.plot(user2Address, 0)).toString()).to.equal('1000');
          expect((await this.field.plot(userAddress, 0)).toString()).to.equal('0');
        })

        it('emits event', async function () {
          await expect(this.result).to.emit(this.marketplace, 'PodListingFilled').withArgs(userAddress, user2Address, 0, 0, '1000');
        })
      })

      describe("Fill partial listing", async function () {
        beforeEach(async function () {
          this.listing = [userAddress, '0', '0', '1000', '500000', '0', true]
          await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', true);
          this.amountBeansBuyingWith = 250;

          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)

          this.result = await this.marketplace.connect(user2).fillPodListing(this.listing, this.amountBeansBuyingWith);

          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(this.amountBeansBuyingWith);
          expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(this.amountBeansBuyingWith);
          expect(await this.claim.wrappedBeans(userAddress)).to.equal(0);
        })

        it('Deletes Pod Listing', async function () {
          expect(await this.marketplace.podListing(0)).to.equal(ZERO_HASH);
          expect(await this.marketplace.podListing(500)).to.equal(getHashFromListing(['0', '500', this.listing[4], this.listing[5], this.listing[6]]));
        })

        it('transfer pod listing', async function () {
          expect((await this.field.plot(user2Address, 0)).toString()).to.equal('500');
          expect((await this.field.plot(userAddress, 0)).toString()).to.equal('0');
          expect((await this.field.plot(userAddress, 500)).toString()).to.equal('500');
        })

        it('emits event', async function () {
          await expect(this.result).to.emit(this.marketplace, 'PodListingFilled').withArgs(userAddress, user2Address, 0, 0, '500');
        })
      })

      describe("Fill partial listing of a partial listing multiple fills", async function () {
        beforeEach(async function () {
          this.listing = [userAddress, '0', '500', '500', '500000', '0', true]
          await this.marketplace.connect(user).createPodListing('0', '500', '500', '500000', '0', true);
          this.amountBeansBuyingWith = 100;

          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)

          this.result = await this.marketplace.connect(user2).fillPodListing(this.listing, this.amountBeansBuyingWith);

          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(this.amountBeansBuyingWith);
          expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(this.amountBeansBuyingWith);
          expect(await this.claim.wrappedBeans(userAddress)).to.equal(0);
        })

        it('Deletes Pod Listing', async function () {
          expect(await this.marketplace.podListing(0)).to.equal(ZERO_HASH);
          expect(await this.marketplace.podListing(700)).to.equal(getHashFromListing(['0', '300', this.listing[4], this.listing[5], this.listing[6]]));
        })

        it('transfer pod listing', async function () {
          expect((await this.field.plot(user2Address, 500)).toString()).to.equal('200');
          expect((await this.field.plot(userAddress, 0)).toString()).to.equal('500');
          expect((await this.field.plot(userAddress, 700)).toString()).to.equal('300');
        })

        it('emits event', async function () {
          await expect(this.result).to.emit(this.marketplace, 'PodListingFilled').withArgs(userAddress, user2Address, 0, 500, '200');
        })
      })

      describe("Fill partial listing of a listing created by partial fill", async function () {
        beforeEach(async function () {
          this.listing = [userAddress, '0', '500', '500', '500000', '0', true]
          await this.marketplace.connect(user).createPodListing('0', '500', '500', '500000', '0', true);
          this.amountBeansBuyingWith = 100;

          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)
          this.result = await this.marketplace.connect(user2).fillPodListing(this.listing, this.amountBeansBuyingWith);

          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          this.listing = [userAddress, '700', '0', '300', '500000', '0', true]

          this.result = await this.marketplace.connect(user2).fillPodListing(this.listing, 100);

        })
        it('plots correctly transfer', async function () {
          expect((await this.field.plot(userAddress, 0)).toString()).to.equal('500');
          expect((await this.field.plot(userAddress, 700)).toString()).to.equal('0');
          expect((await this.field.plot(userAddress, 900)).toString()).to.equal('100');

          expect((await this.field.plot(user2Address, 0)).toString()).to.equal('0');
          expect((await this.field.plot(user2Address, 500)).toString()).to.equal('200');
          expect((await this.field.plot(user2Address, 700)).toString()).to.equal('200');
          expect((await this.field.plot(user2Address, 900)).toString()).to.equal('0');
        })

        it('listing updates', async function () {
          expect(await this.marketplace.podListing(700)).to.equal(ZERO_HASH);
          expect(await this.marketplace.podListing(900)).to.equal(getHashFromListing(['0', '100', this.listing[4], this.listing[5], this.listing[6]]));
        })
      })

      describe("Fill partial listing to wallet", async function () {
        beforeEach(async function () {
          this.listing = [userAddress, '0', '0', '1000', '500000', '0', false]
          await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', false);
          this.amountBeansBuyingWith = 250;

          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)

          this.result = await this.marketplace.connect(user2).fillPodListing(this.listing, this.amountBeansBuyingWith);

          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(this.amountBeansBuyingWith);
          expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(0);
          expect(await this.claim.wrappedBeans(userAddress)).to.equal(this.amountBeansBuyingWith);
        })

        it('Deletes Pod Listing', async function () {
          expect(await this.marketplace.podListing(700)).to.equal(ZERO_HASH);
          expect(await this.marketplace.podListing(500)).to.equal(getHashFromListing(['0', '500', this.listing[4], this.listing[5], this.listing[6]]));
        })

        it('transfer pod listing', async function () {
          expect((await this.field.plot(user2Address, 0)).toString()).to.equal('500');
          expect((await this.field.plot(userAddress, 0)).toString()).to.equal('0');
          expect((await this.field.plot(userAddress, 500)).toString()).to.equal('500');
        })

        it('emits event', async function () {
          await expect(this.result).to.emit(this.marketplace, 'PodListingFilled').withArgs(userAddress, user2Address, 0, 0, '500');
        })
      })

      describe("Fill Beans to wallet", async function () {
        beforeEach(async function () {
          await this.pair.simulateTrade('2500', '1000');
          this.listing = [userAddress, '0', '0', '1000', '500000', '0', false]
          await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', false);
          this.amountTransferringBeans = 0;
          this.amoutBuyingBeans = 250;

          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)

          this.result = await this.marketplace.connect(user2).buyBeansAndFillPodListing(this.listing, this.amountTransferringBeans, this.amoutBuyingBeans, { value: 112 })

          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(0);
          expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(0);
          expect(await this.claim.wrappedBeans(userAddress)).to.equal(this.amoutBuyingBeans);
        })

        it('transfer pod listing', async function () {
          expect((await this.field.plot(user2Address, 0)).toString()).to.equal('500');
          expect((await this.field.plot(userAddress, 0)).toString()).to.equal('0');
          expect((await this.field.plot(userAddress, 500)).toString()).to.equal('500');
        })
      })

      describe("Fill Beans with amount to wallet", async function () {
        beforeEach(async function () {
          await this.pair.simulateTrade('2500', '1000');
          this.listing = [userAddress, '0', '0', '1000', '500000', '0', false]
          await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', false);
          this.amountTransferringBeans = 100;
          this.amoutBuyingBeans = 250;

          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)

          this.result = await this.marketplace.connect(user2).buyBeansAndFillPodListing(this.listing, this.amountTransferringBeans, this.amoutBuyingBeans, { value: 112 })

          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(this.amountTransferringBeans);
          expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(0);
          expect(await this.claim.wrappedBeans(userAddress)).to.equal(this.amoutBuyingBeans + this.amountTransferringBeans);
        })

        it('transfer pod listing', async function () {
          expect((await this.field.plot(user2Address, 0)).toString()).to.equal('700');
          expect((await this.field.plot(userAddress, 0)).toString()).to.equal('0');
          expect((await this.field.plot(userAddress, 700)).toString()).to.equal('300');
        })
      })

      describe("Claim", async function () {
        beforeEach(async function () {
          await this.silo.connect(user2).depositBeans('250')
          await this.silo.connect(user2).withdrawBeans([2], ['250'])
          await this.season.farmSunrises('25')
        })

        describe("Claim and fill listing", async function () {
          beforeEach(async function () {
            this.amountBeansBuyingWith = 100;
            this.listing = [userAddress, '0', '0', '1000', '500000', '0', true]
            await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', true);

            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.user2BeanBalance = await this.bean.balanceOf(user2Address)
            this.result = await this.marketplace.connect(user2).claimAndFillPodListing(this.listing, this.amountBeansBuyingWith, [['27'], [], [], false, false, 0, 0, false]);
            this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
            this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          })

          it('Transfer Beans properly', async function () {
            expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(0);
            expect(await this.claim.wrappedBeans(user2Address)).to.equal('150');
            expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(100);
            expect(await this.claim.wrappedBeans(userAddress)).to.equal('0');
          })
        })

        describe("Claim and fill listing overallocate", async function () {
          beforeEach(async function () {
            this.amountBeansBuyingWith = 300;
            this.listing = [userAddress, '0', '0', '1000', '500000', '0', true]
            await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', true);

            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.user2BeanBalance = await this.bean.balanceOf(user2Address)
            this.result = await this.marketplace.connect(user2).claimAndFillPodListing(this.listing, this.amountBeansBuyingWith, [['27'], [], [], false, false, 0, 0, false]);
            this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
            this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          })

          it('Transfer Beans properly', async function () {
            expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(50);
            expect(await this.claim.wrappedBeans(user2Address)).to.equal('0');
            expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(300);
            expect(await this.claim.wrappedBeans(userAddress)).to.equal('0');
          })
        })

        describe("Claim and buy listing to wrapped", async function () {
          beforeEach(async function () {
            this.amountBeansBuyingWith = 100;
            this.listing = [userAddress, '0', '0', '1000', '500000', '0', false]
            await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', false);

            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.user2BeanBalance = await this.bean.balanceOf(user2Address)
            this.result = await this.marketplace.connect(user2).claimAndFillPodListing(this.listing, this.amountBeansBuyingWith, [['27'], [], [], false, false, 0, 0, false]);
            this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
            this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          })

          it('Transfer Beans properly', async function () {
            expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(0);
            expect(await this.claim.wrappedBeans(user2Address)).to.equal('150');
            expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(0);
            expect(await this.claim.wrappedBeans(userAddress)).to.equal('100');
          })
        })

        describe("Claim, fill Beans with amount to wallet", async function () {
          beforeEach(async function () {
            await this.pair.simulateTrade('2500', '1000');
            this.listing = [userAddress, '0', '0', '1000', '500000', '0', true]
            await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', true);
            this.amountTransferringBeans = 100;
            this.amoutBuyingBeans = 250;

            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.user2BeanBalance = await this.bean.balanceOf(user2Address)

            this.result = await this.marketplace.connect(user2).claimBuyBeansAndFillPodListing(this.listing, this.amountTransferringBeans, this.amoutBuyingBeans, [['27'], [], [], false, false, 0, 0, false], { value: 112 })

            this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
            this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          })

          it('Transfer Beans properly', async function () {
            expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(0);
            expect(await this.claim.wrappedBeans(user2Address)).to.equal('150');
            expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(this.amoutBuyingBeans + this.amountTransferringBeans);
            expect(await this.claim.wrappedBeans(userAddress)).to.equal(0);
          })
        })
      })
    })

    describe("Fill Dynamic", async function () {

      describe('reverts', async function () {
        beforeEach(async function () {
          let interp = createInterpolant(linearSet.xs, linearSet.ys);
          this.result = await this.marketplace.connect(user).createDynamicPodListing('0', '0', '1000', '0', true, [interp.subIntervalIndex.map(String), interp.constants.map(String), interp.shifts.map(String), interp.signs]);
          this.listing = [userAddress, '0', '0', '1000', '0', true, [interp.subIntervalIndex.map(String), interp.constants.map(String), interp.shifts.map(String), interp.signs]];
        })
        it('Lists Plot properly', async function () {
          expect(await this.marketplace.podListing(0)).to.be.equal(await getDynamicHash(this.result));
        })
        it('Fails to fill Listing, not enough ETH used', async function () {
          await this.pair.simulateTrade('4000', '1000');
          await expect(this.marketplace.connect(user2).buyBeansAndFillDynamicPodListing(this.listing, 0, 100, { value: '24' })).to.be.revertedWith('UniswapV2Router: EXCESSIVE_INPUT_AMOUNT');
        })

        it('Fill Listing non-listed Index Fails', async function () {
          let brokenListing = this.listing;
          brokenListing[1] = '1'
          await expect(this.marketplace.connect(user).fillDynamicPodListing(brokenListing, 500)).to.be.revertedWith('Marketplace: Listing does not exist.');
        })

        it('Fill Listing wrong start Index Fails', async function () {
          let brokenListing = this.listing;
          brokenListing[2] = '1'
          await expect(this.marketplace.connect(user).fillDynamicPodListing(brokenListing, 500)).to.be.revertedWith('Marketplace: Listing does not exist.');
        })
        it('Fill Listing after expired', async function () {
          await this.field.incrementTotalHarvestableE('2000');
          await expect(this.marketplace.connect(user2).fillDynamicPodListing(this.listing, 500)).to.be.revertedWith('Marketplace: Listing has expired.');
        })

        it('Fill Listing not enough pods in plot', async function () {
          await expect(this.marketplace.connect(user2).fillDynamicPodListing(this.listing, 1001)).to.be.revertedWith('Marketplace: Not enough pods in Listing');
        })
      })

      describe("Fill dynamic listing", async function () {
        beforeEach(async function () {
          let xs = [ 0, 100, 200, 300, 400, 500, 600, 700, 800, 900 ];
          let ys = [ 1000000, 900000, 900000, 800000, 800000, 700000, 700000, 600000, 600000, 500000 ];
          this.interp = createInterpolant(xs, ys);
          // console.log(interp)
          this.listing = [userAddress, '0', '0', '1000', '0', true, [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]]
          await this.marketplace.connect(user).createDynamicPodListing('0', '0', '1000', '0', true, [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]);
          this.amountBeansBuyingWith = 500;

          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)

          this.result = await this.marketplace.connect(user2).fillDynamicPodListing(this.listing, this.amountBeansBuyingWith);

          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
        })
        
        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(this.amountBeansBuyingWith);
          expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(this.amountBeansBuyingWith);
          console.log(this.userBeanBalance, this.user2BeanBalance, this.userBeanBalanceAfter, this.user2BeanBalanceAfter)
          expect(await this.claim.wrappedBeans(userAddress)).to.equal(0);
        })

        it('Deletes Pod Listing', async function () {
          expect(await this.marketplace.podListing(0)).to.equal(ZERO_HASH);
        })

        it('transfer pod listing', async function () {
          expect((await this.field.plot(user2Address, 0)).toString()).to.equal('1000');
          expect((await this.field.plot(userAddress, 0)).toString()).to.equal('0');
        })

        it('emits event', async function () {
          await expect(this.result).to.emit(this.marketplace, 'PodListingFilled').withArgs(userAddress, user2Address, 0, 0, '1000');
        })
      })

      describe("Fill partial dynamic listing", async function () {
        beforeEach(async function () {
          let xs = [ 0, 100, 200, 300, 400, 500, 600, 700, 800, 900 ];
          let ys = [ 1000000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000 ];
          this.interp = createInterpolant(xs,ys);
          this.listing = [userAddress, '0', '0', '1000', '0', true, [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]];
          await this.marketplace.connect(user).createDynamicPodListing('0', '0', '1000', '0', true, [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]);
          this.amountBeansBuyingWith = 250;

          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)

          this.result = await this.marketplace.connect(user2).fillDynamicPodListing(this.listing, this.amountBeansBuyingWith);

          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(this.amountBeansBuyingWith);
          expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(this.amountBeansBuyingWith);
          expect(await this.claim.wrappedBeans(userAddress)).to.equal(0);
        })

        it('Deletes Pod Listing', async function () {
          expect(await this.marketplace.podListing(0)).to.equal(ZERO_HASH);
          expect(await this.marketplace.podListing(500)).to.equal(getHashFromDynamicListing(['0', '500', this.listing[4], this.listing[5], this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]));
        })

        it('transfer pod listing', async function () {
          expect((await this.field.plot(user2Address, 0)).toString()).to.equal('500');
          expect((await this.field.plot(userAddress, 0)).toString()).to.equal('0');
          expect((await this.field.plot(userAddress, 500)).toString()).to.equal('500');
        })

        it('emits event', async function () {
          await expect(this.result).to.emit(this.marketplace, 'PodListingFilled').withArgs(userAddress, user2Address, 0, 0, '500');
        })
      })

      describe("Fill partial dynamic listing of a partial dynamic listing multiple fills", async function () {
        beforeEach(async function () {
          let xs = [ 0, 100, 200, 300, 400, 500, 600, 700, 800, 900 ];
          let ys = [ 1000000, 900000, 900000, 800000, 800000, 700000, 700000, 600000, 600000, 500000 ];
          this.interp = createInterpolant(xs, ys);
          this.listing = [userAddress, '0', '500', '500', '0', true, [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]];
          // this.listing = [userAddress, '0', '500', '500', '500000', '0', true]
          await this.marketplace.connect(user).createDynamicPodListing('0', '500', '500', '0', true,[this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]);
          this.amountBeansBuyingWith = 100;

          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)

          this.result = await this.marketplace.connect(user2).fillDynamicPodListing(this.listing, this.amountBeansBuyingWith);

          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(this.amountBeansBuyingWith);
          expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(this.amountBeansBuyingWith);
          expect(await this.claim.wrappedBeans(userAddress)).to.equal(0);
        })

        it('Deletes Pod Listing', async function () {
          expect(await this.marketplace.podListing(0)).to.equal(ZERO_HASH);
          expect(await this.marketplace.podListing(700)).to.equal(getHashFromDynamicListing(['0', '300', this.listing[4], this.listing[5], this.listing[6][0], this.listing[6][1], this.listing[6][2], this.listing[6][3]]));
        })

        it('transfer pod listing', async function () {
          expect((await this.field.plot(user2Address, 500)).toString()).to.equal('200');
          expect((await this.field.plot(userAddress, 0)).toString()).to.equal('500');
          expect((await this.field.plot(userAddress, 700)).toString()).to.equal('300');
        })

        it('emits event', async function () {
          await expect(this.result).to.emit(this.marketplace, 'PodListingFilled').withArgs(userAddress, user2Address, 0, 500, '200');
        })
      })

      describe("Fill partial dynamic listing of a dynamic listing created by partial fill", async function () {
        beforeEach(async function () {
          let xs = [ 0, 100, 200, 300, 400, 500, 600, 700, 800, 900 ];
          let ys = [ 1000000, 900000, 900000, 800000, 800000, 700000, 700000, 600000, 600000, 500000 ];
          this.interp = createInterpolant(xs,ys);
          this.listing = [userAddress, '0', '500', '500', '0', true, [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]]
          // this.listing = [userAddress, '0', '500', '500', '500000', '0', true]
          await this.marketplace.connect(user).createDynamicPodListing('0', '500', '500', '0', true, [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]);
          this.amountBeansBuyingWith = 100;

          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)
          this.result = await this.marketplace.connect(user2).fillDynamicPodListing(this.listing, this.amountBeansBuyingWith);

          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          this.listing = [userAddress, '700', '0', '300', '0', true, [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]]

          this.result = await this.marketplace.connect(user2).fillDynamicPodListing(this.listing, 100);

        })
        it('plots correctly transfer', async function () {
          expect((await this.field.plot(userAddress, 0)).toString()).to.equal('500');
          expect((await this.field.plot(userAddress, 700)).toString()).to.equal('0');
          expect((await this.field.plot(userAddress, 900)).toString()).to.equal('100');

          expect((await this.field.plot(user2Address, 0)).toString()).to.equal('0');
          expect((await this.field.plot(user2Address, 500)).toString()).to.equal('200');
          expect((await this.field.plot(user2Address, 700)).toString()).to.equal('200');
          expect((await this.field.plot(user2Address, 900)).toString()).to.equal('0');
        })

        it('listing updates', async function () {
          expect(await this.marketplace.podListing(700)).to.equal(ZERO_HASH);
          expect(await this.marketplace.podListing(900)).to.equal(getHashFromDynamicListing(['0', '100', this.listing[4], this.listing[5], this.listing[6][0], this.listing[6][1], this.listing[6][2], this.listing[6][3]]));
        })
      })

      describe("Fill partial dynamic listing to wallet", async function () {
        beforeEach(async function () {
          let xs = [ 0, 100, 200, 300, 400, 500, 600, 700, 800, 900 ];
          let ys = [ 1000000, 850000, 700000, 600000, 550000, 500000, 500000, 500000, 500000, 500000 ];
          this.interp = createInterpolant(xs,ys);
          this.listing = [userAddress, '0', '0', '1000', '0', false, [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]]
          await this.marketplace.connect(user).createDynamicPodListing('0', '0', '1000', '0', false, [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]);
          this.amountBeansBuyingWith = 500;

          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)

          this.result = await this.marketplace.connect(user2).fillDynamicPodListing(this.listing, this.amountBeansBuyingWith);

          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          console.log(this.userBeanBalance,this.user2BeanBalance,this.userBeanBalanceAfter,this.user2BeanBalanceAfter)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(this.amountBeansBuyingWith);
          expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(0);
          expect(await this.claim.wrappedBeans(userAddress)).to.equal(this.amountBeansBuyingWith);
        })

        it('Deletes Pod Listing', async function () {
          expect(await this.marketplace.podListing(700)).to.equal(ZERO_HASH);
          expect(await this.marketplace.podListing(500)).to.equal(getHashFromDynamicListing(['0', '500', this.listing[4], this.listing[5], this.listing[6][0], this.listing[6][1], this.listing[6][2], this.listing[6][3]]));
        })

        it('transfer pod listing', async function () {
          expect((await this.field.plot(user2Address, 0)).toString()).to.equal('500');
          expect((await this.field.plot(userAddress, 0)).toString()).to.equal('0');
          expect((await this.field.plot(userAddress, 500)).toString()).to.equal('500');
        })

        it('emits event', async function () {
          await expect(this.result).to.emit(this.marketplace, 'PodListingFilled').withArgs(userAddress, user2Address, 0, 0, '500');
        })
      })

      describe("Fill Beans to wallet dynamic", async function () {
        beforeEach(async function () {
          let xs = [ 0, 100, 200, 300, 400, 500, 600, 700, 800, 900 ];
          let ys = [ 1000000, 900000, 900000, 800000, 800000, 700000, 700000, 600000, 600000, 500000 ];
          this.interp = createInterpolant(xs,ys);
          await this.pair.simulateTrade('2500', '1000');
          this.listing = [userAddress, '0', '0', '1000', '0', false, [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts, this.interp.signs]]
          await this.marketplace.connect(user).createDynamicPodListing('0', '0', '1000', '0', false, [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]);
          this.amountTransferringBeans = 0;
          this.amoutBuyingBeans = 250;

          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)

          this.result = await this.marketplace.connect(user2).buyBeansAndFillDynamicPodListing(this.listing, this.amountTransferringBeans, this.amoutBuyingBeans, { value: 112 })

          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(0);
          expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(0);
          expect(await this.claim.wrappedBeans(userAddress)).to.equal(this.amoutBuyingBeans);
        })

        it('transfer pod listing', async function () {
          expect((await this.field.plot(user2Address, 0)).toString()).to.equal('500');
          expect((await this.field.plot(userAddress, 0)).toString()).to.equal('0');
          expect((await this.field.plot(userAddress, 500)).toString()).to.equal('500');
        })
      })

      describe("Fill Beans with amount to wallet dynamic", async function () {
        beforeEach(async function () {
          let xs = [ 0, 100, 200, 300, 400, 500, 600, 700, 800, 900 ];
          let ys = [ 1000000, 900000, 900000, 800000, 800000, 700000, 700000, 600000, 600000, 500000 ];
          this.interp = createInterpolant(xs,ys);
          await this.pair.simulateTrade('2500', '1000');
          this.listing = [userAddress, '0', '0', '1000', '0', false, [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts, this.interp.signs]]
          await this.marketplace.connect(user).createDynamicPodListing('0', '0', '1000', '0', false,[this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts, this.interp.signs]);
          this.amountTransferringBeans = 100;
          this.amoutBuyingBeans = 250;

          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)

          this.result = await this.marketplace.connect(user2).buyBeansAndFillDynamicPodListing(this.listing, this.amountTransferringBeans, this.amoutBuyingBeans, { value: 112 })

          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(this.amountTransferringBeans);
          expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(0);
          expect(await this.claim.wrappedBeans(userAddress)).to.equal(this.amoutBuyingBeans + this.amountTransferringBeans);
        })

        it('transfer pod listing', async function () {
          expect((await this.field.plot(user2Address, 0)).toString()).to.equal('700');
          expect((await this.field.plot(userAddress, 0)).toString()).to.equal('0');
          expect((await this.field.plot(userAddress, 700)).toString()).to.equal('300');
        })
      })

      describe("Claim Dynamic", async function () {
        beforeEach(async function () {
          await this.silo.connect(user2).depositBeans('250')
          await this.silo.connect(user2).withdrawBeans([2], ['250'])
          await this.season.farmSunrises('25')
        })

        describe("Claim and fill dynamic listing", async function () {
          beforeEach(async function () {
            let xs = [ 0, 100, 200, 300, 400, 500, 600, 700, 800, 900 ];
            let ys = [ 1000000, 900000, 900000, 800000, 800000, 700000, 700000, 600000, 600000, 500000 ];
            this.interp = createInterpolant(xs,ys);
            this.amountBeansBuyingWith = 100;
            this.listing = [userAddress, '0', '0', '1000', '0', true,  [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts, this.interp.signs]]
            await this.marketplace.connect(user).createDynamicPodListing('0', '0', '1000', '0', true, [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]);

            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.user2BeanBalance = await this.bean.balanceOf(user2Address)
            this.result = await this.marketplace.connect(user2).claimAndFillDynamicPodListing(this.listing, this.amountBeansBuyingWith, [['27'], [], [], false, false, 0, 0, false]);
            this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
            this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          })

          it('Transfer Beans properly', async function () {
            expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(0);
            expect(await this.claim.wrappedBeans(user2Address)).to.equal('150');
            expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(100);
            expect(await this.claim.wrappedBeans(userAddress)).to.equal('0');
          })
        })

        describe("Claim and fill dynamic listing overallocate", async function () {
          beforeEach(async function () {
            let xs = [ 0, 100, 200, 300, 400, 500, 600, 700, 800, 900 ];
            let ys = [ 1000000, 900000, 900000, 800000, 800000, 700000, 700000, 600000, 600000, 500000 ];
            this.interp = createInterpolant(xs,ys);
            this.amountBeansBuyingWith = 300;
            this.listing = [userAddress, '0', '0', '1000', '0', true,  [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts, this.interp.signs]]
            await this.marketplace.connect(user).createDynamicPodListing('0', '0', '1000', '0', true,[this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]);

            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.user2BeanBalance = await this.bean.balanceOf(user2Address)
            this.result = await this.marketplace.connect(user2).claimAndFillDynamicPodListing(this.listing, this.amountBeansBuyingWith, [['27'], [], [], false, false, 0, 0, false]);
            this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
            this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          })

          it('Transfer Beans properly', async function () {
            expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(50);
            expect(await this.claim.wrappedBeans(user2Address)).to.equal('0');
            expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(300);
            expect(await this.claim.wrappedBeans(userAddress)).to.equal('0');
          })
        })

        describe("Claim and buy dynamic listing to wrapped", async function () {
          beforeEach(async function () {
            let xs = [ 0, 100, 200, 300, 400, 500, 600, 700, 800, 900 ];
            let ys = [ 1000000, 900000, 900000, 800000, 800000, 700000, 700000, 600000, 600000, 500000 ];
            this.interp = createInterpolant(xs,ys);
            this.amountBeansBuyingWith = 100;
            this.listing = [userAddress, '0', '0', '1000', '0', false,[this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts, this.interp.signs]]
            await this.marketplace.connect(user).createDynamicPodListing('0', '0', '1000', '0', false,[this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]);

            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.user2BeanBalance = await this.bean.balanceOf(user2Address)
            this.result = await this.marketplace.connect(user2).claimAndFillDynamicPodListing(this.listing, this.amountBeansBuyingWith, [['27'], [], [], false, false, 0, 0, false]);
            this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
            this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          })

          it('Transfer Beans properly', async function () {
            expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(0);
            expect(await this.claim.wrappedBeans(user2Address)).to.equal('150');
            expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(0);
            expect(await this.claim.wrappedBeans(userAddress)).to.equal('100');
          })
        })

        describe("Claim, fill Beans with amount to wallet", async function () {
          beforeEach(async function () {
            let xs = [ 0, 100, 200, 300, 400, 500, 600, 700, 800, 900 ];
            let ys = [ 1000000, 900000, 900000, 800000, 800000, 700000, 700000, 600000, 600000, 500000 ];
            this.interp = createInterpolant(xs,ys);
            await this.pair.simulateTrade('2500', '1000');
            this.listing = [userAddress, '0', '0', '1000', '0', true, [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts, this.interp.signs]]
            await this.marketplace.connect(user).createDynamicPodListing('0', '0', '1000', '0', true, [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]);
            this.amountTransferringBeans = 100;
            this.amoutBuyingBeans = 250;

            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.user2BeanBalance = await this.bean.balanceOf(user2Address)

            this.result = await this.marketplace.connect(user2).claimBuyBeansAndFillDynamicPodListing(this.listing, this.amountTransferringBeans, this.amoutBuyingBeans, [['27'], [], [], false, false, 0, 0, false], { value: 112 })

            this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
            this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          })

          it('Transfer Beans properly', async function () {
            expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(0);
            expect(await this.claim.wrappedBeans(user2Address)).to.equal('150');
            expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(this.amoutBuyingBeans + this.amountTransferringBeans);
            expect(await this.claim.wrappedBeans(userAddress)).to.equal(0);
          })
        })
      })
    })

    describe("Cancel", async function () {
      it('Re-list plot cancels and re-lists', async function () {
        let xs = [ 0, 100, 200, 300, 400, 500, 600, 700, 800, 900 ];
        let ys = [ 1000000, 900000, 900000, 800000, 800000, 700000, 700000, 600000, 600000, 500000 ];
        this.interp = createInterpolant(xs,ys);
        result = await this.marketplace.connect(user).createDynamicPodListing('0', '0', '1000', '0', true, [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]);
        expect(await this.marketplace.podListing(0)).to.be.equal(await getDynamicHash(result));
        result = await this.marketplace.connect(user).createDynamicPodListing('0', '0', '1000', '2000', false,[this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]);
        await expect(result).to.emit(this.marketplace, 'DynamicPodListingCreated').withArgs(userAddress, '0', '0', '1000', '2000', false, this.interp.subIntervalIndex, this.interp.constants,this.interp.shifts,this.interp.signs);
        await expect(result).to.emit(this.marketplace, 'PodListingCancelled').withArgs(userAddress, '0');
        expect(await this.marketplace.podListing(0)).to.be.equal(await getDynamicHash(result));
      })

      it('Reverts on Cancel Listing, not owned by user', async function () {
        let xs = [ 0, 100, 200, 300, 400, 500, 600, 700, 800, 900 ];
        let ys = [ 1000000, 900000, 900000, 800000, 800000, 700000, 700000, 600000, 600000, 500000 ];
        this.interp = createInterpolant(xs,ys);
        await this.marketplace.connect(user).createDynamicPodListing('0', '0', '1000', '0', true, [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]);
        await expect(this.marketplace.connect(user2).cancelPodListing('0')).to.be.revertedWith('Marketplace: Listing not owned by sender.');
      })

      it('Cancels Listing, Emits Listing Cancelled Event', async function () {
        let xs = [ 0, 100, 200, 300, 400, 500, 600, 700, 800, 900 ];
        let ys = [ 1000000, 900000, 900000, 800000, 800000, 700000, 700000, 600000, 600000, 500000 ];
        this.interp = createInterpolant(xs,ys);
        result = await this.marketplace.connect(user).createDynamicPodListing('0', '0', '1000', '2000', true,[this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]);
        expect(await this.marketplace.podListing(0)).to.be.equal(await getDynamicHash(result));
        result = (await this.marketplace.connect(user).cancelPodListing('0'));
        expect(await this.marketplace.podListing(0)).to.be.equal(ZERO_HASH);
        expect(result).to.emit(this.marketplace, 'PodListingCancelled').withArgs(userAddress, '0');
      })
    })
  })

  describe("Pod Offers", async function () {
    describe("Create", async function () {
      describe('revert', async function () {
        it('Reverts if price is 0', async function () {
          await expect(this.marketplace.connect(user2).createPodOrder('100', '0', '100000')).to.be.revertedWith("Marketplace: Pod price must be greater than 0.");
        })
        it('Reverts if amount is 0', async function () {
          await expect(this.marketplace.connect(user2).createPodOrder('0', '100000', '100000')).to.be.revertedWith("Marketplace: Order amount must be > 0.");
        })
      })

      describe('create order', async function () {
        beforeEach(async function () {
          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address)
          this.result = await this.marketplace.connect(user).createPodOrder('500', '100000', '1000')
          this.id = await getOrderId(this.result)
          this.orderIds.push(this.id)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
        })

        it('Transfer Beans properly', async function () {
          expect(this.beanstalkBeanBalanceAfter.sub(this.beanstalkBeanBalance)).to.equal('500');
          expect(this.userBeanBalance.sub(this.userBeanBalanceAfter)).to.equal('500');
        })

        it('Creates the order', async function () {
          expect(await this.marketplace.podOrderById(this.id)).to.equal('5000');
          expect(await this.marketplace.podOrder(userAddress, '100000', '1000')).to.equal('5000');
        })

        it('emits an event', async function () {
          expect(this.result).to.emit(this.marketplace, 'PodOrderCreated').withArgs(userAddress, this.id, '5000', 100000, '1000')
        })
      })

      describe('buy beans and create order', async function () {
        beforeEach(async function () {
          await this.pair.simulateTrade('2500', '1000');
          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address)
          this.result = await this.marketplace.connect(user).buyBeansAndCreatePodOrder('0', '250', '100000', '1000', { value: 112 })
          this.id = await getOrderId(this.result)
          this.orderIds.push(this.id)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
        })

        it('Transfer Beans properly', async function () {
          expect(this.beanstalkBeanBalanceAfter.sub(this.beanstalkBeanBalance)).to.equal('250');
          expect(this.userBeanBalance.sub(this.userBeanBalanceAfter)).to.equal('0');
        })

        it('Creates the offer', async function () {
          expect(await this.marketplace.podOrderById(this.id)).to.equal('2500');
          expect(await this.marketplace.podOrder(userAddress, '100000', '1000')).to.equal('2500');
        })

        it('emits an event', async function () {
          expect(this.result).to.emit(this.marketplace, 'PodOrderCreated').withArgs(userAddress, this.id, '2500', 100000, '1000')
        })
      })

      describe('buy and transfer beans and create order', async function () {
        beforeEach(async function () {
          await this.pair.simulateTrade('2500', '1000');
          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address)
          this.result = await this.marketplace.connect(user).buyBeansAndCreatePodOrder('100', '250', 100000, '1000', { value: 112 })
          this.id = await getOrderId(this.result)
          this.orderIds.push(this.id)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
        })

        it('Transfer Beans properly', async function () {
          expect(this.beanstalkBeanBalanceAfter.sub(this.beanstalkBeanBalance)).to.equal('350');
          expect(this.userBeanBalance.sub(this.userBeanBalanceAfter)).to.equal('100');
        })

        it('Creates the offer', async function () {
          expect(await this.marketplace.podOrderById(this.id)).to.equal('3500');
        })

        it('emits an event', async function () {
          expect(this.result).to.emit(this.marketplace, 'PodOrderCreated').withArgs(userAddress, this.id, '3500', 100000, '1000')
        })
      })

      describe("Claim", async function () {
        beforeEach(async function () {
          await this.silo.connect(user).depositBeans('250')
          await this.silo.connect(user).withdrawBeans([2], ['250'])
          await this.season.farmSunrises('25')
        })

        describe('normal order', async function () {
          beforeEach(async function () {
            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address)
            this.result = await this.marketplace.connect(user).claimAndCreatePodOrder('250', '100000', '1000', [['27'], [], [], false, false, 0, 0, false])
            this.id = await getOrderId(this.result)
            this.orderIds.push(this.id)
            this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
            this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
          })

          it('Transfer Beans properly', async function () {
            expect(this.beanstalkBeanBalanceAfter.sub(this.beanstalkBeanBalance)).to.equal('0');
            expect(this.userBeanBalance.sub(this.userBeanBalanceAfter)).to.equal('0');
            expect(await this.claim.wrappedBeans(userAddress)).to.equal('0');
          })

          it('Creates the offer', async function () {
            expect(await this.marketplace.podOrderById(this.id)).to.equal('2500');
          })
        })

        describe('normal order overallocate', async function () {
          beforeEach(async function () {
            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address)
            this.result = await this.marketplace.connect(user).claimAndCreatePodOrder('300', '100000', '1000', [['27'], [], [], false, false, 0, 0, false])
            this.id = await getOrderId(this.result)
            this.orderIds.push(this.id)
            this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
            this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
          })

          it('Transfer Beans properly', async function () {
            expect(this.beanstalkBeanBalanceAfter.sub(this.beanstalkBeanBalance)).to.equal('50');
            expect(this.userBeanBalance.sub(this.userBeanBalanceAfter)).to.equal('50');
            expect(await this.claim.wrappedBeans(userAddress)).to.equal('0');
          })

          it('Creates the offer', async function () {
            expect(await this.marketplace.podOrderById(this.id)).to.equal('3000');
          })
        })

        describe('normal under overallocate', async function () {
          beforeEach(async function () {
            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address)
            this.result = await this.marketplace.connect(user).claimAndCreatePodOrder('100', '100000', '1000', [['27'], [], [], false, false, 0, 0, false])
            this.id = await getOrderId(this.result)
            this.orderIds.push(this.id)
            this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
            this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
          })

          it('Transfer Beans properly', async function () {
            expect(this.beanstalkBeanBalanceAfter.sub(this.beanstalkBeanBalance)).to.equal('0');
            expect(this.userBeanBalance.sub(this.userBeanBalanceAfter)).to.equal('0');
            expect(await this.claim.wrappedBeans(userAddress)).to.equal('150');
          })

          it('Creates the offer', async function () {
            expect(await this.marketplace.podOrderById(this.id)).to.equal('1000');
          })
        })

        describe('buy and claim', async function () {
          beforeEach(async function () {
            await this.pair.simulateTrade('2500', '1000');
            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address)
            this.result = await this.marketplace.connect(user).claimBuyBeansAndCreatePodOrder('100', '250', '100000', '1000', [['27'], [], [], false, false, 0, 0, false], { value: 112 })
            this.id = await getOrderId(this.result)
            this.orderIds.push(this.id)
            this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
            this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
          })

          it('Transfer Beans properly', async function () {
            expect(this.beanstalkBeanBalanceAfter.sub(this.beanstalkBeanBalance)).to.equal('250');
            expect(this.userBeanBalance.sub(this.userBeanBalanceAfter)).to.equal('0');
            expect(await this.claim.wrappedBeans(userAddress)).to.equal('150');
          })

          it('Creates the offer', async function () {
            expect(await this.marketplace.podOrderById(this.id)).to.equal('3500');
          })
        })
      })
    })

    describe("Fill", async function () {
      beforeEach(async function () {
        this.order = [userAddress, '100000', '2500'];
        this.result = await this.marketplace.connect(user).createPodOrder('50', '100000', '2500')
        this.id = await getOrderId(this.result)
      })

      describe("revert", async function () {
        it("owner does not own plot", async function () {
          await expect(this.marketplace.fillPodOrder(this.order, 0, 0, 500, false)).to.revertedWith("Marketplace: Invalid Plot.");
        })

        it("plot amount too large", async function () {
          await expect(this.marketplace.connect(user2).fillPodOrder(this.order, 1000, 700, 500, false)).to.revertedWith("Marketplace: Invalid Plot.");
        })

        it("plot amount too large", async function () {
          await this.field.connect(user2).sowBeansAndIndex('1200');
          await expect(this.marketplace.connect(user2).fillPodOrder(this.order, 2000, 700, 500, false)).to.revertedWith("Marketplace: Plot too far in line.");
        })

        it("sell too much", async function () {
          await expect(this.marketplace.connect(user2).fillPodOrder(this.order, 1000, 0, 1000, false)).to.revertedWith("SafeMath: subtraction overflow");
        })
      })

      describe("Full order", async function () {
        beforeEach(async function () {
          this.beanstalkBalance = await this.bean.balanceOf(this.marketplace.address)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)
          this.result = await this.marketplace.connect(user2).fillPodOrder(this.order, 1000, 0, 500, true);
          this.beanstalkBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalanceAfter.sub(this.user2BeanBalance)).to.equal('50');
          expect(this.beanstalkBalance.sub(this.beanstalkBalanceAfter)).to.equal('50');
          expect(await this.claim.wrappedBeans(user2Address)).to.equal(0);
        })

        it('transfer the plot', async function () {
          expect(await this.field.plot(user2Address, 1000)).to.be.equal(0);
          expect(await this.field.plot(user2Address, 1500)).to.be.equal(500);
          expect(await this.field.plot(userAddress, 1000)).to.be.equal(500);
        })

        it('Updates the offer', async function () {
          expect(await this.marketplace.podOrderById(this.id)).to.equal('0');
        })

        it('Emits an event', async function () {
          expect(this.result).to.emit(this.marketplace, 'PodOrderFilled').withArgs(user2Address, userAddress, this.id, 1000, 0, 500);
        })
      })

      describe("Partial fill order", async function () {
        beforeEach(async function () {
          this.beanstalkBalance = await this.bean.balanceOf(this.marketplace.address)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)
          this.result = await this.marketplace.connect(user2).fillPodOrder(this.order, 1000, 250, 250, true);
          this.beanstalkBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalanceAfter.sub(this.user2BeanBalance)).to.equal('25');
          expect(this.beanstalkBalance.sub(this.beanstalkBalanceAfter)).to.equal('25');
          expect(await this.claim.wrappedBeans(user2Address)).to.equal(0);
        })

        it('transfer the plot', async function () {
          expect(await this.field.plot(user2Address, 1000)).to.be.equal(250);
          expect(await this.field.plot(user2Address, 1500)).to.be.equal(500);
          expect(await this.field.plot(userAddress, 1250)).to.be.equal(250);
        })

        it('Updates the offer', async function () {
          expect(await this.marketplace.podOrderById(this.id)).to.equal('250');
        })

        it('Emits an event', async function () {
          expect(this.result).to.emit(this.marketplace, 'PodOrderFilled').withArgs(user2Address, userAddress, this.id, 1000, 250, 250);
        })
      })

      describe("Full order to wallet", async function () {
        beforeEach(async function () {
          this.beanstalkBalance = await this.bean.balanceOf(this.marketplace.address)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)
          this.result = await this.marketplace.connect(user2).fillPodOrder(this.order, 1000, 0, 500, false);
          this.beanstalkBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalanceAfter.sub(this.user2BeanBalance)).to.equal(0);
          expect(this.beanstalkBalance.sub(this.beanstalkBalanceAfter)).to.equal(0);
          expect(await this.claim.wrappedBeans(user2Address)).to.equal('50');
        })

        it('transfer the plot', async function () {
          expect(await this.field.plot(user2Address, 1000)).to.be.equal(0);
          expect(await this.field.plot(user2Address, 1500)).to.be.equal(500);
          expect(await this.field.plot(userAddress, 1000)).to.be.equal(500);
        })

        it('Updates the offer', async function () {
          expect(await this.marketplace.podOrderById(this.id)).to.equal('0');
        })

        it('Emits an event', async function () {
          expect(this.result).to.emit(this.marketplace, 'PodOrderFilled').withArgs(user2Address, userAddress, this.id, 1000, 0, 500);
        })
      })

      describe("Full order with active listing", async function () {
        beforeEach(async function () {
          await this.marketplace.connect(user2).createPodListing('1000', '500', '500', '50000', '5000', false);
          this.beanstalkBalance = await this.bean.balanceOf(this.marketplace.address)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)
          this.result = await this.marketplace.connect(user2).fillPodOrder(this.order, 1000, 0, 500, false);
          this.beanstalkBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalanceAfter.sub(this.user2BeanBalance)).to.equal(0);
          expect(this.beanstalkBalance.sub(this.beanstalkBalanceAfter)).to.equal(0);
          expect(await this.claim.wrappedBeans(user2Address)).to.equal('50');
        })

        it('transfer the plot', async function () {
          expect(await this.field.plot(user2Address, 1000)).to.be.equal(0);
          expect(await this.field.plot(user2Address, 1500)).to.be.equal(500);
          expect(await this.field.plot(userAddress, 1000)).to.be.equal(500);
        })

        it('Updates the offer', async function () {
          expect(await this.marketplace.podOrderById(this.id)).to.equal('0');
        })

        it('deletes the listing', async function () {
          expect(await this.marketplace.podListing('1000')).to.equal(ZERO_HASH);
        })

        it('Emits an event', async function () {
          expect(this.result).to.emit(this.marketplace, 'PodListingCancelled').withArgs(user2Address, '1000');
          expect(this.result).to.emit(this.marketplace, 'PodOrderFilled').withArgs(user2Address, userAddress, this.id, 1000, 0, 500);
        })
      })
    })

    describe("Cancel", async function () {
      beforeEach(async function () {
        this.result = await this.marketplace.connect(user).createPodOrder('500', '100000', '1000')
        this.id = await getOrderId(this.result)
        this.orderIds.push(this.id)
      })

      describe('Cancel owner', async function () {
        beforeEach(async function () {
          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address)
          this.result = await this.marketplace.connect(user).cancelPodOrder('100000', '1000', true);
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
        })

        it('deletes the offer', async function () {
          expect(await this.marketplace.podOrderById(this.id)).to.equal('0');
        })

        it('transfer beans', async function () {
          expect(this.beanstalkBeanBalance.sub(this.beanstalkBeanBalanceAfter)).to.equal('500');
          expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal('500');
          expect(await this.claim.wrappedBeans(userAddress)).to.equal('0');
        })

        it('Emits an event', async function () {
          expect(this.result).to.emit(this.marketplace, 'PodOrderCancelled').withArgs(userAddress, this.id);
        })
      })

      describe('Cancel to wrapped', async function () {
        beforeEach(async function () {
          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address)
          this.result = await this.marketplace.connect(user).cancelPodOrder('100000', '1000', false);
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
        })

        it('deletes the offer', async function () {
          expect(await this.marketplace.podOrderById(this.id)).to.equal('0');
        })

        it('transfer beans', async function () {
          expect(this.beanstalkBeanBalance.sub(this.beanstalkBeanBalanceAfter)).to.equal('0');
          expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal('0');
          expect(await this.claim.wrappedBeans(userAddress)).to.equal('500');
        })

        it('Emits an event', async function () {
          expect(this.result).to.emit(this.marketplace, 'PodOrderCancelled').withArgs(userAddress, this.id);
        })
      })
    })
  })

  describe("Dynamic Pod Offers", async function () {

    describe("Create Dynamic", async function () {

      describe('revert', async function () {
        it('Reverts if price is 0', async function () {
          let xs = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900];
          let ys = [0, 0, 0, 0, 0,0,0,0,0,0];
          this.interp = createInterpolant(xs,ys); 
          console.log(this.interp)
          await expect(this.marketplace.connect(user2).createDynamicPodOrder('100', '100000', [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs])).to.be.revertedWith("Marketplace: Order amount must be > 0.");
        })
        it('Reverts if amount is 0', async function () {
          await expect(this.marketplace.connect(user2).createDynamicPodOrder('0', '100000', [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs])).to.be.revertedWith("Marketplace: Order amount must be > 0.");
        })
      })

      describe('create order', async function () {
        beforeEach(async function () {
          let xs = [ 0, 100, 200, 300, 400, 500, 600, 700, 800, 900 ];
          let ys = [ 1000000, 900000, 800000, 700000, 600000, 500000, 400000, 300000, 200000, 100000 ];
          this.interp = createInterpolant(xs,ys);
          this.userBeanBalance = await this.bean.balanceOf(userAddress);
          this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address);
          this.result = await this.marketplace.connect(user).createDynamicPodOrder('500', '1000', [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs] )
          this.id = await getDynamicOrderId(this.result);
          this.orderIds.push(this.id);
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress);
          this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address);
        })

        it('Transfer Beans properly', async function () {
          expect(this.beanstalkBeanBalanceAfter.sub(this.beanstalkBeanBalance)).to.equal('500');
          expect(this.userBeanBalance.sub(this.userBeanBalanceAfter)).to.equal('500');
        })

        it('Creates the order', async function () {
          expect(await this.marketplace.podOrderById(this.id)).to.equal('5000');
          expect(await this.marketplace.podOrder(userAddress, '100000', '1000')).to.equal('5000');
        })

        it('emits an event', async function () {
          expect(this.result).to.emit(this.marketplace, 'DynamicPodOrderCreated').withArgs(userAddress, this.id, '5000', '1000', this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts, this.interp.signs)
        })
      })

      describe('buy beans and create order', async function () {
        beforeEach(async function () {
          let xs = [ 0, 100, 200, 300, 400, 500, 600, 700, 800, 900 ];
          let ys = [ 1000000, 900000, 800000, 700000, 600000, 500000, 400000, 300000, 200000, 100000 ];
          this.interp = createInterpolant( xs , ys );
          await this.pair.simulateTrade('2500', '1000');
          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address)
          this.result = await this.marketplace.connect(user).buyBeansAndCreateDynamicPodOrder('0', '250', '1000', [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs], { value: 112 })
          this.id = await getDynamicOrderId(this.result);
          this.orderIds.push(this.id)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
        })

        it('Transfer Beans properly', async function () {
          expect(this.beanstalkBeanBalanceAfter.sub(this.beanstalkBeanBalance)).to.equal('250');
          expect(this.userBeanBalance.sub(this.userBeanBalanceAfter)).to.equal('0');
        })

        it('Creates the offer', async function () {
          expect(await this.marketplace.podOrderById(this.id)).to.equal('2500');
          expect(await this.marketplace.podOrder(userAddress, '100000', '1000')).to.equal('2500');
        })

        it('emits an event', async function () {
          expect(this.result).to.emit(this.marketplace, 'DynamicPodOrderCreated').withArgs(userAddress, this.id, '2500', '1000', this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts, this.interp.signs)
        })
      })

      describe('buy and transfer beans and create order', async function () {
        beforeEach(async function () {
          let xs = [ 0, 100, 200, 300, 400, 500, 600, 700, 800, 900 ];
          let ys = [ 1000000, 900000, 800000, 700000, 600000, 500000, 400000, 300000, 200000, 100000 ];
          this.interp = createInterpolant(xs,ys);
          await this.pair.simulateTrade('2500', '1000');
          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address)
          this.result = await this.marketplace.connect(user).buyBeansAndCreateDynamicPodOrder('100', '250', '1000', [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs], { value: 112 })
          this.id = await getDynamicOrderId(this.result)
          this.orderIds.push(this.id)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
        })

        it('Transfer Beans properly', async function () {
          expect(this.beanstalkBeanBalanceAfter.sub(this.beanstalkBeanBalance)).to.equal('350');
          expect(this.userBeanBalance.sub(this.userBeanBalanceAfter)).to.equal('100');
        })

        it('Creates the offer', async function () {
          expect(await this.marketplace.podOrderById(this.id)).to.equal('3500');
        })

        it('emits an event', async function () {
          expect(this.result).to.emit(this.marketplace, 'DynamicPodOrderCreated').withArgs(userAddress, this.id, '3500', '1000',this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts, this.interp.signs)
        })
      })

      describe("Claim Dynamic", async function () {
        beforeEach(async function () {
          await this.silo.connect(user).depositBeans('250')
          await this.silo.connect(user).withdrawBeans([2], ['250'])
          await this.season.farmSunrises('25')
        })

        describe('normal dynamic order', async function () {
          beforeEach(async function () {
            let xs = [ 0, 100, 200, 300, 400, 500, 600, 700, 800, 900 ];
            let ys = [ 1000000, 900000, 800000, 700000, 600000, 500000, 400000, 300000, 200000, 100000 ];
            this.interp = createInterpolant(xs,ys);
            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address)
            this.result = await this.marketplace.connect(user).claimAndCreateDynamicPodOrder('250', '1000', [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs], [['27'], [], [], false, false, 0, 0, false])
            this.id = await getDynamicOrderId(this.result)
            this.orderIds.push(this.id)
            this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
            this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
          })

          it('Transfer Beans properly', async function () {
            expect(this.beanstalkBeanBalanceAfter.sub(this.beanstalkBeanBalance)).to.equal('0');
            expect(this.userBeanBalance.sub(this.userBeanBalanceAfter)).to.equal('0');
            expect(await this.claim.wrappedBeans(userAddress)).to.equal('0');
          })

          it('Creates the offer', async function () {
            expect(await this.marketplace.podOrderById(this.id)).to.equal('2500');
          })
        })

        describe('normal dynamic order overallocate', async function () {
          beforeEach(async function () {
            let xs = [ 0, 100, 200, 300, 400, 500, 600, 700, 800, 900 ];
            let ys = [ 1000000, 900000, 800000, 700000, 600000, 500000, 400000, 300000, 200000, 100000 ];
            this.interp = createInterpolant(xs,ys);
            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address)
            this.result = await this.marketplace.connect(user).claimAndCreateDynamicPodOrder('300', '1000', [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs], [['27'], [], [], false, false, 0, 0, false])
            this.id = await getDynamicOrderId(this.result);
            this.orderIds.push(this.id);
            this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress);
            this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address);
          })

          it('Transfer Beans properly', async function () {
            expect(this.beanstalkBeanBalanceAfter.sub(this.beanstalkBeanBalance)).to.equal('50');
            expect(this.userBeanBalance.sub(this.userBeanBalanceAfter)).to.equal('50');
            expect(await this.claim.wrappedBeans(userAddress)).to.equal('0');
          })

          it('Creates the offer', async function () {
            expect(await this.marketplace.podOrderById(this.id)).to.equal('3000');
          })
        })

        describe('normal under overallocate', async function () {
          beforeEach(async function () {
            let xs = [ 0, 100, 200, 300, 400, 500, 600, 700, 800, 900 ];
            let ys = [ 1000000, 900000, 800000, 700000, 600000, 500000, 400000, 300000, 200000, 100000 ];
            this.interp = createInterpolant(xs,ys);
            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address)
            this.result = await this.marketplace.connect(user).claimAndCreateDynamicPodOrder('100', '1000', [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs], [['27'], [], [], false, false, 0, 0, false])
            this.id = await getDynamicOrderId(this.result)
            this.orderIds.push(this.id)
            this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
            this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
          })

          it('Transfer Beans properly', async function () {
            expect(this.beanstalkBeanBalanceAfter.sub(this.beanstalkBeanBalance)).to.equal('0');
            expect(this.userBeanBalance.sub(this.userBeanBalanceAfter)).to.equal('0');
            expect(await this.claim.wrappedBeans(userAddress)).to.equal('150');
          })

          it('Creates the offer', async function () {
            expect(await this.marketplace.podOrderById(this.id)).to.equal('1000');
          })
        })

        describe('buy and claim', async function () {

          beforeEach(async function () {

            let xs = [ 0, 100, 200, 300, 400, 500, 600, 700, 800, 900 ];
            let ys = [ 1000000, 900000, 800000, 700000, 600000, 500000, 400000, 300000, 200000, 100000 ];

            this.interp = createInterpolant(xs,ys);

            await this.pair.simulateTrade('2500', '1000');
            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address)
            this.result = await this.marketplace.connect(user).claimBuyBeansAndCreateDynamicPodOrder('100', '250','1000', [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs], [['27'], [], [], false, false, 0, 0, false], { value: 112 })
            this.id = await getDynamicOrderId(this.result);
            this.orderIds.push(this.id);
            this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress);
            this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address);

          })

          it('Transfer Beans properly', async function () {
            expect(this.beanstalkBeanBalanceAfter.sub(this.beanstalkBeanBalance)).to.equal('250');
            expect(this.userBeanBalance.sub(this.userBeanBalanceAfter)).to.equal('0');
            expect(await this.claim.wrappedBeans(userAddress)).to.equal('150');
          })

          it('Creates the offer', async function () {
            expect(await this.marketplace.podOrderById(this.id)).to.equal('3500');
          })
        })
      })
    })

    describe("Dynamic Fill", async function () {
      beforeEach(async function () {
        let xs = [ 0, 100, 200, 300, 400, 500, 600, 700, 800, 900 ];
        let ys = [ 1000000, 900000, 800000, 700000, 600000, 500000, 400000, 300000, 200000, 100000 ];
        this.interp = createInterpolant(xs,ys);
        this.order = [userAddress, '2500', [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]];
        this.result = await this.marketplace.connect(user).createDynamicPodOrder('50', '2500',[this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs])
        this.id = await getDynamicOrderId(this.result)
      })

      describe("revert", async function () {
        it("owner does not own plot", async function () {
          await expect(this.marketplace.fillDynamicPodOrder(this.order, 0, 0, 500, false)).to.revertedWith("Marketplace: Invalid Plot.");
        })

        it("plot amount too large", async function () {
          await expect(this.marketplace.connect(user2).fillDynamicPodOrder(this.order, 1000, 700, 500, false)).to.revertedWith("Marketplace: Invalid Plot.");
        })

        it("plot amount too large", async function () {
          await this.field.connect(user2).sowBeansAndIndex('1200');
          await expect(this.marketplace.connect(user2).fillDynamicPodOrder(this.order, 2000, 700, 500, false)).to.revertedWith("Marketplace: Plot too far in line.");
        })

        it("sell too much", async function () {
          await expect(this.marketplace.connect(user2).fillDynamicPodOrder(this.order, 1000, 0, 1000, false)).to.revertedWith("SafeMath: subtraction overflow");
        })
      })

      describe("Full dynamic order", async function () {
        beforeEach(async function () {
          this.beanstalkBalance = await this.bean.balanceOf(this.marketplace.address)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)
          this.result = await this.marketplace.connect(user2).fillDynamicPodOrder(this.order, 1000, 0, 500, true);
          this.beanstalkBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalanceAfter.sub(this.user2BeanBalance)).to.equal('50');
          expect(this.beanstalkBalance.sub(this.beanstalkBalanceAfter)).to.equal('50');
          expect(await this.claim.wrappedBeans(user2Address)).to.equal(0);
        })

        it('transfer the plot', async function () {
          expect(await this.field.plot(user2Address, 1000)).to.be.equal(0);
          expect(await this.field.plot(user2Address, 1500)).to.be.equal(500);
          expect(await this.field.plot(userAddress, 1000)).to.be.equal(500);
        })

        it('Updates the offer', async function () {
          expect(await this.marketplace.podOrderById(this.id)).to.equal('0');
        })

        it('Emits an event', async function () {
          expect(this.result).to.emit(this.marketplace, 'PodOrderFilled').withArgs(user2Address, userAddress, this.id, 1000, 0, 500);
        })
      })

      describe("Partial fill dynamic order", async function () {

        beforeEach(async function () {
          this.beanstalkBalance = await this.bean.balanceOf(this.marketplace.address)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)
          this.result = await this.marketplace.connect(user2).fillDynamicPodOrder(this.order, 1000, 250, 250, true);
          this.beanstalkBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalanceAfter.sub(this.user2BeanBalance)).to.equal('25');
          expect(this.beanstalkBalance.sub(this.beanstalkBalanceAfter)).to.equal('25');
          expect(await this.claim.wrappedBeans(user2Address)).to.equal(0);
        })

        it('transfer the plot', async function () {
          expect(await this.field.plot(user2Address, 1000)).to.be.equal(250);
          expect(await this.field.plot(user2Address, 1500)).to.be.equal(500);
          expect(await this.field.plot(userAddress, 1250)).to.be.equal(250);
        })

        it('Updates the offer', async function () {
          expect(await this.marketplace.podOrderById(this.id)).to.equal('250');
        })

        it('Emits an event', async function () {
          expect(this.result).to.emit(this.marketplace, 'PodOrderFilled').withArgs(user2Address, userAddress, this.id, 1000, 250, 250);
        })
      
      })

      describe("Full partial order to wallet", async function () {

        beforeEach(async function () {
          this.beanstalkBalance = await this.bean.balanceOf(this.marketplace.address)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)
          this.result = await this.marketplace.connect(user2).fillDynamicPodOrder(this.order, 1000, 0, 500, false);
          this.beanstalkBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalanceAfter.sub(this.user2BeanBalance)).to.equal(0);
          expect(this.beanstalkBalance.sub(this.beanstalkBalanceAfter)).to.equal(0);
          expect(await this.claim.wrappedBeans(user2Address)).to.equal('50');
        })

        it('transfer the plot', async function () {
          expect(await this.field.plot(user2Address, 1000)).to.be.equal(0);
          expect(await this.field.plot(user2Address, 1500)).to.be.equal(500);
          expect(await this.field.plot(userAddress, 1000)).to.be.equal(500);
        })

        it('Updates the offer', async function () {
          expect(await this.marketplace.podOrderById(this.id)).to.equal('0');
        })

        it('Emits an event', async function () {
          expect(this.result).to.emit(this.marketplace, 'PodOrderFilled').withArgs(user2Address, userAddress, this.id, 1000, 0, 500);
        })
      })

      describe("Full dynamic order with active dynamic listing", async function () {
        beforeEach(async function () {
          let xs = [ 0, 100, 200, 300, 400, 500, 600, 700, 800, 900 ];
          let ys = [ 1000000, 900000, 800000, 700000, 600000, 450000, 300000, 200000, 100000, 50000 ];
          this.interp = createInterpolant(xs,ys);
          await this.marketplace.connect(user2).createDynamicPodListing('1000', '500', '500', '5000', false, [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]);
          this.beanstalkBalance = await this.bean.balanceOf(this.marketplace.address);
          this.user2BeanBalance = await this.bean.balanceOf(user2Address);
          this.result = await this.marketplace.connect(user2).fillDynamicPodOrder(this.order, 1000, 0, 500, false);
          this.beanstalkBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalanceAfter.sub(this.user2BeanBalance)).to.equal(0);
          expect(this.beanstalkBalance.sub(this.beanstalkBalanceAfter)).to.equal(0);
          expect(await this.claim.wrappedBeans(user2Address)).to.equal('50');
        })

        it('transfer the plot', async function () {
          expect(await this.field.plot(user2Address, 1000)).to.be.equal(0);
          expect(await this.field.plot(user2Address, 1500)).to.be.equal(500);
          expect(await this.field.plot(userAddress, 1000)).to.be.equal(500);
        })

        it('Updates the offer', async function () {
          expect(await this.marketplace.podOrderById(this.id)).to.equal('0');
        })

        it('deletes the listing', async function () {
          expect(await this.marketplace.podListing('1000')).to.equal(ZERO_HASH);
        })

        it('Emits an event', async function () {
          expect(this.result).to.emit(this.marketplace, 'PodListingCancelled').withArgs(user2Address, '1000');
          expect(this.result).to.emit(this.marketplace, 'PodOrderFilled').withArgs(user2Address, userAddress, this.id, 1000, 0, 500);
        })
      })
    })

    describe("Cancel dynamic", async function () {
      beforeEach(async function () {
        let xs = [ 0, 100, 200, 300, 400, 500, 600, 700, 800, 900 ];
        let ys = [ 1000000, 900000, 800000, 700000, 600000, 500000, 400000, 300000, 200000, 100000 ];
        this.interp = createInterpolant(xs,ys);
        this.result = await this.marketplace.connect(user).createDynamicPodOrder('500', '1000', [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs])
        this.id = await getDynamicOrderId(this.result)
        this.orderIds.push(this.id)
      })

      describe('Cancel owner', async function () {
        beforeEach(async function () {
          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address)
          this.result = await this.marketplace.connect(user).cancelDynamicPodOrder('1000', true, [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]);
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
        })

        it('deletes the offer', async function () {
          expect(await this.marketplace.podOrderById(this.id)).to.equal('0');
        })

        it('transfer beans', async function () {
          expect(this.beanstalkBeanBalance.sub(this.beanstalkBeanBalanceAfter)).to.equal('500');
          expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal('500');
          expect(await this.claim.wrappedBeans(userAddress)).to.equal('0');
        })

        it('Emits an event', async function () {
          expect(this.result).to.emit(this.marketplace, 'PodOrderCancelled').withArgs(userAddress, this.id);
        })
      })

      describe('Cancel to wrapped', async function () {
        beforeEach(async function () {
          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address)
          this.result = await this.marketplace.connect(user).cancelDynamicPodOrder('1000', false, [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts.map(String), this.interp.signs]);
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
        })

        it('deletes the offer', async function () {
          expect(await this.marketplace.podOrderById(this.id)).to.equal('0');
        })

        it('transfer beans', async function () {
          expect(this.beanstalkBeanBalance.sub(this.beanstalkBeanBalanceAfter)).to.equal('0');
          expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal('0');
          expect(await this.claim.wrappedBeans(userAddress)).to.equal('500');
        })

        it('Emits an event', async function () {
          expect(this.result).to.emit(this.marketplace, 'PodOrderCancelled').withArgs(userAddress, this.id);
        })
      })
    })
  })


})