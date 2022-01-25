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

    event LPRemove(address indexed account, uint32[] crates, uint256[] crateLP, uint256 lp);

    uint256 private constant STALK_PER_SEED = 2500;

    function removeLPDepositsForConvert(
        uint32[] memory crates,
        uint256[] memory amounts,
        bool[] memory legacy,
        uint256 maxLP
    )
        internal
        returns (uint256 lpRemoved, uint256 stalkRemoved)
    {
        require(crates.length == amounts.length, "Silo: Crates, amounts are diff lengths.");
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 seedsRemoved;
        uint256 depositLP;
        uint256 depositSeeds;
        uint256 i = 0;
        while ((i < crates.length) && (lpRemoved < maxLP)) {
            if (lpRemoved.add(amounts[i]) < maxLP)
                (depositLP, depositSeeds) = removeLPDeposit(msg.sender, crates[i], amounts[i], legacy[i]);
            else
                (depositLP, depositSeeds) = removeLPDeposit(msg.sender, crates[i], maxLP.sub(lpRemoved), legacy[i]);
            lpRemoved = lpRemoved.add(depositLP);
            seedsRemoved = seedsRemoved.add(depositSeeds);
            stalkRemoved = stalkRemoved.add(LibSilo.stalkReward(depositSeeds, s.season.current-crates[i]));
            i++;
        }
        if (i > 0) amounts[i.sub(1)] = depositLP;
        while (i < crates.length) {
            amounts[i] = 0;
            i++;
        }
        LibTokenSilo.decrementDepositedToken(s.c.pair, lpRemoved);
        LibSilo.withdrawSiloAssets(msg.sender, seedsRemoved, stalkRemoved);
        emit LPRemove(msg.sender, crates, amounts, lpRemoved);
    }

    function removeLPDeposits(uint32[] calldata crates, uint256[] calldata amounts, bool[] calldata legacy)
        internal
        returns (uint256 lpRemoved, uint256 stalkRemoved, uint256 seedsRemoved)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        for (uint256 i = 0; i < crates.length; i++) {
            (uint256 crateBeans, uint256 crateSeeds) = removeLPDeposit(
                msg.sender,
                crates[i],
                amounts[i], 
                legacy[i]
            );
            lpRemoved = lpRemoved.add(crateBeans);
            stalkRemoved = stalkRemoved.add(crateSeeds.mul(STALK_PER_SEED).add(
                LibSilo.stalkReward(crateSeeds, s.season.current-crates[i]))
            );
            seedsRemoved = seedsRemoved.add(crateSeeds);
        }
        emit LPRemove(msg.sender, crates, amounts, lpRemoved);
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
}