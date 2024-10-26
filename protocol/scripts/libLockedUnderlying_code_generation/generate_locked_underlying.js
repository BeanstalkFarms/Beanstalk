const fs = require("fs");

// Read the content of the file
const fileContent = fs.readFileSync("updated_numbers.csv", "utf8");

// Parse the file content
const lines = fileContent.split("\n").filter((line) => line.trim() !== "");
const data = lines.map((line) => {
  const [recapPercentPaid, unripeSupply, percentLockedUnderlying] = line.split(", ");
  return {
    recapPercentPaid: parseFloat(recapPercentPaid),
    unripeSupply: parseInt(unripeSupply),
    percentLockedUnderlying: percentLockedUnderlying.trim()
  };
});

// Group data by unripeSupply
const groupedData = data.reduce((acc, item) => {
  if (!acc[item.unripeSupply]) {
    acc[item.unripeSupply] = [];
  }
  acc[item.unripeSupply].push(item);
  return acc;
}, {});

// Helper function to generate nested if-else blocks
function generateNestedBlocks(items, unripeSupply) {
  let code = "";

  counter = 0;

  let tab1 = "\t";
  let tab2 = "\t\t";
  let tab3 = "\t\t\t";
  let tab4 = "\t\t\t\t";
  let tab5 = "\t\t\t\t\t";

  for (const item of items) {
    // console.log(item);

    let marker = 16;
    let market16close = false;
    if (counter % marker == 0 && counter + marker < items.length) {
      let recapPercentPaid = items[counter + marker].recapPercentPaid;
      code +=
        tab1 + "if (recapPercentPaid > " + recapPercentPaid + "e6) {\n";
      market16close = true;
    }
    marker = 8;
    if (counter % marker == 0) {
      if (counter < marker) {
        let recapPercentPaid = items[counter + marker].recapPercentPaid;
        code +=
          tab2 +
          "if (recapPercentPaid > " +
          recapPercentPaid +
          "e6) {\n";
      }

      // if inside the mod 8 marker, all the next 8 levels are going to be spit out at the same level

      for (var i = 0; i < 8; i++) {
        let loopItem = items[counter + i];

        // if i mod 2 == 0, open an if statement (3rd layer of ifs)
        if (i % 2 == 0) {
          if (counter + i + 2 < items.length && counter + i + 2 > 0) {
            let recapPercentPaid = items[counter + i + 2].recapPercentPaid;
            if (i % 8 == 0) {
              code += tab3 + "if (recapPercentPaid > " + recapPercentPaid + "e6) {\n";
            } else if (i % 8 < 6) {
              code += tab3 + "} else if (recapPercentPaid > " + recapPercentPaid + "e6) {\n";
            } else {
              code += tab3 + "} else {\n";
            }
          } else {
            // console.log("items.length: ", items.length);
            // console.log("counter + i + 2: ", counter + i + 2);
          }
        }

        // if even
        if (i % 2 == 0) {
          let recapPercentPaid = items[counter + i + 1].recapPercentPaid;
          code += tab4 + "if (recapPercentPaid > " + recapPercentPaid + "e6) {\n";
        } else {
          code += tab4 + "} else {\n";
        }

        code += tab5 + "return " + loopItem.percentLockedUnderlying + "e18; // " + unripeSupply.toLocaleString('en-US') + ", " + loopItem.recapPercentPaid + "\n";

        if (i % 2 == 1) {
          code += tab4 + "}\n"; // right after return
        }
      }

      code += tab3 + "} // closed 8 level if " + counter + "\n"; // close 8-level if
      if (counter == 8) {
        code += tab2 + "}\n";
        code += tab1 + "} else { // close upper level\n";
      }
    }
    if (market16close) {
      code += tab2 + "} else { // close 16 level if \n"; // close 16-level if
    }

    counter++;
  }

  code += tab2 + "}\n"; // close 16-level if
  code += tab1 + "}\n"; // close top-level if

  // code += generateLevel(items);
  return code;
}

// Generate Solidity code
let code = "";

const unripeSupplyValues = [90000000, 10000000, 1000000];

let groupCount = 0;
for (const unripeSupply of unripeSupplyValues) {
  const items = groupedData[unripeSupply];
  if (!items) continue;

  const unripeFormatted = unripeSupply.toLocaleString('en-US', {
    useGrouping: true,
    groupingSeparator: '_'
  });

  if (groupCount == 0) {
    code += `if (unripeSupply > ${unripeFormatted}) {\n`;
  } else {
    code += `if (unripeSupply < ${unripeFormatted}) {\n`;
  }
  groupCount++;
  items.sort((a, b) => b.recapPercentPaid - a.recapPercentPaid);
  code += generateNestedBlocks(items, unripeSupply);
  code += `} else `;
}

code += `{\n    return 0; // If < 1,000,000 Assume all supply is unlocked.\n}`;

// Write the generated code to a file
fs.writeFileSync("generated_code.sol", code);

console.log("Code generated successfully!");
