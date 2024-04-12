const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { BEAN, THREE_CURVE, THREE_POOL, BEAN_3_CURVE, PIPELINE, WETH, BEAN_ETH_WELL, BEANSTALK } = require('./utils/constants')
const { ConvertEncoder } = require('./utils/encoder.js')
const { to18, toStalk, to6, toX, toBean } = require('./utils/helpers.js')
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
    const contracts = await deploy(false, true);
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

    await setEthUsdChainlinkPrice('1000.50')
    // await setEthUsdChainlinkPrice('999.998018')
    await setEthUsdcPrice('1000')
    await setEthUsdtPrice('1000')

    await setReserves(
      owner,
      this.well,
      [to6('1000000'), to18('1000')]
    );
    // Not sure why this setReserves has to run twice, without it a "Whitelist: Invalid BDV selector" happens
    await setReserves(
      owner,
      this.well,
      [to6('1000000'), to18('1000')]
    );
    
    await this.season.captureWellE(this.well.address); //inits well oracle price


    this.silo = await ethers.getContractAt('SiloFacet', this.diamond.address);
    this.farmFacet = await ethers.getContractAt("FarmFacet", this.diamond.address);

    await this.bean.mint(userAddress, to6('1000000000'));
    await this.bean.mint(user2Address, to6('1000000000'));

    await this.season.teleportSunrise(10);
    this.season.deployStemsUpgrade();

    await initContracts(); //deploys drafter contract

    await this.bean.connect(user).approve(this.well.address, ethers.constants.MaxUint256);
    await this.bean.connect(user).approve(this.silo.address, ethers.constants.MaxUint256);
    await this.wellToken.connect(user).approve(PIPELINE, ethers.constants.MaxUint256)
    await this.wellToken.connect(user).approve(this.silo.address, ethers.constants.MaxUint256)
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


  describe('generalized convert tests', async function () {
  
    beforeEach(async function () {
      snapshotId = await takeSnapshot();
    });
  
    afterEach(async function () {
      await revertToSnapshot(snapshotId);
    });

    describe('basic convert', async function () {
      it.only('does the most basic possible convert Bean to LP towards peg', async function () {

        // log deltaB for this well before convert
        const deltaB = await this.seasonGetters.poolDeltaBInsta(this.well.address);
        console.log('deltaB: ', deltaB.toString());

        await this.silo.connect(user).deposit(this.bean.address, toBean('200'), EXTERNAL);
        //user needs to approve bean to well
        //get stem tip for token

        const depositStemTip = await this.siloGetters.stemTipForToken(this.bean.address);
        //advance 2 seasons to get past germination
        await this.season.siloSunrise(0);
        await this.season.siloSunrise(0);

        let advancedFarmCalls = await draftConvertBeanToBeanEthWell(toBean('200'));
        // const farmData = this.farmFacet.interface.encodeFunctionData("advancedFarm", [advancedFarmCalls]);

        //get well amount out if we deposit 200 beans
        const wellAmountOut = await this.beanstalk.getAmountOut(BEAN, this.well.address, toBean('200'))

        //store bdv of this well amount out for later comparison
        var bdvWellAmountOut = await this.siloGetters.bdv(this.well.address, wellAmountOut);


        //get grownStalk for this deposit
        // const grownStalk = await this.siloGetters.grownStalkForDeposit(user.address, this.bean.address, depositStemTip);
        const grownStalk = 0; // zero grown stalk since there's zero convert power
        const [newStemTip, ] = await this.siloGetters.calculateStemForTokenFromGrownStalk(this.well.address, grownStalk, bdvWellAmountOut);

        this.result = this.convert.connect(user).pipelineConvert(this.bean.address, [depositStemTip], [toBean('200')], this.well.address, advancedFarmCalls);

        // expect correct event and values to be emitted
        await expect(this.result).to.emit(this.convert, 'Convert').withArgs(user.address, this.bean.address, this.well.address, toBean('200'), wellAmountOut);
        await expect(this.result).to.emit(this.silo, 'RemoveDeposits').withArgs(user.address, this.bean.address, [depositStemTip], [toBean('200')], toBean('200'), [toBean('200')]);


        console.log('newStemTip: ', newStemTip);
        console.log('wellAmountOut: ', wellAmountOut);
        console.log('bdvWellAmountOut: ', bdvWellAmountOut);

        await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(user.address, this.well.address, newStemTip, wellAmountOut, bdvWellAmountOut);
      });

      it('does the most basic possible convert LP to Bean towards peg', async function () {
        await setEthUsdChainlinkPrice('999.998018') // adjust deltaB

        //first deposit 200 bean into bean:eth well
        await this.bean.connect(user).approve(this.well.address, ethers.constants.MaxUint256);
        //get amount out that we should recieve for depositing 200 beans
        const wellAmountOut = await this.well.getAddLiquidityOut([to6('200'), to18("0")]);
        await this.well.connect(user).addLiquidity([to6('200'), to18("0")], ethers.constants.Zero, user.address, ethers.constants.MaxUint256);

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

        // const farmData = this.farmFacet.interface.encodeFunctionData("advancedFarm", [
        //   advancedFarmCalls
        // ]);

        this.result = this.convert.connect(user).pipelineConvert(this.well.address, [depositStemTip], [wellAmountOut], this.bean.address, advancedFarmCalls);

        //verify events
        await expect(this.result).to.emit(this.convert, 'Convert').withArgs(user.address, this.well.address, this.bean.address, wellAmountOut, beanAmountOut);
        await expect(this.result).to.emit(this.silo, 'RemoveDeposits').withArgs(user.address, this.well.address, [depositStemTip], [wellAmountOut], wellAmountOut, [depositedBdv]);

        await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(user.address, this.bean.address, newStemTip, beanAmountOut, beanAmountOut);
      });


      it('does the most basic possible convert Bean to LP against peg', async function () {
        await setEthUsdChainlinkPrice('999.95')
        await this.silo.connect(user).deposit(this.bean.address, toBean('200'), EXTERNAL);
        const depositStemTip = await this.siloGetters.stemTipForToken(this.bean.address);
        //advance 2 seasons to get past germination
        await this.season.siloSunrise(0);
        await this.season.siloSunrise(0);
  
        let advancedFarmCalls = await draftConvertBeanToBeanEthWell(toBean('200'));
        // const farmData = this.farmFacet.interface.encodeFunctionData("advancedFarm", [advancedFarmCalls]);
  
        //get well amount out if we deposit 200 beans
        const wellAmountOut = await this.beanstalk.getAmountOut(BEAN, this.well.address, toBean('200'))
        //store bdv of this well amount out for later comparison
        var bdvWellAmountOut = await this.siloGetters.bdv(this.well.address, wellAmountOut);
  
        //get grownStalk for this deposit
        const grownStalk = 0; // zero grown stalk since it's all lost since converting away from peg
        const [newStemTip, ] = await this.siloGetters.calculateStemForTokenFromGrownStalk(this.well.address, grownStalk, bdvWellAmountOut);
  
        this.result = this.convert.connect(user).pipelineConvert(this.bean.address, [depositStemTip], [toBean('200')], this.well.address, advancedFarmCalls);
        const afterDeltaB = await this.seasonGetters.poolDeltaBInsta(this.well.address);
  
        //expect it to emit the Convert event
        await expect(this.result).to.emit(this.convert, 'Convert').withArgs(user.address, this.bean.address, this.well.address, toBean('200'), wellAmountOut);
  
        //expect it to emit the RemoveDeposits event
        await expect(this.result).to.emit(this.silo, 'RemoveDeposits').withArgs(user.address, this.bean.address, [depositStemTip], [toBean('200')], toBean('200'), [toBean('200')]);
  
        //expect add deposit event
        await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(user.address, this.well.address, newStemTip, wellAmountOut, bdvWellAmountOut);
      });

      it('does the most basic possible convert LP to Bean against peg', async function () {
        await this.bean.connect(user).approve(this.well.address, ethers.constants.MaxUint256);
        const wellAmountOut = await this.well.getAddLiquidityOut([toBean('200'), to18("0")]);
        await this.well.connect(user).addLiquidity([toBean('200'), to18("0")], ethers.constants.Zero, user.address, ethers.constants.MaxUint256);
        const beanAmountOut = await this.well.getRemoveLiquidityOneTokenOut(wellAmountOut, BEAN);
        const siloResult = await this.silo.connect(user).deposit(this.well.address, wellAmountOut, EXTERNAL);
        const siloReceipt = await siloResult.wait();
        const depositedBdv = getBdvFromAddDepositReceipt(this.silo, siloReceipt);
        const depositStemTip = await this.siloGetters.stemTipForToken(this.well.address);
        //advance 2 seasons to get past germination
        await this.season.siloSunrise(0);
        await this.season.siloSunrise(0);
        const grownStalk = 0;
        const [newStemTip, ] = await this.siloGetters.calculateStemForTokenFromGrownStalk(this.bean.address, grownStalk, beanAmountOut);
        let advancedFarmCalls = await draftConvertBeanEthWellToBean(wellAmountOut, beanAmountOut)
        // const farmData = this.farmFacet.interface.encodeFunctionData("advancedFarm", [advancedFarmCalls]);
        this.result = await this.convert.connect(user).pipelineConvert(this.well.address, [depositStemTip], [wellAmountOut], this.bean.address, advancedFarmCalls);

        //log events that are emitted


        //verify events
        await expect(this.result).to.emit(this.convert, 'Convert').withArgs(user.address, this.well.address, this.bean.address, wellAmountOut, beanAmountOut);
        await expect(this.result).to.emit(this.silo, 'RemoveDeposits').withArgs(user.address, this.well.address, [depositStemTip], [wellAmountOut], wellAmountOut, [depositedBdv]);
        await expect(this.result).to.emit(this.silo, 'AddDeposit').withArgs(user.address, this.bean.address, newStemTip, beanAmountOut, beanAmountOut);
      });
    });

    
    describe('pipe convert where things should break', async function () {
      it('reverts if you pass in non-whitelisted silo token', async function () {
        const uniswapUsdcEthPool = '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640';
        await this.bean.connect(user).approve(this.well.address, ethers.constants.MaxUint256);
        const wellAmountOut = await this.well.getAddLiquidityOut([toBean('200'), to18("0")]);
        await this.well.connect(user).addLiquidity([toBean('200'), to18("0")], ethers.constants.Zero, user.address, ethers.constants.MaxUint256);
        const beanAmountOut = await this.well.getRemoveLiquidityOneTokenOut(wellAmountOut, BEAN);
        const siloResult = await this.silo.connect(user).deposit(this.well.address, wellAmountOut, EXTERNAL);
        const siloReceipt = await siloResult.wait();
        const depositedBdv = getBdvFromAddDepositReceipt(this.silo, siloReceipt);
        const depositStemTip = await this.siloGetters.stemTipForToken(this.well.address);
        //advance 2 seasons to get past germination
        await this.season.siloSunrise(0);
        await this.season.siloSunrise(0);
        const grownStalk = 0;
        const [newStemTip, ] = await this.siloGetters.calculateStemForTokenFromGrownStalk(this.bean.address, grownStalk, beanAmountOut);

        let advancedFarmCalls = await draftConvertBeanEthWellToBean(wellAmountOut, beanAmountOut)
        // const farmData = this.farmFacet.interface.encodeFunctionData("advancedFarm", [advancedFarmCalls]);
        await expect(this.convert.connect(user).pipelineConvert(uniswapUsdcEthPool, [depositStemTip], [wellAmountOut], this.bean.address, advancedFarmCalls)).to.be.revertedWith("Convert: Not enough tokens removed.");

      });
    });

      // write a test that inputs non-whitelisted tokens
      // write LP to LP tests

      //need a test that leaves fewer amount of erc20 in the pipeline than is returned by the final function
      //(aka you try to pull out of pipeline more than you put in, it should fail)
      //"ERC20: transfer amount exceeds balance"




    /*describe('stalk penalty calculation tests', async function () {
      describe('non-peg crossing', async function () {
        it('calculates penalty for towards-peg upward to zero', async function () {
          const penalty = await this.convert.calculateStalkPenalty(to6('-100'), to6('0'), [to6('100')]);
          expect(penalty).to.be.equal('0');
        });

        it('calculates penalty for towards-peg upward non-zero', async function () {
          const penalty = await this.convert.calculateStalkPenalty(to6('-200'), to6('-100'), [to6('100')]);
          expect(penalty).to.be.equal('0');
        });

        it('calculates penalty for towards-peg upward big', async function () {
          const penalty = await this.convert.calculateStalkPenalty(to18('-200'), to18('-100'), [to18('100')]);
          expect(penalty).to.be.equal('0');
        });

        //in theory it can handle larger numbers but for some reason BigNumber on the JS side overflows
        it('calculates penalty for towards-peg upward very big', async function () {
          const penalty = await this.convert.calculateStalkPenalty(toX("-2", 40), toX("-1", 40), [toX("1", 20)]);
          expect(penalty).to.be.equal('0');
        });

        it('calculates penalty for towards-peg downward to zero', async function () {
          const penalty = await this.convert.calculateStalkPenalty(to6('100'), to6('0'), [to6('100')]);
          expect(penalty).to.be.equal('0');
        });

        it('calculates penalty for towards-peg downward non-zero', async function () {
          const penalty = await this.convert.calculateStalkPenalty(to6('200'), to6('100'), [to6('100')]);
          expect(penalty).to.be.equal('0');
        });

        it('calculates penalty for towards-peg downward big', async function () {
          const penalty = await this.convert.calculateStalkPenalty(to18('200'), to18('100'), [to18('100')]);
          expect(penalty).to.be.equal('0');
        });

        //in theory it can handle larger numbers but for some reason BigNumber on the JS side overflows
        it('calculates penalty for towards-peg downward very big', async function () {
          const penalty = await this.convert.calculateStalkPenalty(toX("2", 40), toX("1", 40), [toX("1", 20)]);
          expect(penalty).to.be.equal('0');
        });
      });

      describe('peg-crossing', async function () {
        it('calculates penalty for cross-peg upward', async function () {
          const penalty = await this.convert.calculateStalkPenalty(to6('-50'), to6('50'), [to6('100')]);
          expect(penalty).to.be.equal(to6('50'));
        });

        it('calculates penalty for cross-peg upward', async function () {
          const penalty = await this.convert.calculateStalkPenalty('-99', '1', ['100']);
          expect(penalty).to.be.equal('1');
        });

        it('calculates penalty for cross-peg upward small percentage', async function () {
          // 16 zeros
          const penalty = await this.convert.calculateStalkPenalty('-990000000000000000', '1', ['1000000000000000000']);
          expect(penalty).to.be.equal('1');
        });

      });

      describe('start at peg and convert away', async function () {
        it('calculates penalty for at-peg upward', async function () {
          const penalty = await this.convert.calculateStalkPenalty(to6('0'), to6('50'), [to6('50')]);
          expect(penalty).to.be.equal(to6('50'));
        });

        it('calculates penalty for at-peg downward', async function () {
          const penalty = await this.convert.calculateStalkPenalty(to6('0'), to6('-50'), [to6('50')]);
          expect(penalty).to.be.equal(to6('50'));
        });
      });

      describe('start away and convert away', async function () {
        it('calculates penalty for away-peg downward', async function () {
          const penalty = await this.convert.calculateStalkPenalty(to6('-50'), to6('-150'), [to6('100')]);
          expect(penalty).to.be.equal(to6('100'));
        });

        it('calculates penalty for away-peg upward', async function () {
          const penalty = await this.convert.calculateStalkPenalty(to6('50'), to6('150'), [to6('100')]);
          expect(penalty).to.be.equal(to6('100'));
        });
      });

      describe('no change', async function () {
        it('no change over peg', async function () {
          const penalty = await this.convert.calculateStalkPenalty(to6('-50'), to6('-50'), [to6('0')]);
          expect(penalty).to.be.equal('0');
        });

        it('no change below peg', async function () {
          const penalty = await this.convert.calculateStalkPenalty(to6('50'), to6('50'), [to6('0')]);
          expect(penalty).to.be.equal('0');
        });
      });
    });*/

    describe('apply penalty to grown stalks function test', async function () {
      it('one grown stalk no penalty', async function () {
        console.log('starting test');
        const bdvsRemoved = [to6('50')];
        const grownStalks = [to6('50')];
        await this.convert.applyPenaltyToGrownStalks(to6('0'), bdvsRemoved, grownStalks);
        expect(grownStalks).to.deep.equal([to6('50')]);
      });

      it('two grown stalk no penalty', async function () {
        console.log('starting test');
        const bdvsRemoved = [to6('50'), to6('50')];
        const grownStalks = [to6('50'), to6('50')];
        await this.convert.applyPenaltyToGrownStalks(to6('0'), bdvsRemoved, grownStalks);
        expect(grownStalks).to.deep.equal([to6('50'), to6('50')]);
      });

      it('one grown stalk full penalty', async function () {
        const bdvsRemoved = [to6('50')];
        const grownStalks = [to6('50')];
        const penalty = to6('50');
        const resultingGrownStalks = await this.convert.applyPenaltyToGrownStalks(penalty, bdvsRemoved, grownStalks);

        const convertedResult = resultingGrownStalks.map(value => value.toString());
        expect(convertedResult).to.deep.equal(['0']);
      });

      it('two grown stalk full penalty', async function () {
        const bdvsRemoved = [to6('50'), to6('50')];
        const grownStalks = [to6('50'), to6('50')];
        const penalty = to6('100');
        const resultingGrownStalks = await this.convert.applyPenaltyToGrownStalks(penalty, bdvsRemoved, grownStalks);

        const convertedResult = resultingGrownStalks.map(value => value.toString());
        expect(convertedResult).to.deep.equal(['0', '0']);
      });

      it('one grown stalk half penalty', async function () {
        const bdvsRemoved = [to6('50')];
        const grownStalks = [to6('50')];
        const penalty = to6('25');
        const resultingGrownStalks =  await this.convert.applyPenaltyToGrownStalks(penalty, bdvsRemoved, grownStalks);
        const convertedResult = resultingGrownStalks.map(value => value.toString());
        expect(convertedResult).to.deep.equal([to6('25').toString()]);
      });

      it('two grown stalk half penalty', async function () {
        const bdvsRemoved = [to6('50'), to6('50')];
        const grownStalks = [to6('50'), to6('50')];
        const penalty = to6('50');
        const resultingGrownStalks =  await this.convert.applyPenaltyToGrownStalks(penalty, bdvsRemoved, grownStalks);
        const convertedResult = resultingGrownStalks.map(value => value.toString());
        expect(convertedResult).to.deep.equal([to6('50').toString(), '0']);
      });

      it('two grown stalk 3/4 penalty', async function () {
        const bdvsRemoved = [to6('50'), to6('50')];
        const grownStalks = [to6('50'), to6('50')];
        const penalty = to6('75');
        const resultingGrownStalks =  await this.convert.applyPenaltyToGrownStalks(penalty, bdvsRemoved, grownStalks);
        const convertedResult = resultingGrownStalks.map(value => value.toString());
        expect(convertedResult).to.deep.equal([to6('25').toString(), '0']);
      });

      it('two grown stalk 1/4 penalty', async function () {
        const bdvsRemoved = [to6('50'), to6('50')];
        const grownStalks = [to6('50'), to6('50')];
        const penalty = to6('25');
        const resultingGrownStalks =  await this.convert.applyPenaltyToGrownStalks(penalty, bdvsRemoved, grownStalks);
        const convertedResult = resultingGrownStalks.map(value => value.toString());
        console.log('convertedResult: ', convertedResult);
        expect(convertedResult).to.deep.equal([to6('50').toString(), to6('25').toString()]);
      });

      it('two grown stalk 1/4 penalty but no actual grown stalk', async function () {
        const bdvsRemoved = [to6('50'), to6('50')];
        const grownStalks = [to6('0'), to6('0')];
        const penalty = to6('25');
        const resultingGrownStalks =  await this.convert.applyPenaltyToGrownStalks(penalty, bdvsRemoved, grownStalks);
        const convertedResult = resultingGrownStalks.map(value => value.toString());
        console.log('convertedResult: ', convertedResult);
        expect(convertedResult).to.deep.equal([to6('0').toString(), to6('0').toString()]);
      });
    });

  });
});
