/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {LibWhitelist} from "contracts/libraries/Silo/LibWhitelist.sol";
import {AssetSettings} from "contracts/beanstalk/storage/System.sol";
import {C} from "contracts/C.sol";

/**
 * @author Brean
 * @notice ReseedWhitelist Whitelists various Silo assets.
 * @dev assets that may be Whitelists are dependent on the DAO.
 */
contract ReseedWhitelist {
    AppStorage internal s;

    /**
     * @notice Whitelists Silo assets
     */
    function init(address[] calldata tokens, AssetSettings[] calldata asset) external {
        for (uint i; i < tokens.length; i++) {
            LibWhitelist.whitelistToken(
                tokens[i],
                asset[i].selector,
                asset[i].stalkIssuedPerBdv,
                asset[i].stalkEarnedPerSeason,
                asset[i].encodeType,
                asset[i].gaugePointImplementation.selector,
                asset[i].liquidityWeightImplementation.selector,
                asset[i].gaugePoints,
                asset[i].optimalPercentDepositedBdv,
                asset[i].oracleImplementation
            );
        }
    }
}
