const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { to18, to6, toStalk } = require('./utils/helpers.js')
const { BEAN, BEANSTALK, BCM, BEAN_3_CURVE, UNRIPE_BEAN, UNRIPE_LP, THREE_CURVE, THREE_POOL } = require('./utils/constants')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { time, mineUpTo, mine } = require("@nomicfoundation/hardhat-network-helpers");
const ZERO_BYTES = ethers.utils.formatBytes32String('0x0')
const { whitelistWell, deployMockWell } = require('../utils/well.js');
const fs = require('fs');

let user, user2, owner;
let userAddress, ownerAddress, user2Address;

describe('Silo', function () {
  before(async function () {

    [owner, user, user2] = await ethers.getSigners();
    [owner, user, user2, user3, user4] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    user3Address = user3.address;
    user4Address = user4.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address);

    await this.season.teleportSunrise(10);
    this.season.deployStemsUpgrade();

    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address);
    this.metadata = await ethers.getContractAt('MetadataFacet', this.diamond.address);
    this.diamondLoupe = await ethers.getContractAt('DiamondLoupeFacet', this.diamond.address);
    this.approval = await ethers.getContractAt('ApprovalFacet', this.diamond.address);
    this.fertilizer = await ethers.getContractAt('MockFertilizerFacet', this.diamond.address)
    this.unripe = await ethers.getContractAt('MockUnripeFacet', this.diamond.address)
    this.whitelist = await ethers.getContractAt('WhitelistFacet', this.diamond.address)
    await this.unripe.addUnripeToken(UNRIPE_BEAN, BEAN, ZERO_BYTES)
    await this.unripe.addUnripeToken(UNRIPE_LP, BEAN_3_CURVE, ZERO_BYTES);
    [this.well, this.wellFunction, this.pump] = await deployMockWell()
    await whitelistWell(this.well.address, '10000', to6('4'))
    await this.season.captureWellE(this.well.address)
    

    this.bean = await ethers.getContractAt('Bean', BEAN);
    this.beanMetapool = await ethers.getContractAt('IMockCurvePool', BEAN_3_CURVE);
    this.unripeBean = await ethers.getContractAt("MockToken", UNRIPE_BEAN);
    this.unripeLP = await ethers.getContractAt("MockToken", UNRIPE_LP);
    this.threeCurve = await ethers.getContractAt('MockToken', THREE_CURVE);
    this.threePool = await ethers.getContractAt('Mock3Curve', THREE_POOL);

    await this.season.lightSunrise();
    await this.bean.connect(user).approve(this.silo.address, '100000000000');
    await this.bean.connect(user2).approve(this.silo.address, '100000000000'); 
    await this.bean.connect(user3).approve(this.silo.address, '100000000000'); 
    await this.bean.connect(user4).approve(this.silo.address, '100000000000'); 
    await this.bean.mint(userAddress, to6('10000'));
    await this.bean.mint(user2Address, to6('10000'));
    await this.bean.mint(user3Address, to6('10000'));
    await this.bean.mint(user4Address, to6('10000'));
    await this.silo.mow(userAddress, this.bean.address);

    this.result = await this.silo.connect(user).deposit(this.bean.address, to6('1000'), EXTERNAL)
    this.result = await this.silo.connect(user2).deposit(this.bean.address, to6('1000'), EXTERNAL)

  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe('Silo Balances After Deposits', function () {
    it('properly updates the user balances', async function () {
      //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(to6('2000'));
      expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('1000'));
      expect(await this.silo.balanceOfRoots(userAddress)).to.eq(toStalk('1000000000000000'));
    });

    it('properly updates the total balances', async function () {
      //expect(await this.silo.totalSeeds()).to.eq(to6('4000'));
      expect(await this.silo.totalStalk()).to.eq(toStalk('2000'));
      expect(await this.silo.totalRoots()).to.eq(toStalk('2000000000000000'));
    });
  });

  describe('Silo Balances After Withdrawal', function () {
    beforeEach(async function () {
      await this.silo.connect(user).withdrawDeposit(this.bean.address, '2', to6('500'), EXTERNAL) //we deposited at grownStalkPerBdv of 2, need to withdraw from 2
    })

    it('properly updates the total balances', async function () {
      expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('500'));
      expect(await this.silo.balanceOfRoots(userAddress)).to.eq(toStalk('500000000000000'));
    });

    it('properly updates the total balances', async function () {
      expect(await this.silo.totalStalk()).to.eq(toStalk('1500'));
      expect(await this.silo.totalRoots()).to.eq(toStalk('1500000000000000'));
    });
  });

  describe("Silo Sunrise", async function () {
    describe("Single", async function () {
      beforeEach(async function () {
        await this.season.siloSunrise(to6('100'))
        await time.increase(3600); // wait until end of season to get earned
        await mine(25);
      })

      it('properly updates the earned balances', async function () {
        expect(await this.silo.balanceOfGrownStalk(userAddress, this.bean.address)).to.eq(toStalk('0.2'));
        expect(await this.silo.balanceOfEarnedBeans(userAddress)).to.eq(to6('50'));
        expect(await this.silo.balanceOfEarnedStalk(userAddress)).to.eq(toStalk('50'));
        expect(await this.silo.totalEarnedBeans()).to.eq(to6('100'));
      });

      it('properly updates the total balances', async function () {
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('1050'));
        expect(await this.silo.balanceOfRoots(userAddress)).to.eq(toStalk('1000000000000000'));
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.silo.totalStalk()).to.eq(toStalk('2100'));
        expect(await this.silo.totalRoots()).to.eq(toStalk('2000000000000000'));
      });
    })
  });

  describe("Single Earn", async function () {
    beforeEach(async function () {
      await this.season.siloSunrise(to6('100'))
      await time.increase(3600); // wait until end of season to get earned
      await mine(25);
      await this.silo.mow(user2Address, this.bean.address)
      this.result = await this.silo.connect(user).plant()
    })

    it('properly updates the earned balances', async function () {
      expect(await this.silo.balanceOfGrownStalk(userAddress, this.bean.address)).to.eq('0');
      expect(await this.silo.balanceOfEarnedBeans(userAddress)).to.eq('0');
      // expect(await this.silo.balanceOfEarnedSeeds(userAddress)).to.eq('0');
      expect(await this.silo.balanceOfEarnedStalk(userAddress)).to.eq('0');
      expect(await this.silo.totalEarnedBeans()).to.eq(to6('50'));
    });

    it('properly updates the total balances', async function () {
      //expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(to6('2100'));
      expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('1050.2'));
      expect(await this.silo.balanceOfRoots(userAddress)).to.eq('10001904761904761904761904');
    });

    it('properly updates the total balances', async function () {
      //expect(await this.silo.totalSeeds()).to.eq(to6('4100'));
      expect(await this.silo.totalStalk()).to.eq(to6('21004000'));
      expect(await this.silo.totalRoots()).to.eq('20003809523809523809523808');
    });

    it('properly emits events', async function () {
      expect(this.result).to.emit(this.silo, 'Earn')
    })

    it('user2 earns rest', async function () {
      await this.silo.connect(user2).plant()
      expect(await this.silo.totalEarnedBeans()).to.eq('0');
    });
  });

  describe("ERC1155 Deposits", async function () {
    before(async function () {
      await this.bean.mint(user3Address, to6('10000'));
      await this.bean.connect(user3).approve(this.silo.address, '100000000000');
    })
    it('mints an ERC1155 when depositing an whitelisted asset', async function () {
      // we use user 3 as user 1 + user 2 has already deposited - this makes it more clear
      this.result = await this.silo.connect(user3).deposit(this.bean.address, to6('1000'), EXTERNAL)
      season = this.season.season()
      stem = this.silo.seasonToStem(this.bean.address, season)
      depositID = await this.silo.getDepositId(this.bean.address, stem)
      expect(await this.silo.balanceOf(user3Address, depositID)).to.eq(to6('1000'));
      await expect(this.result).to.emit(this.silo, 'TransferSingle').withArgs(
        user3Address,
        ethers.constants.AddressZero, 
        user3Address,
        depositID, 
        to6('1000')
      );
    });

    it('adds to the ERC1155 balance when depositing an whitelisted asset', async function () {
      // user 1 already deposited 1000, so we expect the balanceOf to be 2000e6 here. 
      this.result = await this.silo.connect(user).deposit(this.bean.address, to6('1000'), EXTERNAL)
      season = this.season.season()
      stem = this.silo.seasonToStem(this.bean.address, season)
      depositID = await this.silo.getDepositId(this.bean.address, stem)
      await expect(this.result).to.emit(this.silo, 'TransferSingle').withArgs(
        userAddress, // operator
        ethers.constants.AddressZero, // from
        userAddress, // to
        depositID, // depositID
        to6('1000') // amt
      );
      expect(await this.silo.balanceOf(userAddress, depositID)).to.eq(to6('2000'));
    });


    it('removes ERC1155 balance when withdrawing an whitelisted asset', async function () {
      // user 1 already deposited 1000, so we expect the balanceOf to be 500e6 here. 
      season = this.season.season()
      stem = this.silo.seasonToStem(this.bean.address, season)
      
      this.result = await this.silo.connect(user).withdrawDeposit(this.bean.address, stem, to6('500'), EXTERNAL)
      depositID = await this.silo.getDepositId(this.bean.address, stem)
      await expect(this.result).to.emit(this.silo, 'TransferSingle').withArgs(
        userAddress, // operator
        userAddress, // from
        ethers.constants.AddressZero, // to
        depositID, // depositID
        to6('500') // amt
      );
      expect(await this.silo.balanceOf(userAddress, depositID)).to.eq(to6('500'));
    });

    it('transfers an ERC1155 deposit', async function () {
      // transfering a deposit from user 1, to user 3
      season = this.season.season()
      stem = this.silo.seasonToStem(this.bean.address, season)
      depositID = await this.silo.getDepositId(this.bean.address, stem)

      expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('1000'));
      expect(await this.silo.balanceOfStalk(user3Address)).to.eq(to6('0'));
      
      // get roots
      roots = await this.silo.balanceOfRoots(userAddress);
      expect(await this.silo.balanceOfRoots(user3Address)).to.eq('0');


      this.result = await this.silo.connect(user).safeTransferFrom(
        userAddress,
        user3Address,
        depositID,
        to6('1000'),
        0x00
      )

      expect(await this.silo.balanceOfStalk(user3Address)).to.eq(toStalk('1000'));
      expect(await this.silo.balanceOfStalk(userAddress)).to.eq(to6('0'));
      
      expect(await this.silo.balanceOfRoots(user3Address)).to.eq(roots);
      expect(await this.silo.balanceOfRoots(userAddress)).to.eq('0');

      expect(await this.silo.balanceOf(userAddress, depositID)).to.eq(to6('0'));
      expect(await this.silo.balanceOf(user3Address, depositID)).to.eq(to6('1000'));

      // transfer deposit has two events, one burns and one mints 
      await expect(this.result).to.emit(this.silo, 'TransferSingle').withArgs(
        userAddress, // operator 
        userAddress, // from
        user3Address, // to
        depositID, // depositID
        to6('1000') // amt
      );
    });

    it('batch transfers an ERC1155 deposit', async function () {
      // skip to next season, user 1 deposits again, and batch transfers the ERC1155 to user 3
      season = this.season.season()
      stem0 = this.silo.seasonToStem(this.bean.address, season)
      depositID0 = await this.silo.getDepositId(this.bean.address, stem0)

      await this.season.farmSunrise();  

      season = this.season.season()
      stem1 = this.silo.seasonToStem(this.bean.address, season)
      depositID1 = await this.silo.getDepositId(this.bean.address, stem1)

      
      this.result = await this.silo.connect(user).deposit(
        this.bean.address, 
        to6('1000'), 
        
        EXTERNAL
      )
      roots = await this.silo.balanceOfRoots(userAddress);


      expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('2000.2')); // 2 stalk was grown because of the season
      expect(await this.silo.balanceOfStalk(user3Address)).to.eq(toStalk('0'));

      this.result = await this.silo.connect(user).safeBatchTransferFrom(
        userAddress,
        user3Address,
        [depositID0, depositID1],
        [ to6('1000'), to6('1000')],
        0x00
      )

      expect(await this.silo.balanceOfStalk(userAddress)).to.eq(toStalk('0'));
      expect(await this.silo.balanceOfStalk(user3Address)).to.eq(toStalk('2000.2'));

      expect(await this.silo.balanceOfRoots(userAddress)).to.eq('0');
      expect(await this.silo.balanceOfRoots(user3Address)).to.eq(roots);

      expect(await this.silo.balanceOf(userAddress, depositID0)).to.eq(to6('0'));
      expect(await this.silo.balanceOf(userAddress, depositID1)).to.eq(to6('0'));
      expect(await this.silo.balanceOf(user3Address, depositID0)).to.eq(to6('1000'));
      expect(await this.silo.balanceOf(user3Address, depositID1)).to.eq(to6('1000'));

      // transfer deposit emits 
      await expect(this.result).to.emit(this.silo, 'TransferSingle').withArgs(
        userAddress,  // operator
        userAddress,  // from
        user3Address, // to
        depositID0, // depositID
        to6('1000')  // amt
      );

      await expect(this.result).to.emit(this.silo, 'TransferSingle').withArgs(
        userAddress,  // operator
        userAddress,  // from
        user3Address, // to
        depositID1,   // depositID
        to6('1000')  // amt
      );
    });

    it('properly gives the correct batch balances', async function () {
      season = this.season.season()
      stem = this.silo.seasonToStem(this.bean.address, season)
      depositID = await this.silo.getDepositId(this.bean.address, stem)
 
      let b = await this.silo.balanceOfBatch(
        [userAddress,user2Address],
        [depositID,depositID]
      )
      expect(b[0]).to.eq(to6('1000'));
      expect(b[1]).to.eq(to6('1000'));

    });

    it('properly gives the correct depositID', async function () {
      season = this.season.season()
      stem = this.silo.seasonToStem(this.bean.address, season)
      depositID = await this.silo.getDepositId(this.bean.address, stem)
      // first 20 bytes is the address,
      // next 12 bytes is the stem
      // since this deposit was created 1 season after the asset was whitelisted, the amt is 2
      expect(depositID).to.eq('0xbea0000029ad1c77d3d5d23ba2d8893db9d1efab000000000000000000000002');
    });

    it("properly emits an event when a user approves for all", async function () {
      await expect(this.approval.connect(user).setApprovalForAll(user2Address, true))
        .to.emit(this.approval, 'ApprovalForAll')
        .withArgs(userAddress, user2Address, true);
      expect(await this.approval.isApprovedForAll(userAddress, user2Address)).to.eq(true);
    });

    it("properly gives an URI", async function () {
      await this.season.farmSunrises(1000); 

      // bean token
      depositmetadata = await fs.readFileSync(__dirname + '/data/base64EncodedImageBean.txt', 'utf-8');
      depositID1 = '0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab000000000000000000000002';
      expect(await this.metadata.uri(depositID1)).to.eq(depositmetadata);

      // bean3crv token
      depositmetadata = await fs.readFileSync(__dirname + '/data/base64EncodedImageBean3Crv.txt', 'utf-8');
      depositID2 = '0xC9C32CD16BF7EFB85FF14E0C8603CC90F6F2EE49000000000000000000000200';
      expect(await this.metadata.uri(depositID2)).to.eq(depositmetadata);

      // beanEthToken
      depositmetadata = await fs.readFileSync(__dirname + '/data/base64EncodedImageBeanEth.txt', 'utf-8');
      depositID3 = '0xBEA0e11282e2bB5893bEcE110cF199501e872bAdFFFFFFFFFFFFF00000000002';
      expect(await this.metadata.uri(depositID3)).to.eq(depositmetadata);
      // urBean token
      depositmetadata = await fs.readFileSync(__dirname + '/data/base64EncodedImageUrBean.txt', 'utf-8');
      depositID4 = '0x1BEA0050E63e05FBb5D8BA2f10cf5800B6224449000000000000000000000400';
      expect(await this.metadata.uri(depositID4)).to.eq(depositmetadata);

      // urBeanEth token
      depositmetadata = await fs.readFileSync(__dirname + '/data/base64EncodedImageUrBeanEth.txt', 'utf-8');
      depositID5 = '0x1BEA3CcD22F4EBd3d37d731BA31Eeca95713716DFFFFFFFFFFFFFFFFFFFFF97C';
      expect(await this.metadata.uri(depositID5)).to.eq(depositmetadata);

    });

    it("properly gives the correct ERC-165 identifier", async function () {
      expect(await this.diamondLoupe.supportsInterface("0xd9b67a26")).to.eq(true);
      expect(await this.diamondLoupe.supportsInterface("0x0e89341c")).to.eq(true);
    });
  });


  /**
   * Vesting period now reverts and thus tests are skipped/invalid.
   */
  describe.skip("Earned Beans issuance during vesting period", async function () {
    before(async function () {
      this.result = await this.silo.connect(user3).deposit(this.bean.address, to6('1000'), EXTERNAL)
      this.result = await this.silo.connect(user4).deposit(this.bean.address, to6('1000'), EXTERNAL)
    });
    
    // tests a farmers deposit that has no earned bean prior
    describe("No Earned Beans prior to plant", async function() {
      
      beforeEach(async function () {
        await this.season.siloSunrise(to6('100'))
        beginning_timestamp = await time.latest();
        season = await this.season.season();
        
      })

      describe("With Multiple Users", async function () {
        it('a single farmer plants during and after vesting period', async function () {
          await this.season.setSunriseBlock(await ethers.provider.getBlockNumber());
  
          await this.silo.connect(user).plant();
          stem = await this.silo.seasonToStem(this.bean.address, season);
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0);
          expect(await this.silo.balanceOfEarnedBeans(user2Address)).to.eq(0);
          expect(await this.silo.balanceOfEarnedBeans(user3Address)).to.eq(0);
          expect(await this.silo.balanceOfEarnedBeans(user4Address)).to.eq(0);
  
          
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 11 + 1);
  
          await this.silo.connect(user).plant();
          earned_beans = await this.silo.getDeposit(userAddress,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(24999999);
          expect(await this.silo.balanceOfEarnedBeans(user2Address)).to.eq(25e6);
          expect(await this.silo.balanceOfEarnedBeans(user3Address)).to.eq(25e6);
          expect(await this.silo.balanceOfEarnedBeans(user4Address)).to.eq(25e6);
        });
  
        it('multiple farmers plants during and after vesting period', async function () {
         
          await this.silo.connect(user).plant();
          await this.silo.connect(user2).plant();
          await this.silo.connect(user3).plant();
          await this.silo.connect(user4).plant();
          stem = await this.silo.seasonToStem(this.bean.address, season);
  
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0);
          earned_beans = await this.silo.getDeposit(user2Address, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0);
          earned_beans = await this.silo.getDeposit(user3Address, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0);
          earned_beans = await this.silo.getDeposit(user4Address, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0);
          
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 11 + 1);
          await this.silo.connect(user4).plant();
          await this.silo.connect(user2).plant();
          earned_beans = await this.silo.getDeposit(user4Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(25e6);
          earned_beans = await this.silo.getDeposit(user3Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(0);
          earned_beans = await this.silo.getDeposit(user2Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(25e6);
          earned_beans = await this.silo.getDeposit(userAddress,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(0);
        });
  
        it('some farmers plants during, some farmers plant after vesting period', async function () {
          await this.season.setSunriseBlock(await ethers.provider.getBlockNumber());
    
         
          await this.silo.connect(user).plant();
          await this.silo.connect(user2).plant();
          stem = await this.silo.seasonToStem(this.bean.address, season);

  
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0);
          earned_beans = await this.silo.getDeposit(user2Address, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0);
  
          expect(await this.silo.balanceOfEarnedBeans(user3Address)).to.eq(0);
          expect(await this.silo.balanceOfEarnedBeans(user4Address)).to.eq(0);
          
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 11 + 1);
          await this.silo.connect(user4).plant();
          await this.silo.connect(user3).plant();
          earned_beans = await this.silo.getDeposit(user4Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(24999999);
          earned_beans = await this.silo.getDeposit(user3Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(25e6);
  
          expect(await this.silo.balanceOfEarnedBeans(user2Address)).to.eq(25e6);
          expect(await this.silo.balanceOfEarnedBeans(userAddress)).to.eq(25e6);
  
        });

        it("Some Earned Beans Prior to plant, some earned beans after plant", async function () {
          await mineUpTo((await ethers.provider.getBlockNumber()) + 11 + 1);
          await this.silo.connect(user).plant(); // root increased by X, stalk increased by 2
          stem = await this.silo.seasonToStem(this.bean.address, season);
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)
  
          expect(earned_beans[0]).to.eq(24999999);
          expect(await this.silo.balanceOfEarnedBeans(userAddress)).to.eq(0);
          expect(await this.silo.balanceOfEarnedBeans(user2Address)).to.eq(25e6);
          expect(await this.silo.balanceOfEarnedBeans(user3Address)).to.eq(25e6);
          expect(await this.silo.balanceOfEarnedBeans(user4Address)).to.eq(25e6);
  
          // call sunrise, plant again
          await time.increase(3600)
          await this.season.siloSunrise(to6('100'));
          season = await this.season.season();
          await this.season.setSunriseBlock(await ethers.provider.getBlockNumber());

          expect(await this.silo.balanceOfEarnedBeans(userAddress)).to.eq(0); // harvested last season 
          expect(await this.silo.balanceOfEarnedBeans(user2Address)).to.eq(25e6); // not harvested yet 
          expect(await this.silo.balanceOfEarnedBeans(user3Address)).to.eq(25e6); // 
          expect(await this.silo.balanceOfEarnedBeans(user4Address)).to.eq(25e6);
        
          await this.silo.connect(user).plant(); // root increased by Y, stalk increased by 2
          stem = await this.silo.seasonToStem(this.bean.address, season);
          earned_beans = await this.silo.getDeposit(user2Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(0);

          await this.silo.connect(user2).plant(); // root increased by Y, stalk increased by 4
          earned_beans = await this.silo.getDeposit(user2Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(25e6);
  
          expect(await this.silo.balanceOfEarnedBeans(userAddress)).to.eq(0); // harvested 25 beans from previous season
          expect(await this.silo.balanceOfEarnedBeans(user2Address)).to.eq(0); // just harvested
  
          expect(await this.silo.balanceOfEarnedBeans(user3Address)).to.eq(25e6);
          expect(await this.silo.balanceOfEarnedBeans(user4Address)).to.eq(25e6);
  

          await mineUpTo((await ethers.provider.getBlockNumber()) + 11 + 1);
          
          //  user has more as he mowed grown stalk from previous season
          expect(await this.silo.balanceOfEarnedBeans(userAddress)).to.eq(25003659); 
          expect(await this.silo.balanceOfEarnedBeans(user2Address)).to.eq(24998780);
  
          expect(await this.silo.balanceOfEarnedBeans(user3Address)).to.eq(49998780);
          expect(await this.silo.balanceOfEarnedBeans(user4Address)).to.eq(49998780);

          await this.silo.connect(user3).plant();
          await this.silo.connect(user4).plant(); 
  
          earned_beans = await this.silo.getDeposit(user3Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(49998780);
          earned_beans = await this.silo.getDeposit(user4Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(49998780);
  
          expect(await this.silo.balanceOfEarnedBeans(userAddress)).to.eq(25003659); 
          expect(await this.silo.balanceOfEarnedBeans(user2Address)).to.eq(24998780);
  
        });

        it('farmer plants in vesting period, then plants again in the following season', async function () {
          await this.season.setSunriseBlock(await ethers.provider.getBlockNumber());
          season = await this.season.season();
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(userAddress)).to.eq(0);
          await this.silo.connect(user).plant();

          stem = await this.silo.seasonToStem(this.bean.address, season);
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0);
            
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 11 + 1);
          expect(await this.silo.balanceOfEarnedBeans(userAddress)).to.eq(24999999);

          // sunrise again 
          await this.season.siloSunrise(to6('100'))
          season = await this.season.season();
          stem = await this.silo.seasonToStem(this.bean.address, season);

          expect(await this.silo.balanceOfEarnedBeans(userAddress)).to.eq(24999999); 
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0)
          
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 11 + 1);

          await this.silo.connect(user).plant();
          expect(await this.silo.balanceOfEarnedBeans(userAddress)).to.eq(0);
          earned_beans = await this.silo.getDeposit(userAddress,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(50003658); // user gets the earned beans from the previous season + the beans from the current season
          // user gets slightly more since they mowed last season. 
        });

        it('farmer partial withdraws during vesting period', async function () {
          // 100 beans are given to silo holders:  
          // user 1-4 own 25% of the silo each (1000/4000)
          
          // allocation after user 1 withdraws 500 beans (50% of their allocation): 
          // user 1 = 14.28% (500/3500)
          // user 2,3,4 = 28.57% (1000/3500)

          await this.season.setSunriseBlock(await ethers.provider.getBlockNumber());
          stem = await this.silo.seasonToStem(this.bean.address, season);

          await this.silo.connect(user).withdrawDeposit(this.bean.address, '2', to6('500'), EXTERNAL);
          await this.silo.connect(user).plant();
          
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0); 
          expect(await this.silo.balanceOfEarnedBeans(user2Address)).to.eq(0);
          expect(await this.silo.balanceOfEarnedBeans(user3Address)).to.eq(0);
          expect(await this.silo.balanceOfEarnedBeans(user4Address)).to.eq(0);
  
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 11 + 1);
          
          await this.silo.connect(user).plant();
          earned_beans = await this.silo.getDeposit(userAddress,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(14284400);
          expect(await this.silo.balanceOfEarnedBeans(user2Address)).to.eq(28571866);
          expect(await this.silo.balanceOfEarnedBeans(user3Address)).to.eq(28571866);
          expect(await this.silo.balanceOfEarnedBeans(user4Address)).to.eq(28571866);
        })

        it('farmer partially transfers Deposit prior to plant', async function(){
          await this.season.setSunriseBlock(await ethers.provider.getBlockNumber());    
          
          await this.silo.connect(user).transferDeposit(
            userAddress,
            user2Address,
            this.bean.address,
            '2',
            to6('500')
            )
          await this.silo.connect(user).plant();
          stem = await this.silo.seasonToStem(this.bean.address, season);
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)

          expect(earned_beans[0]).to.eq(0); // 50 earned beans - 25 from this season 
          expect(await this.silo.balanceOfEarnedBeans(user2Address)).to.eq(0);
          expect(await this.silo.balanceOfEarnedBeans(user3Address)).to.eq(0);
          expect(await this.silo.balanceOfEarnedBeans(user4Address)).to.eq(0);


          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 11 + 1);
  
          await this.silo.connect(user).plant();
          earned_beans = await this.silo.getDeposit(userAddress,this.bean.address,stem);

          expect(earned_beans[0]).to.eq(12498750); // ~12.5 beans were transferred 
          expect(await this.silo.balanceOfEarnedBeans(user2Address)).to.eq(37501249);
          expect(await this.silo.balanceOfEarnedBeans(user3Address)).to.eq(25e6);
          expect(await this.silo.balanceOfEarnedBeans(user4Address)).to.eq(25e6);

        })

        it('farmer fully transfers Deposit prior to plant', async function(){
          await this.season.setSunriseBlock(await ethers.provider.getBlockNumber());    
          
          await this.silo.connect(user).transferDeposit(
            userAddress,
            user2Address,
            this.bean.address,
            '2',
            to6('1000')
            )
          await this.silo.connect(user).plant();
          stem = await this.silo.seasonToStem(this.bean.address, season);
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)

          expect(earned_beans[0]).to.eq(0); // earned beans were transferred to user2
          expect(await this.silo.balanceOfEarnedBeans(user2Address)).to.eq(0);
          expect(await this.silo.balanceOfEarnedBeans(user3Address)).to.eq(0);
          expect(await this.silo.balanceOfEarnedBeans(user4Address)).to.eq(0);
  
          
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 11 + 1);
  
          await this.silo.connect(user).plant();
          earned_beans = await this.silo.getDeposit(userAddress,this.bean.address,stem);

          expect(earned_beans[0]).to.eq(0);
          expect(await this.silo.balanceOfEarnedBeans(user2Address)).to.eq(49999999);
          expect(await this.silo.balanceOfEarnedBeans(user3Address)).to.eq(25e6);
          expect(await this.silo.balanceOfEarnedBeans(user4Address)).to.eq(25e6);


        })
      })
    })

    describe("Some Earned Beans Prior to plant", async function () {
      
      beforeEach(async function () {
        await this.season.siloSunrise(to6('100'))
        await time.increase(3600) // 1800 + 1800 = 60 minutes = all beans issued
        await this.season.siloSunrise(to6('100'))
        season = await this.season.season()
      })

      describe("With Multiple Users", async function () {
        
        it('a single farmer plants during and after vesting period', async function () {
          await this.season.setSunriseBlock(await ethers.provider.getBlockNumber());
          
          await this.silo.connect(user).plant();
          stem = await this.silo.seasonToStem(this.bean.address, season);
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)

          expect(earned_beans[0]).to.eq(24999999); // 50 earned beans - 25 from this season 
          expect(await this.silo.balanceOfEarnedBeans(user2Address)).to.eq(25e6);
          expect(await this.silo.balanceOfEarnedBeans(user3Address)).to.eq(25e6);
          expect(await this.silo.balanceOfEarnedBeans(user4Address)).to.eq(25e6);
  
          
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 11 + 1);
  
          await this.silo.connect(user).plant();
          earned_beans = await this.silo.getDeposit(userAddress,this.bean.address,stem);

          expect(earned_beans[0]).to.eq(49999999);
          expect(await this.silo.balanceOfEarnedBeans(user2Address)).to.eq(50e6);
          expect(await this.silo.balanceOfEarnedBeans(user3Address)).to.eq(50e6);
          expect(await this.silo.balanceOfEarnedBeans(user4Address)).to.eq(50e6);
        });
  
        it('multiple farmers plants during and after vesting period', async function () {
          await this.season.setSunriseBlock(await ethers.provider.getBlockNumber());

          await this.silo.connect(user).plant();
          await this.silo.connect(user3).plant();
          stem = await this.silo.seasonToStem(this.bean.address, season);

  
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(24999999);
          earned_beans = await this.silo.getDeposit(user2Address, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0);
          earned_beans = await this.silo.getDeposit(user3Address, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(24999999);
          earned_beans = await this.silo.getDeposit(user4Address, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0);
          
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 11 + 1);
          await this.silo.connect(user4).plant();
          await this.silo.connect(user2).plant();
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem);
          expect(earned_beans[0]).to.eq(24999999);
          earned_beans = await this.silo.getDeposit(user2Address,this.bean.address, stem);
          expect(earned_beans[0]).to.eq(50e6);
          earned_beans = await this.silo.getDeposit(user3Address,this.bean.address, stem);
          expect(earned_beans[0]).to.eq(24999999);
          earned_beans = await this.silo.getDeposit(user4Address,this.bean.address, stem);
          expect(earned_beans[0]).to.eq(49999999);
          
        });
  
        it('some farmers plants during, some farmers plant after vesting period', async function () {
          await this.season.setSunriseBlock(await ethers.provider.getBlockNumber());
    
          await this.silo.connect(user).plant();
          await this.silo.connect(user2).plant();
  
          stem = await this.silo.seasonToStem(this.bean.address, season);
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(24999999);
          earned_beans = await this.silo.getDeposit(user2Address, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(24999999);
  
          expect(await this.silo.balanceOfEarnedBeans(user3Address)).to.eq(25e6);
          expect(await this.silo.balanceOfEarnedBeans(user4Address)).to.eq(25e6);
          
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 11 + 1);
          await this.silo.connect(user4).plant();
          await this.silo.connect(user3).plant();
          earned_beans = await this.silo.getDeposit(user4Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(49999999);
          earned_beans = await this.silo.getDeposit(user3Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(50e6);
  
          expect(await this.silo.balanceOfEarnedBeans(user2Address)).to.eq(25000001);
          expect(await this.silo.balanceOfEarnedBeans(userAddress)).to.eq(25000001);
  
        });

        it('farmer partial withdraws during vesting period', async function () {
          // in this test, 100 beans are given to silo holders 
          // in the previous and current season. 
          // for the previous season, user 1-4 own 25% of the silo each (1000/4000).
          // they each are allocated 25 beans.
          
          // in this current season, user 1 withdraws 50% of his deposit.
          // thus, the new allocation for the current season is:
          // user 1 = 14.58% (525/3600), 14.58 beans, 39.58 beans in total.
          // user 2,3,4 = 28.47% (1025/3600), 28.47 beans, 53.47 beans in total.

          await this.season.setSunriseBlock(await ethers.provider.getBlockNumber());
          stem = await this.silo.seasonToStem(this.bean.address, season);

          await this.silo.connect(user).withdrawDeposit(this.bean.address, '2', to6('500'), EXTERNAL);
          await this.silo.connect(user).plant();
          
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(24996230);
          expect(await this.silo.balanceOfEarnedBeans(user2Address)).to.eq(24999669);
          expect(await this.silo.balanceOfEarnedBeans(user3Address)).to.eq(24999669);
          expect(await this.silo.balanceOfEarnedBeans(user4Address)).to.eq(24999669);
  
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 11);
          
          await this.silo.connect(user).plant();
          earned_beans = await this.silo.getDeposit(userAddress,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(39580737);
          expect(await this.silo.balanceOfEarnedBeans(user2Address)).to.eq(53473087);
          expect(await this.silo.balanceOfEarnedBeans(user3Address)).to.eq(53473087);
          expect(await this.silo.balanceOfEarnedBeans(user4Address)).to.eq(53473087);
        })

        it('farmer partially transfers Deposit prior to plant', async function(){
          await this.season.setSunriseBlock(await ethers.provider.getBlockNumber());    
          
          await this.silo.connect(user).transferDeposit(
            userAddress,
            user2Address,
            this.bean.address,
            '2',
            to6('500')
            )
          await this.silo.connect(user).plant();
          stem = await this.silo.seasonToStem(this.bean.address, season);
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)

          expect(earned_beans[0]).to.eq(24997561); // 50 earned beans - 25 from this season 
          expect(await this.silo.balanceOfEarnedBeans(user2Address)).to.eq(24997676);
          expect(await this.silo.balanceOfEarnedBeans(user3Address)).to.eq(25e6);
          expect(await this.silo.balanceOfEarnedBeans(user4Address)).to.eq(25e6);


          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 11 + 1);
  
          await this.silo.connect(user).plant();
          earned_beans = await this.silo.getDeposit(userAddress,this.bean.address,stem);

          expect(earned_beans[0]).to.eq(37802380); // ~12.5 beans were transferred 
          expect(await this.silo.balanceOfEarnedBeans(user2Address)).to.eq(62197619);
          expect(await this.silo.balanceOfEarnedBeans(user3Address)).to.eq(50e6);
          expect(await this.silo.balanceOfEarnedBeans(user4Address)).to.eq(50e6);


        })

        it('farmer fully transfers Deposit prior to plant', async function(){
          await this.season.setSunriseBlock(await ethers.provider.getBlockNumber());    
          
          await this.silo.connect(user).transferDeposit(
            userAddress,
            user2Address,
            this.bean.address,
            '2',
            to6('1000')
            )
          await this.silo.connect(user).plant();
          stem = await this.silo.seasonToStem(this.bean.address, season);
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)

          expect(earned_beans[0]).to.eq(0); // earned beans were transferred to user2
          expect(await this.silo.balanceOfEarnedBeans(user2Address)).to.eq(49990476);
          expect(await this.silo.balanceOfEarnedBeans(user3Address)).to.eq(25e6);
          expect(await this.silo.balanceOfEarnedBeans(user4Address)).to.eq(25e6);
  
          
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 11 + 1);
  
          await this.silo.connect(user).plant();
          earned_beans = await this.silo.getDeposit(userAddress,this.bean.address,stem);

          expect(earned_beans[0]).to.eq(0);
          expect(await this.silo.balanceOfEarnedBeans(user2Address)).to.eq(99999999);
          expect(await this.silo.balanceOfEarnedBeans(user3Address)).to.eq(50e6);
          expect(await this.silo.balanceOfEarnedBeans(user4Address)).to.eq(50e6);


        })
      });
    });
  });

  describe("Withdrawing during vesting period", async function () {
    it('properly reverts', async function () {
      await this.season.teleportSunrise(10);
      await this.silo.connect(user).deposit(this.bean.address, '1000', EXTERNAL);
      const stem = await this.silo.seasonToStem(this.bean.address, '10');

      await expect(
        this.silo.connect(user).withdrawDeposit(this.bean.address, stem, '1000', EXTERNAL)
      ).to.be.revertedWith('Silo: In vesting period')
      await expect(
        this.silo.connect(user).withdrawDeposits(this.bean.address, [stem], ['1000'], EXTERNAL)
      ).to.be.revertedWith('Silo: In vesting period')

    });
  });
});
