// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibConvertData} from "./LibConvertData.sol";
import "~/interfaces/IPipeline.sol";

/**
 * @title LibFarmConvert
 * @author Publius, pizzaman1337, brean
 */
library LibFarmConvert {
    using LibConvertData for bytes;

    address internal constant PIPELINE = 0xb1bE0000bFdcDDc92A8290202830C4Ef689dCeaa;

    function convertWithFarm(bytes memory convertData)
        internal
        returns (
            address tokenOut,
            address tokenIn,
            uint256 amountOut,
            uint256 amountIn
        )
    {
        int256 initalDeltaB = getOracleprice();
        uint256 minAmountOut;
        LibConvertData.AdvancedFarmCall[] memory farmData;
        (amountIn, minAmountOut, tokenIn, tokenOut, farmData) = convertData.farmConvert();
        

        //assume amount returned here is the amount of tokenOut, and assume they left it in pipeline, then we'll take it out on their behalf

        // FIXME: probably better to call an pipe/AdvancePipe here, rather than using .call()
        (, convertData) = address(this).call(
           abi.encodeWithSignature(
                "farm(bytes[])",
                farmData
            )
        );

        int256 newDeltaB = getOracleprice();

        // todo: check deltaB   
        // check that price has improved or stayed the same
        if(initalDeltaB < newDeltaB) {
            revert("Convert: oracle price increased");
        }

        // assume the first value returned is the userReturnedConvertValue
        amountOut = abi.decode(convertData,(uint256));

        require(amountOut >= minAmountOut, "Convert: slippage");

        // assume the user left the converted assets in pipeline
        // actually pull those assets out of pipeline
        // this confirms whether the pipeline call succeeded or not
        transferTokensFromPipeline(tokenOut, amountOut);
    }
    
    function transferTokensFromPipeline(address tokenOut, uint256 userReturnedConvertValue) private {
        // todo investigate not using the entire interface but just using the function selector here
        PipeCall memory p;
        p.target = address(tokenOut); //contract that pipeline will call
        p.data = abi.encodeWithSignature(
            "transfer(address,uint256)",
            address(this),
            userReturnedConvertValue
        );

        //todo: see if we can find a way to spit out a custom error saying it failed here, rather than a generic ERC20 revert
        // (success, result) = p.target.staticcall(p.data);
        // LibFunction.checkReturn(success, result);

        IPipeline(PIPELINE).pipe(p);
    }

    // todo: implement oracle
    function getOracleprice() internal returns (int256) {
        return 1e6;
    }
}
