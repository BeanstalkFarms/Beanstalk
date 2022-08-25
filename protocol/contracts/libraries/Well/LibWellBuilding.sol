/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "./LibWellStorage.sol";
import "./WellN/LibWellN.sol";
import "./Well2/LibConstantProductWell2.sol";
import "../../tokens/ERC20/WellERC20.sol";
import "hardhat/console.sol";

/**
 * @author Publius
 * @title Lib Well Building
 **/
library LibWellBuilding {
    using SafeMath for uint256;

    event RegisterWellType(LibWellStorage.WellType wellType, string[] parameterTypes);
    event BuildWell(
        address wellId,
        IERC20[] tokens,
        LibWellStorage.WellType wellType,
        bytes typeData,
        bytes32 wellHash
    );
    event ModifyWell(
        address wellId,
        LibWellStorage.WellType newWellType,
        bytes newTypeData,
        bytes32 oldWellHash,
        bytes32 newWellHash
    );

    /**
     * Management
     **/

    function buildWell(
        IERC20[] calldata tokens,
        LibWellStorage.WellType wellType,
        bytes calldata typeData,
        string[] calldata symbols
    ) internal returns (address wellId) {
        require(isWellValid(tokens, wellType, typeData), "LibWell: Well not valid.");
        LibWellStorage.WellStorage storage s = LibWellStorage.wellStorage();

        string memory name = symbols[0];
        string memory symbol = symbols[0];
        for (uint i = 1; i < tokens.length; ++i) {
            name = string(abi.encodePacked(name, ":", symbols[i]));
            symbol = string(abi.encodePacked(symbol, symbols[i]));
        }
        wellId = address(new WellERC20(name, symbol));

        LibWellStorage.WellInfo memory w;
        w.tokens = tokens;
        w.wellType = wellType;
        w.typeData = typeData;
        w.wellId = wellId;

        bytes32 wh = LibWellStorage.computeWellHash(w);

        s.indices[s.numberOfWells] = wellId;
        s.numberOfWells = s.numberOfWells.add(1);

        if (LibWellStorage.isWell2(tokens)) {
            s.w2s[wh].last.timestamp = uint32(block.timestamp);
            s.w2s[wh].even.timestamp = uint32(block.timestamp);
            s.w2s[wh].odd.timestamp = uint32(block.timestamp);
        } else {
            uint256 iMax = tokens.length - 1;
            for (uint256 i; i < iMax; i++) {
                s.wNs[wh].balances.push(0);
                s.wNs[wh].last.cumulativeBalances.push(0);
                s.wNs[wh].even.cumulativeBalances.push(0);
                s.wNs[wh].odd.cumulativeBalances.push(0);
            }
            s.wNs[wh].balances.push(0);
            s.wNs[wh].last.timestamp = uint32(block.timestamp);
            s.wNs[wh].even.timestamp = uint32(block.timestamp);
            s.wNs[wh].odd.timestamp = uint32(block.timestamp);
        }

        s.wi[wellId] = w;
        s.wh[wellId] = wh;

        emit BuildWell(w.wellId, w.tokens, w.wellType, w.typeData, wh);
    }

    function modifyWell(
        LibWellStorage.WellInfo memory w,
        LibWellStorage.WellType newWellType,
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

    function registerWellType(
        LibWellStorage.WellType newWellType,
        string[] calldata typeParameters
    ) internal {
        LibWellStorage.WellStorage storage s = LibWellStorage.wellStorage();
        require(!s.wt[newWellType].registered, "LibWell: Already registered");
        s.wt[newWellType].registered = true;
        for (uint256 i; i < typeParameters.length; i++)
            s.wt[newWellType].signature.push(typeParameters[i]);
        emit RegisterWellType(newWellType, typeParameters);
    }

    /**
     * Internal
     **/

    function isWellValid(
        IERC20[] calldata tokens,
        LibWellStorage.WellType wellType,
        bytes calldata typeData
    ) internal pure returns (bool) {
        for (uint256 i; i < tokens.length - 1; i++) {
            require(
                tokens[i] < tokens[i + 1],
                "LibWell: Tokens not alphabetical"
            );
        }
        if (wellType == LibWellStorage.WellType.CONSTANT_PRODUCT) 
            return typeData.length == 0;
        else revert("LibWell: Well type not supported");
    }
}
