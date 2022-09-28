const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { to18, to6, toStalk } = require('./utils/helpers.js')
const { BEAN } = require('./utils/constants')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");

let user, user2, delegatee, owner;
let userAddress, user2Address, delegateeAddress, ownerAddress;

describe('FunctionApproval', function () {
  before(async function () {
    [owner,user,user2, delegatee] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    delegateeAddress = delegatee.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address);
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address);
    this.delegate = await ethers.getContractAt('DelegateFacet', this.diamond.address);
    this.permit = await ethers.getContractAt('MockPermitFacet', this.diamond.address);
    this.bean = await ethers.getContractAt('Bean', BEAN);
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe('Set Function Approval', function () {
    it('properly approves delegate', async function () {
      const selector = "0x0361cea0";
      const allowance = ethers.BigNumber.from(100);
      const approval = ethers.utils.hexZeroPad(allowance.toHexString(), 32);
      await this.delegate.connect(user).approveDelegate(selector, delegateeAddress, approval);
      expect(await this.delegate.delegateAllowance(userAddress, selector, delegateeAddress)).to.eq(allowance);
    });

    it('properly approves delegate twice', async function () {
      const selector = "0x0361cea0";
      const allowance1 = ethers.BigNumber.from(100);
      const approval1 = ethers.utils.hexZeroPad(allowance1.toHexString(), 32);
      await this.delegate.connect(user).approveDelegate(selector, delegateeAddress, approval1);
      const allowance2 = ethers.BigNumber.from(1000);
      const approval2 = ethers.utils.hexZeroPad(allowance2.toHexString(), 32);
      await this.delegate.connect(user).approveDelegate(selector, delegateeAddress, approval2);
      expect(await this.delegate.delegateAllowance(userAddress, selector, delegateeAddress)).to.eq(allowance2);
    });
  });

  describe('Spend Allowance', function () {
  });
});
