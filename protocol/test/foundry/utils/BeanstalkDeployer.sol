/**
 * SPDX-License-Identifier: MIT
 **/
pragma solidity >=0.7.6 <0.9.0;
pragma abicoder v2;

import {Utils, console} from "test/foundry/utils/Utils.sol";

// Diamond setup
import {Diamond} from "contracts/beanstalk/Diamond.sol";
import {IDiamondCut} from "contracts/interfaces/IDiamondCut.sol";
import {MockInitDiamond} from "contracts/mocks/newMockInitDiamond.sol";
import {InitDiamond} from "contracts/mocks/newInitDiamond.sol";
import {DiamondLoupeFacet} from "contracts/beanstalk/diamond/DiamondLoupeFacet.sol";

/// Beanstalk Contracts w/external libraries.
import {UnripeFacet, MockUnripeFacet} from "contracts/mocks/mockFacets/MockUnripeFacet.sol";
import {MockConvertFacet, ConvertFacet} from "contracts/mocks/mockFacets/MockConvertFacet.sol";
import {MockSeasonFacet, SeasonFacet} from "contracts/mocks/mockFacets/MockSeasonFacet.sol";
import {SeasonGettersFacet} from "contracts/beanstalk/sun/SeasonFacet/SeasonGettersFacet.sol";

/**
 * @title TestHelper
 * @author Brean
 * @notice Test helper contract for Beanstalk tests.
 */
