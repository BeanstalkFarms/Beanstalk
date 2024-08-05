/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {Implementation} from "contracts/beanstalk/storage/System.sol";
import {LibUnripe} from "contracts/libraries/LibUnripe.sol";
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
    function init(
        address[] calldata tokens,
        AssetSettings[] calldata assets,
        WhitelistStatus[] calldata whitelistStatus
        Implementation[] calldata oracle
    ) external {
        for (uint i; i < tokens.length; i++) {
            address token = tokens[i];
            // If an LP token, initialize oracle storage variables.
            if (token != address(C.bean()) && !LibUnripe.isUnripe(token)) {
                s.sys.usdTokenPrice[token] = 1;
                s.sys.twaReserves[token].reserve0 = 1;
                s.sys.twaReserves[token].reserve1 = 1;
            }
            s.sys.silo.assetSettings[token] = assets[i];
            
            // add whitelist status
            s.sys.silo.whitelistStatus.push(whitelistStatus[i]);
            // the Oracle should return the price for the non-bean asset in USD
            s.sys.oracleImplementation[token] = oracle[i];
        }
    }
}
