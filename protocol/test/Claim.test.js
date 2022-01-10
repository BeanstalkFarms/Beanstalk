const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { BigNumber } = require('bignumber.js')
const { print } = require('./utils/print.js')

let user,user2,owner;
let userAddress, ownerAddress, user2Address;

describe('Claim', function () {
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

  describe('claim', function () {
    beforeEach(async function () {
      await this.silo.connect(user).depositBeans('1000')
      await this.silo.connect(user).depositLP('1')
      await this.season.setSoilE('5000')
      await this.field.connect(user).sowBeans('1000')
      await this.field.incrementTotalHarvestableE('1000')
      await this.silo.connect(user).withdrawBeans([2],['1000'])
      await this.silo.connect(user).withdrawLP([2],['1'])
      await this.season.farmSunrises('25')
    });

    describe('claim beans', async function () {
      it('reverts when deposit is empty', async function () {
        await expect(this.claim.connect(user).claimBeans(['0'])).to.be.revertedWith('Claim: Bean withdrawal is empty.')
      });

      it('successfully claims beans', async function () {
        const beans = await this.bean.balanceOf(userAddress)
        await this.claim.connect(user).claimBeans(['27'])
        const newBeans = await this.bean.balanceOf(userAddress)
        expect(await this.silo.beanDeposit(userAddress, '27')).to.be.equal('0');
        expect(newBeans.sub(beans)).to.be.equal('1000');
      })
    });

    describe('harvest beans', async function () {
      it('reverts when plot is not harvestable', async function () {
        await expect(this.claim.connect(user).harvest(['1'])).to.be.revertedWith('Claim: Plot not harvestable.')
        await expect(this.claim.connect(user).harvest(['1000000'])).to.be.revertedWith('Claim: Plot not harvestable.')
      });

      it('successfully harvests beans', async function () {
        const beans = await this.bean.balanceOf(userAddress)
        await this.claim.connect(user).harvest(['0'])
        const newBeans = await this.bean.balanceOf(userAddress)
        expect(await this.field.plot(userAddress, '27')).to.be.equal('0');
        expect(newBeans.sub(beans)).to.be.equal('1000');
      })
    });

    describe('claim LP', async function () {
      it('reverts when deposit is not claimable', async function () {
        await expect(this.claim.connect(user).claimLP(['0'])).to.be.revertedWith('Claim: LP withdrawal is empty.')
      });

      it('successfully claims lp', async function () {
        const lp = await this.pair.balanceOf(userAddress)
        await this.claim.connect(user).claimLP(['27'])
        const newLP = await this.pair.balanceOf(userAddress)
        const lpDeposit = await this.silo.lpDeposit(userAddress, '27')
        expect(lpDeposit[0]).to.be.equal('0');
        expect(lpDeposit[1]).to.be.equal('0');
        expect(newLP.sub(lp)).to.be.equal('1');
      })
    });

    describe('claim all', async function () {
      describe('No Beans to wallet', async function () {  
        beforeEach(async function () {
          const beans = await this.bean.balanceOf(userAddress)
          this.result = await this.claim.connect(user).claim([['27'],[],[],false,true,'0','0', false])
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

      describe('Beans to wallet', async function () {  
        beforeEach(async function () {
          const beans = await this.bean.balanceOf(userAddress)
          this.result = await this.claim.connect(user).claim([['27'],[],[],false,true,'0','0', true])
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

    describe('claim and allocate', function () {
      describe('exact allocate', async function () {
        beforeEach(async function () {
          const beans = await this.bean.balanceOf(userAddress)
          this.result = await this.claim.connect(user).claimWithAllocationE([['27'],[],[],false,true,'0','0', false], '1000')
          const newBeans = await this.bean.balanceOf(userAddress)
          this.claimedBeans = newBeans.sub(beans)
	        this.wrappedBeans = await this.claim.connect(user).wrappedBeans(userAddress)
        });
        it('properly claims beans', async function () {
          expect(this.claimedBeans.toString()).to.equal('0');
          expect(this.wrappedBeans.toString()).to.equal('0');
        });
        it('properly allocates beans', async function () {
          expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1000');
        });
	      it('no beans created or destroyed', async function () {
          expect(this.claimedBeans.add(this.wrappedBeans).toString()).to.equal('0');
        });
      });

      describe('exact LP allocate', async function () {
        beforeEach(async function () {
          const beans = await this.bean.balanceOf(userAddress)
          this.result = await this.claim.connect(user).claimWithAllocationE([[],['27'],[],false, true, '1', '1', false], '1000')
          const newBeans = await this.bean.balanceOf(userAddress)
          this.claimedBeans = newBeans.sub(beans)
          this.wrappedBeans = await this.claim.connect(user).wrappedBeans(userAddress)
	      });
        it('properly claims beans', async function () {
          expect(this.claimedBeans.toString()).to.equal('0');
          expect(this.wrappedBeans.toString()).to.equal('0');
        });
        it('properly claims eth', async function () {
          await expect(this.result).to.changeEtherBalance(user,'1')
        })
        it('properly allocates beans', async function () {
          expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1000');
        });
	      it('no beans created or destroyed', async function () {
          expect(this.claimedBeans.add(this.wrappedBeans).toString()).to.equal('0');
        });
      });

      describe('under allocate', async function () {
        beforeEach(async function () {
          const beans = await this.bean.balanceOf(userAddress)
          this.result = await this.claim.connect(user).claimWithAllocationE([['27'],[],[],false,true,'0','0', false], '500')
          const newBeans = await this.bean.balanceOf(userAddress)
          this.claimedBeans = newBeans.sub(beans)
          this.wrappedBeans = await this.claim.connect(user).wrappedBeans(userAddress)
        });

        it('properly claims beans', async function () {
          expect(this.claimedBeans.toString()).to.equal('0');
          expect(this.wrappedBeans.toString()).to.equal('500');
        });
        it('properly allocates beans', async function () {
          expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '500');
        });
	      it('no beans created or destroyed', async function () {
          expect(this.claimedBeans.add(this.wrappedBeans).toString()).to.equal('500');
        });
      });

      describe('over allocate', async function () {
        beforeEach(async function () {
          const beans = await this.bean.balanceOf(userAddress)
          this.result = await this.claim.connect(user).claimWithAllocationE([['27'],[],[],false,true,'0','0', false], '1500')
          const newBeans = await this.bean.balanceOf(userAddress)
          this.claimedBeans = newBeans.sub(beans)
	        this.wrappedBeans = await this.claim.connect(user).wrappedBeans(userAddress)
	      });
        it('properly claims beans', async function () {
          expect(this.claimedBeans.toString()).to.equal('-500');
          expect(this.wrappedBeans.toString()).to.equal('0');
        });
        it('properly allocates beans', async function () {
          expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1000');
        });
	      it('no beans created or destroyed', async function () {
          expect(this.claimedBeans.add(this.wrappedBeans).toString()).to.equal('-500');
        });
      });

      describe('multiple allocate', async function () {
        beforeEach(async function () {
          const beans = await this.bean.balanceOf(userAddress)
          this.result = await this.claim.connect(user).claimWithAllocationE([['27'],[],['0'],false,true,'0','0', false], '1500')
          const newBeans = await this.bean.balanceOf(userAddress)
          this.claimedBeans = newBeans.sub(beans)
          this.wrappedBeans = await this.claim.connect(user).wrappedBeans(userAddress)
        });
        it('properly claims beans', async function () {
          expect(this.claimedBeans.toString()).to.equal('0');
          expect(this.wrappedBeans.toString()).to.equal('500');
        });
        it('properly allocates beans', async function () {
          expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1500');
        });
	      it('no beans created or destroyed', async function () {
          expect(this.claimedBeans.add(this.wrappedBeans).toString()).to.equal('500');
        });
      });

      describe('allocate with beans to wallet', async function () {
        beforeEach(async function () {
          const beans = await this.bean.balanceOf(userAddress)
          this.result = await this.claim.connect(user).claimWithAllocationE([['27'],[],[],false,true,'0','0', true], '500')
          const newBeans = await this.bean.balanceOf(userAddress)
          this.claimedBeans = newBeans.sub(beans)
	        this.wrappedBeans = await this.claim.connect(user).wrappedBeans(userAddress)
        });
        
        it('properly claims beans', async function () {
          expect(this.claimedBeans.toString()).to.equal('500');
          expect(this.wrappedBeans.toString()).to.equal('0');
        });

	      it('no beans created or destroyed', async function () {
          expect(this.claimedBeans.add(this.wrappedBeans).toString()).to.equal('500');
        });
      });
    });

    describe('claim and deposit Beans', function () {
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        this.result = await this.silo.connect(user).claimAndDepositBeans('1000', [['27'],[],[],false,true,'0','0', false])
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.sub(beans)
        this.wrappedBeans = await this.claim.connect(user).wrappedBeans(userAddress)
      });
      it('properly claims beans', async function () {
        expect(this.claimedBeans.toString()).to.equal('0');
      });
      it('properly allocates beans', async function () {
        expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1000');
        expect(this.result).to.emit(this.silo , 'BeanDeposit').withArgs(userAddress, '27', '1000');
      });
      it('no beans created or destroyed', async function () {
        expect(this.claimedBeans.add(this.wrappedBeans).toString()).to.equal('0');
      });
    });

    describe('claim buy and deposit Beans', function () {
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        this.result = await this.silo.connect(user).claimBuyAndDepositBeans('1000', '990', [['27'],[],[],false,true,'0','0', false], {value: '1'})
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.sub(beans)
        this.wrappedBeans = await this.claim.connect(user).wrappedBeans(userAddress)
      });
      it('properly claims beans', async function () {
        expect(this.claimedBeans.toString()).to.equal('0');
      });
      it('properly allocates beans', async function () {
        expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1000');
        expect(this.result).to.emit(this.silo, 'BeanDeposit').withArgs(userAddress, '27', '1990');
      });
      it('no beans created or destroyed', async function () {
        expect(this.claimedBeans.add(this.wrappedBeans).toString()).to.equal('0');
      });
    });

    describe('claim and sow Beans', function () {
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        this.result = await this.field.connect(user).claimAndSowBeans('1000', [['27'],[],[],false,true,'0','0', false])
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.sub(beans)
        this.wrappedBeans = await this.claim.connect(user).wrappedBeans(userAddress)
      });
      it('properly claims beans', async function () {
        expect(this.claimedBeans.toString()).to.equal('0');
      });
      it('properly allocates beans', async function () {
        expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1000');
        expect(this.result).to.emit(this.field, 'Sow').withArgs(userAddress, '1000', '1000', '1000');
      });
      it('no beans created or destroyed', async function () {
        expect(this.claimedBeans.add(this.wrappedBeans).toString()).to.equal('0');
      });
    });

    describe('claim, buy and sow Beans', function () {
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        this.result = await this.field.connect(user).claimBuyAndSowBeans('1000', '990', [['27'],[],[],false,true,'0','0', false], {value: '1'})
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.sub(beans)
        this.wrappedBeans = await this.claim.connect(user).wrappedBeans(userAddress)
      });
      it('properly claims beans', async function () {
        expect(this.claimedBeans.toString()).to.equal('0');
      });
      it('properly allocates beans', async function () {
        expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1000');
        expect(this.result).to.emit(this.field, 'Sow').withArgs(userAddress, '1000', '1990', '1990');
      });
      it('no beans created or destroyed', async function () {
        expect(this.claimedBeans.add(this.wrappedBeans).toString()).to.equal('0');
      });
    });

    describe('claim and deposit LP', function () {
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        this.silo.connect(user).claimAndDepositLP('1',[['27'],[],[],false,true,'0','0', false]);
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.sub(beans)
        this.wrappedBeans = await this.claim.connect(user).wrappedBeans(userAddress)
      });
      it('properly claims beans', async function () {
        expect(this.wrappedBeans.toString()).to.equal('1000');
      });
      it('no beans created or destroyed', async function () {
        expect(this.claimedBeans.add(this.wrappedBeans).toString()).to.equal('1000');
      });
    });

    describe('claim add and deposit LP, exact allocation', function () {
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        this.result = this.silo.connect(user).claimAddAndDepositLP('0','0','0', ['1000','1000','1'],[['27'],[],[],false,true,'0','0', false], {value: '1'});
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.sub(beans)
        this.wrappedBeans = await this.claim.connect(user).wrappedBeans(userAddress)
      });
      it('properly claims beans', async function () {
        expect(this.claimedBeans.toString()).to.equal('0');
      });
      it('properly allocates beans', async function () {
        expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1000');
      });
      it('no beans created or destroyed', async function () {
        expect(this.claimedBeans.add(this.wrappedBeans).toString()).to.equal('0');
      });
    });

    describe('claim add and deposit LP, over allocation', function () {
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        this.result = this.silo.connect(user).claimAddAndDepositLP('0','0','0', ['1000','1000','1'],[['27'],[],['0'],false,true,'0','0', false], {value: '1'});
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.sub(beans)
        this.wrappedBeans = await this.claim.connect(user).wrappedBeans(userAddress)
      });

      // Before partial claiming, was claimedBeans and not wrappedBeans
      it('properly claims beans', async function () {
        expect(this.wrappedBeans.toString()).to.equal('1000');
      });
      it('properly allocates beans', async function () {
        expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1000');
      });
      it('no beans created or destroyed', async function () {
        expect(this.claimedBeans.add(this.wrappedBeans).toString()).to.equal('1000');
      });
    });

    describe('claim add and deposit LP, under allocation', function () {
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        this.result = this.silo.connect(user).claimAddAndDepositLP('0','0','0', ['2000','2000','2'],[['27'],[],[],false,true,'0','0', false], {value: '2'});
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.sub(beans)
        this.wrappedBeans = await this.claim.connect(user).wrappedBeans(userAddress)
      });
      it('properly claims beans', async function () {
        expect(this.claimedBeans.toString()).to.equal('-1000');
      });
      it('properly allocates beans', async function () {
        expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1000');
      });
      it('no beans created or destroyed', async function () {
        expect(this.claimedBeans.add(this.wrappedBeans).toString()).to.equal('-1000');
      });
    });

    describe('claim add buy Beans and deposit LP, exact allocation', function () {
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        this.result = this.silo.connect(user).claimAddAndDepositLP('0','1000','0', ['2000','2000','2'],[['27'],[],[],false,true,'0','0', false], {value: '4'});
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.sub(beans)
        this.wrappedBeans = await this.claim.connect(user).wrappedBeans(userAddress)
      });
      it('properly claims beans', async function () {
        expect(this.claimedBeans.toString()).to.equal('0');
      });
      it('properly allocates beans', async function () {
        expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1000');
      });
      it('no beans created or destroyed', async function () {
        expect(this.claimedBeans.add(this.wrappedBeans).toString()).to.equal('0');
      });
    });

    describe('claim add buy ETH and deposit LP, exact allocation', function () {
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        this.result = this.silo.connect(user).claimAddAndDepositLP('0','0','1',['2000','2000','2'],[['27'],[],['0'],false,true,'0','0', false], {value: '1'});
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.sub(beans)
        this.wrappedBeans = await this.claim.connect(user).wrappedBeans(userAddress)
      });
      it('properly claims beans', async function () {
        expect(this.claimedBeans.toString()).to.equal('-1011');
      });
      it('properly allocates beans', async function () {
        expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '2000');
      });
      it('no beans created or destroyed', async function () {
        expect(this.claimedBeans.add(this.wrappedBeans).toString()).to.equal('-1011');
      });
    });
  });

  describe('wrap/unwrap', function () {
    beforeEach(async function () {
      const beans = await this.bean.balanceOf(userAddress)
      this.result = this.claim.connect(user).wrapBeans('1000');
      const newBeans = await this.bean.balanceOf(userAddress)
      this.deltaBeans = newBeans.sub(beans)
    });

    it('wraps beans', async function () {
      expect(this.deltaBeans).to.be.equal('-1000');
      expect(await this.claim.wrappedBeans(userAddress)).to.be.equal('1000')
      expect(await this.bean.balanceOf(this.claim.address)).to.be.equal('1000')
    })

    it('unwraps all beans', async function () {
      const beansBefore = await this.bean.balanceOf(userAddress)
      await this.claim.connect(user).unwrapBeans('1000')
      const newBeans = await this.bean.balanceOf(userAddress)
      expect(await this.claim.wrappedBeans(userAddress)).to.be.equal('0')
      expect(await this.bean.balanceOf(this.claim.address)).to.be.equal('0')
      expect(newBeans.sub(beansBefore)).to.be.equal('1000')
    });

    it('unwraps some beans', async function () {
      const beansBefore = await this.bean.balanceOf(userAddress)
      await this.claim.connect(user).unwrapBeans('500')
      const newBeans = await this.bean.balanceOf(userAddress)
      expect(await this.claim.wrappedBeans(userAddress)).to.be.equal('500')
      expect(await this.bean.balanceOf(this.claim.address)).to.be.equal('500')
      expect(newBeans.sub(beansBefore)).to.be.equal('500')
    });

    it('unwraps too many beans', async function () {
      const beansBefore = await this.bean.balanceOf(userAddress)
      await this.claim.connect(user).unwrapBeans('1500')
      const newBeans = await this.bean.balanceOf(userAddress)
      expect(await this.claim.wrappedBeans(userAddress)).to.be.equal('0')
      expect(await this.bean.balanceOf(this.claim.address)).to.be.equal('0')
      expect(newBeans.sub(beansBefore)).to.be.equal('1000')
    });

    it('unwraps too many beans', async function () {
      const beansBefore = await this.bean.balanceOf(userAddress)
      await this.claim.connect(user).unwrapBeans('1500')
      const newBeans = await this.bean.balanceOf(userAddress)
      expect(await this.claim.wrappedBeans(userAddress)).to.be.equal('0')
      expect(await this.bean.balanceOf(this.claim.address)).to.be.equal('0')
      expect(newBeans.sub(beansBefore)).to.be.equal('1000')
    });

    it ('claims and unwraps beans', async function () {
      await this.season.setSoilE('5000')
      await this.field.connect(user).sowBeans('1000')
      await this.field.incrementTotalHarvestableE('1000')
      const beansBefore = await this.bean.balanceOf(userAddress)
      this.result = await this.claim.connect(user).claimAndUnwrapBeans([[],[],['0'],false,true,'0','0', true], '1000')
      const newBeans = await this.bean.balanceOf(userAddress)
      expect(await this.bean.balanceOf(this.claim.address)).to.be.equal('0')
      expect(await this.claim.wrappedBeans(userAddress)).to.be.equal('0')
      expect(newBeans.sub(beansBefore)).to.be.equal('2000')
    })
  });
});
