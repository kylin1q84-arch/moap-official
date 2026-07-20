import {mkdir,rm,copyFile,readdir} from "node:fs/promises";
import {join} from "node:path";
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.VITE_SUPABASE_URL||"";
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.VITE_SUPABASE_PUBLISHABLE_KEY||"";
await rm("dist",{recursive:true,force:true});await mkdir("dist",{recursive:true});
for(const file of await readdir("src")){await copyFile(join("src",file),join("dist",file));}
const {writeFile}=await import("node:fs/promises");
await writeFile("dist/config.js",`export const MOAP_CONFIG=${JSON.stringify({supabaseUrl:url,supabaseKey:key})};\n`,`utf8`);
console.log(`MOAP static cloud build ready. Supabase URL: ${url?"configured":"MISSING"}; Key: ${key?"configured":"MISSING"}`);
