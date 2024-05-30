const { EXTERNAL, INTERNAL } = require("./utils/balances.js");
const { Fixed } = require("./utils/priceTypes.js");
const { expect, use } = require("chai");
const { waffleChai } = require("@ethereum-waffle/chai");
use(waffleChai);
const { deploy } = require("../scripts/deploy.js");
const { BEAN, ZERO_ADDRESS } = require("./utils/constants");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { ethers } = require("hardhat");
const { getAllBeanstalkContracts } = require("../utils/contracts");
const { getBean } = require("../utils/contracts");
const { mine } = require("@nomicfoundation/hardhat-network-helpers");

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";
let user, user2, owner;

let snapshotId;

describe("Marketplace", function () {
  let contracts;
  let provider;
  before(async function () {
    contracts = await deploy((verbose = false), (mock = true), (reset = true));
    [owner, user, user2] = await ethers.getSigners();

    provider = ethers.getDefaultProvider();

    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;

    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [beanstalk, mockBeanstalk] = await getAllBeanstalkContracts(contracts.beanstalkDiamond.address);

    bean = await getBean();

    await bean.mint(user.address, 500000);
    await bean.mint(user2.address, 500000);

    await mockBeanstalk.siloSunrise(0);

    await bean.connect(user).approve(beanstalk.address, "100000000000");
    await bean.connect(user2).approve(beanstalk.address, "100000000000");

    await mockBeanstalk.incrementTotalSoilE("100000");
    // mine 300 blocks:
    await mine(300);
    await mockBeanstalk.setYieldE("0");
    await beanstalk.connect(user).sow("1000", "0", EXTERNAL);
    await beanstalk.connect(user2).sow("1000", "0", EXTERNAL);
  });

  const getHashFromListing = function (l) {
    return ethers.utils.solidityKeccak256(
      [
        "address",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "uint24",
        "uint256",
        "uint256",
        "uint8"
      ],
      [
        l.lister,
        l.fieldId,
        l.index,
        l.start,
        l.podAmount,
        l.pricePerPod,
        l.maxHarvestableIndex,
        l.minFillAmount,
        l.mode
      ]
    );
  };

  const PodListing = function (
    lister,
    fieldId,
    index,
    start,
    podAmount,
    pricePerPod,
    maxHarvestableIndex,
    minFillAmount,
    mode
  ) {
    return {
      lister: lister,
      fieldId: fieldId,
      index: index,
      start: start,
      podAmount: podAmount,
      pricePerPod: pricePerPod,
      maxHarvestableIndex: maxHarvestableIndex,
      minFillAmount: minFillAmount,
      mode: mode
    };
  };

  const PodOrder = function (orderer, fieldId, pricePerPod, maxPlaceInLine, minFillAmount) {
    return {
      orderer: orderer,
      fieldId: fieldId,
      pricePerPod: pricePerPod,
      maxPlaceInLine: maxPlaceInLine,
      minFillAmount: minFillAmount
    };
  };

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("Pod Listings", async function () {
    describe("Fixed Price", async function () {
      describe("Create", async function () {
        it("Fails to List Unowned Plot", async function () {
          let podListing = PodListing(user.address, 0, 5000, 0, 1000, 100000, 0, 0, INTERNAL);
          await expect(mockBeanstalk.connect(user).createPodListing(podListing)).to.be.revertedWith(
            "Marketplace: Invalid Plot."
          );
        });

        it("Fails if already expired", async function () {
          let podListing = PodListing(user.address, 0, 0, 0, 500, 100000, 0, 0, INTERNAL);
          await mockBeanstalk.incrementTotalHarvestableE(0, 2000);
          await expect(mockBeanstalk.connect(user).createPodListing(podListing)).to.be.revertedWith(
            "Marketplace: Expired."
          );
        });

        it("Fails if amount is 0", async function () {
          let podListing = PodListing(user2.address, 0, 1000, 0, 0, 100000, 0, 0, INTERNAL);
          await expect(
            mockBeanstalk.connect(user2).createPodListing(podListing)
          ).to.be.revertedWith("Marketplace: Invalid Amount.");
        });

        it("fails if price is 0", async function () {
          let podListing = PodListing(user2.address, 0, 1000, 0, 1000, 0, 0, 0, INTERNAL);
          await expect(
            mockBeanstalk.connect(user2).createPodListing(podListing)
          ).to.be.revertedWith("Marketplace: Pod price must be greater than 0.");
        });

        it("Fails if address mismatch", async function () {
          let podListing = PodListing(user.address, 0, 1000, 0, 1000, 100000, 0, 0, INTERNAL);
          await expect(
            mockBeanstalk.connect(user2).createPodListing(podListing)
          ).to.be.revertedWith("Marketplace: Non-user create listing.");
        });

        it("Fails if field does not exist", async function () {
          let podListing = PodListing(user2.address, 420, 1000, 0, 1000, 100000, 0, 0, INTERNAL);
          await expect(
            mockBeanstalk.connect(user2).createPodListing(podListing)
          ).to.be.revertedWith("Marketplace: Invalid Plot.");
        });

        it("Fails if start + amount too large", async function () {
          let podListing = PodListing(user2.address, 0, 1000, 500, 1000, 100000, 0, 0, INTERNAL);
          await expect(
            mockBeanstalk.connect(user2).createPodListing(podListing)
          ).to.be.revertedWith("Marketplace: Invalid Plot.");
        });

        describe("List full plot", async function () {
          beforeEach(async function () {
            this.podListing = PodListing(user.address, 0, 0, 0, 1000, 500000, 0, 0, EXTERNAL);
            this.result = await mockBeanstalk.connect(user).createPodListing(this.podListing);
            this.listingId = getHashFromListing(this.podListing);
          });

          it("Lists Plot properly", async function () {
            expect(
              await mockBeanstalk.getPodListing(this.podListing.fieldId, this.podListing.index)
            ).to.be.equal(this.listingId);
          });

          it("Emits event", async function () {
            await expect(this.result)
              .to.emit(mockBeanstalk, "PodListingCreated")
              .withArgs(user.address, 0, 0, 0, 1000, 500000, 0, 0, 0);
          });
        });

        describe("List full plot with minimum amount", async function () {
          beforeEach(async function () {
            this.podListing = PodListing(user.address, 0, 0, 0, 1000, 500000, 0, 100, EXTERNAL);
            this.result = await mockBeanstalk.connect(user).createPodListing(this.podListing);
          });
          this.listingId = await getHashFromListing(this.podListing);

          it("Lists Plot properly", async function () {
            expect(
              await mockBeanstalk.getPodListing(this.podListing.fieldId, this.podListing.index)
            ).to.be.equal(this.listingId);
          });

          it("Emits event", async function () {
            await expect(this.result)
              .to.emit(mockBeanstalk, "PodListingCreated")
              .withArgs(user.address, 0, 0, 0, 1000, 500000, 0, 100, 0);
          });
        });

        describe("List partial plot", async function () {
          beforeEach(async function () {
            this.podListing = PodListing(user.address, 0, 123, 0, 100, 100000, 0, 0, EXTERNAL);
            this.result = await mockBeanstalk.connect(user).createPodListing(this.podListing);
            this.podListing = PodListing(user.address, 0, 123, 0, 500, 500000, 0, 0, EXTERNAL);
            this.result = await mockBeanstalk.connect(user).createPodListing(this.podListing);
          });
          this.listingId = getHashFromListing(this.podListing);

          it("Lists Plot properly", async function () {
            expect(
              await mockBeanstalk.getPodListing(this.podListing.fieldId, this.podListing.index)
            ).to.be.equal(this.listingId);
          });

          it("Emits event", async function () {
            await expect(this.result)
              .to.emit(mockBeanstalk, "PodListingCreated")
              .withArgs(user.address, 0, 123, 0, 500, 500000, 0, 0, 0);
          });
        });

        describe("List partial plot from middle", async function () {
          beforeEach(async function () {
            this.podListing = PodListing(user.address, 0, 0, 500, 500, 500000, 2000, 0, INTERNAL);
            this.result = await mockBeanstalk.connect(user).createPodListing(this.podListing);
            this.listingId = await getHashFromListing(this.podListing);
          });

          it("Lists Plot properly", async function () {
            expect(
              await mockBeanstalk.getPodListing(this.podListing.fieldId, this.podListing.index)
            ).to.be.equal(this.listingId);
          });

          it("Emits event", async function () {
            await expect(this.result)
              .to.emit(mockBeanstalk, "PodListingCreated")
              .withArgs(user.address, 0, 0, 500, 500, 500000, 2000, 0, 1);
          });
        });

        describe("Relist plot from middle", async function () {
          beforeEach(async function () {
            this.podListing = PodListing(user.address, 0, 0, 0, 500, 500000, 0, 0, INTERNAL);
            this.result = await mockBeanstalk.connect(user).createPodListing(this.podListing);
            this.podListing = PodListing(user.address, 0, 0, 500, 100, 500000, 2000, 0, INTERNAL);
            this.result = await mockBeanstalk.connect(user).createPodListing(this.podListing);
            this.listingId = await getHashFromListing(this.podListing);
          });

          it("Lists Plot properly", async function () {
            expect(
              await mockBeanstalk.getPodListing(this.podListing.fieldId, this.podListing.index)
            ).to.be.equal(this.listingId);
          });

          it("Emits event", async function () {
            await expect(this.result)
              .to.emit(mockBeanstalk, "PodListingCancelled")
              .withArgs(user.address, 0, 0);
            await expect(this.result)
              .to.emit(mockBeanstalk, "PodListingCreated")
              .withArgs(user.address, 0, 0, 500, 100, 500000, 2000, 0, 1);
          });
        });

        describe("Relist plot from middle with minimum amount", async function () {
          beforeEach(async function () {
            this.podListing = PodListing(user.address, 0, 0, 0, 500, 500000, 0, 100, INTERNAL);
            this.result = await mockBeanstalk.connect(user).createPodListing(this.podListing);
            this.podListing = PodListing(user.address, 0, 0, 500, 100, 500000, 2000, 100, INTERNAL);
            this.result = await mockBeanstalk.connect(user).createPodListing(this.podListing);
            this.listingId = await getHashFromListing(this.podListing);
          });

          it("Lists Plot properly", async function () {
            expect(
              await mockBeanstalk.getPodListing(this.podListing.fieldId, this.podListing.index)
            ).to.be.equal(this.listingId);
          });

          it("Emits event", async function () {
            await expect(this.result)
              .to.emit(mockBeanstalk, "PodListingCancelled")
              .withArgs(user.address, 0, 0);
            await expect(this.result)
              .to.emit(mockBeanstalk, "PodListingCreated")
              .withArgs(user.address, 0, 0, 500, 100, 500000, 2000, 100, 1);
          });
        });
      });

      describe("Fill", async function () {
        describe("revert", async function () {
          beforeEach(async function () {
            this.podListing = PodListing(user.address, 0, 0, 0, 1000, 500000, 0, "10", EXTERNAL);
            await mockBeanstalk.connect(user).createPodListing(this.podListing);
          });

          it("Fill Listing non-listed Index Fails", async function () {
            let brokenListing = this.podListing;
            brokenListing.index = 1;
            await expect(
              mockBeanstalk.connect(user).fillPodListing(brokenListing, 500, EXTERNAL)
            ).to.be.revertedWith("Marketplace: Listing does not exist.");
          });

          it("Fill Listing wrong start Index Fails", async function () {
            let brokenListing = this.podListing;
            brokenListing.start = 1;
            await expect(
              mockBeanstalk.connect(user).fillPodListing(brokenListing, 500, EXTERNAL)
            ).to.be.revertedWith("Marketplace: Listing does not exist.");
          });

          it("Fill Listing wrong price Fails", async function () {
            let brokenListing = this.podListing;
            brokenListing.pricePerPod = "100001";
            await expect(
              mockBeanstalk.connect(user).fillPodListing(brokenListing, 500, EXTERNAL)
            ).to.be.revertedWith("Marketplace: Listing does not exist.");
          });

          it("Fill Listing after expired", async function () {
            await mockBeanstalk.incrementTotalHarvestableE(0, 2000);
            await expect(
              mockBeanstalk.connect(user2).fillPodListing(this.podListing, 500, EXTERNAL)
            ).to.be.revertedWith("Marketplace: Listing has expired.");
          });

          it("Fill Listing not enough pods in plot", async function () {
            await expect(
              mockBeanstalk.connect(user2).fillPodListing(this.podListing, 501, EXTERNAL)
            ).to.be.revertedWith("Marketplace: Not enough pods in Listing.");
          });

          it("Fill Listing not enough pods in listing", async function () {
            const podListing = PodListing(user.address, 0, 0, 0, 500, 500000, 0, 0, INTERNAL);
            await mockBeanstalk.connect(user).createPodListing(podListing);
            await expect(
              mockBeanstalk.connect(user2).fillPodListing(podListing, 500, EXTERNAL)
            ).to.be.revertedWith("Marketplace: Not enough pods in Listing.");
          });

          it("Fails if filling under minimum amount of Pods", async function () {
            await expect(
              mockBeanstalk.connect(user2).fillPodListing(this.podListing, 1, EXTERNAL)
            ).to.be.revertedWith("Marketplace: Fill must be >= minimum amount.");
          });
        });

        describe("Fill listing", async function () {
          beforeEach(async function () {
            this.podListing = PodListing(user.address, 0, 0, 0, 1000, 500000, 0, 0, EXTERNAL);
            await mockBeanstalk.connect(user).createPodListing(this.podListing);
            this.amountBeansBuyingWith = 500;

            this.userBeanBalance = await bean.balanceOf(user.address);
            this.user2BeanBalance = await bean.balanceOf(user2.address);

            this.result = await mockBeanstalk
              .connect(user2)
              .fillPodListing(this.podListing, this.amountBeansBuyingWith, EXTERNAL);

            this.user2BeanBalanceAfter = await bean.balanceOf(user2.address);
            this.userBeanBalanceAfter = await bean.balanceOf(user.address);
          });

          it("Transfer Beans properly", async function () {
            expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(
              this.amountBeansBuyingWith
            );
            expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(
              this.amountBeansBuyingWith
            );
            expect(await beanstalk.getInternalBalance(user.address, bean.address)).to.equal(0);
          });

          it("Deletes Pod Listing", async function () {
            expect(await mockBeanstalk.getPodListing(0, 0)).to.equal(ZERO_HASH);
          });

          it("transfer pod listing", async function () {
            expect(await beanstalk.plot(user2.address, 0, 0)).to.equal(1000);
            expect(await beanstalk.plot(user.address, 0, 0)).to.equal(0);
          });

          it("emits event", async function () {
            await expect(this.result)
              .to.emit(mockBeanstalk, "PodListingFilled")
              .withArgs(user2.address, user.address, 0, 0, 0, 1000, 500);
          });
        });

        describe("Fill partial listing", async function () {
          beforeEach(async function () {
            this.podListing = PodListing(user.address, 0, 0, 0, 1000, 500000, 0, 0, EXTERNAL);
            await mockBeanstalk.connect(user).createPodListing(this.podListing);
            this.amountBeansBuyingWith = 250;

            this.userBeanBalance = await bean.balanceOf(user.address);
            this.user2BeanBalance = await bean.balanceOf(user2.address);

            this.result = await mockBeanstalk
              .connect(user2)
              .fillPodListing(this.podListing, this.amountBeansBuyingWith, EXTERNAL);

            this.user2BeanBalanceAfter = await bean.balanceOf(user2.address);
            this.userBeanBalanceAfter = await bean.balanceOf(user.address);
          });

          it("Transfer Beans properly", async function () {
            expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(
              this.amountBeansBuyingWith
            );
            expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(
              this.amountBeansBuyingWith
            );
            expect(await beanstalk.getInternalBalance(user.address, bean.address)).to.equal(0);
          });

          it("transfer pod listing", async function () {
            expect(await beanstalk.plot(user2.address, 0, 0)).to.equal(500);
            expect(await beanstalk.plot(user.address, 0, 0)).to.equal(0);
            expect(await beanstalk.plot(user.address, 0, 500)).to.equal(500);
          });

          it("Deletes Pod Listing", async function () {
            let newListing = this.podListing;
            newListing.index = 500;
            newListing.start = 0;
            newListing.podAmount = 500;
            expect(await mockBeanstalk.getPodListing(0, 0)).to.equal(ZERO_HASH);
            expect(await mockBeanstalk.getPodListing(0, 500)).to.equal(
              getHashFromListing(newListing)
            );
          });

          it("emits event", async function () {
            await expect(this.result)
              .to.emit(mockBeanstalk, "PodListingFilled")
              .withArgs(user2.address, user.address, 0, 0, 0, 500, "250");
          });
        });

        describe("Fill partial listing of a partial listing multiple fills", async function () {
          beforeEach(async function () {
            this.podListing = PodListing(user.address, 0, 0, 500, 500, 500000, 0, 0, EXTERNAL);
            await mockBeanstalk.connect(user).createPodListing(this.podListing);
            this.amountBeansBuyingWith = 100;

            this.userBeanBalance = await bean.balanceOf(user.address);
            this.user2BeanBalance = await bean.balanceOf(user2.address);

            this.result = await mockBeanstalk
              .connect(user2)
              .fillPodListing(this.podListing, this.amountBeansBuyingWith, EXTERNAL);

            this.user2BeanBalanceAfter = await bean.balanceOf(user2.address);
            this.userBeanBalanceAfter = await bean.balanceOf(user.address);
          });

          it("Transfer Beans properly", async function () {
            expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(
              this.amountBeansBuyingWith
            );
            expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(
              this.amountBeansBuyingWith
            );
            expect(await beanstalk.getInternalBalance(user.address, bean.address)).to.equal(0);
          });

          it("transfer pod listing", async function () {
            expect(await beanstalk.plot(user2.address, 0, 500)).to.equal(200);
            expect(await beanstalk.plot(user.address, 0, 0)).to.equal(500);
            expect(await beanstalk.plot(user.address, 0, 700)).to.equal(300);
          });

          it("Deletes Pod Listing", async function () {
            expect(await mockBeanstalk.getPodListing(0, 0)).to.equal(ZERO_HASH);
            let newListing = this.podListing;
            newListing.index = 700;
            newListing.start = 0;
            newListing.podAmount = 300;
            expect(await mockBeanstalk.getPodListing(0, 700)).to.equal(
              getHashFromListing(newListing)
            );
          });

          it("emits event", async function () {
            await expect(this.result)
              .to.emit(mockBeanstalk, "PodListingFilled")
              .withArgs(user2.address, user.address, 0, 0, 500, 200, 100);
          });
        });

        describe("Fill partial listing of a listing created by partial fill", async function () {
          beforeEach(async function () {
            this.podListing = PodListing(user.address, 0, 0, 500, 500, 500000, 0, 0, EXTERNAL);
            await mockBeanstalk.connect(user).createPodListing(this.podListing);
            this.amountBeansBuyingWith = 100;

            this.userBeanBalance = await bean.balanceOf(user.address);
            this.user2BeanBalance = await bean.balanceOf(user2.address);
            this.result = await mockBeanstalk
              .connect(user2)
              .fillPodListing(this.podListing, this.amountBeansBuyingWith, EXTERNAL);

            this.user2BeanBalanceAfter = await bean.balanceOf(user2.address);
            this.userBeanBalanceAfter = await bean.balanceOf(user.address);

            this.podListing = PodListing(user.address, 0, 700, 0, 300, 500000, 0, 0, EXTERNAL);
            this.listingId = getHashFromListing(this.podListing);

            this.result = await mockBeanstalk
              .connect(user2)
              .fillPodListing(this.podListing, 100, EXTERNAL);

            this.podListing = PodListing(user.address, 0, 900, 0, 100, 500000, 0, 0, EXTERNAL);
            this.listingId = getHashFromListing(this.podListing);
          });

          it("plots correctly transfer", async function () {
            expect(await beanstalk.plot(user.address, 0, 0)).to.equal(500);
            expect(await beanstalk.plot(user.address, 0, 700)).to.equal(0);
            expect(await beanstalk.plot(user.address, 0, 900)).to.equal(100);

            expect(await beanstalk.plot(user2.address, 0, 0)).to.equal(0);
            expect(await beanstalk.plot(user2.address, 0, 500)).to.equal(200);
            expect(await beanstalk.plot(user2.address, 0, 700)).to.equal(200);
            expect(await beanstalk.plot(user2.address, 0, 900)).to.equal(0);
          });

          it("listing updates", async function () {
            expect(await mockBeanstalk.getPodListing(0, 700)).to.equal(ZERO_HASH);
            expect(await mockBeanstalk.getPodListing(0, 900)).to.equal(this.listingId);
          });
        });

        describe("Fill partial listing to wallet", async function () {
          beforeEach(async function () {
            this.podListing = PodListing(user.address, 0, 0, 0, 1000, 500000, 0, 0, INTERNAL);
            await mockBeanstalk.connect(user).createPodListing(this.podListing);
            this.amountBeansBuyingWith = 250;

            this.userBeanBalance = await bean.balanceOf(user.address);
            this.user2BeanBalance = await bean.balanceOf(user2.address);

            this.result = await mockBeanstalk
              .connect(user2)
              .fillPodListing(this.podListing, this.amountBeansBuyingWith, EXTERNAL);

            this.user2BeanBalanceAfter = await bean.balanceOf(user2.address);
            this.userBeanBalanceAfter = await bean.balanceOf(user.address);
          });

          it("Transfer Beans properly", async function () {
            expect(this.user2BeanBalance.sub(this.user2BeanBalanceAfter)).to.equal(
              this.amountBeansBuyingWith
            );
            expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(0);
            expect(await beanstalk.getInternalBalance(user.address, bean.address)).to.equal(
              this.amountBeansBuyingWith
            );
          });

          it("Deletes Pod Listing", async function () {
            expect(await mockBeanstalk.getPodListing(0, 0)).to.equal(ZERO_HASH);
            newListing = this.podListing;
            newListing.index = 500;
            newListing.start = 0;
            newListing.podAmount = 500;
            expect(await mockBeanstalk.getPodListing(0, 500)).to.equal(
              getHashFromListing(newListing)
            );
          });

          it("transfer pod listing", async function () {
            expect(await beanstalk.plot(user2.address, 0, 0)).to.equal(500);
            expect(await beanstalk.plot(user.address, 0, 0)).to.equal(0);
            expect(await beanstalk.plot(user.address, 0, 500)).to.equal(500);
          });

          it("emits event", async function () {
            await expect(this.result)
              .to.emit(mockBeanstalk, "PodListingFilled")
              .withArgs(user2.address, user.address, 0, 0, 0, 500, "250");
          });
        });
      });

      describe("Cancel", async function () {
        it("Re-list plot cancels and re-lists", async function () {
          let podListing = PodListing(user.address, 0, 0, 0, 1000, 500000, 0, 0, EXTERNAL);
          result = await mockBeanstalk.connect(user).createPodListing(podListing);
          this.listingId = await getHashFromListing(podListing);
          expect(
            await mockBeanstalk.getPodListing(podListing.fieldId, podListing.index)
          ).to.be.equal(this.listingId);

          podListing = PodListing(user.address, 0, 0, 0, 1000, "200000", 2000, 0, INTERNAL);
          result = await mockBeanstalk.connect(user).createPodListing(podListing);
          await expect(result)
            .to.emit(mockBeanstalk, "PodListingCreated")
            .withArgs(user.address, 0, 0, 0, 1000, 200000, 2000, 0, 1);
          await expect(result)
            .to.emit(mockBeanstalk, "PodListingCancelled")
            .withArgs(user.address, 0, 0);
          this.listingId = await getHashFromListing(podListing);
          expect(
            await mockBeanstalk.getPodListing(podListing.fieldId, podListing.index)
          ).to.be.equal(this.listingId);
        });

        it("Reverts on Cancel Listing, not owned by user", async function () {
          let podListing = PodListing(user.address, 0, 0, 0, 1000, 500000, 0, 0, EXTERNAL);
          await mockBeanstalk.connect(user).createPodListing(podListing);
          await expect(mockBeanstalk.connect(user2).cancelPodListing(0, 0)).to.be.revertedWith(
            "Marketplace: Listing not owned by sender."
          );
        });

        it("Cancels Listing, Emits Listing Cancelled Event", async function () {
          let podListing = PodListing(user.address, 0, 0, 0, 1000, 500000, 2000, 0, EXTERNAL);
          result = await mockBeanstalk.connect(user).createPodListing(podListing);
          this.listingId = await getHashFromListing(podListing);
          expect(
            await mockBeanstalk.getPodListing(podListing.fieldId, podListing.index)
          ).to.be.equal(this.listingId);
          result = await mockBeanstalk.connect(user).cancelPodListing(0, 0);
          expect(
            await mockBeanstalk.getPodListing(podListing.fieldId, podListing.index)
          ).to.be.equal(ZERO_HASH);
          await expect(result)
            .to.emit(mockBeanstalk, "PodListingCancelled")
            .withArgs(user.address, 0, 0);
        });
      });
    });
  });

  describe("Pod Order", async function () {
    describe("Fixed Price", async function () {
      describe("Create", async function () {
        describe("revert", async function () {
          it("Reverts if price is 0", async function () {
            this.podOrder = PodOrder(user2.address, 0, 0, 100000, 0);
            await expect(
              mockBeanstalk.connect(user2).createPodOrder(this.podOrder, 100, EXTERNAL)
            ).to.be.revertedWith("Marketplace: Pod price must be greater than 0.");
          });

          it("Reverts if amount is 0", async function () {
            this.podOrder = PodOrder(user2.address, 0, 100000, 100000, 0);
            await expect(
              mockBeanstalk.connect(user2).createPodOrder(this.podOrder, 0, EXTERNAL)
            ).to.be.revertedWith("Marketplace: Order amount must be > 0.");
          });
        });

        describe("create order", async function () {
          beforeEach(async function () {
            this.userBeanBalance = await bean.balanceOf(user.address);
            this.beanstalkBeanBalance = await bean.balanceOf(mockBeanstalk.address);
            this.podOrder = PodOrder(user.address, 0, 100000, 1000, 0);
            this.result = await mockBeanstalk
              .connect(user)
              .createPodOrder(this.podOrder, 500, EXTERNAL);
            this.id = await beanstalk.getOrderId(this.podOrder);
            this.userBeanBalanceAfter = await bean.balanceOf(user.address);
            this.beanstalkBeanBalanceAfter = await bean.balanceOf(mockBeanstalk.address);
          });

          it("Transfer Beans properly", async function () {
            expect(this.beanstalkBeanBalanceAfter.sub(this.beanstalkBeanBalance)).to.equal(500);
            expect(this.userBeanBalance.sub(this.userBeanBalanceAfter)).to.equal(500);
          });

          it("Creates the order", async function () {
            expect(await mockBeanstalk.getPodOrder(this.id)).to.equal(500);
          });

          it("emits an event", async function () {
            await expect(this.result)
              .to.emit(mockBeanstalk, "PodOrderCreated")
              .withArgs(user.address, this.id, 500, 0, 100000, 1000, 0);
          });

          it("cancels old order, replacing with new order", async function () {
            let newOrder = await mockBeanstalk
              .connect(user)
              .createPodOrder(PodOrder(user.address, 0, 100000, 1000, 0), 100, EXTERNAL);
            await expect(newOrder)
              .to.emit(mockBeanstalk, "PodOrderCancelled")
              .withArgs(user.address, this.id);
            expect(await mockBeanstalk.getPodOrder(this.id)).to.equal(100);
          });
        });

        describe("create order with min amount", async function () {
          beforeEach(async function () {
            this.userBeanBalance = await bean.balanceOf(user.address);
            this.beanstalkBeanBalance = await bean.balanceOf(mockBeanstalk.address);
            this.podOrder = PodOrder(user.address, 0, 100000, 1000, 100);
            this.result = await mockBeanstalk
              .connect(user)
              .createPodOrder(this.podOrder, 500, EXTERNAL);
            this.id = await beanstalk.getOrderId(this.podOrder);
            this.userBeanBalanceAfter = await bean.balanceOf(user.address);
            this.beanstalkBeanBalanceAfter = await bean.balanceOf(mockBeanstalk.address);
          });

          it("Transfer Beans properly", async function () {
            expect(this.beanstalkBeanBalanceAfter.sub(this.beanstalkBeanBalance)).to.equal(500);
            expect(this.userBeanBalance.sub(this.userBeanBalanceAfter)).to.equal(500);
          });

          it("Creates the order", async function () {
            expect(await mockBeanstalk.getPodOrder(this.id)).to.equal(500);
          });

          it("emits an event", async function () {
            await expect(this.result)
              .to.emit(mockBeanstalk, "PodOrderCreated")
              .withArgs(user.address, this.id, 500, 0, 100000, 1000, 100);
          });
        });
      });

      describe("Fill", async function () {
        beforeEach(async function () {
          this.podOrder = PodOrder(user.address, 0, 100000, "2500", "10");
          this.result = await mockBeanstalk
            .connect(user)
            .createPodOrder(this.podOrder, 50, EXTERNAL);
          this.id = await beanstalk.getOrderId(this.podOrder);
        });

        describe("revert", async function () {
          it("owner does not own plot", async function () {
            await expect(
              mockBeanstalk.fillPodOrder(this.podOrder, 0, 0, 500, INTERNAL)
            ).to.revertedWith("Marketplace: Invalid Plot.");
          });

          it("plot amount too large", async function () {
            await expect(
              mockBeanstalk.connect(user2).fillPodOrder(this.podOrder, 1000, 700, 500, INTERNAL)
            ).to.be.revertedWith("Marketplace: Invalid Plot.");
          });

          it("plot amount too large", async function () {
            await beanstalk.connect(user2).sow("1200", 0, EXTERNAL);
            await expect(
              mockBeanstalk.connect(user2).fillPodOrder(this.podOrder, 2000, 700, 500, INTERNAL)
            ).to.be.revertedWith("Marketplace: Plot too far in line.");
          });

          it("sell too much", async function () {
            await expect(
              mockBeanstalk.connect(user2).fillPodOrder(this.podOrder, 1000, 0, 1000, INTERNAL)
            ).to.revertedWith("Marketplace: Not enough beans in order.");
          });

          it("under minimum amount of pods", async function () {
            await expect(
              mockBeanstalk.connect(user2).fillPodOrder(this.podOrder, 1000, 0, 1, INTERNAL)
            ).to.revertedWith("Marketplace: Fill must be >= minimum amount.");
          });
        });

        describe("Full order", async function () {
          beforeEach(async function () {
            this.beanstalkBalance = await bean.balanceOf(mockBeanstalk.address);
            this.user2BeanBalance = await bean.balanceOf(user2.address);
            this.result = await mockBeanstalk
              .connect(user2)
              .fillPodOrder(this.podOrder, 1000, 0, 500, EXTERNAL);
            this.beanstalkBalanceAfter = await bean.balanceOf(mockBeanstalk.address);
            this.user2BeanBalanceAfter = await bean.balanceOf(user2.address);
          });

          it("Transfer Beans properly", async function () {
            expect(this.user2BeanBalanceAfter.sub(this.user2BeanBalance)).to.equal("50");
            expect(this.beanstalkBalance.sub(this.beanstalkBalanceAfter)).to.equal("50");
            expect(await beanstalk.getInternalBalance(user2.address, bean.address)).to.equal(0);
          });

          it("transfer the plot", async function () {
            expect(await beanstalk.plot(user2.address, 0, 1000)).to.be.equal(0);
            expect(await beanstalk.plot(user2.address, 0, 1500)).to.be.equal(500);
            expect(await beanstalk.plot(user.address, 0, 1000)).to.be.equal(500);
          });

          it("Updates the offer", async function () {
            expect(await mockBeanstalk.getPodOrder(this.id)).to.equal(0);
          });

          it("Emits an event", async function () {
            await expect(this.result)
              .to.emit(mockBeanstalk, "PodOrderFilled")
              .withArgs(user2.address, user.address, this.id, 0, 1000, 0, 500, 50);
          });
        });

        describe("Partial fill order", async function () {
          beforeEach(async function () {
            this.beanstalkBalance = await bean.balanceOf(mockBeanstalk.address);
            this.user2BeanBalance = await bean.balanceOf(user2.address);
            this.result = await mockBeanstalk
              .connect(user2)
              .fillPodOrder(this.podOrder, 1000, 250, 250, EXTERNAL);
            this.beanstalkBalanceAfter = await bean.balanceOf(mockBeanstalk.address);
            this.user2BeanBalanceAfter = await bean.balanceOf(user2.address);
          });

          it("Transfer Beans properly", async function () {
            expect(this.user2BeanBalanceAfter.sub(this.user2BeanBalance)).to.equal("25");
            expect(this.beanstalkBalance.sub(this.beanstalkBalanceAfter)).to.equal("25");
            expect(await beanstalk.getInternalBalance(user2.address, bean.address)).to.equal(0);
          });

          it("transfer the plot", async function () {
            expect(await beanstalk.plot(user2.address, 0, 1000)).to.be.equal(250);
            expect(await beanstalk.plot(user2.address, 0, 1500)).to.be.equal(500);
            expect(await beanstalk.plot(user.address, 0, 1250)).to.be.equal(250);
          });

          it("Updates the offer", async function () {
            expect(await mockBeanstalk.getPodOrder(this.id)).to.equal("25");
          });

          it("Emits an event", async function () {
            await expect(this.result)
              .to.emit(mockBeanstalk, "PodOrderFilled")
              .withArgs(user2.address, user.address, this.id, 0, 1000, 250, 250, 25);
          });
        });

        describe("Full order to wallet", async function () {
          beforeEach(async function () {
            this.beanstalkBalance = await bean.balanceOf(mockBeanstalk.address);
            this.user2BeanBalance = await bean.balanceOf(user2.address);
            this.result = await mockBeanstalk
              .connect(user2)
              .fillPodOrder(this.podOrder, 1000, 0, 500, INTERNAL);
            this.beanstalkBalanceAfter = await bean.balanceOf(mockBeanstalk.address);
            this.user2BeanBalanceAfter = await bean.balanceOf(user2.address);
          });

          it("Transfer Beans properly", async function () {
            expect(this.user2BeanBalanceAfter.sub(this.user2BeanBalance)).to.equal(0);
            expect(this.beanstalkBalance.sub(this.beanstalkBalanceAfter)).to.equal(0);
            expect(await beanstalk.getInternalBalance(user2.address, bean.address)).to.equal("50");
          });

          it("transfer the plot", async function () {
            expect(await beanstalk.plot(user2.address, 0, 1000)).to.be.equal(0);
            expect(await beanstalk.plot(user2.address, 0, 1500)).to.be.equal(500);
            expect(await beanstalk.plot(user.address, 0, 1000)).to.be.equal(500);
          });

          it("Updates the offer", async function () {
            expect(await mockBeanstalk.getPodOrder(this.id)).to.equal(0);
          });

          it("Emits an event", async function () {
            await expect(this.result)
              .to.emit(mockBeanstalk, "PodOrderFilled")
              .withArgs(user2.address, user.address, this.id, 0, 1000, 0, 500, 50);
          });
        });

        describe("Full order with active listing", async function () {
          beforeEach(async function () {
            this.podListing = PodListing(
              user2.address,
              0,
              1000,
              500,
              500,
              50000,
              5000,
              0,
              EXTERNAL
            );
            await mockBeanstalk.connect(user2).createPodListing(this.podListing);
            this.beanstalkBalance = await bean.balanceOf(mockBeanstalk.address);
            this.user2BeanBalance = await bean.balanceOf(user2.address);
            this.result = await mockBeanstalk
              .connect(user2)
              .fillPodOrder(this.podOrder, 1000, 0, 500, INTERNAL);
            this.beanstalkBalanceAfter = await bean.balanceOf(mockBeanstalk.address);
            this.user2BeanBalanceAfter = await bean.balanceOf(user2.address);
          });

          it("Transfer Beans properly", async function () {
            expect(this.user2BeanBalanceAfter.sub(this.user2BeanBalance)).to.equal(0);
            expect(this.beanstalkBalance.sub(this.beanstalkBalanceAfter)).to.equal(0);
            expect(await beanstalk.getInternalBalance(user2.address, bean.address)).to.equal("50");
          });

          it("transfer the plot", async function () {
            expect(await beanstalk.plot(user2.address, 0, 1000)).to.be.equal(0);
            expect(await beanstalk.plot(user2.address, 0, 1500)).to.be.equal(500);
            expect(await beanstalk.plot(user.address, 0, 1000)).to.be.equal(500);
          });

          it("Updates the offer", async function () {
            expect(await mockBeanstalk.getPodOrder(this.id)).to.equal(0);
          });

          it("deletes the listing", async function () {
            expect(
              await mockBeanstalk.getPodListing(this.podListing.fieldId, this.podListing.index)
            ).to.equal(ZERO_HASH);
          });

          it("Emits an event", async function () {
            await expect(this.result)
              .to.emit(mockBeanstalk, "PodListingCancelled")
              .withArgs(user2.address, 0, 1000);
            await expect(this.result)
              .to.emit(mockBeanstalk, "PodOrderFilled")
              .withArgs(user2.address, user.address, this.id, 0, 1000, 0, 500, 50);
          });
        });
      });

      describe("Cancel", async function () {
        beforeEach(async function () {
          this.podOrder = PodOrder(user.address, 0, 100000, 1000, 0);
          this.result = await mockBeanstalk
            .connect(user)
            .createPodOrder(this.podOrder, 500, EXTERNAL);
          this.id = await beanstalk.getOrderId(this.podOrder);
        });

        describe("Cancel owner", async function () {
          beforeEach(async function () {
            this.userBeanBalance = await bean.balanceOf(user.address);
            this.beanstalkBeanBalance = await bean.balanceOf(mockBeanstalk.address);
            this.result = await mockBeanstalk.connect(user).cancelPodOrder(this.podOrder, EXTERNAL);
            this.userBeanBalanceAfter = await bean.balanceOf(user.address);
            this.beanstalkBeanBalanceAfter = await bean.balanceOf(mockBeanstalk.address);
          });

          it("deletes the offer", async function () {
            expect(await mockBeanstalk.getPodOrder(this.id)).to.equal(0);
          });

          it("transfer beans", async function () {
            expect(this.beanstalkBeanBalance.sub(this.beanstalkBeanBalanceAfter)).to.equal(500);
            expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(500);
            expect(await beanstalk.getInternalBalance(user.address, bean.address)).to.equal(0);
          });

          it("Emits an event", async function () {
            await expect(this.result)
              .to.emit(mockBeanstalk, "PodOrderCancelled")
              .withArgs(user.address, this.id);
          });
        });

        describe("Cancel to wrapped", async function () {
          beforeEach(async function () {
            this.userBeanBalance = await bean.balanceOf(user.address);
            this.beanstalkBeanBalance = await bean.balanceOf(mockBeanstalk.address);
            this.result = await mockBeanstalk.connect(user).cancelPodOrder(this.podOrder, INTERNAL);
            this.userBeanBalanceAfter = await bean.balanceOf(user.address);
            this.beanstalkBeanBalanceAfter = await bean.balanceOf(mockBeanstalk.address);
          });

          it("deletes the offer", async function () {
            expect(await mockBeanstalk.getPodOrder(this.id)).to.equal(0);
          });

          it("transfer beans", async function () {
            expect(this.beanstalkBeanBalance.sub(this.beanstalkBeanBalanceAfter)).to.equal(0);
            expect(this.userBeanBalanceAfter.sub(this.userBeanBalance)).to.equal(0);
            expect(await beanstalk.getInternalBalance(user.address, bean.address)).to.equal(500);
          });

          it("Emits an event", async function () {
            await expect(this.result)
              .to.emit(mockBeanstalk, "PodOrderCancelled")
              .withArgs(user.address, this.id);
          });
        });
      });
    });

    describe("Plot Transfer", async function () {
      describe("reverts", async function () {
        it("doesn't sent to 0 address", async function () {
          await expect(
            mockBeanstalk.connect(user).transferPlot(user.address, ZERO_ADDRESS, 0, 0, 0, 100)
          ).to.be.revertedWith("Field: Transfer to/from 0 address.");
        });

        it("Plot not owned by user.", async function () {
          await expect(
            mockBeanstalk.connect(user2).transferPlot(user2.address, user.address, 0, 0, 0, 100)
          ).to.be.revertedWith("Field: Plot not owned by user.");
        });

        it("Allowance is 0 not owned by user.", async function () {
          await expect(
            mockBeanstalk.connect(user2).transferPlot(user.address, user2.address, 0, 0, 0, 100)
          ).to.be.revertedWith("Field: Insufficient approval.");
        });

        it("Pod Range invalid", async function () {
          await expect(
            mockBeanstalk.connect(user).transferPlot(user.address, user.address, 0, 0, "150", 100)
          ).to.be.revertedWith("Field: Pod range invalid.");
        });

        it("transfers to self", async function () {
          await expect(
            mockBeanstalk.connect(user).transferPlot(user.address, user.address, 0, 0, 0, 100)
          ).to.be.revertedWith("Field: Cannot transfer Pods to oneself.");
        });
      });

      describe("transfers beginning of plot", async function () {
        beforeEach(async function () {
          this.result = await mockBeanstalk
            .connect(user)
            .transferPlot(user.address, user2.address, 0, 0, 0, 100);
        });

        it("transfers the plot", async function () {
          expect(await beanstalk.plot(user2.address, 0, 0)).to.be.equal(100);
          expect(await beanstalk.plot(user.address, 0, 0)).to.be.equal(0);
          expect(await beanstalk.plot(user.address, 0, 100)).to.be.equal(900);
        });

        it("emits plot transfer the plot", async function () {
          await expect(this.result)
            .to.emit(mockBeanstalk, "PlotTransfer")
            .withArgs(user.address, user2.address, 0, 100);
        });
      });

      describe("transfers with allowance", async function () {
        beforeEach(async function () {
          await expect(mockBeanstalk.connect(user).approvePods(user2.address, 0, 100));
          this.result = await mockBeanstalk
            .connect(user2)
            .transferPlot(user.address, user2.address, 0, 0, 0, 100);
        });

        it("transfers the plot", async function () {
          expect(await beanstalk.plot(user2.address, 0, 0)).to.be.equal(100);
          expect(await beanstalk.plot(user.address, 0, 0)).to.be.equal(0);
          expect(await beanstalk.plot(user.address, 0, 100)).to.be.equal(900);
          expect(await mockBeanstalk.allowancePods(user.address, user2.address, 0)).to.be.equal(0);
        });

        it("emits plot transfer the plot", async function () {
          await expect(this.result)
            .to.emit(mockBeanstalk, "PlotTransfer")
            .withArgs(user.address, user2.address, 0, 100);
        });
      });

      describe("transfers with existing pod listing", async function () {
        beforeEach(async function () {
          this.podListing = PodListing(user.address, 0, 0, 0, 1000, 500000, 0, 0, EXTERNAL);
          await mockBeanstalk.connect(user).createPodListing(this.podListing);
          this.result = await mockBeanstalk
            .connect(user)
            .transferPlot(user.address, user2.address, 0, 0, 0, 100);
        });

        it("transfers the plot", async function () {
          expect(await beanstalk.plot(user2.address, 0, 0)).to.be.equal(100);
          expect(await beanstalk.plot(user.address, 0, 0)).to.be.equal(0);
          expect(await beanstalk.plot(user.address, 0, 100)).to.be.equal(900);
        });

        it("removes the listing", async function () {
          expect(
            await mockBeanstalk.getPodListing(this.podListing.fieldId, this.podListing.index)
          ).to.be.equal(ZERO_HASH);
        });

        it("emits plot transfer the plot", async function () {
          await expect(this.result)
            .to.emit(mockBeanstalk, "PlotTransfer")
            .withArgs(user.address, user2.address, 0, 100);
          await expect(this.result)
            .to.emit(mockBeanstalk, "PodListingCancelled")
            .withArgs(user.address, 0, 0);
        });
      });

      describe.skip("transfers with existing pod listing from other", async function () {
        beforeEach(async function () {
          this.podListing = PodListing(user.address, 0, 0, 0, 1000, 500000, 0, 0, EXTERNAL);
          await mockBeanstalk.connect(user).createPodListing(this.podListing);
          this.result = await expect(
            mockBeanstalk.connect(user).approvePods(user2.address, 0, 100)
          );
          this.result = await mockBeanstalk
            .connect(user2)
            .transferPlot(user.address, user2.address, 0, 0, 0, 100);
        });

        it("transfers the plot", async function () {
          expect(await beanstalk.plot(user.address, 0, 0)).to.be.equal(0);
          expect(await beanstalk.plot(user.address, 0, 100)).to.be.equal(900);
          expect(await beanstalk.plot(user2.address, 0, 0)).to.be.equal(100);
        });

        it("removes the listing", async function () {
          expect(
            await mockBeanstalk.getPodListing(this.podListing.fieldId, this.podListing.index)
          ).to.be.equal(ZERO_HASH);
        });

        it("emits events", async function () {
          await expect(this.result)
            .to.emit(mockBeanstalk, "PlotTransfer")
            .withArgs(user.address, user2.address, 0, 100);
          await expect(this.result)
            .to.emit(mockBeanstalk, "PodListingCancelled")
            .withArgs(user.address, 0, 0);
        });
      });
    });
  });
});
