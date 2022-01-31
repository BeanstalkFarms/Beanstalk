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
    this.silo = await ethers.getContractAt('SiloFacet', this.diamond.address);
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address);
    this.marketplace = await ethers.getContractAt('MarketplaceFacet', this.diamond.address);
    this.claim = await ethers.getContractAt('ClaimFacet', this.diamond.address);
    this.bean = await ethers.getContractAt('MockToken', contracts.bean);
    this.pair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pair);

    await this.bean.mint(userAddress, '500000')
    await this.bean.mint(user2Address, '500000')
    await this.field.incrementTotalSoilEE('100000');
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

  const getOrderId = async function (tx) {
    let receipt = await tx.wait();
    let idx = (receipt.events?.filter((x) => { return x.event == "PodOrderCreated" }))[0].args.id;
    return idx;
  }

  beforeEach(async function () {
    await resetState();
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
          const podListing = await this.marketplace.podListing(userAddress, 0);
          expect(podListing.pricePerPod).to.equal(500000);
          expect(podListing.maxHarvestableIndex.toString()).to.equal('0');
          expect(podListing.amount.toString()).to.equal('1000');
          expect(podListing.start.toString()).to.equal('0');
          expect(podListing.toWallet).to.equal(true);
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
          const podListing = await this.marketplace.podListing(userAddress, 0);
          expect(podListing.pricePerPod).to.equal(500000);
          expect(podListing.maxHarvestableIndex.toString()).to.equal('0');
          expect(podListing.amount.toString()).to.equal('500');
          expect(podListing.start.toString()).to.equal('0');
          expect(podListing.toWallet).to.equal(true);
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
          const podListing = await this.marketplace.podListing(userAddress, 0);
          expect(podListing.pricePerPod).to.equal(500000);
          expect(podListing.maxHarvestableIndex.toString()).to.equal('2000');
          expect(podListing.amount.toString()).to.equal('500');
          expect(podListing.start.toString()).to.equal('500');
          expect(podListing.toWallet).to.equal(false);
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
          const podListing = await this.marketplace.podListing(userAddress, 0);
          expect(podListing.pricePerPod).to.equal(500000);
          expect(podListing.maxHarvestableIndex.toString()).to.equal('2000');
          expect(podListing.amount.toString()).to.equal('100');
          expect(podListing.start.toString()).to.equal('500');
          expect(podListing.toWallet).to.equal(false);
        })

        it('Emits event', async function () {
          await expect(this.result).to.emit(this.marketplace, 'PodListingCancelled').withArgs(userAddress, 0);
          await expect(this.result).to.emit(this.marketplace, 'PodListingCreated').withArgs(userAddress, 0, 500, '100', 500000, 2000, false);
        })
      })
    })
    describe("Fill", async function () {

      describe('revert', async function () {
        beforeEach(async function () {
          await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', true);
        })

        it('Fails to fill Listing, not enough ETH used', async function () {
          await this.pair.simulateTrade('4000', '1000');
          await expect(this.marketplace.connect(user2).buyBeansAndFillPodListing(userAddress, 0, 0, 0, 100, '100000', { value: 24 })).to.be.revertedWith('UniswapV2Router: EXCESSIVE_INPUT_AMOUNT');
        })

        it('Fill Listing non-listed Index Fails', async function () {
          await expect(this.marketplace.connect(user).fillPodListing(user2Address, 1, 0, 500, '100000')).to.be.revertedWith('Marketplace: Listing does not exist.');
        })

        it('Fill Listing wrong start Index Fails', async function () {
          await expect(this.marketplace.connect(user).fillPodListing(user2Address, 0, 1, 500, '100000')).to.be.revertedWith('Marketplace: start/price must match listing.');
        })

        it('Fill Listing wrong price Fails', async function () {
          await expect(this.marketplace.connect(user).fillPodListing(user2Address, 0, 0, 500, '100001')).to.be.revertedWith('Marketplace: start/price must match listing.');
        })

        it('Fill Listing after expired', async function () {
          await this.field.incrementTotalHarvestableE('2000');
          await expect(this.marketplace.connect(user2).fillPodListing(userAddress, 0, 0, 500, '500000')).to.be.revertedWith('Marketplace: Listing has expired.');
        })

        it('Fill Listing not enough pods in plot', async function () {
          await expect(this.marketplace.connect(user2).fillPodListing(userAddress, 0, 0, 501, '500000')).to.be.revertedWith('Marketplace: Not enough pods in Listing');
        })

        it('Fill Listing not enough pods in listing', async function () {
          await this.marketplace.connect(user).createPodListing('0', '0', '500', '500000', '0', false);
          await expect(this.marketplace.connect(user2).fillPodListing(userAddress, 0, 0, 500, '500000')).to.be.revertedWith('Marketplace: Not enough pods in Listing.');
        })
      })

      describe("Fill listing", async function () {
        beforeEach(async function () {
          await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', true);
          this.amountBeansBuyingWith = 500;

          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)

          this.result = await this.marketplace.connect(user2).fillPodListing(userAddress, 0, 0, this.amountBeansBuyingWith, '500000');

          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(this.amountBeansBuyingWith);
          expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(this.amountBeansBuyingWith);
          expect(await this.claim.wrappedBeans(userAddress)).to.equal(0);
        })

        it('Deletes Pod Listing', async function () {
          const podListingDeleted = await this.marketplace.podListing(userAddress, 0);
          expect(podListingDeleted.pricePerPod.toString()).to.equal('0');
          expect(podListingDeleted.amount.toString()).to.equal('0');
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
          await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', true);
          this.amountBeansBuyingWith = 250;

          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)

          this.result = await this.marketplace.connect(user2).fillPodListing(userAddress, 0, 0, this.amountBeansBuyingWith, '500000');

          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(this.amountBeansBuyingWith);
          expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(this.amountBeansBuyingWith);
          expect(await this.claim.wrappedBeans(userAddress)).to.equal(0);
        })

        it('Deletes Pod Listing', async function () {
          const podListingDeleted = await this.marketplace.podListing(userAddress, 0);
          expect(podListingDeleted.pricePerPod.toString()).to.equal('0');
          expect(podListingDeleted.amount.toString()).to.equal('0');
          const newPodListing = await this.marketplace.podListing(userAddress, 500);
          expect(newPodListing.pricePerPod.toString()).to.equal('500000');
          expect(newPodListing.amount.toString()).to.equal('500');
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

      describe("Fill partial listing of a partial listing", async function () {
        beforeEach(async function () {
          await this.marketplace.connect(user).createPodListing('0', '500', '500', '500000', '0', true);
          this.amountBeansBuyingWith = 100;

          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)

          this.result = await this.marketplace.connect(user2).fillPodListing(userAddress, 0, 500, this.amountBeansBuyingWith, '500000');

          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(this.amountBeansBuyingWith);
          expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(this.amountBeansBuyingWith);
          expect(await this.claim.wrappedBeans(userAddress)).to.equal(0);
        })

        it('Deletes Pod Listing', async function () {
          const podListingDeleted = await this.marketplace.podListing(userAddress, 0);
          expect(podListingDeleted.pricePerPod.toString()).to.equal('0');
          expect(podListingDeleted.amount.toString()).to.equal('0');
          const newPodListing = await this.marketplace.podListing(userAddress, 200);
          expect(newPodListing.start.toString()).to.equal('500');
          expect(newPodListing.pricePerPod.toString()).to.equal('500000');
          expect(newPodListing.amount.toString()).to.equal('300');
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

      describe("Fill partial listing to wallet", async function () {
        beforeEach(async function () {
          await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', false);
          this.amountBeansBuyingWith = 250;

          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)

          this.result = await this.marketplace.connect(user2).fillPodListing(userAddress, 0, 0, this.amountBeansBuyingWith, '500000');

          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
        })

        it('Transfer Beans properly', async function () {
          expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(this.amountBeansBuyingWith);
          expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(0);
          expect(await this.claim.wrappedBeans(userAddress)).to.equal(this.amountBeansBuyingWith);
        })

        it('Deletes Pod Listing', async function () {
          const podListingDeleted = await this.marketplace.podListing(userAddress, 0);
          expect(podListingDeleted.pricePerPod.toString()).to.equal('0');
          expect(podListingDeleted.amount.toString()).to.equal('0');
          const newPodListing = await this.marketplace.podListing(userAddress, 500);
          expect(newPodListing.pricePerPod.toString()).to.equal('500000');
          expect(newPodListing.amount.toString()).to.equal('500');
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
          await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', false);
          this.amountTransferringBeans = 0;
          this.amoutBuyingBeans = 250;

          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)

          this.result = await this.marketplace.connect(user2).buyBeansAndFillPodListing(userAddress, 0, 0, this.amountTransferringBeans, this.amoutBuyingBeans, '500000', { value: 112 })

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
          await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', false);
          this.amountTransferringBeans = 100;
          this.amoutBuyingBeans = 250;

          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)

          this.result = await this.marketplace.connect(user2).buyBeansAndFillPodListing(userAddress, 0, 0, this.amountTransferringBeans, this.amoutBuyingBeans, '500000', { value: 112 })

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
            await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', true);

            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.user2BeanBalance = await this.bean.balanceOf(user2Address)
            this.result = await this.marketplace.connect(user2).claimAndFillPodListing(userAddress, 0, 0, this.amountBeansBuyingWith, '500000', [['27'], [], [], false, false, 0, 0, false]);
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
            await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', true);

            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.user2BeanBalance = await this.bean.balanceOf(user2Address)
            this.result = await this.marketplace.connect(user2).claimAndFillPodListing(userAddress, 0, 0, this.amountBeansBuyingWith, '500000', [['27'], [], [], false, false, 0, 0, false]);
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
            await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', false);

            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.user2BeanBalance = await this.bean.balanceOf(user2Address)
            this.result = await this.marketplace.connect(user2).claimAndFillPodListing(userAddress, 0, 0, this.amountBeansBuyingWith, '500000', [['27'], [], [], false, false, 0, 0, false]);
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
            await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', true);
            this.amountTransferringBeans = 100;
            this.amoutBuyingBeans = 250;

            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.user2BeanBalance = await this.bean.balanceOf(user2Address)

            this.result = await this.marketplace.connect(user2).claimBuyBeansAndFillPodListing(userAddress, 0, 0, this.amountTransferringBeans, this.amoutBuyingBeans, '500000', [['27'], [], [], false, false, 0, 0, false], { value: 112 })

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
        await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', true);
        const podListing = await this.marketplace.podListing(userAddress, 0);
        expect(podListing.pricePerPod).to.equal(500000);
        result = await this.marketplace.connect(user).createPodListing('0', '0', '1000', '200000', '2000', false);
        await expect(result).to.emit(this.marketplace, 'PodListingCreated').withArgs(userAddress, '0', 0, 1000, 200000, 2000, false);
        await expect(result).to.emit(this.marketplace, 'PodListingCancelled').withArgs(userAddress, '0');
        const podListingRelisted = await this.marketplace.podListing(userAddress, 0);
        expect(podListingRelisted.pricePerPod).to.equal(200000);

      })

      it('Reverts on Cancel Listing, not owned by user', async function () {
        await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', true);
        await expect(this.marketplace.connect(user2).cancelPodListing('0')).to.be.revertedWith('Marketplace: Listing not owned by sender.');
      })

      it('Cancels Listing, Emits Listing Cancelled Event', async function () {
        await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '2000', true);
        const podListing = await this.marketplace.podListing(userAddress, 0);
        expect(podListing.pricePerPod).to.equal(500000);
        expect(podListing.maxHarvestableIndex.toString()).to.equal('2000');
        result = (await this.marketplace.connect(user).cancelPodListing('0'));
        const podListingCancelled = await this.marketplace.podListing(userAddress, 0);
        expect(podListingCancelled.pricePerPod).to.equal(0);
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
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
        })

        it('Transfer Beans properly', async function () {
          expect(this.beanstalkBeanBalanceAfter.sub(this.beanstalkBeanBalance)).to.equal('500');
          expect(this.userBeanBalance.sub(this.userBeanBalanceAfter)).to.equal('500');
        })

        it('Creates the offer', async function () {
          const order = await this.marketplace.podOrder(this.id)
          expect(order.owner).to.be.equal(userAddress);
          expect(order.amount).to.be.equal('5000');
          expect(order.pricePerPod).to.be.equal(100000);
          expect(order.maxPlaceInLine).to.be.equal('1000');
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
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
        })

        it('Transfer Beans properly', async function () {
          expect(this.beanstalkBeanBalanceAfter.sub(this.beanstalkBeanBalance)).to.equal('250');
          expect(this.userBeanBalance.sub(this.userBeanBalanceAfter)).to.equal('0');
        })

        it('Creates the offer', async function () {
          const order = await this.marketplace.podOrder(this.id)
          expect(order.owner).to.be.equal(userAddress);
          expect(order.amount).to.be.equal('2500');
          expect(order.pricePerPod).to.be.equal(100000);
          expect(order.maxPlaceInLine).to.be.equal('1000');
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
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
        })

        it('Transfer Beans properly', async function () {
          expect(this.beanstalkBeanBalanceAfter.sub(this.beanstalkBeanBalance)).to.equal('350');
          expect(this.userBeanBalance.sub(this.userBeanBalanceAfter)).to.equal('100');
        })

        it('Creates the offer', async function () {
          const order = await this.marketplace.podOrder(this.id)
          expect(order.owner).to.be.equal(userAddress);
          expect(order.amount).to.be.equal('3500');
          expect(order.pricePerPod).to.be.equal(100000);
          expect(order.maxPlaceInLine).to.be.equal('1000');
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
            this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
            this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
          })

          it('Transfer Beans properly', async function () {
            expect(this.beanstalkBeanBalanceAfter.sub(this.beanstalkBeanBalance)).to.equal('0');
            expect(this.userBeanBalance.sub(this.userBeanBalanceAfter)).to.equal('0');
            expect(await this.claim.wrappedBeans(userAddress)).to.equal('0');
          })

          it('Creates the offer', async function () {
            const order = await this.marketplace.podOrder(this.id)
            expect(order.owner).to.be.equal(userAddress);
            expect(order.amount).to.be.equal('2500');
            expect(order.pricePerPod).to.be.equal(100000);
            expect(order.maxPlaceInLine).to.be.equal('1000');
          })
        })

        describe('normal order overallocate', async function () {
          beforeEach(async function () {
            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address)
            this.result = await this.marketplace.connect(user).claimAndCreatePodOrder('300', '100000', '1000', [['27'], [], [], false, false, 0, 0, false])
            this.id = await getOrderId(this.result)
            this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
            this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
          })

          it('Transfer Beans properly', async function () {
            expect(this.beanstalkBeanBalanceAfter.sub(this.beanstalkBeanBalance)).to.equal('50');
            expect(this.userBeanBalance.sub(this.userBeanBalanceAfter)).to.equal('50');
            expect(await this.claim.wrappedBeans(userAddress)).to.equal('0');
          })

          it('Creates the offer', async function () {
            const order = await this.marketplace.podOrder(this.id)
            expect(order.owner).to.be.equal(userAddress);
            expect(order.amount).to.be.equal('3000');
            expect(order.pricePerPod).to.be.equal(100000);
            expect(order.maxPlaceInLine).to.be.equal('1000');
          })
        })

        describe('normal under overallocate', async function () {
          beforeEach(async function () {
            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address)
            this.result = await this.marketplace.connect(user).claimAndCreatePodOrder('100', '100000', '1000', [['27'], [], [], false, false, 0, 0, false])
            this.id = await getOrderId(this.result)
            this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
            this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
          })

          it('Transfer Beans properly', async function () {
            expect(this.beanstalkBeanBalanceAfter.sub(this.beanstalkBeanBalance)).to.equal('0');
            expect(this.userBeanBalance.sub(this.userBeanBalanceAfter)).to.equal('0');
            expect(await this.claim.wrappedBeans(userAddress)).to.equal('150');
          })

          it('Creates the offer', async function () {
            const order = await this.marketplace.podOrder(this.id)
            expect(order.owner).to.be.equal(userAddress);
            expect(order.amount).to.be.equal('1000');
            expect(order.pricePerPod).to.be.equal(100000);
            expect(order.maxPlaceInLine).to.be.equal('1000');
          })
        })

        describe('fill', async function () {
          beforeEach(async function () {
            await this.pair.simulateTrade('2500', '1000');
            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address)
            this.result = await this.marketplace.connect(user).claimBuyBeansAndCreatePodOrder('100', '250', '100000', '1000', [['27'], [], [], false, false, 0, 0, false], { value: 112 })
            this.id = await getOrderId(this.result)
            this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
            this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
          })

          it('Transfer Beans properly', async function () {
            expect(this.beanstalkBeanBalanceAfter.sub(this.beanstalkBeanBalance)).to.equal('250');
            expect(this.userBeanBalance.sub(this.userBeanBalanceAfter)).to.equal('0');
            expect(await this.claim.wrappedBeans(userAddress)).to.equal('150');
          })

          it('Creates the offer', async function () {
            const order = await this.marketplace.podOrder(this.id)
            expect(order.owner).to.be.equal(userAddress);
            expect(order.amount).to.be.equal('3500');
            expect(order.pricePerPod).to.be.equal(100000);
            expect(order.maxPlaceInLine).to.be.equal('1000');
          })
        })
      })
    })

    describe("Fill", async function () {
      beforeEach(async function () {
        this.result = await this.marketplace.connect(user).createPodOrder('50', '100000', '2500')
        this.id = await getOrderId(this.result)
      })

      describe("revert", async function () {
        it("owner does not own plot", async function () {
          await expect(this.marketplace.fillPodOrder(this.id, 0, 0, 500, false)).to.revertedWith("Marketplace: Invalid Plot.");
        })

        it("plot amount too large", async function () {
          await expect(this.marketplace.connect(user2).fillPodOrder(this.id, 1000, 700, 500, false)).to.revertedWith("Marketplace: Invalid Plot.");
        })

        it("plot amount too large", async function () {
          await this.field.connect(user2).sowBeansAndIndex('1200');
          await expect(this.marketplace.connect(user2).fillPodOrder(this.id, 2000, 700, 500, false)).to.revertedWith("Marketplace: Plot too far in line.");
        })

        it("sell too much", async function () {
          await expect(this.marketplace.connect(user2).fillPodOrder(this.id, 1000, 0, 1000, false)).to.revertedWith("SafeMath: subtraction overflow");
        })
      })

      describe("Full order", async function () {
        beforeEach(async function () {
          this.beanstalkBalance = await this.bean.balanceOf(this.marketplace.address)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)
          this.result = await this.marketplace.connect(user2).fillPodOrder(this.id, 1000, 0, 500, true);
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
          const order = await this.marketplace.podOrder(this.id);
          expect(order.owner).to.be.equal('0x0000000000000000000000000000000000000000');
          expect(order.amount).to.be.equal('0');
          expect(order.pricePerPod).to.be.equal(0);
          expect(order.maxPlaceInLine).to.be.equal('0');
        })

        it('Emits an event', async function () {
          expect(this.result).to.emit(this.marketplace, 'PodOrderFilled').withArgs(user2Address, userAddress, this.id, 1000, 0, 500);
        })
      })

      describe("Partial fill order", async function () {
        beforeEach(async function () {
          this.beanstalkBalance = await this.bean.balanceOf(this.marketplace.address)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)
          this.result = await this.marketplace.connect(user2).fillPodOrder(this.id, 1000, 250, 250, true);
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
          const order = await this.marketplace.podOrder(this.id);
          expect(order.owner).to.be.equal(userAddress);
          expect(order.amount).to.be.equal(250);
          expect(order.pricePerPod).to.be.equal(100000);
          expect(order.maxPlaceInLine).to.be.equal('2500');
        })

        it('Emits an event', async function () {
          expect(this.result).to.emit(this.marketplace, 'PodOrderFilled').withArgs(user2Address, userAddress, this.id, 1000, 250, 250);
        })
      })

      describe("Full order to wallet", async function () {
        beforeEach(async function () {
          this.beanstalkBalance = await this.bean.balanceOf(this.marketplace.address)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)
          this.result = await this.marketplace.connect(user2).fillPodOrder(this.id, 1000, 0, 500, false);
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
          const order = await this.marketplace.podOrder(this.id);
          expect(order.owner).to.be.equal('0x0000000000000000000000000000000000000000');
          expect(order.amount).to.be.equal('0');
          expect(order.pricePerPod).to.be.equal(0);
          expect(order.maxPlaceInLine).to.be.equal('0');
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
          this.result = await this.marketplace.connect(user2).fillPodOrder(this.id, 1000, 0, 500, false);
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
          const order = await this.marketplace.podOrder(this.id);
          expect(order.owner).to.be.equal('0x0000000000000000000000000000000000000000');
          expect(order.amount).to.be.equal('0');
          expect(order.pricePerPod).to.be.equal(0);
          expect(order.maxPlaceInLine).to.be.equal('0');
        })

        it('deletes the listing', async function () {
          const podListing = await this.marketplace.podListing(user2Address, '1000');
          expect(podListing.pricePerPod).to.equal(0);
          expect(podListing.maxHarvestableIndex.toString()).to.equal('0');
          expect(podListing.amount.toString()).to.equal('0');
          expect(podListing.start.toString()).to.equal('0');
          expect(podListing.toWallet).to.equal(false);
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
      })

      it('Reverts if not owner', async function () {
        expect(this.marketplace.connect(user2).cancelPodOrder(this.id, true)).to.be.revertedWith('Marketplace: Buy Order not owned by user.');
      })

      describe('Cancel owner', async function () {
        beforeEach(async function () {
          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address)
          this.result = await this.marketplace.connect(user).cancelPodOrder(this.id, true);
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
        })

        it('deletes the offer', async function () {
          const order = await this.marketplace.podOrder(this.id)
          expect(order.owner).to.be.equal('0x0000000000000000000000000000000000000000');
          expect(order.amount).to.be.equal('0');
          expect(order.pricePerPod).to.be.equal(0);
          expect(order.maxPlaceInLine).to.be.equal('0');
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
          this.result = await this.marketplace.connect(user).cancelPodOrder(this.id, false);
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
        })

        it('deletes the offer', async function () {
          const order = await this.marketplace.podOrder(this.id)
          expect(order.owner).to.be.equal('0x0000000000000000000000000000000000000000');
          expect(order.amount).to.be.equal('0');
          expect(order.pricePerPod).to.be.equal(0);
          expect(order.maxPlaceInLine).to.be.equal('0');
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