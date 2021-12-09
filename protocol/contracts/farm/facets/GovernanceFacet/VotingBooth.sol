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
        s.g.bips[bipId].roots = s.g.bips[bipId].roots.add(balanceOfRoots(account));
    }

    function unrecordVote(address account, uint32 bipId) internal {
        s.g.voted[bipId][account] = false;
        s.g.bips[bipId].roots = s.g.bips[bipId].roots.sub(balanceOfRoots(account));
    }

    function placeVotedUntil(address account, uint32 bipId) internal {
        uint32 newLock = startFor(bipId) + periodFor(bipId);
        if (newLock > s.a[account].votedUntil) {
                s.a[account].votedUntil = newLock;
        }
    }

    function updateVotedUntil(address account) internal {
        uint32[] memory actives = activeBips();
        uint32 lastSeason = 0;
        for (uint256 i = 0; i < actives.length; i++) {
                uint32 activeBip = actives[i];
                if (s.g.voted[activeBip][account]) {
                    uint32 bipEnd = startFor(activeBip) + periodFor(activeBip);
                    if (bipEnd > lastSeason) lastSeason = bipEnd;
                }
        }
        s.a[account].votedUntil = lastSeason;
    }

}
