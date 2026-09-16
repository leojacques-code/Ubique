const base=(process.argv[2]||process.env.APP_URL||'').replace(/\/$/,'');
if(!base){
  console.error('Usage: npm run smoke -- https://your-ubique.vercel.app');
  process.exit(1);
}

const checks=['/api/health','/','/opportunities','/pipeline','/settings'];
let failed=false;
for(const path of checks){
  try{
    const res=await fetch(`${base}${path}`,{redirect:'follow',headers:{'User-Agent':'Ubique-Smoke/1.0'}});
    const type=res.headers.get('content-type')||'';
    if(!res.ok){console.error(`FAIL ${path}: HTTP ${res.status}`);failed=true;continue;}
    if(path==='/api/health'&&type.includes('application/json')){
      const data=await res.json();
      console.log(`OK   ${path}: mode=${data.mode||'unknown'} commit=${data.commit||'n/a'}`);
    }else{
      const text=await res.text();
      if(!text.trim()){console.error(`FAIL ${path}: empty response`);failed=true;continue;}
      console.log(`OK   ${path}: HTTP ${res.status}`);
    }
  }catch(error){
    console.error(`FAIL ${path}: ${error instanceof Error?error.message:String(error)}`);
    failed=true;
  }
}
if(failed)process.exit(1);
console.log('Ubique remote smoke test passed.');
