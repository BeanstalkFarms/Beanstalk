/*
 SPDX-License-Identifier: MIT
*/
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "contracts/C.sol";
import "contracts/libraries/Token/LibTransfer.sol";
import "contracts/beanstalk/sun/SeasonFacet/SeasonFacet.sol";
import "contracts/beanstalk/sun/SeasonFacet/Sun.sol";
import {LibCurveMinting} from "contracts/libraries/Minting/LibCurveMinting.sol";
import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";
import {Invariable} from "contracts/beanstalk/Invariable.sol";
import {LibBalance} from "contracts/libraries/Token/LibBalance.sol";

/**
 * @author Publius
 * @title MockAdminFacet provides various mock functionality
 **/

contract MockAdminFacet is Sun, Invariable {
    function mintBeans(address to, uint256 amount) external {
        C.bean().mint(to, amount);
    }

    function ripen(uint256 amount) external {
        C.bean().mint(address(this), amount);
        rewardToHarvestable(amount);
    }

    function fertilize(uint256 amount) external {
        C.bean().mint(address(this), amount);
        rewardToFertilizer(amount);
    }

    function rewardSilo(uint256 amount) external {
        C.bean().mint(address(this), amount);
        rewardToSilo(amount);
    }

    function forceSunrise() external {
        updateStart();
        SeasonFacet sf = SeasonFacet(address(this));
        sf.sunrise();
    }

    function rewardSunrise(uint256 amount) public {
        updateStart();
        s.season.current += 1;
        C.bean().mint(address(this), amount);
        rewardBeans(amount);
    }

    function fertilizerSunrise(uint256 amount) public {
        updateStart();
        s.season.current += 1;
        C.bean().mint(address(this), amount);
        rewardToFertilizer(amount * 3);
    }

    function updateStart() private {
        SeasonFacet sf = SeasonFacet(address(this));
        int256 sa = s.season.current - sf.seasonTime();
        if (sa >= 0) s.season.start -= 3600 * (uint256(sa) + 1);
    }

    function update3CRVOracle() public {
        LibCurveMinting.updateOracle();
    }

    function updateStemScaleSeason(uint16 season) public {
        s.season.stemScaleSeason = season;
    }

    function updateStems() public {
        address[] memory siloTokens = LibWhitelistedTokens.getSiloTokens();
        for (uint256 i = 0; i < siloTokens.length; i++) {
            s.ss[siloTokens[i]].milestoneStem = int96(s.ss[siloTokens[i]].milestoneStem * 1e6);
        }
    }

    function upgradeStems() public {
        updateStemScaleSeason(uint16(s.season.current));
        updateStems();
    }

    // function getInternalTokenBalanceTotal(address token) public view returns (uint256) {
    //     return s.internalTokenBalanceTotal[token];
    // }

    // function getFertilizedPaidIndex(address token) public view returns (uint256) {
    //     return s.fertilizedPaidIndex;
    // }

    // function getPlenty() public view returns (uint256) {
    //     return s.plenty;
    // }

    // Internal token accounting exploits.

    function exploitUserInternalTokenBalance() public fundsSafu {
        LibBalance.increaseInternalBalance(msg.sender, IERC20(C.UNRIPE_LP), 100_000_000);
    }

    function exploitUserSendTokenInternal() public fundsSafu {
        LibTransfer.sendToken(
            IERC20(C.BEAN_ETH_WELL),
            100_000_000_000,
            msg.sender,
            LibTransfer.To.INTERNAL
        );
    }

    function exploitFertilizer() public fundsSafu {
        s.fertilizedIndex += 100_000_000_000;
    }

    function exploitSop(address sopWell) public fundsSafu {
        s.sopWell = sopWell;
        s.plenty = 100_000_000;
    }

    // Token flow exploits.

    function exploitTokenBalance() public noNetFlow {
        C.bean().transferFrom(msg.sender, address(this), 1_000_000);
    }

    function exploitUserSendTokenExternal0() public noNetFlow {
        LibTransfer.sendToken(IERC20(C.BEAN), 10_000_000_000, msg.sender, LibTransfer.To.EXTERNAL);
    }

    function exploitUserSendTokenExternal1() public noOutFlow {
        LibTransfer.sendToken(IERC20(C.BEAN), 10_000_000_000, msg.sender, LibTransfer.To.EXTERNAL);
    }

    function exploitUserDoubleSendTokenExternal() public oneOutFlow(C.BEAN) {
        LibTransfer.sendToken(IERC20(C.BEAN), 10_000_000_000, msg.sender, LibTransfer.To.EXTERNAL);
        LibTransfer.sendToken(
            IERC20(C.UNRIPE_LP),
            10_000_000,
            msg.sender,
            LibTransfer.To.EXTERNAL
        );
    }

    function exploitBurnStalk0() public noNetFlow {
        s.s.stalk -= 1_000_000_000;
    }

    function exploitBurnStalk1() public noOutFlow {
        s.s.stalk -= 1_000_000_000;
    }

    // Bean supply exploits.

    function exploitBurnBeans() public noSupplyChange {
        C.bean().burn(100_000_000);
    }

    function exploitMintBeans0() public noSupplyChange {
        C.bean().mint(msg.sender, 100_000_000);
    }

    function exploitMintBeans1() public noSupplyChange {
        C.bean().mint(address(this), 100_000_000);
    }

    function exploitMintBeans2() public noSupplyIncrease {
        C.bean().mint(msg.sender, 100_000_000);
    }

    function exploitMintBeans3() public noSupplyIncrease {
        C.bean().mint(address(this), 100_000_000);
    }
}
