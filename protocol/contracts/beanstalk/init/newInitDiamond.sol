/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {InitalizeDiamond} from "contracts/beanstalk/init/InitalizeDiamond.sol";
import {C} from "contracts/C.sol";

/**
 * @author Publius, Brean
 * @title InitDiamond
 * @notice InitDiamond initializes the Beanstalk Diamond.
 * A new bean token and bean:TOKEN well are deployed.
 *
 **/
contract InitDiamond is InitalizeDiamond {
    // initial reward for deploying beanstalk.
    uint256 constant INIT_SUPPLY = 100e6;

    function init() external {
        initalizeDiamond(C.BEAN, C.BEAN_ETH_WELL);

        C.bean().mint(msg.sender, INIT_SUPPLY);
    }
}
