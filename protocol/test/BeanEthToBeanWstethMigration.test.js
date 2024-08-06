const { expect } = require('chai');
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot.js");
const { BEAN, UNRIPE_LP, BEAN_ETH_WELL, BCM, PUBLIUS, WSTETH, BEAN_WSTETH_WELL } = require('./utils/constants.js');
const { to6, to18 } = require('./utils/helpers.js');
const { bipMigrateUnripeBeanEthToBeanSteth, bipSeedGauge } = require('../scripts/bips.js');
const { getBeanstalk, getBeanstalkAdminControls, getWeth } = require('../utils/contracts.js');
const { impersonateBeanstalkOwner, impersonateSigner } = require('../utils/signer.js');
const { ethers } = require('hardhat');
const { ConvertEncoder } = require('./utils/encoder.js');
const { getWellContractAt } = require('../utils/well.js');
const { impersonateBean, impersonateWsteth } = require('../scripts/impersonate.js');
const { testIfRpcSet } = require('./utils/test.js');
const { deployBasinV1_1Upgrade } = require('../scripts/basinV1_1.js');
const { addAdminControls } = require('../utils/admin.js');
const { finishWstethMigration} = require('../scripts/beanWstethMigration.js');

let user,user2,owner;
let publius;

let underlyingBefore
let beanEthUnderlying
let snapshotId

async function fastForwardHour() {
  const lastTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
  const hourTimestamp = parseInt(lastTimestamp/3600 + 1) * 3600
  await network.provider.send("evm_setNextBlockTimestamp", [hourTimestamp])
}

