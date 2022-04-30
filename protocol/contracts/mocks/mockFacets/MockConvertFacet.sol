/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../farm/facets/ConvertFacet.sol";

/**
 * @author Publius
 * @title Mock Convert Facet
**/
contract MockConvertFacet is ConvertFacet {

    using SafeMath for uint256;

    event MockConvert(uint256 stalkRemoved);

    function withdrawForConvertE(
        address token,
        uint32[] memory seasons,
        uint256[] memory amounts,
        uint256 maxTokens
    ) external {
        (uint256 stalkRemoved) = _withdrawForConvert(token, seasons, amounts, maxTokens);
        emit MockConvert(stalkRemoved);
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
