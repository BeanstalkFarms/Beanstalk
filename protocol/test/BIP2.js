const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { BigNumber } = require('bignumber.js')
const { print } = require('./utils/print.js')

let user,user2,owner;
let userAddress, ownerAddress, user2Address;

describe('BIP2', function () {
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

  describe('claimBeans', function () {
    beforeEach(async function () {
      await this.silo.connect(user).depositBeans('1000')
      await this.silo.connect(user).depositLP('1')
      await this.season.incrementTotalSoilE('5000')
      await this.field.connect(user).sowBeans('1000')
      await this.field.incrementTotalHarvestableE('1000')
      await this.silo.connect(user).withdrawBeans([2],['1000'])
      await this.silo.connect(user).withdrawLP([2],['1'])
      await this.season.farmSunrises('25')
    });

    describe('claim', function () {
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        this.result = await this.claim.connect(user).claim([['27'],[],[],false,true,'0','0'])
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.sub(beans)
      });

      it('properly claims beans', async function () {
        expect(this.claimedBeans.toString()).to.equal('1000');
      });
    });

    describe('claim and allocate', function () {
      describe('exact allocate', async function () {
        beforeEach(async function () {
          const beans = await this.bean.balanceOf(userAddress)
          this.result = await this.claim.connect(user).claimWithAllocationE([['27'],[],[],false,true,'0','0'], '1000')
          const newBeans = await this.bean.balanceOf(userAddress)
          this.claimedBeans = newBeans.sub(beans)
        });
        it('properly claims beans', async function () {
          expect(this.claimedBeans.toString()).to.equal('0');
        });
        it('properly allocates beans', async function () {
          expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1000');
        });
      });

      describe('exact LP allocate', async function () {
        beforeEach(async function () {
          const beans = await this.bean.balanceOf(userAddress)
          this.result = await this.claim.connect(user).claimWithAllocationE([[],['27'],[],false,true,'0','0'], '1000')
          const newBeans = await this.bean.balanceOf(userAddress)
          this.claimedBeans = newBeans.sub(beans)
        });
        it('properly claims beans', async function () {
          expect(this.claimedBeans.toString()).to.equal('0');
        });
        it('properly claims eth', async function () {
          await expect(this.result).to.changeEtherBalance(user,'1')
        })
        it('properly allocates beans', async function () {
          expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1000');
        });
      });

      describe('under allocate', async function () {
        beforeEach(async function () {
          const beans = await this.bean.balanceOf(userAddress)
          this.result = await this.claim.connect(user).claimWithAllocationE([['27'],[],[],false,true,'0','0'], '500')
          const newBeans = await this.bean.balanceOf(userAddress)
          this.claimedBeans = newBeans.sub(beans)
        });
        it('properly claims beans', async function () {
          expect(this.claimedBeans.toString()).to.equal('500');
        });
        it('properly allocates beans', async function () {
          expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '500');
        });
      });

      describe('over allocate', async function () {
        beforeEach(async function () {
          const beans = await this.bean.balanceOf(userAddress)
          this.result = await this.claim.connect(user).claimWithAllocationE([['27'],[],[],false,true,'0','0'], '1500')
          const newBeans = await this.bean.balanceOf(userAddress)
          this.claimedBeans = newBeans.sub(beans)
        });
        it('properly claims beans', async function () {
          expect(this.claimedBeans.toString()).to.equal('-500');
        });
        it('properly allocates beans', async function () {
          expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1000');
        });
      });

      describe('multiple allocate', async function () {
        beforeEach(async function () {
          const beans = await this.bean.balanceOf(userAddress)
          this.result = await this.claim.connect(user).claimWithAllocationE([['27'],[],['0'],false,true,'0','0'], '1500')
          const newBeans = await this.bean.balanceOf(userAddress)
          this.claimedBeans = newBeans.sub(beans)
        });
        it('properly claims beans', async function () {
          expect(this.claimedBeans.toString()).to.equal('500');
        });
        it('properly allocates beans', async function () {
          expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1500');
        });
      });
    });

    describe('claim and deposit Beans', function () {
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        this.result = await this.silo.connect(user).claimAndDepositBeans('1000', [['27'],[],[],false,true,'0','0'])
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.sub(beans)
      });
      it('properly claims beans', async function () {
        expect(this.claimedBeans.toString()).to.equal('0');
      });
      it('properly allocates beans', async function () {
        expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1000');
        expect(this.result).to.emit(this.silo , 'BeanDeposit').withArgs(userAddress, '27', '1000');
      });
    });

    describe('claim buy and deposit Beans', function () {
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        this.result = await this.silo.connect(user).claimBuyAndDepositBeans('1000', '990', [['27'],[],[],false,true,'0','0'], {value: '1'})
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.sub(beans)
      });
      it('properly claims beans', async function () {
        expect(this.claimedBeans.toString()).to.equal('0');
      });
      it('properly allocates beans', async function () {
        expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1000');
        expect(this.result).to.emit(this.silo, 'BeanDeposit').withArgs(userAddress, '27', '1990');
      });
    });

    describe('claim and sow Beans', function () {
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        this.result = await this.field.connect(user).claimAndSowBeans('1000', [['27'],[],[],false,true,'0','0'])
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.sub(beans)
      });
      it('properly claims beans', async function () {
        expect(this.claimedBeans.toString()).to.equal('0');
      });
      it('properly allocates beans', async function () {
        expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1000');
        expect(this.result).to.emit(this.field, 'Sow').withArgs(userAddress, '1000', '1000', '1000');
      });
    });

    describe('claim, buy and sow Beans', function () {
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        this.result = await this.field.connect(user).claimBuyAndSowBeans('1000', '990', [['27'],[],[],false,true,'0','0'], {value: '1'})
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.sub(beans)
      });
      it('properly claims beans', async function () {
        expect(this.claimedBeans.toString()).to.equal('0');
      });
      it('properly allocates beans', async function () {
        expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1000');
        expect(this.result).to.emit(this.field, 'Sow').withArgs(userAddress, '1000', '1990', '1990');
      });
    });

    describe('claim and deposit LP', function () {
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        this.silo.connect(user).claimAndDepositLP('1',[['27'],[],[],false,true,'0','0']);
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.sub(beans)
      });
      it('properly claims beans', async function () {
        expect(this.claimedBeans.toString()).to.equal('1000');
      });
    });

    describe('claim add and deposit LP, exact allocation', function () {
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        this.result = this.silo.connect(user).claimAddAndDepositLP('0','0','0', ['1000','1000','1'],[['27'],[],[],false,true,'0','0'], {value: '1'});
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.sub(beans)
      });
      it('properly claims beans', async function () {
        expect(this.claimedBeans.toString()).to.equal('0');
      });
      it('properly allocates beans', async function () {
        expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1000');
      });
    });

    describe('claim add and deposit LP, over allocation', function () {
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        this.result = this.silo.connect(user).claimAddAndDepositLP('0','0','0', ['1000','1000','1'],[['27'],[],['0'],false,true,'0','0'], {value: '1'});
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.sub(beans)
      });
      it('properly claims beans', async function () {
        expect(this.claimedBeans.toString()).to.equal('1000');
      });
      it('properly allocates beans', async function () {
        expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1000');
      });
    });

    describe('claim add and deposit LP, under allocation', function () {
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        this.result = this.silo.connect(user).claimAddAndDepositLP('0','0','0', ['2000','2000','2'],[['27'],[],[],false,true,'0','0'], {value: '2'});
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.sub(beans)
      });
      it('properly claims beans', async function () {
        expect(this.claimedBeans.toString()).to.equal('-1000');
      });
      it('properly allocates beans', async function () {
        expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1000');
      });
    });

    describe('claim add buy Beans and deposit LP, exact allocation', function () {
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        this.result = this.silo.connect(user).claimAddAndDepositLP('0','1000','0', ['2000','2000','2'],[['27'],[],[],false,true,'0','0'], {value: '4'});
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.sub(beans)
      });
      it('properly claims beans', async function () {
        expect(this.claimedBeans.toString()).to.equal('0');
      });
      it('properly allocates beans', async function () {
        expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1000');
      });
    });

    describe('claim add buy ETH and deposit LP, exact allocation', function () {
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        this.result = this.silo.connect(user).claimAddAndDepositLP('0','0','1',['2000','2000','2'],[['27'],[],['0'],false,true,'0','0'], {value: '1'});
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.sub(beans)
      });
      it('properly claims beans', async function () {
        expect(this.claimedBeans.toString()).to.equal('-1011');
      });
      it('properly allocates beans', async function () {
        expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '2000');
      });
    });
  });
});
