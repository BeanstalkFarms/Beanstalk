/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../AppStorage.sol";
import "../../../C.sol";

/**
 * @author Publius
 * @title Replant5 Redeposits all existing Bean Deposits as Unripe Bean Deposits
 * ------------------------------------------------------------------------------------
 **/
contract Replant5 {
    AppStorage internal s;

    using SafeMath for uint256;

    event BeanRemove(
        address indexed account,
        uint32[] crates,
        uint256[] crateBeans,
        uint256 beans
    );

    event AddDeposit(
        address indexed account,
        address indexed token,
        uint32 season,
        uint256 amounts,
        uint256 bdv
    );

    struct V1Deposit {
        address account;
        uint32[] seasons;
        uint256[] amounts;
        uint256 amount;
    }

    function init(V1Deposit[] calldata beanDeposits) external {
        updateBeanDeposits(beanDeposits);
    }

    function updateBeanDeposits(V1Deposit[] calldata ds) private {
        for (uint256 i; i < ds.length; ++i) {
            V1Deposit calldata d = ds[i];
            emit BeanRemove(d.account, d.seasons, d.amounts, d.amount);

            for (uint256 j; j < d.seasons.length; ++j) {
                emit AddDeposit(
                    d.account,
                    C.UNRIPE_BEAN,
                    d.seasons[j],
                    d.amounts[j],
                    d.amounts[j].mul(C.initialRecap()).div(C.precision())
                );
            }
        }
    }
}
