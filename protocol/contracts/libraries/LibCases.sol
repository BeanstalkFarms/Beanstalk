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
 *  Data format: 
 * 
 * mT: 2 Bytes (1% = 1e2) (temperature can be scaled to 0% to 655% relative)
 * bT: 2 Bytes (1% = 1)   (temperature can change by -32768% to +32767% absolute)
 * mL: 2 Bytes (1% = 1e2) (percentOfNewGrownStalkToLP can be scaled to 0% to 655% relative)
 * bL: 2 Bytes (1% = 1e2) (percentOfNewGrownStalkToLP can change by -327% to +327% absolute)
 
 * Temperature and grownStalk percentage to lp is updated as such:
 * T_n = mT * T_n-1 + bT
 * L_n = mL * L_n-1 + bL
 * 
 * In total, there are 96 cases (4 * 2 * 3 * 4)
 * In practice, the cases range from 0-127.
 * 
 * temperature is stored in AppStorage with 0 decimal precision (1% = 1), 
 * which is why bT has 0 decimal precision.
 * GrownStalkToLP however, has 6 decimal precision (1% = 1e6).
 * bL is stored with 2 decimal precision, and then scaled up
 * to 6 in { Weather.changeNewGrownStalkPerBDVtoLP() }. 
 */


library LibCases {
    struct CaseData {
        uint16 mT;
        int16 bT;
        uint16 mL;
        int16 bL;
    }
    /**
     * @notice given a caseID (0-128), return the caseData.
     * 
     * CaseV2 allows developers to change both the absolute 
     * and relative change in temperature and grownStalk to liquidity,
     * with greater precision than CaseV1.
     * 
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
        CaseData memory cd
    ) {
        bytes8 _caseData = getDataFromCase(caseId);
        cd.mT = uint16(bytes2(_caseData));
        cd.bT = int16(bytes2(_caseData << 16));
        cd.mL = uint16(bytes2(_caseData << 32));
        cd.bL = int16(bytes2(_caseData << 48));
    }

    /**
     * @notice changes the data associated with a case.
     * @param caseId Case to change.
     * @param mT new relative temperature change.
     * @param bT new absolute temperature change.
     * @param mL new relative grown stalk to liquidity change.
     * @param bL new absolute grown stalk to liquidity change.
     */
    function changeCaseData(uint256 caseId, uint16 mT, uint16 bT, uint16 mL, uint16 bL) internal returns (bytes8 caseData){
        require(caseId < 128, "caseId must be less than 128");

        bytes memory data = abi.encodePacked(mT, bT, mL, bL);
        assembly { caseData := mload(add(data, 32)) }
        LibAppStorage.diamondStorage().casesV2[caseId] = caseData;
    }
}