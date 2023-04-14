const fs = require('fs');

fs.readFile('stalkholders.json', 'utf8', (err, data) => {
    if (err) throw err;

    const object = JSON.parse(data);
    const filteredObject = Object.entries(object)
        .filter(([key, value]) => value >= 1)
        .reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
        }, {});

    fs.writeFile('stalkatleastone.json', JSON.stringify(filteredObject), 'utf8', (err) => {
        if (err) throw err;
        console.log('The file has been saved!');
    });
});
