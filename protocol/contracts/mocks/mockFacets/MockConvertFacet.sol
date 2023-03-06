/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../beanstalk/silo/ConvertFacet.sol";

/**
 * @author Publius
 * @title Mock Convert Facet
**/
contract MockConvertFacet is ConvertFacet {

    using SafeMath for uint256;

    event MockConvert(uint256 stalkRemoved, uint256 bdvRemoved);

    function withdrawForConvertE(
        address token,
        int128[] memory stems,
        uint256[] memory amounts,
        uint256 maxTokens
    ) external {
        (uint256 stalkRemoved, uint256 bdvRemoved) = _withdrawTokens(token, stems, amounts, maxTokens);
        console.log('MockConvert stalkRemoved: ', stalkRemoved);
        console.log('MockConvert bdvRemoved: ', bdvRemoved);
        emit MockConvert(stalkRemoved, bdvRemoved);
    }

    function depositForConvertE(
        address token, 
        uint256 amount, 
        uint256 bdv, 
        uint256 grownStalk
    ) external {
        _depositTokens(token, amount, bdv, grownStalk);
    }
}
