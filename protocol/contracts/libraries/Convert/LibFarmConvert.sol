// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibConvertData} from "./LibConvertData.sol";
import "~/interfaces/IPipeline.sol";

/**
 * @title LibFarmConvert
 * @author Publius, brean, pizzaman1337
 */
library LibFarmConvert {
    using LibConvertData for bytes;

    function convertWithFarm(bytes memory convertData)
        internal
        returns (
            address tokenOut,
            address tokenIn,
            uint256 amountOut,
            uint256 amountIn
        )
    {
        (amountIn, minAmountOut, tokenIn, tokenOut, farmData) = convertData.farmConvert();
        

        //assume amount returned here is the amount of tokenOut, and assume they left it in pipeline, then we'll take it out on their behalf
        bytes[] farmResult = address(this).call(advancedFarm(farmData));

        //assume the first value returned is the userReturnedConvertValue
        amountOut = farmResult[0];

        require(amountOut >= minAmountOut, "Convert: slippage");

        //assume the user left the converted assets in pipeline
        //actually pull those assets out of pipeline
        transferTokensFromPipeline(tokenOut, amountOut);
        //do an ERC20 token transfer call from the pipeline address to beanstalk address

        //at this point if we didn't revert then the transfer of the amount the user said they'd give us worked

    }
    
    function transferTokensFromPipeline(address tokenOut, uint256 userReturnedConvertValue) private {
        //todo investigate not using the entire interface but just using the function selector here
        Pipe p;
        p.address = address(tokenOut); //contract that pipeline will call
        p.data = abi.encodeWithSelector(
            ERC20.transfer.selector,
            address(this),
            userReturnedConvertValue
        );

        //todo: see if we can find a way to spit out a custom error saying it failed here, rather than a generic ERC20 revert
        // (success, result) = p.target.staticcall(p.data);
        // LibFunction.checkReturn(success, result);

        IPipeline(PIPELINE).pipe(p);
    }
}
