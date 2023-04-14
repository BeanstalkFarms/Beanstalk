const fs = require('fs');

fs.readFile('stalkholders.json', (err, data) => {
    if (err) throw err;

    const jsonArray = JSON.parse(data);

    const idArray = jsonArray.map(element => element.farmer.id);

    fs.writeFile('idArray.json', JSON.stringify(idArray), (err) => {
        if (err) throw err;
        console.log('The file has been saved!');
    });
});