/*
 * SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./TokenSilo.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../ReentrancyGuard.sol";

/*
 * @author Publius
 * @title SiloV2Facet handles depositing, withdrawing and claiming whitelisted Silo tokens.
*/
contract SiloV2Facet is TokenSilo {

    event BeanAllocation(address indexed account, uint256 beans);

    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

    struct SeasonClaim {
        address token;
        uint32 season;
    }

    struct SeasonsClaim {
        address token;
        uint32[] seasons;
    }

    struct WithdrawSeason {
        address token;
        uint32 season;
        uint256 amount;
    }

    struct WithdrawSeasons {
        address token;
        uint32[] seasons;
        uint256[] amounts;
    }

    /*
     * Deposit
     */

    function deposit(address token, uint256 amount) external updateSiloNonReentrant {
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        _deposit(token, amount);
    }

    /*
     * Withdraw
     */

    function withdrawTokenBySeason(address token, uint32 season, uint256 amount) 
        external 
        updateSilo 
    {
        _withdrawDeposit(token, season, amount);
        LibSilo.updateBalanceOfRainStalk(msg.sender);
    }

    function withdrawTokenBySeasons(address token, uint32[] calldata seasons, uint256[] calldata amounts) 
        external 
        updateSilo 
    {
        _withdrawDeposits(token, seasons, amounts);
        LibSilo.updateBalanceOfRainStalk(msg.sender);
    }

    function withdrawTokensBySeason(WithdrawSeason[] calldata withdraws) external updateSilo {
        for (uint256 i = 0; i < withdraws.length; i++) {
            _withdrawDeposit(withdraws[i].token, withdraws[i].season, withdraws[i].amount);
        }
        LibSilo.updateBalanceOfRainStalk(msg.sender);
    }

    function withdrawTokensBySeasons(WithdrawSeasons[] calldata withdraws) external updateSilo {
        for (uint256 i = 0; i < withdraws.length; i++) {
            _withdrawDeposits(withdraws[i].token, withdraws[i].seasons, withdraws[i].amounts);
        }
        LibSilo.updateBalanceOfRainStalk(msg.sender);
    }

    /*
     * Claim
     */

    function claimTokenBySeason(address token, uint32 season) external {
        _claimTokenBySeason(token, season);
    }

    function claimTokenBySeasons(address token, uint32[] calldata seasons) external {
        _claimTokenBySeasons(token, seasons);
    }

    function claimTokensBySeason(SeasonClaim[] calldata claims) external {
        for (uint256 i = 0; i < claims.length; i++) {
            _claimTokenBySeason(claims[i].token, claims[i].season);
        }
    }

    function claimTokensBySeasons(SeasonsClaim[] calldata claims) external {
        for (uint256 i = 0; i < claims.length; i++) {
            _claimTokenBySeasons(claims[i].token, claims[i].seasons);
        }
    }

    function _claimTokenBySeasons(address token, uint32[] calldata seasons) private {
        uint256 amount = removeTokenWithdrawals(msg.sender, token, seasons);
        IERC20(token).transfer(msg.sender, amount);
        emit ClaimSeasons(msg.sender, token, seasons, amount);
    }

    function _claimTokenBySeason(address token, uint32 season) private {
        uint256 amount = removeTokenWithdrawal(msg.sender, token, season);
        IERC20(token).transfer(msg.sender, amount);
        emit ClaimSeason(msg.sender, token, season, amount);
    }

    /*
     * Whitelist
     */

    function whitelistToken(address token, bytes4 selector, uint32 stalk, uint32 seeds) external {
        require(msg.sender == address(this), "Silo: Only Beanstalk can whitelist tokens.");
        s.ss[token].selector = selector;
        s.ss[token].stalk = stalk;
        s.ss[token].seeds = seeds;
    }

    function tokenSettings(address token) external view returns (Storage.SiloSettings memory) {
        return s.ss[token];
    }
}