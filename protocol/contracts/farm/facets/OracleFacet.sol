/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../AppStorage.sol";
import "../../libraries/Decimal.sol";
import "../../libraries/UniswapV2OracleLibrary.sol";
import "../../libraries/Oracle/LibUniswapOracle.sol";
import "../../libraries/Oracle/LibCurveOracle.sol";

/**
 * @author Publius
 * @title Oracle tracks the Delta B across the Uniswap and Curve Liquidity pools
**/
contract OracleFacet is LibUniswapOracle {

    using Decimal for Decimal.D256;
    using SafeMath for uint256;

    AppStorage internal s;

    function capture() public virtual returns (int256) {
        require(address(this) == msg.sender, "Oracle: Beanstalk only");
        return LibCurveOracle.capture() + captureUniswap();
    }
}
