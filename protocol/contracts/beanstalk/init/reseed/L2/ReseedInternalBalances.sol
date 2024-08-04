/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {C} from "contracts/C.sol";

/**
 * @author Brean, Deadmanwalking
 * @notice Reseed re-initializes the Internal Balance of Farmers.
 * @dev non Bean assets cannot be transfered to L2, due to the lack of garentee of the asset's Liquidity.
 */
contract ReseedInternalBalances {
    AppStorage internal s;
    event InternalBalanceMigrated(address indexed user, IERC20 indexed token, int256 delta);

    struct BeanstalkInternalBalance {
        address farmer;
        address token;
        uint256 balance;
    }

    /**
    * @notice Re-initializes the internal balances of farmers. 
    * @param internalBalances the internal balances for each farmer
    * @dev Receives an array of balances, from any token to any farmer and sets the internal balance.
    * On migration, we just split the array to stay under gas limits. 
    */
    function init(
        BeanstalkInternalBalance[] calldata internalBalances
    ) external {
        setInternalBalances(internalBalances);
    }

    function setInternalBalances(BeanstalkInternalBalance[] calldata internalBalances) internal {
        for (uint i; i < internalBalances.length; i++) {
            s.accts[internalBalances[i].farmer].internalTokenBalance[
                IERC20(internalBalances[i].token)
            ] = internalBalances[i].balance;
            emit InternalBalanceMigrated(
                internalBalances[i].farmer,
                IERC20(internalBalances[i].token),
                int256(internalBalances[i].balance)
            );
        }
    }
}
