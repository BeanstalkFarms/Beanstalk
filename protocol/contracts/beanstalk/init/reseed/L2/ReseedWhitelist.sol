/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {Implementation, WhitelistStatus, AssetSettings} from "contracts/beanstalk/storage/System.sol";
import {LibUnripe} from "contracts/libraries/LibUnripe.sol";
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
    function init(
        address[] calldata tokens,
        address[] calldata nonBeanTokens,
        AssetSettings[] calldata assets,
        WhitelistStatus[] calldata whitelistStatus,
        Implementation[] calldata oracle
    ) external {
        for (uint i; i < tokens.length; i++) {
            address token = tokens[i];
            address nonBeanToken = nonBeanTokens[i];
            // If an LP token, initialize oracle storage variables.
            if (token != address(s.sys.tokens.bean) && !LibUnripe.isUnripe(token)) {
                s.sys.usdTokenPrice[token] = 1;
                s.sys.twaReserves[token].reserve0 = 1;
                s.sys.twaReserves[token].reserve1 = 1;
            }
            // add asset settings for the underlying lp token
            s.sys.silo.assetSettings[token] = assets[i];

            // add whitelist status
            s.sys.silo.whitelistStatuses.push(whitelistStatus[i]);
            // the Oracle should return the price for the non-bean asset in USD
            s.sys.oracleImplementation[nonBeanToken] = oracle[i];
        }
    }
}
