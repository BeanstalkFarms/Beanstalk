/*
 * SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./TokenSilo.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../ReentrancyGuard.sol";

/*
 * @author 0xm00neth
 * @title SiloV3Facet handles depositing, withdrawing and claiming whitelisted Silo tokens.
*/
contract SiloV3Facet is TokenSilo {

    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

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

    function withdraw(address token, uint256 amount) external updateSilo {
        _withdraw(token, amount);
        LibSilo.updateBalanceOfRainStalk(msg.sender);
    }

    /*
     * Claim
     */

    function claim(address token) external {
        _claim(token);
    }

    function _claim(address token) private {
        uint256 amount = removeTokenWithdrawals(msg.sender, token);
        IERC20(token).transfer(msg.sender, amount);
        emit Claim(msg.sender, token, amount);
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