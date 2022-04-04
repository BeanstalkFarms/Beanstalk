/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../farm/AppStorage.sol";

/**
 * @author Publius
 * @title App Storage Library allows libaries to access Beanstalk's state.
**/
library LibAppStorage {

    function diamondStorage() internal pure returns (AppStorage storage ds) {
        assembly {
            ds.slot := 0
        }
    }

}
