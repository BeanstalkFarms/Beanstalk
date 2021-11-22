/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {IBean} from "../../interfaces/IBean.sol";

/**
 * @author Publius
 * @title InitBip4 runs the code for BIP-4.
**/

interface IBS {
    function createFundraiser(address fundraiser, address token, uint256 amount) external;
}

contract InitFundraiser {
    
    function init(address fundraiser, address token, uint256 amount) external {
        IBS(address(this)).createFundraiser(fundraiser, token, amount);
    }
}