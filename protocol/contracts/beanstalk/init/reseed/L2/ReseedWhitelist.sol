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
        Implementation[] calldata oracle
    ) external {
        for (uint i; i < tokens.length; i++) {
            address token = tokens[i];
            AssetSettings storage ss = s.sys.silo.assetSettings[token];
            // If an LP token, initialize oracle storage variables.
            if (token != address(C.bean()) && !LibUnripe.isUnripe(token)) {
                s.sys.usdTokenPrice[token] = 1;
                s.sys.twaReserves[token].reserve0 = 1;
                s.sys.twaReserves[token].reserve1 = 1;
            }
            AssetSettings memory asset = assets[i];
            assembly {
                // set the asset settings for the token
                ss.slot := asset
            }
            // the Oracle should return the price for the non-bean asset in USD
            s.sys.oracleImplementation[token] = oracle[i];
        }
    }
}
