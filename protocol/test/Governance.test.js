const hre = require("hardhat")
const { deploy } = require('../scripts/deploy.js')
const { upgradeWithNewFacets } = require('../scripts/diamond.js')
const { expect } = require('chai')
const { parseJson } = require('./utils/helpers.js')
const { ZERO_ADDRESS } = require('./utils/constants.js')

// Set the test data
const [columns, tests] = parseJson('./coverage_data/siloGovernance.json')
var startTest = 0
var numberTests = tests.length-startTest
// numberTests = 1

const users = ['userAddress', 'user2Address', 'ownerAddress', 'otherAddress']

async function propose(user,g,bip,p=0) {
  return await g.connect(user).propose(bip.diamondCut, bip.initFacetAddress, bip.functionCall, p)
}

let user,user2,user3,owner;
let userAddress, ownerAddress, user2Address, user3Address;
let seasonTimestamp;

describe('Governance', function () {

  before(async function () {
    [owner,user,user2,user3] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    user3Address = user3.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address);
    this.governance = await ethers.getContractAt('MockGovernanceFacet', this.diamond.address);
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address);
    this.pair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pair);
    this.bean = await ethers.getContractAt('MockToken', contracts.bean);
    this.diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', this.diamond.address)

    this.empty = {
      diamondCut: [],
      initFacetAddress: ZERO_ADDRESS,
      functionCall: '0x'
    }

    this.bip = await upgradeWithNewFacets ({
      diamondAddress: this.diamond.address,
      facetNames: ['MockUpgradeFacet'],
      selectorsToRemove: [],
      initFacetName: 'MockUpgradeInitDiamond',
      initArgs: [],
      object: true,
      verbose: false,
    })

    await this.bean.mint(userAddress, '1000000');
    await this.bean.mint(user2Address, '1000000');
    await this.bean.mint(user3Address, '1000000');
    await this.bean.connect(user).approve(this.governance.address, '100000000000');
    await this.bean.connect(owner).approve(this.governance.address, '100000000000');
  });

  beforeEach(async function () {
    await this.season.resetAccount(userAddress)
    await this.season.resetAccount(user2Address)
    await this.season.resetAccount(user3Address)
    await this.season.resetAccount(ownerAddress)
    await this.season.resetState();
    await this.season.siloSunrise(0);
    await this.silo.depositSiloAssetsE(userAddress, '500', '1000000');
    await this.silo.depositSiloAssetsE(ownerAddress, '500', '1000000');
  });

  describe('propose', function () {
    describe('revert', async function () {
      it('revert if not enough stalk', async function () {
        await expect(this.governance.connect(user3).propose(this.bip.diamondCut, this.bip.initFacetAddress, this.bip.functionCall, 0)).to.revertedWith("Governance: Not enough Stalk.")
      })

      it('revert if not enough stalk', async function () {
        await propose(owner, this.governance, this.bip);
        await propose(owner, this.governance, this.bip);
        await propose(owner, this.governance, this.bip);
        await propose(owner, this.governance, this.bip);
        await propose(owner, this.governance, this.bip);
        await expect(this.governance.connect(owner).propose(
          this.bip.diamondCut, 
          this.bip.initFacetAddress, 
          this.bip.functionCall, 0
        )).to.revertedWith("Governance: Too many active BIPs.")
      })

      it('revert if not enough stalk', async function () {
        await expect(this.governance.connect(owner).propose(this.empty.diamondCut, this.empty.initFacetAddress, this.empty.functionCall, 0)).to.revertedWith("Governance: Proposition is empty.")
      })

      it ('reverts if calldata with no init address', async function () {
        await expect(this.governance.connect(owner).propose(this.bip.diamondCut, this.empty.initFacetAddress, '0x1234', 0)).to.revertedWith("Governance: calldata not empty.")
      })
    })
    
    describe("Propose", async function () {
      beforeEach(async function () {
        this.result = await propose(owner, this.governance, this.bip);
      })

      it("adds active bip", async function () {
        activeBips = await this.governance.activeBips();
        expect(activeBips[0]).to.eq(0);
      })

      it("sets the bip in storage", async function () {
        const bip = await this.governance.bip(0)
        expect(bip.roots).to.equal(await this.silo.balanceOfRoots(ownerAddress))
        expect(bip.start).to.equal(await this.season.season())
        expect(bip.period).to.equal(168)
        expect(bip.proposer).to.equal(ownerAddress)
        expect(bip.executed).to.equal(false)
      })

      it("votes on behalf of the user", async function () {
        await this.governance.voted(ownerAddress, 0)
        expect(this.result).to.emit(this.governance, "Vote").withArgs(ownerAddress, 0, await this.silo.balanceOfRoots(ownerAddress));
      })

      it('emits a proposition event', async function () {
        expect(this.result).to.emit(this.governance, "Proposal").withArgs(ownerAddress, 0, await this.season.season(), 168);
      })
    })

  });

  describe('vote', function () {
  //   beforeEach(async function () {
  //     await this.silo.depositSiloAssetsE(user3Address, '500', '1000000');
  //     await propose(owner, this.governance, this.bip);
  //     await propose(owner, this.governance, this.bip);
  //     await propose(owner, this.governance, this.bip);
  //     await propose(owner, this.governance, this.bip);

  //     await this.governance.connect(user).vote(0);
  //   });

  //   it('sets vote counter correctly', async function () {
  //     const ownerRoots = await this.silo.balanceOfRoots(ownerAddress);
  //     const userRoots = await this.silo.balanceOfRoots(userAddress);
  //     expect(await this.governance.rootsFor(0)).to.be.equal(ownerRoots.add(userRoots))
  //     expect(await this.governance.rootsFor(1)).to.be.equal(await this.silo.balanceOfRoots(ownerAddress));
  //     expect(await this.governance.rootsFor(3)).to.be.equal(await this.silo.balanceOfRoots(ownerAddress));
  //   });

  //   it('is active', async function () {
  //     activeBips = await this.governance.activeBips();
  //     expect(activeBips[0]).to.eq(0);
  //     expect(activeBips[1]).to.eq(1);
  //     expect(activeBips[2]).to.eq(2);
  //     expect(activeBips[3]).to.eq(3);
  //   });

  //   it('reverts an invalid vote properly in voteList', async function () {
  //     await expect(this.governance.connect(user).voteAll([0, 1, 2, 3])).to.be.revertedWith('Governance: Already voted.');
  //   });

  //   it('reverts a voter without stalk properly in voteList', async function () {
  //     await expect(this.governance.connect(user2).voteAll([2, 3])).to.be.revertedWith('Governance: Must have Stalk.');;
  //   });

  //   it('reverts a voter after the bip is no longer active in voteList', async function () {
  //     // 168
  //     await this.season.farmSunrises('169')
  //     await expect(this.governance.connect(user).voteAll([2, 3])).to.be.revertedWith('Governance: Ended.');
  //   });

  //   it('reverts a non nominated vote in voteList', async function(){
  //     await expect(this.governance.connect(user).voteAll([5])).to.be.revertedWith('Governance: Not nominated.');
  //   });

  //   it('records vote in voteList', async function () {
  //     expect(await this.governance.voted(userAddress, 0)).to.equal(true);
  //   });

  //   it('records multiple votes in voteList', async function () {
  //     await this.governance.connect(user3).voteAll([0, 1, 2]);
  //     expect(await this.governance.voted(user3Address, 0)).to.equal(true);
  //     expect(await this.governance.voted(user3Address, 1)).to.equal(true);
  //     expect(await this.governance.voted(user3Address, 2)).to.equal(true);
  //   });

  //   it('reverts a proposer vote properly in unvoteList', async function () {
  //     await expect(this.governance.connect(owner).unvoteAll([0])).to.be.revertedWith('Governance: Is proposer.');;
  //   });

  //   it('reverts an invalid vote properly in unvoteList', async function () {
  //     await expect(this.governance.connect(user).unvoteAll([2, 3])).to.be.revertedWith('Governance: Not voted.');;
  //   });

  //   it('reverts an unvoter without stalk properly in unvoteList', async function () {
  //     await expect(this.governance.connect(user2).unvoteAll([2, 3])).to.be.revertedWith('Governance: Must have Stalk.');;
  //   });

  //   it('reverts a proposer vote properly in unvoteList', async function () {
  //     await expect(this.governance.connect(owner).unvoteAll([0])).to.be.revertedWith('Governance: Is proposer.');;
  //   });

  //   it('reverts a voter after the bip is no longer active in voteList', async function () {
  //     // 168
  //     await this.season.farmSunrises('169')
  //     await expect(this.governance.connect(user).unvoteAll([2, 3])).to.be.revertedWith('Governance: Ended.');
  //   });

  //   it('reverts a non nominated vote in voteList', async function(){
  //     await expect(this.governance.connect(user).unvoteAll([5])).to.be.revertedWith('Governance: Not nominated.');
  //   });

  //   it('records single unvote in unvoteList', async function () {
  //     await this.governance.connect(user).unvoteAll([0]);
  //     expect(await this.governance.voted(userAddress, 0)).to.equal(false);
  //   });

  //   it('records multiple unvotes in unvoteList', async function () {
      
  //     await this.governance.connect(user).voteAll([1, 2, 3]);
  //     await this.governance.connect(user).unvote(1);
  //     await this.governance.connect(user).unvoteAll([0, 2, 3]);
  //     expect(await this.governance.voted(userAddress, 1)).to.equal(false);
  //     expect(await this.governance.voted(userAddress, 2)).to.equal(false);
  //     expect(await this.governance.voted(userAddress, 3)).to.equal(false);
  //   });

  //   it('reverts a voter without stalk properly in voteList', async function () {
  //     await expect(this.governance.connect(user2).voteUnvoteAll([2, 3])).to.be.revertedWith('Governance: Must have Stalk.');;
  //   });

  //   it('reverts a proposer vote properly in voteUnvoteAll', async function () {
  //     await expect(this.governance.connect(owner).voteUnvoteAll([0])).to.be.revertedWith('Governance: Is proposer.');;
  //   });

  //   it('reverts a voter after the bip is no longer active in voteList', async function () {
  //     // 168
  //     await this.season.farmSunrises('169')
  //     await expect(this.governance.connect(user).voteUnvoteAll([2, 3])).to.be.revertedWith('Governance: Ended.');
  //   });

  //   it('reverts a non nominated vote in voteList', async function(){
  //     await expect(this.governance.connect(user).voteUnvoteAll([5])).to.be.revertedWith('Governance: Not nominated.');
  //   });

  //   it('records single votes and unvotes in voteUnvoteAll', async function() {
  //     await this.governance.connect(user3).vote(0);
  //     await this.governance.connect(user3).vote(1);
  //     await this.governance.connect(user3).voteUnvoteAll([0, 1, 2]);
  //     expect(await this.governance.voted(user3Address, 0)).to.equal(false);
  //     expect(await this.governance.voted(user3Address, 1)).to.equal(false);
  //     expect(await this.governance.voted(user3Address, 2)).to.equal(true);
  //   });

  //   it('voter cant unvote', async function () {
  //     expect(await this.silo.voted(userAddress)).to.equal(true);
  //   });

  //   it('voter can revote', async function () {
  //     expect(await this.silo.voted(user2Address)).to.equal(false);
  //   });

  // });

  // describe('vote and withdraw', function () {
  //   beforeEach(async function () {
  //     await propose(owner, this.governance, this.bip);
  //     await propose(owner, this.governance, this.bip);
  //     await propose(owner, this.governance, this.bip);
  //     await propose(owner, this.governance, this.bip);
  //     await propose(owner, this.governance, this.bip);

  //     await this.governance.connect(user).vote(1);

  //     await this.silo.withdrawSiloAssetsE(userAddress, '500', '500000');
  //   });

  //   it('reverts when owner withdraws too much', async function () {
  //     await expect(this.silo.withdrawSiloAssetsE(ownerAddress, '500', '999500')).to.be.revertedWith('Silo: Proposer must have min Stalk.');
  //   });

  //   it('allows owner to withdraw enough', async function () {
  //     await this.silo.withdrawSiloAssetsE(ownerAddress, '500', '999400');
  //     expect(await this.silo.balanceOfStalk(ownerAddress)).to.be.equal('600');
  //   })

  //   it('sets vote counter correctly', async function () {
  //     expect(await this.governance.rootsFor(0)).to.be.equal(await this.silo.balanceOfRoots(ownerAddress));
  //     expect(await this.governance.rootsFor(1)).to.be.equal(await this.silo.totalRoots());
  //     expect(await this.governance.rootsFor(2)).to.be.equal(await this.silo.balanceOfRoots(ownerAddress));
  //     expect(await this.governance.rootsFor(3)).to.be.equal(await this.silo.balanceOfRoots(ownerAddress));
  //   });

  //   it('removes the stalk correctly from silo after one withdrawal', async function () {
  //     expect(await this.silo.balanceOfStalk(userAddress)).to.eq('500000');
  //   })

  //   it('roots and stalk are correct after one deposit and withdrawal', async function () {
  //     await this.silo.depositSiloAssetsE(userAddress, '500', '1000000');
  //     await this.silo.withdrawSiloAssetsE(userAddress, '500', '1000000');
  //     expect(await this.silo.balanceOfStalk(userAddress)).to.eq('500000');
  //   })

  //   it('roots and stalk are correct after many deposits and withdrawals', async function () {
  //     await this.silo.depositSiloAssetsE(userAddress, '500', '1000000');
  //     await this.silo.depositSiloAssetsE(userAddress, '1000', '1000000');
  //     await this.silo.withdrawSiloAssetsE(userAddress, '500', '500000');
  //     await this.silo.withdrawSiloAssetsE(userAddress, '500', '500000');
  //     await this.silo.withdrawSiloAssetsE(userAddress, '500', '500000');
  //     expect(await this.governance.rootsFor(1)).to.be.equal(await this.silo.totalRoots());
  //     expect(await this.silo.balanceOfStalk(userAddress)).to.eq('1000000');
  //   })

  //   it('roots and stalk are correct after proposer withdraws under the min required for a bip', async function () {
  //     await this.silo.withdrawSiloAssetsE(ownerAddress, '500', '500000');
  //     expect(await this.silo.balanceOfStalk(userAddress)).to.eq('500000');
  //     expect(await this.governance.rootsFor(0)).to.be.equal(await this.silo.balanceOfRoots(ownerAddress));
  //   })

  //   it('roots are correct after supply increases', async function () {
  //     await this.season.siloSunrise(1000000);
  //     expect(await this.governance.rootsFor(1)).to.be.equal(await this.silo.totalRoots());
  //   })

  //   it('is active', async function () {
  //     activeBips = await this.governance.activeBips();
  //     expect(activeBips[0]).to.eq(0);
  //     expect(activeBips[1]).to.eq(1);
  //     expect(activeBips[2]).to.eq(2);
  //     expect(activeBips[3]).to.eq(3);
  //   });

  //   it('records vote in voteList', async function () {
  //     expect(await this.governance.voted(userAddress, 1)).to.equal(true);
  //   });

  });
});