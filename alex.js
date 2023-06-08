const a = true;
const b = 123;
const c = "hello world";
const d = [1, 2, 3];

"123[Object object]"

console.log(b + d)

process.exit()

const begging1 = "b1";
const begging2 = "b2";
const begging3 = "b3";

const begging = [begging1, begging2, begging3];
const middle = ["m1", "m2", "m3"];
const end = ["e1", "e2", "e3"];

const story = `${e(begging)}

${e(middle)}

${e(end)}`

console.log(story)

function e(array) {
    const randomIndex = generateRandomNumber(array.length);
    return array[randomIndex];
}

function generateRandomNumber(max) {
    return Math.floor(Math.random() * max);
}   


