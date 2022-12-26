/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../seraph/SeraphProtected.sol";

/**
 * @author Publius
 * @title Init Verify Seraph
**/
contract InitVerifySeraph is SeraphProtected {

    function init() external withSeraph {}

}