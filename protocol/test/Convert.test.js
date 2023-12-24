const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { ConvertEncoder } = require('./utils/encoder.js')
const { BEAN } = require('./utils/constants')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { re } = require('mathjs');

let user,user2,owner;
let userAddress, ownerAddress, user2Address;
describe('Convert', function () {
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
    this.convert = await ethers.getContractAt('MockConvertFacet', this.diamond.address);
    this.bean = await ethers.getContractAt('MockToken', BEAN);

    
    this.siloToken = await ethers.getContractFactory("MockToken");
    this.siloToken = await this.siloToken.deploy("Silo", "SILO")
    await this.siloToken.deployed()


    // test setup includes making 2 deposits, one at stem of 1, and another deposit at 2

    await this.bean.mint(userAddress, '1000000000');
    await this.bean.mint(user2Address, '1000000000');
    await this.bean.connect(user).approve(this.silo.address, '100000000000');
    await this.bean.connect(user2).approve(this.silo.address, '100000000000'); 
    await this.siloToken.connect(user).approve(this.silo.address, '100000000000');
    await this.siloToken.mint(userAddress, '10000');
    await this.season.teleportSunrise(10);

    this.season.deployStemsUpgrade();

    /**
     * @notice Describes the settings for each Token that is Whitelisted in the Silo.
     * @param selector The encoded BDV function selector for the token that pertains to 
     * an external view Beanstalk function with the following signature:
     * ```
     * function tokenToBdv(uint256 amount) external view returns (uint256);
     * --> CAN BE FOUND AT THE BDV FACET FOR SEVERAL WHITELISTED TOKENS IE CURVE, ETH...
     * ```
     * It is called by `LibTokenSilo` through the use of `delegatecall`
     * to calculate a token's BDV at the time of Deposit.
     * @param stalkIssuedPerBdv The Stalk Per BDV that the Silo grants in exchange for Depositing this Token.
     * previously called stalk.
    */

    await this.silo.mockWhitelistToken(
      this.siloToken.address, // token                         
      this.silo.interface.getSighash("mockBDV(uint256 amount)"), // selector --> how you will calculate the bdv. see LibTokenSilo.sol beandenominatedvalue function
      // SINCE THE EXTERNAL FUNCTION USED TO CALC THE BDV OF THE SILO TOKEN IS THE MOCKBDV THAT JUST RETURNS THE AMOUNT
      // THE BDV IS JUST THE INPUT AMOUNT SO 1 SILO TOKEN = 1 BDV
      '10000', // stalkIssuedPerBdv
      1e6 //aka "1 seed" // stalkEarnedPerSeason
    );
    // user1 deposits 2 times at stem 1 and 2 100 silo tokens , so 100 bdv for each deposit
    await this.season.siloSunrise(0);
    await this.silo.connect(user).deposit(this.siloToken.address, '100', EXTERNAL);
    await this.season.siloSunrise(0);
    await this.silo.connect(user).deposit(this.siloToken.address, '100', EXTERNAL); //something about this deposit adds extra stalk
    
    // ------------------------------ NEW CHANGES ------------------------------
    // To isolate the anti lamda functionality, we will create and whitelist a new silo token
    this.newSiloToken = await ethers.getContractFactory("MockToken");
    this.newSiloToken = await this.newSiloToken.deploy("Silo2", "SILO2")
    await this.newSiloToken.deployed()

    await this.silo.mockWhitelistToken(
      this.newSiloToken.address, // token                        
      this.silo.interface.getSighash("newMockBDV()"), // selector (returns 1e6)
      '10000', // stalkIssuedPerBdv
      1e6 //aka "1 seed" // stalkEarnedPerSeason
    );
  

  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });
  //  -------------------------------- OLD TESTS --------------------------------
  describe('Withdraw For Convert', async function () {
    describe("Revert", async function () {
      it('diff lengths', async function () {
        await expect(this.convert.connect(user).withdrawForConvertE(this.siloToken.address, ['1', '2'], ['100'], '100' , userAddress)).to.be.revertedWith('Convert: stems, amounts are diff lengths.')
      });

      it('crate balance too low', async function () {
        //params are token, stem, amounts, maxtokens
        // await expect(this.convert.connect(user).withdrawForConvertE(this.siloToken.address, ['0'], ['150'], '150')).to.be.revertedWith('Silo: Crate balance too low.') //before moving to constants for the original 4 whitelisted tokens (post replant), this test would revert with 'Silo: Crate balance too low.', but now it reverts with 'Must line up with season' because there's no constant seeds amount hardcoded in for this test token
        await expect(this.convert.connect(user).withdrawForConvertE(this.siloToken.address, ['0'], ['150'], '150', userAddress)).to.be.revertedWith('Silo: Crate balance too low.')
      });

      it('not enough removed', async function () {
        await expect(this.convert.connect(user).withdrawForConvertE(this.siloToken.address, ['2'], ['100'], '150', userAddress)).to.be.revertedWith('Convert: Not enough tokens removed.')
      });
    })

    //this test withdraws from stem index of 2, verifies they are removed correctly and stalk balances updated
    describe("Withdraw 1 Crate", async function () {
      beforeEach(async function () {
        this.result = await this.convert.connect(user).withdrawForConvertE(this.siloToken.address, ['2'], ['100'], '100', userAddress);
      })

      it('Emits event', async function () {
        await expect(this.result).to.emit(this.convert, 'RemoveDeposits').withArgs(userAddress, this.siloToken.address, [2], ['100'], '100', ['100']);
        await expect(this.result).to.emit(this.convert, 'MockConvert').withArgs('0', '100');
      })

      it('Decrements totals', async function () {
        expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.equal('100');
        expect(await this.silo.getTotalDepositedBdv(this.siloToken.address)).to.eq('100');
        expect(await this.silo.totalStalk()).to.equal('1000100');
        //expect(await this.silo.totalSeeds()).to.equal('100');
      })

      it('Decrements balances', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.equal('1000100');
        //expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('100');
      })

      it('properly removes the crate', async function () {
        let deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, 1);

        expect(deposit[0]).to.eq('100');
        expect(deposit[1]).to.eq('100');
        deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, 2);

        expect(deposit[0]).to.eq('0');
        expect(deposit[1]).to.eq('0');
      })
    })

    //this test withdraws from stem indexes of 2 and 1
    describe("Withdraw 1 Crate 2 input", async function () {
      beforeEach(async function () {
        this.result = await this.convert.connect(user).withdrawForConvertE(this.siloToken.address, ['2', '1'], ['100', '100'], '100', userAddress);
      })

      it('Emits event', async function () {
        await expect(this.result).to.emit(this.convert, 'RemoveDeposits').withArgs(userAddress, this.siloToken.address, [2, 1], ['100', '0'], '100',['100', '0'] );
        await expect(this.result).to.emit(this.convert, 'MockConvert').withArgs('0', '100');
      })

      it('Decrements totals', async function () {
        expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.equal('100');
        expect(await this.silo.getTotalDepositedBdv(this.siloToken.address)).to.eq('100');
        expect(await this.silo.totalStalk()).to.equal('1000100');
        //expect(await this.silo.totalSeeds()).to.equal('100');
      })

      it('Decrements balances', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.equal('1000100');
        //expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('100');
      })

      it('properly removes the crate', async function () {
        let deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, 1);
        expect(deposit[0]).to.eq('100');
        expect(deposit[1]).to.eq('100');
        deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, 2);
        expect(deposit[0]).to.eq('0');
        expect(deposit[1]).to.eq('0');
      })
    })

    //withdraws less than the full deposited amount from stem indexes of 2 and 1
    describe("Withdraw 2 Crates exact", async function () {
      beforeEach(async function () {
        this.result = await this.convert.connect(user).withdrawForConvertE(this.siloToken.address, ['1', '2'], ['100', '50'], '150', userAddress);
      })

      it('Emits event', async function () { 
        await expect(this.result).to.emit(this.convert, 'RemoveDeposits').withArgs(userAddress, this.siloToken.address, [1, 2], ['100', '50'], '150', ['100', '50']);

        await expect(this.result).to.emit(this.convert, 'MockConvert').withArgs('100', '150');
      })

      it('Decrements totals', async function () {
        expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.equal('50');
        expect(await this.silo.getTotalDepositedBdv(this.siloToken.address)).to.eq('50');
        expect(await this.silo.totalStalk()).to.equal('500000');
        //expect(await this.silo.totalSeeds()).to.equal('50');
      })

      it('Decrements balances', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.equal('500000');
        //expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('50');
      })

      it('properly removes the crate', async function () {
        let deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, 1);
        expect(deposit[0]).to.eq('0');
        expect(deposit[1]).to.eq('0');
        deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, 2);
        expect(deposit[0]).to.eq('50');
        expect(deposit[1]).to.eq('50');
      })
    })

    describe("Withdraw 2 Crates under", async function () {
      beforeEach(async function () {
        this.result = await this.convert.connect(user).withdrawForConvertE(this.siloToken.address, ['1', '2'], ['100', '100'], '150', userAddress);
      })

      it('Emits event', async function () { 
        await expect(this.result).to.emit(this.convert, 'RemoveDeposits').withArgs(userAddress, this.siloToken.address, [1, 2], ['100','50'], '150', ['100','50']);
        await expect(this.result).to.emit(this.convert, 'MockConvert').withArgs('100', '150');
      })

      it('Decrements totals', async function () {
        expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.equal('50');
        expect(await this.silo.getTotalDepositedBdv(this.siloToken.address)).to.eq('50');
        expect(await this.silo.totalStalk()).to.equal('500000');
        //expect(await this.silo.totalSeeds()).to.equal('50');
      })

      it('Decrements balances', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.equal('500000');
        //expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('50');
      })

      it('properly removes the crate', async function () {
        let deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, 1);
        expect(deposit[0]).to.eq('0');
        expect(deposit[1]).to.eq('0');
        deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, 2);
        expect(deposit[0]).to.eq('50');
        expect(deposit[1]).to.eq('50');
      })
    })
  })
  
  describe('Deposit For Convert', async function () {
    describe("Revert", async function () {
      it("Reverts if BDV is 0", async function () {
        await expect(this.convert.connect(user2).depositForConvertE(this.siloToken.address, '100', '0', '100', user2Address)).to.be.revertedWith("Convert: BDV or amount is 0.")
      })

      it("Reverts if amount is 0", async function () {
        await expect(this.convert.connect(user2).depositForConvertE(this.siloToken.address, '0', '100', '100', user2Address)).to.be.revertedWith("Convert: BDV or amount is 0.")
      })
    })

    describe('Deposit Tokens No Grown', async function () {
      beforeEach(async function () {
        this.result = await this.convert.connect(user2).depositForConvertE(this.siloToken.address, '100', '100', '0', user2Address);
      });

      it('Emits event', async function () {
        await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(user2Address, this.siloToken.address, 2, '100', '100');
      })

      it('Decrements totals', async function () {
        expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.equal('300');
        expect(await this.silo.getTotalDepositedBdv(this.siloToken.address)).to.eq('300');
        expect(await this.silo.totalStalk()).to.equal('3000100');
        //expect(await this.silo.totalSeeds()).to.equal('300');
      })

      it('Decrements balances', async function () {
        expect(await this.silo.balanceOfStalk(user2Address)).to.equal('1000000');
        //expect(await this.silo.balanceOfSeeds(user2Address)).to.equal('100');
      })

      it('properly removes the crate', async function () {
        const deposit = await this.silo.getDeposit(user2Address, this.siloToken.address, 2);
        expect(deposit[0]).to.eq('100');
        expect(deposit[1]).to.eq('100');
      })
    })

    describe('Deposit Tokens some grown', async function () {
      beforeEach(async function () {
        this.result = await this.convert.connect(user2).depositForConvertE(this.siloToken.address, '100', '100', '100', user2Address);
      });

      it('Emits event', async function () {
        //seasons start at 1 and the current season is 3
        //a deposit with 100 grown stalk, when the "seeds" count is 1, means that 1 season has passed since this deposit
        //and the current grown stalk index should be 2, since a total of 2 seasons have passed (1->2, 2->3)
        //so "1 grown stalk season ago" would be season 1
        await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(user2Address, this.siloToken.address, 1, '100', '100');
      })

      it('Decrements totals', async function () {
        expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.equal('300');
        expect(await this.silo.getTotalDepositedBdv(this.siloToken.address)).to.eq('300');
        expect(await this.silo.totalStalk()).to.equal('3000200');
        //expect(await this.silo.totalSeeds()).to.equal('300');
      })

      it('Decrements balances', async function () {
        expect(await this.silo.balanceOfStalk(user2Address)).to.equal('1000100');
        //expect(await this.silo.balanceOfSeeds(user2Address)).to.equal('100');
      })

      it('properly removes the crate', async function () {
        const deposit = await this.silo.getDeposit(user2Address, this.siloToken.address, 1);
        expect(deposit[0]).to.eq('100');
        expect(deposit[1]).to.eq('100');
      })
    })

    describe('Deposit Tokens more grown', async function () {
      beforeEach(async function () {
        this.result = await this.convert.connect(user2).depositForConvertE(this.siloToken.address, '100', '100', '250', user2Address);
      });

      it('Emits event', async function () {
        //at 250 grown stalk, this would need to have been deposited 2.5 seasons ago, or at grown stalk index of 2.5
        //But guess what, we don't have decimals for 2.5, only 2, so you'll lose 0.5 seasons of grown stalk (30 mins)
        //so with the current grown stalk index at 2, 2 seasons ago would be 0
        await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(user2Address, this.siloToken.address, 0, '100', '100');
      })

      it('Decrements totals', async function () {
        expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.equal('300');
        expect(await this.silo.getTotalDepositedBdv(this.siloToken.address)).to.eq('300');
        expect(await this.silo.totalStalk()).to.equal('3000300');
        //expect(await this.silo.totalSeeds()).to.equal('300');
      })

      it('Decrements balances', async function () {
        expect(await this.silo.balanceOfStalk(user2Address)).to.equal('1000200');
        //expect(await this.silo.balanceOfSeeds(user2Address)).to.equal('100');
      })

      it('properly removes the crate', async function () {
        const deposit = await this.silo.getDeposit(user2Address, this.siloToken.address, 0);
        expect(deposit[0]).to.eq('100');
        expect(deposit[1]).to.eq('100');
      })
    })
  });

  describe("lambda convert", async function () {
    it('returns correct value', async function () {
      this.result = await this.convert.connect(user).callStatic.convert(
        ConvertEncoder.convertLambdaToLambda(
          '100',
          this.siloToken.address
        ),
        ['2'],
        ['100']
      )
      expect(this.result.toStem).to.be.equal(2)
      expect(this.result.toAmount).to.be.equal('100')
    })

    beforeEach(async function () {
      this.result = await this.convert.connect(user).convert(
        ConvertEncoder.convertLambdaToLambda(
          '200',
          this.siloToken.address
        ),
        ['1', '2'],
        ['100', '100']
      )
    })

    it('removes and adds deposit', async function () {
      let deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, 1);
      expect(deposit[0]).to.eq('0');
      expect(deposit[1]).to.eq('0');

      deposit = await this.silo.getDeposit(userAddress, this.siloToken.address, 2);
      expect(deposit[0]).to.eq('200');
      expect(deposit[1]).to.eq('200');
    })

    it('Decrements balances', async function () {
      expect(await this.silo.balanceOfStalk(userAddress)).to.equal('2000000');
      //expect(await this.silo.balanceOfSeeds(userAddress)).to.equal('200');
    })

    it('Decrements totals', async function () {
      expect(await this.silo.getTotalDeposited(this.siloToken.address)).to.equal('200');
      expect(await this.silo.getTotalDepositedBdv(this.siloToken.address)).to.eq('200');
      expect(await this.silo.totalStalk()).to.equal('2000000');
      //expect(await this.silo.totalSeeds()).to.equal('200');
    })

    it('Emits events', async function () {
      await expect(this.result).to.emit(this.silo, 'RemoveDeposits').withArgs(userAddress, this.siloToken.address, [1, 2], ['100', '100'], '200', ['100', '100']);
      await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(userAddress, this.siloToken.address, 2, '200', '200');
    })
  })

