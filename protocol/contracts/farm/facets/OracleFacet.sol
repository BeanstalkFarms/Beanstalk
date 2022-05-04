/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../AppStorage.sol";
import "../../libraries/Oracle/LibCurveOracle.sol";

/**
 * @author Publius
 * @title Oracle tracks the Delta B across the Uniswap and Curve Liquidity pools
**/
contract OracleFacet {

    using SafeMath for uint256;
    
    struct Pool {
        address pool;
        int256 deltaB;
    }

    AppStorage internal s;

    function capture() public virtual returns (int256 bdv) {
        require(address(this) == msg.sender, "Oracle: Beanstalk only");
        bdv = LibCurveOracle.capture();
    }

    function totalDeltaB() external view returns (int256 bdv) {
        bdv = LibCurveOracle.check();
    }

    function deltaB() external view returns (int256 dB, Pool[1] memory pools) {
        pools[0].pool = C.curveMetapoolAddress();
        pools[0].deltaB = LibCurveOracle.check();
        dB = pools[0].deltaB;
    }

    function poolDeltaB(address pool) external view returns (int256 bdv) {
        if (pool == C.curveMetapoolAddress()) return LibCurveOracle.check();
        require(false, "Oracle: Pool not supported");
    }
}
