const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { expect, use } = require("chai");
const { waffleChai } = require("@ethereum-waffle/chai");
use(waffleChai);
const { deploy } = require('../scripts/deploy.js')
const { BEAN, ZERO_ADDRESS } = require('./utils/constants')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");

let snapshotId;

describe('Ownership', function () {
  let contracts
  let provider
  before(async function () {
    contracts = await deploy("Test", false, true);
    [owner, user, user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    provider = ethers.getDefaultProvider();

    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond
    this.pause = await ethers.getContractAt('PauseFacet', this.diamond.address);
    this.ownership = await ethers.getContractAt('OwnershipFacet', this.diamond.address);
    this.whitelist = await ethers.getContractAt('WhitelistFacet', this.diamond.address);
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address);
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address);
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

  describe('ownership', async function () {
    describe('transfer', async function () {
      it('reverts if not owner', async function () {
        await expect(this.ownership.connect(user2).transferOwnership(user2Address)).to.be.revertedWith('LibDiamond: Must be contract owner')
      })

      it('transfers owner', async function () {
        this.result = await this.ownership.connect(owner).transferOwnership(user2Address)
        expect(await this.ownership.ownerCandidate()).to.be.equal(user2Address)
        expect(await this.ownership.owner()).to.be.equal(ownerAddress)
      })
    })

    describe('claim', async function () {
      it('reverts if not candidate', async function () {
        await expect(this.ownership.connect(user2).claimOwnership()).to.be.revertedWith('Ownership: Not candidate')
      })

      it('claims ownership', async function () {
        await this.ownership.connect(owner).transferOwnership(user2Address)
        this.result = this.ownership.connect(user2).claimOwnership()

        expect(await this.ownership.ownerCandidate()).to.be.equal(ZERO_ADDRESS)
        expect(await this.ownership.owner()).to.be.equal(user2Address)
        await expect(this.result).to.emit(this.ownership, 'OwnershipTransferred').withArgs(ownerAddress, user2Address)
      })
    })
  })

  describe('pause', async function () {
    it('reverts if not owner', async function () {
      await expect(this.pause.connect(user2).pause()).to.be.revertedWith('LibDiamond: Must be contract or owner')
    })

    it('reverts if paused', async function () {
      this.result = await this.pause.connect(owner).pause()
      await expect(this.pause.connect(owner).pause()).to.be.revertedWith('Pause: already paused.')
    })


    it('pauses', async function () {
      this.result = await this.pause.connect(owner).pause()
      expect(await this.season.paused()).to.equal(true)
      await expect(this.result).to.emit(this.pause, 'Pause')
    })
  })

  describe('unpause', async function () {
    it('reverts if not owner', async function () {
      await expect(this.pause.connect(user2).unpause()).to.be.revertedWith('LibDiamond: Must be contract or owner')
    })

    it('reverts if not paused', async function () {
      await expect(this.pause.connect(owner).unpause()).to.be.revertedWith('Pause: not paused.');
    })

    it('unpauses', async function () {
      await this.pause.connect(owner).pause()
      this.result = await this.pause.connect(owner).unpause()
      expect(await this.season.paused()).to.equal(false)
      await expect(this.result).to.emit(this.pause, 'Unpause')
    })
  })
})