//  ------------------------------ ANTI LAMBDA CONVERT ----------------------------------
// FOR BDV OF INDIVIDUAL DEPOSIT? (SiloExit.sol)
//   /**
//      * @notice Return the balance of Deposited BDV of `token` for a given `account`.
//      */
//   function balanceOfDepositedBdv(address account, address token)
//   external
//   view
//   returns (uint256 depositedBdv)
// {
//   depositedBdv = s.a[account].mowStatuses[token].bdv;
// }

// GET DEPOSIT --> (LibTokenSilo.sol)

  describe("anti lambda convert bdv decrease", async function () {
    
    beforeEach(async function () {
      // user deposits 100 new silo token at stem 0 so 1000000 bdv
      await this.newSiloToken.mint(userAddress, '10000000');
      await this.newSiloToken.connect(user).approve(this.silo.address, '1000000000');
      await this.silo.connect(user).deposit(this.newSiloToken.address, '100', EXTERNAL);

      // simulate deposit bdv decrease for user by changing bdv selector to newMockBDVDecrease ie 0.9e6
      await this.silo.mockChangeBDVSelector(this.newSiloToken.address, this.silo.interface.getSighash("newMockBDVDecrease()"))
      console.log("Selector changed to newMockBDVDecrease")
      currentBdv = await this.silo.newMockBDVDecrease()
      let depositBdv = await this.silo.getDeposit(userAddress, this.newSiloToken.address, 0)
      depositBdv = depositBdv[1]
      console.log("Deposit BDV: " + depositBdv)
      console.log("Current BDV: " + currentBdv)

      // ----------------------- CONVERT ------------------------
      console.log("User2 calls anti lambda convert on user to decrease user's recorded deposit bdv to current bdv")
      this.result = await this.convert.connect(user2).convert(
        // CALLDATA                              // amount, token ,account
        ConvertEncoder.convertAntiLambdaToLambda('100', this.newSiloToken.address , userAddress),
        // STEMS []
        ['0'],
        // AMOUNTS []
        ['100']
      )
      // Result returns (int96 toStem, uint256 fromAmount, uint256 toAmount, uint256 fromBdv, uint256 toBdv)
    })

    it('correctly updates deposit stats', async function () {
      let deposit = await this.silo.getDeposit(userAddress, this.newSiloToken.address, 0);
      expect(deposit[0]).to.eq('100'); // deposit[0] = amount of tokens
      expect(deposit[1]).to.eq('900000');  // deposit[1] = bdv
    })

    it('correctly updates totals', async function () {
      expect(await this.silo.getTotalDeposited(this.newSiloToken.address)).to.equal('100');
      expect(await this.silo.getTotalDepositedBdv(this.newSiloToken.address)).to.eq('900000');
    })
  
  })


  describe("anti lambda convert bdv increase", async function () {
    
    beforeEach(async function () {
      // user deposits 100 new silo token at stem 0 so 1000000 bdv
      await this.newSiloToken.mint(userAddress, '10000000');
      await this.newSiloToken.connect(user).approve(this.silo.address, '1000000000');
      await this.silo.connect(user).deposit(this.newSiloToken.address, '100', EXTERNAL);

      // simulate deposit bdv decrease for user2 by changing bdv selector to mockBdvIncrease ie 1.1e6
      await this.silo.mockChangeBDVSelector(this.newSiloToken.address, this.silo.interface.getSighash("newMockBDVIncrease()"))
      console.log("Selector changed to newMockBDVIncrease")
      currentBdv = await this.silo.newMockBDVIncrease()
      let depositBdv = await this.silo.getDeposit(userAddress, this.newSiloToken.address, 0)
      depositBdv = depositBdv[1]
      console.log("Deposit BDV: " + depositBdv)
      console.log("Current BDV: " + currentBdv)

      // ----------------------- CONVERT ------------------------
      console.log("User2 calls anti lambda convert on user to increase user's recorded deposit bdv to current bdv")
      this.result = await this.convert.connect(user2).convert(
        // CALLDATA                              // amount, token ,account
        ConvertEncoder.convertAntiLambdaToLambda('100', this.newSiloToken.address , userAddress),
        // STEMS []
        ['0'],
        // AMOUNTS []
        ['100']
      )
      // Result returns (int96 toStem, uint256 fromAmount, uint256 toAmount, uint256 fromBdv, uint256 toBdv)
    })

    it('correctly updates deposit stats', async function () {
      let deposit = await this.silo.getDeposit(userAddress, this.newSiloToken.address, 0);
      expect(deposit[0]).to.eq('100'); // deposit[0] = amount of tokens
      expect(deposit[1]).to.eq('1100000');  // deposit[1] = bdv
    })

    it('correctly updates totals', async function () {
      expect(await this.silo.getTotalDeposited(this.newSiloToken.address)).to.equal('100');
      expect(await this.silo.getTotalDepositedBdv(this.newSiloToken.address)).to.eq('1100000');
    })
  
  })
});
