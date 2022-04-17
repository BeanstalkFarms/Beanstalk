const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { expect, use } = require("chai");
const { waffleChai } = require("@ethereum-waffle/chai");
use(waffleChai);
const { deploy } = require('../scripts/deploy.js')
const { BigNumber } = require('bignumber.js')
const { print, printWeather } = require('./utils/print.js')
const { createInterpolant, getInterpPrice, getInterpSum, findIndex } = require('./utils/pchip.js')
const { getEthSpentOnGas } = require('./utils/helpers.js')


const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000'
let user, user2, owner;
let userAddress, ownerAddress, user2Address;

describe('Marketplace Pricing Functions', function () {
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
    this.diamond = contracts.beanstalkDiamond;

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

  const emptyFunction = [Array(10).fill("0"), Array(40).fill("0"), Array(40).fill(0), Array(40).fill(true)];

  const nonLinearSet = {
    xs: [0, 1000, 6000],
    ys: [500000, 600000, 700000]
  };
  const getHash = async function (tx) {
    let receipt = await tx.wait();
    const args = (receipt.events?.filter((x) => { return x.event == "PodListingCreated" }))[0].args;
    return ethers.utils.solidityKeccak256(
      ['uint256', 'uint256', 'uint24', 'uint256', 'bool', 'bool', 'uint256[10]', 'uint256[40]', 'uint8[40]', 'bool[40]'],
      [args.start, args.amount, args.pricePerPod, args.maxHarvestableIndex, false, args.toWallet, Array(10).fill(0), Array(40).fill(0), Array(40).fill(0), Array(40).fill(true)]
    );
  }

  const getDynamicHash = async function (tx) {
    let receipt = await tx.wait();
    const args = (receipt.events?.filter((x) => { return x.event == "DynamicPodListingCreated" }))[0].args;
    return ethers.utils.solidityKeccak256(
      ['uint256', 'uint256', 'uint24', 'uint256', 'bool', 'bool', 'uint256[10]', 'uint256[40]', 'uint8[40]', 'bool[40]'],
      [args.start, args.amount, 0, args.maxHarvestableIndex, true, args.toWallet, args.subintervals, args.constants, args.shifts, args.signs]
    );
  }

  const getHashFromListing = function (l) {
    return ethers.utils.solidityKeccak256(['uint256', 'uint256', 'uint24', 'uint256', 'bool', 'bool', 'uint256[10]', 'uint256[40]', 'uint8[40]', 'bool[40]'], l);
  }

  const getOrderId = async function (tx) {
    let receipt = await tx.wait();
    let idx = (receipt.events?.filter((x) => { return x.event == "PodOrderCreated" }))[0].args.id;
    return idx;
  }

  const getDynamicOrderId = async function (tx) {
    let reciept = await tx.wait();
    let idx = (reciept.events?.filter((x)=>{ return x.event == "DynamicPodOrderCreated"}))[0].args.id;
    return idx;
  }

  function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // so what i would do is test the pricing functions indpendently 
    //
    

    function getRandomSetMonotonic(xStart, xEnd, yStart, yEnd) {
      // var length = 5;
      let xs = [0,       1000,    2000,   8000, 9000];
      let ys = [1000000, 850000,  800000, 400000, 380000];

   
      console.log(xs, ys)
      return {xs, ys};

    }

    beforeEach(async function () {
      await resetState();
      await this.marketplace.deleteOrders(this.orderIds);
      this.orderIds = []
      this.set = getRandomSetMonotonic(0, 5000, 900000, 200000);
    })

    describe("Dynamic Pricing - LibMathFP", async function () {

      describe("Find Index within Subinterval", async function () {
        beforeEach(async function() {
          
          this.interp = createInterpolant(this.set.xs, this.set.ys)
          this.mid = getRandomInt(this.set.xs[Math.ceil(this.set.xs.length/2)], this.set.xs[Math.ceil(this.set.xs.length/2)])
          this.index0 = findIndex(this.interp.subintervals, 0, 0, this.set.xs.length);
          this.index1 = findIndex(this.interp.subintervals, this.interp.subintervals[1], 0, this.set.xs.length);
          this.index1n = findIndex(this.interp.subintervals, this.interp.subintervals[this.set.xs.length - 1 - 1], 0, this.set.xs.length)
          // this.indexMid = findIndex(this.interp.subintervals, this.mid, 0, this.set.xs.length);
          this.indexEnd = findIndex(this.interp.subintervals, this.set.xs[this.set.xs.length - 1], 0, this.set.xs.length);
        })
  
        it("Finds the correct index 0", async function () {
          let ind = await this.marketplace.findIndexWithinSubinterval(this.interp.subintervals.map(String), '0', '0', '9');
          // expect(ind == index0 ? )
          expect(ind).to.equal(this.index0)
          expect(this.interp.subintervals[ind]).to.equal(this.interp.subintervals[this.index0])
        })
        it("Finds the correct index 1", async function () {
          let ind = await this.marketplace.findIndexWithinSubinterval(this.interp.subintervals.map(String), this.interp.subintervals[1].toString(), '0', '9');
          // expect(ind == index0 ? )
          expect(ind).to.equal(this.index1)
          expect(this.interp.subintervals[ind]).to.equal(this.interp.subintervals[this.index1])
        })
        it("Finds the correct index -1", async function () {
          let ind = await this.marketplace.findIndexWithinSubinterval(this.interp.subintervals.map(String), this.interp.subintervals[this.set.xs.length - 1 - 1].toString(), '0', '9');
          // expect(ind == index0 ? )
          expect(ind).to.equal(this.index1n)
          expect(this.interp.subintervals[ind]).to.equal(this.interp.subintervals[this.index1n])
        })
        it("Finds the correct index end", async function () {
          let ind = await this.marketplace.findIndexWithinSubinterval(this.interp.subintervals.map(String), this.interp.subintervals[this.set.xs.length - 1].toString(), '0', '9');
          // expect(ind == index0 ? )
          expect(ind).to.equal(this.indexEnd)
          expect(this.interp.subintervals[ind]).to.equal(this.interp.subintervals[this.indexEnd])
        })

        // it("Finds the correct index 1", async function () {
        //   let ind = await this.marketplace.findIndexWithinSubinterval(this.interp.subintervals.map(String), this.interp.subintervals[1].toString(), '0', '9');
        //   expect(this.interp.subintervals[ind]).to.equal(this.interp.subintervals[this.index1])
        // })
        // it("Finds the correct index middle", async function () {
        //   let ind = await this.marketplace.findIndexWithinSubinterval(this.interp.subintervals.map(String), this.mid.toString(), '0', '9');
        //   expect(this.interp.subintervals[ind]).to.equal(this.interp.subintervals[this.indexMid])
        // })

        // it("Finds the correct index end", async function () {
        //   let ind = await this.marketplace.findIndexWithinSubinterval(this.interp.subintervals.map(String), this.set.xs[this.set.xs.length-1].toString(), '0', '9');
        //   console.log(ind,this.indexEnd)
        //   console.log(this.interp.subintervals[ind], this.interp.subintervals[this.indexEnd])
        //   expect(this.interp.subintervals[ind]).to.equal(this.interp.subintervals[this.indexEnd])
        // })

      })

      describe("pricing with a non linear set", async function () {
        
        beforeEach(async function () {
          this.interp = createInterpolant(this.set.xs, this.set.ys);

          this.index0 = findIndex(this.interp.subintervals, 0, 0, this.set.xs.length)
          this.priceAt0 = getInterpPrice(this.interp, 0, this.index0);

          this.index1 = findIndex(this.interp.subintervals, this.interp.subintervals[1], 0, this.set.xs.length)
          this.priceAt1 = getInterpPrice(this.interp, this.interp.subintervals[1], this.index1);

          this.index2 = findIndex(this.interp.subintervals, this.interp.subintervals[2], 0, this.set.xs.length);
          this.priceAt2 = getInterpPrice(this.interp, this.interp.subintervals[2], this.index2)

          this.index1reverse = findIndex(this.interp.subintervals, this.interp.subintervals[this.set.xs.length-1], 0, this.set.xs.length);
          this.priceAt1reverse = getInterpPrice(this.interp, this.interp.subintervals[this.set.xs.length-1], this.set.xs.length-1, this.index1reverse)

          this.index2reverse = findIndex(this.interp.subintervals, this.interp.subintervals[this.set.xs.length-2], 0, this.set.xs.length);
          this.priceAt2reverse = getInterpPrice(this.interp, this.interp.subintervals[this.set.xs.length-2], this.set.xs.length-2, this.index2reverse)
        })

        // HAVE TO CALCULATE THE CORRECT X VALUE BY USING THE HARVESTABLE IDNEX
        it("prices correctly at 0", async function () {
          expect(await this.marketplace.getPriceAtIndex([this.interp.subintervals.map(String), this.interp.constants.map(String), this.interp.shifts, this.interp.signs], '0', this.index0)).to.equal(this.priceAt0.toString())
        })

        it("prices correctly in 1st index", async function () {
          expect(await this.marketplace.getPriceAtIndex([this.interp.subintervals.map(String), this.interp.constants.map(String), this.interp.shifts, this.interp.signs], this.interp.subintervals[1], this.index1)).to.equal(this.priceAt1)
        })
        it("prices correctly in 2nd index", async function () {
          expect(await this.marketplace.getPriceAtIndex([this.interp.subintervals.map(String), this.interp.constants.map(String), this.interp.shifts, this.interp.signs], this.interp.subintervals[2], this.index2)).to.equal(this.priceAt2)
        })
        it("prices correctly in 1st reverse index", async function () {
          expect(await this.marketplace.getPriceAtIndex([this.interp.subintervals.map(String), this.interp.constants.map(String), this.interp.shifts, this.interp.signs], this.interp.subintervals[this.set.xs.length-1], this.index1reverse)).to.equal(this.priceAt1reverse)
        })
      
      })
    
    })
    
  
});