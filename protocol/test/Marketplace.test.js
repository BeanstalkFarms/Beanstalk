const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { Fixed, Dynamic } = require('./utils/priceTypes.js')
const { interpolatePoints } = require('./utils/interpolater.js')
const { getNumPieces, evaluatePolynomial, evaluatePolynomialIntegration, getAmountOrder, getValueArray } = require('./utils/libPolynomialHelpers.js')

const { expect, use } = require("chai");
const { waffleChai } = require("@ethereum-waffle/chai");
use(waffleChai);
const { deploy } = require('../scripts/deploy.js')
const { BEAN, ZERO_ADDRESS } = require('./utils/constants')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { ethers } = require('hardhat');

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
    await this.field.connect(user).sow('1000', '0', EXTERNAL);
    await this.field.connect(user2).sow('1000', '0', EXTERNAL);
  })

  const getHash = async function (tx) {
    let receipt = await tx.wait();
    var args = (receipt.events?.filter((x) => { return x.event == ("PodListingCreated")}))[0]?.args;
    if(args.pricingType == Dynamic) {
      return ethers.utils.solidityKeccak256(
        ['uint256', 'uint256', 'uint24', 'uint256', 'uint256', 'bool', 'bytes'],
        [args.start, args.amount, args.pricePerPod, args.maxHarvestableIndex, args.minFillAmount, args.mode == EXTERNAL, args.pricingFunction]
      );
    } else if(args.minFillAmount > 0) {
      return ethers.utils.solidityKeccak256(
        ['uint256', 'uint256', 'uint24', 'uint256', 'uint256', 'bool'],
        [args.start, args.amount, args.pricePerPod, args.maxHarvestableIndex, args.minFillAmount, args.mode == EXTERNAL]
      );
    } else {
      return ethers.utils.solidityKeccak256(
        ['uint256', 'uint256', 'uint24', 'uint256', 'bool'],
        [args.start, args.amount, args.pricePerPod, args.maxHarvestableIndex, args.mode == EXTERNAL]
      );
    } 
  }

  const getHashFromDynamicListing = function (l) {
     //listing input must contain 'minFillAmount' param
    l[5] = (l[5] == EXTERNAL);
    return ethers.utils.solidityKeccak256(['uint256', 'uint256', 'uint24', 'uint256', 'uint256', 'bool', 'bytes'], l);
  }

  const getHashFromListing = function (l) {
    //listing input must contain 'minFillAmount' param

    l[5] = (l[5] == EXTERNAL);
    if (l[4] > 0) {
      return ethers.utils.solidityKeccak256(['uint256', 'uint256', 'uint24', 'uint256', 'uint256', 'bool'], l);
    } else {
      l.splice(4,1);
      return ethers.utils.solidityKeccak256(['uint256', 'uint256', 'uint24', 'uint256', 'bool'], l);
    }
  }

  const getOrderId = async function (tx) {
    let receipt = await tx.wait();
    let idx = (receipt.events?.filter((x) => { return x.event == ("PodOrderCreated") }))[0].args.id;
    return idx;
  }

  const staticset_16Pieces_500000 = {
    xs: [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000, 13000, 14000, 15000],
    ys: [500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000]
  }

  const staticset_64Pieces_500000 = {
    xs: [0 , 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000, 13000, 14000, 15000, 16000, 17000, 18000, 19000, 20000, 21000, 22000, 23000, 24000, 25000, 26000, 27000, 28000, 29000, 30000, 31000, 32000, 33000, 34000, 35000, 36000, 37000, 38000, 39000, 40000, 41000, 42000, 43000, 44000, 45000, 46000, 47000, 48000, 49000, 50000, 51000, 52000, 53000, 54000, 55000, 56000, 57000, 58000, 59000, 60000, 61000, 62000, 63000],
    ys: [500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000]
  }

  const staticset_4Pieces_100000 = {
    xs: [0  , 5000  , 6000  , 7000],
    ys: [100000, 100000, 100000, 100000]
  }

  const set_16Pieces = {
    xs: [100, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000],
    ys: [900000, 900000, 900000, 900000, 900000, 800000, 800000, 800000, 800000, 775000, 750000, 725000, 700000, 675000, 650000, 625000]
  }

  const set_13Pieces = {
    xs: [1000  , 5000  , 6000  , 7000  , 8000  , 9000  , 10000 , 11000 , 12000 , 13000 , 14000 , 18000 , 20000 ],
    ys: [1000000, 990000, 980000, 950000, 890000, 790000, 680000, 670000, 660000, 570000, 470000, 450000, 430000]
  }

  const hugeValueSet_13Pieces = {
    xs: [10000000000000, 50000000000000, 60000000000000, 70000000000000, 80000000000000, 90000000000000, 100000000000000, 110000000000000, 120000000000000, 130000000000000, 140000000000000, 180000000000000, 200000000000000],
    ys: [1000000, 990000, 980000, 950000, 890000, 790000, 680000, 670000, 660000, 570000, 470000, 450000, 430000]
  }

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("Functions", async function () {

    describe("Piece Index Search", async function () {

      describe("4 Piece Index Search", async function () {
        beforeEach(async function () {
          this.f = interpolatePoints([100, 200, 300, 400], [0, 0, 0, 0]);
        })
        it("correctly finds interval at 0", async function () {
          expect(await this.marketplace.connect(user).findPiecewiseIndex(this.f.packedFunction, '0', getNumPieces(this.f.breakpoints, 4) - 1)).to.be.equal(0);
        })

        it("finds interval between breakpoints", async function () {
          expect(await this.marketplace.connect(user).findPiecewiseIndex(this.f.packedFunction, '150', getNumPieces(this.f.breakpoints, 4) - 1)).to.be.equal(0);
          expect(await this.marketplace.connect(user).findPiecewiseIndex(this.f.packedFunction, '250', getNumPieces(this.f.breakpoints, 4) - 1)).to.be.equal(1);
          expect(await this.marketplace.connect(user).findPiecewiseIndex(this.f.packedFunction, '350', getNumPieces(this.f.breakpoints, 4) - 1)).to.be.equal(2);
        })
        it("finds interval at breakpoints", async function () {
          expect(await this.marketplace.connect(user).findPiecewiseIndex(this.f.packedFunction, '100', getNumPieces(this.f.breakpoints, 4) - 1)).to.be.equal(0);
          expect(await this.marketplace.connect(user).findPiecewiseIndex(this.f.packedFunction, '200', getNumPieces(this.f.breakpoints, 4) - 1)).to.be.equal(1);
          expect(await this.marketplace.connect(user).findPiecewiseIndex(this.f.packedFunction, '300', getNumPieces(this.f.breakpoints, 4) - 1)).to.be.equal(2);
        })
        it("finds interval at end", async function () {
          expect(await this.marketplace.connect(user).findPiecewiseIndex(this.f.packedFunction, '400', getNumPieces(this.f.breakpoints, 4) - 1)).to.be.equal(2);
        })
        it("finds interval past end", async function (){
          expect(await this.marketplace.connect(user).findPiecewiseIndex(this.f.packedFunction, '401', getNumPieces(this.f.breakpoints, 4) - 1)).to.be.equal(2);
        })
      })

      describe("16 Piece Index Search", async function () {
        beforeEach(async function () {
          this.f = interpolatePoints(set_16Pieces.xs, set_16Pieces.ys);
        })
        it("correctly finds interval at 0", async function () {
          expect(await this.marketplace.connect(user).findPiecewiseIndex(this.f.packedFunction, '0', getNumPieces(this.f.breakpoints, 16) - 1)).to.be.equal(0);
        })

        it("finds interval between breakpoints", async function () {
          expect(await this.marketplace.connect(user).findPiecewiseIndex(this.f.packedFunction, '250', getNumPieces(this.f.breakpoints, 16) - 1)).to.be.equal(1);
          expect(await this.marketplace.connect(user).findPiecewiseIndex(this.f.packedFunction, '420', getNumPieces(this.f.breakpoints, 16) - 1)).to.be.equal(2);
          expect(await this.marketplace.connect(user).findPiecewiseIndex(this.f.packedFunction, '2900', getNumPieces(this.f.breakpoints, 16) - 1)).to.be.equal(14);
        })
        it("finds interval at breakpoints", async function () {
          expect(await this.marketplace.connect(user).findPiecewiseIndex(this.f.packedFunction, '200', getNumPieces(this.f.breakpoints, 16) - 1)).to.be.equal(1);
          expect(await this.marketplace.connect(user).findPiecewiseIndex(this.f.packedFunction, '400', getNumPieces(this.f.breakpoints, 16) - 1)).to.be.equal(2);
          expect(await this.marketplace.connect(user).findPiecewiseIndex(this.f.packedFunction, '2600', getNumPieces(this.f.breakpoints, 16) - 1)).to.be.equal(13);
        })
        it("finds interval at end", async function () {
          expect(await this.marketplace.connect(user).findPiecewiseIndex(this.f.packedFunction, '3000', getNumPieces(this.f.breakpoints, 16) - 1)).to.be.equal(14);
        })
        it("finds interval past end", async function (){
          expect(await this.marketplace.connect(user).findPiecewiseIndex(this.f.packedFunction, '3001', getNumPieces(this.f.breakpoints, 16) - 1)).to.be.equal(14);
        })
      })

      describe("64 Piece Index Search", async function () {
        beforeEach(async function () {
          this.f = interpolatePoints(staticset_64Pieces_500000.xs, staticset_64Pieces_500000.ys);
        })
        it("correctly finds interval at 0", async function () {
          expect(await this.marketplace.connect(user).findPiecewiseIndex(this.f.packedFunction, '0', getNumPieces(this.f.breakpoints, 64) - 1)).to.be.equal(0);
        })

        it("finds interval between breakpoints", async function () {
          expect(await this.marketplace.connect(user).findPiecewiseIndex(this.f.packedFunction, '1250', getNumPieces(this.f.breakpoints, 64) - 1)).to.be.equal(1);
          expect(await this.marketplace.connect(user).findPiecewiseIndex(this.f.packedFunction, '2420', getNumPieces(this.f.breakpoints, 64) - 1)).to.be.equal(2);
          expect(await this.marketplace.connect(user).findPiecewiseIndex(this.f.packedFunction, '45500', getNumPieces(this.f.breakpoints, 64) - 1)).to.be.equal(45);
        })
        it("finds interval at breakpoints", async function () {
          expect(await this.marketplace.connect(user).findPiecewiseIndex(this.f.packedFunction, '1000', getNumPieces(this.f.breakpoints, 64) - 1)).to.be.equal(1);
          expect(await this.marketplace.connect(user).findPiecewiseIndex(this.f.packedFunction, '2000', getNumPieces(this.f.breakpoints, 64) - 1)).to.be.equal(2);
          expect(await this.marketplace.connect(user).findPiecewiseIndex(this.f.packedFunction, '13000', getNumPieces(this.f.breakpoints, 64) - 1)).to.be.equal(13);
        })
        it("finds interval at end", async function () {
          expect(await this.marketplace.connect(user).findPiecewiseIndex(this.f.packedFunction, '63000', getNumPieces(this.f.breakpoints, 64) - 1)).to.be.equal(62);
        })
        it("finds interval past end", async function (){
          expect(await this.marketplace.connect(user).findPiecewiseIndex(this.f.packedFunction, '63001', getNumPieces(this.f.breakpoints, 64) - 1)).to.be.equal(62);
        })
      })

    })

    describe("Polynomial Evaluation", async function () {
    
      describe("Evaluate Normal Values", async function () {
        describe("evaluation at piecewise breakpoints", async function () {
          beforeEach(async function () {
            this.f = interpolatePoints(set_13Pieces.xs, set_13Pieces.ys);
          })
          
          it("first breakpoint", async function () {
            const x = 1000;
            expect(await this.marketplace.connect(user).evaluatePolynomialPiecewise(this.f.packedFunction, x)).to.be.equal(set_13Pieces.ys[0]);
          })

          it("second breakpoint", async function () {  
            const x = 5000;
            expect(await this.marketplace.connect(user).evaluatePolynomialPiecewise(this.f.packedFunction, x)).to.be.equal(set_13Pieces.ys[1]);
          })

          it("second last breakpoint", async function () {  
            var x = 18000;
            expect(await this.marketplace.connect(user).evaluatePolynomialPiecewise(this.f.packedFunction, x)).to.be.equal(set_13Pieces.ys[11]);
          })

          it("last breakpoint", async function () {  
            const x = 20000;
            expect(await this.marketplace.connect(user).evaluatePolynomialPiecewise(this.f.packedFunction, x)).to.be.equal(set_13Pieces.ys[12]);
          })
        })
        describe("evaluation between piecewise breakpoints", async function () {
          beforeEach(async function () {
            this.f = interpolatePoints(set_13Pieces.xs, set_13Pieces.ys);
          })
          it("within first interval", async function () {
            const x = 2500;
            const pieceIndex = 0;
            expect(await this.marketplace.connect(user).evaluatePolynomialPiecewise(this.f.packedFunction, x)).to.be.equal(evaluatePolynomial(this.f, x, pieceIndex));
          })
          it("within second interval", async function () {
            const x = 5750;
            const pieceIndex = 1;
            expect(await this.marketplace.connect(user).evaluatePolynomialPiecewise(this.f.packedFunction, x)).to.be.equal(evaluatePolynomial(this.f, x, pieceIndex));
          })
          it("within second last interval", async function () {
            const x = 14999;
            const pieceIndex = 10;
            expect(await this.marketplace.connect(user).evaluatePolynomialPiecewise(this.f.packedFunction, x)).to.be.equal(evaluatePolynomial(this.f, x, pieceIndex));
          })
          it("within last interval", async function () {
            const x = 19410;
            const pieceIndex = 11;
            expect(await this.marketplace.connect(user).evaluatePolynomialPiecewise(this.f.packedFunction, x)).to.be.equal(evaluatePolynomial(this.f, x, pieceIndex));
          })
        })
      })

      describe("Evaluate Huge Values", async function () {
        describe("evaluation at piecewise breakpoints", async function () {
          beforeEach(async function () {
            this.f = interpolatePoints(hugeValueSet_13Pieces.xs, hugeValueSet_13Pieces.ys);
          })
          
          it("correctly evaluates at first breakpoint", async function () {
            const x = 10000000000000;
            expect(await this.marketplace.connect(user).evaluatePolynomialPiecewise(this.f.packedFunction, x)).to.be.equal(hugeValueSet_13Pieces.ys[0]);
          })

          it("correctly evaluates at second breakpoint", async function () {  
            const x = 50000000000000;
            expect(await this.marketplace.connect(user).evaluatePolynomialPiecewise(this.f.packedFunction, x)).to.be.equal(hugeValueSet_13Pieces.ys[1]);
          })

          it("correctly evaluates at second last breakpoint", async function () {  
            const x = 180000000000000;
            expect(await this.marketplace.connect(user).evaluatePolynomialPiecewise(this.f.packedFunction, x)).to.be.equal(hugeValueSet_13Pieces.ys[11]);
          })

          it("correctly evaluates at last breakpoint", async function () {  
            const x = 200000000000000;
            expect(await this.marketplace.connect(user).evaluatePolynomialPiecewise(this.f.packedFunction, x)).to.be.equal(hugeValueSet_13Pieces.ys[12]);
          })
        })
        describe("evaluation in between piecewise breakpoints", async function () {
          beforeEach(async function () {
            this.f = interpolatePoints(hugeValueSet_13Pieces.xs, hugeValueSet_13Pieces.ys);
          })
          it("correctly evaluates within first interval", async function () {
            const x = 14567200000500;
            const pieceIndex = 0;
            expect(await this.marketplace.connect(user).evaluatePolynomialPiecewise(this.f.packedFunction, x)).to.be.equal(evaluatePolynomial(this.f, x, pieceIndex));
          })
          it("correctly evaluates within second interval", async function () {
            const x = 59555200441200;
            const pieceIndex = 1;
            expect(await this.marketplace.connect(user).evaluatePolynomialPiecewise(this.f.packedFunction, x)).to.be.equal(evaluatePolynomial(this.f, x, pieceIndex));
          })
          it("correctly evaluates within second last interval", async function () {
            const x = 140567200000500;
            const pieceIndex = 10;
            expect(await this.marketplace.connect(user).evaluatePolynomialPiecewise(this.f.packedFunction, x)).to.be.equal(evaluatePolynomial(this.f, x, pieceIndex));
          })
          it("correctly evaluates within last interval", async function () {
            const x = 185069299999500;
            const pieceIndex = 11;
            expect(await this.marketplace.connect(user).evaluatePolynomialPiecewise(this.f.packedFunction, x)).to.be.equal(evaluatePolynomial(this.f, x, pieceIndex));
          })
        })
      })
    })

    describe("Polynomial Integral Evaluation", async function () {

      describe("Integrate Normal Values", async function () {
        describe("correctly evaluates a single polynomial integration", async function () {
          beforeEach(async function () {
            this.f = interpolatePoints(set_13Pieces.xs, set_13Pieces.ys);
          })
  
          it("first interval", async function () {
            const start = 1000;
            const end = 4000;
            const pieceIndex = 0;
            expect(await this.marketplace.connect(user).evaluatePolynomialIntegrationPiecewise(this.f.packedFunction, start, end)).to.be.equal(evaluatePolynomialIntegration(this.f, start, end, pieceIndex));
          })
  
          it("second interval", async function () {
            const start = 5200;
            const end = 5999;
            const pieceIndex = 1;
            expect(await this.marketplace.connect(user).evaluatePolynomialIntegrationPiecewise(this.f.packedFunction, start, end)).to.be.equal(evaluatePolynomialIntegration(this.f, start, end, pieceIndex));
          })
          
          it("second last interval", async function () {
            const start = 14500;
            const end = 16603;
            const pieceIndex = 10;
            expect(await this.marketplace.connect(user).evaluatePolynomialIntegrationPiecewise(this.f.packedFunction, start, end)).to.be.equal(evaluatePolynomialIntegration(this.f, start, end, pieceIndex));
          })
          it("last interval", async function () {
            const start = 18100;
            const end = 19004;
            const pieceIndex = 11;
            expect(await this.marketplace.connect(user).evaluatePolynomialIntegrationPiecewise(this.f.packedFunction, start, end)).to.be.equal(evaluatePolynomialIntegration(this.f, start, end, pieceIndex));
          })
        })
      })

      describe("Integrate Huge Values", async function () {
        describe("correctly evaluates a single polynomial integration", async function () {
          beforeEach(async function () {
            this.f = interpolatePoints(hugeValueSet_13Pieces.xs, hugeValueSet_13Pieces.ys);
          })
  
          it("first interval", async function () {
            const start = 10000000000000; 
            const end = 12000000000000; 
            const pieceIndex = 0; 
            expect(await this.marketplace.connect(user).evaluatePolynomialIntegrationPiecewise(this.f.packedFunction, start, end)).to.be.equal(evaluatePolynomialIntegration(this.f, start, end, pieceIndex));
          })
  
          it("second interval", async function () {
            const start = 55000000000000;
            const end = 58000000000000;
            const pieceIndex = 1;
            expect(await this.marketplace.connect(user).evaluatePolynomialIntegrationPiecewise(this.f.packedFunction, start, end)).to.be.equal(evaluatePolynomialIntegration(this.f, start, end, pieceIndex));
          })
          
          it("second last interval", async function () {
            const start = 145000000000000;
            const end = 178000000000016;
            const pieceIndex = 10;
            expect(await this.marketplace.connect(user).evaluatePolynomialIntegrationPiecewise(this.f.packedFunction, start, end)).to.be.equal(evaluatePolynomialIntegration(this.f, start, end, pieceIndex));
          })
          it("last interval", async function () {
            const start = 180000000000000;
            const end = 195999999999990; //this overflows easily 
            const pieceIndex = 11;
            expect(await this.marketplace.connect(user).evaluatePolynomialIntegrationPiecewise(this.f.packedFunction, start, end)).to.be.equal(evaluatePolynomialIntegration(this.f, start, end, pieceIndex));
          })
        })
      })
    })

    describe("Piecewise Polynomial Integral Evaluation", async function () {

      describe("Integrate Normal Values", async function () {
        describe("correctly evaluates a polynomial integration over two pieces", async function () {
          beforeEach(async function () {
            this.f = interpolatePoints(set_13Pieces.xs, set_13Pieces.ys);
          })
  
          it("first to second interval", async function () {
            const startPlaceInLine = 1000;
            const amountPodsFromOrder = 4500;
            const orderBeanAmount = getAmountOrder(this.f, startPlaceInLine, amountPodsFromOrder);
            expect(await this.marketplace.connect(user).getAmountBeansToFillOrderV2(startPlaceInLine, amountPodsFromOrder, this.f.packedFunction)).to.be.equal(orderBeanAmount);
          })
  
          it("second to third interval", async function () {
            const startPlaceInLine = 5000;
            const amountPodsFromOrder = 1500;
            const orderBeanAmount = getAmountOrder(this.f, startPlaceInLine, amountPodsFromOrder);
            expect(await this.marketplace.connect(user).getAmountBeansToFillOrderV2(startPlaceInLine, amountPodsFromOrder, this.f.packedFunction)).to.be.equal(orderBeanAmount);
          })
          
          it("fourth to fifth interval", async function () {
            const startPlaceInLine = 7000;
            const amountPodsFromOrder = 1500;
            const orderBeanAmount = getAmountOrder(this.f, startPlaceInLine, amountPodsFromOrder);
            expect(await this.marketplace.connect(user).getAmountBeansToFillOrderV2(startPlaceInLine, amountPodsFromOrder, this.f.packedFunction)).to.be.equal(orderBeanAmount);
          })

          it("eleventh to twelfth interval", async function () {
            const startPlaceInLine = 14000;
            const amountPodsFromOrder = 4500;
            const orderBeanAmount = getAmountOrder(this.f, startPlaceInLine, amountPodsFromOrder);
            expect(await this.marketplace.connect(user).getAmountBeansToFillOrderV2(startPlaceInLine, amountPodsFromOrder, this.f.packedFunction)).to.be.equal(orderBeanAmount);
          })

          it("twelfth to past last interval", async function () {
            const startPlaceInLine = 18000;
            const amountPodsFromOrder = 4500;
            const orderBeanAmount = getAmountOrder(this.f, startPlaceInLine, amountPodsFromOrder);
            expect(await this.marketplace.connect(user).getAmountBeansToFillOrderV2(startPlaceInLine, amountPodsFromOrder, this.f.packedFunction)).to.be.equal(orderBeanAmount);
          })
        })

        describe("correctly evaluates a polynomial integration over multiple pieces", async function () {
          beforeEach(async function () {
            this.f = interpolatePoints(set_13Pieces.xs, set_13Pieces.ys);
          })
  
          it("first to third interval", async function () {
            const startPlaceInLine = 1000;
            const amountPodsFromOrder = 5500;
            const orderBeanAmount = getAmountOrder(this.f, startPlaceInLine, amountPodsFromOrder);
            expect(await this.marketplace.connect(user).getAmountBeansToFillOrderV2(startPlaceInLine, amountPodsFromOrder, this.f.packedFunction)).to.be.equal(orderBeanAmount);
          })
  
          it("second to fourth interval", async function () {
            const startPlaceInLine = 5000;
            const amountPodsFromOrder = 2500;
            const orderBeanAmount = getAmountOrder(this.f, startPlaceInLine, amountPodsFromOrder);
            expect(await this.marketplace.connect(user).getAmountBeansToFillOrderV2(startPlaceInLine, amountPodsFromOrder, this.f.packedFunction)).to.be.equal(orderBeanAmount);
          })
          
          it("fourth to sixth interval", async function () {
            const startPlaceInLine = 7000;
            const amountPodsFromOrder = 2500;
            const orderBeanAmount = getAmountOrder(this.f, startPlaceInLine, amountPodsFromOrder);
            expect(await this.marketplace.connect(user).getAmountBeansToFillOrderV2(startPlaceInLine, amountPodsFromOrder, this.f.packedFunction)).to.be.equal(orderBeanAmount);
          })

          it("tenth to twelfth interval", async function () {
            const startPlaceInLine = 13000;
            const amountPodsFromOrder = 5500;
            const orderBeanAmount = getAmountOrder(this.f, startPlaceInLine, amountPodsFromOrder);
            expect(await this.marketplace.connect(user).getAmountBeansToFillOrderV2(startPlaceInLine, amountPodsFromOrder, this.f.packedFunction)).to.be.equal(orderBeanAmount);
          })

          it("eleventh to past last interval", async function () {
            const startPlaceInLine = 14000;
            const amountPodsFromOrder = 8500;
            const orderBeanAmount = getAmountOrder(this.f, startPlaceInLine, amountPodsFromOrder);
            expect(await this.marketplace.connect(user).getAmountBeansToFillOrderV2(startPlaceInLine, amountPodsFromOrder, this.f.packedFunction)).to.be.equal(orderBeanAmount);
          })
        })

        describe("correctly evaluates a polynomial integration over all pieces", async function () {
          beforeEach(async function () {
            this.f = interpolatePoints(set_13Pieces.xs, set_13Pieces.ys);
          })
  
          it("first to last interval", async function () {
            const startPlaceInLine = 1000;
            const amountPodsFromOrder = 18500;
            const orderBeanAmount = getAmountOrder(this.f, startPlaceInLine, amountPodsFromOrder);
            expect(await this.marketplace.connect(user).getAmountBeansToFillOrderV2(startPlaceInLine, amountPodsFromOrder, this.f.packedFunction)).to.be.equal(orderBeanAmount);
          })
  
          it("first to past last interval", async function () {
            const startPlaceInLine = 1000;
            const amountPodsFromOrder = 19500;
            const orderBeanAmount = getAmountOrder(this.f, startPlaceInLine, amountPodsFromOrder);
            expect(await this.marketplace.connect(user).getAmountBeansToFillOrderV2(startPlaceInLine, amountPodsFromOrder, this.f.packedFunction)).to.be.equal(orderBeanAmount);
          })
        })
      })

      describe("Huge Values", async function () {
        describe("correctly evaluates a polynomial integration over two pieces", async function () {
          beforeEach(async function () {
            this.f = interpolatePoints(hugeValueSet_13Pieces.xs, hugeValueSet_13Pieces.ys);
          })
  
          it("first to second interval", async function () {
            const startPlaceInLine = 10000000000000;
            const amountPodsFromOrder = 45000000000000;
            const orderBeanAmount = getAmountOrder(this.f, startPlaceInLine, amountPodsFromOrder);
            expect(await this.marketplace.connect(user).getAmountBeansToFillOrderV2(startPlaceInLine, amountPodsFromOrder, this.f.packedFunction)).to.be.equal(orderBeanAmount);
          })
  
          it("second to third interval", async function () {
            const startPlaceInLine = 50000000000000;
            const amountPodsFromOrder = 15000000000000;
            const orderBeanAmount = getAmountOrder(this.f, startPlaceInLine, amountPodsFromOrder);
            expect(await this.marketplace.connect(user).getAmountBeansToFillOrderV2(startPlaceInLine, amountPodsFromOrder, this.f.packedFunction)).to.be.equal(orderBeanAmount);
          })
          
          it("eleventh to twelfth interval", async function () {
            const startPlaceInLine = 130000000000000;
            const amountPodsFromOrder = 15000000000000;
            const orderBeanAmount = getAmountOrder(this.f, startPlaceInLine, amountPodsFromOrder);
            expect(await this.marketplace.connect(user).getAmountBeansToFillOrderV2(startPlaceInLine, amountPodsFromOrder, this.f.packedFunction)).to.be.equal(orderBeanAmount);
          })
        })

        describe("correctly evaluates a polynomial integration over multiple pieces", async function () {
          beforeEach(async function () {
            this.f = interpolatePoints(hugeValueSet_13Pieces.xs, hugeValueSet_13Pieces.ys);
          })
  
          it("first to third interval", async function () {
            const startPlaceInLine = 10000000000000;
            const amountPodsFromOrder = 55000000000000;
            const orderBeanAmount = getAmountOrder(this.f, startPlaceInLine, amountPodsFromOrder);
            expect(await this.marketplace.connect(user).getAmountBeansToFillOrderV2(startPlaceInLine, amountPodsFromOrder, this.f.packedFunction)).to.be.equal(orderBeanAmount);
          })
  
          it("third to fifth interval", async function () {
            const startPlaceInLine = 60000000000000;
            const amountPodsFromOrder = 25000000000000;
            const orderBeanAmount = getAmountOrder(this.f, startPlaceInLine, amountPodsFromOrder);
            expect(await this.marketplace.connect(user).getAmountBeansToFillOrderV2(startPlaceInLine, amountPodsFromOrder, this.f.packedFunction)).to.be.equal(orderBeanAmount);
          })
          
          it("eleventh to last interval", async function () {
            const startPlaceInLine = 130000000000000;
            const amountPodsFromOrder = 55000000000000;
            const orderBeanAmount = getAmountOrder(this.f, startPlaceInLine, amountPodsFromOrder);
            expect(await this.marketplace.connect(user).getAmountBeansToFillOrderV2(startPlaceInLine, amountPodsFromOrder, this.f.packedFunction)).to.be.equal(orderBeanAmount);
          })
        })

        describe("correctly evaluates a polynomial integration over all pieces", async function () {
          beforeEach(async function () {
            this.f = interpolatePoints(hugeValueSet_13Pieces.xs, hugeValueSet_13Pieces.ys);
          })
  
          it("first to last interval", async function () {
            const startPlaceInLine = 10000000000000;
            const amountPodsFromOrder = 185000000000000;
            const orderBeanAmount = getAmountOrder(this.f, startPlaceInLine, amountPodsFromOrder);
            expect(await this.marketplace.connect(user).getAmountBeansToFillOrderV2(startPlaceInLine, amountPodsFromOrder, this.f.packedFunction)).to.be.equal(orderBeanAmount);
          })
        })
      })
    })
  })

  describe("Pod Listings", async function () {
    describe("Fixed Price", async function () {
      describe("Create", async function () {
        it('Fails to List Unowned Plot', async function () {
          await expect(this.marketplace.connect(user).createPodListing('5000', '0', '1000', '100000', '0', '0', INTERNAL)).to.be.revertedWith('Marketplace: Invalid Plot/Amount.');
        })
  
        it('Fails if already expired', async function () {
          await this.field.incrementTotalHarvestableE('2000');
          await expect(this.marketplace.connect(user).createPodListing('0', '0', '500', '100000', '0', '0', INTERNAL)).to.be.revertedWith('Marketplace: Expired.');
        })
  
        it('Fails if amount is 0', async function () {
          await expect(this.marketplace.connect(user2).createPodListing('1000', '0', '0', '100000', '0', '0', INTERNAL)).to.be.revertedWith('Marketplace: Invalid Plot/Amount.');
        })
  
        it('fails if price is 0', async function () {
          await expect(this.marketplace.connect(user2).createPodListing('1000', '0', '1000', '0', '0', '0', INTERNAL)).to.be.revertedWith('Marketplace: Pod price must be greater than 0.');
        })
  
        it('Fails if start + amount too large', async function () {
          await expect(this.marketplace.connect(user2).createPodListing('1000', '500', '1000', '100000', '0', '0',INTERNAL)).to.be.revertedWith('Marketplace: Invalid Plot/Amount.');
        })
  
        describe("List full plot", async function () {
          beforeEach(async function () {
            this.result = await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', '0', EXTERNAL);
          })
  
          it('Lists Plot properly', async function () {
            expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(this.result));
          })
  
          it('Emits event', async function () {
            await expect(this.result).to.emit(this.marketplace, 'PodListingCreated').withArgs(userAddress, '0', '0', '1000', 500000, '0', '0', "0x", 0, Fixed);
          })
        })

        describe("List full plot with minimum amount", async function () {
          beforeEach(async function () {
            this.result = await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', '100', EXTERNAL);
          })
  
          it('Lists Plot properly', async function () {
            expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(this.result));
          })
  
          it('Emits event', async function () {
            await expect(this.result).to.emit(this.marketplace, 'PodListingCreated').withArgs(userAddress, '0', '0', '1000', 500000, '0', '100', "0x", 0, Fixed);
          })
        })

        describe("List partial plot", async function () {
          beforeEach(async function () {
            this.result = await this.marketplace.connect(user).createPodListing('0', '0', '100', '100000', '0', '0', EXTERNAL);
            this.result = await this.marketplace.connect(user).createPodListing('0', '0', '500', '500000', '0', '0', EXTERNAL);
          })
  
          it('Lists Plot properly', async function () {
            expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(this.result));
          })
  
          it('Emits event', async function () {
            await expect(this.result).to.emit(this.marketplace, 'PodListingCreated').withArgs(userAddress, 0, 0, '500', 500000, 0, '0', "0x", 0, Fixed);
          })
        })
  
        describe("List partial plot from middle", async function () {
          beforeEach(async function () {
            this.result = await this.marketplace.connect(user).createPodListing('0', '500', '500', '500000', '2000', '0', INTERNAL);
          })
  
          it('Lists Plot properly', async function () {
            expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(this.result));
          })
  
          it('Emits event', async function () {
            await expect(this.result).to.emit(this.marketplace, 'PodListingCreated').withArgs(userAddress, 0, 500, '500', 500000, 2000,'0', "0x", 1, Fixed);
          })
        })
  
        describe("Relist plot from middle", async function () {
          beforeEach(async function () {
            this.result = await this.marketplace.connect(user).createPodListing('0', '0', '500', '500000', '0', '0', INTERNAL);
            this.result = await this.marketplace.connect(user).createPodListing('0', '500', '100', '500000', '2000', '0', INTERNAL);
          })
  
          it('Lists Plot properly', async function () {
            expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(this.result));
          })
  
          it('Emits event', async function () {
            await expect(this.result).to.emit(this.marketplace, 'PodListingCancelled').withArgs(userAddress, 0);
            await expect(this.result).to.emit(this.marketplace, 'PodListingCreated').withArgs(userAddress, 0, 500, '100', 500000, 2000, '0', "0x", 1, Fixed);
          })
        })

        describe("Relist plot from middle with minimum amount", async function () {
          beforeEach(async function () {
            this.result = await this.marketplace.connect(user).createPodListing('0', '0', '500', '500000', '0', '100', INTERNAL);
            this.result = await this.marketplace.connect(user).createPodListing('0', '500', '100', '500000', '2000', '100', INTERNAL);
          })
  
          it('Lists Plot properly', async function () {
            expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(this.result));
          })
  
          it('Emits event', async function () {
            await expect(this.result).to.emit(this.marketplace, 'PodListingCancelled').withArgs(userAddress, 0);
            await expect(this.result).to.emit(this.marketplace, 'PodListingCreated').withArgs(userAddress, 0, 500, '100', 500000, 2000, '100', "0x", 1, Fixed);
          })
        })
      })

      describe("Fill", async function () {

      describe('revert', async function () {
        beforeEach(async function () {
          await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', '10', EXTERNAL);
          this.listing = [userAddress, '0', '0', '1000', 500000, '0', '10', EXTERNAL];
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
          await expect(this.marketplace.connect(user2).fillPodListing(this.listing, 501, EXTERNAL)).to.be.revertedWith('Marketplace: Not enough pods in Listing.');
        })

        it('Fill Listing not enough pods in listing', async function () {
          
          const l = [userAddress, '0', '0', '500', '500000', '0', '0', INTERNAL]
          await this.marketplace.connect(user).createPodListing('0', '0', '500', '500000', '0', '0', INTERNAL);
          await expect(this.marketplace.connect(user2).fillPodListing(l, 500, EXTERNAL)).to.be.revertedWith('Marketplace: Not enough pods in Listing.');
        })

        it("Fails if filling under minimum amount of Pods", async function () {
          await expect(this.marketplace.connect(user2).fillPodListing(this.listing, '1', EXTERNAL)).to.be.revertedWith("Marketplace: Fill must be >= minimum amount.")
        })
      })

      describe("Fill listing", async function () {
        beforeEach(async function () {
          this.listing = [userAddress, '0', '0', '1000', '500000', '0', '0', EXTERNAL]
          await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', '0', EXTERNAL);
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
          await expect(this.result).to.emit(this.marketplace, 'PodListingFilled').withArgs(userAddress, user2Address, 0, 0, '1000', '500');
        })
      })

      describe("Fill partial listing", async function () {
        beforeEach(async function () {
          this.listing = [userAddress, '0', '0', '1000', '500000', '0', '0', EXTERNAL]
          await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', '0', EXTERNAL);
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
          await expect(this.result).to.emit(this.marketplace, 'PodListingFilled').withArgs(userAddress, user2Address, 0, 0, '500', '250');
        })
      })

      describe("Fill partial listing of a partial listing multiple fills", async function () {
        beforeEach(async function () {
          this.listing = [userAddress, '0', '500', '500', '500000', '0', '0', EXTERNAL];
          await this.marketplace.connect(user).createPodListing('0', '500', '500', '500000', '0', '0', EXTERNAL);
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
          await expect(this.result).to.emit(this.marketplace, 'PodListingFilled').withArgs(userAddress, user2Address, 0, 500, '200', '100');
        })
      })

      describe("Fill partial listing of a listing created by partial fill", async function () {
        beforeEach(async function () {

          this.listing = [userAddress, '0', '500', '500', '500000', '0', '0', EXTERNAL];
          await this.marketplace.connect(user).createPodListing('0', '500', '500', '500000', '0', '0', EXTERNAL);
          this.amountBeansBuyingWith = 100;

          this.userBeanBalance = await this.bean.balanceOf(userAddress)
          this.user2BeanBalance = await this.bean.balanceOf(user2Address)
          this.result = await this.marketplace.connect(user2).fillPodListing(this.listing, this.amountBeansBuyingWith, EXTERNAL);

          this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
          this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
          this.listing = [userAddress, '700', '0', '300', '500000', '0', '0', EXTERNAL];

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

          this.listing = [userAddress, '0', '0', '1000', '500000', '0', '0', INTERNAL];
          await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', '0', INTERNAL);
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
          await expect(this.result).to.emit(this.marketplace, 'PodListingFilled').withArgs(userAddress, user2Address, 0, 0, '500', '250');
        })
      })
    })

      describe("Cancel", async function () {
        it('Re-list plot cancels and re-lists', async function () {
          result = await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', '0', EXTERNAL);
          expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(result));
          result = await this.marketplace.connect(user).createPodListing('0', '0', '1000', '200000', '2000', '0', INTERNAL);
          await expect(result).to.emit(this.marketplace, 'PodListingCreated').withArgs(userAddress, '0', 0, 1000, 200000, 2000, '0', "0x", 1, Fixed);
          await expect(result).to.emit(this.marketplace, 'PodListingCancelled').withArgs(userAddress, '0');
          expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(result));
        })

        it('Reverts on Cancel Listing, not owned by user', async function () {
          await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', '0', EXTERNAL);
          await expect(this.marketplace.connect(user2).cancelPodListing('0')).to.be.revertedWith('Marketplace: Listing not owned by sender.');
        })

        it('Cancels Listing, Emits Listing Cancelled Event', async function () {
          result = await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '2000', '0', EXTERNAL);
          expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(result));
          result = (await this.marketplace.connect(user).cancelPodListing('0'));
          expect(await this.marketplace.podListing(0)).to.be.equal(ZERO_HASH);
          expect(result).to.emit(this.marketplace, 'PodListingCancelled').withArgs(userAddress, '0');
        })
      })
    })
    describe("Dynamic Price", async function () {
      beforeEach(async function () {
        this.f = interpolatePoints(staticset_16Pieces_500000.xs, staticset_16Pieces_500000.ys);
      })
      describe("Create", async function () {
        it('Fails to List Unowned Plot', async function () {
          await expect(this.marketplace.connect(user).createPodListingV2('5000', '0', '1000', '0', '0', this.f.packedFunction, INTERNAL)).to.be.revertedWith('Marketplace: Invalid Plot/Amount.');
        })
  
        it('Fails if already expired', async function () {
          await this.field.incrementTotalHarvestableE('2000');
          await expect(this.marketplace.connect(user).createPodListingV2('0', '0', '500', '0', '0', this.f.packedFunction, INTERNAL)).to.be.revertedWith('Marketplace: Expired.');
        })
  
        it('Fails if amount is 0', async function () {
          await expect(this.marketplace.connect(user2).createPodListingV2('1000', '0', '0', '0', '0', this.f.packedFunction, INTERNAL)).to.be.revertedWith('Marketplace: Invalid Plot/Amount.');
        })
  
        it('Fails if start + amount too large', async function () {
          await expect(this.marketplace.connect(user2).createPodListingV2('1000', '500', '1000', '0', '0', this.f.packedFunction, INTERNAL)).to.be.revertedWith('Marketplace: Invalid Plot/Amount.');
        })

        it('Fails if function is invalid length', async function () {
          let brokenFunction = this.f.packedFunction.slice(0, -2);
          await expect(this.marketplace.connect(user).createPodListingV2('0', '0', '1000', '0', '0', brokenFunction, INTERNAL)).to.be.revertedWith('Marketplace: Invalid pricing function.');
        })
  
        describe("List full plot", async function () {
          beforeEach(async function () {
            this.result = await this.marketplace.connect(user).createPodListingV2('0', '0', '1000', '0', '0', this.f.packedFunction, EXTERNAL);
          })
  
          it('Lists Plot properly', async function () {
            expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(this.result));
          })
  
          it('Emits event', async function () {
            await expect(this.result).to.emit(this.marketplace, 'PodListingCreated').withArgs(userAddress, 0, 0, '1000', 0, 0, '0', this.f.packedFunction, 0, Dynamic);
          })
        })
  
        describe("List partial plot", async function () {
          beforeEach(async function () {
            this.result = await this.marketplace.connect(user).createPodListingV2('0', '0', '100', '0', '0', this.f.packedFunction, EXTERNAL);
            this.result = await this.marketplace.connect(user).createPodListingV2('0', '0', '500', '0', '0', this.f.packedFunction, EXTERNAL);
          })
  
          it('Lists Plot properly', async function () {
            expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(this.result));
          })
  
          it('Emits event', async function () {
            await expect(this.result).to.emit(this.marketplace, 'PodListingCreated').withArgs(userAddress, 0, 0, '500', 0, 0, '0', this.f.packedFunction, 0, Dynamic);
          })
        })
  
        describe("List partial plot from middle", async function () {
          beforeEach(async function () {
            this.result = await this.marketplace.connect(user).createPodListingV2('0', '500', '500', '2000', '0', this.f.packedFunction, INTERNAL);
          })
  
          it('Lists Plot properly', async function () {
            expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(this.result));
          })
  
          it('Emits event', async function () {
            await expect(this.result).to.emit(this.marketplace, 'PodListingCreated').withArgs(userAddress, 0, 500, '500', 0, 2000, '0', this.f.packedFunction, 1, Dynamic);
          })
        })
  
        describe("Relist plot from middle", async function () {
          beforeEach(async function () {
            this.result = await this.marketplace.connect(user).createPodListingV2('0', '0', '500', '0', '0', this.f.packedFunction, INTERNAL);
            this.result = await this.marketplace.connect(user).createPodListingV2('0', '500', '100', '2000', '0', this.f.packedFunction, INTERNAL);
          })
  
          it('Lists Plot properly', async function () {
            expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(this.result));
          })
  
          it('Emits event', async function () {
            await expect(this.result).to.emit(this.marketplace, 'PodListingCancelled').withArgs(userAddress, 0);
            await expect(this.result).to.emit(this.marketplace, 'PodListingCreated').withArgs(userAddress, 0, 500, '100', 0, 2000, '0', this.f.packedFunction, 1, Dynamic);
          })
        })
      })

      describe("Fill", async function () {
        describe('revert', async function () {
          beforeEach(async function () {
            await this.marketplace.connect(user).createPodListingV2('0', '0', '1000', '0', '0', this.f.packedFunction, EXTERNAL);
            this.listing = [userAddress, '0', '0', '1000', 0, '0', '0', EXTERNAL];
          })

          it('Fill Listing non-listed Index Fails', async function () {
            let brokenListing = this.listing;
            brokenListing[1] = '1'
            await expect(this.marketplace.connect(user).fillPodListingV2(brokenListing, 1000, this.f.packedFunction, EXTERNAL)).to.be.revertedWith('Marketplace: Listing does not exist.');
          })

          it('Fill Listing wrong start Index Fails', async function () {
            let brokenListing = this.listing;
            brokenListing[2] = '1'
            await expect(this.marketplace.connect(user).fillPodListingV2(brokenListing, 1000, this.f.packedFunction, EXTERNAL)).to.be.revertedWith('Marketplace: Listing does not exist.');
          })

          it('Fill Listing wrong price Fails', async function () {
            let brokenListing = this.listing;
            brokenListing[4] = '100001'
            await expect(this.marketplace.connect(user).
            fillPodListingV2(
              brokenListing,
              1000, 
              this.f.packedFunction, 
              EXTERNAL)
            ).to.be.revertedWith('Marketplace: Listing does not exist.');
          })

          it('Fill Listing after expired', async function () {
            await this.field.incrementTotalHarvestableE('2000');
            await expect(this.marketplace.connect(user2).fillPodListingV2(this.listing, 1000, this.f.packedFunction, EXTERNAL)).to.be.revertedWith('Marketplace: Listing has expired.');
          })

          it('Fill Listing not enough pods in plot', async function () {
            await expect(this.marketplace.connect(user2).fillPodListingV2(this.listing, 1500, this.f.packedFunction, EXTERNAL)).to.be.revertedWith('Marketplace: Not enough pods in Listing.');
          })

          it('Fill Listing not enough pods in listing', async function () {
            const l = [userAddress, '0', '0', '500', '0', '0', '0', INTERNAL]
            await this.marketplace.connect(user).createPodListingV2('0', '0', '500', '0', '0', this.f.packedFunction, INTERNAL);
            await expect(this.marketplace.connect(user2).fillPodListingV2(l, 1000, this.f.packedFunction, EXTERNAL)).to.be.revertedWith('Marketplace: Not enough pods in Listing.');
          })
        })

        describe("Fill listing", async function () {
          beforeEach(async function () {
            this.listing = [userAddress, '0', '0', '1000', '0', '0', '0', EXTERNAL]
            await this.marketplace.connect(user).createPodListingV2( '0', '0', '1000', '0', '0', this.f.packedFunction, EXTERNAL);
            this.amountBeansBuyingWith = 500;
            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.user2BeanBalance = await this.bean.balanceOf(user2Address)

            this.result = await this.marketplace.connect(user2).fillPodListingV2(this.listing, this.amountBeansBuyingWith, this.f.packedFunction, EXTERNAL);

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
            await expect(this.result).to.emit(this.marketplace, 'PodListingFilled').withArgs(userAddress, user2Address, 0, 0, '1000', '500');
          })
        })

        describe("Fill partial listing", async function () {
          beforeEach(async function () {
            this.listing = [userAddress, '0', '0', '1000', '0', '0', '0', EXTERNAL]
            await this.marketplace.connect(user).createPodListingV2('0', '0', '1000', '0', '0', this.f.packedFunction, EXTERNAL);
            this.amountBeansBuyingWith = 250;
            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.user2BeanBalance = await this.bean.balanceOf(user2Address)

            this.result = await this.marketplace.connect(user2).fillPodListingV2(this.listing, this.amountBeansBuyingWith, this.f.packedFunction, EXTERNAL);

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
            expect(await this.marketplace.podListing(500)).to.equal(getHashFromDynamicListing(['0', '500', this.listing[4], this.listing[5], this.listing[6], this.listing[7], this.f.packedFunction]));
          })

          it('transfer pod listing', async function () {
            expect((await this.field.plot(user2Address, 0)).toString()).to.equal('500');
            expect((await this.field.plot(userAddress, 0)).toString()).to.equal('0');
            expect((await this.field.plot(userAddress, 500)).toString()).to.equal('500');
          })

          it('emits event', async function () {
            await expect(this.result).to.emit(this.marketplace, 'PodListingFilled').withArgs(userAddress, user2Address, 0, 0, '500', '250');
          })
        })

        describe("Fill partial listing of a partial listing multiple fills", async function () {
          beforeEach(async function () {
            this.listing = [userAddress, '0', '500', '500', '0', '0', '0', EXTERNAL]
            await this.marketplace.connect(user).createPodListingV2('0', '500', '500', '0', '0', this.f.packedFunction, EXTERNAL);
            this.amountBeansBuyingWith = 100;

            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.user2BeanBalance = await this.bean.balanceOf(user2Address)

            this.result = await this.marketplace.connect(user2).fillPodListingV2(this.listing, this.amountBeansBuyingWith, this.f.packedFunction, EXTERNAL);

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
            expect(await this.marketplace.podListing(700)).to.equal(getHashFromDynamicListing(['0', '300', this.listing[4], this.listing[5], this.listing[6], this.listing[7], this.f.packedFunction]));
          })

          it('transfer pod listing', async function () {
            expect((await this.field.plot(user2Address, 500)).toString()).to.equal('200');
            expect((await this.field.plot(userAddress, 0)).toString()).to.equal('500');
            expect((await this.field.plot(userAddress, 700)).toString()).to.equal('300');
          })

          it('emits event', async function () {
            await expect(this.result).to.emit(this.marketplace, 'PodListingFilled').withArgs(userAddress, user2Address, 0, 500, '200', '100');
          })
        })

        describe("Fill partial listing of a listing created by partial fill", async function () {
          beforeEach(async function () {
            this.listing = [userAddress, '0', '500', '500', '0', '0', '0', EXTERNAL]
            await this.marketplace.connect(user).createPodListingV2('0', '500', '500', '0', '0', this.f.packedFunction, EXTERNAL);
            this.amountBeansBuyingWith = 100;

            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.user2BeanBalance = await this.bean.balanceOf(user2Address)
            this.result = await this.marketplace.connect(user2).fillPodListingV2(this.listing, this.amountBeansBuyingWith, this.f.packedFunction, EXTERNAL);

            this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address)
            this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress)
            this.listing = [userAddress, '700', '0', '300', '0', '0', '0', EXTERNAL]

            this.result = await this.marketplace.connect(user2).fillPodListingV2(this.listing, 100, this.f.packedFunction, EXTERNAL);

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
            expect(await this.marketplace.podListing(900)).to.equal(getHashFromDynamicListing(['0', '100', this.listing[4], this.listing[5], this.listing[6], this.listing[7], this.f.packedFunction]));
          })
        })

        describe("Fill partial listing to wallet", async function () {
          beforeEach(async function () {
            this.listing = [userAddress, '0', '0', '1000', '0', '0', '0', INTERNAL]
            await this.marketplace.connect(user).createPodListingV2('0', '0', '1000', '0', '0', this.f.packedFunction, INTERNAL);
            this.amountBeansBuyingWith = 250;
            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.user2BeanBalance = await this.bean.balanceOf(user2Address)

            this.result = await this.marketplace.connect(user2).fillPodListingV2(this.listing, this.amountBeansBuyingWith, this.f.packedFunction, EXTERNAL);

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
            expect(await this.marketplace.podListing(500)).to.equal(getHashFromDynamicListing(['0', '500', this.listing[4], this.listing[5], this.listing[6], this.listing[7], this.f.packedFunction]));
          })

          it('transfer pod listing', async function () {
            expect((await this.field.plot(user2Address, 0)).toString()).to.equal('500');
            expect((await this.field.plot(userAddress, 0)).toString()).to.equal('0');
            expect((await this.field.plot(userAddress, 500)).toString()).to.equal('500');
          })

          it('emits event', async function () {
            await expect(this.result).to.emit(this.marketplace, 'PodListingFilled').withArgs(userAddress, user2Address, 0, 0, '500', '250');
          })
        })
      })
      describe("Cancel", async function () {
        it('Re-list plot cancels and re-lists', async function () {
          result = await this.marketplace.connect(user).createPodListingV2('0', '0', '1000', '0', '0', this.f.packedFunction, EXTERNAL);
          expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(result));
          result = await this.marketplace.connect(user).createPodListingV2('0', '0', '1000', '2000', '0', this.f.packedFunction, INTERNAL);
          await expect(result).to.emit(this.marketplace, 'PodListingCreated').withArgs(userAddress, '0', 0, 1000, 0, 2000, '0', this.f.packedFunction, 1, Dynamic);
          await expect(result).to.emit(this.marketplace, 'PodListingCancelled').withArgs(userAddress, '0');
          expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(result));
        })

        it('Reverts on Cancel Listing, not owned by user', async function () {
          await this.marketplace.connect(user).createPodListingV2('0', '0', '1000', '0', '0', this.f.packedFunction, EXTERNAL);
          await expect(this.marketplace.connect(user2).cancelPodListing('0')).to.be.revertedWith('Marketplace: Listing not owned by sender.');
        })

        it('Cancels Listing, Emits Listing Cancelled Event', async function () {
          result = await this.marketplace.connect(user).createPodListingV2('0', '0', '1000', '2000', '0', this.f.packedFunction, EXTERNAL);
          expect(await this.marketplace.podListing(0)).to.be.equal(await getHash(result));
          result = (await this.marketplace.connect(user).cancelPodListing('0'));
          expect(await this.marketplace.podListing(0)).to.be.equal(ZERO_HASH);
          expect(result).to.emit(this.marketplace, 'PodListingCancelled').withArgs(userAddress, '0');
        })
      })
    })

  })

  describe("Pod Order", async function () {

    describe("Fixed Price", async function () {
      describe("Create", async function () {
        describe("revert", async function () {
          it("Reverts if price is 0", async function () {
            await expect(this.marketplace.connect(user2).createPodOrder("100", "0", "100000", '0', EXTERNAL)).to.be.revertedWith("Marketplace: Pod price must be greater than 0.");
          });
          it("Reverts if amount is 0", async function () {
            await expect(
              this.marketplace
                .connect(user2)
                .createPodOrder("0", "100000", "100000", '0', EXTERNAL)
            ).to.be.revertedWith("Marketplace: Order amount must be > 0.");
          });
        });
  
        describe("create order", async function () {
          beforeEach(async function () {
            this.userBeanBalance = await this.bean.balanceOf(userAddress);
            this.beanstalkBeanBalance = await this.bean.balanceOf(
              this.marketplace.address
            );
            this.result = await this.marketplace
              .connect(user)
              .createPodOrder("500", "100000", "1000", '0', EXTERNAL);
            this.id = await getOrderId(this.result);
            this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress);
            this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(
              this.marketplace.address
            );
          });
  
          it("Transfer Beans properly", async function () {
            expect(
              this.beanstalkBeanBalanceAfter.sub(this.beanstalkBeanBalance)
            ).to.equal("500");
            expect(this.userBeanBalance.sub(this.userBeanBalanceAfter)).to.equal(
              "500"
            );
          });
  
          it("Creates the order", async function () {
            expect(await this.marketplace.podOrderById(this.id)).to.equal("500");
            expect(
              await this.marketplace.podOrder(userAddress, "100000", "1000", '0')
            ).to.equal("500");
          });
  
          it("emits an event", async function () {
            expect(this.result)
              .to.emit(this.marketplace, "PodOrderCreated")
              .withArgs(userAddress, this.id, "500", 100000, "1000", '0', "0x", Fixed);
          });

          it("cancels old order, replacing with new order", async function () {
            let newOrder =  await this.marketplace.connect(user).createPodOrder("100", "100000", "1000", '0', EXTERNAL);
            expect(newOrder).to.emit(this.marketplace, "PodOrderCancelled").withArgs(userAddress, this.id);
            expect(await this.marketplace.podOrder(userAddress, "100000", "1000", "0")).to.equal("100");
          })
        });

        describe("create order with min amount", async function () {
          beforeEach(async function () {
            this.userBeanBalance = await this.bean.balanceOf(userAddress);
            this.beanstalkBeanBalance = await this.bean.balanceOf(
              this.marketplace.address
            );
            this.result = await this.marketplace
              .connect(user)
              .createPodOrder("500", "100000", "1000", '100', EXTERNAL);
            this.id = await getOrderId(this.result);
            this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress);
            this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(
              this.marketplace.address
            );
          });
  
          it("Transfer Beans properly", async function () {
            expect(
              this.beanstalkBeanBalanceAfter.sub(this.beanstalkBeanBalance)
            ).to.equal("500");
            expect(this.userBeanBalance.sub(this.userBeanBalanceAfter)).to.equal(
              "500"
            );
          });
  
          it("Creates the order", async function () {
            expect(await this.marketplace.podOrderById(this.id)).to.equal("500");
            expect(
              await this.marketplace.podOrder(userAddress, "100000", "1000", '100')
            ).to.equal("500");
          });
  
          it("emits an event", async function () {
            expect(this.result)
              .to.emit(this.marketplace, "PodOrderCreated")
              .withArgs(userAddress, this.id, "500", 100000, "1000", '100', "0x", Fixed);
          });
        });
        
      });

      describe("Fill", async function () {
        beforeEach(async function () {
          this.result = await this.marketplace.connect(user).createPodOrder("50", "100000", "2500", '10', EXTERNAL);
          this.id = await getOrderId(this.result);
          this.order = [userAddress, "100000", "2500", '10'];
        });
  
        describe("revert", async function () {
          it("owner does not own plot", async function () {
            await expect(
              this.marketplace.fillPodOrder(this.order, 0, 0, 500, INTERNAL)
            ).to.revertedWith("Marketplace: Invalid Plot.");
          });
  
          it("plot amount too large", async function () {
            await expect(
              this.marketplace
                .connect(user2)
                .fillPodOrder(this.order, 1000, 700, 500, INTERNAL)
            ).to.be.revertedWith("Marketplace: Invalid Plot.");
          });
  
          it("plot amount too large", async function () {
            await this.field.connect(user2).sow("1200", "0", EXTERNAL);
            await expect(
              this.marketplace
                .connect(user2)
                .fillPodOrder(this.order, 2000, 700, 500, INTERNAL)
            ).to.be.revertedWith("Marketplace: Plot too far in line.");
          });
  
          it("sell too much", async function () {
            await expect(
              this.marketplace
                .connect(user2)
                .fillPodOrder(this.order, 1000, 0, 1000, INTERNAL)
            ).to.revertedWith("Marketplace: Not enough beans in order.");
          });

          it("under minimum amount of pods", async function () {
            await expect(
              this.marketplace
                .connect(user2)
                .fillPodOrder(this.order, 1000, 0, 1, INTERNAL)
            ).to.revertedWith("Marketplace: Fill must be >= minimum amount.");
          });
        });
  
        describe("Full order", async function () {
          beforeEach(async function () {
            this.beanstalkBalance = await this.bean.balanceOf(
              this.marketplace.address
            );
            this.user2BeanBalance = await this.bean.balanceOf(user2Address);
            this.result = await this.marketplace
              .connect(user2)
              .fillPodOrder(this.order, 1000, 0, 500, EXTERNAL);
            this.beanstalkBalanceAfter = await this.bean.balanceOf(
              this.marketplace.address
            );
            this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address);
          });
  
          it("Transfer Beans properly", async function () {
            expect(
              this.user2BeanBalanceAfter.sub(this.user2BeanBalance)
            ).to.equal("50");
            expect(
              this.beanstalkBalance.sub(this.beanstalkBalanceAfter)
            ).to.equal("50");
            expect(
              await this.token.getInternalBalance(
                user2.address,
                this.bean.address
              )
            ).to.equal(0);
          });
  
          it("transfer the plot", async function () {
            expect(await this.field.plot(user2Address, 1000)).to.be.equal(0);
            expect(await this.field.plot(user2Address, 1500)).to.be.equal(500);
            expect(await this.field.plot(userAddress, 1000)).to.be.equal(500);
          });
  
          it("Updates the offer", async function () {
            expect(await this.marketplace.podOrderById(this.id)).to.equal("0");
          });
  
          it("Emits an event", async function () {
            expect(this.result)
              .to.emit(this.marketplace, "PodOrderFilled")
              .withArgs(user2Address, userAddress, this.id, 1000, 0, 500, 50);
          });
        });
  
        describe("Partial fill order", async function () {
          beforeEach(async function () {
            this.beanstalkBalance = await this.bean.balanceOf(this.marketplace.address);
            this.user2BeanBalance = await this.bean.balanceOf(user2Address);
            this.result = await this.marketplace
              .connect(user2)
              .fillPodOrder(this.order, 1000, 250, 250, EXTERNAL);
            this.beanstalkBalanceAfter = await this.bean.balanceOf(
              this.marketplace.address
            );
            this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address);
          });
  
          it("Transfer Beans properly", async function () {
            expect(
              this.user2BeanBalanceAfter.sub(this.user2BeanBalance)
            ).to.equal("25");
            expect(
              this.beanstalkBalance.sub(this.beanstalkBalanceAfter)
            ).to.equal("25");
            expect(
              await this.token.getInternalBalance(
                user2.address,
                this.bean.address
              )
            ).to.equal(0);
          });
  
          it("transfer the plot", async function () {
            expect(await this.field.plot(user2Address, 1000)).to.be.equal(250);
            expect(await this.field.plot(user2Address, 1500)).to.be.equal(500);
            expect(await this.field.plot(userAddress, 1250)).to.be.equal(250);
          });
  
          it("Updates the offer", async function () {
            expect(await this.marketplace.podOrderById(this.id)).to.equal("25");
          });
  
          it("Emits an event", async function () {
            expect(this.result)
              .to.emit(this.marketplace, "PodOrderFilled")
              .withArgs(user2Address, userAddress, this.id, 1000, 250, 250, 25);
          });
        });
  
        describe("Full order to wallet", async function () {
          beforeEach(async function () {
            this.beanstalkBalance = await this.bean.balanceOf(
              this.marketplace.address
            );
            this.user2BeanBalance = await this.bean.balanceOf(user2Address);
            this.result = await this.marketplace
              .connect(user2)
              .fillPodOrder(this.order, 1000, 0, 500, INTERNAL);
            this.beanstalkBalanceAfter = await this.bean.balanceOf(
              this.marketplace.address
            );
            this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address);
          });
  
          it("Transfer Beans properly", async function () {
            expect(
              this.user2BeanBalanceAfter.sub(this.user2BeanBalance)
            ).to.equal(0);
            expect(
              this.beanstalkBalance.sub(this.beanstalkBalanceAfter)
            ).to.equal(0);
            expect(
              await this.token.getInternalBalance(
                user2.address,
                this.bean.address
              )
            ).to.equal("50");
          });
  
          it("transfer the plot", async function () {
            expect(await this.field.plot(user2Address, 1000)).to.be.equal(0);
            expect(await this.field.plot(user2Address, 1500)).to.be.equal(500);
            expect(await this.field.plot(userAddress, 1000)).to.be.equal(500);
          });
  
          it("Updates the offer", async function () {
            expect(await this.marketplace.podOrderById(this.id)).to.equal("0");
          });
  
          it("Emits an event", async function () {
            expect(this.result)
              .to.emit(this.marketplace, "PodOrderFilled")
              .withArgs(user2Address, userAddress, this.id, 1000, 0, 500, 50);
          });
        });
  
        describe("Full order with active listing", async function () {
          beforeEach(async function () {
            await this.marketplace
              .connect(user2)
              .createPodListing("1000", "500", "500", "50000", "5000", '0', EXTERNAL);
            this.beanstalkBalance = await this.bean.balanceOf(
              this.marketplace.address
            );
            this.user2BeanBalance = await this.bean.balanceOf(user2Address);
            this.result = await this.marketplace
              .connect(user2)
              .fillPodOrder(this.order, 1000, 0, 500, INTERNAL);
            this.beanstalkBalanceAfter = await this.bean.balanceOf(
              this.marketplace.address
            );
            this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address);
          });
  
          it("Transfer Beans properly", async function () {
            expect(
              this.user2BeanBalanceAfter.sub(this.user2BeanBalance)
            ).to.equal(0);
            expect(
              this.beanstalkBalance.sub(this.beanstalkBalanceAfter)
            ).to.equal(0);
            expect(
              await this.token.getInternalBalance(
                user2.address,
                this.bean.address
              )
            ).to.equal("50");
          });
  
          it("transfer the plot", async function () {
            expect(await this.field.plot(user2Address, 1000)).to.be.equal(0);
            expect(await this.field.plot(user2Address, 1500)).to.be.equal(500);
            expect(await this.field.plot(userAddress, 1000)).to.be.equal(500);
          });
  
          it("Updates the offer", async function () {
            expect(await this.marketplace.podOrderById(this.id)).to.equal("0");
          });
  
          it("deletes the listing", async function () {
            expect(await this.marketplace.podListing("1000")).to.equal(ZERO_HASH);
          });
  
          it("Emits an event", async function () {
            expect(this.result)
              .to.emit(this.marketplace, "PodListingCancelled")
              .withArgs(user2Address, "1000");
            expect(this.result)
              .to.emit(this.marketplace, "PodOrderFilled")
              .withArgs(user2Address, userAddress, this.id, 1000, 0, 500, 50);
          });
        });
      });

      describe("Cancel", async function () {
        beforeEach(async function () {
          this.result = await this.marketplace.connect(user).createPodOrder('500', '100000', '1000', '0', EXTERNAL)
          this.id = await getOrderId(this.result)
        })
  
        describe('Cancel owner', async function () {
          beforeEach(async function () {
            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address)
            this.result = await this.marketplace.connect(user).cancelPodOrder('100000', '1000', '0', EXTERNAL);
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
            this.result = await this.marketplace.connect(user).cancelPodOrder('100000', '1000', '0', INTERNAL);
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

    describe("Dynamic Price", async function () {
      beforeEach(async function () {
        this.f = interpolatePoints(staticset_4Pieces_100000.xs, staticset_4Pieces_100000.ys);
      })
      describe("Create", async function () {
        describe("revert", async function () {
          it("Reverts if amount is 0", async function () {
            await expect(this.marketplace.connect(user2).createPodOrderV2("0","1000",'0',this.f.packedFunction,EXTERNAL)).to.be.revertedWith("Marketplace: Order amount must be > 0.");
          });

          it("Reverts with invalid function", async function () {
            let brokenFunction = this.f.packedFunction.slice(0,-2);
            await expect(this.marketplace.connect(user2).createPodOrderV2("500","1000",'0',brokenFunction,EXTERNAL)).to.be.revertedWith("Marketplace: Invalid pricing function.");
          });
          
        });

        describe("create order", async function () {
          beforeEach(async function () {
            this.userBeanBalance = await this.bean.balanceOf(userAddress);
            this.beanstalkBeanBalance = await this.bean.balanceOf(
              this.marketplace.address
            );
            this.result = await this.marketplace.connect(user).createPodOrderV2("500","1000",'0',this.f.packedFunction,EXTERNAL);
            this.id = await getOrderId(this.result);
            this.userBeanBalanceAfter = await this.bean.balanceOf(userAddress);
            this.beanstalkBeanBalanceAfter = await this.bean.balanceOf(
              this.marketplace.address
            );
          });

          it("Transfer Beans properly", async function () {
            expect(
              this.beanstalkBeanBalanceAfter.sub(this.beanstalkBeanBalance)
            ).to.equal("500");
            expect(this.userBeanBalance.sub(this.userBeanBalanceAfter)).to.equal(
              "500"
            );
          });

          it("Creates the order", async function () {
            expect(await this.marketplace.podOrderById(this.id)).to.equal("500");
            expect(
              await this.marketplace.podOrderV2(
                userAddress,
                "1000",
                '0',
                this.f.packedFunction
              )
            ).to.equal("500");
          });

          it("emits an event", async function () {
            await expect(this.result)
              .to.emit(this.marketplace, "PodOrderCreated")
              .withArgs(
                userAddress,
                this.id,
                "500",
                0,
                "1000",
                '0',
                this.f.packedFunction,
                Dynamic
              );

          });
          it("cancels old order, replacing with new order", async function () {
            let newOrder =  await this.marketplace.connect(user).createPodOrderV2("100", "1000", '0', this.f.packedFunction, EXTERNAL);
            expect(newOrder).to.emit(this.marketplace, "PodOrderCancelled").withArgs(userAddress, this.id);
            expect(await this.marketplace.podOrderV2(userAddress, "1000", "0", this.f.packedFunction)).to.equal("100");
          })
        });
      });

      describe("Fill", async function () {
        beforeEach(async function () {
          this.result = await this.marketplace.connect(user).createPodOrderV2("50", "2500", '0', this.f.packedFunction, EXTERNAL);
          this.id = await getOrderId(this.result);
          this.order = [userAddress, "0", "2500", '0'];
        });

        describe("revert", async function () {
          it("owner does not own plot", async function () {
            await expect(
              this.marketplace.fillPodOrderV2(this.order, 0, 0, 500, this.f.packedFunction, INTERNAL)
            ).to.revertedWith("Marketplace: Invalid Plot.");
          });

          it("plot amount too large", async function () {
            await expect(
              this.marketplace.connect(user2).fillPodOrderV2(this.order, 1000, 700, 500, this.f.packedFunction, INTERNAL)
            ).to.be.revertedWith("Marketplace: Invalid Plot.");
          });

          it("plot amount too large", async function () {
            await this.field.connect(user2).sow("1200", "0", EXTERNAL);
            await expect(
              this.marketplace.connect(user2).fillPodOrderV2(this.order, 2000, 700, 500, this.f.packedFunction, INTERNAL)
            ).to.be.revertedWith("Marketplace: Plot too far in line.");
          });

          it("sell too much", async function () {
            await expect(
              this.marketplace.connect(user2).fillPodOrderV2(this.order,1000, 0, 1000, this.f.packedFunction, INTERNAL)
            ).to.revertedWith("Marketplace: Not enough beans in order.");
          });
        });

        describe("Full order", async function () {
          beforeEach(async function () {
            this.beanstalkBalance = await this.bean.balanceOf(this.marketplace.address);
            this.user2BeanBalance = await this.bean.balanceOf(user2Address);
            this.result = await this.marketplace.connect(user2).fillPodOrderV2(this.order, 1000, 0, 500, this.f.packedFunction, EXTERNAL);
            this.beanstalkBalanceAfter = await this.bean.balanceOf(this.marketplace.address);
            this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address);
          });

          it("Transfer Beans properly", async function () {
            expect(this.user2BeanBalanceAfter.sub(this.user2BeanBalance)).to.equal("50");
            expect(this.beanstalkBalance.sub(this.beanstalkBalanceAfter)).to.equal("50");
            expect(await this.token.getInternalBalance(user2.address, this.bean.address)).to.equal(0);
          });

          it("transfer the plot", async function () {
            expect(await this.field.plot(user2Address, 1000)).to.be.equal(0);
            expect(await this.field.plot(user2Address, 1500)).to.be.equal(500);
            expect(await this.field.plot(userAddress, 1000)).to.be.equal(500);
          });

          it("Updates the offer", async function () {
            expect(await this.marketplace.podOrderById(this.id)).to.equal("0");
          });

          it("Emits an event", async function () {
            expect(this.result).to.emit(this.marketplace, "PodOrderFilled").withArgs(user2Address, userAddress, this.id, 1000, 0, 500, 50);
          });
        });

        describe("Partial fill order", async function () {
          beforeEach(async function () {
            this.beanstalkBalance = await this.bean.balanceOf(this.marketplace.address);
            this.user2BeanBalance = await this.bean.balanceOf(user2Address);
            this.result = await this.marketplace.connect(user2).fillPodOrderV2(this.order, 1000, 250, 250, this.f.packedFunction, EXTERNAL);
            this.beanstalkBalanceAfter = await this.bean.balanceOf(this.marketplace.address);
            this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address);
          });

          it("Transfer Beans properly", async function () {
            expect(this.user2BeanBalanceAfter.sub(this.user2BeanBalance)).to.equal("25");
            expect(this.beanstalkBalance.sub(this.beanstalkBalanceAfter)).to.equal("25");
            expect(await this.token.getInternalBalance(user2.address, this.bean.address)).to.equal(0);
          });

          it("transfer the plot", async function () {
            expect(await this.field.plot(user2Address, 1000)).to.be.equal(250);
            expect(await this.field.plot(user2Address, 1500)).to.be.equal(500);
            expect(await this.field.plot(userAddress, 1250)).to.be.equal(250);
          });

          it("Updates the offer", async function () {
            expect(await this.marketplace.podOrderById(this.id)).to.equal("25");
          });

          it("Emits an event", async function () {
            expect(this.result).to.emit(this.marketplace, "PodOrderFilled").withArgs(user2Address, userAddress, this.id, 1000, 250, 250, 25);
          });
        });

        describe("Full order to wallet", async function () {
          beforeEach(async function () {
            this.beanstalkBalance = await this.bean.balanceOf(
              this.marketplace.address
            );
            this.user2BeanBalance = await this.bean.balanceOf(user2Address);
            this.result = await this.marketplace.connect(user2).fillPodOrderV2(this.order, 1000, 0, 500, this.f.packedFunction, INTERNAL);
            this.beanstalkBalanceAfter = await this.bean.balanceOf(
              this.marketplace.address
            );
            this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address);
          });

          it("Transfer Beans properly", async function () {
            expect(
              this.user2BeanBalanceAfter.sub(this.user2BeanBalance)
            ).to.equal(0);
            expect(
              this.beanstalkBalance.sub(this.beanstalkBalanceAfter)
            ).to.equal(0);
            expect(
              await this.token.getInternalBalance(
                user2.address,
                this.bean.address
              )
            ).to.equal("50");
          });

          it("transfer the plot", async function () {
            expect(await this.field.plot(user2Address, 1000)).to.be.equal(0);
            expect(await this.field.plot(user2Address, 1500)).to.be.equal(500);
            expect(await this.field.plot(userAddress, 1000)).to.be.equal(500);
          });

          it("Updates the offer", async function () {
            expect(await this.marketplace.podOrderById(this.id)).to.equal("0");
          });

          it("Emits an event", async function () {
            expect(this.result)
              .to.emit(this.marketplace, "PodOrderFilled")
              .withArgs(user2Address, userAddress, this.id, 1000, 0, 500, 50);
          });
        });

        describe("Full order with active listing", async function () {
          beforeEach(async function () {
            await this.marketplace
              .connect(user2)
              .createPodListingV2(
                "1000",
                "0",
                "500",
                "5000",
                '0',
                this.f.packedFunction,
                EXTERNAL
              );
            this.beanstalkBalance = await this.bean.balanceOf(
              this.marketplace.address
            );
            this.user2BeanBalance = await this.bean.balanceOf(user2Address);
            this.result = await this.marketplace
              .connect(user2)
              .fillPodOrderV2(this.order, 1000, 0, 500, this.f.packedFunction, INTERNAL);
            this.beanstalkBalanceAfter = await this.bean.balanceOf(
              this.marketplace.address
            );
            this.user2BeanBalanceAfter = await this.bean.balanceOf(user2Address);
          });

          it("Transfer Beans properly", async function () {
            expect(
              this.user2BeanBalanceAfter.sub(this.user2BeanBalance)
            ).to.equal(0);
            expect(
              this.beanstalkBalance.sub(this.beanstalkBalanceAfter)
            ).to.equal(0);
            expect(
              await this.token.getInternalBalance(
                user2.address,
                this.bean.address
              )
            ).to.equal("50");
          });

          it("transfer the plot", async function () {
            expect(await this.field.plot(user2Address, 1000)).to.be.equal(0);
            expect(await this.field.plot(user2Address, 1500)).to.be.equal(500);
            expect(await this.field.plot(userAddress, 1000)).to.be.equal(500);
          });

          it("Updates the offer", async function () {
            expect(await this.marketplace.podOrderById(this.id)).to.equal("0");
          });

          it("deletes the listing", async function () {
            expect(await this.marketplace.podListing("1000")).to.equal(ZERO_HASH);
          });

          it("Emits an event", async function () {
            expect(this.result)
              .to.emit(this.marketplace, "PodListingCancelled")
              .withArgs(user2Address, "1000");
            expect(this.result)
              .to.emit(this.marketplace, "PodOrderFilled")
              .withArgs(user2Address, userAddress, this.id, 1000, 0, 500, 50);
          });
        });
      });
    
      describe("Cancel", async function () {
        beforeEach(async function () {
          this.result = await this.marketplace.connect(user).createPodOrderV2('500','1000','0', this.f.packedFunction, EXTERNAL)
          this.id = await getOrderId(this.result)
        })

        describe('Cancel owner', async function () {
          beforeEach(async function () {
            this.userBeanBalance = await this.bean.balanceOf(userAddress)
            this.beanstalkBeanBalance = await this.bean.balanceOf(this.marketplace.address)
            this.result = await this.marketplace.connect(user).cancelPodOrderV2('1000', '0', this.f.packedFunction, EXTERNAL);
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
            this.result = await this.marketplace.connect(user).cancelPodOrderV2('1000', '0', this.f.packedFunction, INTERNAL);
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
          await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', '0', EXTERNAL);
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
          await this.marketplace.connect(user).createPodListing('0', '0', '1000', '500000', '0', '0', EXTERNAL);
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
