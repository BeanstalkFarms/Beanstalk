const fs = require('fs');

fs.readFile('stalkholders-verbose.json', (err, data) => {
    if (err) throw err;

    const jsonArray = JSON.parse(data);

    const count = Object.keys(jsonArray).length;
    console.log(count);
});
