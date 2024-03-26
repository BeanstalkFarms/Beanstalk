const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { BEAN, THREE_CURVE, THREE_POOL, BEAN_3_CURVE, PIPELINE, WETH, BEAN_ETH_WELL, BEANSTALK } = require('./utils/constants')
const { ConvertEncoder } = require('./utils/encoder.js')
const { to18, toBean, toStalk, to6, toX } = require('./utils/helpers.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
let user, user2, owner;
let userAddress, ownerAddress, user2Address;
const { toBN, encodeAdvancedData, signSiloDepositTokenPermit, signSiloDepositTokensPermit, signTokenPermit } = require('../utils/index.js');
const { deployWell, setReserves, whitelistWell, deployMockBeanEthWell, impersonateBeanEthWell } = require('../utils/well.js');
const { setEthUsdChainlinkPrice, setEthUsdcPrice, setEthUsdtPrice } = require('../utils/oracle.js');
const fs = require('fs');
const { upgradeWithNewFacets } = require("../scripts/diamond");
const { impersonateBeanstalkOwner, impersonateSigner } = require('../utils/signer.js')
const { draftConvertBeanToBeanEthWell, draftConvertBeanEthWellToBean, initContracts } = require('./utils/pipelineconvert.js');
const { deployBasin } = require("../scripts/basin.js");
const { deployPipeline, impersonatePipeline } = require('../scripts/pipeline.js');
const { getBeanstalk } = require('../utils/contracts.js');

//to get trace with hardhat tracer:
//yarn hardhat test test/ConvertFarm.test.js --trace


describe('Farm Convert', function () {
  before(async function () {

    [owner, user, user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.beanstalk = await getBeanstalk(this.diamond.address);
    impersonateBeanEthWell();
    this.well = await ethers.getContractAt("IWell", BEAN_ETH_WELL);
    this.fakeWell = await deployWell([BEAN, WETH]);
    this.wellToken = await ethers.getContractAt("IERC20", this.well.address)
    this.convert = await ethers.getContractAt("MockConvertFacet", this.diamond.address)
    this.bean = await ethers.getContractAt("MockToken", BEAN);
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address);
    this.siloGetters = await ethers.getContractAt('SiloGettersFacet', this.diamond.address);
    this.seasonGetters = await ethers.getContractAt('SeasonGettersFacet', this.diamond.address);
    await this.bean.mint(ownerAddress, to18('1000000000'))
    await this.wellToken.connect(owner).approve(this.beanstalk.address, ethers.constants.MaxUint256)
    await this.bean.connect(owner).approve(this.beanstalk.address, ethers.constants.MaxUint256)

    await setEthUsdChainlinkPrice('999.998018')
    await setEthUsdcPrice('1000')
    await setEthUsdtPrice('1000')

    await setReserves(
      owner,
      this.well,
      [to6('1000000'), to18('1000')]
    );

    await setReserves(
      owner,
      this.well,
      [to6('1000000'), to18('1000')]
    );
    await whitelistWell(this.well.address, '10000', to6('4'))
    await this.season.captureWellE(this.well.address); //inits well oracle price


    this.silo = await ethers.getContractAt('SiloFacet', this.diamond.address);
    this.farmFacet = await ethers.getContractAt("FarmFacet", this.diamond.address);


    await this.bean.mint(userAddress, toBean('1000000000'));
    await this.bean.mint(user2Address, toBean('1000000000'));

    const beanstalkOwner = await impersonateBeanstalkOwner();
    await upgradeWithNewFacets({
      diamondAddress: BEANSTALK,
      facetNames: ['ConvertFacet'],
      libraryNames: [ 'LibConvert' ],
      facetLibraries: {
        'ConvertFacet': [ 'LibConvert' ]
      },
      bip: false,
      object: false,
      verbose: false,
      account: beanstalkOwner
    });

    this.pipeline = await deployPipeline();

    await this.season.teleportSunrise(10);
    this.season.deployStemsUpgrade();

    await initContracts(); //deploys drafter contract


    await this.bean.connect(user).approve(this.well.address, ethers.constants.MaxUint256);
    await this.bean.connect(user).approve(this.silo.address, ethers.constants.MaxUint256);
    await this.wellToken.connect(user).approve(this.pipeline.address, ethers.constants.MaxUint256)
    await this.wellToken.connect(user).approve(this.silo.address, ethers.constants.MaxUint256)
  });


  describe('generalized convert tests', async function () {

  
    beforeEach(async function () {
      snapshotId = await takeSnapshot();
    });
  
    afterEach(async function () {
      await revertToSnapshot(snapshotId);
    });

    describe('basic convert', async function () {
      it('does the most basic possible convert Bean to LP', async function () {

        await this.silo.connect(user).deposit(this.bean.address, toBean('200'), EXTERNAL);
        //user needs to approve bean to well
        //get stem tip for token

        //get deltaB of both pools before convert //poolDeltaBInsta
        const beforeDeltaB = await this.seasonGetters.poolDeltaBInsta(this.well.address);
        console.log('beforeDeltaB: ', beforeDeltaB);


        const depositStemTip = await this.siloGetters.stemTipForToken(this.bean.address);
        console.log('depositStemTip: ', depositStemTip);

        //advance 2 seasons to get past germination
        await this.season.siloSunrise(0);
        await this.season.siloSunrise(0);


        let advancedFarmCalls = await draftConvertBeanToBeanEthWell();

        const farmData = this.farmFacet.interface.encodeFunctionData("advancedFarm", [
          advancedFarmCalls
        ]);

        //get well amount out if we deposit 200 beans
        const wellAmountOut = await this.beanstalk.getAmountOut(BEAN, this.well.address, toBean('200'))
        console.log('wellAmountOut: ', wellAmountOut);
        //store bdv of this well amount out for later comparison
        var bdvWellAmountOut = await this.siloGetters.bdv(this.well.address, wellAmountOut);
        console.log('bdvWellAmountOut: ', bdvWellAmountOut);

        //get grownStalk for this deposit
        const grownStalk = await this.siloGetters.grownStalkForDeposit(user.address, this.bean.address, depositStemTip);
        console.log('for bean grownStalk: ', grownStalk);
        const [newStemTip, ] = await this.siloGetters.calculateStemForTokenFromGrownStalk(this.well.address, grownStalk, bdvWellAmountOut);

        this.result = this.convert.connect(user).pipelineConvert(this.bean.address, [depositStemTip], [toBean('200')], toBean('200'), this.well.address, farmData);

        const afterDeltaB = await this.seasonGetters.poolDeltaBInsta(this.well.address);
        console.log('afterDeltaB: ', afterDeltaB);

        //expect it to emit the Convert event
        // await expect(this.result).to.emit(this.convert, 'Convert').withArgs(user.address, this.bean.address, this.well.address, toBean('200'), wellAmountOut);

        //expect it to emit the RemoveDeposits event
        await expect(this.result).to.emit(this.silo, 'RemoveDeposits').withArgs(user.address, this.bean.address, [depositStemTip], [toBean('200')], toBean('200'), [toBean('200')]);

        console.log('newStemTip: ', newStemTip);
        //expect add deposit event
        await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(user.address, this.well.address, newStemTip, wellAmountOut, bdvWellAmountOut);
      });

      function getBdvFromAddDepositReceipt(silo, siloReceipt) {
        var depositedBdv = 0;
        for (const log of siloReceipt.logs) {
          try {
            const parsedEvent = silo.interface.parseLog(log);
            if (parsedEvent.name == 'AddDeposit') {
              depositedBdv = parsedEvent.args.bdv;
            }
          } catch (e) {
            //for some reason it fails to parse one of the events, no matching event error. Just ignore it.
            // console.log('error parsing event: ', e);
          }
        }
        return depositedBdv;
      }

      it('does the most basic possible convert LP to Bean', async function () {

        //first deposit 200 bean into bean:eth well
        await this.bean.connect(user).approve(this.well.address, ethers.constants.MaxUint256);
        //get amount out that we should recieve for depositing 200 beans
        const wellAmountOut = await this.well.getAddLiquidityOut([toBean('200'), to18("0")]);
        await this.well.connect(user).addLiquidity([toBean('200'), to18("0")], ethers.constants.Zero, user.address, ethers.constants.MaxUint256);

        //alright now if we removed that well amount, how many bean would we expect to get?
        const beanAmountOut = await this.well.getRemoveLiquidityOneTokenOut(wellAmountOut, BEAN);

        //deposit the bean:eth
        const siloResult = await this.silo.connect(user).deposit(this.well.address, wellAmountOut, EXTERNAL);

        //get event logs and see how much the actual bdv was
        const siloReceipt = await siloResult.wait();
        const depositedBdv = getBdvFromAddDepositReceipt(this.silo, siloReceipt);
        
        const depositStemTip = await this.siloGetters.stemTipForToken(this.well.address);

        //advance 2 seasons to get past germination
        await this.season.siloSunrise(0);
        await this.season.siloSunrise(0);


        const grownStalk = await this.siloGetters.grownStalkForDeposit(user.address, this.well.address, depositStemTip);
        const [newStemTip, ] = await this.siloGetters.calculateStemForTokenFromGrownStalk(this.bean.address, grownStalk, beanAmountOut);

        let advancedFarmCalls = await draftConvertBeanEthWellToBean(wellAmountOut, beanAmountOut)

        const farmData = this.farmFacet.interface.encodeFunctionData("advancedFarm", [
          advancedFarmCalls
        ]);

        this.result = this.convert.connect(user).pipelineConvert(this.well.address, [depositStemTip], [wellAmountOut], wellAmountOut, this.bean.address, farmData);

        //verify events
        await expect(this.result).to.emit(this.convert, 'Convert').withArgs(user.address, this.well.address, this.bean.address, wellAmountOut, beanAmountOut);
        await expect(this.result).to.emit(this.silo, 'RemoveDeposits').withArgs(user.address, this.well.address, [depositStemTip], [wellAmountOut], wellAmountOut, [depositedBdv]);

        await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(user.address, this.bean.address, newStemTip, beanAmountOut, beanAmountOut);
      });

      //need a test that leaves fewer amount of erc20 in the pipeline than is returned by the final function
      //(aka you try to pull out of pipeline more than you put in, it should fail)
      //"ERC20: transfer amount exceeds balance"


    });


    /*describe('basic convert multiple crates', async function () {
      it('Bean to LP multiple crates', async function () {

        await this.silo.connect(user).deposit(this.bean.address, toBean('200'), EXTERNAL);
        const stemTip1 = await this.siloGetters.stemTipForToken(this.bean.address);
        await this.season.siloSunrise(0);

        await this.silo.connect(user).deposit(this.bean.address, toBean('200'), EXTERNAL);
        const stemTip2 = await this.siloGetters.stemTipForToken(this.bean.address);
        await this.season.siloSunrise(0);
        
        await this.silo.connect(user).deposit(this.bean.address, toBean('200'), EXTERNAL);
        const stemTip3 = await this.siloGetters.stemTipForToken(this.bean.address);
        await this.season.siloSunrise(0);
        
        console.log('stemTip1: ', stemTip1);
        console.log('stemTip2: ', stemTip2);
        console.log('stemTip3: ', stemTip3);

        //do another sunrise because of germination
        await this.season.siloSunrise(0);
        

        let advancedFarmCalls = await draftConvertBeanToBeanEthWell();

        const farmData = this.farmFacet.interface.encodeFunctionData("advancedFarm", [
          advancedFarmCalls
        ]);

        //get well amount out if we deposit 600 beans
        const wellAmountOut = await this.beanstalk.getAmountOut(BEAN, this.well.address, toBean('600'))
        //store bdv of this well amount out for later comparison
        const bdvWellAmountOut = await this.siloGetters.bdv(this.well.address, wellAmountOut);

        this.result = this.convert.connect(user).pipelineConvert(this.bean.address, [stemTip1, stemTip2, stemTip3], [toBean('200'), toBean('200'), toBean('200')], toBean('600'), this.well.address, farmData);

        //expect it to emit the Convert event
        await expect(this.result).to.emit(this.convert, 'Convert').withArgs(user.address, this.bean.address, this.well.address, toBean('200'), wellAmountOut);
        await expect(this.result).to.emit(this.convert, 'Convert').withArgs(user.address, this.bean.address, this.well.address, toBean('200'), wellAmountOut);
        await expect(this.result).to.emit(this.convert, 'Convert').withArgs(user.address, this.bean.address, this.well.address, toBean('200'), wellAmountOut);

        //expect it to emit the RemoveDeposits event
        await expect(this.result).to.emit(this.silo, 'RemoveDeposits').withArgs(user.address, this.bean.address, [stemTip1, stemTip2, stemTip3], [toBean('200'), toBean('200'), toBean('200')], toBean('600'), [toBean('200'), toBean('200'), toBean('200')]);

        //expect add deposit event
        await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(user.address, this.well.address, stemTip1, wellAmountOut, bdvWellAmountOut);
        await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(user.address, this.well.address, stemTip2, wellAmountOut, bdvWellAmountOut);
        await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(user.address, this.well.address, stemTip3, wellAmountOut, bdvWellAmountOut);
      });

      //write a test with a ton of crates but low max tokens
    });*/


    describe('stalk penalty calculation tests', async function () {
      describe('non-peg crossing', async function () {
        it('calculates penalty for towards-peg upward to zero', async function () {
          const penalty = await this.convert.calculatePercentStalkPenalty(to6('-100'), to6('0'), to6('100'));
          expect(penalty).to.be.equal('0');
        });

        it('calculates penalty for towards-peg upward non-zero', async function () {
          const penalty = await this.convert.calculatePercentStalkPenalty(to6('-200'), to6('-100'), to6('100'));
          expect(penalty).to.be.equal('0');
        });

        it('calculates penalty for towards-peg upward big', async function () {
          const penalty = await this.convert.calculatePercentStalkPenalty(to18('-200'), to18('-100'), to18('100'));
          expect(penalty).to.be.equal('0');
        });

        //in theory it can handle larger numbers but for some reason BigNumber on the JS side overflows
        it('calculates penalty for towards-peg upward very big', async function () {
          const penalty = await this.convert.calculatePercentStalkPenalty(toX("-2", 40), toX("-1", 40), toX("1", 20));
          expect(penalty).to.be.equal('0');
        });

        it('calculates penalty for towards-peg downward to zero', async function () {
          const penalty = await this.convert.calculatePercentStalkPenalty(to6('100'), to6('0'), to6('100'));
          expect(penalty).to.be.equal('0');
        });

        it('calculates penalty for towards-peg downward non-zero', async function () {
          const penalty = await this.convert.calculatePercentStalkPenalty(to6('200'), to6('100'), to6('100'));
          expect(penalty).to.be.equal('0');
        });

        it('calculates penalty for towards-peg downward big', async function () {
          const penalty = await this.convert.calculatePercentStalkPenalty(to18('200'), to18('100'), to18('100'));
          expect(penalty).to.be.equal('0');
        });

        //in theory it can handle larger numbers but for some reason BigNumber on the JS side overflows
        it('calculates penalty for towards-peg downward very big', async function () {
          const penalty = await this.convert.calculatePercentStalkPenalty(toX("2", 40), toX("1", 40), toX("1", 20));
          expect(penalty).to.be.equal('0');
        });
      });

      describe('peg-crossing', async function () {
        it('calculates penalty for cross-peg upward', async function () {
          const penalty = await this.convert.calculatePercentStalkPenalty(to6('-50'), to6('50'), to6('100'));
          expect(penalty).to.be.equal(toX('50', 16));
        });

        it('calculates penalty for cross-peg upward', async function () {
          const penalty = await this.convert.calculatePercentStalkPenalty('-99', '1', '100');
          expect(penalty).to.be.equal(toX('1', 16)); //crossed pag by 1%
        });

        it('calculates penalty for cross-peg upward small percentage', async function () {
          // 16 zeros
          const penalty = await this.convert.calculatePercentStalkPenalty('-990000000000000000', '1', '1000000000000000000');
          expect(penalty).to.be.equal('1'); //crossed pag by 1%
        });

      });

      describe('start at peg and convert away', async function () {
        it('calculates penalty for at-peg upward', async function () {
          const penalty = await this.convert.calculatePercentStalkPenalty(to6('0'), to6('50'), to6('50'));
          expect(penalty).to.be.equal(toX('100', 16)); // 100% penalty
        });

        it('calculates penalty for at-peg downward', async function () {
          const penalty = await this.convert.calculatePercentStalkPenalty(to6('0'), to6('-50'), to6('50'));
          expect(penalty).to.be.equal(toX('100', 16));
        });
      });

      describe('start away and convert away', async function () {
        it('calculates penalty for away-peg downward', async function () {
          const penalty = await this.convert.calculatePercentStalkPenalty(to6('-50'), to6('-150'), to6('100'));
          expect(penalty).to.be.equal(toX('100', 16)); // 100% penalty
        });

        it('calculates penalty for away-peg upward', async function () {
          const penalty = await this.convert.calculatePercentStalkPenalty(to6('50'), to6('150'), to6('100'));
          expect(penalty).to.be.equal(toX('100', 16)); // 100% penalty
        });
      });

      describe('no change', async function () {
        it('no change over peg', async function () {
          const penalty = await this.convert.calculatePercentStalkPenalty(to6('-50'), to6('-50'), to6('0'));
          expect(penalty).to.be.equal('0');
        });

        it('no change below peg', async function () {
          const penalty = await this.convert.calculatePercentStalkPenalty(to6('50'), to6('50'), to6('0'));
          expect(penalty).to.be.equal('0');
        });
      });
    });
  });
});
