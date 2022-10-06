/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../../C.sol";
import "../LibAppStorage.sol";

/**
 * @author Publius
 * @title Lib Silo
 **/
library LibSilo {
    using SafeMath for uint256;

    event SeedsBalanceChanged(
        address indexed account,
        int256 delta
    );

    event StalkBalanceChanged(
        address indexed account,
        int256 delta,
        int256 deltaRoots
    );

    /**
     * Silo
     **/

    function depositSiloAssets(
        address account,
        uint256 seeds,
        uint256 stalk
    ) internal {
        incrementBalanceOfStalk(account, stalk);
        incrementBalanceOfSeeds(account, seeds);
    }

    function withdrawSiloAssets(
        address account,
        uint256 seeds,
        uint256 stalk
    ) internal {
        decrementBalanceOfStalk(account, stalk);
        decrementBalanceOfSeeds(account, seeds);
    }

    function transferSiloAssets(
        address sender,
        address recipient,
        uint256 seeds,
        uint256 stalk
    ) internal {
        transferStalk(sender, recipient, stalk);
        transferSeeds(sender, recipient, seeds);
    }

    function incrementBalanceOfSeeds(address account, uint256 seeds) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.s.seeds = s.s.seeds.add(seeds);
        s.a[account].s.seeds = s.a[account].s.seeds.add(seeds);
        emit SeedsBalanceChanged(account, int256(seeds));
    }

    function incrementBalanceOfStalk(address account, uint256 stalk) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 roots;
        if (s.s.roots == 0) roots = stalk.mul(C.getRootsBase());
        else roots = s.s.roots.mul(stalk).div(s.s.stalk);

        s.s.stalk = s.s.stalk.add(stalk);
        s.a[account].s.stalk = s.a[account].s.stalk.add(stalk);

        s.s.roots = s.s.roots.add(roots);
        s.a[account].roots = s.a[account].roots.add(roots);
        emit StalkBalanceChanged(account, int256(stalk), int256(roots));
    }

    function decrementBalanceOfSeeds(address account, uint256 seeds) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.s.seeds = s.s.seeds.sub(seeds);
        s.a[account].s.seeds = s.a[account].s.seeds.sub(seeds);
        emit SeedsBalanceChanged(account, -int256(seeds));
    }

    function decrementBalanceOfStalk(address account, uint256 stalk) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (stalk == 0) return;

        uint256 roots = s.s.roots.mul(stalk).div(s.s.stalk);
        if (roots > s.a[account].roots) roots = s.a[account].roots;

        s.s.stalk = s.s.stalk.sub(stalk);
        s.a[account].s.stalk = s.a[account].s.stalk.sub(stalk);

        s.s.roots = s.s.roots.sub(roots);
        s.a[account].roots = s.a[account].roots.sub(roots);
        
        if (s.season.raining) {
            s.r.roots = s.r.roots.sub(roots);
            s.a[account].sop.roots = s.a[account].roots;
        }

        emit StalkBalanceChanged(account, -int256(stalk), -int256(roots));
    }

    function transferSeeds(
        address sender,
        address recipient,
        uint256 seeds
    ) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.a[sender].s.seeds = s.a[sender].s.seeds.sub(seeds);
        emit SeedsBalanceChanged(sender, -int256(seeds));

        s.a[recipient].s.seeds = s.a[recipient].s.seeds.add(seeds);
        emit SeedsBalanceChanged(recipient, int256(seeds));
    }

    function transferStalk(
        address sender,
        address recipient,
        uint256 stalk
    ) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 roots = stalk == s.a[sender].s.stalk
            ? s.a[sender].roots
            : s.s.roots.sub(1).mul(stalk).div(s.s.stalk).add(1);

        s.a[sender].s.stalk = s.a[sender].s.stalk.sub(stalk);
        s.a[sender].roots = s.a[sender].roots.sub(roots);
        emit StalkBalanceChanged(sender, -int256(stalk), -int256(roots));

        s.a[recipient].s.stalk = s.a[recipient].s.stalk.add(stalk);
        s.a[recipient].roots = s.a[recipient].roots.add(roots);
        emit StalkBalanceChanged(recipient, int256(stalk), int256(roots));
    }

    function stalkReward(uint256 seeds, uint32 seasons)
        internal
        pure
        returns (uint256)
    {
        return seeds.mul(seasons);
    }
}
