// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "contracts/libraries/LibStrings.sol";
import {LibStrings} from "contracts/libraries/LibStrings.sol";
import {LibBytes64} from "contracts/libraries/LibBytes64.sol";

/**
 * @title FertilizerImage
 * @author deadmanwalking
 */

// interface to interact with the Beanstalk contract
interface IBeanstalk {
    function beansPerFertilizer() external view returns (uint128);
    function getEndBpf() external view returns (uint128);
    function getFertilizer(uint128) external view returns (uint256);
}
contract FertilizerImage {

    address internal constant BEANSTALK = 0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5;

    //////////////////////   CONSTANTS TO ASSEMBLE SVG   ////////////////////////////

    string internal constant BASE_JSON_URI = "data:application/json;base64,";

    // Start for all fert svgs
    string private constant BASE_SVG_START = '<path d="M164.47 327.241 28.625 405.768l-.878-221.551 135.849-78.559.874 221.583Z" fill="#3DAA47"/><path d="m118.059 354.077-41.102 23.746-.874-221.551 41.101-23.778.875 221.583Z" fill="#3DAA47"/><path d="m26.825 184.242.87 221.567 93.367 54.339-.871-221.564-93.366-54.342Zm136.432-78.262.871 221.568 93.367 54.338-.871-221.564-93.367-54.342Z" fill="#3DB542"/>';

    // End for all fert svgs
    string private constant BASE_SVG_END = '<path d="m256.898 381.609-135.846 78.527-.877-221.551 135.849-78.56.874 221.584Z" fill="#6DCB60"/><path d="m210.486 408.445-41.101 23.745-.875-221.551 41.102-23.778.874 221.584Z" fill="#3DAA47"/><path d="m240.901 364.949-104.407 60.387-.323-157.477 104.408-60.351.322 157.441Z" fill="#fff"/><path d="M195.789 268.025c23.137-6.714 36.875 10.631 32.306 35.233-4.02 21.652-21.352 42.845-39.769 49.821-19.171 7.26-35.717-2.268-36.297-23.966-.665-24.922 19.413-54.021 43.76-61.088Z" fill="#46B955"/><path d="m206.417 275.615-28.08 73.577s-24.569-35.397 28.08-73.577Zm-23.027 68.362 19.561-50.916s23.831 17.189-19.561 50.916Z" fill="#fff"/>';

    // Top for the available fert svg
    string private constant FERT_TOP_AVAILABLE = '<path d="M76.634 162.915 212 84.133l44.034 75.909-135.842 78.544-43.557-75.671Z" fill="#81D672"/><path d="m124.966 134.97 40.624-24.001 44.031 75.906-41.098 23.765-43.557-75.67Z" fill="#46B955"/><path d="m212.125 47.918-.116 36.228-135.394 78.766.116-36.17c0-2.032-1.39-4.413-3.13-5.457-.87-.523-1.68-.523-2.261-.233l135.394-78.766c.58-.349 1.332-.29 2.203.233 1.736.989 3.188 3.425 3.188 5.4Z" fill="#6DCB60"/><path d="m165.713 74.752-.116 36.228-40.65 23.988.116-36.17c0-2.032-1.39-4.413-3.129-5.457-.872-.523-1.681-.523-2.262-.232l40.65-23.989c.58-.349 1.332-.29 2.203.233 1.739.986 3.188 3.425 3.188 5.4Z" fill="#42A84C"/><path d="M73.579 121.298c1.739 1.005 3.162 3.422 3.159 5.425l-.104 36.193 43.557 75.667-93.366-54.339 43.521-25.018.103-36.141c.004-2 1.39-2.795 3.13-1.787Z" fill="#2C9A2C"/><path d="M107.879 226.766 36.62 185.565l35.742-20.395 11.428 19.794 24.089 41.802Z" fill="#6DCB60"/><path d="m81.348 180.731-44.728 4.834 35.742-20.395 8.986 15.561Z" fill="#81D672"/>  <path d="M95.493 209.237c-9.447 2.966-17.845 10.637-21.62 21.552-.497 1.589-2.678 1.589-3.272 0-3.272-10.23-11.405-18.276-21.52-21.552-1.784-.598-1.784-2.782 0-3.377 10.115-3.312 18.174-11.506 21.52-21.552.594-1.689 2.778-1.689 3.272 0 3.768 10.689 11.563 18.195 21.62 21.552 1.687.595 1.687 2.779 0 3.377Z" fill="#fff"/>';

    // Top for the active fert svg
    string private constant FERT_TOP_ACTIVE ='<ellipse cx="113.247" cy="220.688" rx="38.717" ry="38.774" fill="#7F5533"/><ellipse cx="113.247" cy="220.688" rx="38.717" ry="38.774" fill="#7F5533"/><ellipse cx="70.013" cy="236.844" rx="38.717" ry="38.774" fill="#7F5533"/><path d="m26.825 184.242.87 221.567 93.367 54.339-.871-221.564-93.366-54.342Zm136.432-78.262.871 221.568 93.367 54.338-.871-221.564-93.367-54.342Z" fill="#3DB542"/><ellipse cx="156.805" cy="198.715" rx="38.717" ry="38.774" fill="#7F5533"/><ellipse cx="198.103" cy="189.668" rx="38.717" ry="38.774" fill="#7F5533"/>';

    /** 
        * @dev imageURI returns the base64 encoded image URI representation of the Fertilizer
        * @param _id - the id of the Fertilizer
        * @param bpfRemaining - the bpfRemaining of the Fertilizer
        * @return imageUri - the image URI representation of the Fertilizer
     */
    function imageURI(uint256 _id, uint128 bpfRemaining) public view returns (string memory) {
        return svgToImageURI(generateImageSvg(_id, bpfRemaining));
    }

    /////////////// FERTILIZER SVG ORDER ///////////////////
    // SVG_HEADER
    // BASE_SVG_START
    // FERT_SVG_TOP (available, active)
    // BASE_SVG_END
    // SVG_PRE_NUMBER 
    // BPF_REMAINING
    // END OF SVG

    /**
        * @dev generateImageSvg assembles the needed components for the Fertilizer svg
        * For use in the on-chain json fertilizer metadata
        * @param _id - the id of the Fertilizer
        * @param bpfRemaining - the bpfRemaining of the Fertilizer
        * @return imageUri - the image URI representation of the Fertilizer
     */
    function generateImageSvg(uint256 _id, uint128 bpfRemaining) internal view returns (string memory) {
        return string(
            abi.encodePacked(
                '<svg width="294" height="512" viewBox="0 0 294 512" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">', // SVG HEADER
                BASE_SVG_START, // BASE SVG START
                getFertilizerStatusSvg(_id, bpfRemaining), // FERT_SVG_TOP (available, active)
                BASE_SVG_END, // BASE SVG END
                '<text font-family="sans-serif" font-size="20" x="20" y="490" fill="black" ><tspan dy="0" x="20">', // PRE NUMBER FOR BPF REMAINING
                LibStrings.formatUintWith6DecimalsTo2(bpfRemaining), // BPF_REMAINING with 2 decimal places
                " BPF Remaining </tspan></text></svg>" // END OF SVG
            )
        );
    }

    /**
        * @dev Returns the correct svg top for the Fertilizer status based on the bpfRemaining.
        * @param _id - the id of the Fertilizer
        * @param bpfRemaining - the bpfRemaining of the Fertilizer
        * @return fertilizerStatusSvg an svg top for the correct Fertilizer status
     */
    function getFertilizerStatusSvg(uint256 _id, uint128 bpfRemaining) internal view returns (string memory) {

        uint256 fertilizerSupply = IBeanstalk(BEANSTALK).getFertilizer(
            uint128(_id)
        );

        string memory fertilizerStatusSvg = FERT_TOP_AVAILABLE;

        if (fertilizerSupply > 0) {
            fertilizerStatusSvg = bpfRemaining > 0
                ? FERT_TOP_ACTIVE
                : ''; // a used fert (bpfRemaining = 0) has no top
        }

        return fertilizerStatusSvg;
    }

    /// @dev Helper function that converts an svg to a bade64 encoded image URI.
    function svgToImageURI(string memory svg)
        internal
        pure
        returns (string memory)
    {
        return string(
            abi.encodePacked("data:image/svg+xml;base64,", LibBytes64.encode(bytes(string(abi.encodePacked(svg)))))
        );
    }

}