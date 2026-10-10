/* Private thumbnail sanitiser for the existing Apps Script Annals project.
 * Accepts Drive-generated JPEG thumbnails only. Removes APP metadata and
 * comments; rejects images that cannot be verified as small baseline JPEGs.
 * No private original, EXIF or caller-supplied filename reaches GitHub.
 */
var AnnalsMedia = (function () {
  'use strict';
  function sanitize(raw) {
    if (!raw || typeof raw.length !== 'number' || raw.length < 24 ||
        raw.length > 1024 * 1024) throw new Error('Invalid private thumbnail');
    var bytes = Array.from(raw, function (x) { return x & 255; }), end = bytes.length;
    if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[end - 2] !== 255 || bytes[end - 1] !== 217)
      throw new Error('Thumbnail is not a complete JPEG');
    var out = [255,216], pos = 2, width = 0, height = 0, foundFrame = false, foundScan = false;
    var seenDqt = false, seenDht = false;
    while (pos < end - 2) {
      var start = pos;
      if (bytes[pos++] !== 255) throw new Error('Malformed image segment');
      while (pos < end - 2 && bytes[pos] === 255) pos++;
      var marker = bytes[pos++];
      if (pos + 1 >= end - 2 || marker === 0 || marker === 255 ||
          marker === 216 || marker === 217 || marker >= 208 && marker <= 215)
        throw new Error('Unsupported image marker');
      var length = bytes[pos] * 256 + bytes[pos + 1];
      if (length < 2 || pos + length > end - 2) throw new Error('Truncated image segment');
      var segmentEnd = pos + length;
      if (marker === 192) {
        if (foundFrame || length < 11) throw new Error('Unsupported image frame');
        foundFrame = true;
        height = bytes[pos + 3] * 256 + bytes[pos + 4];
        width = bytes[pos + 5] * 256 + bytes[pos + 6];
        if (bytes[pos + 2] !== 8 || !width || !height || width > 1000 || height > 1000)
          throw new Error('Image dimensions or format not allowed');
      }
      if (marker === 219) seenDqt = true;
      if (marker === 196) seenDht = true;
      // Even a generated JFIF thumbnail can carry EXIF or embedded imagery.
      // Omit all APP0–APP15 and COM segments rather than trusting metadata.
      var isMetadata = marker >= 224 && marker <= 239 || marker === 254;
      if (!isMetadata && ![192,196,219,218,221].includes(marker))
        throw new Error('Unsupported image coding segment');
      if (!isMetadata) for (var a = start; a < segmentEnd; a++) out.push(bytes[a]);
      pos = segmentEnd;
      if (marker === 218) {
        if (!foundFrame || !seenDqt || !seenDht || foundScan || length < 6)
          throw new Error('Incomplete image encoding');
        foundScan = true;
        while (pos < end - 2) {
          var b = bytes[pos++];
          if (b === 255) {
            var next = bytes[pos++];
            if (next === 0 || next >= 208 && next <= 215) { out.push(255,next); continue; }
            throw new Error('Unsupported scan continuation or hidden payload');
          }
          out.push(b);
        }
        out.push(255,217);
        break;
      }
    }
    if (!foundScan || out.length > 32768) throw new Error('No suitably small clean thumbnail');
    return { bytes: out, width: width, height: height };
  }
  return Object.freeze({sanitize: sanitize});
})();
if (typeof module !== 'undefined' && module.exports) module.exports = AnnalsMedia;