testIfRpcSet('Bean:Eth to Bean:Wsteth Migration', function () {
  before(async function () {

    [user, user2] = await ethers.getSigners()

    try {
      await network.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
              jsonRpcUrl: process.env.FORKING_RPC,
              blockNumber: 20319000
            },
          },
        ],
      });
    } catch(error) {
      console.log('forking error in bean:eth -> bean:wsteth');
      console.log(error);
      return
    }

    await impersonateBean()
    this.wsteth = await ethers.getContractAt('MockWsteth', WSTETH);
    const stethPerToken = await this.wsteth.stEthPerToken();
    await impersonateWsteth()
    await this.wsteth.setStEthPerToken(stethPerToken)

    let c = {
      wellImplementation: await getWellContractAt('Well', '0xBA510e11eEb387fad877812108a3406CA3f43a4B'),
      aquifer: await getWellContractAt('Aquifer', '0xBA51AAAA95aeEFc1292515b36D86C51dC7877773')
    }

    c = await deployBasinV1_1Upgrade(c, true, undefined, false, false, mockPump=true)


    await addAdminControls();

    publius = await impersonateSigner(PUBLIUS, true)

    owner = await impersonateBeanstalkOwner()
    this.beanstalk = await getBeanstalk()
    this.well = await ethers.getContractAt('IWell', BEAN_WSTETH_WELL)
    this.bean = await ethers.getContractAt('IBean', BEAN)
    this.beanEth = await ethers.getContractAt('IWell', BEAN_ETH_WELL)
    this.beanEthToken = await ethers.getContractAt('IERC20', BEAN_ETH_WELL)
    this.unripeLp = await ethers.getContractAt('IERC20', UNRIPE_LP)
    underlyingBefore = await this.beanstalk.getTotalUnderlying(UNRIPE_LP);

    this.beanWsteth = await ethers.getContractAt('IWell', BEAN_WSTETH_WELL)

    const pumps = await c.well.pumps();

    await bipMigrateUnripeBeanEthToBeanSteth(true, undefined, false)

    const reserves = await this.beanWsteth.getReserves();
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot()
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId)
  });

  describe('Initializes migration', async function () {

    describe("Bean Eth minting", async function () {
      it('resets well oracle snapshot', async function () {
        expect(await this.beanstalk.wellOracleSnapshot(BEAN_ETH_WELL)).to.be.equal('0x')
      })

      it('doesn\'t start the oracle next season well oracle snapshot', async function () {
        await fastForwardHour();
        await this.beanstalk.sunrise();
        expect(await this.beanstalk.wellOracleSnapshot(BEAN_ETH_WELL)).to.be.equal('0x')
      })

      it('doesn\'t start the oracle after 24 season well oracle snapshot', async function () {
        for (let i = 0; i < 23; i++) {
          await fastForwardHour();
          await this.beanstalk.sunrise();
        }
        expect(await this.beanstalk.wellOracleSnapshot(BEAN_ETH_WELL)).to.be.equal('0x')
      })

      it('starts the oracle after 24 season well oracle snapshot', async function () {
        for (let i = 0; i < 24; i++) {
          await fastForwardHour();
          await this.beanstalk.sunrise();
        }
        expect(await this.beanstalk.wellOracleSnapshot(BEAN_ETH_WELL)).to.be.not.equal('0x')
      })

    })

    it('Changings underlying token', async function () {
      expect(await this.beanstalk.getBarnRaiseToken()).to.be.equal(WSTETH)
    })

    it('Barn Raise Token', async function () {
      expect(await this.beanstalk.getBarnRaiseWell()).to.be.equal(BEAN_WSTETH_WELL)
    })
  
    it('Removes underlying balance', async function () { 
      expect(await this.beanstalk.getTotalUnderlying(UNRIPE_LP)).to.be.equal(0)
    })
  
    it('Sends underlying balance to BCM', async function () {
      expect(await this.beanstalk.getExternalBalance(BCM, BEAN_ETH_WELL)).to.be.equal(underlyingBefore)
    })

    describe('Interactions with Unripe fail', async function () {
      it('chop fails', async function () {
        await this.beanstalk.connect(publius).withdrawDeposit(UNRIPE_LP, '-56836000000', to6('1'), 1);
        await expect(this.beanstalk.connect(publius).chop(UNRIPE_LP, to6('1'), 1, 0)).to.be.revertedWith("Chop: no underlying")
      })

      it('deposit fails', async function () {
        await this.beanstalk.connect(publius).withdrawDeposit(UNRIPE_LP, '-56836000000', to6('1'), 1);
        await expect(this.beanstalk.connect(publius).deposit(UNRIPE_LP, to6('1'),  1)).to.be.revertedWith('Silo: No Beans under Token.')
      })

      it('enrootDeposit fails', async function () {
        await expect(this.beanstalk.connect(publius).enrootDeposit(UNRIPE_LP, '-56836000000', to6('1'))).to.be.revertedWith('SafeMath: subtraction overflow');
      })

      it('enrootDeposits fails', async function () {
        await expect(this.beanstalk.connect(publius).enrootDeposits(UNRIPE_LP, ['-56836000000'], [to6('1')])).to.be.revertedWith('SafeMath: subtraction overflow');
      })

      it('convert Unripe Bean to LP fails', async function () {
        const liquidityAdder = await impersonateSigner('0x7eaE23DD0f0d8289d38653BCE11b92F7807eFB64', true);
        await this.wsteth.mint(liquidityAdder.address, to18('0.05'));
        await this.wsteth.connect(liquidityAdder).approve(this.well.address, to18('0.05'));
        await this.beanWsteth.connect(liquidityAdder).addLiquidity(['0', to18('0.05')], '0', liquidityAdder.address, ethers.constants.MaxUint256)
        await expect(this.beanstalk.connect(publius).convert(ConvertEncoder.convertUnripeBeansToLP(to6('200'), '0'), ['-16272000000'], [to6('200')])).to.be.revertedWith('SafeMath: division by zero');
      })

      it('convert Unripe LP to Bean fails', async function () {
        const liquidityAdder = await impersonateSigner('0x7eaE23DD0f0d8289d38653BCE11b92F7807eFB64', true);
        await expect(this.beanstalk.connect(publius).convert(ConvertEncoder.convertUnripeLPToBeans(to6('200'), '0'), ['-56836000000'], [to6('200')])).to.be.revertedWith('SafeMath: division by zero');
      })
    })
  })

  describe('Completes Migration', async function () {
    beforeEach(async function () {
      this.beanWstethUnderlying = await finishWstethMigration(true, true);
    })

    it("successfully adds underlying", async function () {
      expect(await this.beanstalk.getTotalUnderlying(UNRIPE_LP)).to.be.equal(this.beanWstethUnderlying)
      expect(await this.beanstalk.getUnderlying(UNRIPE_LP, await this.unripeLp.totalSupply())).to.be.equal(this.beanWstethUnderlying)
    })

    describe('Interactions with Unripe succeed', async function () {
      it('chop succeeds', async function () {
        await this.beanstalk.connect(publius).withdrawDeposit(UNRIPE_LP, '-56836000000', to6('1'), 1);
        await this.beanstalk.connect(publius).chop(UNRIPE_LP, to6('1'), 1, 0);
      })

      it('deposit succeeds', async function () {
        await this.beanstalk.connect(publius).withdrawDeposit(UNRIPE_LP, '-56836000000', to6('1'), 1);
        await this.beanstalk.connect(publius).deposit(UNRIPE_LP, to6('1'),  1);
      })

      it('enrootDeposit succeeds', async function () {
        // increase the bdv of the lp token, in order for enrootDeposit to succeed.
        await impersonateBean();
        await this.bean.mint(user.address, to6('1000000'))
        await this.bean.connect(user).approve(BEAN_WSTETH_WELL, to6('1000000'))
        await this.beanWsteth.connect(user).addLiquidity([to6('1000000'), '0'], '0', user.address, ethers.constants.MaxUint256);

        // mine 100 blocks
        for (let i = 0; i < 1000; i++) {
          await ethers.provider.send("evm_increaseTime", [12])
          await hre.network.provider.send("evm_mine")
        }

        await this.beanWsteth.connect(user).addLiquidity([0, 0], '0', user.address, ethers.constants.MaxUint256);

        await this.beanstalk.connect(publius).enrootDeposit(UNRIPE_LP, '-56836000000', to6('1'));
      })

      it('enrootDeposits succeeds', async function () {
        // increase the bdv of the lp token, in order for enrootDeposit to succeed.
        await impersonateBean();
        await this.bean.mint(user.address, to6('1000000'))
        await this.bean.connect(user).approve(BEAN_WSTETH_WELL, to6('1000000'))
        await this.beanWsteth.connect(user).addLiquidity([to6('1000000'), '0'], '0', user.address, ethers.constants.MaxUint256);

        // mine 100 blocks
        for (let i = 0; i < 1000; i++) {
          await ethers.provider.send("evm_increaseTime", [12])
          await hre.network.provider.send("evm_mine")
        }

        await this.beanWsteth.connect(user).addLiquidity([0, 0], '0', user.address, ethers.constants.MaxUint256);

        await this.beanstalk.connect(publius).enrootDeposits(UNRIPE_LP, ['-56836000000'], [to6('1')]);
      })

      it('convert Unripe Bean to LP succeeds', async function () {
        await this.wsteth.mint(user.address, to18('1000000'))
        await this.wsteth.connect(user).approve(BEAN_WSTETH_WELL, to18('1000000'))
        await this.beanWsteth.connect(user).addLiquidity([0, to18('1000000')], '0', user.address, ethers.constants.MaxUint256);

        await this.beanstalk.connect(publius).convert(ConvertEncoder.convertUnripeBeansToLP(to6('200'), '0'), ['-16272000000'], [to6('200')]);
      })

      it('convert Unripe LP to Bean succeeds', async function () {
        await this.beanstalk.connect(publius).convert(ConvertEncoder.convertUnripeLPToBeans(to6('200'), '0'), ['-56836000000'], [to6('200')])
      })
    })
  })
})