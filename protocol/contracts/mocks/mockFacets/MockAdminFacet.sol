/*
 SPDX-License-Identifier: MIT
*/
pragma solidity ^0.8.20;

import "contracts/C.sol";
import "contracts/libraries/Token/LibTransfer.sol";
import "contracts/beanstalk/sun/SeasonFacet/SeasonFacet.sol";
import "contracts/beanstalk/sun/SeasonFacet/Sun.sol";
import {LibCurveMinting} from "contracts/libraries/Minting/LibCurveMinting.sol";
import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";
import {LibBalance} from "contracts/libraries/Token/LibBalance.sol";
import {Storage} from "contracts/beanstalk/AppStorage.sol";

/**
 * @author Publius
 * @title MockAdminFacet provides various mock functionality
 **/

contract MockAdminFacet is Sun {
    function mintBeans(address to, uint256 amount) external {
        C.bean().mint(to, amount);
    }

    function ripen(uint256 amount) external {
        C.bean().mint(address(this), amount);
        receiveShipment(Storage.ShipmentRecipient.Field, amount, abi.encode(uint256(0)));
    }

    function fertilize(uint256 amount) external {
        C.bean().mint(address(this), amount);
        receiveShipment(Storage.ShipmentRecipient.Barn, amount, bytes(""));
    }

    function rewardSilo(uint256 amount) external {
        C.bean().mint(address(this), amount);
        receiveShipment(Storage.ShipmentRecipient.Silo, amount, bytes(""));
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
        ship(amount);
    }

    function fertilizerSunrise(uint256 amount) public {
        updateStart();
        s.season.current += 1;
        C.bean().mint(address(this), amount);
        receiveShipment(Storage.ShipmentRecipient.Barn, amount * 3, bytes(""));
    }

    function updateStart() private {
        SeasonFacet sf = SeasonFacet(address(this));
        int256 sa = int256(uint256(s.season.current - sf.seasonTime()));
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
            s.siloSettings[siloTokens[i]].milestoneStem = int96(
                s.siloSettings[siloTokens[i]].milestoneStem * 1e6
            );
        }
    }

    function upgradeStems() public {
        updateStemScaleSeason(uint16(s.season.current));
        updateStems();
    }
}
