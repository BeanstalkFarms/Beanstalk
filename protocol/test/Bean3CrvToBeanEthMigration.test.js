const { expect } = require('chai');
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot.js");
const { BEAN, FERTILIZER, USDC, BEAN_3_CURVE, THREE_CURVE, UNRIPE_BEAN, UNRIPE_LP, WETH, BEANSTALK, BEAN_ETH_WELL, BCM, STABLE_FACTORY, PUBLIUS } = require('./utils/constants.js');
const { setEthUsdcPrice, setEthUsdChainlinkPrice } = require('../utils/oracle.js');
const { to6, to18 } = require('./utils/helpers.js');
const { bipMigrateUnripeBean3CrvToBeanEth } = require('../scripts/bips.js');
const { getBeanstalk, getBeanstalkAdminControls , getWeth } = require('../utils/contracts.js');
const { impersonateBeanstalkOwner, impersonateSigner } = require('../utils/signer.js');
const { ethers } = require('hardhat');
const { upgradeWithNewFacets } = require("../scripts/diamond");
const { mintEth, mintBeans } = require('../utils/mint.js');
const { ConvertEncoder } = require('./utils/encoder.js');
const { setReserves } = require('../utils/well.js');
const { toBN } = require('../utils/helpers.js');
const { impersonateBean } = require('../scripts/impersonate.js');

let user,user2,owner;
let publius;

let underlyingBefore
let beanEthUnderlying
let snapshotId

