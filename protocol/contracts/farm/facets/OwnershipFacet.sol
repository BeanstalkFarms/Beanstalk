// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import '../../seraph/SeraphProtected.sol';
import {LibDiamond} from "../../libraries/LibDiamond.sol";
import {AppStorage} from "../AppStorage.sol";

contract OwnershipFacet is SeraphProtected {

    AppStorage internal s;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function transferOwnership(address _newOwner) external withSeraph {
        LibDiamond.enforceIsContractOwner();
        s.ownerCandidate = _newOwner;
    }

    function claimOwnership() external {
        require(s.ownerCandidate == msg.sender, "Ownership: Not candidate");
        LibDiamond.setContractOwner(msg.sender);
        delete s.ownerCandidate;
    }

    function owner() external view returns (address owner_) {
        owner_ = LibDiamond.contractOwner();
    }

    function ownerCandidate() external view returns (address ownerCandidate_) {
        ownerCandidate_ = s.ownerCandidate;
    }

    function seraph() external pure returns (ISeraph __seraph) {
        __seraph = _seraph;
    }
}
