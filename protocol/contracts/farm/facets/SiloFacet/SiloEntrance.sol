/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../../libraries/LibCheck.sol";
import "../../../libraries/LibInternal.sol";
import "../../../libraries/LibMarket.sol";
import "../../../libraries/Decimal.sol";
import "../../../libraries/LibStalk.sol";
import "../../../C.sol";
import "../../../interfaces/ISeed.sol";

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


    struct Settings {
	    uint256 unwrap_seeds;
	    uint256 unwrap_stalk;
	    bool update;
    }


    function depositSiloAssets(address account, uint256 seeds, uint256 stalk) internal {
        incrementBalanceOfStalk(account, stalk);
        incrementBalanceOfSeeds(account, seeds);
    }

    function incrementBalanceOfSeeds(address account, uint256 seeds) internal {
        seed().mint(address(this), seeds);
	s.a[account].s.seeds = s.a[account].s.seeds.add(seeds);
	s.s.seeds = s.s.seeds.add(seeds);
    }

    /// @notice mints the corresponding amount of stalk ERC-20 tokens to the selected account address
    /// @param account The address of the account address to have minted stalk tokens to
    /// @param stalk The amount of stalk tokens to have minted
    function incrementBalanceOfStalk(address account, uint256 stalk) internal {
        uint256 roots;
        if (s.s.roots == 0) roots = stalk.mul(C.getRootsBase());
        else roots = s.s.roots.mul(stalk).div(s.stalkToken._totalSupply);

        LibStalk._mint(address(this), stalk);
        // Mint Stalk ERC-20
        s.a[account].s.stalk = s.a[account].s.stalk.add(stalk);
	s.s.stalk = s.s.stalk.add(stalk);

        s.s.roots = s.s.roots.add(roots);
        s.a[account].roots = s.a[account].roots.add(roots);

        incrementBipRoots(account, roots);
    }

    function withdrawSiloAssets(address account, uint256 seeds, uint256 stalk) internal {
        decrementBalanceOfStalk(account, stalk);
        decrementBalanceOfSeeds(account, seeds);
    }

    function decrementBalanceOfSeeds(address account, uint256 seeds) internal {
	if (s.a[account].s.seeds >= seeds) {
		s.a[account].s.seeds = s.a[account].s.seeds.sub(seeds);
		s.s.seeds = s.s.seeds.sub(seeds);
		seed().burn(seeds);
	}
	else {	
	        seed().burnFrom(account, seeds.sub(s.a[account].s.seeds));
		s.a[account].s.seeds = 0;
	}
    }

    /// @notice burns the corresponding amount of stalk ERC-20 tokens of the selected account address
    /// @param account The address of the account address to have stalk and seed tokens withdrawn and burned
    /// @param stalk The amount of stalk tokens to have withdrawn and burned
    function decrementBalanceOfStalk(address account, uint256 stalk) internal {
        // Remove all Legacy Stalk and Mint the corresponding fungible token
        if (stalk == 0) return;
        uint256 roots = s.a[account].roots.mul(stalk).sub(1).div(s.a[account].s.stalk).add(1);
        // Burn Stalk ERC-20
	if (s.a[account].s.stalk >= stalk) {
		s.a[account].s.stalk = s.a[account].s.stalk.sub(stalk);
		s.s.stalk = s.s.stalk.sub(stalk);
		LibStalk._burn(address(this), stalk);
	}
	else {
		LibStalk._burn(account, stalk.sub(s.a[account].s.stalk));
		s.s.stalk = s.s.stalk.sub(stalk);
                LibStalk._burn(address(this), s.a[account].s.stalk);
		s.a[account].s.stalk = 0;
	}

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

    /// @notice Examines whether a given account has voted for a BIP
    /// @param account The address for the modifier to check if they have voted
    modifier hasVoted(address account) {
        require(!(locked(account)),"locked");
        _;
    }

    function updateBalanceOfRainStalk(address account) internal {
        if (!s.r.raining) return;
        if (s.a[account].roots < s.a[account].sop.roots) {
            s.r.roots = s.r.roots.sub(s.a[account].sop.roots.sub(s.a[account].roots));
            s.a[account].sop.roots = s.a[account].roots;
        }
    }

    function incrementBipRoots(address account, uint256 roots) internal {
        if (s.a[account].lockedUntil >= season()) {
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
        if (s.a[account].lockedUntil >= season()) {
            for (uint256 i = 0; i < s.g.activeBips.length; i++) {
                uint32 bip = s.g.activeBips[i];
                if (s.g.voted[bip][account]) s.g.bips[bip].roots = s.g.bips[bip].roots.sub(roots);
            }
            if (s.a[account].proposedUntil >= season()) {
                require(canPropose(account),  "Proposer must have the min amount left in the BIP");
            }
        }
    }

    /// @notice Checks whether the account have the min roots required for a BIP
    /// @param account The address of the account to check roots balance
    function canPropose(address account) internal view returns (bool) {
        if (totalRoots() == 0 || balanceOfRoots(account) == 0) {
            return false;
        }
        Decimal.D256 memory stake = Decimal.ratio(balanceOfRoots(account), totalRoots());
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

    function seed() internal view returns (ISeed) {
	return ISeed(s.seedContract);
    }
}
