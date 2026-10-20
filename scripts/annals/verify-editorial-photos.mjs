/* Offline verification of explicitly admitted public editorial derivatives.
 * File validity is NOT visual assessment. See brand guide's acceptance standard.
 */
import {readFileSync} from 'node:fs';
import {verifyEditorialAssets,EDITORIAL_MANIFEST_PATH} from './EditorialPhotoManifest.mjs';
const manifest=JSON.parse(readFileSync(EDITORIAL_MANIFEST_PATH,'utf8'));
const archive=JSON.parse(readFileSync('data/annals-approved.json','utf8'));
const result=verifyEditorialAssets(manifest,archive.entries);
console.log(JSON.stringify({editorialPhotoQualification:result,automaticGenerationConfigured:false}));
