/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {BeanstalkERC20} from "contracts/tokens/ERC20/BeanstalkERC20.sol";
import {LibAppStorage, AppStorage} from "contracts/libraries/LibAppStorage.sol";

/**
 * @title Minting Library
 * @notice Contains Helper Fucntions for Minting related functionality.
 **/
library LibMinting {
    using LibRedundantMath256 for uint256;

    uint256 private constant MAX_DELTA_B_DENOMINATOR = 100;

    function checkForMaxDeltaB(int256 deltaB) internal view returns (int256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        int256 maxDeltaB = int256(
            BeanstalkERC20(s.sys.tokens.bean).totalSupply().div(MAX_DELTA_B_DENOMINATOR)
        );
        if (deltaB < 0) return deltaB > -maxDeltaB ? deltaB : -maxDeltaB;
        return deltaB < maxDeltaB ? deltaB : maxDeltaB;
    }
}
