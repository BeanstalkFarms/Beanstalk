// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibUsdOracle, LibEthUsdOracle} from "contracts/libraries/Oracle/LibUsdOracle.sol";

/**
 * @title UsdOracle
 * @author Publius
 * @notice Holds functions to query USD prices of tokens.
 */
contract UsdOracle {
    
    function getUsdPrice(address token) external view returns (uint256) {
        return LibUsdOracle.getUsdPrice(token);
    }

    function getEthUsdPrice() external view returns (uint256) {
        return LibEthUsdOracle.getEthUsdPrice();
    }

    function getEthUsdTwa(uint32 lookback) external view returns (uint256) {
        return LibEthUsdOracle.getEthUsdPrice(lookback);
    }

}
