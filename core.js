/* Pure checking engine. Browser + Node; no DOM, storage, or network access. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SubmitCore=api;})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
const DEFAULT_RULES={name:'自由設定',min:'',max:'',ignoreSpaces:true,ignoreNewlines:true,excludeHeadings:false,excludeReferences:false,required:'',forbidden:'',filenameParts:'',extensions:'',manual:''};
const LIMIT=1000000;
function string(v,max=10000){if(typeof v!=='string'||v.length>max)throw new Error('文字列の形式または長さが不正です。');return v;}
function lines(value){return [...new Set(String(value).split(/\r?\n/).map(s=>s.trim()).filter(Boolean))];}
function normalizeRules(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('提出条件の形式が不正です。');
 const out={};
 for(const [key,def] of Object.entries(DEFAULT_RULES)){
  const value=input[key]??def;
  if(typeof def==='boolean'){if(typeof value!=='boolean')throw new Error('カウント設定の形式が不正です。');out[key]=value;}
  else {out[key]=string(value,key==='name'?120:10000);}
 }
 for(const key of ['required','forbidden','filenameParts','manual'])if(lines(out[key]).length>100)throw new Error('条件は各項目100件までです。');
 return out;
}
function bounds(rules){
 const val=(v)=>v.trim()===''?null:(/^\d+$/.test(v.trim())?Number(v):NaN);
 const min=val(rules.min),max=val(rules.max);
 if([min,max].some(v=>v!==null&&(!Number.isSafeInteger(v)||v<0||v>LIMIT)))return {error:'文字数は0〜1,000,000の整数で指定してください。'};
 if(min!==null&&max!==null&&min>max)return {error:'下限が上限を超えています。'};
 return {min,max};
}
function extensions(value){return [...new Set(value.split(/[\s,、]+/).filter(Boolean).map(s=>s.toLowerCase().replace(/^\./,'')))];}
function extract(text,rules,range){
 let str=String(text).replace(/\r\n?/g,'\n');
 // Range offsets refer to the textarea value, whose newlines are already LF.
 if(range&&Number.isInteger(range.start)&&Number.isInteger(range.end)&&range.start>=0&&range.end>range.start&&range.end<=str.length)str=str.slice(range.start,range.end);
 const arr=str.split('\n'), kept=[];let ref=false;
 for(const line of arr){
  const clean=line.trim().replace(/^#{1,6}\s+/,'').replace(/[：:]$/,'').trim();
  if(rules.excludeReferences&&/^(参考文献|引用文献|references)$/i.test(clean))ref=true;
  if(ref)continue;
  if(rules.excludeHeadings&&/^\s{0,3}#{1,6}\s+/.test(line))continue;
  kept.push(line);
 }
 return kept.join('\n');
}
function graphemes(value){const str=value.normalize('NFC');if(typeof Intl.Segmenter==='function'){let n=0;for(const _ of new Intl.Segmenter('ja',{granularity:'grapheme'}).segment(str))n++;return n;}return Array.from(str).length;}
function count(text,rules,range){let selected=extract(text,rules,range);if(rules.ignoreNewlines)selected=selected.replace(/\n/g,'');if(rules.ignoreSpaces)selected=selected.replace(/[^\S\n]/gu,'');return {count:graphemes(selected),effective:selected};}
function check(text,filename,rules,range=null){
 const {count:n,effective}=count(text,rules,range),items=[],hasText=text.trim().length>0,b=bounds(rules);
 const add=(key,label,status,detail)=>items.push({key,label,status,detail});
 if(b.error)add('bounds','文字数の条件','fail',b.error);
 else if(b.min!==null||b.max!==null){
  const good=(b.min===null||n>=b.min)&&(b.max===null||n<=b.max);
  let detail=`${n.toLocaleString('ja-JP')}字 / ${b.min??'指定なし'}〜${b.max??'指定なし'}字`;
  if(b.min!==null&&n<b.min)detail+=`。あと${b.min-n}字必要です。`;
  if(b.max!==null&&n>b.max)detail+=`。${n-b.max}字超過しています。`;
  add('count','本文の文字数',hasText?(good?'pass':'fail'):'wait',hasText?detail:'原稿を入力してください。');
 }
 const norm=text.normalize('NFC');
 for(const term of lines(rules.required))add('required:'+term,`必須語句「${term}」`,hasText?(norm.includes(term.normalize('NFC'))?'pass':'fail'):'wait',hasText?(norm.includes(term.normalize('NFC'))?'原稿全体で見つかりました。':'原稿全体に見つかりません。'):'原稿を入力してください。');
 for(const term of lines(rules.forbidden))add('forbidden:'+term,`禁止語句「${term}」`,hasText?(norm.includes(term.normalize('NFC'))?'fail':'pass'):'wait',hasText?(norm.includes(term.normalize('NFC'))?'原稿に含まれています。':'原稿には含まれていません。'):'原稿を入力してください。');
 for(const part of lines(rules.filenameParts))add('filename:'+part,`ファイル名に「${part}」`,filename?(filename.normalize('NFC').includes(part.normalize('NFC'))?'pass':'fail'):'wait',filename||'ファイル名を入力するか、提出予定ファイルを選んでください。');
 const ext=extensions(rules.extensions);
 if(ext.length){
  const bad=ext.some(s=>!/^[a-z0-9]{1,16}$/.test(s));
  const current=filename.includes('.')?filename.split('.').pop().toLowerCase():'';
  add('extension','ファイルの拡張子',bad?'fail':(!filename?'wait':(ext.includes(current)?'pass':'fail')),bad?'拡張子は pdf, docx のように指定してください。':`許可: ${ext.map(s=>'.'+s).join(' / ')}。現在: ${filename?(current?'.'+current:'拡張子なし'):'未入力'}。中身の形式は検証しません。`);
 }
 return {count:n,effective,items,pass:items.filter(x=>x.status==='pass').length,fail:items.filter(x=>x.status==='fail').length,wait:items.filter(x=>x.status==='wait').length,manual:lines(rules.manual)};
}
function rulePack(rules){return {app:'teishutsu-guard',version:1,type:'rules',rules:normalizeRules(rules)};}
function validatePack(data){
 if(!data||data.app!=='teishutsu-guard'||data.version!==1||!['rules','backup'].includes(data.type))throw new Error('提出ガード v1の条件ファイルまたはバックアップを選んでください。');
 const out={app:data.app,version:1,type:data.type,rules:normalizeRules(data.rules)};
 if(data.type==='backup'){
  out.text=string(data.text,LIMIT);out.filename=string(data.filename,500);
  out.range=null;
  if(data.range!==null&&data.range!==undefined){const r=data.range;if(!r||!Number.isInteger(r.start)||!Number.isInteger(r.end)||r.start<0||r.end<=r.start||r.end>out.text.length)throw new Error('選択範囲の情報が不正です。');out.range={start:r.start,end:r.end};}
 }
 return out;
}
return {DEFAULT_RULES,LIMIT,lines,normalizeRules,bounds,extensions,extract,graphemes,count,check,rulePack,validatePack};
});
