/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../farm/facets/SiloFacet/SiloFacet.sol";
import "../MockUniswapV2Pair.sol";

/**
 * @author Publius
 * @title Mock Silo Facet
**/
contract MockSiloFacet is SiloFacet {

    using SafeMath for uint256;

    function depositSiloAssetsE(address account, uint256 base, uint256 amount, Storage.Settings calldata set) public {
        updateSilo(account, set.toInternalBalance, set.lightUpdateSilo);
        LibSilo.depositSiloAssets(account, base, amount, set.toInternalBalance);
    }

    function incrementDepositedLPE(uint256 amount) public {
        LibLPSilo.incrementDepositedLP(amount);
        MockUniswapV2Pair(s.c.pair).faucet(address(this), amount);
    }
    function initMintStalkTokensE(uint256 amount) public {
        LibStalk.mint(address(this), amount);
    }
    function initMintSeedTokensE(uint256 amount) public {
        seed().mint(address(this), amount);
    }
    function incrementDepositedBeansE(uint256 amount) public {
        s.bean.deposited = s.bean.deposited.add(amount);
    }
    function incrementBalanceOfStalkE(address account, uint256 amount, bool toInternalBalance) public {
        LibSilo.incrementBalanceOfStalk(account, amount, toInternalBalance);
    }

    function withdrawSiloAssetsE(address account, uint256 base, uint256 amount, Storage.Settings calldata set) public {
        updateSilo(account, set.toInternalBalance, set.lightUpdateSilo);
        LibSilo.withdrawSiloAssets(account, base, amount, set.fromInternalBalance);
    }

    function balanceOfDepositedBeans(address account) public view returns (uint256) {
        uint256 beans = 0;
        for (uint32 i = 0; i <= season(); i++) {
            beans = beans.add(s.a[account].bean.deposits[i]);
        }
        return beans;
    }

    function balanceOfDepositedLP(address account) public view returns (uint256) {
        uint256 beans = 0;
        for (uint32 i = 0; i <= season(); i++) {
            beans = beans.add(s.a[account].lp.deposits[i]);
        }
        return beans;
    }

    function balanceOfRootStalk(address account) public view returns (uint256) {
        if (s.s.roots == 0) return 0;
        return s.a[account].roots.mul(s.s.stalk).div(s.s.roots);
    }

    function balanceOfRawStalk(address account) public view returns (uint256) {
        return s.a[account].s.stalk;
    }

    function beanDeposits(address account) public view returns (
        uint32[] memory seasons,
        uint256[] memory crates
    ) {
        uint256 numberCrates = 0;
        for (uint32 i = 0; i <= season(); i++) {
            if (beanDeposit(account, i) > 0) numberCrates += 1;
        }
        seasons = new uint32[](numberCrates);
        crates = new uint256[](numberCrates);
        numberCrates = 0;
        for (uint32 i = 0; i <= season(); i++) {
            if (beanDeposit(account, i) > 0) {
                seasons[numberCrates] = i;
                crates[numberCrates] = beanDeposit(account, i);
                numberCrates += 1;
            }
        }
        return (seasons, crates);
    }

    function lpDeposits(address account) public view returns (
        uint32[] memory seasons,
        uint256[] memory crates,
        uint256[] memory seedCrates
    ) {
        uint256 numberCrates;
        for (uint32 i = 0; i <= season(); i++) {
            if (s.a[account].lp.deposits[i] > 0) numberCrates += 1;
        }
        seasons = new uint32[](numberCrates);
        crates = new uint256[](numberCrates);
        seedCrates = new uint256[](numberCrates);
        numberCrates = 0;
        for (uint32 i = 0; i <= season(); i++) {
            if (s.a[account].lp.deposits[i] > 0) {
                seasons[numberCrates] = i;
                crates[numberCrates] = s.a[account].lp.deposits[i];
                seedCrates[numberCrates] = s.a[account].lp.depositSeeds[i];
                numberCrates += 1;
            }
        }
        return (seasons, crates, seedCrates);
    }

    function beanWithdrawals(address account) public view returns (
        uint32[] memory seasons,
        uint256[] memory crates
    ) {
        uint256 numberCrates;
        for (uint32 i = 0; i <= season()+25; i++) {
            if (s.a[account].bean.withdrawals[i] > 0) numberCrates += 1;
        }
        seasons = new uint32[](numberCrates);
        crates = new uint256[](numberCrates);
        numberCrates = 0;
        for (uint32 i = 0; i <= season()+25; i++) {
            if (s.a[account].bean.withdrawals[i] > 0) {
                seasons[numberCrates] = i;
                crates[numberCrates] = s.a[account].bean.withdrawals[i];
                numberCrates += 1;
            }
        }
        return (seasons, crates);
    }

    function lpWithdrawals(address account) public view returns (
        uint32[] memory seasons,
        uint256[] memory crates
    ) {
        uint256 numberCrates;
        for (uint32 i = 0; i <= season()+25; i++) {
            if (s.a[account].lp.withdrawals[i] > 0) numberCrates += 1;
        }
        seasons = new uint32[](numberCrates);
        crates = new uint256[](numberCrates);
        numberCrates = 0;
        for (uint32 i = 0; i <= season()+25; i++) {
            if (s.a[account].lp.withdrawals[i] > 0) {
                seasons[numberCrates] = i;
                crates[numberCrates] = s.a[account].lp.withdrawals[i];
                numberCrates += 1;
            }
        }
        return (seasons, crates);
    }

    function resetSeedsAndStalk(address[] calldata accounts) public {
        for (uint i = 0; i < accounts.length; i++) {
           seed().burnFrom(accounts[i], seed().balanceOf(accounts[i]));
	   LibStalk.burn(accounts[i], balanceOf(accounts[i]));
	   s.internalTokenBalance[accounts[i]][seed()] = 0;
	   s.internalTokenBalance[accounts[i]][stalk()] = 0;
        }
    }

    function resetContract() public {
           seed().burn(seed().balanceOf(address(this)));
           LibStalk.burn(address(this), balanceOf(address(this)));
    }

    function internalSeeds(address account) public view returns (uint256) {
	    return LibUserBalance._getInternalBalance(account, seed());
    }

    function internalStalk(address account) public view returns (uint256) {
	    return s.internalTokenBalance[account][stalk()];
    }
}
