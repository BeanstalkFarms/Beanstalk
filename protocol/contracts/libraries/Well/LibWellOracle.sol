/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../../C.sol";
import "./Type/LibWellType.sol";
import "./Balance/LibWellBalance.sol";
import "../Token/LibTransfer.sol";

/**
 * @author Publius
 * @title Lib Well
 **/
library LibWell {
    using SafeMath for uint256;
    using LibSafeMath128 for uint128;

    // function getInstananeousLPValue(address wellId, uint256 tokenI, uint256 n) internal view returns (uint256 value) {
    //     LibWellType.getdXdD(
    //         WellType wellType,
    //         bytes calldata typeData,
    //         uint256 precision,
    //         uint256 d,
    //         uint256 i,
    //         uint256[] memory xs
    //     )
    // }
}
