// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {IWell} from "contracts/interfaces/basin/IWell.sol";
import {C} from "contracts/C.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AppStorage, LibAppStorage} from "contracts/libraries/LibAppStorage.sol";

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
        return
            s.sys.silo.unripeSettings[C.UNRIPE_LP].underlyingToken == address(0)
                ? C.BEAN_ETH_WELL
                : s.sys.silo.unripeSettings[C.UNRIPE_LP].underlyingToken;
    }
}
