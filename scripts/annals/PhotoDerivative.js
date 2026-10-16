/* Private pure JPEG orientation/resize adapter. No network, storage or consent.
 * Input and decoded pixels never leave the private Apps Script process.
 * The caller must still screen and sign the resulting derivative.
 */
var AnnalsPhotoDerivative = (function () {
  'use strict';
  var MAX_INPUT=8*1024*1024, MAX_PIXELS=13000000, MAX_EDGE=1600;
  function orientation(raw) {
    var b=raw, pos=2, found=null;
    function fail(){throw new Error('Ambiguous or invalid JPEG orientation');}
    if(!b||b.length<4||b[0]!==255||b[1]!==216)fail();
    while(pos<b.length-2){
      if(b[pos++]!==255)fail();
      while(b[pos]===255)pos++;
      var marker=b[pos++];
      if(marker===218||marker===217)break;
      if(pos+2>b.length)fail();
      var length=b[pos]*256+b[pos+1], end=pos+length;
      if(length<2||end>b.length)fail();
      if(marker===225&&length>=8&&b[pos+2]===69&&b[pos+3]===120&&b[pos+4]===105&&b[pos+5]===102&&b[pos+6]===0&&b[pos+7]===0){
        var t=pos+8, little=b[t]===73&&b[t+1]===73;
        if(!little&&!(b[t]===77&&b[t+1]===77))fail();
        function u16(p){if(p<t||p+2>end)fail();return little?b[p]+b[p+1]*256:b[p]*256+b[p+1];}
        function u32(p){if(p<t||p+4>end)fail();return little?b[p]+b[p+1]*256+b[p+2]*65536+b[p+3]*16777216:b[p]*16777216+b[p+1]*65536+b[p+2]*256+b[p+3];}
        if(u16(t+2)!==42)fail();
        var directory=t+u32(t+4), count=u16(directory);
        if(count>1024||directory+2+count*12+4>end)fail();
        for(var i=0;i<count;i++){
          var entry=directory+2+i*12;
          if(u16(entry)!==274)continue;
          if(u16(entry+2)!==3||u32(entry+4)!==1)fail();
          var value=u16(entry+8);
          if(value<1||value>8||found!==null)fail();
          found=value;
        }
      }
      pos=end;
    }
    return found===null?1:found;
  }
  function frame(raw){
    var p=2;
    while(p<raw.length-2){
      if(raw[p++]!==255)throw new Error('Invalid JPEG markers');
      while(raw[p]===255)p++;
      var marker=raw[p++], length=raw[p]*256+raw[p+1];
      if(length<2||p+length>raw.length)throw new Error('Invalid JPEG segment');
      if(marker===192||marker===194){
        if(length<11||raw[p+2]!==8||![1,3,4].includes(raw[p+7])||length!==8+3*raw[p+7])throw new Error('Invalid JPEG frame components');
        var h=raw[p+3]*256+raw[p+4],w=raw[p+5]*256+raw[p+6];
        if(!w||!h||w*h>MAX_PIXELS||w>8192||h>8192)throw new Error('JPEG resolution exceeds private bound');
        return {width:w,height:h};
      }
      if(marker===218)break;
      p+=length;
    }
    throw new Error('Unsupported JPEG frame');
  }
  function resize(image,rotation,longEdge){
    var swapped=rotation>=5, ow=swapped?image.height:image.width, oh=swapped?image.width:image.height;
    var scale=Math.min(1,longEdge/Math.max(ow,oh)), w=Math.max(1,Math.round(ow*scale)),h=Math.max(1,Math.round(oh*scale));
    var out=new Uint8Array(w*h*4),iw=image.width,ih=image.height,data=image.data;
    // Bilinear sampling in the upright coordinate system. Never upscale.
    for(var y=0;y<h;y++)for(var x=0;x<w;x++){
      var u=Math.max(0,Math.min(ow-1,(x+0.5)*ow/w-0.5)),v=Math.max(0,Math.min(oh-1,(y+0.5)*oh/h-0.5));
      var sx,sy;
      if(rotation===2){sx=iw-1-u;sy=v;}else if(rotation===3){sx=iw-1-u;sy=ih-1-v;}
      else if(rotation===4){sx=u;sy=ih-1-v;}else if(rotation===5){sx=v;sy=u;}
      else if(rotation===6){sx=v;sy=ih-1-u;}else if(rotation===7){sx=iw-1-v;sy=ih-1-u;}
      else if(rotation===8){sx=iw-1-v;sy=u;}else{sx=u;sy=v;}
      var x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(iw-1,x0+1),y1=Math.min(ih-1,y0+1),fx=sx-x0,fy=sy-y0,at=(y*w+x)*4;
      for(var c=0;c<3;c++)out[at+c]=Math.round((1-fy)*((1-fx)*data[(y0*iw+x0)*4+c]+fx*data[(y0*iw+x1)*4+c])+fy*((1-fx)*data[(y1*iw+x0)*4+c]+fx*data[(y1*iw+x1)*4+c]));
      out[at+3]=255;
    }
    return {data:out,width:w,height:h};
  }
  function convert(raw,codec,media){
    if(!raw||raw.length<24||raw.length>MAX_INPUT)throw new Error('JPEG input exceeds private bound');
    var bytes=new Uint8Array(raw.length);
    for(var i=0;i<raw.length;i++)bytes[i]=raw[i]&255;
    var dimensions=frame(bytes),rotation=orientation(bytes);
    if(!codec||!media)throw new Error('Private JPEG modules unavailable');
    var decoded=codec.decode(bytes,{useTArray:true,formatAsRGBA:true,tolerantDecoding:false,maxResolutionInMP:13,maxMemoryUsageInMB:256});
    if(decoded.width!==dimensions.width||decoded.height!==dimensions.height)throw new Error('JPEG decoded dimensions disagree');
    // Quality and size are bounded, without degrading to tiny thumbnails.
    // If none fits, hold the photo rather than silently publish poor detail.
    for(var edge of [MAX_EDGE,1280,1000,800]){
      var upright=resize(decoded,rotation,edge);
      if(Math.max(upright.width,upright.height)<800)throw new Error('Photograph too small for qualified gallery');
      for(var quality of [85,75,65]){
        var encoded=codec.encode(upright,quality);
        if(encoded.data.length>524288)continue;
        var clean=media.sanitize(encoded.data,true);
        clean.orientation=rotation;clean.quality=quality;
        return clean;
      }
    }
    throw new Error('No adequate bounded photograph derivative');
  }
  function thumbnail(raw,codec,media){
    // Input is the screened public derivative, never an original.
    var clean=media.sanitize(raw,true);
    var decoded=codec.decode(clean.bytes,{useTArray:true,formatAsRGBA:true,tolerantDecoding:false,maxResolutionInMP:2.56,maxMemoryUsageInMB:64});
    var small=resize(decoded,1,400);
    for(var quality of [75,65,55]){
      var encoded=codec.encode(small,quality);
      if(encoded.data.length>98304)continue;
      return media.sanitize(encoded.data,true);
    }
    throw new Error('Bounded responsive thumbnail unavailable');
  }
  return Object.freeze({orientation:orientation,resize:resize,convert:convert,frame:frame,thumbnail:thumbnail});
})();
/** Called only inside the gated new-photo path. HEIC/PNG/WebP use the existing
 * Drive conversion; this adapter never mislabels those bytes as JPEG. */
function annalsQualifiedPhotoDerivative_(original,item){
  if(!item||String(item.mime||'').toLowerCase()!=='image/jpeg')return null;
  try{
    if(typeof AnnalsJpegCodec==='undefined'||typeof AnnalsMedia==='undefined')return null;
    return AnnalsPhotoDerivative.convert(original.getBlob().getBytes(),AnnalsJpegCodec,AnnalsMedia);
  }catch(_){return null;}
}
if(typeof module!=='undefined'&&module.exports)module.exports=AnnalsPhotoDerivative;
