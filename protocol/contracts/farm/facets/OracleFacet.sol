/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
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
contract OracleFacet {

    using Decimal for Decimal.D256;
    using SafeMath for uint256;
    
    struct Pool {
        address pool;
        int256 deltaB;
    }

    AppStorage internal s;

    function capture() public virtual returns (int256 bdv) {
        require(address(this) == msg.sender, "Oracle: Beanstalk only");
        bdv = LibCurveOracle.capture() + LibUniswapOracle.capture();
    }

    function totalDeltaB() external view returns (int256 bdv) {
        bdv = LibCurveOracle.check() + LibUniswapOracle.check();
    }

    function deltaB() external view returns (int256 dB, Pool[2] memory pools) {
        pools[0].pool = C.uniswapV2PairAddress();
        pools[0].deltaB = LibUniswapOracle.check();
        pools[1].pool = C.curveMetapoolAddress();
        pools[1].deltaB = LibCurveOracle.check();
        dB = pools[0].deltaB + pools[1].deltaB;
    }

    function poolDeltaB(address pool) external view returns (int256 bdv) {
        if (pool == C.uniswapV2PairAddress()) return LibUniswapOracle.check();
        else if (pool == C.curveMetapoolAddress()) return LibCurveOracle.check();
        require(false, "Oracle: Pool not supported");
    }
}
