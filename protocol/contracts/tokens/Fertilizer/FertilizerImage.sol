// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "hardhat/console.sol";
import "base64-sol/base64.sol";
import "contracts/libraries/LibStrings.sol";
import {LibStrings} from "contracts/libraries/LibStrings.sol";

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

    // -------------------------- CONSTANTS TO ASSEMBLE SVG --------------------------------

    string internal constant BASE_JSON_URI = "data:application/json;base64,";

    string private constant BASE_SVG_ACTIVE =
        'M164.47 327.241L28.6247 405.768L27.7471 184.217L163.596 105.658L164.47 327.241Z" fill="#3DAA47"/><path d="M118.059 354.077L76.9574 377.823L76.083 156.272L117.184 132.494L118.059 354.077Z" fill="#3DAA47"/><ellipse cx="113.247" cy="220.688" rx="38.7172" ry="38.7739" fill="#7F5533"/><ellipse cx="113.247" cy="220.688" rx="38.7172" ry="38.7739" fill="#7F5533"/><ellipse cx="70.0135" cy="236.844" rx="38.7172" ry="38.7739" fill="#7F5533"/><path d="M26.8247 184.242L27.6958 405.809L121.062 460.148L120.191 238.584L26.8247 184.242Z" fill="#3DB542"/><path d="M163.257 105.98L164.128 327.548L257.495 381.886L256.624 160.322L163.257 105.98Z" fill="#3DB542"/><ellipse cx="156.805" cy="198.715" rx="38.7172" ry="38.7739" fill="#7F5533"/><ellipse cx="198.103" cy="189.668" rx="38.7172" ry="38.7739" fill="#7F5533"/><path d="M256.898 381.609L121.052 460.136L120.175 238.585L256.024 160.025L256.898 381.609Z" fill="#6DCB60"/><path d="M210.486 408.445L169.385 432.19L168.51 210.639L209.612 186.861L210.486 408.445Z" fill="#3DAA47"/><path d="M240.901 364.949L136.494 425.337L136.171 267.859L240.579 207.508L240.901 364.949Z" fill="white"/><path d="M195.789 268.025C218.926 261.311 232.664 278.656 228.095 303.258C224.075 324.91 206.743 346.103 188.326 353.079C169.155 360.339 152.609 350.811 152.029 329.113C151.364 304.191 171.442 275.092 195.789 268.025Z" fill="#46B955"/><path d="M206.417 275.615L178.337 349.192C178.337 349.192 153.768 313.795 206.417 275.615Z" fill="white"/><path d="M183.39 343.977L202.951 293.061C202.951 293.061 226.782 310.25 183.39 343.977Z" fill="white"/><rect width="78.3284" height="68.4768" transform="matrix(0.996731 0.0807976 -0.0805627 0.99675 154.216 336.166)" fill="url(#pattern0)"/><defs><pattern id="pattern0" patternContentUnits="objectBoundingBox" width="1" height="1"><use xlink:href="#image0_10349_104998" transform="scale(0.00325733 0.00373134)"/';

    string private constant BASE_SVG_AVAILIBLE =
        'M26.8247 184.244L27.6958 405.811L121.062 460.15L120.191 238.586L26.8247 184.244Z" fill="#3DB542"/><path d="M256.898 381.611L121.052 460.138L120.175 238.587L256.024 160.027L256.898 381.611Z" fill="#6DCB60"/><path d="M210.486 408.445L169.385 432.19L168.51 210.639L209.612 186.861L210.486 408.445Z" fill="#3DAA47"/><path d="M76.6343 162.915L211.999 84.1328L256.033 160.042L120.191 238.586L76.6343 162.915Z" fill="#81D672"/><path d="M124.966 134.97L165.59 110.969L209.621 186.875L168.523 210.64L124.966 134.97Z" fill="#46B955"/><path d="M212.125 47.9183L212.009 84.146L76.6151 162.912L76.7312 126.742C76.7312 124.71 75.3406 122.329 73.6016 121.285C72.7304 120.762 71.9206 120.762 71.3398 121.052L206.734 42.2864C207.314 41.9374 208.066 41.9956 208.937 42.519C210.673 43.5077 212.125 45.944 212.125 47.9183Z" fill="#6DCB60"/><path d="M165.713 74.7523L165.597 110.98L124.947 134.968L125.063 98.7986C125.063 96.7662 123.673 94.3848 121.934 93.3411C121.062 92.8177 120.253 92.8177 119.672 93.1085L160.322 69.1203C160.902 68.7714 161.654 68.8295 162.525 69.353C164.264 70.3385 165.713 72.778 165.713 74.7523Z" fill="#42A84C"/><path d="M73.5789 121.298C75.3179 122.303 76.7408 124.72 76.7376 126.723L76.6343 162.916L120.191 238.583L26.8247 184.244L70.346 159.226L70.4493 123.085C70.4525 121.085 71.8399 120.29 73.5789 121.298Z" fill="#2C9A2C"/><path d="M107.879 226.766L36.6201 185.565L72.3625 165.17L83.7905 184.964L107.879 226.766Z" fill="#6DCB60"/><path d="M81.3481 180.731L36.6201 185.565L72.3625 165.17L81.3481 180.731Z" fill="#81D672"/><path d="M240.901 364.949L136.494 425.337L136.171 267.859L240.579 207.508L240.901 364.949Z" fill="white"/><path d="M95.493 209.237C86.046 212.203 77.6476 219.874 73.8727 230.789C73.3759 232.378 71.1948 232.378 70.6011 230.789C67.3295 220.559 59.1957 212.513 49.0808 209.237C47.2966 208.639 47.2966 206.455 49.0808 205.86C59.1957 202.548 67.2553 194.354 70.6011 184.308C71.1948 182.619 73.3791 182.619 73.8727 184.308C77.6412 194.997 85.4362 202.503 95.493 205.86C97.1804 206.455 97.1804 208.639 95.493 209.237Z" fill="white"/><path d="M195.789 264.257C218.926 257.543 232.664 274.888 228.096 299.49C224.075 321.142 206.743 342.335 188.327 349.311C169.155 356.572 152.61 347.043 152.029 325.346C151.365 300.424 171.443 271.324 195.789 264.257Z" fill="#46B955"/><path d="M206.417 271.848L178.337 345.424C178.337 345.424 153.768 310.027 206.417 271.848Z" fill="white"/><path d="M183.39 340.21L202.952 289.293C202.952 289.293 226.782 306.483 183.39 340.21Z" fill="white"/><rect width="78.3284" height="68.4768" transform="matrix(0.996731 0.0807976 -0.0805627 0.99675 154.216 336.166)" fill="url(#pattern0)"/><defs><pattern id="pattern0" patternContentUnits="objectBoundingBox" width="1" height="1"><use xlink:href="#image0_10349_104960" transform="scale(0.00325733 0.00373134)"/';

    string private constant BASE_SVG_USED =
        'M164.47 327.241L28.6247 405.768L27.7471 184.217L163.596 105.658L164.47 327.241Z" fill="#3DAA47"/><path d="M118.059 354.077L76.9574 377.823L76.083 156.272L117.184 132.494L118.059 354.077Z" fill="#3DAA47"/><path d="M26.8247 184.242L27.6958 405.809L121.062 460.148L120.191 238.584L26.8247 184.242Z" fill="#3DB542"/><path d="M163.257 105.98L164.128 327.548L257.495 381.886L256.624 160.322L163.257 105.98Z" fill="#3DB542"/><path d="M256.898 381.609L121.052 460.136L120.175 238.585L256.024 160.025L256.898 381.609Z" fill="#6DCB60"/><path d="M210.486 408.445L169.385 432.19L168.51 210.639L209.612 186.861L210.486 408.445Z" fill="#3DAA47"/><path d="M240.901 364.949L136.494 425.337L136.171 267.859L240.579 207.508L240.901 364.949Z" fill="white"/><path d="M195.789 268.025C218.926 261.311 232.664 278.656 228.095 303.258C224.075 324.91 206.743 346.103 188.326 353.079C169.155 360.339 152.609 350.811 152.029 329.113C151.364 304.191 171.442 275.092 195.789 268.025Z" fill="#46B955"/><path d="M206.417 275.615L178.337 349.192C178.337 349.192 153.768 313.795 206.417 275.615Z" fill="white"/><path d="M183.39 343.977L202.951 293.061C202.951 293.061 226.782 310.25 183.39 343.977Z" fill="white"/><rect width="78.3284" height="68.4768" transform="matrix(0.996731 0.0807976 -0.0805627 0.99675 154.216 336.166)" fill="url(#pattern0)"/><defs><pattern id="pattern0" patternContentUnits="objectBoundingBox" width="1" height="1"><use xlink:href="#image0_10349_105031" transform="scale(0.00325733 0.00373134)"/';


    /** 
        * @dev imageURI returns the base64 encoded image URI representation of the Fertilizer
        * @param _id - the id of the Fertilizer
        * @param bpfRemaining - the bpfRemaining of the Fertilizer
        * @return imageUri - the image URI representation of the Fertilizer
     */
    function imageURI(uint256 _id, uint128 bpfRemaining) public view returns (string memory) {
        return svgToImageURI(generateImageSvg(_id, bpfRemaining));
    }

    /**
        * @dev generateImageURI assembles the needed components for the Fertilizer svg
          and returns the base64 encoded image URI representation for use in the json metadata
        * @param _id - the id of the Fertilizer
        * @param bpfRemaining - the bpfRemaining of the Fertilizer
        * @return imageUri - the image URI representation of the Fertilizer
     */
    function generateImageSvg(uint256 _id, uint128 bpfRemaining) internal view returns (string memory) {
        string memory svg = string(
            abi.encodePacked(
                base(), // BASE SVG START
                getFertilizerStatusSvg(_id, bpfRemaining), // fertilizerStatus
                preNumber(), // BASE SVG PRE NUMBER FOR BPF REMAINING
                LibStrings.formatBpfRemaining(bpfRemaining), // bpfRemaining with 2 decimal places
                end() // BASE SVG END
            )
        );
        return svg;
    }

    /// @dev returns the start of the svg format for the Fertilizer
    function base() internal pure returns(string memory) {
        return string(abi.encodePacked(
            '<svg width="294" height="512" viewBox="0 0 294 512" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><path d="'
        ));
    }

    /**
        * @dev returns the correct svg for the Fertilizer status based on the bpfRemaining
        * @param _id - the id of the Fertilizer
        * @param bpfRemaining - the bpfRemaining of the Fertilizer
        * @return fertilizerStatusSvg an svg for the correct Fertilizer status
     */
    function getFertilizerStatusSvg(uint256 _id, uint128 bpfRemaining) internal view returns (string memory) {

        // uint256 endBpf = IBeanstalk(BEANSTALK).getEndBpf();

        uint256 fertilizerSupply = IBeanstalk(BEANSTALK).getFertilizer(
            uint128(_id)
        );

        string memory fertilizerStatusSvg = BASE_SVG_AVAILIBLE;

        console.log("Fertilizer: getFertilizerStatusSvg: bpfRemaining: " , bpfRemaining);
        // console.log("Fertilizer: getFertilizerStatusSvg: endBpf: " , endBpf);
        console.log("Fertilizer: getFertilizerStatusSvg: fertilizerSupply: " , fertilizerSupply);

        if (fertilizerSupply > 0) {
            fertilizerStatusSvg = bpfRemaining > 0
                ? BASE_SVG_ACTIVE
                : BASE_SVG_USED;
        }

        return fertilizerStatusSvg;
    }

    /// @dev returns the preNumber formatting for the Fertilizer
    function preNumber() internal pure returns(string memory) {
        return string(abi.encodePacked(
            '></pattern></defs><text font-family="sans-serif" font-size="20" x="20" y="490" fill="black" ><tspan dy="0" x="20"> '
        ));
    }

    /// @dev returns the end of the svg for the Fertilizer containing the bpfRemaining
    function end() internal pure returns(string memory) {
        return string(abi.encodePacked(
            " BPF Remaining </tspan></text></svg>"
        ));
    }

    // ----------------------- HELPER FUNCTIONS --------------------------------

    /// @dev converts an svg to a bade64 encoded image URI
    function svgToImageURI(string memory svg)
        internal
        pure
        returns (string memory)
    {
        string memory baseURL = "data:image/svg+xml;base64,";
        string memory svgBase64Encoded = Base64.encode(
            bytes(string(abi.encodePacked(svg)))
        );
        return string(abi.encodePacked(baseURL, svgBase64Encoded));
    }

}