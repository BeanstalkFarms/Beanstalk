const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { BigNumber } = require('bignumber.js')
const { print } = require('./utils/print.js')

let user,user2,owner;
let userAddress, ownerAddress, user2Address;

describe('Claim2', function () {
  before(async function () {
    [owner,user,user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
    this.claim = await ethers.getContractAt('MockClaimFacet', this.diamond.address)
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address)
    this.field = await ethers.getContractAt('MockFieldFacet', this.diamond.address)
    this.pair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pair)
    this.pegPair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pegPair)
    this.bean = await ethers.getContractAt('MockToken', contracts.bean)
    this.weth = await ethers.getContractAt('MockToken', contracts.weth)

    await this.season.siloSunrise(0)
    await this.bean.mint(userAddress, '1000000000')
    await this.bean.mint(user2Address, '1000000000')
    await this.bean.mint(this.pair.address, '100000')
    await this.weth.mint(this.pair.address, '100')
    await this.pair.connect(user).approve(this.silo.address, '100000000000')
    await this.pair.connect(user2).approve(this.silo.address, '100000000000')
    await this.bean.connect(user).approve(this.silo.address, '100000000000')
    await this.bean.connect(user2).approve(this.silo.address, '100000000000')
    await this.pair.faucet(userAddress, '100');
    await this.pair.set('100000', '100','1');

    await user.sendTransaction({
        to: this.weth.address,
        value: ethers.utils.parseEther("1.0")
    });
  });

  beforeEach (async function () {
    await this.season.resetAccount(userAddress)
    await this.season.resetAccount(user2Address)
    await this.season.resetAccount(ownerAddress)
    await this.season.resetState()
    await this.season.siloSunrise(0)
  });

  describe("Legacy", async function () {
    describe("Bean", async function () {
      beforeEach(async function () {
        await this.silo.connect(user).mockLegacyBeanWithdraw('2', '100');
      });

      describe("Legacy Bean Claim", async function() {
        beforeEach(async function () {
          const beforeBeans = await this.bean.balanceOf(userAddress);
          this.result = await this.claim.connect(user).claimLegacyBeans(['2']);
          const afterBeans = await this.bean.balanceOf(userAddress);
          this.deltaBeans = afterBeans.sub(beforeBeans);
        });

        it('claims Beans', async function () {
          expect(this.deltaBeans).to.be.equal('100');
          const wrappedBeans = await this.claim.wrappedBeans(userAddress);
          expect(wrappedBeans).to.be.equal('0');
          expect(wrappedBeans.add(this.deltaBeans)).to.be.equal('100')
        });

        it('updates Beanstalk state', async function () {
          expect(await this.silo.totalWithdrawn(this.bean.address)).to.be.equal('0');
          expect(await this.silo.legacyBeanWithdrawal(userAddress, 2)).to.be.equal('0');
        })

        it('emits claim event', async function () {
          expect(this.result).to.emit(this.claim, 'BeanClaim').withArgs(userAddress, [2], '100');
        });
      });

      describe("Single Advanced Claim to Wallet", async function() {
        beforeEach(async function () {
          const beforeBeans = await this.bean.balanceOf(userAddress);
          this.result = await this.claim.connect(user).singleAdvancedClaim([this.bean.address, ['2'],1,[]], true);
          const afterBeans = await this.bean.balanceOf(userAddress);
          this.deltaBeans = afterBeans.sub(beforeBeans);
        });

        it('claims Beans', async function () {
          expect(this.deltaBeans).to.be.equal('100');
          const wrappedBeans = await this.claim.wrappedBeans(userAddress);
          expect(wrappedBeans).to.be.equal('0');
          expect(wrappedBeans.add(this.deltaBeans)).to.be.equal('100')
        });

        it('updates Beanstalk state', async function () {
          expect(await this.silo.totalWithdrawn(this.bean.address)).to.be.equal('0');
          expect(await this.silo.legacyBeanWithdrawal(userAddress, 2)).to.be.equal('0');
        })

        it('emits claim event', async function () {
          expect(this.result).to.emit(this.claim, 'BeanClaim').withArgs(userAddress, [2], '100');
        });
      });

      describe("Single Advanced Claim to Wrapped", async function() {
        beforeEach(async function () {
          const beforeBeans = await this.bean.balanceOf(userAddress);
          this.result = await this.claim.connect(user).singleAdvancedClaim([this.bean.address, ['2'],1,[]], false);
          const afterBeans = await this.bean.balanceOf(userAddress);
          this.deltaBeans = afterBeans.sub(beforeBeans);
        });

        it('claims Beans', async function () {
          expect(this.deltaBeans).to.be.equal('0');
          const wrappedBeans = await this.claim.wrappedBeans(userAddress);
          expect(wrappedBeans).to.be.equal('100');
          expect(wrappedBeans.add(this.deltaBeans)).to.be.equal('100')
        });

        it('updates Beanstalk state', async function () {
          expect(await this.silo.totalWithdrawn(this.bean.address)).to.be.equal('0');
          expect(await this.silo.legacyBeanWithdrawal(userAddress, 2)).to.be.equal('0');
        })

        it('emits claim event', async function () {
          expect(this.result).to.emit(this.claim, 'BeanClaim').withArgs(userAddress, [2], '100');
        });
      });

      describe("Multi Advanced Claim to Wallet", async function() {
        beforeEach(async function () {
          const beforeBeans = await this.bean.balanceOf(userAddress);
          this.result = await this.claim.connect(user).advancedClaim([[this.bean.address, ['2'],1,[]]], true);
          const afterBeans = await this.bean.balanceOf(userAddress);
          this.deltaBeans = afterBeans.sub(beforeBeans);
        });

        it('claims Beans', async function () {
          expect(this.deltaBeans).to.be.equal('100');
          const wrappedBeans = await this.claim.wrappedBeans(userAddress);
          expect(wrappedBeans).to.be.equal('0');
          expect(wrappedBeans.add(this.deltaBeans)).to.be.equal('100')
        });

        it('updates Beanstalk state', async function () {
          expect(await this.silo.totalWithdrawn(this.bean.address)).to.be.equal('0');
          expect(await this.silo.legacyBeanWithdrawal(userAddress, 2)).to.be.equal('0');
        })

        it('emits claim event', async function () {
          expect(this.result).to.emit(this.claim, 'BeanClaim').withArgs(userAddress, [2], '100');
        });
      });

      describe("Multi Advanced Claim to Wrapped", async function() {
        beforeEach(async function () {
          const beforeBeans = await this.bean.balanceOf(userAddress);
          this.result = await this.claim.connect(user).advancedClaim([[this.bean.address, ['2'],1,[]]], false);
          const afterBeans = await this.bean.balanceOf(userAddress);
          this.deltaBeans = afterBeans.sub(beforeBeans);
        });

        it('claims Beans', async function () {
          expect(this.deltaBeans).to.be.equal('0');
          const wrappedBeans = await this.claim.wrappedBeans(userAddress);
          expect(wrappedBeans).to.be.equal('100');
          expect(wrappedBeans.add(this.deltaBeans)).to.be.equal('100')
        });

        it('updates Beanstalk state', async function () {
          expect(await this.silo.totalWithdrawn(this.bean.address)).to.be.equal('0');
          expect(await this.silo.legacyBeanWithdrawal(userAddress, 2)).to.be.equal('0');
        })

        it('emits claim event', async function () {
          expect(this.result).to.emit(this.claim, 'BeanClaim').withArgs(userAddress, [2], '100');
        });
      });
    });

    describe("LP", async function () {
      beforeEach(async function () {
        await this.silo.connect(user).mockLegacyLPWithdraw('2', '1');
      });

      describe("Legacy LP Claim", async function() {
        beforeEach(async function () {
          const beforeLP = await this.pair.balanceOf(userAddress);
          this.result = await this.claim.connect(user).claimLegacyLP(['2']);
          const afterLP = await this.pair.balanceOf(userAddress);
          this.deltaLP = afterLP.sub(beforeLP);
        });

        it('claims LP', async function () {
          expect(this.deltaLP).to.be.equal('1');
          const wrappedBeans = await this.claim.wrappedBeans(userAddress);
          expect(wrappedBeans).to.be.equal('0');
        });

        it('updates Beanstalk state', async function () {
          expect(await this.silo.totalWithdrawn(this.pair.address)).to.be.equal('0');
          expect(await this.silo.legacyLPWithdrawal(userAddress, 2)).to.be.equal('0');
        })

        it('emits claim event', async function () {
          expect(this.result).to.emit(this.claim, 'LPClaim').withArgs(userAddress, [2], '1');
        });
      });

      describe("Single Advanced Claim to Wallet", async function() {
        beforeEach(async function () {
          const beforeLP = await this.pair.balanceOf(userAddress);
          this.result = await this.claim.connect(user).singleAdvancedClaim([this.pair.address, [2],1,['100','100']], true);
          const afterLP = await this.pair.balanceOf(userAddress);
          this.deltaLP = afterLP.sub(beforeLP);
        });

        it('claims LP', async function () {
          expect(this.deltaLP).to.be.equal('1');
          const wrappedBeans = await this.claim.wrappedBeans(userAddress);
          expect(wrappedBeans).to.be.equal('0');
        });

        it('updates Beanstalk state', async function () {
          expect(await this.silo.totalWithdrawn(this.pair.address)).to.be.equal('0');
          expect(await this.silo.legacyLPWithdrawal(userAddress, 2)).to.be.equal('0');
        })

        it('emits claim event', async function () {
          expect(this.result).to.emit(this.claim, 'LPClaim').withArgs(userAddress, [2], '1');
        });
      });

      describe("Single Advanced Claim and Remove to Wallet", async function() {
        beforeEach(async function () {
          const beforeBeans = await this.bean.balanceOf(userAddress);
          this.result = await this.claim.connect(user).singleAdvancedClaim([this.pair.address, ['2'],3,['100','1']], true);
          const afterBeans = await this.bean.balanceOf(userAddress);
          this.deltaBeans = afterBeans.sub(beforeBeans);
        });

        it('claims Beans', async function () {
          expect(this.deltaBeans).to.be.equal('1000');
          const wrappedBeans = await this.claim.wrappedBeans(userAddress);
          expect(wrappedBeans).to.be.equal('0');
          expect(wrappedBeans.add(this.deltaBeans)).to.be.equal('1000')
        });

        it('updates Beanstalk state', async function () {
          expect(await this.silo.totalWithdrawn(this.bean.address)).to.be.equal('0');
          expect(await this.silo.legacyBeanWithdrawal(userAddress, 2)).to.be.equal('0');
        })

        it('emits claim event', async function () {
          expect(this.result).to.emit(this.claim, 'LPClaim').withArgs(userAddress, [2], '1');
        });
      });

      describe("Single Advanced Claim and Remove to Wrapped", async function() {
        beforeEach(async function () {
          const beforeBeans = await this.bean.balanceOf(userAddress);
          this.result = await this.claim.connect(user).singleAdvancedClaim([this.pair.address, ['2'],3,['100','1']], false);
          const afterBeans = await this.bean.balanceOf(userAddress);
          this.deltaBeans = afterBeans.sub(beforeBeans);
        });

        it('claims Beans', async function () {
          expect(this.deltaBeans).to.be.equal('0');
          const wrappedBeans = await this.claim.wrappedBeans(userAddress);
          expect(wrappedBeans).to.be.equal('1000');
          expect(wrappedBeans.add(this.deltaBeans)).to.be.equal('1000')
        });

        it('updates Beanstalk state', async function () {
          expect(await this.silo.totalWithdrawn(this.bean.address)).to.be.equal('0');
          expect(await this.silo.legacyBeanWithdrawal(userAddress, 2)).to.be.equal('0');
        })

        it('emits claim event', async function () {
          expect(this.result).to.emit(this.claim, 'LPClaim').withArgs(userAddress, [2], '1');
        });
      });
    });
  });

  describe('claim', function () {
    beforeEach(async function () {
      await this.silo.connect(user).depositBeans('1000')
      await this.silo.connect(user).depositLP('1')
      await this.season.setSoilE('5000')
      await this.field.connect(user).sowBeans('1000')
      await this.field.incrementTotalHarvestableE('1000')
      await this.silo.connect(user).withdrawBeans([2],['1000'])
      await this.silo.connect(user).withdraw(this.pair.address, [2],['1'])
      await this.season.farmSunrises('25')
    });

    describe('general claim', async function () {
      describe('Beans not to wallet', async function () {  
        beforeEach(async function () {
          const beans = await this.bean.balanceOf(userAddress)
          this.result = await this.claim.connect(user).claim([[],[], [[this.bean.address, ['27'], 0, []]], false, false])
          const newBeans = await this.bean.balanceOf(userAddress)
          this.claimedBeans = newBeans.sub(beans)
          this.wrappedBeans = await this.claim.connect(user).wrappedBeans(userAddress)
        });

        it('properly sends beans to wallet', async function () {
          expect(this.claimedBeans.toString()).to.equal('0');
        });

        // Before partial claiming, was claimedBeans and not wrappedBeans
        it('properly claims beans', async function () {
          expect(this.wrappedBeans.toString()).to.equal('1000');
        });
        it('no beans created or destroyed', async function () {
          expect(this.claimedBeans.add(this.wrappedBeans).toString()).to.equal('1000');
        });
      });
    });

    describe('Beans to wallet', async function () {  
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        this.result = await this.claim.connect(user).claim([[],[], [[this.bean.address, ['27'], 0, []]], false, true])
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.sub(beans)
        this.wrappedBeans = await this.claim.connect(user).wrappedBeans(userAddress)
      });

      it('properly sends beans to wallet', async function () {
        expect(this.claimedBeans.toString()).to.equal('1000');
        expect(this.wrappedBeans.toString()).to.equal('0');
      });

      // Before partial claiming, was claimedBeans and not wrappedBeans
      it('properly claims beans', async function () {
        expect(this.wrappedBeans.toString()).to.equal('0');
      });
      it('no beans created or destroyed', async function () {
        expect(this.claimedBeans.add(this.wrappedBeans).toString()).to.equal('1000');
      });
    });
  });

  describe('claim', function () {
    beforeEach(async function () {
      await this.silo.connect(user).depositBeans('1000')
      await this.silo.connect(user).depositLP('1')
      await this.season.setSoilE('5000')
      await this.field.connect(user).sowBeans('1000')
      await this.field.incrementTotalHarvestableE('1000')
      await this.silo.connect(user).withdrawBeans([2],['1000'])
      await this.silo.connect(user).withdraw(this.pair.address, [2],['1'])
      await this.season.farmSunrises('25')
    });

    describe('general claim', async function () {
      describe('Beans not to wallet', async function () {  
        beforeEach(async function () {
          const beans = await this.bean.balanceOf(userAddress)
          this.result = await this.claim.connect(user).claim([[],[], [[this.bean.address, ['27'], 0, []]], false, false])
          const newBeans = await this.bean.balanceOf(userAddress)
          this.claimedBeans = newBeans.sub(beans)
          this.wrappedBeans = await this.claim.connect(user).wrappedBeans(userAddress)
        });

        it('properly sends beans to wallet', async function () {
          expect(this.claimedBeans.toString()).to.equal('0');
        });

        // Before partial claiming, was claimedBeans and not wrappedBeans
        it('properly claims beans', async function () {
          expect(this.wrappedBeans.toString()).to.equal('1000');
        });
        it('no beans created or destroyed', async function () {
          expect(this.claimedBeans.add(this.wrappedBeans).toString()).to.equal('1000');
        });
      });
    });

    describe('Beans to wallet', async function () {  
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        this.result = await this.claim.connect(user).claim([[],[], [[this.bean.address, ['27'], 0, []]], false, true])
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.sub(beans)
        this.wrappedBeans = await this.claim.connect(user).wrappedBeans(userAddress)
      });

      it('properly sends beans to wallet', async function () {
        expect(this.claimedBeans.toString()).to.equal('1000');
      });

      // Before partial claiming, was claimedBeans and not wrappedBeans
      it('properly claims beans', async function () {
        expect(this.wrappedBeans.toString()).to.equal('0');
      });
      it('no beans created or destroyed', async function () {
        expect(this.claimedBeans.add(this.wrappedBeans).toString()).to.equal('1000');
      });
    });
  });
});
