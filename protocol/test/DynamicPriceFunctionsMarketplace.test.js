const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { expect, use } = require("chai");
const { waffleChai } = require("@ethereum-waffle/chai");
use(waffleChai);
const { deploy } = require('../scripts/deploy.js')
const { BigNumber } = require('bignumber.js')
const { print, printWeather } = require('./utils/print.js')
const { createInterpolant, evaluatePCHIP } = require('./utils/pchip.js')
const { getEthSpentOnGas } = require('./utils/helpers.js')


const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000'
let user, user2, owner;
let userAddress, ownerAddress, user2Address;

describe('FunctionsMarketplace', function () {
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

    console.log('this.diamond.address', this.diamond)

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
      [args.start, args.amount, 0, args.maxHarvestableIndex, true, args.toWallet, args.subIntervalIndex, args.constants, args.shifts, args.signs]
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

// so what i would do is test the pricing functions indpendently 
  //
  const nonLinearSet = {
    xs: [0, 1000, 6000],
    ys: [500000, 600000, 700000]
};

  beforeEach(async function () {
      console.log('Why is before each not running?')
    await resetState();
    await this.marketplace.deleteOrders(this.orderIds);
    this.orderIds = []

    // const nonLinearSet = {
    //     xs: [0, 1000, 6000],
    //     ys: [500000, 600000, 700000]
    // }
    
    // this.interp = createInterpolant(nonLinearSet.xs, nonLinearSet.ys);


  })



  describe("_getPriceAtIndex", async function () {
      

    describe("Price at 0", async function () {
        
        this.interp = createInterpolant(nonLinearSet.xs, nonLinearSet.ys);
        console.log('this.marketplace', this.marketplace);
        this.listing = await this.marketplace.connect(user).createPodListing('0', '0', '1000', 0, '0', true, false, [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts, this.interp.signs]);

        // this.priceAt0 = await _getPriceAtIndex(0);
        // evaluatePchip(this.interp, 0);
    });

    describe("Price in first piece of piecewise", async function () {
        
        this.interp = createInterpolant(nonLinearSet.xs, nonLinearSet.ys);
        this.listing = await this.marketplace.connect(user).createPodListing('0', '0', '1000', 0, '0', true, false, [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts, this.interp.signs]);

        // this.priceAt0 = await _getPriceAtIndex(500);
        // evaluatePchip(this.interp, 500);
    });

    describe("Error: Price out of domain", async function () {
        
        this.interp = createInterpolant(nonLinearSet.xs, nonLinearSet.ys);
        this.listing = await this.marketplace.connect(user).createPodListing('0', '0', '1000', 0, '0', true, false, [this.interp.subIntervalIndex.map(String), this.interp.constants.map(String), this.interp.shifts, this.interp.signs]);

        // this.priceAt0 = await _getPriceAtIndex(8000);
        //
        // evaluatePchip(this.interp, 8000);
    });


  });

  describe("_getSumOverPiecewiseRange", async function () {

    describe("Sum over entire piecewise range", async function () {
        
    });


  });

  describe("findIndexWithinSubinterval", async function () {

    describe("Find index out of range", async function () {
        

    });


  });

});