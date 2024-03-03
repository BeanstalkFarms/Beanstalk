const { ethers } = require("hardhat");

const { EXTERNAL, INTERNAL } = require("./balances.js");
const { BEAN, ZERO_ADDRESS, UNRIPE_BEAN, UNRIPE_LP, BEAN_ETH_WELL, PIPELINE, TRI_CRYPTO_POOL, WETH, BEAN_3_CURVE, BEAN_METAPOOL, USDT, BEANSTALK } = require("./constants.js");
const { to6, to18, toBean } = require("./helpers.js");
const { wrapExternalCall, encodeBlueprintData } = require("./tractor.js");
const { packAdvanced, encodeAdvancedData, decodeAdvancedData } = require('../../utils/function.js')
const curveABI = require("../../abi/curve.json");
const { getBeanstalk } = require('../../utils/contracts.js');

//putting these constants here in case tractor is merged later
//once this and tractor are merged, we can combine these and stick them together somewhere (like constants)
const SLOT_SIZE = 32;
const SELECTOR_SIZE = 4;
const ARGS_START_INDEX = SELECTOR_SIZE + SLOT_SIZE;
const EXTERNAL_ARGS_START_INDEX = SELECTOR_SIZE * 2 + SLOT_SIZE * 4 + SLOT_SIZE;
const PIPE_RETURN_BYTE_OFFSET = 64;

let drafterAddr;
let junctionAddr;

// Init test chain state for Drafter to function.
const initContracts = async () => {
  drafterAddr = await (
    await (await (await ethers.getContractFactory("Drafter")).deploy()).deployed()
  ).address;
  console.log("Drafter deployed to:", drafterAddr);
};

//drafter for now is an on-chain contract, but could be pure-JS in the future
const drafter = async () => await ethers.getContractAt("Drafter", drafterAddr);

//in theory people could undo the approvals, requiring the approval to be setup each time
//this is just for unit testing purposes to approve all the things easily from pipeline
//the UI might need to include the approvals or you could do a griefing attack whenever
//there's a pipeline convert in the mempool
const draftPipelineApprovals = async () => {
    this.well = await ethers.getContractAt("IWell", BEAN_ETH_WELL);
    this.bean = await ethers.getContractAt('MockToken', BEAN);
    this.curveTricryptoPool = await ethers.getContractAt(curveABI, TRI_CRYPTO_POOL);
    this.curveBean3crvPool = await ethers.getContractAt(curveABI, BEAN_3_CURVE);
    
    let advancedFarmCalls = [];

    advancedFarmCalls.push({
        callData: await wrapExternalCall(
            BEAN,
            this.bean.interface.encodeFunctionData("approve", [BEAN_ETH_WELL, ethers.constants.MaxUint256])
        ),
        clipboard: ethers.utils.hexlify("0x000000")
    });

    //approve pipeline to spend beans to bean:eth well
    // advancedFarmCalls.push({
    //     callData: await wrapExternalCall(
    //         BEAN,
    //         this.bean.interface.encodeFunctionData("approve", [BEAN_ETH_WELL, ethers.constants.MaxUint256])
    //     ),
    //     clipboard: ethers.utils.hexlify("0x000000")
    // });
    // console.log('call 0 done');
    /*
    //approve spending Bean to curve pool TODO
    advancedFarmCalls.push({
        callData: await wrapExternalCall(
            this.curveBean3crvPool.address,
            this.bean.interface.encodeFunctionData("approve", [BEAN_ETH_WELL, ethers.constants.MaxUint256])
        ),
        clipboard: ethers.utils.hexlify("0x000000")
    });
    console.log('call 1 done');
    //approve spending USDT to curve bean:3crv pool TODO
    advancedFarmCalls.push({
        callData: await wrapExternalCall(
            USDT,
            this.bean.interface.encodeFunctionData("approve", [this.curveBean3crvPool.address, ethers.constants.MaxUint256])
        ),
        clipboard: ethers.utils.hexlify("0x000000")
    });

    console.log('call 2 done');
    //approve spending USDT to curve tricrypto (USDT-WETH-WBTC) pool TODO
    advancedFarmCalls.push({
        callData: await wrapExternalCall(
            USDT,
            this.bean.interface.encodeFunctionData("approve", [this.curveBean3crvPool.address, ethers.constants.MaxUint256])
        ),
        clipboard: ethers.utils.hexlify("0x000000")
    });*/
    // console.log('call 3 done');

    return advancedFarmCalls;
}

const draftConvertBeanToBeanEthWell = async () => {
    this.well = await ethers.getContractAt("IWell", BEAN_ETH_WELL);
    this.bean = await ethers.getContractAt('MockToken', BEAN);
    
    let advancedFarmCalls = [];

    //approve pipeline to spend beans to bean:eth well
    advancedFarmCalls.push({
        callData: await wrapExternalCall(
            BEAN,
            this.bean.interface.encodeFunctionData("approve", [BEAN_ETH_WELL, ethers.constants.MaxUint256])
        ),
        clipboard: ethers.utils.hexlify("0x000000")
    });

    advancedFarmCalls.push({
        callData: await wrapExternalCall(
            BEAN_ETH_WELL,
            this.well.interface.encodeFunctionData("addLiquidity", [[toBean('200'), to18('0')], ethers.constants.Zero, PIPELINE, ethers.constants.MaxUint256])
        ),
        clipboard: ethers.utils.hexlify("0x000000")
    });
  
    return advancedFarmCalls;
  };

