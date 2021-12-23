/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../../libraries/LibCheck.sol";
import "../../../libraries/LibInternal.sol";
import "../../../libraries/LibMarket.sol";
import "../../../libraries/LibStalk.sol";
import "../../../C.sol";

/**
 * @author Publius
 * @title Silo Entrance
**/
contract SiloEntrance {

    using SafeMath for uint256;

    AppStorage internal s;

    event BeanDeposit(address indexed account, uint256 season, uint256 beans);
    
    /**
     * Silo
    **/

    function depositSiloAssets(address account, uint256 seeds, uint256 stalk, bool wrapped) internal {
        incrementBalanceOfStalk(account, stalk, wrapped);
        incrementBalanceOfSeeds(account, seeds);
    }

    function incrementBalanceOfSeeds(address account, uint256 seeds) internal {
        s.s.seeds = s.s.seeds.add(seeds);
        s.a[account].s.seeds = s.a[account].s.seeds.add(seeds);
    }

    /// @notice mints the corresponding amount of stalk ERC-20 tokens to the selected account address
    /// @param account The address of the account address to have minted stalk tokens to
    /// @param stalk The amount of stalk tokens to have minted
    /// @param wrapped Boolean that will tell us whether the stalk will be wrapped in the protocol or unwrapped (using ERC20 standard) 
    function incrementBalanceOfStalk(address account, uint256 stalk, bool wrapped) internal {
        // Remove all Legacy Stalk and Mint the corresponding fungible token
        if (!wrapped && s.a[account].s.stalk > 0) {
            convertLegacyStalk(account);
        }

        uint256 roots;
        if (s.s.roots == 0) roots = stalk.mul(C.getRootsBase());
        else roots = s.s.roots.mul(stalk).div(s.stalkToken._totalSupply);

        if (!wrapped) LibStalk._mint(account, stalk);
        // Mint Stalk ERC-20
        else s.a[account].s.stalk = s.a[account].s.stalk.add(stalk);

        s.s.roots = s.s.roots.add(roots);
        s.a[account].roots = s.a[account].roots.add(roots);

        incrementBipRoots(account, roots);
    }

    function withdrawSiloAssets(address account, uint256 seeds, uint256 stalk, bool wrapped) internal {
        decrementBalanceOfStalk(account, stalk, wrapped);
        decrementBalanceOfSeeds(account, seeds);
    }

    function decrementBalanceOfSeeds(address account, uint256 seeds) internal {
        s.s.seeds = s.s.seeds.sub(seeds);
        s.a[account].s.seeds = s.a[account].s.seeds.sub(seeds);
    }

    /// @notice burns the corresponding amount of stalk ERC-20 tokens of the selected account address
    /// @param account The address of the account address to have stalk and seed tokens withdrawn and burned
    /// @param stalk The amount of stalk tokens to have withdrawn and burned
    function decrementBalanceOfStalk(address account, uint256 stalk, bool wrapped) internal {
        // Remove all Legacy Stalk and Mint the corresponding fungible token
        if (!wrapped && s.a[account].s.stalk > 0) {
            convertLegacyStalk(account);
        }

        if (stalk == 0) return;
        uint256 roots;
        if (!wrapped) {
            roots = s.a[account].roots.mul(stalk).sub(1).div(s.stalkToken._balances[account]).add(1);
            // Burn Stalk ERC-20
            LibStalk._burn(account, stalk);
        } else {
            roots = s.a[account].roots.mul(stalk).sub(1).div(s.a[account].s.stalk).add(1);
            s.a[account].s.stalk = s.a[account].s.stalk.sub(stalk);
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

    function decrementBipRoots(address account, uint256 roots) internal {
        if (s.a[account].lockedUntil >= season()) {
            for (uint256 i = 0; i < s.g.activeBips.length; i++) {
                uint32 bip = s.g.activeBips[i];
                if (s.g.voted[bip][account]) s.g.bips[bip].roots = s.g.bips[bip].roots.sub(roots);
            }
        }
    }

    function convertLegacyStalk(address account) internal {
        LibStalk._mint(account, s.a[account].s.stalk);
        s.a[account].s.stalk = 0;
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
