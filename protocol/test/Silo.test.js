const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { to18, to6 , toStalk } = require('./utils/helpers.js')
const { toBN } = require('../utils/helpers.js');
const { BEAN, BEANSTALK, BCM, BEAN_3_CURVE, UNRIPE_BEAN, UNRIPE_LP, THREE_CURVE, THREE_POOL } = require('./utils/constants')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { time, mineUpTo, mine } = require("@nomicfoundation/hardhat-network-helpers");
const ZERO_BYTES = ethers.utils.formatBytes32String('0x0')
const { whitelistWell, deployMockWell, deployMockBeanEthWell } = require('../utils/well.js');
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
    this.seasonGetter = await ethers.getContractAt('SeasonGettersFacet', this.diamond.address)

    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address);
    this.metadata = await ethers.getContractAt('MetadataFacet', this.diamond.address);
    this.diamondLoupe = await ethers.getContractAt('DiamondLoupeFacet', this.diamond.address);
    this.approval = await ethers.getContractAt('ApprovalFacet', this.diamond.address);
    this.fertilizer = await ethers.getContractAt('MockFertilizerFacet', this.diamond.address)
    this.unripe = await ethers.getContractAt('MockUnripeFacet', this.diamond.address)
    this.whitelist = await ethers.getContractAt('WhitelistFacet', this.diamond.address)
    this.siloGetters = await ethers.getContractAt('SiloGettersFacet', this.diamond.address)
    await this.unripe.addUnripeToken(UNRIPE_BEAN, BEAN, ZERO_BYTES)
    await this.unripe.addUnripeToken(UNRIPE_LP, BEAN_3_CURVE, ZERO_BYTES);
    [this.well, this.wellFunction, this.pump] = await deployMockBeanEthWell('BEANWETHCP2w')
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
    
    // with the germination update, the users deposit will not be active until the remainder of the season + 1 has passed.
    await this.season.siloSunrise(to6('0'))
    await this.season.siloSunrise(to6('0'))
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe('Silo Balances After Deposits', function () {
    it('properly updates the user balances', async function () {
      expect(await this.siloGetters.balanceOfStalk(userAddress)).to.eq(toStalk('1000'));
      expect(await this.siloGetters.balanceOfRoots(userAddress)).to.eq(toStalk('1000000000000000'));
      await this.silo.mow(userAddress, this.bean.address);
      expect(await this.siloGetters.balanceOfStalk(userAddress)).to.eq(toStalk('1000.4'));
      expect(await this.siloGetters.balanceOfRoots(userAddress)).to.eq(toStalk('1000400000000000'));
    });

    it('properly updates the total balances', async function () {
      expect(await this.siloGetters.totalStalk()).to.eq(toStalk('2000'));
      expect(await this.siloGetters.totalRoots()).to.eq(toStalk('2000000000000000'));
      await this.silo.mow(userAddress, this.bean.address);
      expect(await this.siloGetters.totalStalk()).to.eq(toStalk('2000.4'));
      expect(await this.siloGetters.totalRoots()).to.eq(toStalk('2000400000000000'));
    });
  });

  describe('Silo Balances After Withdrawal', function () {
    beforeEach(async function () {
      await this.silo.connect(user).withdrawDeposit(this.bean.address, to6('2'), to6('500'), EXTERNAL) //we deposited at grownStalkPerBdv of 2, need to withdraw from 2
    })

    it('properly updates the total balances', async function () {
      // 2 seasons has passed, so we expect 0.4 stalk to be grown (1000.4 stalk total)
      // since the user withdrawn half of their deposit, we expect an additional 0.2 stalk to be withdrawn.
      expect(await this.siloGetters.balanceOfStalk(userAddress)).to.eq(toStalk('500.2'));
      expect(await this.siloGetters.balanceOfRoots(userAddress)).to.eq(toStalk('500200000000000'));
    });

    it('properly updates the total balances', async function () {
      expect(await this.siloGetters.totalStalk()).to.eq(toStalk('1500.2'));
      expect(await this.siloGetters.totalRoots()).to.eq(toStalk('1500200000000000'));
    });
  });

  describe("Silo Sunrise", async function () {
    describe("Single", async function () {
      beforeEach(async function () {
        await this.season.siloSunrise(to6('100'))
      })

      it('properly updates the earned balances', async function () {
        expect(await this.siloGetters.balanceOfGrownStalk(userAddress, this.bean.address)).to.eq(toStalk('0.6'));
        expect(await this.siloGetters.balanceOfEarnedBeans(userAddress)).to.eq(to6('50'));
        expect(await this.siloGetters.balanceOfEarnedStalk(userAddress)).to.eq(toStalk('50'));
        expect(await this.siloGetters.totalEarnedBeans()).to.eq(to6('100'));
      });

      it('properly updates the total balances', async function () {
        expect(await this.siloGetters.balanceOfStalk(userAddress)).to.eq(toStalk('1050'));
        expect(await this.siloGetters.balanceOfRoots(userAddress)).to.eq(toStalk('1000000000000000'));
      });
  
      it('properly updates the total balances', async function () {
        expect(await this.siloGetters.totalStalk()).to.eq(toStalk('2100'));
        expect(await this.siloGetters.totalRoots()).to.eq(toStalk('2000000000000000'));
      });
    })
  });

  describe("Single Earn", async function () {
    beforeEach(async function () {
      await this.season.siloSunrise(to6('100'))
      await this.silo.mow(user2Address, this.bean.address)
      this.result = await this.silo.connect(user).plant()
    })

    it('properly updates the earned balances', async function () {
      expect(await this.siloGetters.balanceOfGrownStalk(userAddress, this.bean.address)).to.eq('0');
      expect(await this.siloGetters.balanceOfEarnedBeans(userAddress)).to.eq('0');
      expect(await this.siloGetters.balanceOfEarnedStalk(userAddress)).to.eq('0');
      expect(await this.siloGetters.totalEarnedBeans()).to.eq(to6('50'));
    });

    it('properly updates the total balances', async function () {
      expect(await this.siloGetters.balanceOfStalk(userAddress)).to.eq(toStalk('1050.6'));
      expect(await this.siloGetters.balanceOfRoots(userAddress)).to.eq('10005714285714285714285714');
    });

    it('properly updates the total balances', async function () {
      expect(await this.siloGetters.totalStalk()).to.eq(to6('21012000'));
      expect(await this.siloGetters.totalRoots()).to.eq('20011428571428571428571428');
    });

    it('properly emits events', async function () {
      expect(this.result).to.emit(this.silo, 'Earn')
    })

    it('user2 earns rest', async function () {
      await this.silo.connect(user2).plant()
      expect(await this.siloGetters.totalEarnedBeans()).to.eq('0');
      expect(await this.siloGetters.balanceOfStalk(user2Address)).to.eq(toStalk('1050.6'));
      expect(await this.siloGetters.balanceOfRoots(user2Address)).to.eq('10005714285714285714285714');
    });
  });

  describe("ERC1155 Deposits", async function () {
    beforeEach(async function () {
      await this.bean.mint(user3Address, to6('10000'));

      // deposit 1000 beans at season 3.
      await this.silo.connect(user).deposit(this.bean.address, to6('1000'), EXTERNAL)
    })

    it('mints an ERC1155 when depositing an whitelisted asset', async function () {
      // we use user 3 as user 1 + user 2 has already deposited - this makes it more clear
      this.result = await this.silo.connect(user3).deposit(this.bean.address, to6('1000'), EXTERNAL)
      season = this.seasonGetter.season()
      stem = this.silo.mockSeasonToStem(this.bean.address, season)
      depositID = await this.siloGetters.getDepositId(this.bean.address, stem)
      expect(await this.siloGetters.balanceOf(user3Address, depositID)).to.eq(to6('1000'));
      await expect(this.result).to.emit(this.silo, 'TransferSingle').withArgs(
        user3Address,
        ethers.constants.AddressZero, 
        user3Address,
        depositID, 
        to6('1000')
      );
    });

    it('adds to the ERC1155 balance when depositing an whitelisted asset', async function () {
      this.result = await this.silo.connect(user).deposit(this.bean.address, to6('1000'), EXTERNAL)
      season = this.seasonGetter.season()
      stem = this.silo.mockSeasonToStem(this.bean.address, season)
      depositID = await this.siloGetters.getDepositId(this.bean.address, stem)
      expect(await this.siloGetters.balanceOf(userAddress, depositID)).to.eq(to6('2000'));
      
      await expect(this.result).to.emit(this.silo, 'TransferSingle').withArgs(
        userAddress, // operator
        ethers.constants.AddressZero, // from
        userAddress, // to
        depositID, // depositID
        to6('1000') // amt
      );
    });

    it('removes ERC1155 balance when withdrawing an whitelisted asset', async function () {
      // user 1 already deposited 1000, so we expect the balanceOf to be 500e6 here. 
      season = this.seasonGetter.season()
      stem = this.silo.mockSeasonToStem(this.bean.address, season)
      depositID = await this.siloGetters.getDepositId(this.bean.address, stem)
      expect(await this.siloGetters.balanceOf(userAddress, depositID)).to.eq(to6('1000'));
      this.result = await this.silo.connect(user).withdrawDeposit(this.bean.address, stem, to6('500'), EXTERNAL)
      await expect(this.result).to.emit(this.silo, 'TransferSingle').withArgs(
        userAddress, // operator
        userAddress, // from
        ethers.constants.AddressZero, // to
        depositID, // depositID
        to6('500') // amt
      );
      expect(await this.siloGetters.balanceOf(userAddress, depositID)).to.eq(to6('500'));
    });

    it('transfers an ERC1155 deposit', async function () {
      // transfering the most recent deposit from user 1, to user 3
      // user 1 currently has 2000.4 stalk (1000 stalk, 1000 germinating stalk, and 0.4 grown stalk),
      season = this.seasonGetter.season()
      stem = this.silo.mockSeasonToStem(this.bean.address, season)
      depositID = await this.siloGetters.getDepositId(this.bean.address, stem)

      expect(await this.siloGetters.balanceOfStalk(userAddress)).to.eq(toStalk('1000.4'));
      expect(await this.siloGetters.balanceOfGerminatingStalk(userAddress)).to.eq(toStalk('1000'));
      expect(await this.siloGetters.balanceOfStalk(user3Address)).to.eq(to6('0'));
      expect(await this.siloGetters.balanceOfGerminatingStalk(user3Address)).to.eq(toStalk('0'));

      
      // get roots (note that germinating roots cannot be calculated until 2 gms have passed, and thus do
      // not exist/have a view function).
      expect(await this.siloGetters.balanceOfRoots(userAddress)).to.eq(toStalk('1000400000000000'));
      expect(await this.siloGetters.balanceOfRoots(user3Address)).to.eq('0');



      this.result = await this.silo.connect(user).safeTransferFrom(
        userAddress,
        user3Address,
        depositID,
        to6('1000'),
        0x00
      )

      // user 1 should have 1000.4 stalk and 0 germinating stalk.
      expect(await this.siloGetters.balanceOfStalk(userAddress)).to.eq(toStalk('1000.4'));
      expect(await this.siloGetters.balanceOfGerminatingStalk(userAddress)).to.eq(toStalk('0'));
      // user 3 should have 0 stalk and 1000 germinating stalk.
      expect(await this.siloGetters.balanceOfStalk(user3Address)).to.eq(toStalk('0'));
      expect(await this.siloGetters.balanceOfGerminatingStalk(user3Address)).to.eq(toStalk('1000'));

      // user 1 should still have 1000.4 roots.
      // user 3 should not have any roots, as the deposit has not been in the silo for 2 seasons.
      expect(await this.siloGetters.balanceOfRoots(userAddress)).to.eq(toStalk('1000400000000000'));
      expect(await this.siloGetters.balanceOfRoots(user3Address)).to.eq(toStalk('0'));

      expect(await this.siloGetters.balanceOf(userAddress, depositID)).to.eq(to6('0'));
      expect(await this.siloGetters.balanceOf(user3Address, depositID)).to.eq(to6('1000'));

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
      season = this.seasonGetter.season()
      stem0 = this.silo.mockSeasonToStem(this.bean.address, season)
      depositID0 = await this.siloGetters.getDepositId(this.bean.address, stem0)
      // user has 1000.4 grown stalk + 1000 germinating stalk.
      expect(await this.siloGetters.balanceOfStalk(userAddress)).to.eq(toStalk('1000.4'));
      expect(await this.siloGetters.balanceOfGerminatingStalk(userAddress)).to.eq(toStalk('1000'));


      await this.season.farmSunrise();

      season = this.seasonGetter.season()
      stem1 = this.silo.mockSeasonToStem(this.bean.address, season)
      depositID1 = await this.siloGetters.getDepositId(this.bean.address, stem1)

      expect(await this.siloGetters.balanceOfStalk(userAddress)).to.eq(toStalk('1000.4'));
      expect(await this.siloGetters.balanceOfGerminatingStalk(userAddress)).to.eq(toStalk('1000'));

      this.result = await this.silo.connect(user).deposit(
        this.bean.address,
        to6('1000'),
        EXTERNAL
      )

      // users stalk increased by 0.4 as they mowed from the deposit, and 
      // had 2000 stalk at the time of mowing (1000 of which is germinating).
      expect(await this.siloGetters.balanceOfStalk(userAddress)).to.eq(toStalk('1000.8'));
      expect(await this.siloGetters.balanceOfGerminatingStalk(userAddress)).to.eq(toStalk('2000'));
      expect(await this.siloGetters.balanceOfStalk(user3Address)).to.eq(toStalk('0'));

      // depositID0 has been in the silo for 1 season, and thus should have .2 additional stalk.
      // depositID1 has been in the silo for 0 seasons, and should not have any grown stalk.
      this.result = await this.silo.connect(user).safeBatchTransferFrom(
        userAddress,
        user3Address,
        [depositID0, depositID1],
        [ to6('1000'), to6('1000')],
        0x00
      )

      // after the transfer, user 1 should have 1000.6 stalk and no germinating stalk.
      // user 3 should have 0.2 stalk and 2000 germinating stalk.
      expect(await this.siloGetters.balanceOfStalk(userAddress)).to.eq(toStalk('1000.6'));
      expect(await this.siloGetters.balanceOfGerminatingStalk(userAddress)).to.eq(toStalk('0'));
      expect(await this.siloGetters.balanceOfStalk(user3Address)).to.eq(toStalk('.2'));
      expect(await this.siloGetters.balanceOfGerminatingStalk(user3Address)).to.eq(toStalk('2000'));
      
      expect(await this.siloGetters.balanceOfRoots(userAddress)).to.eq(toStalk("1000600000000000"));
      expect(await this.siloGetters.balanceOfRoots(user3Address)).to.eq(toStalk("200000000000"));


      expect(await this.siloGetters.balanceOf(userAddress, depositID0)).to.eq(to6('0'));
      expect(await this.siloGetters.balanceOf(userAddress, depositID1)).to.eq(to6('0'));
      expect(await this.siloGetters.balanceOf(user3Address, depositID0)).to.eq(to6('1000'));
      expect(await this.siloGetters.balanceOf(user3Address, depositID1)).to.eq(to6('1000'));

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
      const season = await this.seasonGetter.season()
      stem = await this.silo.mockSeasonToStem(this.bean.address, toBN(season).sub('2'))
      depositID = await this.siloGetters.getDepositId(this.bean.address, stem)
 
      let b = await this.siloGetters.balanceOfBatch(
        [userAddress,user2Address],
        [depositID,depositID]
      )
      expect(b[0]).to.eq(to6('1000'));
      expect(b[1]).to.eq(to6('1000'));

    });

    it('properly gives the correct depositID', async function () {
      season = this.seasonGetter.season()
      stem = this.silo.mockSeasonToStem(this.bean.address, season)
      depositID = await this.siloGetters.getDepositId(this.bean.address, stem)
      // first 20 bytes is the address,
      // next 12 bytes is the stem
      // since this deposit was created 1 season after the asset was whitelisted, the amt is 2
      expect(depositID).to.eq('0xbea0000029ad1c77d3d5d23ba2d8893db9d1efab0000000000000000005b8d80');
    });

    it("properly emits an event when a user approves for all", async function () {
      await expect(this.approval.connect(user).setApprovalForAll(user2Address, true))
        .to.emit(this.approval, 'ApprovalForAll')
        .withArgs(userAddress, user2Address, true);
      expect(await this.approval.isApprovedForAll(userAddress, user2Address)).to.eq(true);
    });

    it("properly gives the correct ERC-165 identifier", async function () {
      expect(await this.diamondLoupe.supportsInterface("0xd9b67a26")).to.eq(true);
      expect(await this.diamondLoupe.supportsInterface("0x0e89341c")).to.eq(true);
    });
  });

  describe("ERC1155 Metadata", async function () {
    beforeEach(async function () {
      // 2 seasons were added in before. (998 + 2 = 1000)
      await this.season.farmSunrises(998);
    })

    it('is a valid json', async function () {
      depositID1 = '0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab0000000000000000001E8480';
      const depositmetadata = await this.metadata.uri(depositID1);
      depositMetadataString = atob(depositmetadata.substring(29))
      // verify that depositMetadataString is a json:
      expect(await tryParseJSONObject(depositMetadataString) == true);
    })

    // bean token
    it('returns correct URI for bean', async function () {
      depositmetadata = await fs.readFileSync(__dirname + '/data/base64EncodedImageBean.txt', 'utf-8');
      depositID1 = '0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab0000000000000000001E8480';
      expect(await this.metadata.uri(depositID1)).to.eq(depositmetadata);
    })

    // bean3crv token
    it('returns correct URI for bean3crv', async function () {
      depositmetadata = await fs.readFileSync(__dirname + '/data/base64EncodedImageBean3Crv.txt', 'utf-8');
      depositID2 = '0xC9C32CD16BF7EFB85FF14E0C8603CC90F6F2EE4900000000000000001E848000';
      expect(await this.metadata.uri(depositID2)).to.eq(depositmetadata);
    })

    // beanEthToken
    it('returns correct URI for beanEth', async function () {
      depositmetadata = await fs.readFileSync(__dirname + '/data/base64EncodedImageBeanEth.txt', 'utf-8');
      depositID3 = '0xBEA0e11282e2bB5893bEcE110cF199501e872bAdFFFFFFFFFFFFF000001E8480';
      expect(await this.metadata.uri(depositID3)).to.eq(depositmetadata);
    })
      
    // urBean token
    it('returns correct URI for urBean', async function () {
      depositmetadata = await fs.readFileSync(__dirname + '/data/base64EncodedImageUrBean.txt', 'utf-8');
      depositID4 = '0x1BEA0050E63e05FBb5D8BA2f10cf5800B62244490000000000000000003D0900';
      expect(await this.metadata.uri(depositID4)).to.eq(depositmetadata);
    })

    // urBeanEth token
    it('returns correct URI for urBeanEth', async function () {
      depositmetadata = await fs.readFileSync(__dirname + '/data/base64EncodedImageUrBeanEth.txt', 'utf-8');
      depositID5 = '0x1BEA3CcD22F4EBd3d37d731BA31Eeca95713716DFFFFFFFFFFFFFFFFFFFFF97C';
      expect(await this.metadata.uri(depositID5)).to.eq(depositmetadata);
    });

    it('returns correct URI for urBean3Crv once dewhitelisted', async function () {
      await this.whitelist.connect(owner).dewhitelistToken(this.beanMetapool.address);

      depositmetadata = await fs.readFileSync(__dirname + '/data/base64EncodedImageBean3CrvDewhitelisted.txt', 'utf-8');
      depositID2 = '0xC9C32CD16BF7EFB85FF14E0C8603CC90F6F2EE4900000000000000001E848000';
      expect(await this.metadata.uri(depositID2)).to.eq(depositmetadata);
    })

    it('reverts if the depositID is invalid', async function () {
      depositmetadata = await fs.readFileSync(__dirname + '/data/base64EncodedImageBean.txt', 'utf-8');
      // invalid due to token
      invalidID0 = '0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efac000000000000000000000002';
      // invalid due to high stem value.
      invalidID1 = '0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab100000000000000000000002';

      await expect(this.metadata.uri(invalidID0)).to.be.revertedWith("Silo: metadata does not exist");
      await expect(this.metadata.uri(invalidID1)).to.be.revertedWith("Silo: metadata does not exist");
    })

  });


  /**
   * These sets of tests handle the germination process and the planting of beans.
   */
  describe("germination", async function () {
    
    before(async function () {
      await this.silo.connect(user3).deposit(this.bean.address, to6('1000'), EXTERNAL)
      this.result = await this.silo.connect(user4).deposit(this.bean.address, to6('1000'), EXTERNAL)
      
      // after these deposits, the state is currently: 
      // user 1: 1000 stalk, 0 germinating stalk (0.4 pending grown stalk).
      // user 2: 1000 stalk, 0 germinating stalk (0.4 pending grown stalk).
      // user 3: 0 stalk, 1000 germinating stalk.
      // user 4: 0 stalk, 1000 germinating stalk.
    });

    describe("deposits", async function () {
      it('properly updates the user balances', async function () {
        expect(await this.siloGetters.balanceOfGerminatingStalk(user3.address)).to.eq(toStalk('1000'));
        expect(await this.siloGetters.balanceOfGerminatingStalk(user4.address)).to.eq(toStalk('1000'));
      });

      it('emit events', async function () {
        expect(this.result).to.emit(this.silo, 'FarmerGerminatingStalkBalanceChanged').withArgs(
          user4.address,
          toStalk('1000')
        );
        expect(this.result).to.emit(this.silo, 'TotalGerminatingBalanceChanged')
        .withArgs(
          '3',
          BEAN, 
          to6('1000'), 
          to6('1000')
        );
      });
    });

    describe("withdraw", async function () {
      beforeEach(async function () {
        this.result = await this.silo.connect(user4).withdrawDeposit(
          this.bean.address,
          to6('6'),
          to6('1000'),
          EXTERNAL
        );
      });
      it('properly updates the user balances', async function () {
        expect(await this.siloGetters.balanceOfGerminatingStalk(user4.address)).to.eq(0);
      });

      it('emit events', async function () {
        expect(this.result).to.emit(this.silo, 'FarmerGerminatingStalkBalanceChanged').withArgs(
          user4.address,
          toStalk('-1000')
        );
        expect(this.result).to.emit(this.silo, 'TotalGerminatingBalanceChanged')
        .withArgs(
          '3',
          BEAN, 
          to6('-1000'), 
          to6('-1000')
        );
      });
    });
    
    // tests a farmers deposit that has no earned bean prior
    describe("Earned beans Germination", async function() {
      
      beforeEach(async function () {
        await this.season.siloSunrise(to6('100'))
        // after this sunrise, user 3 and 4 have currently halfway done with
        // the germination process.
        // user 1 and 2 should have 50 earned beans.
        season = await this.seasonGetter.season();
      })

      it('a single farmer germination', async function () {

        // user 1 and 2 should have 50% of the earned beans.
        expect(await this.siloGetters.balanceOfEarnedBeans(userAddress)).to.eq(50000000);
        expect(await this.siloGetters.balanceOfEarnedBeans(user2Address)).to.eq(50000000);
        expect(await this.siloGetters.balanceOfEarnedBeans(user3Address)).to.eq(0);
        expect(await this.siloGetters.balanceOfEarnedBeans(user4Address)).to.eq(0);
        
        // user 1 plants, and should have 50 beans deposited this season.
        await this.silo.connect(user).plant();
        stem = await this.silo.mockSeasonToStem(this.bean.address, season);
        earned_beans = await this.siloGetters.getDeposit(userAddress, this.bean.address, stem)
        expect(earned_beans[0]).to.eq(49999999);

        // user 1 should now have 0 earned beans.
        expect(await this.siloGetters.balanceOfEarnedBeans(userAddress)).to.eq(0);
        expect(await this.siloGetters.balanceOfEarnedBeans(user2Address)).to.eq(50000000);
        expect(await this.siloGetters.balanceOfEarnedBeans(user3Address)).to.eq(0);
        expect(await this.siloGetters.balanceOfEarnedBeans(user4Address)).to.eq(0);
        
        // advance to the next season.
        await this.season.farmSunrise()

        expect(await this.siloGetters.balanceOfEarnedBeans(userAddress)).to.eq(1);
        expect(await this.siloGetters.balanceOfEarnedBeans(user2Address)).to.eq(50000000);
        expect(await this.siloGetters.balanceOfEarnedBeans(user3Address)).to.eq(0);
        expect(await this.siloGetters.balanceOfEarnedBeans(user4Address)).to.eq(0);
        
        await this.silo.connect(user2).plant();
        await this.silo.connect(user3).plant();
        await this.silo.connect(user4).plant();

        season = await this.seasonGetter.season();
        stem = await this.silo.mockSeasonToStem(this.bean.address, season);
        earned_beans2 = await this.siloGetters.getDeposit(user2Address, this.bean.address, stem)
        earned_beans3 = await this.siloGetters.getDeposit(user3Address, this.bean.address, stem)
        earned_beans4 = await this.siloGetters.getDeposit(user4Address, this.bean.address, stem)
        expect(earned_beans2[0]).to.eq(50000000);
        expect(earned_beans3[0]).to.eq(0);
        expect(earned_beans4[0]).to.eq(0);

        await this.silo.connect(user).plant();
        earned_beans = await this.siloGetters.getDeposit(userAddress,this.bean.address, stem);
        expect(earned_beans[0]).to.eq(1);
        expect(await this.siloGetters.balanceOfEarnedBeans(userAddress)).to.eq(0);
        expect(await this.siloGetters.balanceOfEarnedBeans(user2Address)).to.eq(0);
        expect(await this.siloGetters.balanceOfEarnedBeans(user3Address)).to.eq(0);
        expect(await this.siloGetters.balanceOfEarnedBeans(user4Address)).to.eq(0);
      });

      it('multiple farmers germination', async function () {
        
        await this.silo.connect(user).plant();
        await this.silo.connect(user2).plant();
        await this.silo.connect(user3).plant();
        await this.silo.connect(user4).plant();
        stem = await this.silo.mockSeasonToStem(this.bean.address, season);

        earned_beans = await this.siloGetters.getDeposit(userAddress, this.bean.address, stem)
        expect(earned_beans[0]).to.eq(49999999);
        earned_beans = await this.siloGetters.getDeposit(user2Address, this.bean.address, stem)
        expect(earned_beans[0]).to.eq(50000000);
        earned_beans = await this.siloGetters.getDeposit(user3Address, this.bean.address, stem)
        expect(earned_beans[0]).to.eq(0);
        earned_beans = await this.siloGetters.getDeposit(user4Address, this.bean.address, stem)
        expect(earned_beans[0]).to.eq(0);
        
        // advance to the next season.
        // user 3 and 4 should not have any earned beans, 
        // as the germination period has just ended.
        await this.season.siloSunrise(0);
        season = await this.seasonGetter.season();
        stem = await this.silo.mockSeasonToStem(this.bean.address, season);

        await this.silo.connect(user3).plant();
        await this.silo.connect(user4).plant();
        earned_beans1 = await this.siloGetters.getDeposit(userAddress,this.bean.address,stem);
        expect(earned_beans1[0]).to.eq(0);
        earned_beans2 = await this.siloGetters.getDeposit(user2Address,this.bean.address,stem);
        expect(earned_beans2[0]).to.eq(0);
        earned_beans3 = await this.siloGetters.getDeposit(user3Address,this.bean.address,stem);
        expect(earned_beans3[0]).to.eq(0);
        earned_beans3 = await this.siloGetters.getDeposit(user4Address,this.bean.address,stem);
        expect(earned_beans3[0]).to.eq(0);
      });

      it('beans are minted midway and post germination', async function () {
        // call a sunrise with 100 beans.  
        await this.season.siloSunrise(to6('100'));
        // after this sunrise, user 3 and 4 have finished the germination process. 
        // they should not have any earned beans at this moment.
        expect(await this.siloGetters.balanceOfEarnedBeans(userAddress)).to.eq(100000000);
        expect(await this.siloGetters.balanceOfEarnedBeans(user2Address)).to.eq(100000000);
        expect(await this.siloGetters.balanceOfEarnedBeans(user3Address)).to.eq(0);
        expect(await this.siloGetters.balanceOfEarnedBeans(user4Address)).to.eq(0);

        // call a sunrise with 100 beans.
        await this.season.siloSunrise(to6('100'));

        // user 1 and 2 should have slightly higher earned beans due to previous earned beans.
        expect(await this.siloGetters.balanceOfEarnedBeans(userAddress)).to.eq(126190476);
        expect(await this.siloGetters.balanceOfEarnedBeans(user2Address)).to.eq(126190476);
        expect(await this.siloGetters.balanceOfEarnedBeans(user3Address)).to.eq(23809523);
        expect(await this.siloGetters.balanceOfEarnedBeans(user4Address)).to.eq(23809523);

        await this.silo.connect(user).plant();
        await this.silo.connect(user2).plant();
        await this.silo.connect(user3).plant();
        await this.silo.connect(user4).plant();
        season = await this.seasonGetter.season();
        stem = await this.silo.mockSeasonToStem(this.bean.address, season);
        earned_beans = await this.siloGetters.getDeposit(userAddress, this.bean.address, stem)
        earned_beans2 = await this.siloGetters.getDeposit(user2Address, this.bean.address, stem)
        earned_beans3 = await this.siloGetters.getDeposit(user3Address, this.bean.address, stem)
        earned_beans4 = await this.siloGetters.getDeposit(user4Address, this.bean.address, stem)
        expect(earned_beans[0]).to.eq(126190476);
        expect(earned_beans2[0]).to.eq(126190476);
        expect(earned_beans3[0]).to.eq(23809523);
        expect(earned_beans4[0]).to.eq(23809523);
      });

      it("beans are issued with grown stalk from germinating assets", async function () {
        // user 3 and 4 mows their grown stalk. 
        await this.silo.mow(user3Address, this.bean.address);
        await this.silo.mow(user4Address, this.bean.address);
        // user 3 and 4 should have 0 stalk and 0 germinating stalk.
        
        expect(await this.siloGetters.balanceOfStalk(user3Address)).to.eq(toStalk('0.2'));
        expect(await this.siloGetters.balanceOfStalk(user4Address)).to.eq(toStalk('0.2'));

        // call a sunrise with 100 beans.  
        await this.season.siloSunrise(to6('100'));
        
        // after this sunrise, user 3 and 4 should have 0.2 stalk worth of earned beans:
        // 0.2/2100.4 * 100 
        expect(await this.siloGetters.balanceOfEarnedBeans(user3Address)).to.eq(9521);
        expect(await this.siloGetters.balanceOfEarnedBeans(user4Address)).to.eq(9521);

        // user 1 and 2 should have slightly less than 100 beans each. 
        expect(await this.siloGetters.balanceOfEarnedBeans(userAddress)).to.eq(to6('99.990478'));
        expect(await this.siloGetters.balanceOfEarnedBeans(user2Address)).to.eq(to6('99.990478'));

      })

      it("correct earned beans values after multiple seasons elapsed", async function () {
        // verify whether the users get a correct amount of earned beans after multiple seasons elapsed.
        await this.season.siloSunrise(to6('100'));
        await this.season.siloSunrise(to6('100'));
        await this.season.farmSunrises(100);

        expect(await this.siloGetters.balanceOfEarnedBeans(userAddress)).to.eq(126190476);
        expect(await this.siloGetters.balanceOfEarnedBeans(user2Address)).to.eq(126190476);
        expect(await this.siloGetters.balanceOfEarnedBeans(user3Address)).to.eq(23809523);
        expect(await this.siloGetters.balanceOfEarnedBeans(user4Address)).to.eq(23809523);
        
        await this.silo.connect(user).plant();
        await this.silo.connect(user2).plant();
        await this.silo.connect(user3).plant();
        await this.silo.connect(user4).plant();
        season = await this.seasonGetter.season();
        stem = await this.silo.mockSeasonToStem(this.bean.address, season);
        earned_beans = await this.siloGetters.getDeposit(userAddress, this.bean.address, stem)
        earned_beans2 = await this.siloGetters.getDeposit(user2Address, this.bean.address, stem)
        earned_beans3 = await this.siloGetters.getDeposit(user3Address, this.bean.address, stem)
        earned_beans4 = await this.siloGetters.getDeposit(user4Address, this.bean.address, stem)
        expect(earned_beans[0]).to.eq(126190476);
        expect(earned_beans2[0]).to.eq(126190476);
        expect(earned_beans3[0]).to.eq(23809523);
        expect(earned_beans4[0]).to.eq(23809523);
      })
    })
  });
});

function tryParseJSONObject (jsonString){
  try {
      var o = JSON.parse(jsonString);
      if (o && typeof o === "object") {
          return o;
      }
  }
  catch (e) { }

  return false;
};