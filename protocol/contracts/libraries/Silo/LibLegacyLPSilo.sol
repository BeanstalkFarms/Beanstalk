/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "../LibAppStorage.sol";
import "./LibSilo.sol";
import "./LibTokenSilo.sol";

/**
 * @author Publius
 * @title Lib LP Silo
**/
library LibLegacyLPSilo {

    using SafeMath for uint256;

    event LegacyLPRemove(address indexed account, uint32[] crates, uint256[] crateLP, bool[] legacy, uint256 lp);
    event TokenWithdraw(address indexed account, address indexed token, uint256 season, uint256 amount);

    uint256 private constant STALK_PER_SEED = 2500;

    struct AssetsRemoved {
        uint256 lpRemoved;
        uint256 stalkRemoved;
        uint256 seedsRemoved;
    }

    function withdrawLegacyLP(uint32[] calldata crates, uint256[] calldata amounts, bool[] calldata legacy, bool fromInternalBalance) internal {
        require(crates.length == amounts.length, "Silo: Crates, amounts are diff lengths.");
        AppStorage storage s = LibAppStorage.diamondStorage();
        AssetsRemoved memory assetsRemoved = removeLPDeposits(crates, amounts, legacy);
        uint32 arrivalSeason = s.season.current + s.season.withdrawSeasons;
        addLPWithdrawal(msg.sender, arrivalSeason, assetsRemoved.lpRemoved);
        LibTokenSilo.decrementDepositedToken(s.c.pair, assetsRemoved.lpRemoved);
        LibSilo.withdrawSiloAssets(msg.sender, assetsRemoved.seedsRemoved, assetsRemoved.stalkRemoved, fromInternalBalance);
        LibSilo.updateBalanceOfRainStalk(msg.sender);
    }

    function removeLPDepositsForConvert(
        uint32[] memory crates,
        uint256[] memory amounts,
        bool[] memory legacy,
        uint256 maxLP,
        bool fromInternalBalance
    )
        internal
        returns (uint256)
    {
        require(crates.length == amounts.length, "Silo: Crates, amounts are diff lengths.");
        AppStorage storage s = LibAppStorage.diamondStorage();
        AssetsRemoved memory ar;
        uint256 depositLP;
        uint256 depositSeeds;
        uint256 i = 0;
        while ((i < crates.length) && (ar.lpRemoved < maxLP)) {
            if (ar.lpRemoved.add(amounts[i]) < maxLP)
                (depositLP, depositSeeds) = removeLPDeposit(msg.sender, crates[i], amounts[i], legacy[i]);
            else
                (depositLP, depositSeeds) = removeLPDeposit(msg.sender, crates[i], maxLP.sub(ar.lpRemoved), legacy[i]);
            ar.lpRemoved = ar.lpRemoved.add(depositLP);
            ar.seedsRemoved = ar.seedsRemoved.add(depositSeeds);
            ar.stalkRemoved = ar.stalkRemoved.add(LibSilo.stalkReward(depositSeeds, s.season.current-crates[i]));
            i++;
        }
        if (i > 0) amounts[i.sub(1)] = depositLP;
        while (i < crates.length) {
            amounts[i] = 0;
            i++;
        }
        LibTokenSilo.decrementDepositedToken(s.c.pair, ar.lpRemoved);
        LibSilo.withdrawSiloAssets(msg.sender, ar.seedsRemoved, ar.stalkRemoved.add(ar.seedsRemoved.mul(STALK_PER_SEED)), fromInternalBalance);
        emit LegacyLPRemove(msg.sender, crates, amounts, legacy, ar.lpRemoved);
        return ar.stalkRemoved;
    }

    function removeLPDeposits(uint32[] calldata crates, uint256[] calldata amounts, bool[] calldata legacy)
        internal
        returns (AssetsRemoved memory ar)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        for (uint256 i = 0; i < crates.length; i++) {
            (uint256 crateBeans, uint256 crateSeeds) = removeLPDeposit(
                msg.sender,
                crates[i],
                amounts[i], 
                legacy[i]
            );
            ar.lpRemoved = ar.lpRemoved.add(crateBeans);
            ar.stalkRemoved = ar.stalkRemoved.add(crateSeeds.mul(STALK_PER_SEED).add(
                LibSilo.stalkReward(crateSeeds, s.season.current-crates[i]))
            );
            ar.seedsRemoved = ar.seedsRemoved.add(crateSeeds);
        }
        emit LegacyLPRemove(msg.sender, crates, amounts, legacy, ar.lpRemoved);
    }

    function removeLPDeposit(address account, uint32 id, uint256 amount, bool legacy)
        internal
        returns (uint256, uint256) 
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if(!legacy) {
            (uint256 crateAmount, uint256 crateBase) = LibTokenSilo.removeDeposit(account, s.c.pair, id, amount);
            crateBase = crateBase.mul(s.ss[s.c.pair].seeds);
            return (crateAmount, crateBase);
        }
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
    
    function lpDeposit(address account, uint32 id) private view returns (uint256, uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return (s.a[account].lp.deposits[id], s.a[account].lp.depositSeeds[id]);
    }

    function addLPWithdrawal(address account, uint32 arrivalSeason, uint256 amount) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.a[account].withdrawals[IERC20(s.c.pair)][arrivalSeason] = s.a[account].withdrawals[IERC20(s.c.pair)][arrivalSeason].add(amount);
        s.siloBalances[IERC20(s.c.pair)].withdrawn = s.siloBalances[IERC20(s.c.pair)].withdrawn.add(amount);
        emit TokenWithdraw(msg.sender, s.c.pair, arrivalSeason, amount);
    }
}