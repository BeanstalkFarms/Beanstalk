/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "../LibAppStorage.sol";
import "../../C.sol";
import "./LibSilo.sol";
import "hardhat/console.sol";

/**
 * @author Publius
 * @title Lib LP Silo
**/
library LibLPSilo {

    using SafeMath for uint256;
    
    event LPDeposit(address indexed account, uint256 season, uint256 lp, uint256 seeds);
    event LPRemove(address indexed account, uint32[] crates, uint256[] crateLP, uint256 lp);
    event LPWithdraw(address indexed account, uint256 season, uint256 lp);

    function incrementDepositedLP(uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.lp.deposited = s.lp.deposited.add(amount);
    }

    function decrementDepositedLP(uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.lp.deposited = s.lp.deposited.sub(amount);
    }

    function addLPDeposit(address account, uint32 _s, uint256 amount, uint256 seeds) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.a[account].lp.deposits[_s] += amount;
        s.a[account].lp.depositSeeds[_s] += seeds;
        emit LPDeposit(msg.sender, _s, amount, seeds);
    }

    function removeLPDeposit(address account, uint32 id, uint256 amount)
        internal
        returns (uint256, uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        require(id <= s.season.current, "Silo: Future crate.");
        (uint256 crateAmount, uint256 crateBase) = lpDeposit(account, id);
        require(crateAmount >= amount, "Silo: Crate balance too low.");
        require(crateAmount > 0, "Silo: Crate empty.");
        if (amount < crateAmount) {
            uint256 base = amount.mul(crateBase).div(crateAmount);
            s.a[account].lp.deposits[id] -= amount;
            s.a[account].lp.depositSeeds[id] -= base;
            return (amount, base);
        } else {
            delete s.a[account].lp.deposits[id];
            delete s.a[account].lp.depositSeeds[id];
            return (crateAmount, crateBase);
        }
    }

    function removeLPDeposits(uint32[] calldata crates, uint256[] calldata amounts)
        internal 
        returns (uint256 lpRemoved, uint256 stalkRemoved, uint256 seedsRemoved)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        for (uint256 i = 0; i < crates.length; i++) {
            (uint256 crateBeans, uint256 crateSeeds) = removeLPDeposit(
                msg.sender,
                crates[i],
                amounts[i]
            );
            lpRemoved = lpRemoved.add(crateBeans);
            stalkRemoved = stalkRemoved.add(crateSeeds.mul(C.getStalkPerLPSeed()).add(
                LibSilo.stalkReward(crateSeeds, s.season.current-crates[i]))
            );
            seedsRemoved = seedsRemoved.add(crateSeeds);
        }
        emit LPRemove(msg.sender, crates, amounts, lpRemoved);
    }

    function addLPWithdrawal(address account, uint32 arrivalSeason, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.a[account].lp.withdrawals[arrivalSeason] = s.a[account].lp.withdrawals[arrivalSeason].add(amount);
        s.lp.withdrawn = s.lp.withdrawn.add(amount);
        emit LPWithdraw(msg.sender, arrivalSeason, amount);
    }
    
    function lpDeposit(address account, uint32 id) private view returns (uint256, uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return (s.a[account].lp.deposits[id], s.a[account].lp.depositSeeds[id]);
    }

    function lpToLPBeans(uint256 amount) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(s.c.pair).getReserves();

        uint256 beanReserve = s.index == 0 ? reserve0 : reserve1;

        console.log("amount", amount); // 1000 
        console.log("reserve0", reserve0); // 2000
        console.log("reserve1", reserve1); // 2
        console.log("beanReserve", beanReserve); // 2
        console.log("IUniswapV2Pair(s.c.pair).totalSupply()", IUniswapV2Pair(s.c.pair).totalSupply()); // 10000

        return amount.mul(beanReserve).mul(2).div(IUniswapV2Pair(s.c.pair).totalSupply()); // 0
    }
}
