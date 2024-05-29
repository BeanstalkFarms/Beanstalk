/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {C} from "contracts/C.sol";

/**
 * @author Brean
 * @notice Reseed re-initializes the Internal Balance of Farmers.
 * @dev non Bean assets cannot be transfered to L2, due to the lack of garentee of the asset's Liquidity.
 */
contract ReseedInternalBalances {
    AppStorage internal s;
    event InternalBalanceChanged(address indexed user, IERC20 indexed token, int256 delta);

    struct BeanstalkInternalBalance {
        address token;
        address[] farmers;
        uint256[] balances;
        uint256 totalInternalBalance;
    }

    function init(
        BeanstalkInternalBalance calldata beanBalances,
        BeanstalkInternalBalance calldata beanEthBalances,
        BeanstalkInternalBalance calldata beanWstethBalances,
        BeanstalkInternalBalance calldata beanStableBalances,
        BeanstalkInternalBalance calldata urBeanBalances,
        BeanstalkInternalBalance calldata urBeanLpBalances
    ) external {
        setInternalBalances(beanBalances);
        setInternalBalances(beanEthBalances);
        setInternalBalances(beanWstethBalances);
        setInternalBalances(beanStableBalances);
        setInternalBalances(urBeanBalances);
        setInternalBalances(urBeanLpBalances);
    }

    function setInternalBalances(BeanstalkInternalBalance calldata internalBalances) internal {
        uint256 totalInternalBalance;
        for (uint i; i < internalBalances.farmers.length; i++) {
            s.accts[internalBalances.farmers[i]].internalTokenBalance[
                IERC20(internalBalances.token)
            ] = internalBalances.balances[i];
            totalInternalBalance += internalBalances.balances[i];
            emit InternalBalanceChanged(
                internalBalances.farmers[i],
                IERC20(internalBalances.token),
                int256(internalBalances.balances[i])
            );
        }

        require(
            totalInternalBalance == internalBalances.totalInternalBalance,
            "ReseedInternalBalances: totalInternalBalance mismatch"
        );

        s.sys.internalTokenBalanceTotal[IERC20(internalBalances.token)] = totalInternalBalance;
    }
}
