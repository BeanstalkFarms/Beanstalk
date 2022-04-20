/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
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

    function depositSiloAssetsE(address account, uint256 base, uint256 amount) public {
        updateSilo(account);
        LibSilo.depositSiloAssets(account, base, amount);
    }

    function incrementDepositedLPE(uint256 amount) public {
        LibLPSilo.incrementDepositedLP(amount);
        MockUniswapV2Pair(s.c.pair).faucet(address(this), amount);
    }

    function incrementDepositedBeansE(uint256 amount) public {
        s.bean.deposited = s.bean.deposited.add(amount);
    }

    function withdrawSiloAssetsE(address account, uint256 base, uint256 amount) public {
        updateSilo(account);
        LibSilo.withdrawSiloAssets(account, base, amount);
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

    function uniswapLPToBean(uint256 amount) external view returns (uint256) {
        return LibBeanEthUniswap.bdv(amount);
    }

    function mockRefund(uint256 bean) external payable {
        LibMarket.allocateEthRefund(msg.value, 0, false);
        IBean(s.c.bean).transferFrom(msg.sender, address(this), bean);
        LibMarket.allocateBeanRefund(bean, 0);
        LibMarket.refund();
    }
}