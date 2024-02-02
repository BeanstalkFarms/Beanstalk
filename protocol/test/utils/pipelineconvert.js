const { ethers } = require("hardhat");

const { EXTERNAL, INTERNAL } = require("./balances.js");
const { BEAN, ZERO_ADDRESS, UNRIPE_BEAN, UNRIPE_LP, BEAN_ETH_WELL, PIPELINE } = require("./constants.js");
const { to6, to18, toBean } = require("./helpers.js");
const { wrapExternalCall, encodeBlueprintData } = require("./tractor.js");




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


module.exports = {
    draftConvertBeanToBeanEthWell,
    draftConvertBeanEthWellToBean
};
