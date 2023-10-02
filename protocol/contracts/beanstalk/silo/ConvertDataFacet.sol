/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibConvert} from "contracts/libraries/Convert/LibConvert.sol";
import {LibDiamond} from "contracts/libraries/LibDiamond.sol";

/**
 * @author Brean
 * @title ConvertDataFacet handles decoding the convert data for a particular convert.
 * @dev seperated from ConvertFacet due to size constraints.
 **/
contract ConvertDataFacet {

    function decodeConvertData(bytes calldata convertData) 
        external 
        returns (
            address tokenOut,
            address tokenIn,
            uint256 amountOut,
            uint256 amountIn
        )
    {
        LibDiamond.enforceIsOwnerOrContract();
        return LibConvert.convert(convertData);
    }
}
