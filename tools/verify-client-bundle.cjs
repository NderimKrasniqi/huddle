#!/usr/bin/env node
/* global __dirname, Buffer */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const exportDirectory = process.argv[2] === '--' ? process.argv[3] : process.argv[2];
if (exportDirectory === undefined) {
  console.error('Usage: pnpm verify:bundle-seam -- <Expo export directory>');
  process.exit(2);
}

const packPath = path.join(root, 'games/trivia/src/packs/huddle-classics.json');
const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
const markers = [
  pack.id,
  pack.title,
  JSON.stringify(pack),
  ...pack.questions.map((question) => question.text),
];

function filesUnder(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...filesUnder(file));
    else files.push(file);
  }
  return files;
}

const directory = path.resolve(exportDirectory);
if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
  console.error(`Expo export directory does not exist: ${directory}`);
  process.exit(2);
}

const matches = [];
for (const file of filesUnder(directory)) {
  const bytes = fs.readFileSync(file);
  for (const marker of markers) {
    if (marker.length > 0 && bytes.includes(Buffer.from(marker))) {
      matches.push(`${path.relative(directory, file)} contains ${JSON.stringify(marker.slice(0, 80))}`);
    }
  }
}

if (matches.length > 0) {
  console.error('Trivia pack content found in the phone export:');
  for (const match of matches) console.error(`- ${match}`);
  process.exit(1);
}

console.log(`Bundle seam passed: no Trivia pack content found in ${directory}`);
