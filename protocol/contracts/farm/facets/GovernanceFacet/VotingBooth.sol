/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import './Bip.sol';

/**
 * @author Publius
 * @title Voting Booth
**/
contract VotingBooth is Bip {

    using SafeMath for uint256;
    using SafeMath for uint32;

    /**
     * Voting
    **/

    function recordVote(address account, uint32 bipId) internal {
        s.g.voted[bipId][account] = true;
        s.g.bips[bipId].stalk = s.g.bips[bipId].stalk.add(s.a[account].s.stalk);
        if (s.g.bips[bipId].stalk > s.s.stalk) s.g.bips[bipId].stalk = s.s.stalk;
        s.g.bips[bipId].seeds = s.g.bips[bipId].seeds.add(s.a[account].s.seeds);
        if (s.g.bips[bipId].seeds > s.s.seeds) s.g.bips[bipId].seeds = s.s.seeds;
    }

    function unrecordVote(address account, uint32 bipId) internal {
        s.g.voted[bipId][account] = false;
        if (s.a[account].s.stalk > s.g.bips[bipId].stalk) s.g.bips[bipId].stalk = 0;
        else s.g.bips[bipId].stalk = s.g.bips[bipId].stalk.sub(s.a[account].s.stalk);
        if (s.a[account].s.seeds > s.g.bips[bipId].seeds) s.g.bips[bipId].seeds = 0;
        else s.g.bips[bipId].seeds = s.g.bips[bipId].seeds.sub(s.a[account].s.seeds);
    }

    function placeLock(address account, uint32 bipId) internal {
        uint32 newLock = startFor(bipId) + periodFor(bipId);
        if (newLock > s.a[account].lockedUntil) {
                s.a[account].lockedUntil = newLock;
        }
    }

    function removeLock(address account, uint32 bipId) internal {
        uint32[] memory actives = activeBips();
        uint32 lastSeason = 0;
        for (uint256 i = 0; i < actives.length; i++) {
                uint32 activeBip = actives[i];
                if (activeBip != bipId && s.g.voted[activeBip][account]) {
                    uint32 bipEnd = startFor(bipId) + periodFor(bipId);
                    if (bipEnd > lastSeason) lastSeason = bipEnd;
                }
        }
        s.a[account].lockedUntil = lastSeason;
    }

}
