/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./Silo.sol";
import "../../ReentrancyGuard.sol";
import "../../../libraries/Silo/LibDelegate.sol";

/*
 * @author Publius
 * @title DelegateFacet handles delegating authority for Beanstalk functions.
 */
contract DelegateFacet is Silo {
    mapping(bytes4 => bool) public selectorEnabled;

    bytes4 public constant PLANT_DELEGATED_SELECTOR =
        bytes4(keccak256(bytes("plantDelegated(address)")));

    constructor() {
        selectorEnabled[PLANT_DELEGATED_SELECTOR] = true;
    }

    /**
     * @notice delegateApproval sets approval value for delegation
     * @param selector function selector
     * @param delegatee contract/EOA address to delegate to
     * @param approval approval value bytes32 of uint256 or bool
     */
    function delegateApproval(
        bytes4 selector,
        address delegatee,
        bytes32 approval
    ) external {
        require(
            selectorEnabled[selector],
            "DelegateFacet: invalid function selector"
        );
        LibDelegate.setAllowance(msg.sender, selector, delegatee, approval);
    }

    /**
     * @notice plant on behalf of account
     * @param account user address
     */
    function plantDelegated(address account)
        external
        payable
        returns (uint256 beans, uint256 allowance)
    {
        allowance = LibDelegate.getAllowance(
            account,
            PLANT_DELEGATED_SELECTOR,
            msg.sender
        );
        if (allowance == 0) revert("DelegateFacet: unauthorized");

        beans = _plant(account);
        if (allowance < beans) revert("DelegateFacet: not enough allowance");
        allowance -= beans;

        LibDelegate.spendAllowance(
            account,
            PLANT_DELEGATED_SELECTOR,
            msg.sender,
            beans
        );
    }
}
