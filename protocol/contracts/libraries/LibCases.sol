// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
import {LibAppStorage, AppStorage} from "./LibAppStorage.sol";

/**
 * @author Brean
 * @title LibCases handles the cases for beanstalk.
 *
 * @dev Cases are used to determine the change in
 * temperature and Bean to maxLP gaugePoint per BDV ratio.
 *
 *  Data format:
 *
 * mT: 4 Bytes (1% = 1e6)
 * bT: 1 Bytes (1% = 1)
 * mL: 10 Bytes (1% = 1e18)
 * bL: 10 Bytes (1% = 1e18)
 * 7 bytes are left for future use.
 *
 * Temperature and Bean and maxLP gaugePoint per BDV ratio is updated as such:
 * T_n = mT * T_n-1 + bT
 * L_n = mL * L_n-1 + bL
 *
 * In total, there are 144 cases (4 * 3 * 3 * 4)
 *
 * temperature is stored in AppStorage with 0 decimal precision (1% = 1),
 * which is why bT has 0 decimal precision.
 *
 */

library LibCases {
    struct CaseData {
        uint32 mT;
        int8 bT;
        uint80 mL;
        int80 bL;
    }

    /**
     * @notice given a caseID (0-144), return the caseData.
     *
     * CaseV2 allows developers to change both the absolute
     * and relative change in temperature and bean to maxLP gaugePoint to BDV ratio,
     * with greater precision than CaseV1.
     *
     */
    function getDataFromCase(uint256 caseId) internal view returns (bytes32 caseData) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.casesV2[caseId];
    }

    /**
     * @notice given a caseID (0-144), return the data associated.
     * @dev * Each case outputs 4 variables:
     * mT: Relative Temperature change. (1% = 1e6)
     * bT: Absolute Temperature change. (1% = 1)
     * mL: Relative Grown Stalk to Liquidity change. (1% = 1e18)
     * bL: Absolute Grown Stalk to Liquidity change. (1% = 1e18)
     */
    function decodeCaseData(uint256 caseId) internal view returns (CaseData memory cd) {
        bytes32 _caseData = getDataFromCase(caseId);
        cd.mT = uint32(bytes4(_caseData));
        cd.bT = int8(bytes1(_caseData << 32));
        cd.mL = uint80(bytes10(_caseData << 40));
        cd.bL = int80(bytes10(_caseData << 120));
    }
}
