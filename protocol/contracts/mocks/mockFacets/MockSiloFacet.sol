/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../farm/facets/SiloFacet/SiloFacet.sol";

/**
 * @author Publius
 * @title Mock Silo Facet
**/

interface WhitelistSilo {
    function whitelistToken(address token, bytes4 selector, uint32 stalk, uint32 seeds) external;
}

contract MockSiloFacet is SiloFacet {

    using SafeMath for uint256;

    function mockWhitelistToken(address token, bytes4 selector, uint32 stalk, uint32 seeds) external {
        WhitelistSilo(address(this)).whitelistToken(token, selector, stalk, seeds);
    }

    function mockBDV(uint256 amount) external pure returns (uint256) {
        return amount;
    }

    function mockUnripeLPDeposit(uint256 t, uint32 _s, uint256 amount, uint256 bdv) external {
        update(msg.sender);
        if (t == 0) {
            s.a[msg.sender].lp.deposits[_s] += amount;
            s.a[msg.sender].lp.depositSeeds[_s] += bdv.mul(4);
        }
        else if (t == 1) LibTokenSilo.addDeposit(msg.sender, LibUnripeSilo.BEAN_3CURVE_ADDRESS, _s, amount, bdv);
        else if (t == 2) LibTokenSilo.addDeposit(msg.sender, LibUnripeSilo.BEAN_LUSD_ADDRESS, _s, amount, bdv);
        LibTokenSilo.incrementDepositedToken(LibUnripeSilo.UNRIPE_LP, bdv);
        bdv = bdv.mul(LibUnripeSilo.UNRIPE_LP_BDV).div(1e18);
        uint256 seeds = bdv.mul(s.ss[LibUnripeSilo.UNRIPE_LP].seeds);
        uint256 stalk = bdv.mul(s.ss[LibUnripeSilo.UNRIPE_LP].stalk).add(LibSilo.stalkReward(seeds, season() - _s));
        LibSilo.depositSiloAssets(msg.sender, seeds, stalk);
    }

    function mockUnripeBeanDeposit(uint32 _s, uint256 amount) external {
        update(msg.sender);
        s.a[msg.sender].bean.deposits[_s] += amount;
        LibTokenSilo.incrementDepositedToken(LibUnripeSilo.UNRIPE_BEAN, amount);
        amount = amount.mul(LibUnripeSilo.UNRIPE_BEAN_BDV).div(1e18);
        uint256 seeds = amount.mul(s.ss[LibUnripeSilo.UNRIPE_BEAN].seeds);
        uint256 stalk = amount.mul(s.ss[LibUnripeSilo.UNRIPE_BEAN].stalk).add(LibSilo.stalkReward(seeds, season() - _s));
        LibSilo.depositSiloAssets(msg.sender, seeds, stalk);
    }
}