/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./FieldFacet/Dibbler.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
/**
 * @author Publius
 * @title Funding Facet
**/
contract FundraiserFacet is Dibbler {

    using SafeMath for uint256;

    event CreateFundraiser(address indexed fundraiser, address token, uint256 amount);
    event FundFundraiser(address indexed account, address indexed fundraiser, uint256 amount);
    event EndFundraiser(address indexed fundraiser);

    function fundAndSow(uint256 amount, address fundraiser) public returns (uint256) {
        fund(amount, fundraiser);
        return _sow(amount, msg.sender);
    }

    function fund(uint256 amount, address fundraiser) internal {
        require(s.fundraisers[fundraiser].remaining >= amount, "Fundraiser: amounding exceeds remaining.");
        IERC20(s.fundraisers[fundraiser].token).transferFrom(msg.sender, address(this), amount);
        s.fundraisers[fundraiser].remaining = s.fundraisers[fundraiser].remaining.sub(amount);
        emit FundFundraiser(msg.sender, fundraiser, amount);
        
        if (s.fundraisers[fundraiser].remaining == 0) EndFundraiser(fundraiser);
    }

    function endFundraiser(address fundraiser) internal {
        IERC20(s.fundraisers[fundraiser].token).transfer(fundraiser, s.fundraisers[fundraiser].total);
        emit EndFundraiser(fundraiser);
    }

    function createFundraiser(address fundraiser, address token, uint256 amount) public {
        require(msg.sender == address(this), "Fundraiser: sender must be Beanstalk.");
        s.fundraisers[fundraiser].token = token;
        s.fundraisers[fundraiser].remaining = amount;
        s.fundraisers[fundraiser].total = amount;
        emit CreateFundraiser(fundraiser, token, amount);
    }

    function remainingFunding(address fund) public view returns (uint256) {
        return s.fundraisers[fund].remaining;
    }

    function totalFunding(address fund) public view returns (uint256) {
        return s.fundraisers[fund].total;
    }

    function fundingToken(address fund) public view returns (address) {
        return s.fundraisers[fund].token;
    }

}