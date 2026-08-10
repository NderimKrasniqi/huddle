const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const path = require('node:path');

const virtualStore = path.resolve('node_modules/.pnpm');
const imageSizePackage = fs
  .readdirSync(virtualStore)
  .find((name) => name.startsWith('image-size@1.2.1_patch_hash='));

if (!imageSizePackage) {
  throw new Error('The patched image-size@1.2.1 package is not installed');
}

const imageSizeRoot = path.join(virtualStore, imageSizePackage, 'node_modules/image-size');
const { ICNS } = require(path.join(imageSizeRoot, 'dist/types/icns.js'));
const imageUtils = require(path.join(imageSizeRoot, 'dist/types/utils.js'));

const maliciousIcns = Buffer.alloc(16);
maliciousIcns.write('icns', 0);
maliciousIcns.writeUInt32BE(16, 4);
maliciousIcns.write('ic07', 8);
maliciousIcns.writeUInt32BE(0, 12);

let icnsRejected = false;
try {
  ICNS.calculate(maliciousIcns);
} catch (error) {
  icnsRejected = /Invalid ICNS entry length/.test(String(error));
}

if (!icnsRejected) {
  throw new Error('The image-size ICNS zero-length entry guard is missing');
}

const zeroLengthBox = Buffer.alloc(8);
zeroLengthBox.write('ftyp', 4);
if (imageUtils.findBox(zeroLengthBox, 'ftyp', 0) !== undefined) {
  throw new Error('The image-size JXL/HEIF zero-length box guard is missing');
}

const uuidRoot = path.resolve('node_modules/.pnpm/xcode@3.0.1/node_modules/uuid');
const uuidVersion = require(path.join(uuidRoot, 'package.json')).version;
const uuid = require(uuidRoot);

if (uuidVersion !== '11.1.1' || uuid.v4().length !== 36) {
  throw new Error('xcode@3.0.1 cannot use the patched CommonJS uuid dependency');
}

console.log('Dependency security verification passed.');
