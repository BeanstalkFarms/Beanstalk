/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./Life.sol";
import "../../../libraries/LibInternal.sol";

/**
 * @author Publius
 * @title Silo
**/
contract Silo is Life {

    using SafeMath for uint256;
    using LibSafeMath32 for uint32;
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
        rewardBeans(amount);
    }

    function rewardBeans(uint256 amount) private {
        if (s.s.stalk == 0 || amount == 0) return;
        s.s.stalk = s.s.stalk.add(amount.mul(C.getStalkPerBean()));
        s.si.beans = s.si.beans.add(amount);
        s.bean.deposited = s.bean.deposited.add(amount);
        s.s.seeds = s.s.seeds.add(amount.mul(C.getSeedsPerBean()));
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
        uint256 numberOfActiveBips = s.g.activeBips.length;
        for (uint256 i = numberOfActiveBips; i > 0; --i) {
            uint32 bip = s.g.activeBips[i-1];
            if (season() >= s.g.bips[bip].start.add(s.g.bips[bip].period))
                endBip(bip, i-1);
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
