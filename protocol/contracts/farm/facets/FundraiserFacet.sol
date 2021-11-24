/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./FieldFacet/Dibbler.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

/**
 * @author Publius
 * @title Funding Facet
**/
contract FundraiserFacet is Dibbler {

    using SafeMath for uint256;

    event CreateFundraiser(uint32 indexed id, address fundraiser, address token, uint256 amount);
    event FundFundraiser(address indexed account, uint32 indexed id, uint256 amount);
    event EndFundraiser(uint32 indexed id);

    function fund(uint256 amount, uint32 id) public returns (uint256) {
        _fund(amount, id);
        return _sow(amount, msg.sender);
    }

    function _fund(uint256 amount, uint32 id) internal {
        require(s.fundraisers[id].remaining >= amount, "Fundraiser: amounding exceeds remaining.");
        IERC20(s.fundraisers[id].token).transferFrom(msg.sender, address(this), amount);
        s.fundraisers[id].remaining = s.fundraisers[id].remaining.sub(amount);
        emit FundFundraiser(msg.sender, id, amount);
        
        if (s.fundraisers[id].remaining == 0) EndFundraiser(id);
    }

    function endFundraiser(uint32 id) internal {
        IERC20(s.fundraisers[id].token).transfer(s.fundraisers[id].payee, s.fundraisers[id].total);
        emit EndFundraiser(id);
    }

    function createFundraiser(address payee, address token, uint256 amount) public {
        require(msg.sender == address(this), "Fundraiser: sender must be Beanstalk.");
        uint32 id = s.fundraiserIndex;
        s.fundraisers[id].token = token;
        s.fundraisers[id].remaining = amount;
        s.fundraisers[id].total = amount;
        s.fundraisers[id].payee = payee;
        s.fundraiserIndex = id + 1;
        emit CreateFundraiser(id, payee, token, amount);
    }

    function remainingFunding(uint32 id) public view returns (uint256) {
        return s.fundraisers[id].remaining;
    }

    function totalFunding(uint32 id) public view returns (uint256) {
        return s.fundraisers[id].total;
    }

    function fundingToken(uint32 id) public view returns (address) {
        return s.fundraisers[id].token;
    }

}