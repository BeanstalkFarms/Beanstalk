/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import "../../C.sol";

/**
 * @author Publius
 * @title InitMint mints Beans
 **/
contract InitMint {
    function init(address payee, uint256 amount) external {
        C.bean().mint(payee, amount);
    }
}
