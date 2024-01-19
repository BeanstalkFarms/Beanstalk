const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { BEAN, THREE_CURVE, THREE_POOL, BEAN_3_CURVE, PIPELINE, WETH, BEAN_ETH_WELL, BEANSTALK } = require('./utils/constants')
const { ConvertEncoder } = require('./utils/encoder.js')
const { to18, toBean, toStalk, to6 } = require('./utils/helpers.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
let user, user2, owner;
let userAddress, ownerAddress, user2Address;
const { toBN, encodeAdvancedData, signSiloDepositTokenPermit, signSiloDepositTokensPermit, signTokenPermit } = require('../utils/index.js');
const { deployWell, setReserves, whitelistWell } = require('../utils/well.js');
const { setEthUsdPrice, setEthUsdcPrice, setEthUsdtPrice } = require('../scripts/usdOracle.js');
const fs = require('fs');
const { upgradeWithNewFacets } = require("../scripts/diamond");
const { impersonateBeanstalkOwner, impersonateSigner } = require('../utils/signer.js')
const { draftConvertBeanToBeanEthWell } = require('./utils/pipelineconvert.js');


const BASE_STRING = './node_modules/@beanstalk/wells/out';

describe('Farm Convert', function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address);
    this.diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', this.diamond.address)
    this.silo = await ethers.getContractAt('SiloFacet', this.diamond.address);
    this.convert = await ethers.getContractAt('ConvertFacet', this.diamond.address);
    console.log('BEAN address: ', BEAN);
    this.bean = await ethers.getContractAt('MockToken', BEAN);
    this.threePool = await ethers.getContractAt('Mock3Curve', THREE_POOL);
    this.threeCurve = await ethers.getContractAt('MockToken', THREE_CURVE);
    this.beanMetapool = await ethers.getContractAt('IMockCurvePool', BEAN_3_CURVE);
    this.farmFacet = await ethers.getContractAt("FarmFacet", this.diamond.address);
    

    this.well = await ethers.getContractAt("IWell", BEAN_ETH_WELL);

    // this.well = await deployWell([BEAN, WETH]);
    // console.log('this.well.address: ', this.well.address);
    // this.fakeWell = await deployWell([BEAN, WETH]);
    // this.wellToken = await ethers.getContractAt("IERC20", this.well.address)


    //log well abi


    ///protocol/node_modules/@beanstalk/wells/out/Well.sol/Well.json
    // const wellName = 'Well';
    // const wellAbi = JSON.parse(await fs.readFileSync(`${BASE_STRING}/${wellName}.sol/${wellName}.json`))
    // console.log('wellAbi: ', wellAbi);
    // this.wellContract = await ethers.getContractAt(this.well.address, wellAbi);

    await this.threeCurve.mint(userAddress, to18('100000'));
    await this.threePool.set_virtual_price(to18('1'));
    await this.threeCurve.connect(user).approve(this.beanMetapool.address, to18('100000000000'));

    await this.beanMetapool.set_A_precise('1000');
    await this.beanMetapool.set_virtual_price(ethers.utils.parseEther('1'));
    await this.beanMetapool.connect(user).approve(this.threeCurve.address, to18('100000000000'));
    await this.beanMetapool.connect(user).approve(this.silo.address, to18('100000000000'));

    await this.season.siloSunrise(0);
    await this.bean.mint(userAddress, toBean('1000000000'));
    await this.bean.mint(user2Address, toBean('1000000000'));
    await this.bean.connect(user).approve(this.beanMetapool.address, to18('100000000000'));
    await this.bean.connect(user2).approve(this.beanMetapool.address, to18('100000000000'));
    await this.bean.connect(user).approve(this.silo.address, '100000000000');
    await this.bean.connect(user2).approve(this.silo.address, '100000000000');
    await this.beanMetapool.connect(user).add_liquidity([toBean('1000'), to18('1000')], to18('2000'));
    await this.season.teleportSunrise(10);
    this.season.deployStemsUpgrade();
    await this.season.teleportSunrise(12);

    await setEthUsdPrice('999.998018')
    await setEthUsdcPrice('1000')
    await setEthUsdtPrice('1000')

    // await setReserves(
    //   owner,
    //   this.well,
    //   [to6('1000000'), to18('1000')]
    // );

    // await setReserves(
    //   owner,
    //   this.well,
    //   [to6('1000000'), to18('1000')]
    // );

    // await whitelistWell(this.well.address, '10000', to6('4'))

    //whitelist bean
    // await this.silo.mockWhitelistToken(this.bean.address, this.silo.interface.getSighash("mockBDV(uint256 amount)"), "10000", 1e6);
    // console.log('whitelisted bean');
    console.log('going to upgrade new facets');



      // libraryNames: ['LibConvert'],
      // initFacetName: 'InitBipNewSilo',

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
    console.log('upgraded facets?');
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });


  describe('curve convert beans to lp', async function () {

    describe('basic convert', async function () {
      
      it.only('does the most basic possible convert', async function () {


        await this.silo.connect(user).deposit(this.bean.address, toBean('200'), EXTERNAL);
        await this.beanMetapool.connect(user).add_liquidity([toBean('0'), to18('200')], to18('150'));

        //setup the AdvancedFarmCall data
        //add_liquidity
        // const selector = this.threeCurve.interface.encodeFunctionData('add_liquidity', [toBean('200'), to18('0')], to18('150'));

        
        // let advancedFarmCalls = [];


        //beans are provided, we need to convert them to lp, so find the selector needed to add liquidity to the well
        //args are tokenAmountsIn, minLpAmountOut, recipient, deadline
        // const encodedFunctionCall = this.well.interface.encodeFunctionData('addLiquidity', [[toBean('200')], 0, PIPELINE, ethers.constants.MaxUint256]);

        // const calls = this.farmFacet.interface.encodeFunctionData("advancedFarm", [
          // advancedFarmCalls
        // ]);

        console.log('calling draftConvertBeanToBeanEthWell');

        let advancedFarmCalls = await draftConvertBeanToBeanEthWell();

        // advancedFarmCalls = [
        //   {
        //     callData: '0x8a65d2e00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000bea0000029ad1c77d3d5d23ba2d8893db9d1efab',
        //     clipboard: '0x000000'
        //   }
        // ];

        // function flattenAndExtractArguments(advancedFarmCalls) {
        //   // Flatten the array and map each object to its properties
        //   const flattenedArgs = advancedFarmCalls.flat().map(obj => [obj.callData, obj.clipboard]);
         
        //   // Return the flattened array of arguments
        //   return flattenedArgs;
        //  }

        //  const flattenedAdvancedFarmCalls = flattenAndExtractArguments(advancedFarmCalls);


        // console.log('this.farmFacet.interface: ', this.farmFacet.interface);

        console.log('advancedFarmCalls: ', advancedFarmCalls);

        // console.log('flattenedAdvancedFarmCalls: ', flattenedAdvancedFarmCalls);

        const encodedFunctionCall = this.farmFacet.interface.encodeFunctionData("advancedFarm", [
          advancedFarmCalls
        ]);

        console.log('encodedFunctionCall: ', encodedFunctionCall);

        return;

        // const amounts = [toBean('200'), to18('0')];
        // const min_mint_amount = to18('150');

        // const data = encodeAdvancedData(2, web3.utils.toBN('0'), [
        //   [0, 32, amounts[0]],
        //   [0, 32, amounts[1]],
        //   [1, 32, min_mint_amount],
        // ]);

        const farmData = encodedFunctionCall;

        console.log('farmData: ', farmData);
        console.log('this.convert.connect(user).pipelineConvert: ', this.convert.connect(user).pipelineConvert);
        console.log('this.bean.address: ', this.bean.address);
        console.log('this.well.address: ', this.well.address);

        console.log('going to call pipeline convert');

        console.log('toBean(\'200\'): ', toBean('200'));
        console.log('[farmData]: ', [farmData]);

        await this.convert.connect(user).pipelineConvert(this.bean.address, ['2'], ['200000000'], this.well.address, farmData);

        console.log('done calling pipeline convert');

        // await expect(this.convert.connect(user).convert(ConvertEncoder.convertFarm(toBean('200'), to18('201'), this.bean.address, this.beanMetapool.address,), ['2'], [toBean('200')]))

      });
      
      
    });

  });
});
