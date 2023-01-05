import React from 'react';
import sample from 'lodash/sample';
import './Leaves.css';

const leaves = ['l1', 'l2', 'l3', 'l4'];

function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}

export default function Leaves() {
  const width = window.innerWidth;
  return (
    <div id="leaves">
      {Array(Math.floor(width / 100)).fill(0).map((_, i) => (
        <i
          key={i}
          className={sample(leaves)}
          style={{
            left: `${getRandomInt(width)}px`,
            animationDuration: `${getRandomInt(60) + 10}s, ${getRandomInt(10) + 3}s`,
            animationDelay: `${getRandomInt(30)}s`,
          }}
        />
      ))}
    </div>
  );
}
