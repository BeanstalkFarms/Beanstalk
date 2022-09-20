/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../../C.sol";
import "../LibAppStorage.sol";

/**
 * @author Publius
 * @title Lib Delegate
 **/
library LibDelegate {
    using SafeMath for uint256;

    /**
     * Delegate
     **/

    function getAllowance(
        address account,
        bytes4 selector,
        address spender
    ) internal view returns (uint256 allowance) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        allowance = uint256(s.a[account].functionApprovals[selector][spender]);
    }

    function setAllowance(
        address account,
        bytes4 selector,
        address delegatee,
        bytes32 approval
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.a[account].functionApprovals[selector][delegatee] = approval;
    }

    function spendAllowance(
        address account,
        bytes4 selector,
        address spender,
        uint256 beans
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 allowance = uint256(
            s.a[account].functionApprovals[selector][spender]
        );
        s.a[account].functionApprovals[selector][spender] = bytes32(
            allowance.sub(beans)
        );
    }
}