// Skipping because this migration already occured.
describe.skip('Bean:3Crv to Bean:Eth Migration', function () {
  before(async function () {

    [user, user2] = await ethers.getSigners()

    try {
      await network.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
              jsonRpcUrl: process.env.FORKING_RPC,
              blockNumber: 18072000 //a random semi-recent block close to Grown Stalk Per Bdv pre-deployment
            },
          },
        ],
      });
    } catch(error) {
      console.log('forking error in bean3crv -> bean:eth');
      console.log(error);
      return
    }

    publius = await impersonateSigner(PUBLIUS, true)

    owner = await impersonateBeanstalkOwner()
    beanstalk= await getBeanstalk()
    this.well = await ethers.getContractAt('IWell', BEAN_ETH_WELL);
    this.weth = await getWeth();
    this.bean = await ethers.getContractAt('IBean', BEAN)
    this.beanEth = await ethers.getContractAt('IWell', BEAN_ETH_WELL)
    this.beanEthToken = await ethers.getContractAt('IERC20', BEAN_ETH_WELL)
    this.unripeLp = await ethers.getContractAt('IERC20', UNRIPE_LP)
    this.beanMetapool = await ethers.getContractAt('MockMeta3Curve', BEAN_3_CURVE)
    underlyingBefore = await beanstalk.getTotalUnderlying(UNRIPE_LP);

    await bipMigrateUnripeBean3CrvToBeanEth(true, undefined, false)

    // upgrade beanstalk with admin Facet to update stems:
    await mintEth(owner.address);
    await upgradeWithNewFacets({
      diamondAddress: BEANSTALK,
      facetNames: [
        'MockAdminFacet'
      ],
      initArgs: [],
      bip: false,
      verbose: false,
      account: owner
    });
    const beanstalkAdmin = await getBeanstalkAdminControls();
    await beanstalkAdmin.upgradeStems();

  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot()
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId)
  });

  describe.skip('Initializes migration', async function () {
    it('Changings underlying token', async function () {
      expect(await beanstalk.getUnderlyingToken(UNRIPE_LP)).to.be.equal(BEAN_ETH_WELL)
    })
  
    it('Removes underlying balance', async function () { 
      expect(await beanstalk.getTotalUnderlying(UNRIPE_LP)).to.be.equal(0)
    })
  
    it('Sends underlying balance to BCM', async function () {
      expect(await beanstalk.getExternalBalance(BCM, BEAN_3_CURVE)).to.be.equal(underlyingBefore)
    })

    describe('Interactions with Unripe fail', async function () {
      it('chop fails', async function () {
        await beanstalk.connect(publius).withdrawDeposit(UNRIPE_LP, '-56836', to6('1'), 1);
        await expect(beanstalk.connect(publius).chop(UNRIPE_LP, to6('1'), 1, 0)).to.be.revertedWith("Chop: no underlying")
      })

      it('deposit fails', async function () {
        await beanstalk.connect(publius).withdrawDeposit(UNRIPE_LP, '-56836', to6('1'), 1);
        await expect(beanstalk.connect(publius).deposit(UNRIPE_LP, to6('1'),  1)).to.be.revertedWith('Silo: No Beans under Token.')
      })

      it('enrootDeposit fails', async function () {
        await expect(beanstalk.connect(publius).enrootDeposit(UNRIPE_LP, '-56836', to6('1'))).to.be.revertedWith('SafeMath: subtraction overflow');
      })

      it('enrootDeposits fails', async function () {
        await expect(beanstalk.connect(publius).enrootDeposits(UNRIPE_LP, ['-56836'], [to6('1')])).to.be.revertedWith('SafeMath: subtraction overflow');
      })

      it('convert Unripe Bean to LP fails', async function () {
        await expect(beanstalk.connect(publius).convert(ConvertEncoder.convertUnripeBeansToLP(to6('200'), '0'), ['-16272000000'], [to6('200')])).to.be.revertedWith('SafeMath: division by zero');
      })

      it('convert Unripe LP to Bean fails', async function () {
        const liquidityRemover = await impersonateSigner('0x7eaE23DD0f0d8289d38653BCE11b92F7807eFB64', true);
        await this.well.connect(liquidityRemover).removeLiquidityOneToken(to18('29'), WETH, '0', liquidityRemover.address, ethers.constants.MaxUint256)
        await expect(beanstalk.connect(publius).convert(ConvertEncoder.convertUnripeLPToBeans(to6('200'), '0'), ['-56836000000'], [to6('200')])).to.be.revertedWith('SafeMath: division by zero');
      })
    })
  })

  describe('Completes Migration', async function () {
    beforeEach(async function () {
      const balance = await this.beanMetapool.balanceOf(owner.address)
      await this.beanMetapool.connect(owner).approve(BEANSTALK, balance)
      await beanstalk.connect(owner).removeLiquidity(
        BEAN_3_CURVE,
        STABLE_FACTORY,
        balance,
        ['0', '0'],
        '0',
        '0'
      )
      const balances = await this.beanEth.getReserves();
      const beans = await bean.balanceOf(owner.address)
      const weth = beans.mul(balances[1]).div(balances[0])
      await this.weth.connect(owner).deposit({value: weth})

      await this.weth.connect(owner).approve(BEAN_ETH_WELL, weth)
      await bean.connect(owner).approve(BEAN_ETH_WELL, beans)

      await this.beanEth.connect(owner).addLiquidity(
        [beans, weth],
        0,
        owner.address,
        ethers.constants.MaxUint256
      );
      beanEthUnderlying = await this.beanEthToken.balanceOf(owner.address)
      await this.beanEthToken.connect(owner).approve(BEANSTALK, beanEthUnderlying)
      await beanstalk.connect(owner).addMigratedUnderlying(UNRIPE_LP, beanEthUnderlying);
    })

    it("successfully adds underlying", async function () {
      expect(await beanstalk.getTotalUnderlying(UNRIPE_LP)).to.be.equal(beanEthUnderlying)
      expect(await beanstalk.getUnderlying(UNRIPE_LP, await this.unripeLp.totalSupply())).to.be.equal(beanEthUnderlying)
    })

    describe('Interactions with Unripe succeed', async function () {
      it('chop succeeds', async function () {
        await beanstalk.connect(publius).withdrawDeposit(UNRIPE_LP, '-56836', to6('1'), 1);
        await beanstalk.connect(publius).chop(UNRIPE_LP, to6('1'), 1, 0);
      })

      it('deposit succeeds', async function () {
        await beanstalk.connect(publius).withdrawDeposit(UNRIPE_LP, '-56836', to6('1'), 1);
        await beanstalk.connect(publius).deposit(UNRIPE_LP, to6('1'),  1);
      })

      it('enrootDeposit succeeds', async function () {
        await beanstalk.connect(publius).enrootDeposit(UNRIPE_LP, '-56836', to6('1'));
      })

      it('enrootDeposits succeeds', async function () {
        await beanstalk.connect(publius).enrootDeposits(UNRIPE_LP, ['-56836'], [to6('1')]);
      })

      it('convert Unripe Bean to LP succeeds', async function () {
        await beanstalk.connect(publius).convert(ConvertEncoder.convertUnripeBeansToLP(to6('200'), '0'), ['-16272000000'], [to6('200')]);
      })

      it('convert Unripe LP to Bean succeeds', async function () {
        await impersonateBean()
        await bean.mint(user.address, to6('100000'))
        await bean.connect(user).approve(BEAN_ETH_WELL, to6('100000'))
        await this.beanEth.connect(user).addLiquidity([to6('100000'), '0'], '0', user.address, ethers.constants.MaxUint256);
        await beanstalk.connect(publius).convert(ConvertEncoder.convertUnripeLPToBeans(to6('200'), '0'), ['-56836000000'], [to6('200')])
      })
    })
  })
})