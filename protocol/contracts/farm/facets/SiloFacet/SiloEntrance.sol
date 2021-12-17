/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../../libraries/LibCheck.sol";
import "../../../libraries/LibInternal.sol";
import "../../../libraries/LibMarket.sol";
import "../../../libraries/Decimal.sol";
import "../../../C.sol";

/**
 * @author Publius
 * @title Silo Entrance
**/
contract SiloEntrance {

    using SafeMath for uint256;
    using Decimal for Decimal.D256;

    AppStorage internal s;

    event BeanDeposit(address indexed account, uint256 season, uint256 beans);

    /**
     * Silo
    **/

    function depositSiloAssets(address account, uint256 seeds, uint256 stalk) internal {
        incrementBalanceOfStalk(account, stalk);
        incrementBalanceOfSeeds(account, seeds);
    }

    function incrementBalanceOfSeeds(address account, uint256 seeds) internal {
        s.s.seeds = s.s.seeds.add(seeds);
        s.a[account].s.seeds = s.a[account].s.seeds.add(seeds);
    }

    function incrementBalanceOfStalk(address account, uint256 stalk) internal {
        uint256 roots;
        if (s.s.roots == 0) roots = stalk.mul(C.getRootsBase());
        else roots = s.s.roots.mul(stalk).div(s.s.stalk);

        s.s.stalk = s.s.stalk.add(stalk);
        s.a[account].s.stalk = s.a[account].s.stalk.add(stalk);

        s.s.roots = s.s.roots.add(roots);
        s.a[account].roots = s.a[account].roots.add(roots);

        incrementBipRoots(account, roots);
    }

    function withdrawSiloAssets(address account, uint256 seeds, uint256 stalk) internal {
        decrementBalanceOfStalk(account, stalk);
        decrementBalanceOfSeeds(account, seeds);
    }

    function decrementBalanceOfSeeds(address account, uint256 seeds) internal {
        s.s.seeds = s.s.seeds.sub(seeds);
        s.a[account].s.seeds = s.a[account].s.seeds.sub(seeds);
    }

    function decrementBalanceOfStalk(address account, uint256 stalk) internal {
        if (stalk == 0) return;
        uint256 roots = s.a[account].roots.mul(stalk).sub(1).div(s.a[account].s.stalk).add(1);

        s.s.stalk = s.s.stalk.sub(stalk);
        s.a[account].s.stalk = s.a[account].s.stalk.sub(stalk);

        s.s.roots = s.s.roots.sub(roots);
        s.a[account].roots = s.a[account].roots.sub(roots);

        decrementBipRoots(account, roots);
    }

    function addBeanDeposit(address account, uint32 _s, uint256 amount) internal {
        s.a[account].bean.deposits[_s] += amount;
        emit BeanDeposit(account, _s, amount);
    }

    function incrementDepositedBeans(uint256 amount) internal {
        s.bean.deposited = s.bean.deposited.add(amount);
    }

    function updateBalanceOfRainStalk(address account) internal {
        if (!s.r.raining) return;
        if (s.a[account].roots < s.a[account].sop.roots) {
            s.r.roots = s.r.roots.sub(s.a[account].sop.roots.sub(s.a[account].roots));
            s.a[account].sop.roots = s.a[account].roots;
        }
    }

    function incrementBipRoots(address account, uint256 roots) internal {
        if (s.a[account].votedUntil >= season()) {
            for (uint256 i = 0; i < s.g.activeBips.length; i++) {
                uint32 bip = s.g.activeBips[i];
                if (s.g.voted[bip][account]) s.g.bips[bip].roots = s.g.bips[bip].roots.add(roots);
            }
        }
    }

    /// @notice Decrements the given amount of roots from bips that have been voted on by a given account and
    /// checks whether the account is a proposer and if he/she are then they need to have the min roots required
    /// @param account The address of the account to have their bip roots decremented
    /// @param roots The amount of roots for the given account to be decremented from
    function decrementBipRoots(address account, uint256 roots) internal {
        if (s.a[account].votedUntil >= season()) {
            require(
                s.a[account].proposedUntil < season() || canPropose(account),
                "Proposer must have the min amount left in the BIP"
            );
            for (uint256 i = 0; i < s.g.activeBips.length; i++) {
                uint32 bip = s.g.activeBips[i];
                if (s.g.voted[bip][account]) s.g.bips[bip].roots = s.g.bips[bip].roots.sub(roots);
            }
        }
    }

    /// @notice Checks whether the account have the min roots required for a BIP
    /// @param account The address of the account to check roots balance
    function canPropose(address account) internal view returns (bool) {
        if (s.s.roots == 0 || s.a[account].roots == 0) {
            return false;
        }
        Decimal.D256 memory stake = Decimal.ratio(s.a[account].roots, s.s.roots);
        return stake.greaterThan(C.getGovernanceProposalThreshold());
    }

    /**
     * Shed
    **/

    function reserves() internal view returns (uint256, uint256) {
        (uint112 reserve0, uint112 reserve1,) = pair().getReserves();
        return (index() == 0 ? reserve1 : reserve0,index() == 0 ? reserve0 : reserve1);
    }

    function lpToLPBeans(uint256 amount) internal view returns (uint256) {
        (,uint256 beanReserve) = reserves();
        return amount.mul(beanReserve).mul(2).div(pair().totalSupply());
    }

    function stalkReward(uint256 seeds, uint32 seasons) internal pure returns (uint256) {
        return seeds.mul(seasons);
    }

    function season() internal view returns (uint32) {
        return s.season.current;
    }

    /**
     * Contracts
    **/

    function index() internal view returns (uint8) {
        return s.index;
    }

    function pair() internal view returns (IUniswapV2Pair) {
        return IUniswapV2Pair(s.c.pair);
    }

    function bean() internal view returns (IBean) {
        return IBean(s.c.bean);
    }
}
