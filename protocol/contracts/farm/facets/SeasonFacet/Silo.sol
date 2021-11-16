/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./Life.sol";
import "../../../libraries/LibInternal.sol";

/**
 * @author Publius
 * @title Silo
**/
contract Silo is Life {

    using SafeMath for uint256;
    using SafeMath for uint32;
    using Decimal for Decimal.D256;

    uint256 private constant BASE = 1e12;
    uint256 private constant BURN_BASE = 1e20;
    uint256 private constant BIG_BASE = 1e24;

    /**
     * Getters
    **/

    function seasonOfPlenty(uint32 _s) external view returns (uint256) {
        return s.sops[_s];
    }

    function paused() public view returns (bool) {
        return s.paused;
    }

    /**
     * Internal
    **/

    // Silo

    function stepSilo(uint256 amount) internal {
        rewardStalk();
        rewardBeans(amount);
    }

    function rewardStalk() private {
        if (s.si.beans == 0) return;
        uint256 newStalk = s.si.beans.mul(C.getSeedsPerBean());
        s.s.stalk = s.s.stalk.add(newStalk);
        s.si.stalk = s.si.stalk.add(newStalk);
    }

    function rewardBeans(uint256 amount) private {
        if (s.s.stalk == 0 || amount == 0) return;
        s.s.stalk = s.s.stalk.add(amount.mul(C.getStalkPerBean()));
        s.si.beans = s.si.beans.add(amount);
        s.bean.deposited = s.bean.deposited.add(amount);
        s.s.seeds = s.s.seeds.add(amount.mul(C.getSeedsPerBean()));
        s.unclaimedRoots = s.unclaimedRoots.add(s.s.roots);
        s.season.sis = s.season.sis + 1;
    }

    // Season of Plenty

    function rewardEther(uint256 amount) internal {
        uint256 base;
        if (s.sop.base == 0) {
            base = amount.mul(BIG_BASE);
            s.sop.base = BURN_BASE;
        }
        else base = amount.mul(s.sop.base).div(s.sop.weth);

        // Award ether to claimed stalk holders
        uint256 basePerStalk = base.div(s.r.roots);
        base = basePerStalk.mul(s.r.roots);
        s.sops[s.r.start] = s.sops[s.r.start].add(basePerStalk);

        // Update total state
        s.sop.weth = s.sop.weth.add(amount);
        s.sop.base = s.sop.base.add(base);
        if (base > 0) s.sop.last = s.r.start;

    }

    // Governance

    function stepGovernance() internal {
        for (uint256 i; i < s.g.activeBips.length; i++) {
            uint32 bip = s.g.activeBips[i];
            if (season() >= s.g.bips[bip].start.add(s.g.bips[bip].period)) {
                endBip(bip, i);
                i--;
            }
        }
    }

    function endBip(uint32 bipId, uint256 i) private {
        s.g.bips[bipId].timestamp = uint128(block.timestamp);
        s.g.bips[bipId].endTotalRoots = s.s.roots;
        if (i < s.g.activeBips.length-1)
            s.g.activeBips[i] = s.g.activeBips[s.g.activeBips.length-1];
        s.g.activeBips.pop();
    }

}
