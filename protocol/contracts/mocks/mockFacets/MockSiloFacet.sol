/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../farm/facets/SiloFacet/SiloFacet.sol";
import "../../libraries/Silo/LibWhitelist.sol";
import "../../libraries/Token/LibTransfer.sol";

/**
 * @author Publius
 * @title Mock Silo Facet
**/

contract MockSiloFacet is SiloFacet {

    uint256 constant private AMOUNT_TO_BDV_BEAN_ETH = 119894802186829;
    uint256 constant private AMOUNT_TO_BDV_BEAN_3CRV = 992035;
    uint256 constant private AMOUNT_TO_BDV_BEAN_LUSD = 983108;

    using SafeMath for uint256;

    function mockWhitelistToken(address token, bytes4 selector, uint32 stalk, uint32 seeds) external {
       LibWhitelist.whitelistToken(token, selector, stalk, seeds);
    }

    function mockBDV(uint256 amount) external pure returns (uint256) {
        return amount;
    }

    function mockBDVIncrease(uint256 amount) external pure returns (uint256) {
        return amount.mul(3).div(2);
    }

    function mockUnripeLPDeposit(uint256 t, uint32 _s, uint256 amount, uint256 bdv) external {
        _update(msg.sender);
        if (t == 0) {
            s.a[msg.sender].lp.deposits[_s] += amount;
            s.a[msg.sender].lp.depositSeeds[_s] += bdv.mul(4);
        }
        else if (t == 1) LibTokenSilo.addDepositToAccount(msg.sender, C.unripeLPPool1(), _s, amount, bdv);
        else if (t == 2) LibTokenSilo.addDepositToAccount(msg.sender, C.unripeLPPool2(), _s, amount, bdv);
        uint256 unripeLP = getUnripeForAmount(t, amount);
        LibTokenSilo.incrementTotalDeposited(C.unripeLPAddress(), unripeLP);
        bdv = bdv.mul(C.initialRecap()).div(1e18);
        uint256 seeds = bdv.mul(s.ss[C.unripeLPAddress()].seeds);
        uint256 stalk = bdv.mul(s.ss[C.unripeLPAddress()].stalk).add(LibSilo.stalkReward(seeds, season() - _s));
        LibSilo.mintSeedsAndStalk(msg.sender, seeds, stalk);
        LibTransfer.receiveToken(IERC20(C.unripeLPAddress()), unripeLP, msg.sender, LibTransfer.From.EXTERNAL);

    }
    
    function mockUnripeBeanDeposit(uint32 _s, uint256 amount) external {
        _update(msg.sender);
        s.a[msg.sender].bean.deposits[_s] += amount;
        LibTokenSilo.incrementTotalDeposited(C.unripeBeanAddress(), amount);
        amount = amount.mul(C.initialRecap()).div(1e18);
        uint256 seeds = amount.mul(s.ss[C.unripeBeanAddress()].seeds);
        uint256 stalk = amount.mul(s.ss[C.unripeBeanAddress()].stalk).add(LibSilo.stalkReward(seeds, season() - _s));
        LibSilo.mintSeedsAndStalk(msg.sender, seeds, stalk);
        LibTransfer.receiveToken(IERC20(C.unripeBeanAddress()), amount, msg.sender, LibTransfer.From.EXTERNAL);
    }

    function getUnripeForAmount(uint256 t, uint256 amount) private pure returns (uint256) {
        if (t == 0) return amount.mul(AMOUNT_TO_BDV_BEAN_ETH).div(1e18);
        else if (t == 1) return amount.mul(AMOUNT_TO_BDV_BEAN_3CRV).div(1e18);
        else return amount.mul(AMOUNT_TO_BDV_BEAN_LUSD).div(1e18);
    }
}