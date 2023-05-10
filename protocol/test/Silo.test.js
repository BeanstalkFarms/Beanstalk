const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { to18, to6, toStalk } = require('./utils/helpers.js')
const { BEAN, BEANSTALK, BCM, BEAN_3_CURVE, UNRIPE_BEAN, UNRIPE_LP } = require('./utils/constants')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { time, mineUpTo, mine } = require("@nomicfoundation/hardhat-network-helpers");

let user,user2,owner;
let userAddress, ownerAddress, user2Address;

describe('Silo', function () {
  before(async function () {

    [owner,user,user2] = await ethers.getSigners();
    [owner,user,user2,user3,user4] = await ethers.getSigners();
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



    this.bean = await ethers.getContractAt('Bean', BEAN);
    await this.season.lightSunrise();
    await this.bean.connect(user).approve(this.silo.address, '100000000000');
    await this.bean.connect(user2).approve(this.silo.address, '100000000000'); 
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
      this.result = await this.silo.connect(user).plant(this.bean.address)
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
      await this.silo.connect(user2).plant(this.bean.address)
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
      season = this.season.season()
      stem = this.silo.seasonToStem(this.bean.address, season)
      depositID = '0xBEA0000029AD1C77D3D5D23BA2D8893DB9D1EFAB000000000000000000000002';
      console.log("symbol is:", await this.bean.symbol());
      expect(await this.metadata.uri(depositID,userAddress)).to.eq("data:application/json;base64,eyJuYW1lIjogIkJlYW5zdGFsayBEZXBvc2l0IiwgImRlc2NyaXB0aW9uIjogIkEgQmVhbnN0YWxrIERlcG9zaXQiLCAiaW1hZ2UiOiAiZGF0YTppbWFnZS9zdmcreG1sO2Jhc2U2NCxQSE4yWnlCamJHRnpjejBpYzNablFtOWtlU0lnZDJsa2RHZzlJakkxTlNJZ2FHVnBaMmgwUFNJek5UQWlJSFpwWlhkQ2IzZzlJakFnTUNBeU5UVWdNelV3SWlCNGJXeHVjejBpYUhSMGNEb3ZMM2QzZHk1M015NXZjbWN2TWpBd01DOXpkbWNpSUhodGJHNXpPbmhzYVc1clBTSm9kSFJ3T2k4dmQzZDNMbmN6TG05eVp5OHhPVGs1TDNoc2FXNXJJajQ4WkdWbWN6NDhaeUJwWkQwaWNHeHZkQ0krUEhCaGRHZ2daRDBpVFRjNUxqVTNNamdnTVRJNUxqSTJOVXd4TWpjdU5EWTVJREUxTmk0NE16Tk1NVGMxTGpRME15QXhNamt1TWpRMVRERXlOeTQwTmprZ01UQXhMalk1TjB3M09TNDFOekk0SURFeU9TNHlOalZhSWlCbWFXeHNQU0lqT1RRMFFUSTNJaTgrUEhCaGRHZ2daRDBpVFRjNUxqVXpNeklnTVRNekxqUXlOa3czT1M0MU56STNJREV5T1M0eU5qVk1NVEkzTGpRMk9TQXhOVFl1T0RNelRERXlOeTQxTURjZ01UWXdMamt3T0V3M09TNDFNek15SURFek15NDBNalphSWlCbWFXeHNQU0lqTnpVek9URkdJaTgrUEhCaGRHZ2daRDBpVFRFM05TNDBOamNnTVRNekxqUk1NVGMxTGpRME15QXhNamt1TWpRMVRERXlOeTQwTmprZ01UVTJMamd6TTB3eE1qY3VOVEEzSURFMk1DNDVNRGhNTVRjMUxqUTJOeUF4TXpNdU5Gb2lJR1pwYkd3OUlpTTJOek16TVVVaUx6NDhMMmMrUEdjZ2FXUTlJbVoxYkd4TVpXRm1VR3h2ZENJK1BIVnpaU0I0YkdsdWF6cG9jbVZtUFNJamNHeHZkQ0lnZUQwaU1DSWdlVDBpTUNJZ0x6NDhkWE5sSUhoc2FXNXJPbWh5WldZOUlpTnNaV0ZtVW05M0lpQjRQU0l3SWlCNVBTSXdJaUJtYVd4c1BTSWpNak00TWpVMElpQXZQangxYzJVZ2VHeHBibXM2YUhKbFpqMGlJMnhsWVdaU2IzY2lJSGc5SWkweE1pSWdlVDBpTnlJZ1ptbHNiRDBpSXpnNVFUWXlSaUlnTHo0OGRYTmxJSGhzYVc1ck9taHlaV1k5SWlOc1pXRm1VbTkzSWlCNFBTSXRNalFpSUhrOUlqRTBJaUJtYVd4c1BTSWpNak00TWpVMElpQXZQangxYzJVZ2VHeHBibXM2YUhKbFpqMGlJMnhsWVdaU2IzY2lJSGc5SWkwek5pSWdlVDBpTWpFaUlHWnBiR3c5SWlNNE9VRTJNa1lpSUM4K1BDOW5QanhuSUdsa1BTSmxiWEIwZVZCc2IzUWlQangxYzJVZ2VHeHBibXM2YUhKbFpqMGlJM0JzYjNRaUlIZzlJakFpSUhrOUlqQWlJQzgrUEM5blBqeG5JR2xrUFNKd1lYSjBhV0ZzVEdWaFpsQnNiM1FpUGp4MWMyVWdlR3hwYm1zNmFISmxaajBpSTNCc2IzUWlJSGc5SWpBaUlIazlJakFpSUM4K1BIVnpaU0I0YkdsdWF6cG9jbVZtUFNJamJHVmhabEp2ZHlJZ2VEMGlNQ0lnZVQwaU1DSWdabWxzYkQwaUl6SXpPREkxTkNJZ0x6NDhkWE5sSUhoc2FXNXJPbWh5WldZOUlpTnNaV0ZtVW05M0lpQjRQU0l0TVRJaUlIazlJamNpSUdacGJHdzlJaU00T1VFMk1rWWlJQzgrUEM5blBqeG5JR2xrUFNKaVlYSWlQanh5WldOMElIZzlJak01SWlCNVBTSXlORGdpSUhkcFpIUm9QU0l4TnpjaUlHaGxhV2RvZEQwaU1UY2lJSEo0UFNJMUlpQm1hV3hzUFNJak9FSTVNemhESWlCbWFXeHNMVzl3WVdOcGRIazlJakF1TVNJdlBqd3ZaejQ4WnlCcFpEMGliR1ZoWmlJK1BIQmhkR2dnWkQwaVRURTNNUzQ0T0RRZ01URTRMams0TTJFMExqa3pNaUEwTGprek1pQXdJREFnTVMweExqQXhPQ0F5TGpZd05pQTBMamN4TlNBMExqY3hOU0F3SURBZ01TMHhMamczT0NBeExqUXpPV010TGpRMk5TNHhPVFV0TVM0M016VXVOekkzTFRJdU16WTBMakUzTmkwdU1qUTJJRE11TWprNExURXVOVGt6SURZdU5URXlMVEl1TWpVeklEY3VPVFUwWVRRdU5UTXlJRFF1TlRNeUlEQWdNQ0F4TFM0ek1UTXRMamt6TTJNdExqSXhNUzB1T1RjMUxTNHdNemd0TVM0M05qTXVNRGM0TFRJdU1qazFMakl3TWkwdU9USXhMak0xTXkweExqWXhNaTQwTmpjdE1pNHhOQzB4TGpFM055NDJPVFF0TWk0Mk5ESXVOVFk1TFRNdU5UVTRMUzR5TnpJdExqYzVOaTB1TnpNeUxURXVNRGd6TFRFdU9USXhMUzQzTkRNdE15NHdNelF1TkRrNExqQXhNU0F4TGprek9TNHhNRGtnTXk0eU5EY2dNUzR4TmpkaE5TNHhNeUExTGpFeklEQWdNQ0F4SURFdU1qRWdNUzQwTVROakxqRTFPUzB1TnpRdU1UazVMUzQ1TlRndU1qTTRMVEV1TVRjNUxqSXdPUzB4TGpJeE15NHpNakl0TVM0NE56SXVNamMwTFRJdU56STBZVGN1TnpNZ055NDNNeUF3SURBZ01DMHVPVEE0TFRNdU1UYzNZeTB1TnpjeUxqUXhOUzB4TGpjNE9TNHhPVFl0TWk0ek56Z3RMak13TkMwdU16TTVMUzR5T0RjdExqVTFOaTB1TmpneUxTNDNOalF0TVM0Mk9USmhNVEl1TnpNNUlERXlMamN6T1NBd0lEQWdNUzB1TVRjMkxUTXVPVEE1WXk0M09Ea3VOakF6SURFdU5EY2dNUzR3TVRrZ01TNDVNemNnTVM0eU9ETXVPVFEwTGpVek5pQXhMak0wTkM0Mk16a2dNUzQzTmpFZ01TNHhOamN1TVRVeUxqRTVNeTQyTkRrdU9EUXlMalU0TmlBeExqYzFNUzB1TURFeExqRTNNaTB1TURVekxqYzVOUzB1TkRZMElERXVNamt6WVRZdU9ETWdOaTQ0TXlBd0lEQWdNU0F4TGpNNE5DQXlMakl5TjJNdU1UUXVNelk0TGpJME1pNDNORFF1TXpFeElERXVNVFV1TVRBM0xTNHlNRGN1TWpZeExTNDBNemt1TlRFeExTNDNNakl1TkRVekxTNDFNVE11T0RjdExqazVNaUF4TGpZd05DMHhMakk0TkM0Mk9ETXRMakkzTWlBeExqSTRMUzR5TkRrZ01TNDNNak10TGpJek5HRTFMak13TWlBMUxqTXdNaUF3SURBZ01TQXhMalE0Tmk0eU56TmFJaTgrUEM5blBqeG5JR2xrUFNKemFXeHZJajQ4Y0dGMGFDQmtQU0pOTlRjdU1UQTRJRGN4TGpJNVl5NHhPRGd0TVRFdU5qVXpMVEV5TGpBeExUSXhMak13TXkweU55NHlORE10TWpFdU5UVXlMVEUxTGpJek5DMHVNalV0TWpjdU56TTJJRGd1T1RrMUxUSTNMamt5TXlBeU1DNDJORGt0TGpFNE55QXhNUzQyTlRRZ01USXVNREVnTWpFdU16QTBJREkzTGpJME5DQXlNUzQxTlRNZ01UVXVNak16TGpJMUlESTNMamN6TlMwNExqazVOU0F5Tnk0NU1qSXRNakF1TmpWYUlpQm1hV3hzUFNJak5qWTJJaTgrUEhCaGRHZ2daRDBpVFM0ME5qUWdNVGt1TlRRMFl5NDJPVGtnTVRZdU5UZzFJREV1TkNBek15NHhOamtnTWk0d09UZ2dORGt1TnpVeUxqQXlNU0F5TGpNNE1TNDBPQ0EwTGpJM09DNDRPRE1nTlM0MU16a3VNamMzTGpnMkxqYzBNU0F5TGpJM05TQXhMamMzT0NBekxqZzJOeTQwT1RRdU56VTVJREV1TWpFeUlERXVOeUF6TGpBd01pQXpMak16TWlBeExqY3pPU0F4TGpVNE5pQXpMak0xSURNdU1EVTJJRFV1TnpNeUlEUXVNems0SURNdU1qa3pJREV1T0RVMUlEWXVNVFV4SURJdU16azJJRGd1TnpreElESXVPRGsySURFdU9EVTFMak0xSURVdU1UUTVMamswT0NBNUxqUTRPQzQxTlRaaE16SXVOekEzSURNeUxqY3dOeUF3SURBZ01DQTVMak14TlMweUxqSTROMk14TGpnMk1pMHVOelU1SURRdU5qUXlMVEV1T1RFM0lEY3VOak16TFRRdU5DQXhMak0wT0MweExqRXlJRE11TkRRNExUSXVPRGszSURVdU1UazNMVFV1T1RWaE1qQXVNVEUwSURJd0xqRXhOQ0F3SURBZ01DQXlMakkxTFRVdU9UazRZeTR5TVMweE55NDFOVEl1TkRJdE16VXVNVEEwTGpZek1pMDFNaTQyTlRkc0xUVTJMamd1T1RVeWFDNHdNREZhSWlCbWFXeHNQU0lqUWpOQ00wSXpJaTgrUEhCaGRHZ2daRDBpVFRVM0xqUTRJREU1TGpRNE1rTTFOeTQyTkRVZ09TNHlOQ0EwTkM0NU56Z3VOekkzSURJNUxqRTROeTQwTmpnZ01UTXVNemszTGpJeExqUTJNeUE0TGpNd015NHlPVGdnTVRndU5UUTJMakV6TkNBeU9DNDNPRGdnTVRJdU9DQXpOeTR6SURJNExqVTVNU0F6Tnk0MU5tTXhOUzQzT1M0eU5UZ2dNamd1TnpJMExUY3VPRE0xSURJNExqZzRPUzB4T0M0d056aGFJaUJtYVd4c1BTSWpRME5ESWk4K1BIQmhkR2dnWkQwaVRUTXdMak14TkNBM0xqRXpOMk11TURBNUxTNDFOakV0TGpZNExURXVNREk0TFRFdU5UTTRMVEV1TURReUxTNDROVGt0TGpBeE5DMHhMalUyTWk0ME15MHhMalUzTVM0NU9URXRMakF4TGpVMk1pNDJPQ0F4TGpBeU9DQXhMalV6T0NBeExqQTBNaTQ0TlRrdU1ERTFJREV1TlRZeUxTNDBNeUF4TGpVM0xTNDVPVm9pSUdacGJHdzlJaU0yTmpZaUx6NDhjR0YwYUNCa1BTSk5OaTQwTVRRZ01qZ3VPRGxoTVRVdU56YzNJREUxTGpjM055QXdJREFnTVMweUxqQTVNeTB5TGpFME5tTXRMamcxTmkweExqQTJNeTB5TGpRMU15MHpMakE1TXkweUxqazNOUzAyTGpFeE1tRXhNUzQzTmpVZ01URXVOelkxSURBZ01DQXhMUzR3T1RNdE15NHpNRGRzTWpVdU5ETXRPUzQ1TnpaakxqQTBNeTR4TkRJdU1UZzRMalUxTlM0Mk1EUXVPRFk0TGpRMkxqTTBOaTQ1TkRjdU16UWdNUzR3T0RZdU16TTBURFl1TkRFeklESTRMamc0T0hZdU1EQXlXaUlnWm1sc2JEMGlJMFUyUlRaRk5pSXZQanh3WVhSb0lHOXdZV05wZEhrOUlpNHpNeUlnWkQwaVRURXVORGMzSURFMkxqQXlPV011TWpVdExqa3pNUzQzTURZdE1pNHlOVGdnTVM0MU55MHpMalk1TlM0Mk5UVXRNUzR3T1RJZ01TNHlPVEl0TVM0NE1qVWdNUzQzTmkweUxqTTFPQzQxT0RRdExqWTJOU0F4TGpjM05pMHhMamt6TkNBekxqWTNPUzB6TGpJNUlESXVPVFV6TFRJdU1UQTFJRFV1TmprMkxUTXVNRFVnTnk0M01qTXRNeTQzTTJFek55NHpOU0F6Tnk0ek5TQXdJREFnTVNBMkxqUTROUzB4TGpVME4ydzFMakkwTWlBMExqTXhObUV4TGpRNElERXVORGdnTUNBd0lEQXRNUzR5TVRRdU9UWTNUREV1TkRnZ01UWXVNRE5vTFM0d01ESmFJaUJtYVd4c1BTSWpPVGs1SWk4K1BIQmhkR2dnYjNCaFkybDBlVDBpTGpRMElpQmtQU0pOTVM0NE1TQXlOaTQxTXpKakxqSXdOaTQwT1RRdU5EZzBJREV1TURVdU9EWWdNUzQyTTJFeE1DNHlOallnTVRBdU1qWTJJREFnTUNBd0lESXVNamM0SURJdU5EZzJURFl1TlRVeUlEYzRMakl5WVRFM0xqSTNNaUF4Tnk0eU56SWdNQ0F3SURFdE15MDNMalF4TTB3eExqZ3hJREkyTGpVek1sb2lJR1pwYkd3OUlpTkZOa1UyUlRZaUx6NDhjR0YwYUNCa1BTSnRNek11TURreUlEUTVMalEwTVMwMkxqTTRNU0F4TlM0eU1URnpMVFl1TURjNExURXhMakUxT1NBMkxqTTRNUzB4TlM0eU1Wb2lJR1pwYkd3OUlpTTRSVGhGT0VVaUx6NDhjR0YwYUNCa1BTSnRNall1TnpJMUlEWTBMamcxT0MwdU1Ea3hMUzR4TnpWakxTNHdNall0TGpBME9TMHlMall6TkMwMExqa3lNeTB1T0RZM0xUa3VNemNnTVM0d05UY3RNaTQzTVRjZ015NDFNVGd0TkM0M01qVWdOeTR6TFRVdU9UUTJiQzR4T0RjdExqQTJNUzAyTGpVeklERTFMalUxTWxwdE5pNHlNVEl0TVRVdU1qWTRZeTB6TGpZeU1TQXhMakl4TnkwMUxqazVNU0F6TGpFMk9DMDNMakF5TWlBMUxqYzVPQzB4TGpVek9DQXpMamt3T0M0ek5UVWdPQzR4TmpZdU56ZzRJRGt1TURVMGJEWXVNak0wTFRFMExqZzFNbHBOTWpndU1Ea3pJRFl6TGpjek4ydzBMalE0TkMweE1DNDROM00zTGpNMk5TQTJMak16TnkwMExqUTROQ0F4TUM0NE4xb2lJR1pwYkd3OUlpTTRSVGhGT0VVaUx6NDhMMmMrUEdjZ2FXUTlJbXhsWVdaU2IzY2lQangxYzJVZ2VHeHBibXM2YUhKbFpqMGlJMnhsWVdZaUlIZzlJakFpSUhrOUlqQWlMejQ4ZFhObElIaHNhVzVyT21oeVpXWTlJaU5zWldGbUlpQjRQU0l0TVRJaUlIazlJaTAzSWk4K1BIVnpaU0I0YkdsdWF6cG9jbVZtUFNJamJHVmhaaUlnZUQwaUxUSTBJaUI1UFNJdE1UUWlMejQ4ZFhObElIaHNhVzVyT21oeVpXWTlJaU5zWldGbUlpQjRQU0l0TXpZaUlIazlJaTB5TVNJdlBqd3ZaejQ4TDJSbFpuTStQSEpsWTNRZ2QybGtkR2c5SWpJMU5TSWdhR1ZwWjJoMFBTSXpOVEFpSUhKNFBTSXhNQ0lnWm1sc2JEMGlJekkxTXpNeU5pSXZQangxYzJVZ2VHeHBibXM2YUhKbFpqMGlJM05wYkc4aUlIZzlJams1SWlCNVBTSTFOU0l2UGp4bklHbGtQU0poYkd4UWJHOTBJaUJqYkdsd0xYQmhkR2c5SW5WeWJDZ2pZbTl5WkdWeVRXRnpheWtpUGp4MWMyVWdlR3hwYm1zNmFISmxaajBpSTJaMWJHeE1aV0ZtVUd4dmRDSWdlRDBpTlRBaUlIazlJakk1SWlBdlBqeDFjMlVnZUd4cGJtczZhSEpsWmowaUkyWjFiR3hNWldGbVVHeHZkQ0lnZUQwaUxUVXdJaUI1UFNJeU9TSWdMejQ4ZFhObElIaHNhVzVyT21oeVpXWTlJaU5tZFd4c1RHVmhabEJzYjNRaUlIZzlJakFpSUhrOUlqVTRJaUF2UGp4MWMyVWdlR3hwYm1zNmFISmxaajBpSTJaMWJHeE1aV0ZtVUd4dmRDSWdlRDBpTFRFd01DSWdlVDBpTlRnaUlDOCtQSFZ6WlNCNGJHbHVhenBvY21WbVBTSWpablZzYkV4bFlXWlFiRzkwSWlCNFBTSXROVEFpSUhrOUlqZzNJaUF2UGp4MWMyVWdlR3hwYm1zNmFISmxaajBpSTJaMWJHeE1aV0ZtVUd4dmRDSWdlRDBpTVRBd0lpQjVQU0kxT0NJZ0x6NDhkWE5sSUhoc2FXNXJPbWh5WldZOUlpTm1kV3hzVEdWaFpsQnNiM1FpSUhnOUlqVXdJaUI1UFNJNE55SWdMejQ4ZFhObElIaHNhVzVyT21oeVpXWTlJaU5tZFd4c1RHVmhabEJzYjNRaUlIZzlJakFpSUhrOUlqRXhOaUlnTHo0OEwyYytQSEpsWTNRZ2VEMGlNekFpSUhrOUlqSXpPQ0lnZDJsa2RHZzlJakU1TlNJZ2FHVnBaMmgwUFNJNE1DSWdjbmc5SWpVaUlHWnBiR3c5SWlNd056QTNNRGNpSUc5d1lXTnBkSGs5SWpBdU5UVWlJQzgrUEhSbGVIUWdlRDBpTkRnaUlIazlJakkyTVNJZ1ptOXVkQzF6YVhwbFBTSXhNaUlnWm1sc2JEMGlWMmhwZEdVaUlHWnZiblF0Wm1GdGFXeDVQU0pHZFhSMWNtRWdVRlFzSUhOaGJuTXRjMlZ5YVdZaVBrZHliM2R1SUZOMFlXeHJQQzkwWlhoMFBqeDBaWGgwSUhnOUlqSXdOU0lnZVQwaU1qWXhJaUJtYjI1MExYTnBlbVU5SWpFMElpQm1hV3hzUFNJak16TkNNRGMwSWlCbWIyNTBMV1poYldsc2VUMGlSblYwZFhKaElGQlVMQ0J6WVc1ekxYTmxjbWxtSWlCMFpYaDBMV0Z1WTJodmNqMGlaVzVrSWo0cklEQThMM1JsZUhRK1BIUmxlSFFnZUQwaU5EZ2lJSGs5SWpJNE15SWdabTl1ZEMxemFYcGxQU0l4TWlJZ1ptbHNiRDBpVjJocGRHVWlJR1p2Ym5RdFptRnRhV3g1UFNKR2RYUjFjbUVnVUZRc0lITmhibk10YzJWeWFXWWlQbE4wWVd4clBDOTBaWGgwUGp4MFpYaDBJSGc5SWpJd05TSWdlVDBpTWpneklpQm1iMjUwTFhOcGVtVTlJakUwSWlCbWFXeHNQU0lqUVRoRE9ETkJJaUJtYjI1MExXWmhiV2xzZVQwaVJuVjBkWEpoSUZCVUxDQnpZVzV6TFhObGNtbG1JaUIwWlhoMExXRnVZMmh2Y2owaVpXNWtJajR4TURBd1BDOTBaWGgwUGp4MFpYaDBJSGc5SWpRNElpQjVQU0l6TURVaUlHWnZiblF0YzJsNlpUMGlNVElpSUdacGJHdzlJbGRvYVhSbElpQm1iMjUwTFdaaGJXbHNlVDBpUm5WMGRYSmhJRkJVTENCellXNXpMWE5sY21sbUlqNVRaV1ZrY3p3dmRHVjRkRDQ4ZEdWNGRDQjRQU0l5TURVaUlIazlJak13TlNJZ1ptOXVkQzF6YVhwbFBTSXhOQ0lnWm1sc2JEMGlkMmhwZEdVaUlHWnZiblF0Wm1GdGFXeDVQU0pHZFhSMWNtRWdVRlFzSUhOaGJuTXRjMlZ5YVdZaUlIUmxlSFF0WVc1amFHOXlQU0psYm1RaVBqSXdNREE4TDNSbGVIUStQSFJsZUhRZ2VEMGlNVEk0SWlCNVBTSTBNU0lnWm05dWRDMXphWHBsUFNJeE15SWdabWxzYkQwaVYyaHBkR1VpSUhSbGVIUXRZVzVqYUc5eVBTSnRhV1JrYkdVaUlHWnZiblF0Wm1GdGFXeDVQU0pHZFhSMWNtRWdVRlFzSUhOaGJuTXRjMlZ5YVdZaVBrUmxjRzl6YVhRZ1ZtRnNkV1U4TDNSbGVIUStQSFJsZUhRZ2VEMGlNVEk0SWlCNVBTSTJPQ0lnWm05dWRDMXphWHBsUFNJeU5TSWdabWxzYkQwaVYyaHBkR1VpSUhSbGVIUXRZVzVqYUc5eVBTSnRhV1JrYkdVaUlHWnZiblF0Wm1GdGFXeDVQU0pHZFhSMWNtRWdVRlFzSUhOaGJuTXRjMlZ5YVdZaVBqRXdNREE4TDNSbGVIUStQSFJsZUhRZ2VEMGlNVEk0SWlCNVBTSTROU0lnWm05dWRDMXphWHBsUFNJeE15SWdabWxzYkQwaVYyaHBkR1VpSUhSbGVIUXRZVzVqYUc5eVBTSnRhV1JrYkdVaUlHWnZiblF0Wm1GdGFXeDVQU0pHZFhSMWNtRWdVRlFzSUhOaGJuTXRjMlZ5YVdZaVBrSkZRVTQ4TDNSbGVIUStQQzl6ZG1jKyIsICJhdHRyaWJ1dGVzIjogeyJ0b2tlbiBhZGRyZXNzIjogIjB4YmVhMDAwMDAyOWFkMWM3N2QzZDVkMjNiYTJkODg5M2RiOWQxZWZhYiIsICJpZCI6IDg2MjIyMTM2NzY1NTc0MTczMDYwNjE0NDM1NTY1MjcyMzE0MDYwMjg3NDAyOTU5OTQ1OTA3OTQ0NTg5NTQyOTUzMjUyOTg2ODE0NDY2LCAic3RlbSI6IDIsICJ0b3RhbCBzdGFsayI6IDIsICJzZWVkcyBwZXIgQkRWIjogMn19");
    });

    // TODO: need to add with the correct interface
    it("properly gives the correct ERC-165 identifier", async function () {
      expect(await this.diamondLoupe.supportsInterface("0xd9b67a26")).to.eq(false);
    });
  });

  describe("Earned Beans issuance during vesting period", async function () {
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
  
          await this.silo.connect(user).plant(this.bean.address);
          stem = await this.silo.seasonToStem(this.bean.address, season);
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0);
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(0);
          expect(await this.silo.connect(user3).balanceOfEarnedBeans(user3Address)).to.eq(0);
          expect(await this.silo.connect(user4).balanceOfEarnedBeans(user4Address)).to.eq(0);
  
          
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 25 + 1);
  
          await this.silo.connect(user).plant(this.bean.address);
          earned_beans = await this.silo.getDeposit(userAddress,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(25e6);
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(25e6);
          expect(await this.silo.connect(user3).balanceOfEarnedBeans(user3Address)).to.eq(25e6);
          expect(await this.silo.connect(user4).balanceOfEarnedBeans(user4Address)).to.eq(25e6);
        });
  
        it('multiple farmers plants during and after vesting period', async function () {
          console.log("Current Block", await ethers.provider.getBlockNumber());
          console.log("Sunrise Block", (await this.season.getSunriseBlock()).toString());
         
          await this.silo.connect(user).plant(this.bean.address);
          await this.silo.connect(user2).plant(this.bean.address);
          await this.silo.connect(user3).plant(this.bean.address);
          await this.silo.connect(user4).plant(this.bean.address);
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
          await mineUpTo((await ethers.provider.getBlockNumber()) + 25 + 1);
          await this.silo.connect(user4).plant(this.bean.address);
          await this.silo.connect(user2).plant(this.bean.address);
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
    
         
          await this.silo.connect(user).plant(this.bean.address);
          await this.silo.connect(user2).plant(this.bean.address);
          stem = await this.silo.seasonToStem(this.bean.address, season);

  
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0);
          earned_beans = await this.silo.getDeposit(user2Address, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0);
  
          expect(await this.silo.connect(user3).balanceOfEarnedBeans(user3Address)).to.eq(0);
          expect(await this.silo.connect(user4).balanceOfEarnedBeans(user4Address)).to.eq(0);
          
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 25 + 1);
          await this.silo.connect(user4).plant(this.bean.address);
          await this.silo.connect(user3).plant(this.bean.address);
          earned_beans = await this.silo.getDeposit(user4Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(25e6);
          earned_beans = await this.silo.getDeposit(user3Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(25e6);
  
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(25e6);
          expect(await this.silo.connect(user).balanceOfEarnedBeans(userAddress)).to.eq(25e6);
  
        });

        it("Some Earned Beans Prior to plant, some earned beans after plant", async function () {
          await mineUpTo((await ethers.provider.getBlockNumber()) + 25 + 1);
          await this.silo.connect(user).plant(this.bean.address); // root increased by X, stalk increased by 2
          stem = await this.silo.seasonToStem(this.bean.address, season);
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)
  
          expect(earned_beans[0]).to.eq(25e6);
          expect(await this.silo.connect(user).balanceOfEarnedBeans(userAddress)).to.eq(0);
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(25e6);
          expect(await this.silo.connect(user3).balanceOfEarnedBeans(user3Address)).to.eq(25e6);
          expect(await this.silo.connect(user4).balanceOfEarnedBeans(user4Address)).to.eq(25e6);
  
          // call sunrise, plant again
          await time.increase(3600)
          await this.season.siloSunrise(to6('100'));
          season = await this.season.season();
          await this.season.setSunriseBlock(await ethers.provider.getBlockNumber());

          expect(await this.silo.connect(user).balanceOfEarnedBeans(userAddress)).to.eq(0); // harvested last season 
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(25e6); // not harvested yet 
          expect(await this.silo.connect(user3).balanceOfEarnedBeans(user3Address)).to.eq(25e6); // 
          expect(await this.silo.connect(user4).balanceOfEarnedBeans(user4Address)).to.eq(25e6);
        
          await this.silo.connect(user).plant(this.bean.address); // root increased by Y, stalk increased by 2
          stem = await this.silo.seasonToStem(this.bean.address, season);
          earned_beans = await this.silo.getDeposit(user2Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(0);

          await this.silo.connect(user2).plant(this.bean.address); // root increased by Y, stalk increased by 4
          earned_beans = await this.silo.getDeposit(user2Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(25e6);
  
          expect(await this.silo.connect(user).balanceOfEarnedBeans(userAddress)).to.eq(0); // harvested 25 beans from previous season
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(0); // just harvested
  
          expect(await this.silo.connect(user3).balanceOfEarnedBeans(user3Address)).to.eq(25e6);
          expect(await this.silo.connect(user4).balanceOfEarnedBeans(user4Address)).to.eq(25e6);
  

          await mineUpTo((await ethers.provider.getBlockNumber()) + 25 + 1);
          
          //  user has more as he mowed grown stalk from previous season
          expect(await this.silo.connect(user).balanceOfEarnedBeans(userAddress)).to.eq(25003658); 
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(24998780);
  
          expect(await this.silo.connect(user3).balanceOfEarnedBeans(user3Address)).to.eq(49998780);
          expect(await this.silo.connect(user4).balanceOfEarnedBeans(user4Address)).to.eq(49998780);

          await this.silo.connect(user3).plant(this.bean.address);
          await this.silo.connect(user4).plant(this.bean.address); 
  
          earned_beans = await this.silo.getDeposit(user3Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(49998780);
          earned_beans = await this.silo.getDeposit(user4Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(49998780);
  
          expect(await this.silo.connect(user).balanceOfEarnedBeans(userAddress)).to.eq(25003658); 
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(24998780);
  
        });

        it('farmer plants in vesting period, then plants again in the following season', async function () {
          await this.season.setSunriseBlock(await ethers.provider.getBlockNumber());
          season = await this.season.season();
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(userAddress)).to.eq(0);
          await this.silo.connect(user).plant(this.bean.address);

          stem = await this.silo.seasonToStem(this.bean.address, season);
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0);
            
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 25 + 1);
          expect(await this.silo.connect(userAddress).balanceOfEarnedBeans(userAddress)).to.eq(25e6);

          // sunrise again 
          await this.season.siloSunrise(to6('100'))
          season = await this.season.season();
          stem = await this.silo.seasonToStem(this.bean.address, season);

          expect(await this.silo.connect(userAddress).balanceOfEarnedBeans(userAddress)).to.eq(25e6); 
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0)
          
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 25 + 1);

          await this.silo.connect(user).plant(this.bean.address);
          expect(await this.silo.connect(userAddress).balanceOfEarnedBeans(userAddress)).to.eq(0);
          earned_beans = await this.silo.getDeposit(userAddress,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(50003658); // user gets the earned beans from the previous season + the beans from the current season
          // user gets slightly more since they mowed last season. 
        });
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
          
          await this.silo.connect(user).plant(this.bean.address);
          stem = await this.silo.seasonToStem(this.bean.address, season);
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)

          expect(earned_beans[0]).to.eq(25e6); // 50 earned beans - 25 from this season 
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(25e6);
          expect(await this.silo.connect(user3).balanceOfEarnedBeans(user2Address)).to.eq(25e6);
          expect(await this.silo.connect(user4).balanceOfEarnedBeans(user2Address)).to.eq(25e6);
  
          
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 25 + 1);
  
          await this.silo.connect(user).plant(this.bean.address);
          earned_beans = await this.silo.getDeposit(userAddress,this.bean.address,stem);

          expect(earned_beans[0]).to.eq(50e6);
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(50e6);
          expect(await this.silo.connect(user3).balanceOfEarnedBeans(user2Address)).to.eq(50e6);
          expect(await this.silo.connect(user4).balanceOfEarnedBeans(user2Address)).to.eq(50e6);
        });
  
        it('multiple farmers plants during and after vesting period', async function () {
          await this.season.setSunriseBlock(await ethers.provider.getBlockNumber());

          await this.silo.connect(user).plant(this.bean.address);
          await this.silo.connect(user3).plant(this.bean.address);
          stem = await this.silo.seasonToStem(this.bean.address, season);

  
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(25e6);
          earned_beans = await this.silo.getDeposit(user2Address, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0);
          earned_beans = await this.silo.getDeposit(user3Address, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(25e6);
          earned_beans = await this.silo.getDeposit(user4Address, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(0);
          
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 25 + 1);
          await this.silo.connect(user4).plant(this.bean.address);
          await this.silo.connect(user2).plant(this.bean.address);
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem);
          expect(earned_beans[0]).to.eq(25e6);
          earned_beans = await this.silo.getDeposit(user2Address,this.bean.address, stem);
          expect(earned_beans[0]).to.eq(50e6);
          earned_beans = await this.silo.getDeposit(user3Address,this.bean.address, stem);
          expect(earned_beans[0]).to.eq(25e6);
          earned_beans = await this.silo.getDeposit(user4Address,this.bean.address, stem);
          expect(earned_beans[0]).to.eq(50e6);
          
        });
  
        it('some farmers plants during, some farmers plant after vesting period', async function () {
          await this.season.setSunriseBlock(await ethers.provider.getBlockNumber());
    
         
          await this.silo.connect(user).plant(this.bean.address);
          await this.silo.connect(user2).plant(this.bean.address);
  
          stem = await this.silo.seasonToStem(this.bean.address, season);
          earned_beans = await this.silo.getDeposit(userAddress, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(25e6);
          earned_beans = await this.silo.getDeposit(user2Address, this.bean.address, stem)
          expect(earned_beans[0]).to.eq(25e6);
  
          expect(await this.silo.connect(user3).balanceOfEarnedBeans(user3Address)).to.eq(25e6);
          expect(await this.silo.connect(user4).balanceOfEarnedBeans(user4Address)).to.eq(25e6);
          
          // skip to after the vesting period:
          await mineUpTo((await ethers.provider.getBlockNumber()) + 25 + 1);
          await this.silo.connect(user4).plant(this.bean.address);
          await this.silo.connect(user3).plant(this.bean.address);
          earned_beans = await this.silo.getDeposit(user4Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(50e6);
          earned_beans = await this.silo.getDeposit(user3Address,this.bean.address,stem);
          expect(earned_beans[0]).to.eq(50e6);
  
          expect(await this.silo.connect(user2).balanceOfEarnedBeans(user2Address)).to.eq(25e6);
          expect(await this.silo.connect(user).balanceOfEarnedBeans(userAddress)).to.eq(25e6);
  
        });
      });
    });
  });
});
