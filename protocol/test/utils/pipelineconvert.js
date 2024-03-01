const { ethers } = require("hardhat");

const { EXTERNAL, INTERNAL } = require("./balances.js");
const { BEAN, ZERO_ADDRESS, UNRIPE_BEAN, UNRIPE_LP, BEAN_ETH_WELL, PIPELINE, TRI_CRYPTO_POOL, WETH, BEAN_3_CURVE, BEAN_METAPOOL, USDT } = require("./constants.js");
const { to6, to18, toBean } = require("./helpers.js");
const { wrapExternalCall, encodeBlueprintData } = require("./tractor.js");
const curveABI = require("../../abi/curve.json");

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
    console.log('done setting up contracts');
    // console.log('this.curveBean3crvPool: ', this.curveBean3crvPool);
    let advancedFarmCalls = [];

    //assume that approvals are already done


    //calls[0]
    //approve spending WETH to curve tricrypto
    advancedFarmCalls.push({
        callData: await wrapExternalCall(
            WETH,
            this.bean.interface.encodeFunctionData("approve", [this.curveTricryptoPool.address, ethers.constants.MaxUint256])
        ),
        clipboard: ethers.utils.hexlify("0x000000")
    });

    //calls[1]
    //approve spending USDT to bean:3crv
    advancedFarmCalls.push({
        callData: await wrapExternalCall(
            USDT,
            this.bean.interface.encodeFunctionData("approve", [this.curveBean3crvPool.address, ethers.constants.MaxUint256])
        ),
        clipboard: ethers.utils.hexlify("0x000000")
    });

    //calls[2]
    //note this is removing only ETH, you may want to remove equal parts bean and eth and only swap the eth part
    //however if you're doing arb you might want to swap the whole thing to better correct the pool imbalance
    advancedFarmCalls.push({
        callData: await wrapExternalCall(
            BEAN_ETH_WELL,
            this.well.interface.encodeFunctionData("removeLiquidityOneToken", [amountOfLpToRemove, WETH, minTokenAmountOut, PIPELINE, ethers.constants.MaxUint256])
        ),
        clipboard: ethers.utils.hexlify("0x000000")
    });
    console.log('call zero done');

    //great, now we have the returned amount out in the return data for calls[0]
    //feed this into a trade with curve tricrypto pool

    //curve interface:
    //function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) external returns (uint256);
    //the Curve facet in beanstalk would find i and j for you, but if we already know them beforehand
    //then we can save gas in the pipeline call since we can just pass it in

    /*
    [[0xdAC17F958D2ee523a2206206994597C13D831ec7]
    [0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599]
    [0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2]
    */

    //i and j are the from and to token indexes
    let i = 2; //weth
    let j = 0; //usdt
    let amountIn = 0; //this will come from clipboard
    let minAmountOut = 100; //in theory we should use another call here to setup minAmount out in realtime (or pre-
    //set it up beforehand if we want it to act like a fill-or-kill order when the txn gets into a block)

    //calls[3]
    advancedFarmCalls.push({
        callData: await wrapExternalCall(
            this.curveTricryptoPool.address,
            this.curveTricryptoPool.interface.encodeFunctionData("exchange(uint256,uint256,uint256,uint256)", [i, j, amountIn, minAmountOut])
        ),

        // clipboard: ethers.utils.hexlify("0x000000")
        clipboard: await drafter().then(
            async (drafter) =>
              await drafter.encodeClipboard(0, [
                await drafter.encodeLibReturnPasteParam(2, SLOT_SIZE+PIPE_RETURN_BYTE_OFFSET, EXTERNAL_ARGS_START_INDEX + SLOT_SIZE*2)
              ])
          )
    });

    //curve doesn't seem to return the amount out after exchange, so we need to call balanceOf
    //to get the amount out

    //calls[4]
    // advancedFarmCalls.push({
    //     callData: await wrapExternalCall(
    //         this.usdt.address,
    //         this.usdt.interface.encodeFunctionData("balanceOf", [PIPELINE])
    //     ),
    //     clipboard: ethers.utils.hexlify("0x000000")
    // });

    //how do you do an exchange with metapool

    i = 3; //usdt
    j = 0; //bean

    //calls[5]
    // advancedFarmCalls.push({
    //     callData: await wrapExternalCall(
    //         this.curveBean3crvPool.address,
    //         this.curveBean3crvPool.interface.encodeFunctionData("exchange(uint256,uint256,uint256,uint256)", [i, j, amountIn, minAmountOut])
    //     ),
    //     // clipboard: ethers.utils.hexlify("0x000000")
    //     clipboard: await drafter().then(
    //         async (drafter) =>
    //         await drafter.encodeClipboard(0, [
    //             await drafter.encodeLibReturnPasteParam(5, SLOT_SIZE+PIPE_RETURN_BYTE_OFFSET, EXTERNAL_ARGS_START_INDEX + SLOT_SIZE*2)
    //         ])
    //     )
    // });

    // console.log('call 2 done');
    //final return amount is beans returned
  
    return advancedFarmCalls;
  };


module.exports = {
    initContracts,
    draftConvertBeanToBeanEthWell,
    draftConvertBeanEthWellToBean,
    draftConvertBeanEthWellToUDSTViaCurveTricryptoThenToBeanVia3Crv,
    draftPipelineApprovals,
    curveABI
};
