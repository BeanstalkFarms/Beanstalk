/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage, Storage} from "contracts/beanstalk/AppStorage.sol";
import {LibWhitelist} from "contracts/libraries/Silo/LibWhitelist.sol";
import {C} from "contracts/C.sol";

/**
 * @author Brean
 * @notice ReseedWhitelist whitelists various silo assets.
 * @dev assets that may be whitelisted are dependent on the DAO.
 */
contract ReseedWhitelist {
    AppStorage internal s;

    /**
     * @notice whitelists silo assets
     */
    function init(address[] calldata tokens, Storage.SiloSettings[] calldata ss) external {
        for (uint i; i < tokens.length; i++) {
            LibWhitelist.whitelistToken(
                tokens[i],
                ss[i].selector,
                ss[i].stalkIssuedPerBdv,
                ss[i].stalkEarnedPerSeason,
                ss[i].encodeType,
                ss[i].gpSelector,
                ss[i].lwSelector,
                ss[i].gaugePoints,
                ss[i].optimalPercentDepositedBdv
            );
        }
    }
}
