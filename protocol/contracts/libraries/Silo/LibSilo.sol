/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "../../C.sol";
import "../LibAppStorage.sol";
import "../LibStalk.sol";
import "../../interfaces/ISeed.sol";
import "../LibUserBalance.sol";

/**
 * @author Publius
 * @title Lib Silo
**/
library LibSilo {

    using SafeMath for uint256;
    using Decimal for Decimal.D256;

    event BeanDeposit(address indexed account, uint256 season, uint256 beans);
    
    /**
     * Silo
    **/

    function depositSiloAssets(address account, uint256 seeds, uint256 stalk, bool toInternalBalance) internal {
        incrementBalanceOfStalk(account, stalk, toInternalBalance);
        incrementBalanceOfSeeds(account, seeds, toInternalBalance);
    }

    function withdrawSiloAssets(address account, uint256 seeds, uint256 stalk, bool fromInternalBalance) internal {
        decrementBalanceOfStalk(account, stalk, fromInternalBalance);
        decrementBalanceOfSeeds(account, seeds, fromInternalBalance);
    }

    function incrementBalanceOfSeeds(address account, uint256 seeds, bool toInternalBalance) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (toInternalBalance) {
            LibUserBalance._increaseInternalBalance(account, seed(), seeds);
            seed().mint(address(this), seeds);
        }
        else seed().mint(account, seeds);
    }

    /// @notice mints the corresponding amount of stalk ERC-20 tokens to the selected account address
    /// @param account The address of the account address to have minted stalk tokens to
    /// @param stalk The amount of stalk tokens to have minted
    function incrementBalanceOfStalk(address account, uint256 stalk, bool toInternalBalance) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 roots;
        if (s.s.roots == 0) roots = stalk.mul(C.getRootsBase());
        else roots = s.s.roots.mul(stalk).div(s.stalkToken.totalSupply);
        if (toInternalBalance) {
            LibStalk.mint(address(this), stalk);
            LibUserBalance._increaseInternalBalance(account, IERC20(address(this)), stalk);
        }
        else LibStalk.mint(account, stalk);
 
	    s.s.roots = s.s.roots.add(roots);
        s.a[account].roots = s.a[account].roots.add(roots);

        incrementBipRoots(account, roots);
    }

    function decrementBalanceOfSeeds(address account, uint256 seeds, bool fromInternalBalance) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        ISeed _seed = seed();
        if (fromInternalBalance) {
            uint256 internalSeeds = LibUserBalance._getInternalBalance(account, _seed);
            if (internalSeeds >= seeds) {
                LibUserBalance._decreaseInternalBalance(account, _seed, seeds, false);
                _seed.burn(seeds);
            } else {
                _seed.burnFrom(account, seeds.sub(internalSeeds));
                LibUserBalance._decreaseInternalBalance(account, _seed, internalSeeds, false);
                _seed.burn(internalSeeds);
            }
        } else {
            uint256 externalSeeds = _seed.balanceOf(account);
            if (externalSeeds >= seeds) _seed.burnFrom(account, seeds);
            else {
                LibUserBalance._decreaseInternalBalance(account, _seed, seeds.sub(externalSeeds), false);
                _seed.burn(seeds.sub(externalSeeds));
                _seed.burnFrom(account, externalSeeds);
            }
        }
    }

    /// @notice burns the corresponding amount of stalk ERC-20 tokens of the selected account address
    /// @param account The address of the account address to have stalk and seed tokens withdrawn and burned
    /// @param stalk The amount of stalk tokens to have withdrawn and burned
    function decrementBalanceOfStalk(address account, uint256 stalk, bool fromInternalBalance) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (stalk == 0) return;
        uint256 roots = stalk.mul(s.s.roots).div(s.s.stalk);
        IERC20 _stalk = IERC20(address(this));

        // Burn Stalk ERC-20
        if (fromInternalBalance) {
            uint256 internalStalk = LibUserBalance._getInternalBalance(account, _stalk);
            if (internalStalk >= stalk) {
                LibUserBalance._decreaseInternalBalance(account, _stalk, stalk, false);
                LibStalk.burn(address(this), stalk);
            } else {
                LibStalk.burn(account, stalk.sub(internalStalk));
                LibStalk.burn(address(this), internalStalk);
                LibUserBalance._decreaseInternalBalance(account, _stalk, internalStalk, false);
            }
        } else {
            uint256 externalStalk = LibStalk.balanceOf(account);
            if (externalStalk >= stalk) LibStalk.burn(account, stalk);
            else {
                LibUserBalance._decreaseInternalBalance(account, IERC20(address(this)), stalk.sub(externalStalk), false);
                LibStalk.burn(address(this), stalk.sub(externalStalk));
                LibStalk.burn(account, externalStalk);
            }
        }

        s.s.roots = s.s.roots.sub(roots);
        s.a[account].roots = s.a[account].roots.sub(roots);

        decrementBipRoots(account, roots);
    }

    function updateBalanceOfRainStalk(address account) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (!s.r.raining) return;
        if (s.a[account].roots < s.a[account].sop.roots) {
            s.r.roots = s.r.roots.sub(s.a[account].sop.roots.sub(s.a[account].roots));
            s.a[account].sop.roots = s.a[account].roots;
        }
    }

    function incrementBipRoots(address account, uint256 roots) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
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
    function decrementBipRoots(address account, uint256 roots) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (s.a[account].votedUntil >= season()) {
            require(
                s.a[account].proposedUntil < season() || canPropose(account),
                "Silo: Proposer must have min Stalk."
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
        AppStorage storage s = LibAppStorage.diamondStorage();
        Decimal.D256 memory stake = Decimal.ratio(s.a[account].roots, s.s.roots);
        return stake.greaterThan(C.getGovernanceProposalThreshold());
    }

    function stalkReward(uint256 seeds, uint32 seasons) internal pure returns (uint256) {
        return seeds.mul(seasons);
    }

    function season() internal view returns (uint32) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.season.current;
    }
    
    function seed() private view returns (ISeed) {
	AppStorage storage s = LibAppStorage.diamondStorage();
	return ISeed(s.seedContract);
    }
}
