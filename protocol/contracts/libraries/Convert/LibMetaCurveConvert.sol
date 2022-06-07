/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../LibAppStorage.sol";
import "./LibConvertData.sol";
import "../Curve/LibBeanMetaCurve.sol";

/**
 * @author Publius
 * @title Lib Curve Convert
 **/
library LibMetaCurveConvert {
    using SafeMath for uint256;
    using LibConvertData for bytes;

    function beansAtPeg(uint256[2] memory balances)
        internal
        view
        returns (uint256 beans)
    {
        return balances[1].mul(C.curve3Pool().get_virtual_price()).div(1e30);
    }
}
