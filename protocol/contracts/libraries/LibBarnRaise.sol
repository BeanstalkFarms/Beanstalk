// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {IWell} from "contracts/interfaces/basin/IWell.sol";
import {C} from "contracts/C.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AppStorage, LibAppStorage} from "contracts/libraries/LibAppStorage.sol";

import "hardhat/console.sol";


/**
 * @title LibBarnRaise
 * @author Brendan
 * @notice Library fetching Barn Raise Token
 */
library LibBarnRaise {

    function getBarnRaiseToken() internal view returns (address) {
        IERC20[] memory tokens = IWell(getBarnRaiseWell()).tokens();
        return address(address(tokens[0]) == C.BEAN ? tokens[1] : tokens[0]);
    }

    function getBarnRaiseWell() internal view returns (address) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.barnRaiseWell == address(0) ? C.BEAN_ETH_WELL : s.barnRaiseWell;
    }
}
