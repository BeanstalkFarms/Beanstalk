/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {InitializeDiamond} from "contracts/beanstalk/init/InitializeDiamond.sol";
import {C} from "contracts/C.sol";
import {LibConstant} from "test/foundry/utils/LibConstant.sol";
import {IBean} from "contracts/interfaces/IBean.sol";

/**
 * @author Publius, Brean
 * @title InitDiamond
 * @notice InitDiamond initializes the Beanstalk Diamond.
 * A new bean token and bean:TOKEN well are deployed.
 *
 **/
contract InitDiamond is InitializeDiamond {
    // initial reward for deploying beanstalk.
    uint256 constant INIT_SUPPLY = 100e6;

    function init() external {
        initializeDiamond(LibConstant.BEAN, LibConstant.BEAN_ETH_WELL);

        IBean(LibConstant.BEAN).mint(msg.sender, INIT_SUPPLY);
    }
}
