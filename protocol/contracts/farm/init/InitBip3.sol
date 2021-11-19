/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import {AppStorage} from "../AppStorage.sol";
import {IBean} from "../../interfaces/IBean.sol";

/**
 * @author Publius
 * @title InitBip3 runs the code for BIP-3.
**/
interface IBeanstalk {
    function sowBeans(uint256 amount) external returns (uint256);
    function transferPlot(address sender, address recipient, uint256 id, uint256 start, uint256 end) external;
}

contract InitBip3 {

    using SafeMath for uint256;

    AppStorage internal s;

    uint256 private constant payment = 240000000000; // 240,000 Beans
    uint256 private constant expenses = 60000000000; // 60,000 Beans
    address private constant fundraisingBudget = address(0x74d01F9dc15E92A9235DaA8f2c6F8bfAd9904858);

    function init() external {
        uint256 sowAmount = s.f.soil;
        if (s.f.soil >= payment) sowAmount = payment;
        uint256 beanAmount = payment.sub(sowAmount);

        IBean(s.c.bean).mint(fundraisingBudget, beanAmount.add(expenses));
        
        if (sowAmount > 0) {
            uint256 index = s.f.pods;
            IBean(s.c.bean).mint(address(this), sowAmount);
            IBean(s.c.bean).approve(address(this), sowAmount);
            uint256 pods = IBeanstalk(address(this)).sowBeans(sowAmount);
            IBeanstalk(address(this)).transferPlot(address(this), fundraisingBudget, index, 0, pods);
        }
    }
}