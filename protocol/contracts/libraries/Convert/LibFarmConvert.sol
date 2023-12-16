/ SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibConvertData} from "./LibConvertData.sol";
import {LibTransfer} from "~/libraries/Token/LibTransfer.sol";
import {LibTokenSilo} from "~/libraries/Silo/LibTokenSilo.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPipeline, PipeCall} from "~/interfaces/IPipeline.sol";
import {AppStorage, LibAppStorage} from "~/libraries/LibAppStorage.sol";


/**
 * @title LibFarmConvert
 * @author pizzaman1337, Brean
 */

interface IAdvancedFarm {
    function advancedFarm(
        LibConvertData.AdvancedFarmCall[] calldata data
    ) external returns (bytes[] memory results);
}

library LibFarmConvert {
    using LibConvertData for bytes;

    address internal constant PIPELINE = 0xb1bE0000bFdcDDc92A8290202830C4Ef689dCeaa;

    /**
     * A farm convert needs to be able to take in:
     * 1. A list of tokens, stems, and amounts for input
     * 2. An output token address
     * 3. Output stems will be calculate, but we want to allow combining of crates. I'm thinking maybe a 2-d array of grouped stems, i.e. [[1,2,3], [4,5,6]], assuming your input deposits are of stems 1,2,3,4,5,6. 
     * 4. A farm function that does a swap, somehow we have to pass all the input tokens and amounts to this function
     */
    function convertWithFarm(bytes memory convertData)
        internal
        returns (
            address tokenOut,
            address tokenIn,
            uint256 amountOut,
            uint256 amountIn
        )
    {   
        AppStorage storage s = LibAppStorage.diamondStorage();

        // {ConvertFacet._withdrawTokens} checks that the token is whitelisted, but 
        // {ConvertFacet._depositTokensForConvert} does not check the new token is whitelisted.
        require(s.ss[tokenOut].milestoneSeason != 0, "Token not whitelisted");

        uint256 initalDeltaB = getOracleprice();
        uint256 minAmountOut;
        LibConvertData.AdvancedFarmCall[] memory farmData;
        (amountIn, minAmountOut, tokenIn, tokenOut, farmData) = convertData.farmConvert();

        // Transfer tokenIn from beanstalk to pipeline
        IERC20(tokenIn).transfer(PIPELINE, amountIn);

        // FIXME: probably better to call an pipe/AdvancePipe here, rather than using .call()
        // convertData is used again to save an instantiation. Can be instanteated again if needed.
        // perform advanced farm operations.

        // todo: advancefarm returns a bytes[].
        (, convertData) = address(this).call(
           abi.encodeWithSelector(
                IAdvancedFarm.advancedFarm.selector,
                farmData
            )
        );

        bytes[] memory results = abi.decode(convertData, (bytes[]));

        uint256 newDeltaB = getOracleprice();

        // todo: check deltaB abs
        // check that deltaB is closer to 0
        require(newDeltaB <= initalDeltaB, "Convert: deltaB Increased");

        // assume last value is the amountOut
        // todo: for full functionality, we should instead have the user specify the index of the amountOut
        // in the convertData.
        amountOut = abi.decode(results[results.length - 1], (uint256));

        require(amountOut >= minAmountOut, "Convert: slippage");

        // verify BDV of new amount is greater than the input.
        require(
            _bdv(tokenIn,amountIn) >= _bdv(tokenOut ,amountOut), 
            "Convert: BDV decreased");

        // user MUST leave final assets in pipeline, allowing us to verify that the farm has been called successfully.
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
    function getOracleprice() internal returns (uint256) {
        return 1e6;
    }

    function _bdv(address token, uint256 amount) internal returns (uint256) {
        return LibTokenSilo.beanDenominatedValue(token, amount);
    }
}