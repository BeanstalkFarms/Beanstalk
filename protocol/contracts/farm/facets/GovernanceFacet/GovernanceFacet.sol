/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./VotingBooth.sol";
import "../../../interfaces/IBean.sol";
import "../../../libraries/LibInternal.sol";
import "../../../libraries/LibIncentive.sol";

/**
 * @author Publius
 * @title Governance handles propsing, voting for and committing BIPs as well as pausing/unpausing.
**/
contract GovernanceFacet is VotingBooth {

    using SafeMath for uint256;
    using SafeMath for uint32;
    using Decimal for Decimal.D256;

    event Proposal(address indexed account, uint32 indexed bip, uint256 indexed start, uint256 period);
    event Vote(address indexed account, uint32 indexed bip, uint256 stalk, uint256 seeds);
    event Unvote(address indexed account, uint32 indexed bip, uint256 stalk, uint256 seeds);
    event Commit(address indexed account, uint32 indexed bip);
    event Incentivization(address indexed account, uint256 beans);
    event Pause(address account, uint256 timestamp);
    event Unpause(address account, uint256 timestamp, uint256 timePassed);

    /**
     * Proposition
    **/

    function propose(
        IDiamondCut.FacetCut[] calldata _diamondCut,
        address _init,
        bytes calldata _calldata,
        uint8 _pauseOrUnpause
    )
        external
    {
        require(canPropose(msg.sender), "Governance: Not enough Stalk.");
        require(notTooProposed(msg.sender), "Governance: Too many active BIPs.");
        require(
            _init != address(0) || _diamondCut.length > 0 || _pauseOrUnpause > 0,
            "Governance: Proposition is empty."
        );

        uint32 bipId = createBip(
            _diamondCut,
            _init,
            _calldata,
            _pauseOrUnpause,
            C.getGovernancePeriod(),
            msg.sender
        );

        emit Proposal(msg.sender, bipId, season(), C.getGovernancePeriod());

        vote(bipId);
    }

    /**
     * Voting
    **/

    function vote(uint32 bip) public {
        require(isNominated(bip), "Governance: Not nominated.");
        require(balanceOfStalk(msg.sender) > 0, "Governance: Must have Stalk.");
        require(isActive(bip), "Governance: Ended.");
        require(!voted(msg.sender, bip), "Governance: Already voted.");

        updateBip(bip);
        LibInternal.updateSilo(msg.sender);

        recordVote(msg.sender, bip);
        placeLock(msg.sender, bip);

        emit Vote(msg.sender, bip, balanceOfStalk(msg.sender), balanceOfSeeds(msg.sender));
    }

    function unvote(uint32 bip) external {
        require(isNominated(bip), "Governance: Not nominated.");
        require(balanceOfStalk(msg.sender) > 0, "Governance: Must have Stalk.");
        require(isActive(bip), "Governance: Ended.");
        require(voted(msg.sender, bip), "Governance: Not voted.");
        require(proposer(bip) != msg.sender, "Governance: Is proposer.");

        updateBip(bip);
        LibInternal.updateSilo(msg.sender);
        unrecordVote(msg.sender, bip);
        removeLock(msg.sender, bip);

        emit Unvote(msg.sender, bip, balanceOfStalk(msg.sender), balanceOfSeeds(msg.sender));
    }

    /**
     * Execution
    **/

    function commit(uint32 bip) external {
        require(isNominated(bip), "Governance: Not nominated.");
        require(!isActive(bip), "Governance: Not ended.");
        require(!isExpired(bip), "Governance: Expired.");
        require(
            endedBipVotePercent(bip).greaterThanOrEqualTo(C.getGovernancePassThreshold()),
            "Governance: Must have majority."
        );

        cutBip(bip);
        pauseOrUnpauseBip(bip);
        s.g.bips[bip].executed = true;

        incentivize(msg.sender, true, bip, C.getCommitIncentive());
        emit Commit(msg.sender, bip);
    }

    function emergencyCommit(uint32 bip) external {
        require(isNominated(bip), "Governance: Not nominated.");
        require(
            block.timestamp >= timestamp(bip).add(C.getGovernanceEmergencyPeriod()),
            "Governance: Too early.");
        require(isActive(bip), "Governance: Ended.");
        require(
            bipVotePercent(bip).greaterThanOrEqualTo(C.getGovernanceEmergencyThreshold()),
            "Governance: Must have super majority."
        );

        cutBip(bip);
        pauseOrUnpauseBip(bip);

        endBip(bip);
        s.g.bips[bip].executed = true;

        incentivize(msg.sender, false, bip, C.getCommitIncentive());
        emit Commit(msg.sender, bip);
    }

    function pauseOrUnpause(uint32 bip) external {
        require(isNominated(bip), "Governance: Not nominated.");
        require(diamondCutIsEmpty(bip),"Governance: Has diamond cut.");
        require(isActive(bip), "Governance: Ended.");
        require(
            bipVotePercent(bip).greaterThanOrEqualTo(C.getGovernanceEmergencyThreshold()),
            "Governance: Must have super majority."
        );

        pauseOrUnpauseBip(bip);

        endBip(bip);
        s.g.bips[bip].executed = true;

        incentivize(msg.sender, false, bip, C.getCommitIncentive());
        emit Commit(msg.sender, bip);
    }

    function incentivize(address account, bool compound, uint32 bipId, uint256 amount) private {
        if (compound) amount = LibIncentive.fracExp(amount, 100, incentiveTime(bipId), 2);
        IBean(s.c.bean).mint(account, amount);
        emit Incentivization(account, amount);
    }

    /**
     * Update
    **/

    function updateBip(uint32 bipId) public payable {
        require(!isEnded(bipId), "Governance: BIP ended.");
        uint32 updated = s.g.bips[bipId].updated;

        if (updated < s.season.current) {
            if (updated < s.si.lastSupplyIncrease) {
                (uint256 increaseBase, uint256 stalkBase) = increaseBasesFor(bipId);
                s.g.bips[bipId].increaseBase = increaseBase;
                s.g.bips[bipId].stalkBase = stalkBase;
            }
            s.g.bips[bipId].stalk = s.g.bips[bipId].stalk.add(rewardedStalkFor(bipId));
            s.g.bips[bipId].updated = s.season.current;
        }
    }

    /**
     * Pause / Unpause
    **/

    function ownerPause() external {
        LibDiamond.enforceIsContractOwner();
        pause();
    }

    function ownerUnpause() external {
        LibDiamond.enforceIsContractOwner();
        unpause();
    }

    function pause() private {
        if (s.paused) return;
        s.paused = true;
        s.o.initialized = false;
        s.pausedAt = uint128(block.timestamp);
        emit Pause(msg.sender, block.timestamp);
    }

    function unpause() private {
        if (!s.paused) return;
        s.paused = false;
        uint256 timePassed = block.timestamp.sub(uint(s.pausedAt));
        timePassed = (timePassed.div(3600).add(1)).mul(3600);
        s.season.start = s.season.start.add(timePassed);
        emit Unpause(msg.sender, block.timestamp, timePassed);
    }

    function pauseOrUnpauseBip(uint32 bipId) private {
        if (s.g.bips[bipId].pauseOrUnpause == 1) pause();
        else if (s.g.bips[bipId].pauseOrUnpause == 2) unpause();
    }

}
