// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {LibArbitrum} from "contracts/libraries/LibArbitrum.sol";

/**
 * @title ArbSys
 * @author Brean
 * @notice ArbSys is a precompile for the Arbitrum network that provides the current block number.
 */
contract ArbSys {
    function arbBlockNumber() external view returns (uint256) {
        return LibArbitrum.blockNumber();
    }
}