contract BeanstalkDeployer is Utils {

    // beanstalk
    address payable constant BEANSTALK  = payable(address(0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5));
  
    address internal deployer;
    
    /**
     * @notice deploys the beanstalk diamond contract.
     * @param mock if true, deploys all mocks and sets the diamond address to the canonical beanstalk address.
     */
    function setupDiamond(bool mock, bool verbose) internal returns (Diamond d) {
        users = createUsers(6);
        deployer = users[0];
        vm.label(deployer, "Deployer");
        vm.label(BEANSTALK, "Beanstalk");
        
        // create facet cuts
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](50);
        // Facets that require external libraries need to be deployed by 
        // `address(new Facet())`
        // otherwise, use deployCode() to speed up test compiles.

        // add or remove facets here. Facets here do not have mocks.
        uint i = 0;
        string[] memory facetNames = new string[](50);
        address[] memory deployedFacetAddresses = new address[](50);
        deployedFacetAddresses[i] = address(deployCode("BDVFacet.sol"));
        facetNames[i++] = "BDVFacet";
        deployedFacetAddresses[i] = address(deployCode("CurveFacet.sol"));
        facetNames[i++] = "CurveFacet";
        deployedFacetAddresses[i] = address(deployCode("FarmFacet.sol"));
        facetNames[i++] = "FarmFacet";
        deployedFacetAddresses[i] = address(deployCode("PauseFacet.sol"));
        facetNames[i++] = "PauseFacet";
        deployedFacetAddresses[i] = address(deployCode("OwnershipFacet.sol"));
        facetNames[i++] = "OwnershipFacet";
        deployedFacetAddresses[i] = address(deployCode("TokenFacet.sol"));
        facetNames[i++] = "TokenFacet";
        deployedFacetAddresses[i] = address(deployCode("TokenSupportFacet.sol"));
        facetNames[i++] = "TokenSupportFacet";
        deployedFacetAddresses[i] = address(deployCode("GaugePointFacet.sol"));
        facetNames[i++] = "GaugePointFacet";
        deployedFacetAddresses[i] = address(deployCode("LiquidityWeightFacet.sol"));
        facetNames[i++] = "LiquidityWeightFacet";
        deployedFacetAddresses[i] = address(deployCode("SiloGettersFacet.sol"));
        facetNames[i++] = "SiloGettersFacet";
        deployedFacetAddresses[i] = address(deployCode("ConvertGettersFacet.sol"));
        facetNames[i++] = "ConvertGettersFacet";
        deployedFacetAddresses[i] = address(deployCode("MetadataFacet.sol"));
        facetNames[i++] = "MetadataFacet";
        deployedFacetAddresses[i] = address(new SeasonGettersFacet());
        facetNames[i++] = "SeasonGettersFacet";
        deployedFacetAddresses[i] = address(deployCode("DepotFacet.sol"));
        facetNames[i++] = "DepotFacet";
        if (mock) {
            deployedFacetAddresses[i] = address(deployCode("MockAdminFacet.sol"));
            facetNames[i++] = "MockAdminFacet";
            deployedFacetAddresses[i] = address(deployCode("MockFertilizerFacet.sol"));
            facetNames[i++] = "MockFertilizerFacet";
            deployedFacetAddresses[i] = address(deployCode("MockFieldFacet.sol"));
            facetNames[i++] = "MockFieldFacet";
            deployedFacetAddresses[i] = address(deployCode("MockMarketplaceFacet.sol"));
            facetNames[i++] = "MockMarketplaceFacet";
            deployedFacetAddresses[i] = address(deployCode("MockWhitelistFacet.sol"));
            facetNames[i++] = "MockWhitelistFacet";
            deployedFacetAddresses[i] = address(deployCode("MockSiloFacet.sol"));
            facetNames[i++] = "MockSiloFacet";
            deployedFacetAddresses[i] = address(new MockUnripeFacet());
            facetNames[i++] = "MockUnripeFacet";
            deployedFacetAddresses[i] = address(new MockConvertFacet());
            facetNames[i++] = "MockConvertFacet";
            deployedFacetAddresses[i] = address(new MockSeasonFacet());
            facetNames[i++] = "MockSeasonFacet";
        } else {
            deployedFacetAddresses[i] = address(deployCode("FertilizerFacet.sol"));
            facetNames[i++] = "FertilizerFacet";
            deployedFacetAddresses[i] = address(deployCode("FieldFacet.sol"));
            facetNames[i++] = "FieldFacet";
            deployedFacetAddresses[i] = address(deployCode("MarketplaceFacet.sol"));
            facetNames[i++] = "MarketplaceFacet";
            deployedFacetAddresses[i] = address(deployCode("WhitelistFacet.sol"));
            facetNames[i++] = "WhitelistFacet";
            deployedFacetAddresses[i] = address(deployCode("SiloFacet.sol"));
            facetNames[i++] = "SiloFacet";
            deployedFacetAddresses[i] = address(new UnripeFacet());
            facetNames[i++] = "UnripeFacet";
            deployedFacetAddresses[i] = address(new ConvertFacet());
            facetNames[i++] = "ConvertFacet";
            deployedFacetAddresses[i] = address(new SeasonFacet());
            facetNames[i++] = "SeasonFacet";
        }
        
        assembly {
            mstore(facetNames, i)
            mstore(deployedFacetAddresses, i)
        }
        
        cut = _multiCut(facetNames, deployedFacetAddresses);
        d = deployDiamondAtAddress(deployer, BEANSTALK);

        // if mocking, set the diamond address to
        // the canonical beanstalk address.
        address initDiamondAddress;
        if (mock) { 
            initDiamondAddress = address(new MockInitDiamond());
        } else {
            initDiamondAddress = address(new InitDiamond());
        }

        vm.prank(deployer);
        IDiamondCut(address(d)).diamondCut(
            cut,
            initDiamondAddress,
            abi.encodeWithSignature("init()")
        );

        if(verbose) console.log("Diamond deployed at: ", address(d));
    }

    /**
     * @notice upgrades a diamond contract with new facets.
     * @param diamondAddress the address of the diamond contract.
     * @param newFacetNames the names of the new facets. Used to generate selectors.
     * @param newFacetAddresses the addresses of the new facets. 
     * @param initAddress the address of the init diamond contract.
     * @param selectorsToRemove the selectors to remove.
     * .
     * @dev the hardhat deploy script should be used when deploying to mainnet. 
     * This is used in the scope of testing.
     */
    function upgradeWithNewFacets(
        address diamondAddress,
        address diamondOwner,
        string[] memory newFacetNames,
        address[] memory newFacetAddresses,
        address initAddress,
        bytes memory initFunctionCall,
        bytes4[] memory selectorsToRemove
    ) internal {
        vm.startPrank(diamondOwner);

        // create facet cuts
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](newFacetNames.length + 1);
        
        // generate cut for new facets:
        cut = _multiCutWithSelectorRemovals(
            newFacetNames, 
            newFacetAddresses,
            selectorsToRemove
        );
    
        // call diamondcut
        IDiamondCut(diamondAddress).diamondCut(
            cut,
            initAddress,
            initFunctionCall
        );
        vm.stopPrank();
    }

    //////////////////////// Deploy /////////////////////////

    /**
     * @notice deploys a diamond contract at an address.
     */
    function deployDiamondAtAddress(address _deployer, address payable beanstalkAddress) internal returns (Diamond d) {
        vm.prank(_deployer);
        deployCodeTo("Diamond.sol", abi.encode(_deployer), beanstalkAddress);
        return Diamond(beanstalkAddress);
    }

    /**
     * @notice generates the diamond cut array for multiple facets.
     * @dev optimized such that ffi is only called once.
     */
    function _multiCut(string[] memory _facetNames, address[] memory _facetAddresses)
        internal
        returns (IDiamondCut.FacetCut[] memory cutArray) 
    {
        cutArray = new IDiamondCut.FacetCut[](_facetNames.length);
        bytes4[][] memory functionSelectorsArray = _generateMultiSelectors(_facetNames);
        for(uint i; i < _facetNames.length; i++) {
            cutArray[i] = IDiamondCut.FacetCut({
                facetAddress: _facetAddresses[i],
                action: IDiamondCut.FacetCutAction.Add,
                functionSelectors: functionSelectorsArray[i]
            });
        }
    }

    /**
     * @dev assumes selectors that are removed are grouped by facets.
     */
    function _multiCutWithSelectorRemovals(
        string[] memory _facetNames,
        address[] memory _facetAddresses,
        bytes4[] memory _selectorsToRemove
    ) internal returns (IDiamondCut.FacetCut[] memory cutArray) {
        // get inital cutArray.
        cutArray = _multiCut(_facetNames, _facetAddresses);

        // generate cuts for selectors to remove.
        if(_selectorsToRemove.length != 0) {
            assembly {
                mstore(cutArray, add(mload(cutArray), 1))
            }

            cutArray[cutArray.length - 1] = IDiamondCut.FacetCut(
                address(0),
                IDiamondCut.FacetCutAction.Remove,
                _selectorsToRemove
            ); 
        }
    }

    /**
     * @notice generates the selectors for multiple facets.
     * @dev optimized such that ffi is only called once to 
     * optimize on compile time.
     */
    function _generateMultiSelectors(
        string[] memory _facetNames
    ) internal returns (bytes4[][] memory selectorsArray) {
        string[] memory cmd = new string[](_facetNames.length + 2);
        cmd[0] = "node";
        cmd[1] = "scripts/genSelectors.js";
        for (uint i = 0; i < _facetNames.length; i++) {
            cmd[i + 2] = _facetNames[i];
        }
        bytes memory res = vm.ffi(cmd);
        selectorsArray = abi.decode(res, (bytes4[][]));
    }
}