const draftConvertBeanEthWellToBean = async (amountOfLpToRemove, minTokenAmountOut) => {
    this.well = await ethers.getContractAt("IWell", BEAN_ETH_WELL);
    this.bean = await ethers.getContractAt('MockToken', BEAN);
    
    let advancedFarmCalls = [];

    //approve pipeline to spend bean:eth well to... bean:eth well?
    advancedFarmCalls.push({
        callData: await wrapExternalCall(
            BEAN_ETH_WELL,
            this.bean.interface.encodeFunctionData("approve", [BEAN_ETH_WELL, ethers.constants.MaxUint256])
        ),
        clipboard: ethers.utils.hexlify("0x000000")
    });

    advancedFarmCalls.push({
        callData: await wrapExternalCall(
            BEAN_ETH_WELL,
            this.well.interface.encodeFunctionData("removeLiquidityOneToken", [amountOfLpToRemove, BEAN, minTokenAmountOut, PIPELINE, ethers.constants.MaxUint256])
        ),
        clipboard: ethers.utils.hexlify("0x000000")
    });
  
    return advancedFarmCalls;
  };

  
const draftConvertBeanEthWellToUDSTViaCurveTricryptoThenToBeanVia3Crv = async (amountOfLpToRemove, minTokenAmountOut) => {
    console.log('setup contracts');
    this.well = await ethers.getContractAt("IWell", BEAN_ETH_WELL);
    this.bean = await ethers.getContractAt('MockToken', BEAN);
    this.usdt = await ethers.getContractAt('MockToken', USDT);
    this.weth = await ethers.getContractAt('IWETH', WETH)
    this.curveTricryptoPool = await ethers.getContractAt(curveABI, TRI_CRYPTO_POOL);
    this.curveBean3crvPool = await ethers.getContractAt(curveABI, BEAN_3_CURVE);
    this.pipeline = await ethers.getContractAt("Pipeline", PIPELINE);
    this.beanstalk = await getBeanstalk(BEANSTALK);

    let amountIn = 0; //this will come from clipboard
    let minAmountOut = 100; //in theory we should use another call here to setup minAmount out in realtime (or pre-
    //set it up beforehand if we want it to act like a fill-or-kill order when the txn gets into a block)


    // BREAN:
    advancedFarm0 = this.beanstalk.interface.encodeFunctionData(
        "transferToken",
        [
            this.well.address,
            PIPELINE,
            amountOfLpToRemove,
            EXTERNAL,
            EXTERNAL
        ]
    )

    selector0 = this.weth.interface.encodeFunctionData(
        "approve", 
        [this.curveTricryptoPool.address, ethers.constants.MaxUint256]
    );
    
    approveUSDT = this.weth.interface.encodeFunctionData(
        "approve", 
        [this.curveBean3crvPool.address, ethers.constants.MaxUint256]
    );

    selector1 = this.well.interface.encodeFunctionData(
        "removeLiquidityOneToken", 
        [amountOfLpToRemove, WETH, minTokenAmountOut, PIPELINE, ethers.constants.MaxUint256]
    );

    // WETH -> USDT
    selector2 = this.curveTricryptoPool.interface.encodeFunctionData(
        "exchange(uint256,uint256,uint256,uint256)", 
        [2, 0, amountIn, minAmountOut]
    );

    // USDT -> BEAN
    selector3 = this.curveTricryptoPool.interface.encodeFunctionData(
        "exchange_underlying(int128,int128,uint256,uint256)", 
        [3, 0, amountIn, minAmountOut]
    );

    // no data clipboard
    noData = encodeAdvancedData(0)
   
    // approve WETH
    pipe0 = [this.weth.address, selector0, noData]

    // approve USDT
    pipe1 = [USDT, approveUSDT, noData]

    // remove Liq
    pipe2 = [this.well.address, selector1, noData]

    // from the 3rd call, take 0th (1st) param, 
    // put into 2nd (3rd) param
    // 32 is param to take it from (start of output data from previous call starts 32 bytes in)
    // 100 is 4+32*3. First 4 bytes are selector, then each param is 32 bytes.
    pipelineData = encodeAdvancedData(1, 0, [2, SLOT_SIZE, SELECTOR_SIZE+SLOT_SIZE*3])

    // exchange WETH -> USDT
    pipe3 = [this.curveTricryptoPool.address, selector2, pipelineData]

    // get balance of USDT
    usdtPipe = [USDT, this.usdt.interface.encodeFunctionData("balanceOf", [PIPELINE]), noData]

    // from the 5th call, take 0th (1st) param, 
    // put into 2nd (3rd) param
    pipelineData2 = encodeAdvancedData(1, 0, [4, SLOT_SIZE, SELECTOR_SIZE+SLOT_SIZE*3])

    // exchange USDT -> BEAN
    pipe4 = [this.curveBean3crvPool.address, selector3, pipelineData2]

    // get balance of USDT
    
    // pipeline construction. Beanstalk has it's own pipeline function, 2 params, the pipe calls themselves and second is value (if eth amount needed).
    advancedFarm1 = await this.beanstalk.interface.encodeFunctionData(
        "advancedPipe",
        [
            [pipe0, pipe1, pipe2, pipe3, usdtPipe, pipe4],
            0
        ]
    )
    await console.log('advancedFarm1: ', advancedFarm1)

    output = [
        // [advancedFarm0, noData], // transfer BEAN/WETH into pipeline
        [advancedFarm1, noData] // pipeline call
    ]
    await console.log('advancedFarmCalls output: ', output)
    return output;
  };

module.exports = {
    initContracts,
    draftConvertBeanToBeanEthWell,
    draftConvertBeanEthWellToBean,
    draftConvertBeanEthWellToUDSTViaCurveTricryptoThenToBeanVia3Crv,
    draftPipelineApprovals,
    curveABI
};
