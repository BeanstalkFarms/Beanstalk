/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage} from "../AppStorage.sol";
import "../../libraries/Token/LibTransfer.sol";
import "../../C.sol";

/**
 * @author Publius
 * @title Handles Sprouting Beans from Sprout Tokens
 **/

contract SproutFacet {
    using SafeMath for uint256;

    AppStorage internal s;

    uint256 private constant PRECISION = 1e18;

    function sprout(address account, LibTransfer.To mode) external {
        (uint256 beans, uint256 totalBeansPerSprout) = _sprouted(account);
        s.a[account].beansPerSprout = totalBeansPerSprout;
        LibTransfer.sendToken(C.bean(), beans, account, mode);
    }

    function sprouted(address account) external view returns (uint256 beans) {
        (beans, ) = _sprouted(account);
    }

    function totalSprouted() external view returns (uint256 beans) {
        beans = s.sproutedBeans;
    }

    function totalSprouts() external view returns (uint256 sprouts) {
        sprouts = s.totalSprouts;
    }

    function sprouting() external view returns (bool _sprouting) {
        _sprouting = s.season.sprouting;
    }

    function _sprouted(address account)
        private
        view
        returns (uint256 beans, uint256 totalBeansPerSprout)
    {
        totalBeansPerSprout = s.sproutedBeans.mul(PRECISION).div(
            s.totalSprouts
        );
        uint256 beansPerSprout = totalBeansPerSprout.sub(
            s.a[account].beansPerSprout
        );
        uint256 sprouts = C.sprout().balanceOf(account);
        beans = beansPerSprout.mul(sprouts).div(PRECISION);
    }
}
