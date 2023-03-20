/**
 * SPDX-License-Identifier: MIT
 *
 */

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {Call} from "@wells/interfaces/IWell.sol";
import {MockToken} from "../MockToken.sol";

/**
 * @title Mock Well
 */

contract MockSetComponentsWell is MockToken {

    constructor() MockToken("Mock Well", "MWELL") {}

    Call[] public _pumps;
    Call public _wellFunction;

    function pumps() external view returns (Call[] memory) {
        return _pumps;
    }

    function wellFunction() external view returns (Call memory) {
        return _wellFunction;
    }

    function setPumps(Call[] memory __pumps) external {
        delete _pumps;
        for (uint i = 0; i < __pumps.length; i++) {
            _pumps.push(__pumps[i]);
        }
    }

    function setWellFunction(Call memory __wellFunction) external {
        _wellFunction = __wellFunction;
    }
}
