const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { expect, use } = require("chai");
const { waffleChai } = require("@ethereum-waffle/chai");
use(waffleChai);
const { deploy } = require('../scripts/deploy.js')
const { BEAN } = require('./utils/constants')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");


const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000'
let user, user2, owner;
let userAddress, ownerAddress, user2Address;
let snapshotId;

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
    this.marketplace = await ethers.getContractAt('MockMarketplaceFacet', this.diamond.address);
    this.token = await ethers.getContractAt('TokenFacet', this.diamond.address);
    this.bean = await ethers.getContractAt('MockToken', BEAN);

    await this.bean.mint(userAddress, '500000')
    await this.bean.mint(user2Address, '500000')

    await this.season.siloSunrise(0)

    await this.bean.connect(user).approve(this.field.address, '100000000000')
    await this.bean.connect(user2).approve(this.field.address, '100000000000')

    await this.field.incrementTotalSoilE('100000');
    await this.season.setYieldE('0');
    await this.field.connect(user).sow('1000', EXTERNAL);
    await this.field.connect(user2).sow('1000', EXTERNAL);
  })

  const getHash = async function (tx) {
    let receipt = await tx.wait();
    const args = (receipt.events?.filter((x) => { return x.event == "PodListingCreated" }))[0].args;
    return ethers.utils.solidityKeccak256(
      ['uint256', 'uint256', 'uint24', 'uint256', 'bool'],
      [args.start, args.amount, args.pricePerPod, args.maxHarvestableIndex, args.mode == EXTERNAL]
    );
  }

  const getHashFromListing = function (l) {
    l[4] = l[4] == EXTERNAL
    return ethers.utils.solidityKeccak256(['uint256', 'uint256', 'uint24', 'uint256', 'bool'], l);
  }

  const getOrderId = async function (tx) {
    let receipt = await tx.wait();
    let idx = (receipt.events?.filter((x) => { return x.event == "PodOrderCreated" }))[0].args.id;
    return idx;
  }

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("Pod Listings", async function () {
    describe("Create", async function () {
      it('Fails to List Unowned Plot', async function () {
        await expect(this.marketplace.connect(user).createPodListing('5000', '0', '1000', '100000', '0', INTERNAL)).to.be.revertedWith('Marketplace: Invalid Plot/Amount.');
      })

      it('Fails if already expired', async function () {
        await this.field.incrementTotalHarvestableE('2000');
        await expect(this.marketplace.connect(user).createPodListing('0', '0', '500', '100000', '0', INTERNAL)).to.be.revertedWith('Marketplace: Expired.');
      })

      it('Fails if amount is 0', async function () {
        await expect(this.marketplace.connect(user2).createPodListing('1000', '0', '0', '100000', '0', INTERNAL)).to.be.revertedWith('Marketplace: Invalid Plot/Amount.');
      })

      it('fails if price is 0', async function () {
        await expect(this.marketplace.connect(user2).createPodListing('1000', '0', '1000', '0', '0', INTERNAL)).to.be.revertedWith('Marketplace: Pod price must be greater than 0.');
      })

      it('Fails if start + amount too large', async function () {
        await expect(this.marketplace.connect(user2).createPodListing('1000', '500', '1000', '100000', '0', INTERNAL)).to.be.revertedWith('Marketplace: Invalid Plot/Amount.');
      })

      describe("List full plot", async function () {
        beforeEach(async function () {
          this.result = await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', EXTERNAL);
        })

        it('Lists Plot properly', async function () {
          expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(this.result));
        })

        it('Emits event', async function () {
          await expect(this.result).to.emit(this.marketplace, 'PodListingCreated').withArgs(userAddress, 0, 0, '1000', 500000, 0, 0);
        })
      })

      describe("List partial plot", async function () {
        beforeEach(async function () {
          this.result = await this.marketplace.connect(user).createPodListing('0', '0', '500', '500000', '0', EXTERNAL);
        })

        it('Lists Plot properly', async function () {
          expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(this.result));
        })

        it('Emits event', async function () {
          await expect(this.result).to.emit(this.marketplace, 'PodListingCreated').withArgs(userAddress, 0, 0, '500', 500000, 0, 0);
        })
      })

      describe("List partial plot from middle", async function () {
        beforeEach(async function () {
          this.result = await this.marketplace.connect(user).createPodListing('0', '500', '500', '500000', '2000', INTERNAL);
        })

        it('Lists Plot properly', async function () {
          expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(this.result));
        })

        it('Emits event', async function () {
          await expect(this.result).to.emit(this.marketplace, 'PodListingCreated').withArgs(userAddress, 0, 500, '500', 500000, 2000, 1);
        })
      })

      describe("Relist plot from middle", async function () {
        beforeEach(async function () {
          this.result = await this.marketplace.connect(user).createPodListing('0', '0', '500', '500000', '0', INTERNAL);
          this.result = await this.marketplace.connect(user).createPodListing('0', '500', '100', '500000', '2000', INTERNAL);
        })

        it('Lists Plot properly', async function () {
          expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(this.result));
        })

        it('Emits event', async function () {
          await expect(this.result).to.emit(this.marketplace, 'PodListingCancelled').withArgs(userAddress, 0);
          await expect(this.result).to.emit(this.marketplace, 'PodListingCreated').withArgs(userAddress, 0, 500, '100', 500000, 2000, 1);
        })
      })
    })

    describe("Fill", async function () {

      describe('revert', async function () {
        beforeEach(async function () {
          await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', EXTERNAL);
          this.listing = [userAddress, '0', '0', '1000', 500000, '0', EXTERNAL];
        })

        it('Fill Listing non-listed Index Fails', async function () {
          let brokenListing = this.listing;
          brokenListing[1] = '1'
          await expect(this.marketplace.connect(user).fillPodListing(brokenListing, 500, EXTERNAL)).to.be.revertedWith('Marketplace: Listing does not exist.');
        })

        it('Fill Listing wrong start Index Fails', async function () {
          let brokenListing = this.listing;
          brokenListing[2] = '1'
          await expect(this.marketplace.connect(user).fillPodListing(brokenListing, 500, EXTERNAL)).to.be.revertedWith('Marketplace: Listing does not exist.');
        })

        it('Fill Listing wrong price Fails', async function () {
          let brokenListing = this.listing;
          brokenListing[4] = '100001'
          await expect(this.marketplace.connect(user).fillPodListing(brokenListing, 500, EXTERNAL)).to.be.revertedWith('Marketplace: Listing does not exist.');
        })

        it('Fill Listing after expired', async function () {
          await this.field.incrementTotalHarvestableE('2000');
          await expect(this.marketplace.connect(user2).fillPodListing(this.listing, 500, EXTERNAL)).to.be.revertedWith('Marketplace: Listing has expired.');
        })

        it('Fill Listing not enough pods in plot', async function () {
          await expect(this.marketplace.connect(user2).fillPodListing(this.listing, 501, EXTERNAL)).to.be.revertedWith('Marketplace: Not enough pods in Listing');
        })

        it('Fill Listing not enough pods in listing', async function () {
          const l = [userAddress, '0', '0', '500', '500000', '0', INTERNAL]
          await this.marketplace.connect(user).createPodListing('0', '0', '500', '500000', '0', INTERNAL);
          await expect(this.marketplace.connect(user2).fillPodListing(l, 500, EXTERNAL)).to.be.revertedWith('Marketplace: Not enough pods in Listing.');
        })
      })

      describe("Fill listing", async function () {
        beforeEach(async function () {
          this.listing = [userAddress, '0', '0', '1000', '500000', '0', EXTERNAL]
          await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', EXTERNAL);
          this.amountBeansBuyingWith = 500;

          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)

          this.result = await this.marketplace.connect(user2).fillPodListing(this.listing, this.amountBeansBuyingWith, EXTERNAL);

          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(this.amountBeansBuyingWith);
          expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(this.amountBeansBuyingWith);
          expect(await this.token.getInternalBalance(user.address, this.bean.address)).to.equal(0);
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
          this.listing = [userAddress, '0', '0', '1000', '500000', '0', EXTERNAL]
          await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', EXTERNAL);
          this.amountBeansBuyingWith = 250;

          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)

          this.result = await this.marketplace.connect(user2).fillPodListing(this.listing, this.amountBeansBuyingWith, EXTERNAL);

          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(this.amountBeansBuyingWith);
          expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(this.amountBeansBuyingWith);
          expect(await this.token.getInternalBalance(user.address, this.bean.address)).to.equal(0);
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
          this.listing = [userAddress, '0', '500', '500', '500000', '0', EXTERNAL]
          await this.marketplace.connect(user).createPodListing('0', '500', '500', '500000', '0', EXTERNAL);
          this.amountBeansBuyingWith = 100;

          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)

          this.result = await this.marketplace.connect(user2).fillPodListing(this.listing, this.amountBeansBuyingWith, EXTERNAL);

          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(this.amountBeansBuyingWith);
          expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(this.amountBeansBuyingWith);
          expect(await this.token.getInternalBalance(user.address, this.bean.address)).to.equal(0);
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
          this.listing = [userAddress, '0', '500', '500', '500000', '0', EXTERNAL]
          await this.marketplace.connect(user).createPodListing('0', '500', '500', '500000', '0', EXTERNAL);
          this.amountBeansBuyingWith = 100;

          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)
          this.result = await this.marketplace.connect(user2).fillPodListing(this.listing, this.amountBeansBuyingWith, EXTERNAL);

          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          this.listing = [userAddress, '700', '0', '300', '500000', '0', EXTERNAL]

          this.result = await this.marketplace.connect(user2).fillPodListing(this.listing, 100, EXTERNAL);

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
          this.listing = [userAddress, '0', '0', '1000', '500000', '0', INTERNAL]
          await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', INTERNAL);
          this.amountBeansBuyingWith = 250;

          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)

          this.result = await this.marketplace.connect(user2).fillPodListing(this.listing, this.amountBeansBuyingWith, EXTERNAL);

          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(this.amountBeansBuyingWith);
          expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(0);
          expect(await this.token.getInternalBalance(user.address, this.bean.address)).to.equal(this.amountBeansBuyingWith);
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
    })

    describe("Cancel", async function () {
      it('Re-list plot cancels and re-lists', async function () {
        result = await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', EXTERNAL);
        expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(result));
        result = await this.marketplace.connect(user).createPodListing('0', '0', '1000', '200000', '2000', INTERNAL);
        await expect(result).to.emit(this.marketplace, 'PodListingCreated').withArgs(userAddress, '0', 0, 1000, 200000, 2000, 1);
        await expect(result).to.emit(this.marketplace, 'PodListingCancelled').withArgs(userAddress, '0');
        expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(result));
      })

      it('Reverts on Cancel Listing, not owned by user', async function () {
        await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', EXTERNAL);
        await expect(this.marketplace.connect(user2).cancelPodListing('0')).to.be.revertedWith('Marketplace: Listing not owned by sender.');
      })

      it('Cancels Listing, Emits Listing Cancelled Event', async function () {
        result = await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '2000', EXTERNAL);
        expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(result));
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
          await expect(this.marketplace.connect(user2).createPodOrder('100', '0', '100000', EXTERNAL)).to.be.revertedWith("Marketplace: Pod price must be greater than 0.");
        })
        it('Reverts if amount is 0', async function () {
          await expect(this.marketplace.connect(user2).createPodOrder('0', '100000', '100000', EXTERNAL)).to.be.revertedWith("Marketplace: Order amount must be > 0.");
        })
      })

      describe('create order', async function () {
        beforeEach(async function () {
          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address)
          this.result = await this.marketplace.connect(user).createPodOrder('500', '100000', '1000', EXTERNAL)
          this.id = await getOrderId(this.result)
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
    })

    describe("Fill", async function () {
      beforeEach(async function () {
        this.order = [userAddress, '100000', '2500'];
        this.result = await this.marketplace.connect(user).createPodOrder('50', '100000', '2500', EXTERNAL)
        this.id = await getOrderId(this.result)
      })

      describe("revert", async function () {
        it("owner does not own plot", async function () {
          await expect(this.marketplace.fillPodOrder(this.order, 0, 0, 500, INTERNAL)).to.revertedWith("Marketplace: Invalid Plot.");
        })

        it("plot amount too large", async function () {
          await expect(this.marketplace.connect(user2).fillPodOrder(this.order, 1000, 700, 500, INTERNAL)).to.revertedWith("Marketplace: Invalid Plot.");
        })

        it("plot amount too large", async function () {
          await this.field.connect(user2).sow('1200', EXTERNAL);
          await expect(this.marketplace.connect(user2).fillPodOrder(this.order, 2000, 700, 500, INTERNAL)).to.revertedWith("Marketplace: Plot too far in line.");
        })

        it("sell too much", async function () {
          await expect(this.marketplace.connect(user2).fillPodOrder(this.order, 1000, 0, 1000, INTERNAL)).to.revertedWith("SafeMath: subtraction overflow");
        })
      })

      describe("Full order", async function () {
        beforeEach(async function () {
          this.beanstalkBalance = await this.bean.balanceOf(this.marketplace.address)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)
          this.result = await this.marketplace.connect(user2).fillPodOrder(this.order, 1000, 0, 500, EXTERNAL);
          this.beanstalkBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalanceAfter.sub(this.user2BeanBalance)).to.equal('50');
          expect(this.beanstalkBalance.sub(this.beanstalkBalanceAfter)).to.equal('50');
          expect(await this.token.getInternalBalance(user2.address, this.bean.address)).to.equal(0);
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
          this.result = await this.marketplace.connect(user2).fillPodOrder(this.order, 1000, 250, 250, EXTERNAL);
          this.beanstalkBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalanceAfter.sub(this.user2BeanBalance)).to.equal('25');
          expect(this.beanstalkBalance.sub(this.beanstalkBalanceAfter)).to.equal('25');
          expect(await this.token.getInternalBalance(user2.address, this.bean.address)).to.equal(0);
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
          this.result = await this.marketplace.connect(user2).fillPodOrder(this.order, 1000, 0, 500, INTERNAL);
          this.beanstalkBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalanceAfter.sub(this.user2BeanBalance)).to.equal(0);
          expect(this.beanstalkBalance.sub(this.beanstalkBalanceAfter)).to.equal(0);
          expect(await this.token.getInternalBalance(user2.address, this.bean.address)).to.equal('50');
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
          await this.marketplace.connect(user2).createPodListing('1000', '500', '500', '50000', '5000', EXTERNAL);
          this.beanstalkBalance = await this.bean.balanceOf(this.marketplace.address)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)
          this.result = await this.marketplace.connect(user2).fillPodOrder(this.order, 1000, 0, 500, INTERNAL);
          this.beanstalkBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalanceAfter.sub(this.user2BeanBalance)).to.equal(0);
          expect(this.beanstalkBalance.sub(this.beanstalkBalanceAfter)).to.equal(0);
          expect(await this.token.getInternalBalance(user2.address, this.bean.address)).to.equal('50');
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
        this.result = await this.marketplace.connect(user).createPodOrder('500', '100000', '1000', EXTERNAL)
        this.id = await getOrderId(this.result)
      })

      describe('Cancel owner', async function () {
        beforeEach(async function () {
          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address)
          this.result = await this.marketplace.connect(user).cancelPodOrder('100000', '1000', EXTERNAL);
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
        })

        it('deletes the offer', async function () {
          expect(await this.marketplace.podOrderById(this.id)).to.equal('0');
        })

        it('transfer beans', async function () {
          expect(this.beanstalkBeanBalance.sub(this.beanstalkBeanBalanceAfter)).to.equal('500');
          expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal('500');
          expect(await this.token.getInternalBalance(user.address, this.bean.address)).to.equal('0');
        })

        it('Emits an event', async function () {
          expect(this.result).to.emit(this.marketplace, 'PodOrderCancelled').withArgs(userAddress, this.id);
        })
      })

      describe('Cancel to wrapped', async function () {
        beforeEach(async function () {
          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address)
          this.result = await this.marketplace.connect(user).cancelPodOrder('100000', '1000', INTERNAL);
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
        })

        it('deletes the offer', async function () {
          expect(await this.marketplace.podOrderById(this.id)).to.equal('0');
        })

        it('transfer beans', async function () {
          expect(this.beanstalkBeanBalance.sub(this.beanstalkBeanBalanceAfter)).to.equal('0');
          expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal('0');
          expect(await this.token.getInternalBalance(user.address, this.bean.address)).to.equal('500');
        })

        it('Emits an event', async function () {
          expect(this.result).to.emit(this.marketplace, 'PodOrderCancelled').withArgs(userAddress, this.id);
        })
      })
    })
  })
})