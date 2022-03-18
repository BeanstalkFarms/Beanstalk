/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../../libraries/LibSafeMath32.sol";
import "../../AppStorage.sol";
import "../../../C.sol";
import "../../../libraries/Decimal.sol";
import "../../../libraries/LibDiamond.sol";

/**
 * @author Publius
 * @title BIP
**/
contract Bip {
    
    AppStorage internal s;

    using SafeMath for uint256;
    using LibSafeMath32 for uint32;
    using Decimal for Decimal.D256;

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

    function rootsFor(uint32 bipId) public view returns (uint256) {
        return s.g.bips[bipId].roots;
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
        require(_init != address(0) || _calldata.length == 0, "Governance: calldata not empty.");
        uint32 bipId = s.g.bipIndex;
        s.g.bipIndex += 1;
        s.g.bips[bipId].start = season();
        s.g.bips[bipId].period = period;
        s.g.bips[bipId].timestamp = uint128(block.timestamp);
        s.g.bips[bipId].proposer = account;

        s.g.bips[bipId].pauseOrUnpause = pauseOrUnpause;
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
        s.g.bips[bipId].endTotalRoots = totalRoots();
        uint256 numberOfActiveBips = s.g.activeBips.length-1;
        if (i < numberOfActiveBips) s.g.activeBips[i] = s.g.activeBips[numberOfActiveBips];
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

    function isActive(uint32 bipId) internal view returns (bool) {
        return season() < startFor(bipId).add(periodFor(bipId));
    }

    function isExpired(uint32 bipId) internal view returns (bool) {
        return season() > startFor(bipId).add(periodFor(bipId)).add(C.getGovernanceExpiration());
    }

    function bipVotePercent(uint32 bipId) internal view returns (Decimal.D256 memory) {
        return Decimal.ratio(rootsFor(bipId), totalRoots());
    }

    function endedBipVotePercent(uint32 bipId) internal view returns (Decimal.D256 memory) {
        return Decimal.ratio(s.g.bips[bipId].roots,s.g.bips[bipId].endTotalRoots);
    }

    // Bip Proposition

    function canPropose(address account) internal view returns (bool) {
        if (totalRoots() == 0 || balanceOfRoots(account) == 0) {
            return false;
        }
        Decimal.D256 memory stake = Decimal.ratio(balanceOfRoots(account), totalRoots());
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

    function balanceOfRoots(address account) internal view returns (uint256) {
        return s.a[account].roots;
    }

    function totalRoots() internal view returns (uint256) {
        return s.s.roots;
    }

    function season() internal view returns (uint32) { return s.season.current; }

}
