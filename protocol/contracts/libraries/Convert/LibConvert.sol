/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "./LibCurveConvert.sol";
import "./LibUniswapConvert.sol";

/**
 * @author Publius
 * @title Lib Convert
**/
library LibConvert {

    using SafeMath for uint256;
    using LibConvertUserData for bytes;

    /// @notice Takes in bytes object that has convert input data encoded into it for a particular convert for
    ///         a specified pool and returns the in and out convert amounts and token addresses and bdv
    /// @param userData Contains convert input parameters for a specified convert
    function convert(bytes memory userData)
        internal
        returns (address outToken, address inToken, uint256 outAmount, uint256 inAmount, uint256 bdv)
    {
        LibConvertUserData.ConvertKind kind = userData.convertKind();

        if (kind == LibConvertUserData.ConvertKind.BEANS_TO_CURVE_LP) {
            (outToken, inToken, outAmount, inAmount, bdv) = LibCurveConvert.convertBeansToLP(userData);
        } else if (kind == LibConvertUserData.ConvertKind.BEANS_TO_UNISWAP_LP) {
            (outToken, inToken, outAmount, inAmount, bdv) = LibUniswapConvert.convertBeansToLP(userData);
        } else if (kind == LibConvertUserData.ConvertKind.CURVE_LP_TO_BEANS) {
            (outToken, inToken, outAmount, inAmount, bdv) = LibCurveConvert.convertLPToBeans(userData);
        } else if (kind == LibConvertUserData.ConvertKind.UNISWAP_LP_TO_BEANS) {
            (outToken, inToken, outAmount, inAmount, bdv) = LibUniswapConvert.convertLPToBeans(userData);
        } else {
            revert("Convert: Invalid payload");
        }
        require(bdv > 0 && outAmount > 0, "Convert: BDV or amount is 0.");
    }
}
