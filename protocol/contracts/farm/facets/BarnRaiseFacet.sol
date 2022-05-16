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

    event ClaimBarnRaise(address account, uint256 beans);

    AppStorage internal s;

    uint256 private constant PRECISION = 1e18;

    function claimBR(LibTransfer.To mode) external payable {
        (uint256 beans, uint256 totalBeansPerBRToken) = _earnedBR(msg.sender);
        s.a[msg.sender].beansPerBRToken = totalBeansPerBRToken;
        LibTransfer.sendToken(C.bean(), beans, msg.sender, mode);
        emit ClaimBarnRaise(msg.sender, beans);
    }

    function claimableBR(address account) external view returns (uint256 beans) {
        (beans, ) = _earnedBR(account);
    }

    function totalPaidBR() external view returns (uint256 beans) {
        beans = s.brPaidBeans;
    }

    function totalOwedBR() external view returns (uint256 beans) {
        beans = s.brOwedBeans;
    }

    function totalBrTokens() external view returns (uint256 brTokens) {
        brTokens = s.brTokens;
    }

    function barnRaising() external view returns (bool _barnraising) {
        _barnraising = s.season.barnRaising;
    }

    function beansPerBRToken(address account) external view returns (uint256 _beansPerBRToken) {
        return s.a[account].beansPerBRToken;
    }

    function _earnedBR(address account)
        private
        view
        returns (uint256 beans, uint256 totalBeansPerToken)
    {
        totalBeansPerToken = s.brPaidBeans.mul(PRECISION).div(
            s.brTokens
        );
        uint256 _beansPerBRToken = totalBeansPerToken.sub(
            s.a[account].beansPerBRToken
        );
        uint256 brTokens = C.barnRaise().balanceOf(account);
        beans = _beansPerBRToken.mul(brTokens).div(PRECISION);
    }
}
