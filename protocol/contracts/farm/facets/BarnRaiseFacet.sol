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

contract BarnRaiseFacet {
    using SafeMath for uint256;

    AppStorage internal s;

    uint256 private constant PRECISION = 1e18;

    function earnBR(address account, LibTransfer.To mode) external payable {
        (uint256 beans, uint256 totalBeansPerBRToken) = _earnedBR(account);
        s.a[account].beansPerBRToken = totalBeansPerBRToken;
        LibTransfer.sendToken(C.bean(), beans, account, mode);
    }

    function earnedBR(address account) external view returns (uint256 beans) {
        (beans, ) = _earnedBR(account);
    }

    function totalEarnedBR() external view returns (uint256 beans) {
        beans = s.brEarnedBeans;
    }

    function totalBrTokens() external view returns (uint256 brTokens) {
        brTokens = s.brTokens;
    }

    function barnRaising() external view returns (bool _barnraising) {
        _barnraising = s.season.barnRaising;
    }

    function _earnedBR(address account)
        private
        view
        returns (uint256 beans, uint256 totalBeansPerToken)
    {
        totalBeansPerToken = s.brEarnedBeans.mul(PRECISION).div(
            s.brTokens
        );
        uint256 beansPerBRToken = totalBeansPerToken.sub(
            s.a[account].beansPerBRToken
        );
        uint256 brTokens = C.sprout().balanceOf(account);
        beans = beansPerBRToken.mul(brTokens).div(PRECISION);
    }
}
