/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {IBean} from "contracts/interfaces/IBean.sol";

/**
 * @author Publius
 * @title InitMint mints Beans
 **/
contract InitMint {
    function init(address bean, address payee, uint256 amount) external {
        IBean(bean).mint(payee, amount);
    }
}
