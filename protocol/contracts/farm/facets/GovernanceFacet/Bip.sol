/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../AppStorage.sol";
import "../../../C.sol";
import "../../../libraries/Decimal.sol";
import "../../../libraries/LibDiamond.sol";

/**
 * @author Publius
 * @title BIP
**/
contract Bip {

    using SafeMath for uint256;
    using SafeMath for uint32;
    using Decimal for Decimal.D256;

    AppStorage internal s;

    /**
     * Getters
    **/

    // Bips

    function activeBips() public view returns (uint32[] memory) {
        return s.g.activeBips;
    }

    function numberOfBips() public view returns (uint32) {
        return s.g.bipIndex;
    }

    function bip(uint32 bipId) public view returns (Storage.Bip memory) {
        return s.g.bips[bipId];
    }

    function voted(address account, uint32 bipId) public view returns (bool) {
        return s.g.voted[bipId][account];
    }

    function stalkFor(uint32 bipId) public view returns (uint256) {
        if (isEnded(bipId)) return s.g.bips[bipId].stalk;
        return s.g.bips[bipId].stalk.add(increaseStalkFor(bipId)).add(rewardedStalkFor(bipId));
    }

    function seedsFor(uint32 bipId) public view returns (uint256) {
        if (isEnded(bipId)) return s.g.bips[bipId].seeds;
        if (s.si.increaseBase == 0) return s.g.bips[bipId].seeds;
        (uint256 increaseBase,) = increaseBasesFor(bipId);
        return s.g.bips[bipId].seeds.add(
            increaseBase.mul(s.si.increase).div(s.si.increaseBase).mul(C.getSeedsPerBean())
        );
    }

    // Diamond Cut

    function bipDiamondCut(uint32 bipId) public view returns (Storage.DiamondCut memory) {
        return s.g.diamondCuts[bipId];
    }

    function bipFacetCuts(uint32 bipId) public view returns (IDiamondCut.FacetCut[] memory) {
        return s.g.diamondCuts[bipId].diamondCut;
    }

    function diamondCutIsEmpty(uint32 bipId) internal view returns (bool) {
        return (
            s.g.diamondCuts[bipId].diamondCut.length == 0 &&
            s.g.diamondCuts[bipId].initAddress == address(0)
        );
    }

    /**
     * Internal
    **/

    // Bip Actions

    function createBip(
        IDiamondCut.FacetCut[] memory _diamondCut,
        address _init,
        bytes memory _calldata,
        uint8 pauseOrUnpause,
        uint32 period,
        address account
    )
        internal
        returns (uint32)
    {
        uint32 bipId = s.g.bipIndex;
        s.g.bipIndex += 1;
        s.g.bips[bipId].updated = season();
        s.g.bips[bipId].start = season();
        s.g.bips[bipId].period = period;
        s.g.bips[bipId].pauseOrUnpause = pauseOrUnpause;
        s.g.bips[bipId].timestamp = uint128(block.timestamp);
        s.g.bips[bipId].proposer = account;
        for (uint i = 0; i < _diamondCut.length; i++)
            s.g.diamondCuts[bipId].diamondCut.push(_diamondCut[i]);
        s.g.diamondCuts[bipId].initAddress = _init;
        s.g.diamondCuts[bipId].initData = _calldata;
        s.g.activeBips.push(bipId);
        return bipId;
    }

    function endBip(uint32 bipId) internal {
        uint256 i = 0;
        while(s.g.activeBips[i] != bipId) i++;
        s.g.bips[bipId].timestamp = uint128(block.timestamp);
        s.g.bips[bipId].stalk = stalkFor(bipId);

        delete s.g.bips[bipId].seeds;
        delete s.g.bips[bipId].increaseBase;
        delete s.g.bips[bipId].stalkBase;

        s.g.bips[bipId].endTotalStalk = s.s.stalk;
        s.g.bips[bipId].updated = season();
        if (i < s.g.activeBips.length-1) s.g.activeBips[i] = s.g.activeBips[s.g.activeBips.length-1];
        s.g.activeBips.pop();
    }

    function cutBip(uint32 bipId) internal {
        if (diamondCutIsEmpty(bipId)) return;
        LibDiamond.diamondCut(
            s.g.diamondCuts[bipId].diamondCut,
            s.g.diamondCuts[bipId].initAddress,
            s.g.diamondCuts[bipId].initData
        );
    }

    // Bip State

    function rewardedStalkFor(uint32 bipId) internal view returns (uint256) {
        return s.g.bips[bipId].seeds.mul(season()-s.g.bips[bipId].updated);
    }

    function increaseBasesFor(uint32 bipId) internal view returns (uint256, uint256) {
        if (s.g.bips[bipId].updated >= s.si.lastSupplyIncrease || s.si.stalkBase == 0)
            return (s.g.bips[bipId].increaseBase,s.g.bips[bipId].stalkBase);
        uint256 ib = s.g.bips[bipId].increaseBase;
        uint256 sb = s.g.bips[bipId].stalkBase;
        uint32 updated = s.g.bips[bipId].updated;
        uint256 im;
        uint256 sm;
        uint32 _s = s.si.lastSupplyIncrease;
        while (_s > updated) {
            uint256 stalk = s.g.bips[bipId].stalk.add(s.g.bips[bipId].seeds.mul(_s-updated-1));
            if (im == 0) ib = ib.add(s.seasons[_s].increaseBase.mul(stalk));
            else ib = ib.add(s.seasons[_s].increaseBase.mul(stalk).mul(im));
            if (sm == 0) sb = sb.add(s.seasons[_s].stalkBase.mul(stalk));
            else sb = sb.add(s.seasons[_s].stalkBase.mul(stalk).mul(sm));

            if (s.rbs[_s].increaseMultiple > 0)
                im = im > 0 ? im.mul(s.rbs[_s].increaseMultiple) : s.rbs[_s].increaseMultiple;
            if (s.rbs[_s].stalkMultiple > 0)
                sm = sm > 0 ? sm.mul(s.rbs[_s].stalkMultiple) : s.rbs[_s].stalkMultiple;

            _s = s.seasons[_s].next;
        }
        return (ib, sb);
    }

    function proposer(uint32 bipId) internal view returns (address) {
        return s.g.bips[bipId].proposer;
    }

    function startFor(uint32 bipId) internal view returns (uint32) {
        return s.g.bips[bipId].start;
    }

    function periodFor(uint32 bipId) internal view returns (uint32) {
        return s.g.bips[bipId].period;
    }

    function timestamp(uint32 bipId) internal view returns (uint256) {
        return uint256(s.g.bips[bipId].timestamp);
    }

    function isNominated(uint32 bipId) internal view returns (bool) {
        return startFor(bipId) > 0 && !s.g.bips[bipId].executed;
    }

    function isEnded(uint32 bipId) internal view returns (bool) {
        return season() > startFor(bipId).add(periodFor(bipId)) || s.g.bips[bipId].executed;
    }

    function isActive(uint32 bipId) internal view returns (bool) {
        return season() <= startFor(bipId).add(periodFor(bipId));
    }

    function isExpired(uint32 bipId) internal view returns (bool) {
        return season() > startFor(bipId).add(periodFor(bipId)).add(C.getGovernanceExpiration());
    }

    function bipVotePercent(uint32 bipId) internal view returns (Decimal.D256 memory) {
        return Decimal.ratio(stalkFor(bipId), totalStalk());
    }

    function endedBipVotePercent(uint32 bipId) internal view returns (Decimal.D256 memory) {
        return Decimal.ratio(s.g.bips[bipId].stalk,s.g.bips[bipId].endTotalStalk);
    }

    function increaseStalkFor(uint32 bipId) internal view returns (uint256) {
        if (s.si.increaseBase == 0) return 0;
        (uint256 increaseBase, uint256 stalkBase) = increaseBasesFor(bipId);
        uint256 increase = increaseBase.mul(s.si.increase).div(s.si.increaseBase);
        return increase.mul(C.getStalkPerBean()).add(rewardedIncreaseStalkFor(
            stalkBase,
            increaseBase
        ));
    }

    function rewardedIncreaseStalkFor(uint256 stalkBase, uint256 increaseBase)
        private
        view
        returns (uint256)
    {
        if (s.si.stalk == 0 || s.si.increaseBase == 0 || s.si.stalkBase == 0) return 0;
        uint256 increaseStalk = increaseBase.mul(s.si.increase.mul(C.getStalkPerBean())).div(s.si.increaseBase);
        uint256 minBase = increaseStalk.mul(s.si.stalkBase).div(s.si.stalk);
        if (minBase >= stalkBase) return 0;
        uint256 stalkBaseForIncrease = s.si.increase.mul(C.getStalkPerBean()).mul(s.si.stalkBase).div(s.si.stalk);
        if (s.si.stalkBase == stalkBaseForIncrease) return 0;
        uint256 stalk = stalkBase.mul(s.si.stalk.sub(s.si.increase.mul(C.getStalkPerBean()))).div(s.si.stalkBase);
        uint256 maxBase = s.si.stalk.sub(s.si.increase.mul(C.getStalkPerBean()));
        if (stalk > maxBase) return maxBase;
        return stalk;
    }

    // Bip Proposition

    function canPropose(address account) internal view returns (bool) {
        if (totalStalk() == 0 || balanceOfStalk(account) == 0) {
            return false;
        }

        Decimal.D256 memory stake = Decimal.ratio(balanceOfStalk(account), totalStalk());
        return stake.greaterThan(C.getGovernanceProposalThreshold());
    }

    function notTooProposed(address account) internal view returns (bool) {
        uint256 propositions;
        for (uint256 i = 0; i < s.g.activeBips.length; i++) {
            uint32 bipId = s.g.activeBips[i];
            if (s.g.bips[bipId].proposer == account) propositions += 1;
        }
        return (propositions < C.getMaxPropositions());
    }

    /**
     * Shed
    **/

    function incentiveTime(uint32 bipId) internal view returns (uint256) {
        uint256 time = block.timestamp.sub(s.g.bips[bipId].timestamp);
        if (time > 1800) time = 1800;
        return time / 6;
    }

    function balanceOfStalk(address account) internal view returns (uint256) {
        return s.a[account].s.stalk;
    }

    function balanceOfSeeds(address account) internal view returns (uint256) {
        return s.a[account].s.seeds;
    }

    function season() internal view returns (uint32) { return s.season.current; }

    function totalStalk() private view returns (uint256) { return s.s.stalk; }

}
