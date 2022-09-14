/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../../tokens/ERC20/WellToken.sol";
import "./Type/LibWellType.sol";

/**
 * @author Publius
 * @title Lib Well Building
 **/
library LibWellBuilding {
    using SafeMath for uint256;

    event BuildWell(
        address wellId,
        IERC20[] tokens,
        LibWellType.WellType wellType,
        bytes typeData,
        bytes32 wellHash
    );

    event ModifyWell(
        address wellId,
        LibWellType.WellType newWellType,
        bytes newTypeData,
        bytes32 oldWellHash,
        bytes32 newWellHash
    );

    /**
     * Management
     **/

    function buildWell(
        IERC20[] calldata tokens,
        LibWellType.WellType wellType,
        bytes calldata typeData,
        string[] calldata symbols
    ) internal returns (address wellId) {
        require(isWellValid(tokens, wellType, typeData), "LibWell: Well not valid.");
        LibWellStorage.WellStorage storage s = LibWellStorage.wellStorage();

        require(tokens.length < 9, "LibWell: 8 Tokens max");

        string memory name = symbols[0];
        string memory symbol = symbols[0];
        for (uint i = 1; i < tokens.length; ++i) {
            name = string(abi.encodePacked(name, ":", symbols[i]));
            symbol = string(abi.encodePacked(symbol, symbols[i]));
        }
        wellId = address(new WellToken(name, symbol));

        LibWellStorage.WellInfo memory w;
        w.tokens = tokens;
        w.wellType = wellType;
        w.typeData = typeData;
        w.wellId = wellId;

        LibWellType.registerIfNeeded(wellType);
        bytes32 wh = LibWellStorage.computeWellHash(w);

        s.indices[s.numberOfWells] = wellId;
        s.numberOfWells = s.numberOfWells.add(1);

        s.wi[wellId] = w;
        s.wh[wellId] = wh;

        emit BuildWell(w.wellId, w.tokens, w.wellType, w.typeData, wh);
    }

    function modifyWell(
        LibWellStorage.WellInfo memory w,
        LibWellType.WellType newWellType,
        bytes calldata newTypeData
    ) internal {
        LibWellStorage.WellStorage storage s = LibWellStorage.wellStorage();
        bytes32 prevWH = LibWellStorage.computeWellHash(w);
        w.wellType = newWellType;
        w.typeData = newTypeData;

        bytes32 newWH = LibWellStorage.computeWellHash(w);

        s.wi[w.wellId] = w;
        s.wh[w.wellId] = newWH;
        // s.ws[newWH] = s.ws[prevWH]; //ToDo: fix
        // delete s.ws[prevWH];

        emit ModifyWell(w.wellId, w.wellType, w.typeData, prevWH, newWH);
    }

    /**
     * Internal
     **/

    function isWellValid(
        IERC20[] calldata tokens,
        LibWellType.WellType wellType,
        bytes calldata typeData
    ) internal pure returns (bool) {
        for (uint256 i; i < tokens.length - 1; i++) {
            require(
                tokens[i] < tokens[i + 1],
                "LibWell: Tokens not alphabetical"
            );
        }
        if (wellType == LibWellType.WellType.CONSTANT_PRODUCT) 
            return typeData.length == 0;
        else revert("LibWell: Well type not supported");
    }
}
