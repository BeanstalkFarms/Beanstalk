/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage} from "../AppStorage.sol";
import "../../libraries/Token/LibTransfer.sol";
import "../../libraries/LibFertilizer.sol";
import "../../C.sol";
import {LibDiamond} from "../../libraries/LibDiamond.sol";

/**
 * @author Publius
 * @title Handles Sprouting Beans from Sprout Tokens
 **/

contract FertilizerFacet {
    using LibSafeMath32 for uint32;
    using SafeMath for uint256;

    event SetFertilizer(uint32 id, uint32 bpf);

    AppStorage internal s;

    function fertilize(uint256[] calldata ids, LibTransfer.To mode) external {
        uint256 amount = C.fertilizer().beanstalkUpdate(msg.sender, ids, s.bpf);
        LibTransfer.sendToken(C.bean(), amount, msg.sender, mode);
    }

    function mintFertilizer(uint128 amount, uint256 minLP, LibTransfer.From mode) external {
        uint256 remaining = LibFertilizer.remainingRecapitalization();
        uint256 _amount = uint256(amount);
        if (_amount > remaining) _amount = remaining;
        LibTransfer.receiveToken(C.usdc(), uint256(amount).mul(1e6), msg.sender, mode);
        uint32 id = LibFertilizer.addFertilizer(s.season.current, amount, minLP);
        C.fertilizer().beanstalkMint(msg.sender, uint256(id), amount, s.bpf);
    }

    function addFertilizerOwner(uint32 season, uint128 amount, uint256 minLP) external {
        LibDiamond.enforceIsContractOwner();
        C.usdc().transferFrom(msg.sender, address(this), uint256(amount).mul(1e6));
        LibFertilizer.addFertilizer(season, amount, minLP);
    }

    function payFertilizer(address account, uint256 amount) external {
        require(msg.sender == C.fertilizerAddress());
        LibTransfer.sendToken(C.bean(), amount, account, LibTransfer.To.INTERNAL);
    }

    function totalFertilizedBeans() external view returns (uint256 beans) {
        return s.fertilizedIndex;
    }

    function totalUnfertilizedBeans() external view returns (uint256 beans) {
        return s.unfertilizedIndex - s.fertilizedIndex;
    }

    function totalFertilizerBeans() external view returns (uint256 beans) {
        return s.unfertilizedIndex;
    }

    function getFertilizer(uint32 id) external view returns (uint256) {
        return s.fertilizer[id];
    }

    function getNext(uint32 id) external view returns (uint32) {
        return LibFertilizer.getNext(id);
    }

    function getFirst() external view returns (uint32) {
        return s.fFirst;
    }

    function getLast() external view returns (uint32) {
        return s.fLast;
    }

    function getActiveFertilizer() external view returns (uint256) {
        return s.activeFertilizer;
    }

    function isFertilizing() external view returns (bool) {
        return s.season.fertilizing;
    }

    function beansPerFertilizer() external view returns (uint32 bpf) {
        return s.bpf;
    }

    function getHumidity(uint32 id) public pure returns (uint32 humidity) {
        humidity = LibFertilizer.getHumidity(id);
    }

    function getEndBpf() external view returns (uint32 endBpf) {
        endBpf = s.bpf.add(LibFertilizer.getBpf(s.season.current));
    }

    function remainingRecapitalization() external view returns (uint256) {
        return LibFertilizer.remainingRecapitalization();
    }

    function balanceOfUnfertilized(address account, uint256[] memory ids) external view returns (uint256 beans) {
        return C.fertilizer().balanceOfUnfertilized(account, ids);
    }

    function balanceOfFertilized(address account, uint256[] memory ids) external view returns (uint256 beans) {
        return C.fertilizer().balanceOfFertilized(account, ids);
    }

    function balanceOfFertilizer(address account, uint256 id) external view returns (IFertilizer.Balance memory) {
        return C.fertilizer().lastBalanceOf(account, id);
    }

    function balanceOfBatchFertilizer(address[] memory accounts, uint256[] memory ids) external view returns (IFertilizer.Balance[] memory) {
        return C.fertilizer().lastBalanceOfBatch(accounts, ids);
    }
}