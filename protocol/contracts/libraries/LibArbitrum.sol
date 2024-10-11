// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

interface IArbitrumSys {
    function arbBlockNumber() external view returns (uint256);
}

/**
 * @title LibArbitrum
 * @notice LibArbitrum provides constants for interacting with the Arbitrum network.
 **/
library LibArbitrum {
    address internal constant ARB_SYS_PRECOMPILE = 0x0000000000000000000000000000000000000064;

    /**
     * @notice Returns the current block number on Arbitrum.
     */
    function blockNumber() internal view returns (uint256) {
        return IArbitrumSys(ARB_SYS_PRECOMPILE).arbBlockNumber();
    }
}
