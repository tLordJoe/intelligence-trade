import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {readDisclosureRelease,writeDisclosureRelease} from "../src/lib/disclosure-storage.ts";
test("compressed publications round-trip, bind bytes, and refuse path traversal",()=>{
  const dir=mkdtempSync(join(tmpdir(),"outfox-publication-")),path=join(dir,"live.json");
  try{
    mkdirSync(join(dir,"published-data"));const value={payload:{records:[{id:"synthetic"}]},approval:{reviewer:"test"}};
    const pointer=writeDisclosureRelease(path,value);assert.deepEqual(readDisclosureRelease(path),value);
    writeFileSync(join(dir,"published-data",pointer.file),"changed");assert.throws(()=>readDisclosureRelease(path),/hash mismatch/);
    const original=JSON.parse(readFileSync(path,"utf8"));writeFileSync(path,JSON.stringify({...original,file:"../secrets"}));assert.throws(()=>readDisclosureRelease(path),/dataset path/);
    writeFileSync(path,JSON.stringify(value));assert.deepEqual(readDisclosureRelease(path),value);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
