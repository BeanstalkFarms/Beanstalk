/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibAppStorage} from "contracts/libraries/LibAppStorage.sol";
import {C} from "contracts/C.sol";

/**
 * @author Publius
 * @title InitTurnOffBeanEthWell turns off the Bean:Eth Well
**/

contract InitTurnOffBeanEthWell {

    function init() external {
        delete LibAppStorage.diamondStorage().wellOracleSnapshots[C.BEAN_ETH_WELL];
    }

}