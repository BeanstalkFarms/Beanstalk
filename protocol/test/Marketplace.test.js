const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { expect, use } = require("chai");
const { waffleChai } = require("@ethereum-waffle/chai");
use(waffleChai);
const { deploy } = require('../scripts/deploy.js')
const { BigNumber } = require('bignumber.js')
const { print, printWeather } = require('./utils/print.js')

let user,user2,owner;
let userAddress, ownerAddress, user2Address ;

async function checkUserPlots(field, address, plots) {
  for (var i = 0; i < plots.length; i++) {
    expect(await field.plot(address, plots[i][0])).to.eq(plots[i][1])
  }
}



describe('Marketplace', function () {
  before(async function () {
    console.log('here');
    [owner,user,user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true);

    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond
    this.field = await ethers.getContractAt('MockFieldFacet', this.diamond.address);
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address);
    this.marketplace = await ethers.getContractAt('MarketplaceFacet', this.diamond.address);
    this.bean = await ethers.getContractAt('MockToken', contracts.bean);


    await this.season.resetAccount(userAddress)
    await this.season.resetAccount(user2Address)
    await this.season.resetAccount(ownerAddress)
    await this.season.resetState()
    await this.season.siloSunrise(0)

    await this.bean.mint(userAddress, '10000')
    await this.bean.mint(user2Address, '10000')

    await this.bean.connect(user).approve(this.field.address, '100000000000')
    await this.bean.connect(user2).approve(this.field.address, '100000000000')

    await this.field.incrementTotalSoilEE('10000');
    await this.field.connect(user).sowBeans('1000');
    await this.field.connect(user2).sowBeans('1000');
    await this.field.connect(user).sowBeans('2000');
    await this.field.connect(user2).sowBeans('2000');

    console.log('here2');
    
    this.result = await this.marketplace.connect(user).listPlot('0', '500000', '1000', '1000');
    console.log((await this.field.plot(userAddress, 0)).toString());
    console.log((await this.field.plot(user2Address, 1010)).toString());

    this.result = await this.marketplace.connect(user2).listPlot('1000', '500000', '1000', '500');
    console.log('here4');


  });


  beforeEach (async function () {
    await this.season.resetAccount(userAddress)
    await this.season.resetAccount(user2Address)
    await this.season.resetAccount(ownerAddress)
    await this.season.resetState()
    await this.season.siloSunrise(0)
  });


  describe("List Plot", async function () {


    //TODO ask publius how to emit?
    it('Emits a List event', async function () {
      result = await this.marketplace.connect(user).listPlot('0', '500000', '1000', '1000');
      await expect(result).to.emit(this.marketplace, 'ListingCreated').withArgs(userAddress, '0', 500000, 1000, 1000);
    });

    it('Fails to List Unowned Plot', async function () {
      await expect(this.marketplace.connect(user).listPlot('1000', '500000', '1000', '1000')).to.be.revertedWith('Field: Plot not owned by user.');
    });


    it('Lists the product', async function () {
      const listing = await this.marketplace.listing(0);
      expect(listing.price).to.equal(500000);
      expect(listing.expiry.toString()).to.equal('1000');
      expect(listing.amount.toString()).to.equal('0');
    });




    it('User Listing, Plots Transfer, Balances Update', async function () {


      const listing = await this.marketplace.listing(0);
      expect((await this.field.plot(user2Address, 0)).toString()).to.equal('0');
      expect((await this.field.plot(userAddress, 0)).toString()).to.equal('1000');
      expect((await this.bean.balanceOf(userAddress)).toString()).to.eq('7000');
      expect((await this.bean.balanceOf(user2Address)).toString()).to.eq('7000');

      await this.marketplace.connect(user2).buyListing(0, userAddress, '500'); 
   
      expect((await this.field.plot(userAddress, 0)).toString()).to.equal('0');
      expect((await this.field.plot(userAddress, 500)).toString()).to.equal('500');
      expect((await this.field.plot(user2Address, 0)).toString()).to.equal('500');

      expect((await this.bean.balanceOf(userAddress)).toString()).to.eq('7250');
      expect((await this.bean.balanceOf(user2Address)).toString()).to.eq('6750');
      const listingDeleted = await this.marketplace.listing(0);
      //expect(li)

    });

    /**
    expect(await this.field.totalHarvestable()).to.eq(this.testData.totalHarvestablePods)
    expect(await this.field.totalSoil()).to.eq(this.testData.soil)
    expect(await this.field.totalUnripenedPods()).to.eq(this.testData.totalUnripenedPods)
    expect(await this.field.podIndex()).to.eq(this.testData.podIndex)
    expect(await this.field.harvestableIndex()).to.eq(this.testData.podHarvestableIndex)
    
      */

    // it('Does not list since does not own the plot', async function () {
    //   await expect(this.marketplace.connect(user2).listPlot('0','1000','1','2000')).to.be.revertedWith("Field: Plot not owned by user.");
    // });

    // it('Does not list since wants to list zero pods', async function () {
    //   await expect(this.marketplace.connect(user2).list('1000','0',true,'1','2000')).to.be.revertedWith("Marketplace: Must list atleast one pod from the plot.");
    // });

    // it('Does not list since wants to list more pods than in the plot', async function () {
    //   await expect(this.marketplace.connect(user2).list('1000','2000',true,'1','2000')).to.be.revertedWith("Marketplace: Cannot list more pods than in the plot.");
    // });

    // it('Does not list since the price of listing is 0', async function () {
    //   await expect(this.marketplace.connect(user2).list('1000','1000', true,'0','2000')).to.be.revertedWith("Marketplace: Cannot list for a value of 0.");
    // })

    // it('Does not list since expiration too short', async function () {
    //   await expect(this.marketplace.connect(user2).list('1000','1000',true,'1','0')).to.be.revertedWith("Marketplace: Expiration too short.");
    // })

    // it('Does not list since expiration too long', async function() {
    //   await expect(this.marketplace.connect(user2).list('1000','1000', true,'1','4000')).to.be.revertedWith("Marketplace: Expiration too long.");
    // });

    // it('Emits a second List event', async function () {
    //   await expect(this.marketplace.connect(user2).list('1000','1000', true,'1','2000')).to.emit(this.marketplace, 'CreateListing').withArgs(user2Address, '1000','1000', true, 1, '2000');
    // });

    // it('Emits List event for half a plot', async function() {
    // })

    // it('Lists the half plot', async function() {
  
    // })


    // it('Buy Listing Fails after Expiry', async function () {
    //   //
    // });

    // it('Buy Listing with Ethereum and beans', async function () {
    //   //
    // });

    // it('Buy Listing non-listed Index', async function () {
    //   //
    // });

    // it('Buy Listing wrong recipient', async function () {
    //   //
    // });


  });

});
