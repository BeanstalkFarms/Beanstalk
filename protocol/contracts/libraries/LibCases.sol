// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
import {LibAppStorage, AppStorage} from "./LibAppStorage.sol";

/**
 * @author Brean
 * @title LibCases handles the cases for beanstalk.
 * 
 * @dev Cases are used to determine the change in 
 * temperature and grownStalk percentage to liquidity.
 * 
 * Temperature and grownStalk percentage to lp is updated as such:
 * T_n = mT * T_n-1 + bT
 * L_n = mL * L_n-1 + bL
 * 
 * In total, there are 96 cases (4 * 2 * 3 * 4)
 * In practice, the cases range from 0-127. 
 */


library LibCases {

    /**
     * @notice given a caseID (0-128), return the caseData.
     * @dev caseData stores data: 
     * Data is formatted as such: 
     * mT: 3 Bytes (1 = 1e6)
     * bT: 1 Byte  (1 = 1) (-128 to 127)
     * mL: 3 Bytes
     * bL: 1 Byte
     */
    function getDataFromCase(uint256 caseId) internal view returns (bytes8 caseData){
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.casesV2[caseId];
    }

    /**
     * @notice given a caseID (0-128), return the data associated.
     * @dev * Each case outputs 4 variables: 
     * mT: Relative Temperature change.
     * bT: Absolute Temperature change.  
     * mL: Relative Grown Stalk to Liquidity change.
     * bL: Absolute Grown Stalk to Liquidity change.
     */
    function decodeCaseData(uint256 caseId) 
    internal view returns (
        uint24 mT,
        int8 bT,
        uint24 mL,
        int8 bL
    ) {
        bytes8 _caseData = getDataFromCase(caseId);
        mT = uint24(bytes3(_caseData));
        bT = int8(bytes1(_caseData << 24));
        mL = uint24(bytes3(_caseData << 32));
        bL = int8(bytes1(_caseData << 56));
    }

    /**
     * @notice changes the data associated with a case.
     * @param caseId Case to change.
     * @param mT new relative temperature change.
     * @param bT new absolute temperature change.
     * @param mL new relative grown stalk to liquidity change.
     * @param bL new absolute grown stalk to liquidity change.
     */
    function changeCaseData(uint256 caseId, uint24 mT, int8 bT, uint24 mL, int8 bL) internal returns (bytes8 caseData){
        AppStorage storage s = LibAppStorage.diamondStorage();
        bytes memory data = abi.encodePacked(mT, bT, mL, bL);
        assembly { caseData := mload(add(data, 32)) }
        s.casesV2[caseId] = caseData;
    }
}