// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "./interfaces/IBean.sol";
import "./interfaces/IFertilizer.sol";
import "./interfaces/IProxyAdmin.sol";
import "./libraries/Decimal.sol";
import "./interfaces/IPipeline.sol";

/**
 * @title C
 * @author Publius
 * @notice Contains constants used throughout Beanstalk.
 */
library C {
    using Decimal for Decimal.D256;

    //////////////////// Globals ////////////////////

    uint256 internal constant PRECISION = 1e18;

    //////////////////// Reentrancy ////////////////////
    uint256 internal constant NOT_ENTERED = 1;
    uint256 internal constant ENTERED = 2;

    //////////////////// Season ////////////////////

    /// @dev The length of a Season meaured in seconds.
    uint256 internal constant CURRENT_SEASON_PERIOD = 3600; // 1 hour
    uint256 internal constant SOP_PRECISION = 1e30;

    //////////////////// Silo ////////////////////
    uint256 internal constant STALK_PER_BEAN = 1e10;
    uint256 private constant ROOTS_BASE = 1e12;

    //////////////////// Exploit Migration ////////////////////

    uint256 private constant UNRIPE_LP_PER_DOLLAR = 1884592; // 145_113_507_403_282 / 77_000_000
    uint256 private constant ADD_LP_RATIO = 866616;

    //////////////////// Contracts ////////////////////

    address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address internal constant PIPELINE = 0xb1bE000644bD25996b0d9C2F7a6D6BA3954c91B0;

    //////////////////// Well ////////////////////

    uint256 internal constant WELL_MINIMUM_BEAN_BALANCE = 1000_000_000; // 1,000 Beans

    //////////////////// Tractor ////////////////////

    uint80 internal constant SLOT_SIZE = 32;
    // Special index to indicate the data to copy is the publisher address.
    uint80 internal constant PUBLISHER_COPY_INDEX = type(uint80).max;
    // Special index to indicate the data to copy is the operator address.
    uint80 internal constant OPERATOR_COPY_INDEX = type(uint80).max - 1;

    function getRootsBase() internal pure returns (uint256) {
        return ROOTS_BASE;
    }

    function unripeLPPerDollar() internal pure returns (uint256) {
        return UNRIPE_LP_PER_DOLLAR;
    }

    function dollarPerUnripeLP() internal pure returns (uint256) {
        return 1e12 / UNRIPE_LP_PER_DOLLAR;
    }

    function exploitAddLPRatio() internal pure returns (uint256) {
        return ADD_LP_RATIO;
    }

    function precision() internal pure returns (uint256) {
        return PRECISION;
    }

    function pipeline() internal pure returns (IPipeline) {
        return IPipeline(PIPELINE);
    }
}
