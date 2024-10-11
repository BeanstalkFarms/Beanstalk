/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {InitalizeDiamond} from "contracts/beanstalk/init/InitalizeDiamond.sol";
import {BeanstalkERC20} from "contracts/tokens/ERC20/BeanstalkERC20.sol";

/**
 * @author Publius, Brean
 * @title InitDiamond
 * @notice InitDiamond initializes the Beanstalk Diamond.
 * A new bean token and bean:TOKEN well are deployed.
 *
 **/
contract InitDiamond is InitalizeDiamond {
    // Tokens
    address internal constant BEAN = address(0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab);
    address internal constant BEAN_ETH_WELL = address(0xBEA0e11282e2bB5893bEcE110cF199501e872bAd);

    // initial reward for deploying beanstalk.
    uint256 internal constant INIT_SUPPLY = 100e6;

    function init() external {
        initalizeDiamond(BEAN, BEAN_ETH_WELL);

        BeanstalkERC20(BEAN).mint(msg.sender, INIT_SUPPLY);
    }
}
