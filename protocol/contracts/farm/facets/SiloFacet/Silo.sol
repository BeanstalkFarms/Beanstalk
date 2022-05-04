/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./SiloExit.sol";
import "../../../libraries/LibInternal.sol";
import "../../../libraries/Silo/LibSilo.sol";
import "../../../libraries/Silo/LibTokenSilo.sol";
import "hardhat/console.sol";

/**
 * @author Publius
 * @title Silo Entrance
**/
contract Silo is SiloExit {

    using SafeMath for uint256;

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    uint256 private _status = 1;

    /**
     * Update
    **/

    function update(address account) public payable {
        uint32 _update = lastUpdate(account);
        if (_update >= season()) return;
        earnSops(account, _update);
        earnGrownStalk(account);
        s.a[account].lastUpdate = season();
    }

    function earn(address account) external payable {
        update(account);
        uint256 accountStalk = s.a[account].s.stalk;
        uint256 beans = _balanceOfEarnedBeans(account, accountStalk);
        if (beans == 0) return;
        s.si.beans = s.si.beans.sub(beans);
        uint256 seeds = beans.mul(C.getSeedsPerBean());
        LibSilo.incrementBalanceOfSeeds(account, seeds);
        s.a[account].s.stalk = accountStalk.add(beans.mul(C.getStalkPerBean()));
        LibTokenSilo.addDeposit(account, C.beanAddress(), season(), beans, beans.mul(C.getStalkPerBean()));
    }

    function earnGrownStalk(address account) private {
        if (s.a[account].s.seeds == 0) return;
        LibSilo.incrementBalanceOfStalk(account, balanceOfGrownStalk(account));
    }

    function earnSops(address account, uint32 _update) internal {
        if (s.a[account].roots == 0) {
            s.a[account].lastSop = s.r.start;
            s.a[account].lastRain = 0;
            return;
        }
        if (s.sop.last > _update || s.sops[s.a[account].lastRain] > 0) {
            s.a[account].sop.base = balanceOfPlentyBase(account);
            s.a[account].lastSop = s.sop.last;
        }
        if (s.r.raining) {
            if (s.r.start > _update) {
                s.a[account].lastRain = s.r.start;
                s.a[account].sop.roots = s.a[account].roots;
            }
            if (s.sop.last == s.r.start) s.a[account].sop.basePerRoot = s.sops[s.sop.last];
        } else if (s.a[account].lastRain > 0) {
            s.a[account].lastRain = 0;
        }
    }

    modifier updateSilo() {
        update(msg.sender);
        _;
    }
}
