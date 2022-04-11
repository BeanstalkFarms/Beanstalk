const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
let user,user2,owner;
let userAddress, ownerAddress, user2Address;

const THREE_CURVE = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";
const BEAN_3_CURVE = "0x3a70DfA7d2262988064A2D051dd47521E43c9BdD";

const BN_ZERO = ethers.utils.parseEther('0');

let lastTimestamp = 1700000000;
let timestamp;

async function resetTime() {
  timestamp = lastTimestamp + 100000000
  lastTimestamp = timestamp
  await hre.network.provider.request({
    method: "evm_setNextBlockTimestamp",
    params: [timestamp],
  });
}

async function advanceTime(time) {
  timestamp += time
  await hre.network.provider.request({
    method: "evm_setNextBlockTimestamp",
    params: [timestamp],
  });
}

describe('Silo', function () {
  before(async function () {
    [owner,user,user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address);
    this.diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', this.diamond.address)
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address);
    this.oracle = await ethers.getContractAt('MockOracleFacet', this.diamond.address);
    this.silo2 = await ethers.getContractAt('MockSiloV2Facet', this.diamond.address);
    this.convert = await ethers.getContractAt('ConvertFacet', this.diamond.address);
    this.pair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pair);
    this.pegPair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pegPair);
    this.bean = await ethers.getContractAt('MockToken', contracts.bean);
    this.claim = await ethers.getContractAt('MockClaimFacet', this.diamond.address)

    this.siloToken = await ethers.getContractFactory("MockToken");
    this.siloToken = await this.siloToken.deploy("Silo", "SILO")
    await this.siloToken.deployed()

    await this.silo2.mockWhitelistToken(
      this.siloToken.address, 
      this.silo2.interface.getSighash("mockBDV(uint256 amount)"), 
      '10000', 
      '1');

    await this.pair.simulateTrade(ethers.utils.parseUnits('2500', 6), ethers.utils.parseEther('1'));
    await this.pegPair.simulateTrade(ethers.utils.parseEther('1'), ethers.utils.parseUnits('2500', 6));
    await this.season.siloSunrise(0);
    await this.pair.faucet(userAddress, '1');
    await this.bean.mint(userAddress, '1000000000');
    await this.bean.mint(user2Address, '1000000000');
    await this.pair.connect(user).approve(this.silo.address, '100000000000');
    await this.pair.connect(user2).approve(this.silo.address, '100000000000');
    await this.siloToken.connect(user).approve(this.silo.address, '100000000000');
    await this.siloToken.connect(user2).approve(this.silo.address, '100000000000');
    await this.bean.connect(user).approve(this.silo.address, '100000000000');
    await this.bean.connect(user2).approve(this.silo.address, '100000000000'); 
  });

  beforeEach (async function () {
    await this.season.resetAccount(userAddress)
    await this.season.resetAccount(user2Address)
    await this.season.resetAccount(ownerAddress)
    await this.season.resetAccountToken(userAddress, this.siloToken.address);
    await this.season.resetAccountToken(user2Address, this.siloToken.address);
    await this.pair.burnAllLP(this.silo.address);
    await this.pair.burnAllLP(userAddress);
    await this.pair.burnAllLP(user2Address);
    await this.pair.burnAllLP(ownerAddress);
    await this.season.resetState();
    await this.season.siloSunrise(0);
    await this.siloToken.mint(userAddress, '10000');
    await this.siloToken.mint(user2Address, '10000');
  });

  describe('reverts', function () {
    it('reverts not Beanstalk tries to whitelist ', async function () {
      await expect(this.silo2.connect(user).whitelistToken(
        this.siloToken.address, 
        this.silo2.interface.getSighash("mockBDV(uint256 amount)"), 
        '10000', 
        '1')).to.revertedWith('Silo: Only Beanstalk can whitelist tokens.');
    });
  });

  describe('deposit', function () {
    describe('reverts', function () {
      it('reverts if BDV is 0', async function () {
        await expect(this.silo2.connect(user).deposit(this.siloToken.address, '0')).to.revertedWith('Silo: No Beans under Token.');
      });

      it('reverts if deposits a non whitelisted token', async function () {
        await expect(this.silo2.connect(user).deposit(this.bean.address, '0')).to.revertedWith('Silo: Bean denominated value failed.');
      });
    });

    describe('single deposit', function () {
      beforeEach(async function () {
        this.result = await this.silo2.connect(user).deposit(this.siloToken.address, '1000');
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo2.getTotalDeposited(this.siloToken.address)).to.eq('1000');
        expect(await this.silo.totalSeeds()).to.eq('1000');
        expect(await this.silo.totalStalk()).to.eq('10000000');
      });
  
      it('properly updates the user balance', async function () {
        expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('1000');
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq('10000000');
      });
  
      it('properly adds the crate', async function () {
        const deposit = await this.silo2.getDeposit(userAddress, this.siloToken.address, 2);
        expect(deposit[0]).to.eq('1000');
        expect(deposit[1]).to.eq('1000');
      })

      it('emits Deposit event', async function () {
        await expect(this.result).to.emit(this.silo2, 'Deposit').withArgs(userAddress, this.siloToken.address, 2, '1000', '1000');
      });
    });
  
    describe('2 deposits same season', function () {
      beforeEach(async function () {
        this.result = await this.silo2.connect(user).deposit(this.siloToken.address, '1000');
        this.result = await this.silo2.connect(user).deposit(this.siloToken.address, '1000');
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo2.getTotalDeposited(this.siloToken.address)).to.eq('2000');
        expect(await this.silo.totalSeeds()).to.eq('2000');
        expect(await this.silo.totalStalk()).to.eq('20000000');
      });
  
      it('properly updates the user balance', async function () {
        expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('2000');
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq('20000000');
      });
  
      it('properly adds the crate', async function () {
        const deposit = await this.silo2.getDeposit(userAddress, this.siloToken.address, 2);
        expect(deposit[0]).to.eq('2000');
        expect(deposit[1]).to.eq('2000');
      })
    });
  
    describe('2 deposits 2 users', function () {
      beforeEach(async function () {
        this.result = await this.silo2.connect(user).deposit(this.siloToken.address, '1000');
        this.result = await this.silo2.connect(user2).deposit(this.siloToken.address, '1000');
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo2.getTotalDeposited(this.siloToken.address)).to.eq('2000');
        expect(await this.silo.totalSeeds()).to.eq('2000');
        expect(await this.silo.totalStalk()).to.eq('20000000');
      });
  
      it('properly updates the user balance', async function () {
        expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('1000');
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq('10000000');
      });
      it('properly updates the user2 balance', async function () {
        expect(await this.silo.balanceOfSeeds(user2Address)).to.eq('1000');
        expect(await this.silo.balanceOfStalk(user2Address)).to.eq('10000000');
      });
  
      it('properly adds the crate', async function () {
        let deposit = await this.silo2.getDeposit(userAddress, this.siloToken.address, 2);
        expect(deposit[0]).to.eq('1000');
        expect(deposit[1]).to.eq('1000');
        deposit = await this.silo2.getDeposit(user2Address, this.siloToken.address, 2);
        expect(deposit[0]).to.eq('1000');
        expect(deposit[1]).to.eq('1000');
      });
    });
  });

  describe('withdraw', function () {
    beforeEach(async function () {
      await this.silo2.connect(user).deposit(this.siloToken.address, '1000');
    })
    describe('reverts', function () {
      it('reverts if amount is 0', async function () {
        await expect(this.silo2.connect(user).withdrawTokenBySeason(this.siloToken.address, '2', '1001')).to.revertedWith('Silo: Crate balance too low.');
      });

      it('reverts if deposits + withdrawals is a different length', async function () {
        await expect(this.silo2.connect(user).withdrawTokenBySeasons(this.siloToken.address, ['2', '3'], ['1001'])).to.revertedWith('Silo: Crates, amounts are diff lengths.');
      });
    });

    describe('withdraw token by season', async function () {
      describe('withdraw 1 Bean crate', async function () {
        beforeEach(async function () {
          this.result = await this.silo2.connect(user).withdrawTokenBySeason(this.siloToken.address, 2, '1000');
        });
    
        it('properly updates the total balances', async function () {
          expect(await this.silo2.getTotalDeposited(this.siloToken.address)).to.eq('0');
          expect(await this.silo.totalStalk()).to.eq('0');
          expect(await this.silo.totalSeeds()).to.eq('0');
          expect(await this.silo2.getTotalWithdrawn(this.siloToken.address)).to.eq('1000');
        });
        it('properly updates the user balance', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq('0');
          expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('0');
        });

        it('properly removes the deposit', async function () {
          const deposit = await this.silo2.getDeposit(userAddress, this.siloToken.address, 2);
          expect(deposit[0]).to.eq('0');
          expect(deposit[1]).to.eq('0');
        });

        it('properly adds the withdrawal', async function () {
          expect(await this.silo2.getWithdrawal(userAddress, this.siloToken.address, 27)).to.eq('1000');
        });
    
        it('emits Remove and Withdrawal event', async function () {
          await expect(this.result).to.emit(this.silo2, 'RemoveSeason').withArgs(userAddress, this.siloToken.address, 2, '1000');
          await expect(this.result).to.emit(this.silo2, 'Withdraw').withArgs(userAddress, this.siloToken.address, 27, '1000');
        });
      });
      
      describe('withdraw part of a bean crate', function () {
        beforeEach(async function () {
          this.result = await this.silo2.connect(user).withdrawTokenBySeason(this.siloToken.address, 2, '500');
        });
    
        it('properly updates the total balances', async function () {
          expect(await this.silo2.getTotalDeposited(this.siloToken.address)).to.eq('500');
          expect(await this.silo.totalStalk()).to.eq('5000000');
          expect(await this.silo.totalSeeds()).to.eq('500');
          expect(await this.silo2.getTotalWithdrawn(this.siloToken.address)).to.eq('500');
        });
        it('properly updates the user balance', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq('5000000');
          expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('500');
        });

        it('properly removes the deposit', async function () {
          const deposit = await this.silo2.getDeposit(userAddress, this.siloToken.address, 2);
          expect(deposit[0]).to.eq('500');
          expect(deposit[1]).to.eq('500');
        });

        it('properly adds the withdrawal', async function () {
          expect(await this.silo2.getWithdrawal(userAddress, this.siloToken.address, 27)).to.eq('500');
        });

        it('emits Remove and Withdrawal event', async function () {
          await expect(this.result).to.emit(this.silo2, 'RemoveSeason').withArgs(userAddress, this.siloToken.address, 2, '500');
          await expect(this.result).to.emit(this.silo2, 'Withdraw').withArgs(userAddress, this.siloToken.address, 27, '500');
        });
      });
    });

    describe("withdraw token by seasons", async function (){
      describe('1 full and 1 partial token crates', function () {
        beforeEach(async function () {
          await this.season.siloSunrise(0);
          await this.silo2.connect(user).deposit(this.siloToken.address, '1000');
          this.result = await this.silo2.connect(user).withdrawTokenBySeasons(this.siloToken.address, [2,3],['500','1000']);
        });
    
        it('properly updates the total balances', async function () {
          expect(await this.silo2.getTotalDeposited(this.siloToken.address)).to.eq('500');
          expect(await this.silo.totalStalk()).to.eq('5000500');
          expect(await this.silo.totalSeeds()).to.eq('500');
          expect(await this.silo2.getTotalWithdrawn(this.siloToken.address)).to.eq('1500');
        });
        it('properly updates the user balance', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq('5000500');
          expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('500');
        });
        it('properly removes the crate', async function () {
          let dep = await this.silo2.getDeposit(userAddress, this.siloToken.address, 2);
          expect(dep[0]).to.equal('500')
          expect(dep[1]).to.equal('500')
          dep = await this.silo2.getDeposit(userAddress, this.siloToken.address, 3);
          expect(dep[0]).to.equal('0')
          expect(dep[1]).to.equal('0')
        });
        it('emits Remove and Withdrawal event', async function () {
          await expect(this.result).to.emit(this.silo2, 'RemoveSeasons').withArgs(userAddress, this.siloToken.address, [2,3], ['500', '1000'], '1500');
          await expect(this.result).to.emit(this.silo2, 'Withdraw').withArgs(userAddress, this.siloToken.address, 28, '1500');
        });
      });
      describe('2 token crates', function () {
        beforeEach(async function () {
          await this.season.siloSunrise(0);
          await this.silo2.connect(user).deposit(this.siloToken.address, '1000');
          this.result = await this.silo2.connect(user).withdrawTokenBySeasons(this.siloToken.address, [2,3],['1000','1000']);
        });
    
        it('properly updates the total balances', async function () {
          expect(await this.silo2.getTotalDeposited(this.siloToken.address)).to.eq('0');
          expect(await this.silo.totalStalk()).to.eq('0');
          expect(await this.silo.totalSeeds()).to.eq('0');
          expect(await this.silo2.getTotalWithdrawn(this.siloToken.address)).to.eq('2000');
        });
        it('properly updates the user balance', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq('0');
          expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('0');
        });
        it('properly removes the crate', async function () {
          let dep = await this.silo2.getDeposit(userAddress, this.siloToken.address, 2);
          expect(dep[0]).to.equal('0')
          expect(dep[1]).to.equal('0')
          dep = await this.silo2.getDeposit(userAddress, this.siloToken.address, 3);
          expect(dep[0]).to.equal('0')
          expect(dep[1]).to.equal('0')
        });
        it('emits Remove and Withdrawal event', async function () {
          await expect(this.result).to.emit(this.silo2, 'RemoveSeasons').withArgs(userAddress, this.siloToken.address, [2,3], ['1000', '1000'], '2000');
          await expect(this.result).to.emit(this.silo2, 'Withdraw').withArgs(userAddress, this.siloToken.address, 28, '2000');
        });
      });
    });
    describe("withdraw tokens by season", async function (){
      describe('1 full and 1 partial token crates', function () {
        beforeEach(async function () {
          await this.season.siloSunrise(0);
          await this.silo2.connect(user).deposit(this.siloToken.address, '1000');
          this.result = await this.silo2.connect(user).withdrawTokensBySeason([[this.siloToken.address, 2, '500'],[this.siloToken.address, 3, '1000']]);
        });
    
        it('properly updates the total balances', async function () {
          expect(await this.silo2.getTotalDeposited(this.siloToken.address)).to.eq('500');
          expect(await this.silo.totalStalk()).to.eq('5000500');
          expect(await this.silo.totalSeeds()).to.eq('500');
          expect(await this.silo2.getTotalWithdrawn(this.siloToken.address)).to.eq('1500');
        });
        it('properly updates the user balance', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq('5000500');
          expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('500');
        });
        it('properly removes the crate', async function () {
          let dep = await this.silo2.getDeposit(userAddress, this.siloToken.address, 2);
          expect(dep[0]).to.equal('500')
          expect(dep[1]).to.equal('500')
          dep = await this.silo2.getDeposit(userAddress, this.siloToken.address, 3);
          expect(dep[0]).to.equal('0')
          expect(dep[1]).to.equal('0')
        });
        it('emits Remove and Withdrawal event', async function () {
          await expect(this.result).to.emit(this.silo2, 'RemoveSeason').withArgs(userAddress, this.siloToken.address, 2, '500');
          await expect(this.result).to.emit(this.silo2, 'RemoveSeason').withArgs(userAddress, this.siloToken.address, 3, '1000');
          await expect(this.result).to.emit(this.silo2, 'Withdraw').withArgs(userAddress, this.siloToken.address, 28, '500');
          await expect(this.result).to.emit(this.silo2, 'Withdraw').withArgs(userAddress, this.siloToken.address, 28, '1000');
        });
      });
      describe('2 token crates', function () {
        beforeEach(async function () {
          await this.season.siloSunrise(0);
          await this.silo2.connect(user).deposit(this.siloToken.address, '1000');
          this.result = await this.silo2.connect(user).withdrawTokensBySeason([[this.siloToken.address, 2, '1000'],[this.siloToken.address, 3, '1000']]);
        });
    
        it('properly updates the total balances', async function () {
          expect(await this.silo2.getTotalDeposited(this.siloToken.address)).to.eq('0');
          expect(await this.silo.totalStalk()).to.eq('0');
          expect(await this.silo.totalSeeds()).to.eq('0');
          expect(await this.silo2.getTotalWithdrawn(this.siloToken.address)).to.eq('2000');
        });
        it('properly updates the user balance', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq('0');
          expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('0');
        });
        it('properly removes the crate', async function () {
          let dep = await this.silo2.getDeposit(userAddress, this.siloToken.address, 2);
          expect(dep[0]).to.equal('0')
          expect(dep[1]).to.equal('0')
          dep = await this.silo2.getDeposit(userAddress, this.siloToken.address, 3);
          expect(dep[0]).to.equal('0')
          expect(dep[1]).to.equal('0')
        });
        it('emits Remove and Withdrawal event', async function () {
          await expect(this.result).to.emit(this.silo2, 'RemoveSeason').withArgs(userAddress, this.siloToken.address, 2, '1000');
          await expect(this.result).to.emit(this.silo2, 'RemoveSeason').withArgs(userAddress, this.siloToken.address, 3, '1000');
          await expect(this.result).to.emit(this.silo2, 'Withdraw').withArgs(userAddress, this.siloToken.address, 28, '1000');
        });
      });
    });
    describe("withdraw tokens by seasons", async function (){
      describe('2 token crates in 2 withdrawals', function () {
        beforeEach(async function () {
          await this.season.siloSunrise(0);
          await this.silo2.connect(user).deposit(this.siloToken.address, '1000');
          this.result = await this.silo2.connect(user).withdrawTokensBySeasons([[this.siloToken.address, [2,3], ['750', '500']],[this.siloToken.address, [2,3], ['250', '250']]]);
        });
    
        it('properly updates the total balances', async function () {
          expect(await this.silo2.getTotalDeposited(this.siloToken.address)).to.eq('250');
          expect(await this.silo.totalStalk()).to.eq('2500000');
          expect(await this.silo.totalSeeds()).to.eq('250');
          expect(await this.silo2.getTotalWithdrawn(this.siloToken.address)).to.eq('1750');
        });
        it('properly updates the user balance', async function () {
          expect(await this.silo.balanceOfStalk(userAddress)).to.eq('2500000');
          expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('250');
        });
        it('properly removes the crate', async function () {
          let dep = await this.silo2.getDeposit(userAddress, this.siloToken.address, 2);
          expect(dep[0]).to.equal('0')
          expect(dep[1]).to.equal('0')
          dep = await this.silo2.getDeposit(userAddress, this.siloToken.address, 3);
          expect(dep[0]).to.equal('250')
          expect(dep[1]).to.equal('250')
        });
        it('emits Remove and Withdrawal event', async function () {
          await expect(this.result).to.emit(this.silo2, 'RemoveSeasons').withArgs(userAddress, this.siloToken.address, [2,3], ['750', '500'], '1250');
          await expect(this.result).to.emit(this.silo2, 'RemoveSeasons').withArgs(userAddress, this.siloToken.address, [2,3], ['250', '250'], '500');
          await expect(this.result).to.emit(this.silo2, 'Withdraw').withArgs(userAddress, this.siloToken.address, 28, '1250');
          await expect(this.result).to.emit(this.silo2, 'Withdraw').withArgs(userAddress, this.siloToken.address, 28, '500');
        });
      });
    });
  });

  describe('claim', function () {
    beforeEach(async function () {
      await this.silo2.connect(user).deposit(this.siloToken.address, '1000');
      await this.silo2.connect(user).withdrawTokenBySeason(this.siloToken.address, '2', '1000');
      await this.season.siloSunrises(25);
    })

    describe('claim token by season', function () {
      beforeEach(async function () {
        const userTokensBefore = await this.siloToken.balanceOf(userAddress);
        this.result = await this.silo2.connect(user).claimTokenBySeason(this.siloToken.address, 27);
        this.deltaBeans = (await this.siloToken.balanceOf(userAddress)).sub(userTokensBefore);
      });

      it('properly updates the total balances', async function () {
        expect(await this.silo2.getTotalWithdrawn(this.siloToken.address)).to.eq('0');
        expect(this.deltaBeans).to.equal('1000');
      });

      it('properly removes the withdrawal', async function () {
        expect(await this.silo2.getWithdrawal(userAddress, this.siloToken.address, 27)).to.eq('0');
      });

      it('emits a claim ', async function () {
        await expect(this.result).to.emit(this.silo2, 'ClaimSeason').withArgs(userAddress, this.siloToken.address, 27, '1000');
      });
    });

    describe('claim token by seasons', function () {
      beforeEach(async function () {
        await this.silo2.connect(user).deposit(this.siloToken.address, '1000');
        await this.silo2.connect(user).withdrawTokenBySeason(this.siloToken.address, '27', '1000');
        await this.season.siloSunrises(25);

      const userTokensBefore = await this.siloToken.balanceOf(userAddress);
        this.result = await this.silo2.connect(user).claimTokenBySeasons(this.siloToken.address, [27, 52]);
        this.deltaBeans = (await this.siloToken.balanceOf(userAddress)).sub(userTokensBefore);
      });

      it('properly updates the total balances', async function () {
        expect(await this.silo2.getTotalWithdrawn(this.siloToken.address)).to.eq('0');
        expect(this.deltaBeans).to.equal('2000');
      });

      it('properly removes the withdrawal', async function () {
        expect(await this.silo2.getWithdrawal(userAddress, this.siloToken.address, 27)).to.eq('0');
      });

      it('emits a claim ', async function () {
        await expect(this.result).to.emit(this.silo2, 'ClaimSeasons').withArgs(userAddress, this.siloToken.address, [27, 52], '2000');
      });
    });

    describe('claim tokens by season', function () {
      beforeEach(async function () {
        await this.silo2.connect(user).deposit(this.siloToken.address, '1000');
        await this.silo2.connect(user).withdrawTokenBySeason(this.siloToken.address, '27', '1000');
        await this.season.siloSunrises(25);

      const userTokensBefore = await this.siloToken.balanceOf(userAddress);
        this.result = await this.silo2.connect(user).claimTokensBySeason([[this.siloToken.address, 27], [this.siloToken.address, 52]]);
        this.deltaBeans = (await this.siloToken.balanceOf(userAddress)).sub(userTokensBefore);
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo2.getTotalWithdrawn(this.siloToken.address)).to.eq('0');
        expect(this.deltaBeans).to.equal('2000');
      });

      it('properly removes the withdrawal', async function () {
        expect(await this.silo2.getWithdrawal(userAddress, this.siloToken.address, 27)).to.eq('0');
      });

      it('emits a claim ', async function () {
        await expect(this.result).to.emit(this.silo2, 'ClaimSeason').withArgs(userAddress, this.siloToken.address, 27, '1000');
        await expect(this.result).to.emit(this.silo2, 'ClaimSeason').withArgs(userAddress, this.siloToken.address, 52, '1000');
      });
    });

    describe('claim tokens by season', function () {
      beforeEach(async function () {
        await this.silo2.connect(user).deposit(this.siloToken.address, '1000');
        await this.silo2.connect(user).withdrawTokenBySeason(this.siloToken.address, '27', '500');
        await this.season.siloSunrise(0);
        await this.silo2.connect(user).withdrawTokenBySeason(this.siloToken.address, '27', '250');
        await this.season.siloSunrise(0);
        await this.silo2.connect(user).withdrawTokenBySeason(this.siloToken.address, '27', '250');
        await this.season.siloSunrises(25);

        const userTokensBefore = await this.siloToken.balanceOf(userAddress);
        this.result = await this.silo2.connect(user).claimTokensBySeasons([[this.siloToken.address, [27, 52]], [this.siloToken.address, [53, 54]]]);
        this.deltaBeans = (await this.siloToken.balanceOf(userAddress)).sub(userTokensBefore);
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo2.getTotalWithdrawn(this.siloToken.address)).to.eq('0');
        expect(this.deltaBeans).to.equal('2000');
      });

      it('properly removes the withdrawal', async function () {
        expect(await this.silo2.getWithdrawal(userAddress, this.siloToken.address, 27)).to.eq('0');
      });

      it('emits a claim ', async function () {
        await expect(this.result).to.emit(this.silo2, 'ClaimSeasons').withArgs(userAddress, this.siloToken.address, [27, 52], '1500');
        await expect(this.result).to.emit(this.silo2, 'ClaimSeasons').withArgs(userAddress, this.siloToken.address, [53, 54], '500');
      });
    });
  });

  describe("Curve BDV", async function () {
    before(async function () {
      this.threeCurve = await ethers.getContractAt('Mock3Curve', THREE_CURVE);
      await this.threeCurve.set_virtual_price(ethers.utils.parseEther('1'));
      this.beanThreeCurve = await ethers.getContractAt('MockMeta3Curve', BEAN_3_CURVE);
      await this.beanThreeCurve.set_supply(ethers.utils.parseEther('2000000'));
      await this.beanThreeCurve.set_A_precise('1000');
      await this.beanThreeCurve.set_virtual_price(ethers.utils.parseEther('1'));
      await this.beanThreeCurve.set_balances([
        ethers.utils.parseUnits('1000000',6),
        ethers.utils.parseEther('1000000')
      ]);
      await this.beanThreeCurve.set_balances([
        ethers.utils.parseUnits('1200000',6),
        ethers.utils.parseEther('1000000')
      ]);
    });

    it("properly checks bdv", async function () {
      this.curveBDV = await ethers.getContractAt('BDVFacet', this.diamond.address);
      expect(await this.curveBDV.curveToBDV(ethers.utils.parseEther('200'))).to.equal(ethers.utils.parseUnits('200',6));
    })

    it("properly checks bdv", async function () {
      await this.threeCurve.set_virtual_price(ethers.utils.parseEther('1.02'));
      this.curveBDV = await ethers.getContractAt('BDVFacet', this.diamond.address);
      expect(await this.curveBDV.curveToBDV(ethers.utils.parseEther('2'))).to.equal('1998191');
    })
  })

  describe("UniswapV2 BDV BDV", async function () {
    beforeEach(async function () {
      await this.pair.faucet(userAddress, ethers.utils.parseEther('2'));
      await resetTime();
      await this.pair.reset_cumulative();
      await resetTime();
      await this.oracle.captureE();
    });

    it("properly checks bdv", async function () {
      expect(await this.silo.uniswapLPToBean(ethers.utils.parseEther('1'))).to.equal(
        ethers.utils.parseUnits('2500', 6)
      );
    });

    it("properly checks bdv after updating TWAP", async function () {
      await this.pair.simulateTrade(ethers.utils.parseUnits('2500', 6), ethers.utils.parseEther('1'));
      expect(await this.silo.uniswapLPToBean(ethers.utils.parseEther('1'))).to.equal(
        ethers.utils.parseUnits('2500', 6)
      );
    });

    it("Fails if trade in Season", async function () {
      await this.pair.setBlockTimestampLast('2300000002')
      await this.oracle.captureE();
      expect(this.silo.uniswapLPToBean(ethers.utils.parseEther('1'))).to.be.revertedWith(
        "Silo: Oracle same Season"
      );
    })
  })
});