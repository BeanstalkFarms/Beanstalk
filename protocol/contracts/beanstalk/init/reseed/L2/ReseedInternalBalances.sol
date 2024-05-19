/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/AppStorage.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {C} from "contracts/C.sol";

/**
 * @author Brean
 * @notice Reseed re-initializes the internal balance of farmers.
 * @dev non bean assets cannot be transfered to L2, due to the lack of garentee of the asset's Liquidity.
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
        BeanstalkInternalBalance calldata beanStableBalances
    ) external {
        setBeanInternalBalances(beanBalances);
        setBeanEthInternalBalances(beanEthBalances);
        setBeanWstethInternalBalances(beanWstethBalances);
        setBeanStableInternalBalances(beanStableBalances);
    }

    function setBeanInternalBalances(BeanstalkInternalBalance calldata beanBalances) internal {
        uint256 totalInternalBalance;
        for (uint i; i < beanBalances.farmers.length; i++) {
            s.internalTokenBalance[beanBalances.farmers[i]][
                IERC20(beanBalances.token)
            ] = beanBalances.balances[i];
            totalInternalBalance += beanBalances.balances[i];
            emit InternalBalanceChanged(
                beanBalances.farmers[i],
                IERC20(beanBalances.token),
                int256(beanBalances.balances[i])
            );
        }

        require(
            totalInternalBalance == beanBalances.totalInternalBalance,
            "ReseedInternalBalances: totalInternalBalance mismatch"
        );

        s.internalTokenBalanceTotal[IERC20(beanBalances.token)] = totalInternalBalance;
    }

    function setBeanEthInternalBalances(
        BeanstalkInternalBalance calldata beanEthBalances
    ) internal {
        uint256 totalInternalBalance;
        for (uint i; i < beanEthBalances.farmers.length; i++) {
            s.internalTokenBalance[beanEthBalances.farmers[i]][
                IERC20(beanEthBalances.token)
            ] = beanEthBalances.balances[i];
            totalInternalBalance += beanEthBalances.balances[i];
            emit InternalBalanceChanged(
                beanEthBalances.farmers[i],
                IERC20(beanEthBalances.token),
                int256(beanEthBalances.balances[i])
            );
        }
    }

    function setBeanWstethInternalBalances(
        BeanstalkInternalBalance calldata beanWstethBalances
    ) internal {
        uint256 totalInternalBalance;
        for (uint i; i < beanWstethBalances.farmers.length; i++) {
            s.internalTokenBalance[beanWstethBalances.farmers[i]][
                IERC20(beanWstethBalances.token)
            ] = beanWstethBalances.balances[i];
            totalInternalBalance += beanWstethBalances.balances[i];
            emit InternalBalanceChanged(
                beanWstethBalances.farmers[i],
                IERC20(beanWstethBalances.token),
                int256(beanWstethBalances.balances[i])
            );
        }
    }

    function setBeanStableInternalBalances(
        BeanstalkInternalBalance calldata beanStableBalances
    ) internal {
        uint256 totalInternalBalance;
        for (uint i; i < beanStableBalances.farmers.length; i++) {
            s.internalTokenBalance[beanStableBalances.farmers[i]][
                IERC20(beanStableBalances.token)
            ] = beanStableBalances.balances[i];
            totalInternalBalance += beanStableBalances.balances[i];
            emit InternalBalanceChanged(
                beanStableBalances.farmers[i],
                IERC20(beanStableBalances.token),
                int256(beanStableBalances.balances[i])
            );
        }
    }
}
