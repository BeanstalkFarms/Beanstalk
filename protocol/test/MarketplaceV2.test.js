const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const {CONSTANT, DYNAMIC } = require("./utils/pricetypes.js")
const { ppval_listing, ppval_order, interpolate, getFunctionDegree, findSortedIndex } = require('./utils/interpolater.js')
const { expect, use } = require("chai");
const { waffleChai } = require("@ethereum-waffle/chai");
use(waffleChai);
const { deploy } = require('../scripts/deploy.js')
const { BEAN, ZERO_ADDRESS } = require('./utils/constants')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");

const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000'
let user, user2, owner;
let userAddress, ownerAddress, user2Address;
let snapshotId;

describe('MarketplaceV2', function () {
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

  const emptyFunction = {
    ranges: new Array(32).fill('0'),
    values: new Array(128).fill('0'),
    bases: new Array(4).fill('0'),
    signs: '0'
  }

  const getHash = async function (tx) {
    let receipt = await tx.wait();
    var args = (receipt.events?.filter((x) => { return x.event == ("DynamicPodListingCreated") }))[0]?.args;
    var priceMode = DYNAMIC;
    // console.log(args);
    if (!args) {
      args = (receipt.events?.filter((x) => { return x.event == ("PodListingCreated")}))[0]?.args;
      priceMode = CONSTANT;
    }

    return ethers.utils.solidityKeccak256(
      ['uint256', 'uint256', 'uint24', 'uint256', 'bool', 'bool', 'uint256[]', 'uint256[]', 'uint256[]', 'uint256'],
      [args.start, args.amount, args.pricePerPod, args.maxHarvestableIndex, args[6] == EXTERNAL, priceMode == CONSTANT, priceMode==CONSTANT ? emptyFunction.ranges : args[7], priceMode == CONSTANT ? emptyFunction.values : args[8], priceMode == CONSTANT ? emptyFunction.bases : args[9], priceMode == CONSTANT ? emptyFunction.signs : args[10]]
    );
  }

  const getHashFromListing = function (l) {
    l[4] = l[4] == EXTERNAL;
    l.push(l[5][0])
    l.push(l[5][1])
    l.push(l[5][2])
    l.push(l[5][3])
    l[5] = l[5][4] == CONSTANT;
    
    return ethers.utils.solidityKeccak256(['uint256', 'uint256', 'uint24', 'uint256', 'bool', 'bool', 'uint256[]', 'uint256[]', 'uint256[]', 'uint256'], l);
  }

  const getOrderId = async function (tx) {
    let receipt = await tx.wait();
    let idx = (receipt.events?.filter((x) => { return x.event == ("PodOrderCreated") }))[0].args.id;
    return idx;
  }
  const getDOrderId = async function (tx) {
    let receipt = await tx.wait();
    let idx = (receipt.events?.filter((x) => { return x.event == "DynamicPodOrderCreated" }))[0].args.id;
    return idx;
  }

  const set0 = {
    xs: [100, 200],
    ys: [900000, 900000]
  }

  const set1 = {
    xs: [100, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000, 3200, 3400, 3600, 3800],
    ys: [900000, 900000, 900000, 900000, 900000, 800000, 800000, 800000, 800000, 775000, 750000, 725000, 700000, 675000, 650000, 625000, 600000, 575000, 550000, 525000]
  }

  const set2 = {
    xs: [200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000, 3200, 3400, 3600, 3800, 4200, 5000, 5500, 6350, 6780, 7230, 7400, 8130, 8500, 8800, 8950, 9900, 9999],
    ys: [900000, 900000, 900000, 900000, 800000, 800000, 800000, 800000, 775000, 750000, 725000, 700000, 675000, 650000, 625000, 600000, 575000, 550000, 525000, 520000, 515000, 510000, 501000, 478000, 465000, 443000, 425000, 409000, 398000, 389000, 371000, 369000]
  }

  const cubicSet = {
    xs: [1000  , 5000  , 6000  , 7000  , 8000  , 9000  , 10000 , 11000 , 12000 , 13000 , 14000 , 18000 , 20000 ],
    ys: [990000, 990000, 980000, 950000, 890000, 790000, 680000, 670000, 660000, 570000, 470000, 450000, 450000]
  }
  
  const z_interpolant = interpolate(set0.xs, set0.ys);
  const n_interpolant = interpolate(set1.xs, set1.ys); 
  const m_interpolant = interpolate(set2.xs, set2.ys);

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("Functions Miscellaneous", async function () {
    // describe("Subinterval Parsing", async function () {
      
    //   it('Correctly parses a value array with 0 subintervals', async function () {
    //     let parsedReturn = await this.marketplace.connect(user).parseIntervalTest(new Array(160).fill('0'));
    //     parsedReturn = parsedReturn.map(Number);
    //     expect(await parsedReturn).to.have.ordered.members([0]);
    //   })

    //   it("Correctly parses a value array with 1 subintervals", async function () {
    //     let parsedIntervals = parseIntervals(z_interpolant);
    //     let parsedReturn = await this.marketplace.connect(user).parseIntervalTest(z_interpolant.values);
    //     parsedReturn = parsedReturn.map((value) => Number(value));

    //     expect(await parsedReturn).to.have.ordered.members(parsedIntervals);
    //   })

    //   it("Correctly parses a value array with <32 subintervals", async function () {
    //     let parsedIntervals = parseIntervals(n_interpolant);
    //     let parsedReturn = await this.marketplace.connect(user).parseIntervalTest(n_interpolant.values);
    //     parsedReturn = parsedReturn.map((value) => Number(value));

    //     expect(await parsedReturn).to.have.ordered.members(parsedIntervals);
    //   })

    //   it("Correctly parses a value array with 32 subintervals", async function () {
    //     let parsedIntervals = parseIntervals(m_interpolant);
    //     let parsedReturn = await this.marketplace.connect(user).parseIntervalTest(m_interpolant.values);
    //     parsedReturn = parsedReturn.map((value) => Number(value));

    //     expect(await parsedReturn).to.have.ordered.members(parsedIntervals);
    //   })
    // })

    // describe("Subinterval Index Search", async function () {

    //   describe("<32 break points", async function () {
    //     beforeEach(async function () {
    //       this.parsedIntervals = parseIntervals(n_interpolant);
    //     })
    //     it("correctly finds interval at 0 value", async function () {
    //       expect(await this.marketplace.connect(user).findIndexInIntervals(this.parsedIntervals, '0')).to.be.equal(0);
    //     })

    //     it("correctly finds interval at median value", async function ( ){
    //       expect(await this.marketplace.connect(user).findIndexInIntervals(this.parsedIntervals, '250')).to.be.equal(2);
    //       expect(await this.marketplace.connect(user).findIndexInIntervals(this.parsedIntervals, '420')).to.be.equal(3);
    //       expect(await this.marketplace.connect(user).findIndexInIntervals(this.parsedIntervals, '3599')).to.be.equal(18);
    //     })
    //     it("correctly finds interval at breakpoint (exclusive of start value)", async function ( ){
    //       expect(await this.marketplace.connect(user).findIndexInIntervals(this.parsedIntervals, '200')).to.be.equal(1);
    //       expect(await this.marketplace.connect(user).findIndexInIntervals(this.parsedIntervals, '400')).to.be.equal(2);
    //       expect(await this.marketplace.connect(user).findIndexInIntervals(this.parsedIntervals, '3600')).to.be.equal(18);
    //     })
    //     it("correctly finds interval if value is at end", async function () {
    //       expect(await this.marketplace.connect(user).findIndexInIntervals(this.parsedIntervals, '3800')).to.be.equal(19);
    //     })
    //     it("returns interval array length if value is outside subinterval range", async function () {
    //       expect(await this.marketplace.connect(user).findIndexInIntervals(this.parsedIntervals, '3801')).to.be.equal(20);
    //     })
    //   })
      
    //   describe("32 break points", async function () {
    //     beforeEach(async function () {
    //       this.parsedIntervals = parseIntervals(m_interpolant);
    //     })
    //     it("correctly finds interval 0 value", async function () {
    //       expect(await this.marketplace.connect(user).findIndexInIntervals(this.parsedIntervals, '0')).to.be.equal(0);
    //     })

    //     it("correctly finds interval at median values", async function ( ){
    //       expect(await this.marketplace.connect(user).findIndexInIntervals(this.parsedIntervals, '250')).to.be.equal(1);
    //       expect(await this.marketplace.connect(user).findIndexInIntervals(this.parsedIntervals, '420')).to.be.equal(2);
    //       expect(await this.marketplace.connect(user).findIndexInIntervals(this.parsedIntervals, '1199')).to.be.equal(5);
    //     })
    //     it("correctly finds interval at breakpoints (exclusive of start value)", async function ( ){
    //       expect(await this.marketplace.connect(user).findIndexInIntervals(this.parsedIntervals, '400')).to.be.equal(1);
    //       expect(await this.marketplace.connect(user).findIndexInIntervals(this.parsedIntervals, '2000')).to.be.equal(9);
    //       expect(await this.marketplace.connect(user).findIndexInIntervals(this.parsedIntervals, '6780')).to.be.equal(23);
    //     })
    //     it("correctly finds interval if value is at end", async function () {
    //       expect(await this.marketplace.connect(user).findIndexInIntervals(this.parsedIntervals, '9999')).to.be.equal(31);
    //     })
    //     it("returns interval array length if value is outside subinterval range", async function () {
    //       expect(await this.marketplace.connect(user).findIndexInIntervals(this.parsedIntervals, '10000')).to.be.equal(32);
    //     })
    //   })
    // })

    describe("Function evaluation", async function () {
      describe("cubic", async function () {
        describe("at breakpoints", async function () {
          beforeEach(async function () {
            this.interp = interpolate(cubicSet.xs, cubicSet.ys);
          })
          it("correctly evaluates at 0", async function () {   
            var x = 0;       
            var index = findSortedIndex(cubicSet.xs, x);
            if(index > 0) index = index - 1;
            var degree = getFunctionDegree(this.interp, index);
            var v = ppval_listing(this.interp, x);
            expect(await this.marketplace.connect(user)._evaluatePPoly([this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC], x, index, degree)).to.be.equal(v);
          })

          it("correctly evaluates at first breakpoint", async function () {
            var x = cubicSet.xs[0];
            var index = findSortedIndex(cubicSet.xs, x);
            if(index > 0) index = index - 1;
            var v = ppval_listing(this.interp, x);
            var degree = getFunctionDegree(this.interp, index);

            expect(await this.marketplace.connect(user)._evaluatePPoly([this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC], x, index, degree)).to.be.equal(v);
          })

          it("correctly evaluates at second breakpoint", async function () {  
            var x = cubicSet.xs[1];
            var index = findSortedIndex(cubicSet.xs, x);
            if(index > 0) index = index - 1;
            var v = ppval_listing(this.interp, x);
            var degree = getFunctionDegree(this.interp, index);
            expect(await this.marketplace.connect(user)._evaluatePPoly([this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC], x, index, degree)).to.be.equal(v);
          })

          it("correctly evaluates at second last breakpoint", async function () {  
            var x = cubicSet.xs[cubicSet.xs.length - 2];
            var index = findSortedIndex(cubicSet.xs, x);
            if(index > 0) index = index - 1;
            var degree = getFunctionDegree(this.interp, index);
            var v = ppval_listing(this.interp, x);
            expect(await this.marketplace.connect(user)._evaluatePPoly([this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC], x, index, degree)).to.be.equal(v);
          })

          it("correctly evaluates at last breakpoint", async function () {  
            var x = cubicSet.xs[cubicSet.xs.length - 1];
            var index = findSortedIndex(cubicSet.xs, x);
            var v = ppval_listing(this.interp, x);
            if(index > 0) index = index - 1;
            var degree = getFunctionDegree(this.interp, index);
            expect(await this.marketplace.connect(user)._evaluatePPoly([this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC], x, index, degree)).to.be.equal(v);
          })
        })
        describe("within intervals", async function () {
          beforeEach(async function () {
            this.interp = interpolate(cubicSet.xs, cubicSet.ys);
          })
          it("correctly evaluates within first interval", async function () {
            var x = 2500;
            var index = findSortedIndex(cubicSet.xs, x);
            if(index > 0) index = index - 1;
            var degree = getFunctionDegree(this.interp, index);

            var v = ppval_listing(this.interp, x);
            expect(await this.marketplace.connect(user)._evaluatePPoly([this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC], x, index, degree)).to.be.equal(v);
          })
          it("correctly evaluates within second interval", async function () {
            var x = 5750;
            var index = findSortedIndex(cubicSet.xs, x);
            if(index > 0) index = index - 1;
            var degree = getFunctionDegree(this.interp, index);

            var v = ppval_listing(this.interp, x);
            expect(await this.marketplace.connect(user)._evaluatePPoly([this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC], x, index, degree)).to.be.equal(v);
          })
          it("correctly evaluates within second last interval", async function () {
            var x = 14999;
            var index = findSortedIndex(cubicSet.xs, x);
            if(index > 0) index = index - 1;
            var degree = getFunctionDegree(this.interp, index);

            var v = ppval_listing(this.interp, x);
            expect(await this.marketplace.connect(user)._evaluatePPoly([this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC], x, index, degree)).to.be.equal(v);
          })
          it("correctly evaluates within last interval", async function () {
            var x = 19410;
            var index = findSortedIndex(cubicSet.xs, x);

            if(index > 0) index = index - 1;
            var degree = getFunctionDegree(this.interp, index);
            var v = ppval_listing(this.interp, x);
            expect(await this.marketplace.connect(user)._evaluatePPoly([this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC], x, index, degree)).to.be.equal(v);
          })
        })
        
      })
    })

    describe("order evaluation", async function () {
      
      describe("within an interval", async function () {
        beforeEach(async function ( ){
          this.interp = interpolate(cubicSet.xs, cubicSet.ys);
          this.f = [this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC];
        })

        it("first interval", async function () {
          var placeInLine = 1000;
          var amount = 3000;
          var amountBeans = ppval_order(this.interp, placeInLine, amount);
          expect(await this.marketplace.connect(user)._getDynamicOrderAmount(this.f, placeInLine, 0, amount)).to.be.equal(amountBeans);
        })

        it("second interval", async function () {
          var placeInLine = 5200;
          var amount = 799;
          var amountBeans = ppval_order(this.interp, placeInLine, amount);
          expect(await this.marketplace.connect(user)._getDynamicOrderAmount(this.f, placeInLine, 0, amount)).to.be.equal(amountBeans);
        })
        it("third interval", async function () {
          var placeInLine = 7500;
          var amount = 10;
          var amountBeans = ppval_order(this.interp, placeInLine, amount);
          expect(await this.marketplace.connect(user)._getDynamicOrderAmount(this.f, placeInLine, 0, amount)).to.be.equal(amountBeans);
        })
        it("last interval", async function () {
          var placeInLine = 18000;
          var amount = 1000;
          var amountBeans = ppval_order(this.interp, placeInLine, amount);
          expect(await this.marketplace.connect(user)._getDynamicOrderAmount(this.f, placeInLine, 0, amount)).to.be.equal(amountBeans);
        })
      })

      describe("across 2 intervals", async function () {
        beforeEach(async function ( ){
          this.interp = interpolate(cubicSet.xs, cubicSet.ys);
          this.f = [this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC];
        })

        it("first to second", async function () {
          var placeInLine = 1000;
          var amount = 4500;
          var amountBeans = ppval_order(this.interp, placeInLine, amount);
          expect(await this.marketplace.connect(user)._getDynamicOrderAmount(this.f, placeInLine, 0, amount)).to.be.equal(amountBeans);
        })
        it("third to fourth", async function () {
          var placeInLine = 6500;
          var amount = 1499;
          var amountBeans = ppval_order(this.interp, placeInLine, amount);
          expect(await this.marketplace.connect(user)._getDynamicOrderAmount(this.f, placeInLine, 0, amount)).to.be.equal(amountBeans);
        })
        it("second last to last", async function () {
          var placeInLine = 15750;
          var amount = 4000;
          var amountBeans = ppval_order(this.interp, placeInLine, amount);
          expect(await this.marketplace.connect(user)._getDynamicOrderAmount(this.f, placeInLine, 0, amount)).to.be.equal(amountBeans);
        })
      })

      describe("across >2 intervals", async function () {
        beforeEach(async function ( ){
          this.interp = interpolate(cubicSet.xs, cubicSet.ys);
          this.f = [this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC];
        })

        it("three intervals", async function () {
          var placeInLine = 1000;
          var amount = 5500;
          var amountBeans = ppval_order(this.interp, placeInLine, amount);
          expect(await this.marketplace.connect(user)._getDynamicOrderAmount(this.f, placeInLine, 0, amount)).to.be.equal(amountBeans);
        })
        it("four intervals", async function () {
          var placeInLine = 5000;
          var amount = 3750;
          var amountBeans = ppval_order(this.interp, placeInLine, amount);
          expect(await this.marketplace.connect(user)._getDynamicOrderAmount(this.f, placeInLine, 0, amount)).to.be.equal(amountBeans);
        })
        it("one less than all", async function () {
          var placeInLine = 5500;
          var amount = 13990;
          var amountBeans = ppval_order(this.interp, placeInLine, amount);
          expect(await this.marketplace.connect(user)._getDynamicOrderAmount(this.f, placeInLine, 0, amount)).to.be.equal(amountBeans);
        })
        it("all", async function () {
          var placeInLine = 1000;
          var amount = 19000;
          var amountBeans = ppval_order(this.interp, placeInLine, amount);
          expect(await this.marketplace.connect(user)._getDynamicOrderAmount(this.f, placeInLine, 0, amount)).to.be.equal(amountBeans);
        })
        it("extends past end", async function () {
          var placeInLine = 1000;
          var amount = 19500;
          var amountBeans = ppval_order(this.interp, placeInLine, amount);
          expect(await this.marketplace.connect(user)._getDynamicOrderAmount(this.f, placeInLine, 0, amount)).to.be.equal(amountBeans);
        })
      })
    })

  })

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
          this.result = await this.marketplace.connect(user).createPodListing('0', '0', '100', '100000', '0', EXTERNAL);
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

    describe("Create Dynamic", async function () {
      beforeEach(async function () {
        this.interp = interpolate(cubicSet.xs, cubicSet.ys);
        this.function = [this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC];
      })
      it('Fails to List Unowned Plot', async function () {
        await expect(this.marketplace.connect(user).createDynamicPodListing('5000', '0', '1000', '100000', '0', INTERNAL, this.function)).to.be.revertedWith('Marketplace: Invalid Plot/Amount.');
      })

      it('Fails if already expired', async function () {
        await this.field.incrementTotalHarvestableE('2000');
        await expect(this.marketplace.connect(user).createDynamicPodListing('0', '0', '500', '100000', '0', INTERNAL, this.function)).to.be.revertedWith('Marketplace: Expired.');
      })

      it('Fails if amount is 0', async function () {
        await expect(this.marketplace.connect(user2).createDynamicPodListing('1000', '0', '0', '100000', '0', INTERNAL, this.function)).to.be.revertedWith('Marketplace: Invalid Plot/Amount.');
      })

      it('Fails if start + amount too large', async function () {
        await expect(this.marketplace.connect(user2).createDynamicPodListing('1000', '500', '1000', '100000', '0', INTERNAL, this.function)).to.be.revertedWith('Marketplace: Invalid Plot/Amount.');
      })

      describe("List full plot", async function () {
        beforeEach(async function () {
          this.result = await this.marketplace.connect(user).createDynamicPodListing('0', '0', '1000', '500000', '0', EXTERNAL, this.function);
        })

        it('Lists Plot properly', async function () {
          expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(this.result));
        })

        it('Emits event', async function () {
          await expect(this.result).to.emit(this.marketplace, 'DynamicPodListingCreated').withArgs(userAddress, 0, 0, '1000', 500000, 0, 0, this.function[0], this.function[1], this.function[2], this.function[3]);
        })
      })

      describe("List partial plot", async function () {
        beforeEach(async function () {
          this.interp = interpolate(cubicSet.xs, cubicSet.ys);
          this.function = [this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC];
          this.result = await this.marketplace.connect(user).createDynamicPodListing('0', '0', '100', '100000', '0', EXTERNAL, this.function);
          this.result = await this.marketplace.connect(user).createDynamicPodListing('0', '0', '500', '500000', '0', EXTERNAL, this.function);
        })

        it('Lists Plot properly', async function () {
          expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(this.result));
        })

        it('Emits event', async function () {
          await expect(this.result).to.emit(this.marketplace, 'DynamicPodListingCreated').withArgs(userAddress, 0, 0, '500', 500000, 0, 0, this.function[0], this.function[1], this.function[2], this.function[3]);
        })
      })

      describe("List partial plot from middle", async function () {
        beforeEach(async function () {
          this.interp = interpolate(cubicSet.xs, cubicSet.ys);
          this.function = [this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC];
          this.result = await this.marketplace.connect(user).createDynamicPodListing('0', '500', '500', '500000', '2000', INTERNAL, this.function);
        })

        it('Lists Plot properly', async function () {
          expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(this.result));
        })

        it('Emits event', async function () {
          await expect(this.result).to.emit(this.marketplace, 'DynamicPodListingCreated').withArgs(userAddress, 0, 500, '500', 500000, 2000, 1, this.function[0], this.function[1], this.function[2], this.function[3]);
        })
      })

      describe("Relist plot from middle", async function () {
        beforeEach(async function () {
          this.interp = interpolate(cubicSet.xs, cubicSet.ys);
          this.function = [this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC];
          this.result = await this.marketplace.connect(user).createDynamicPodListing('0', '0', '500', '500000', '0', INTERNAL, this.function);
          this.result = await this.marketplace.connect(user).createDynamicPodListing('0', '500', '100', '500000', '2000', INTERNAL, this.function);
        })

        it('Lists Plot properly', async function () {
          expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(this.result));
        })

        it('Emits event', async function () {
          await expect(this.result).to.emit(this.marketplace, 'PodListingCancelled').withArgs(userAddress, 0);
          await expect(this.result).to.emit(this.marketplace, 'DynamicPodListingCreated').withArgs(userAddress, 0, 500, '100', 500000, 2000, 1, this.function[0], this.function[1], this.function[2], this.function[3]);
        })
      })
    })

    describe("Fill", async function () {

      describe('revert', async function () {
        beforeEach(async function () {
          this.function = [emptyFunction.ranges, emptyFunction.values, emptyFunction.bases, emptyFunction.signs, CONSTANT];
          await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', EXTERNAL);
          this.listing = [userAddress, '0', '0', '1000', 500000, '0', EXTERNAL, this.function];
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
          
          const l = [userAddress, '0', '0', '500', '500000', '0', INTERNAL, [emptyFunction.ranges, emptyFunction.values, emptyFunction.bases, emptyFunction.signs, CONSTANT]]
          await this.marketplace.connect(user).createPodListing('0', '0', '500', '500000', '0', INTERNAL);
          await expect(this.marketplace.connect(user2).fillPodListing(l, 500, EXTERNAL)).to.be.revertedWith('Marketplace: Not enough pods in Listing');
        })
      })

      describe("Fill listing", async function () {
        beforeEach(async function () {
          this.function = [emptyFunction.ranges, emptyFunction.values, emptyFunction.bases, emptyFunction.signs, CONSTANT];
          this.listing = [userAddress, '0', '0', '1000', '500000', '0', EXTERNAL, this.function]
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
          this.function = [emptyFunction.ranges, emptyFunction.values, emptyFunction.bases, emptyFunction.signs, CONSTANT];
          this.listing = [userAddress, '0', '0', '1000', '500000', '0', EXTERNAL, this.function]
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
          expect(await this.marketplace.podListing(500)).to.equal(getHashFromListing(['0', '500', this.listing[4], this.listing[5], this.listing[6], this.listing[7]]));
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
          this.function = [emptyFunction.ranges, emptyFunction.values, emptyFunction.bases, emptyFunction.signs, CONSTANT];
          this.listing = [userAddress, '0', '500', '500', '500000', '0', EXTERNAL, this.function];
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
          expect(await this.marketplace.podListing(700)).to.equal(getHashFromListing(['0', '300', this.listing[4], this.listing[5], this.listing[6], this.listing[7]]));
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
          this.function = [emptyFunction.ranges, emptyFunction.values, emptyFunction.bases, emptyFunction.signs, CONSTANT];
          this.listing = [userAddress, '0', '500', '500', '500000', '0', EXTERNAL, this.function];
          await this.marketplace.connect(user).createPodListing('0', '500', '500', '500000', '0', EXTERNAL);
          this.amountBeansBuyingWith = 100;

          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)
          this.result = await this.marketplace.connect(user2).fillPodListing(this.listing, this.amountBeansBuyingWith, EXTERNAL);

          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          this.listing = [userAddress, '700', '0', '300', '500000', '0', EXTERNAL, this.function];

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
          expect(await this.marketplace.podListing(900)).to.equal(getHashFromListing(['0', '100', this.listing[4], this.listing[5], this.listing[6], this.listing[7]]));
        })
      })

      describe("Fill partial listing to wallet", async function () {
        beforeEach(async function () {
          this.function = [emptyFunction.ranges, emptyFunction.values, emptyFunction.bases, emptyFunction.signs, CONSTANT];
          this.listing = [userAddress, '0', '0', '1000', '500000', '0', INTERNAL, this.function];
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
          expect(await this.marketplace.podListing(500)).to.equal(getHashFromListing(['0', '500', this.listing[4], this.listing[5], this.listing[6], this.listing[7]]));
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

    describe("Fill Dynamic", async function () {

      describe('revert', async function () {
        beforeEach(async function () {
          this.set = {xs: [0,10000,20000], ys: [500000, 500000, 500000]};
          this.interp = interpolate(this.set.xs, this.set.ys);
          this.function = [this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC];
          await this.marketplace.connect(user).createDynamicPodListing('0', '0', '1000', '500000', '0', EXTERNAL, this.function);
          this.listing = [userAddress, '0', '0', '1000', 500000, '0', EXTERNAL, this.function];
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
          const l = [userAddress, '0', '0', '500', '500000', '0', INTERNAL, this.function]
          await this.marketplace.connect(user).createDynamicPodListing('0', '0', '500', '500000', '0', INTERNAL, this.function);
          await expect(this.marketplace.connect(user2).fillPodListing(l, 500, EXTERNAL)).to.be.revertedWith('Marketplace: Not enough pods in Listing');
        })
      })

      describe("Fill listing", async function () {
        beforeEach(async function () {
          this.set = {xs: [0,10000,20000], ys: [500000, 500000, 500000]};
          this.interp = interpolate(this.set.xs, this.set.ys);
          this.function = [this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC];
          this.listing = [userAddress, '0', '0', '1000', '500000', '0', EXTERNAL, this.function]
          await this.marketplace.connect(user).createDynamicPodListing('0', '0', '1000', '500000', '0', EXTERNAL, this.function);
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
          this.set = {xs: [0,10000,20000], ys: [500000, 500000, 500000]};
          this.interp = interpolate(this.set.xs, this.set.ys);
          this.function = [this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC];
          this.listing = [userAddress, '0', '0', '1000', '500000', '0', EXTERNAL, this.function]
          await this.marketplace.connect(user).createDynamicPodListing('0', '0', '1000', '500000', '0', EXTERNAL, this.function);
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
          expect(await this.marketplace.podListing(500)).to.equal(getHashFromListing(['0', '500', this.listing[4], this.listing[5], this.listing[6], this.listing[7]]));
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
          this.set = {xs: [0,10000,20000], ys: [500000, 500000, 500000]};
          this.interp = interpolate(this.set.xs, this.set.ys);
          this.function = [this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC];
          this.listing = [userAddress, '0', '500', '500', '500000', '0', EXTERNAL, this.function]
          await this.marketplace.connect(user).createDynamicPodListing('0', '500', '500', '500000', '0', EXTERNAL, this.function);
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
          expect(await this.marketplace.podListing(700)).to.equal(getHashFromListing(['0', '300', this.listing[4], this.listing[5], this.listing[6], this.listing[7]]));
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
          this.set = {xs: [0,10000,20000], ys: [500000, 500000, 500000]};
          this.interp = interpolate(this.set.xs, this.set.ys);
          this.function = [this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC];
          this.listing = [userAddress, '0', '500', '500', '500000', '0', EXTERNAL, this.function]
          await this.marketplace.connect(user).createDynamicPodListing('0', '500', '500', '500000', '0', EXTERNAL, this.function);
          this.amountBeansBuyingWith = 100;

          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)
          this.result = await this.marketplace.connect(user2).fillPodListing(this.listing, this.amountBeansBuyingWith, EXTERNAL);

          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          this.listing = [userAddress, '700', '0', '300', '500000', '0', EXTERNAL, this.function]

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
          expect(await this.marketplace.podListing(900)).to.equal(getHashFromListing(['0', '100', this.listing[4], this.listing[5], this.listing[6], this.listing[7]]));
        })
      })

      describe("Fill partial listing to wallet", async function () {
        beforeEach(async function () {
          this.set = {xs: [0,10000,20000], ys: [500000, 500000, 500000]};
          this.interp = interpolate(this.set.xs, this.set.ys);
          this.function = [this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC];
          this.listing = [userAddress, '0', '0', '1000', '500000', '0', INTERNAL, this.function]
          await this.marketplace.connect(user).createDynamicPodListing('0', '0', '1000', '500000', '0', INTERNAL, this.function);
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
          expect(await this.marketplace.podListing(500)).to.equal(getHashFromListing(['0', '500', this.listing[4], this.listing[5], this.listing[6], this.listing[7]]));
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

    describe("Cancel Dynamic", async function () {
      beforeEach(async function () {
        this.interp = interpolate(cubicSet.xs, cubicSet.ys);
        this.function = [this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC];
      })
      it('Re-list plot cancels and re-lists', async function () {
        result = await this.marketplace.connect(user).createDynamicPodListing('0', '0', '1000', '500000', '0', EXTERNAL, this.function);
        expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(result));
        result = await this.marketplace.connect(user).createDynamicPodListing('0', '0', '1000', '200000', '2000', INTERNAL, this.function);
        await expect(result).to.emit(this.marketplace, 'DynamicPodListingCreated').withArgs(userAddress, '0', 0, 1000, 200000, 2000, 1, this.function[0], this.function[1], this.function[2], this.function[3]);
        await expect(result).to.emit(this.marketplace, 'PodListingCancelled').withArgs(userAddress, '0');
        expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(result));
      })

      it('Reverts on Cancel Listing, not owned by user', async function () {
        await this.marketplace.connect(user).createDynamicPodListing('0', '0', '1000', '500000', '0', EXTERNAL, this.function);
        await expect(this.marketplace.connect(user2).cancelPodListing('0')).to.be.revertedWith('Marketplace: Listing not owned by sender.');
      })

      it('Cancels Listing, Emits Listing Cancelled Event', async function () {
        result = await this.marketplace.connect(user).createDynamicPodListing('0', '0', '1000', '500000', '2000', EXTERNAL, this.function);
        expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(result));
        result = (await this.marketplace.connect(user).cancelPodListing('0'));
        expect(await this.marketplace.podListing(0)).to.be.equal(ZERO_HASH);
        expect(result).to.emit(this.marketplace, 'PodListingCancelled').withArgs(userAddress, '0');
      })
    })
  })

  describe("Pod Order", async function () {

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
          expect(await this.marketplace.podOrderById(this.id)).to.equal('500');
          expect(await this.marketplace.podOrder(userAddress, '100000', '1000', [emptyFunction.ranges, emptyFunction.values, emptyFunction.bases, emptyFunction.signs, CONSTANT])).to.equal('500');
        })

        it('emits an event', async function () {
          expect(this.result).to.emit(this.marketplace, 'PodOrderCreated').withArgs(userAddress, this.id, '500', 100000, '1000')
        })
      })
    })

    describe("Create Dynamic", async function () {
      describe('revert', async function () {
        beforeEach(async function () {
          this.set = {xs: [0,10000,20000], ys: [100000, 100000, 100000]};
          this.interp = interpolate(this.set.xs, this.set.ys);
          this.function = [this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC];
        })
        it('Reverts if amount is 0', async function () {
          await expect(this.marketplace.connect(user2).createDynamicPodOrder('0', '100000', '100000', EXTERNAL, this.function)).to.be.revertedWith("Marketplace: Order amount must be > 0.");
        })
      })
      describe('create order', async function () {
        beforeEach(async function () {
          this.set = {xs: [0,10000,20000], ys: [100000, 100000, 100000]};
          this.interp = interpolate(this.set.xs, this.set.ys);
          this.function = [this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC];
          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address)
          this.result = await this.marketplace.connect(user).createDynamicPodOrder('500', '100000', '1000', EXTERNAL, this.function);
          this.id = await getDOrderId(this.result)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(this.marketplace.address)
        })

        it('Transfer Beans properly', async function () {
          expect(this.beanstalkBeanBalanceAfter.sub(this.beanstalkBeanBalance)).to.equal('500');
          expect(this.userBeanBalance.sub(this.userBeanBalanceAfter)).to.equal('500');
        })

        it('Creates the order', async function () {
          expect(await this.marketplace.podOrderById(this.id)).to.equal('500');
          expect(await this.marketplace.podOrder(userAddress, '100000', '1000', this.function)).to.equal('500');
        })

        it('emits an event', async function () {
          //for some reason this event isnt getting validated
          expect(this.result).to.emit(this.marketplace, 'DynamicPodOrderCreated').withArgs(userAddress, this.id, '500', 100000, '1000', this.function[0], this.function[1], this.function[2], this.function[3])
        })
      })
      
    })

    describe("Fill", async function () {
      beforeEach(async function () {
        this.function = [emptyFunction.ranges, emptyFunction.values, emptyFunction.bases, emptyFunction.signs, CONSTANT];
        this.result = await this.marketplace.connect(user).createPodOrder('50', '100000', '2500', EXTERNAL)
        this.id = await getOrderId(this.result)
        this.order = [userAddress, this.id, '100000', '2500', this.function];
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
          expect(await this.marketplace.podOrderById(this.id)).to.equal('25');
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

    describe("Fill Dynamic", async function() {
      beforeEach(async function () {
        this.set = {xs: [0,10000,20000], ys: [100000, 100000, 100000]};
        this.interp = interpolate(this.set.xs, this.set.ys);
        this.function = [this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC];
        this.result = await this.marketplace.connect(user).createDynamicPodOrder('50', '100000', '2500', EXTERNAL, this.function)
        this.id = await getDOrderId(this.result)
        this.order = [userAddress, this.id, '100000', '2500', this.function];
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
          expect(await this.marketplace.podOrderById(this.id)).to.equal('25'); //bean amt
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
          await this.marketplace.connect(user2).createDynamicPodListing('1000', '500', '500', '10000', '5000', EXTERNAL, this.function);
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
    
    describe("Cancel Dynamic", async function () {
      beforeEach(async function () {
        this.set = {xs: [0,10000,20000], ys: [100000, 100000, 100000]};
        this.interp = interpolate(this.set.xs, this.set.ys);
        this.function = [this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC];
        this.result = await this.marketplace.connect(user).createDynamicPodOrder('500', '100000', '1000', EXTERNAL, this.function)
        this.id = await getDOrderId(this.result)
      })

      describe('Cancel owner', async function () {
        beforeEach(async function () {
          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address)
          this.result = await this.marketplace.connect(user).cancelDynamicPodOrder('100000', '1000', EXTERNAL, this.function);
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
          this.result = await this.marketplace.connect(user).cancelDynamicPodOrder('100000', '1000', INTERNAL, this.function);
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

    describe("Plot Transfer", async function () {
      describe("reverts", async function () {
        it('doesn\'t sent to 0 address', async function () {
          await expect(this.marketplace.connect(user).transferPlot(userAddress, ZERO_ADDRESS, '0', '0', '100')).to.be.revertedWith('Field: Transfer to/from 0 address.')
        })
  
        it('Plot not owned by user.', async function () {
          await expect(this.marketplace.connect(user2).transferPlot(user2Address, userAddress, '0', '0', '100')).to.be.revertedWith('Field: Plot not owned by user.')
        })
  
        it('Allowance is 0 not owned by user.', async function () {
          await expect(this.marketplace.connect(user2).transferPlot(userAddress, user2Address, '0', '0', '100')).to.be.revertedWith('Field: Insufficient approval.')
        })
  
        it('Pod Range invalid', async function () {
          await expect(this.marketplace.connect(user).transferPlot(userAddress, userAddress, '0', '150', '100')).to.be.revertedWith('Field: Pod range invalid.')
        })
  
        it('transfers to self', async function () {
          await expect(this.marketplace.connect(user).transferPlot(userAddress, userAddress, '0', '0', '100')).to.be.revertedWith('Field: Cannot transfer Pods to oneself.')
        })
      })
  
      describe('transfers beginning of plot', async function () {
        beforeEach(async function () {
          this.result = await this.marketplace.connect(user).transferPlot(userAddress, user2Address, '0', '0', '100')
        })
  
        it('transfers the plot', async function () {
          expect(await this.field.plot(user2Address, '0')).to.be.equal('100')
          expect(await this.field.plot(userAddress, '0')).to.be.equal('0')
          expect(await this.field.plot(userAddress, '100')).to.be.equal('900')
        })
  
        it('emits plot transfer the plot', async function () {
          await expect(this.result).to.emit(this.marketplace, 'PlotTransfer').withArgs(userAddress, user2Address, '0', '100');
        })
      })
  
      describe('transfers with allowance', async function () {
        beforeEach(async function () {
          await expect(this.marketplace.connect(user).approvePods(user2Address, '100'))
          this.result = await this.marketplace.connect(user2).transferPlot(userAddress, user2Address, '0', '0', '100')
        })
  
        it('transfers the plot', async function () {
          expect(await this.field.plot(user2Address, '0')).to.be.equal('100')
          expect(await this.field.plot(userAddress, '0')).to.be.equal('0')
          expect(await this.field.plot(userAddress, '100')).to.be.equal('900')
          expect(await this.marketplace.allowancePods(userAddress, user2Address)).to.be.equal('0')
        })
  
        it('emits plot transfer the plot', async function () {
          await expect(this.result).to.emit(this.marketplace, 'PlotTransfer').withArgs(userAddress, user2Address, '0', '100');
        })
      })
  
      describe('transfers with existing pod listing', async function () {
        beforeEach(async function () {
          this.set = {xs: [0,10000,20000], ys: [100000, 100000, 100000]};
          this.interp = interpolate(this.set.xs, this.set.ys);
          this.function = [this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC];
          await this.marketplace.connect(user).createDynamicPodListing('0', '0', '1000', '500000', '0', EXTERNAL, this.function);
          this.result = await this.marketplace.connect(user).transferPlot(userAddress, user2Address, '0', '0', '100')
        })
  
        it('transfers the plot', async function () {
          expect(await this.field.plot(user2Address, '0')).to.be.equal('100')
          expect(await this.field.plot(userAddress, '0')).to.be.equal('0')
          expect(await this.field.plot(userAddress, '100')).to.be.equal('900')
          expect(await this.marketplace.podListing('0')).to.be.equal('0x0000000000000000000000000000000000000000000000000000000000000000')
        })
  
        it('emits plot transfer the plot', async function () {
          await expect(this.result).to.emit(this.marketplace, 'PlotTransfer').withArgs(userAddress, user2Address, '0', '100');
          await expect(this.result).to.emit(this.marketplace, 'PodListingCancelled').withArgs(userAddress, '0');
        })
      })
  
      describe('transfers with existing pod listing from other', async function () {
        beforeEach(async function () {
          this.set = {xs: [0,10000,20000], ys: [100000, 100000, 100000]};
          this.interp = interpolate(this.set.xs, this.set.ys);
          this.function = [this.interp.ranges, this.interp.values, this.interp.basesPacked, this.interp.signsPacked, DYNAMIC];
          await this.marketplace.connect(user).createDynamicPodListing('0', '0', '1000', '500000', '0', EXTERNAL, this.function);
          this.result = await expect(this.marketplace.connect(user).approvePods(user2Address, '100'))
          this.result = await this.marketplace.connect(user2).transferPlot(userAddress, user2Address, '0', '0', '100')
        })
  
        it('transfers the plot', async function () {
          expect(await this.field.plot(user2Address, '0')).to.be.equal('100')
          expect(await this.field.plot(userAddress, '0')).to.be.equal('0')
          expect(await this.field.plot(userAddress, '100')).to.be.equal('900')
          expect(await this.marketplace.podListing('0')).to.be.equal('0x0000000000000000000000000000000000000000000000000000000000000000')
        })
  
        it('removes the listing', async function () {
          expect(await this.marketplace.podListing('0')).to.be.equal(ZERO_HASH)
        })
  
        it('emits events', async function () {
          await expect(this.result).to.emit(this.marketplace, 'PlotTransfer').withArgs(userAddress, user2Address, '0', '100');
          await expect(this.result).to.emit(this.marketplace, 'PodListingCancelled').withArgs(userAddress, '0');
        })
      })
    })

  })
  
})
