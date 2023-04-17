/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../AppStorageOld.sol";
import "../../../C.sol";
import "../../../tokens/ERC20/BeanstalkERC20.sol";
import "../../../libraries/Silo/LibSilo.sol";
import "../../../libraries/Silo/LibTokenSilo.sol";

/**
 * @author Publius
 * @title Replant7 Migrates the Silo. It deposits Earned Beans, sets the Pruned Stalk, Seed and Root
 * balances for each Farmer as well as the total values.
 * ------------------------------------------------------------------------------------
 **/

contract Replant7 {

    AppStorageOld internal s;

    using SafeMath for uint256;

    uint32 private constant REPLANT_SEASON = 6074;
    uint256 private constant ROOTS_PADDING = 1e12;

    struct Earned {
        address account;
        uint256 earnedBeans;
        uint256 stalk;
        uint256 seeds;
    }

    event SeedsBalanceChanged(
        address indexed account,
        int256 delta
    );

    event StalkBalanceChanged(
        address indexed account,
        int256 delta,
        int256 deltaRoots
    );

    function init(Earned[] calldata earned) external {
        for (uint256 i; i < earned.length; ++i) {
            uint256 earnedBeans = earned[i].earnedBeans;
            address account = earned[i].account;
            s.a[account].lastUpdate = s.season.current;
            LibTokenSilo.addDepositToAccount(
                account,
                C.UNRIPE_BEAN,
                REPLANT_SEASON,
                earned[i].earnedBeans,
                earnedBeans.mul(C.initialRecap()).div(1e18)
            );

            prune(earned[i]);
        }
    }

    function prune(Earned calldata e) private {
        s.a[e.account].s.stalk = e.stalk;
        s.a[e.account].s.seeds = e.seeds;
        s.a[e.account].roots = s.a[e.account].s.stalk.mul(ROOTS_PADDING);

        emit SeedsBalanceChanged(
            e.account,
            int256(s.a[e.account].s.seeds)
        );

        emit StalkBalanceChanged(
            e.account,
            int256(s.a[e.account].s.stalk),
            int256(s.a[e.account].roots)
        );
    }

    function init2(uint256 stalk, uint256 seeds) external {
        s.earnedBeans = 0;
        s.s.seeds = seeds;
        s.s.stalk = stalk;
        s.s.roots = stalk.mul(ROOTS_PADDING);
    }
}
