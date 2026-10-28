/* Owner-only runtime qualification for the actual private JPEG conversion
 * pipeline. Uses a temporary, owner-private Drive folder and fictional pixels.
 * It bypasses publication gates intentionally and never dispatches externally.
 * The folder is trashed in finally; no production photo, secret or gate is read.
 */
function annalsQualifyPhotoRoundTripInEditor(){
  annalsOwner_();
  var result=annalsRunPhotoRoundTripFixture_();
  console.log(JSON.stringify(result));
  return result;
}

function annalsRunPhotoRoundTripFixture_(){
  if(typeof AnnalsPhotoDerivative==='undefined'||typeof AnnalsJpegCodec==='undefined'||
     typeof AnnalsMedia==='undefined'||typeof AnnalsPhotos==='undefined'||
     typeof AnnalsProduction==='undefined'||typeof annalsConvertPhotoOnce_!=='function'||
     typeof annalsFolder_!=='function')throw new Error('Photo qualification modules unavailable');
  var folder=null;
  try{
  var fixtureId=annalsHash_(Utilities.getUuid());
  folder=annalsFolder_(fixtureId,true);
  var width=1600,height=1200,pixels=new Uint8Array(width*height*4);
  for(var y=0;y<height;y++)for(var x=0;x<width;x++){
    var p=(y*width+x)*4;pixels[p]=x<width/2?220:35;
    pixels[p+1]=y<height/2?180:45;pixels[p+2]=90;pixels[p+3]=255;
  }
  var original=AnnalsJpegCodec.encode({data:pixels,width:width,height:height},82).data;
  pixels=null;
  var originalHash=annalsQualificationSha256_(original);
  var originalFile=annalsPrivate_(folder.createFile(Utilities.newBlob(original,'image/jpeg','synthetic-original.jpg')));
  var derivative=annalsConvertPhotoOnce_(folder,originalFile,{index:0,mime:'image/jpeg',size:original.length});
  if(!derivative)throw new Error('Private runtime JPEG conversion failed');
  var thumbnail=AnnalsPhotoDerivative.thumbnail(derivative.bytes,AnnalsJpegCodec,AnnalsMedia);
  if(derivative.width!==1600||derivative.height!==1200||thumbnail.width!==400||thumbnail.height!==300||
     derivative.bytes.length>AnnalsPhotos.MAX_BYTES||thumbnail.bytes.length>98304)
    throw new Error('Synthetic photo dimensions or byte bounds failed');

  var corrupt=[1,2,3,4],corruptFile=annalsPrivate_(folder.createFile(
    Utilities.newBlob(corrupt,'image/jpeg','synthetic-corrupt.jpg')));
  var corruptResult=annalsConvertPhotoOnce_(folder,corruptFile,{index:1,mime:'image/jpeg',size:corrupt.length});
  var corruptMarker=annalsRead_(folder,'photo-conversion-1-private.json');
  var corruptRejected=!corruptResult&&corruptMarker&&corruptMarker.state==='held_no_retry';
  var originalFallback=annalsFile_(folder,'synthetic-original.jpg');
  if(!corruptRejected||!originalFallback||annalsQualificationSha256_(originalFallback.getBlob().getBytes())!==originalHash)
    throw new Error('Synthetic corrupt-image fallback failed');
  // Signing API smoke check only: this uses an ephemeral key and does not
  // create or verify a production approval receipt.
  var testKey='synthetic-runtime-qualification-key-only',message=originalHash;
  var signature=annalsHex_(Utilities.computeHmacSha256Signature(message,testKey,Utilities.Charset.UTF_8));
  var verified=signature===annalsHex_(Utilities.computeHmacSha256Signature(message,testKey,Utilities.Charset.UTF_8));
  var tamperedAccepted=signature===annalsHex_(Utilities.computeHmacSha256Signature(message+'x',testKey,Utilities.Charset.UTF_8));
  if(!verified||tamperedAccepted)throw new Error('Synthetic HMAC smoke check failed');
  return {state:'passed_owner_private_runtime_fixture',genuinePhotoAccepted:false,
    privateStorageRoundTrip:true,
    converted:{width:derivative.width,height:derivative.height,bytes:derivative.bytes.length},
    thumbnail:{width:thumbnail.width,height:thumbnail.height,bytes:thumbnail.bytes.length},
    corruptRejected:corruptRejected,originalPreserved:true,hmacApiVerified:verified,
    tamperedHmacRejected:!tamperedAccepted,providerCalls:0,publicMutation:false};
  }finally{
    // The fixture is a new, uniquely named child of the already-private
    // production folder. Trash it even if conversion or assertions fail.
    if(folder)folder.setTrashed(true);
  }
}

function annalsQualificationSha256_(value){
  var bytes=typeof value==='string'?
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8):
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value);
  return annalsHex_(bytes);
}

