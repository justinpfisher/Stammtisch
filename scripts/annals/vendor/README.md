# JPEG codec provenance

`../JpegCodec.js` vendors the unchanged LF-normalised `lib/decoder.js` and
`lib/encoder.js` from [jpeg-js 0.4.4](https://github.com/jpeg-js/jpeg-js), inside
a local closure exposing only `decode` and `encode`. The closure leaves its
CommonJS/browser export targets undefined so native Apps Script uses typed arrays
without Node Buffer, a module loader or a browser. It does not execute the unused
upstream browser helpers. License headers and the package license are embedded
in the installation source; the package license is also retained here.

Source: `https://registry.npmjs.org/jpeg-js/-/jpeg-js-0.4.4.tgz`.
Tarball SHA-512 (base64):
`WZzeDOEtTOBK4Mdsar0IqEU5sMr3vSV2RqkAIzUEV2BHnUfKGyswWFPFwK5EeDo93K3FohSHbLAjj0s1Wzd+dg==`.
It was fetched with scripts disabled and its integrity checked before vendoring.
There is no runtime npm download or new production dependency installation.

Version 0.4.4 is the fix boundary for the [reviewed infinite-loop advisory](https://github.com/advisories/GHSA-xvf7-4v9q-58w6).
This does not prove absence of all decoder faults. The private wrapper rejects
inputs over 8 MiB, frames over 13 million pixels or 8192 pixels on either edge,
and malformed/ambiguous EXIF; strict decoding has a 256 MiB allocation-accounting
limit. This limit excludes some process overhead. Conversion is reserved once
per attachment before decoding. Pure fixtures verify orientation, dimensions,
metadata removal and native V8-style loading; genuine Apps Script performance,
iPhone JPEG colour/detail and HEIC conversion still require private acceptance.
