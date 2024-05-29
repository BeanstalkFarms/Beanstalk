/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {MathJunction} from "./MathJunction.sol";
import {LogicJunction} from "./LogicJunction.sol";

contract Junction is MathJunction, LogicJunction {
    function check(bool condition) public pure {
        require(condition, "Junction: check failed");
    }
}
