import Codec from './JpegCodec.js';
import Derivative from './PhotoDerivative.js';
import Media from './MediaCore.js';

// The signature binds the full screened derivative. The thumbnail is a fixed
// deterministic downscale of those exact bytes; no new content is introduced.
export function photoThumbnail(asset){
  if(!/^assets\/annals\/[a-f0-9]{64}\.jpg$/.test(asset.path))return null;
  const clean=Media.sanitize(asset.bytes,true);
  if(Math.max(clean.width,clean.height)<800)return null;
  const result=Derivative.thumbnail(clean.bytes,Codec,Media);
  return {path:asset.path.replace(/\.jpg$/,'-thumb.jpg'),bytes:Buffer.from(result.bytes)};
}
