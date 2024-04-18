/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;

import {MathJunction} from "./MathJunction.sol";
import {LogicJunction} from "./LogicJunction.sol";

contract Junction is MathJunction, LogicJunction {
    function check(bool condition) public pure {
        require(condition, "Junction: check failed");
    }
}
