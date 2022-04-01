/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import {AppStorage} from "../AppStorage.sol";

contract InitHotFix2 {
    AppStorage internal s;
    using SafeMath for uint256;

    event BeanDeposit(address indexed account, uint256 season, uint256 beans);
    event BeanRemove(address indexed account, uint32[] crates, uint256[] crateBeans, uint256 beans);

    function init() external {
        fixCrates(address(0xf393fb8C4BbF7e37f583D0593AD1d1b2443E205c), 4_294_966_636, 4_294_966_637);
        fixCrates(address(0x9893360c45EF5A51c3B38dcBDfe0039C80fd6f60), 4_294_966_632, 4_294_966_633);
        fixCrates(address(0xa69eb732230F041E62640Da3571F414a01413DB3), 4_294_966_902, 4_294_966_903);
        fixCrates(address(0xe0B54aa5E28109F6Aa8bEdcff9622D61a75E6B83), 4_294_966_559, 4_294_966_560);
        fixCrates(address(0xce66C6A88bD7BEc215Aa04FDa4CF7C81055521D0), 4_294_964_818, 4_294_964_819);
        fixCrates(address(0xb80A3488Bd3f1c5A2D6Fce9B095707ec62172Fb5), 4_294_965_127, 4_294_965_128);
        fixCrates(address(0x7cd222530d4D10E175c939F55c5dC394d51AaDaA), 4_294_965_826, 4_294_965_827);
        fixCrates(address(0x5d12B49c48F756524162BB35FFA61ECEb714280D), 4_294_936_176, 4_294_936_177);
        fixCrates(address(0x6343B307C288432BB9AD9003B4230B08B56b3b82), 4_294_966_454, 4_294_966_455);
        fixCrates(address(0x5068aed87a97c063729329c2ebE84cfEd3177F83), 4_294_953_598, 4_294_953_599);
        fixCrates(address(0x397eADFF98b18a0E8c1c1866b9e83aE887bAc1f1), 4_294_965_442, 4_294_965_443);
        fixCrates(address(0x3bD12E6C72B92C43BD1D2ACD65F8De2E0E335133), 4_294_846_387, 4_294_846_388);
        fixCrates(address(0x215B5b41E224fc24170dE2b20A3e0F619af96A71), 4_294_953_369, 4_294_953_370);
        fixCrates(address(0xFc748762F301229bCeA219B584Fdf8423D8060A1), 4_294_965_079, 4_294_965_080);
        fixCrates(address(0x8D84aA16d6852ee8E744a453a20f67eCcF6C019D), 4_294_966_011, 4_294_966_012);
        fixCrates(address(0xE0f61822B45bb03cdC581283287941517810D7bA), 4_294_966_192, 4_294_966_193);
        fixCrates(address(0x8639AFABa2631C7c09220B161D2b3d0d4764EF85), 4_294_957_800, 4_294_957_801);
        fixCrates(address(0xCc71b8a0B9ea458aE7E17fa232a36816F6B27195), 4_294_964_813, 4_294_964_814);
    }

    function fixCrates(address account, uint32 s1, uint32 s2) internal {
        uint256[] memory bs = new uint256[](2);
        bs[0] = removeBeanDeposit(account, s1);
        bs[1] = removeBeanDeposit(account, s2);
        uint32[] memory ss = new uint32[](2);
        ss[0] = s1; ss[1] = s2;
        uint256 beansRemoved = bs[0].add(bs[1]);
        emit BeanRemove(account, ss, bs, beansRemoved);
        addBeanDeposit(account, 1, beansRemoved);

    }

    function removeBeanDeposit(address account, uint32 id)
        private
        returns (uint256)
    {
        uint256 crateAmount = s.a[account].bean.deposits[id];
        delete s.a[account].bean.deposits[id];
        return crateAmount;
    }

    function addBeanDeposit(address account, uint32 _s, uint256 amount) internal {
        s.a[account].bean.deposits[_s] += amount;
        emit BeanDeposit(account, _s, amount);
    }
}
