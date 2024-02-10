const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js');
const { readPrune, toBN, signSiloDepositTokenPermit, signSiloDepositTokensPermit } = require('../utils/index.js');
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { BEAN, THREE_POOL, BEAN_3_CURVE, UNRIPE_LP, UNRIPE_BEAN, THREE_CURVE } = require('./utils/constants.js');
const { to18, to6, toStalk, toBean } = require('./utils/helpers.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot.js");
const { time, mineUpTo, mine } = require("@nomicfoundation/hardhat-network-helpers");
const { deployMockWellWithMockPump, deployMockWell } = require('../utils/well.js');
const ZERO_BYTES = ethers.utils.formatBytes32String('0x0')

let user,user2,owner;
let userAddress, ownerAddress, user2Address;

let pru;

function pruneToStalk(value) {
  return prune(value).mul(toBN('10000'))
}

function prune(value) {
  return toBN(value).mul(toBN(pru)).div(to18('1'))
}

describe('Whitelist', function () {
  before(async function () {
    pru = await readPrune();
    [owner,user,user2,flashLoanExploiter] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    flashLoanExploiterAddress = flashLoanExploiter.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address);
    this.whitelist = await ethers.getContractAt('MockWhitelistFacet', this.diamond.address)
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
    this.gaugePoint = await ethers.getContractAt('GaugePointFacet', this.diamond.address)
    this.liquidityWeight = await ethers.getContractAt('LiquidityWeightFacet', this.diamond.address)
    this.seasonGetters = await ethers.getContractAt('SeasonGettersFacet', this.diamond.address)
    this.siloGetters = await ethers.getContractAt('SiloGettersFacet', this.diamond.address)
    this.bdv = await ethers.getContractAt('BDVFacet', this.diamond.address);


    [this.well, this.wellFunction, this.pump] = await deployMockWellWithMockPump()

    const SiloToken = await ethers.getContractFactory("MockToken");
    this.siloToken = await SiloToken.deploy("Silo", "SILO")
    await this.siloToken.deployed()
  })


  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe('whitelist', async function () {
    it('reverts if not owner', async function () {
      await expect(this.whitelist.connect(user2).whitelistToken(
        this.well.address, 
        this.bdv.interface.getSighash('wellBdv'), 
        '10000',
        '1',
        this.gaugePoint.interface.getSighash("defaultGaugePointFunction(uint256,uint256,uint256)"),
        this.liquidityWeight.interface.getSighash("maxWeight()"),
        '0',
        '0')).to.be.revertedWith('LibDiamond: Must be contract or owner')
    })


    it('whitelists token', async function () {
      this.result = this.whitelist.connect(owner).whitelistTokenWithEncodeType(
        this.well.address,
        this.bdv.interface.getSighash('wellBdv'),
        '10000',
        '1',
        1,
        this.gaugePoint.interface.getSighash("defaultGaugePointFunction(uint256,uint256,uint256)"),
        this.liquidityWeight.interface.getSighash("maxWeight()"),
        '0',
        '0')
      const settings = await this.siloGetters.tokenSettings(this.well.address)

      expect(settings[0]).to.equal(this.bdv.interface.getSighash('wellBdv'))

      expect(settings[1]).to.equal(1)

      expect(settings[2]).to.equal(10000)
      await expect(this.result).to.emit(this.whitelist, 'WhitelistToken').withArgs(
        this.well.address, 
        this.bdv.interface.getSighash('wellBdv'), 
        1,
        10000,
        this.gaugePoint.interface.getSighash("defaultGaugePointFunction(uint256,uint256,uint256)"),
        this.liquidityWeight.interface.getSighash("maxWeight()"),
        '0',
        '0')
    })

    it('reverts on whitelisting same token again', async function () {
      this.resultFirst = await this.whitelist.connect(owner).whitelistTokenWithEncodeType(
        this.well.address, 
        this.bdv.interface.getSighash('wellBdv'), 
        '10000',
        '1',
        1,
        this.gaugePoint.interface.getSighash("defaultGaugePointFunction(uint256,uint256,uint256)"),
        this.liquidityWeight.interface.getSighash("maxWeight()"),
        '0',
        '0')
      
      await expect(this.whitelist.connect(owner).whitelistTokenWithEncodeType(
          this.well.address, 
          this.bdv.interface.getSighash('wellBdv'), 
          '10000',
          '1',
          1,
          this.gaugePoint.interface.getSighash("defaultGaugePointFunction(uint256,uint256,uint256)"),
          this.liquidityWeight.interface.getSighash("maxWeight()"),
          '0',
          '0')).to.be.revertedWith("Whitelist: Token already whitelisted");
    })

    it('reverts on updating stalk per bdv per season for token that is not whitelisted', async function () {
      await expect(this.whitelist.connect(owner).updateStalkPerBdvPerSeasonForToken(this.well.address, 1)).to.be.revertedWith("Token not whitelisted");
    });

    it('reverts on whitelisting token with bad selector', async function () {
      await expect(this.whitelist.connect(owner).whitelistToken(
        this.well.address,
        this.bdv.interface.getSighash('wellBdv'),
        '10000',
        '1',
        this.gaugePoint.interface.getSighash("defaultGaugePointFunction(uint256,uint256,uint256)"),
        this.liquidityWeight.interface.getSighash("maxWeight()"),
        '0',
        '0'
      )).to.be.revertedWith("Whitelist: Invalid BDV selector");

      await expect(this.whitelist.connect(owner).whitelistTokenWithEncodeType(
        this.well.address,
        this.bdv.interface.getSighash('wellBdv'), 
        '10000',
        '1',
        1,
        '0x00000000',
        this.liquidityWeight.interface.getSighash("maxWeight()"),
        '0',
        '0'
      )).to.be.revertedWith("Whitelist: Invalid GaugePoint selector");

      await expect(this.whitelist.connect(owner).whitelistTokenWithEncodeType(
        this.well.address,
        this.bdv.interface.getSighash('wellBdv'), 
        '10000',
        '1',
        1,
        this.gaugePoint.interface.getSighash("defaultGaugePointFunction(uint256,uint256,uint256)"),
        '0x00000000',
        '0',
        '0'
      )).to.be.revertedWith("Whitelist: Invalid LiquidityWeight selector");
    });

    it('reverts on updating stalk per bdv per season for token that is not whitelisted', async function () {
      await expect(this.whitelist.connect(owner).updateStalkPerBdvPerSeasonForToken(this.well.address, 1)).to.be.revertedWith("Token not whitelisted");
    });
  })

  describe('update stalk per bdv per season for token', async function () {
    it('reverts if not owner', async function () {
      await expect(this.whitelist.connect(user2).updateStalkPerBdvPerSeasonForToken(this.well.address, 1)).to.be.revertedWith('LibDiamond: Must be contract or owner')
    })

    it('updates stalk per bdv per season', async function () {
      //do initial whitelist so there's something to update
      this.whitelist.connect(owner).whitelistTokenWithEncodeType(
        this.well.address, 
        this.bdv.interface.getSighash('wellBdv'),
        '10000',
        '1',
        1,
        this.gaugePoint.interface.getSighash("defaultGaugePointFunction(uint256,uint256,uint256)"),
        this.liquidityWeight.interface.getSighash("maxWeight()"),
        '0',
        '0')
      this.result = this.whitelist.connect(owner).updateStalkPerBdvPerSeasonForToken(
        this.well.address, 
        '50000'
      )
      const settings = await this.siloGetters.tokenSettings(this.well.address)

      expect(settings[1]).to.equal(50000)
      const currentSeason = await this.seasonGetters.season()
      await expect(this.result).to.emit(this.whitelist, 'UpdatedStalkPerBdvPerSeason').withArgs(this.well.address, 50000, currentSeason)
    })

    it('reverts if wrong encode type', async function () {
      await expect(this.whitelist.connect(owner).whitelistTokenWithEncodeType(
        this.well.address,
        this.bdv.interface.getSighash('wellBdv'),
        1,
        1,
        2,
        this.gaugePoint.interface.getSighash("defaultGaugePointFunction(uint256,uint256,uint256)"),
        this.liquidityWeight.interface.getSighash("maxWeight()"),
        '0',
        '0'
      )).to.revertedWith('Silo: Invalid encodeType');
    });

    it('cannot whitelist with 0 seeds (sets to 1)', async function () {
      this.whitelist.connect(owner).whitelistTokenWithEncodeType(
        this.well.address, 
        this.bdv.interface.getSighash('wellBdv'),
        '10000',
        '0',
        1,
        this.gaugePoint.interface.getSighash("defaultGaugePointFunction(uint256,uint256,uint256)"),
        this.liquidityWeight.interface.getSighash("maxWeight()"),
        '0',
        '0')
      const settings = await this.siloGetters.tokenSettings(this.well.address)

      expect(settings[1]).to.equal(1)
    });
  })

  describe('dewhitelist', async function () {
    it('reverts if not owner', async function () {
      await expect(this.whitelist.connect(user2).dewhitelistToken(this.well.address)).to.be.revertedWith('LibDiamond: Must be contract or owner')
    })

    it('dewhitelists token', async function () {
      await this.silo.mockWhitelistToken(
        BEAN_3_CURVE,
        this.bdv.interface.getSighash('curveToBDV'),
        10000,
        to6('1')
      );
      this.result = await this.whitelist.connect(owner).dewhitelistToken(BEAN_3_CURVE)
      const settings = await this.siloGetters.tokenSettings(BEAN_3_CURVE)
      // milestone season, stem, or stalkIssuedPerBDV should not be cleared.
      expect(settings[0]).to.equal('0x00000000')
      expect(settings[1]).to.equal(1)
      expect(settings[2]).to.equal(10000)
      expect(settings[3]).to.equal(1)
      expect(settings[4]).to.equal(0)
      expect(settings[5]).to.equal('0x00')
      expect(settings[6]).to.equal(-999999)
      expect(settings[7]).to.equal('0x00000000')
      expect(settings[8]).to.equal('0x00000000')
      expect(settings[9]).to.equal(0)
      expect(settings[10]).to.equal(0)
      
      await expect(this.result).to.emit(this.whitelist, 'DewhitelistToken').withArgs(BEAN_3_CURVE)
    })
  })
});