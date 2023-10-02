/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibDiamond} from "contracts/libraries/LibDiamond.sol";
import {LibGauge} from "contracts/libraries/LibGauge.sol";

/**
 * @title GaugeFacet
 * @author Brean
 * @notice Steps the gauge system for beanstalk. 
 * @dev Seperated from the season facet due to size constraints. 
 * GaugeFacet calls {LibGauge.stepGauge}, which does two things:
 * 1) updates the gauge points for LP assets.
 * 2) updates the Grown Stalk Earned Per Season for whitelisted assets 
 * (excluding unripe assets), if applicable.
 */
contract GaugeFacet {
    
    /**
     * @notice Steps the gauge system.
     */
    function stepGauge() external {
        LibDiamond.enforceIsOwnerOrContract();
        LibGauge.stepGauge();
    }
}
