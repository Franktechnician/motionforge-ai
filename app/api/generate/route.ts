import {NextRequest,NextResponse} from 'next/server';
import {authorized} from '../../lib/auth';
const allowed=['image','text_video','image_video','lip_sync','motion_control','video_extend','effects','start_end','image_edit'] as const;
const envKeys:Record<string,string>={image:'REPLICATE_IMAGE_MODEL',text_video:'REPLICATE_TEXT_VIDEO_MODEL',image_video:'REPLICATE_IMAGE_VIDEO_MODEL',lip_sync:'REPLICATE_LIP_SYNC_MODEL',motion_control:'REPLICATE_MOTION_CONTROL_MODEL',video_extend:'REPLICATE_VIDEO_EXTEND_MODEL',effects:'REPLICATE_EFFECTS_MODEL',start_end:'REPLICATE_START_END_MODEL',image_edit:'REPLICATE_IMAGE_EDIT_MODEL'};
const defaults:Record<string,string>={image:'black-forest-labs/flux-schnell'};
const urlOk=(v:unknown)=>{try{const u=new URL(String(v));return u.protocol==='https:'}catch{return false}};
export async function POST(req:NextRequest){
 if(!authorized(req))return NextResponse.json({error:'Invalid studio access key or STUDIO_ACCESS_KEY is not configured'},{status:401});
 try{
 const body=await req.json();const {mode,prompt,aspectRatio,duration,imageUrl,endImageUrl,videoUrl,audioUrl,motionUrl,effect}=body;
 if(!allowed.includes(mode))return NextResponse.json({error:'Unsupported mode'},{status:400});
 if(typeof prompt!=='string'||!prompt.trim()||prompt.length>3000)return NextResponse.json({error:'Prompt required (max 3000 characters)'},{status:400});
 const token=process.env.REPLICATE_API_TOKEN;if(!token)return NextResponse.json({error:'Set REPLICATE_API_TOKEN'},{status:503});
 const model=process.env[envKeys[mode]]||defaults[mode];if(!model||!/^[-\w.]+\/[-\w.]+$/.test(model))return NextResponse.json({error:`Configure ${envKeys[mode]} with a compatible Replicate model`},{status:400});
 const needs:Record<string,string[]>={image_video:['imageUrl'],lip_sync:['videoUrl','audioUrl'],motion_control:['imageUrl','motionUrl'],video_extend:['videoUrl'],start_end:['imageUrl','endImageUrl'],image_edit:['imageUrl']};
 const fields:Record<string,unknown>={imageUrl,endImageUrl,videoUrl,audioUrl,motionUrl};for(const key of needs[mode]||[])if(!urlOk(fields[key]))return NextResponse.json({error:`Valid HTTPS ${key} required`},{status:400});
 const input:Record<string,unknown>={prompt};if(mode==='image')input.aspect_ratio=aspectRatio||'16:9';else{input.duration=Math.min(10,Math.max(5,Number(duration)||5));input.aspect_ratio=aspectRatio||'16:9'};
 // Override per-model input keys with a JSON object in the corresponding REPLICATE_*_INPUT_MAP env var.
 const maps:Record<string,string>={imageUrl:'image',endImageUrl:'end_image',videoUrl:'video',audioUrl:'audio',motionUrl:'motion_video',effect:'effect'};
 const mapName=envKeys[mode].replace('_MODEL','_INPUT_MAP');let custom:Record<string,string>={};try{custom=JSON.parse(process.env[mapName]||'{}')}catch{return NextResponse.json({error:`Invalid ${mapName} JSON`},{status:500})}
 for(const [key,field] of Object.entries(maps)){const value=body[key];if(typeof value==='string'&&value.trim())input[custom[key]||field]=value}
 const response=await fetch(`https://api.replicate.com/v1/models/${model}/predictions`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Prefer:'wait=5'},body:JSON.stringify({input}),cache:'no-store'});
 const data=await response.json();if(!response.ok)return NextResponse.json({error:String(data.detail||data.error||'Provider error')},{status:response.status});
 return NextResponse.json({id:data.id,status:data.status,output:data.output});
 } catch (error) {
  console.error(
    "GENERATION_ERROR:",
    error instanceof Error ? error.message : "Unknown error"
  );

  return NextResponse.json(
    { error: "Generation request failed. Check server logs." },
    { status: 500 }
  );
}
