'use strict';
(() => {
const Q=Quiet,C=SubmitCore,$=Q.$,KEY='quiet.teishutsu-guard.v1';
let rules={...C.DEFAULT_RULES},range=null,manualState=new Set(),result=null;
let lastSelection=null,saveTimer=null,updateTimer=null;
const ruleKeys=Object.keys(C.DEFAULT_RULES).filter(k=>k!=='name');
function readRules(){for(const k of ruleKeys)rules[k]=typeof C.DEFAULT_RULES[k]==='boolean'?$(k).checked:$(k).value;rules.name=$('ruleSetName').value.trim()||'自由設定';}
function putRules(){for(const k of ruleKeys){if(typeof C.DEFAULT_RULES[k]==='boolean')$(k).checked=rules[k];else $(k).value=rules[k];}$('ruleSetName').value=rules.name;}
function pack(){return {app:'teishutsu-guard',version:1,type:'backup',rules:Q.clone(rules),text:$('manuscript').value,filename:$('filename').value,range};}
function persist(){clearTimeout(saveTimer);if($('autosave').checked)saveTimer=setTimeout(()=>{if(!Q.save(KEY,pack(),true))$('autosave').checked=false;},250);}
function update(resetManual=false){
 readRules();if(resetManual)manualState.clear();
 result=C.check($('manuscript').value,$('filename').value,rules,range);
 $('ruleName').textContent=rules.name;$('charCount').textContent=Q.fmt(result.count);$('passCount').textContent=result.pass;$('failCount').textContent=result.fail+result.wait;
 const total=result.items.length,pct=total?Math.round(result.pass/total*100):0;
 $('progressFill').style.width=pct+'%';
 $('rangeStatus').textContent=range?`選択範囲をカウント（${range.end-range.start}コード単位）`:'全文をカウント';$('clearRange').hidden=!range;
 const badge=$('overallBadge');
 if(!total){badge.textContent='条件未設定';badge.className='badge';$('summaryText').textContent='チェックする条件を設定してください。';}
 else if(result.fail){badge.textContent='要確認';badge.className='badge bad';$('summaryText').textContent=`${total}項目中${result.fail}項目が条件未達${result.wait?`、${result.wait}項目が入力待ち`:''}です。`;}
 else if(result.wait){badge.textContent='入力待ち';badge.className='badge warn';$('summaryText').textContent=`${result.wait}項目が入力待ちです。`;}
 else {badge.textContent='自動照合 OK';badge.className='badge ok';$('summaryText').textContent=`設定した${total}項目を満たしています。内容と提出先は別途確認してください。`;}
 $('results').innerHTML=result.items.length?result.items.map(i=>`<div class="status-item ${i.status}"><span class="status-dot" aria-hidden="true">${i.status==='pass'?'✓':i.status==='fail'?'!':'–'}</span><div class="grow"><strong>${Q.esc(i.label)}</strong><small><span class="sr-only">${i.status==='pass'?'条件達成':i.status==='fail'?'条件未達':'入力待ち'}。</span>${Q.esc(i.detail)}</small></div></div>`).join(''):'<div class="empty"><div class="empty-glyph" aria-hidden="true">✓</div><strong>確認したい条件を、左の欄に。</strong>スマホでは、この上にある「提出条件」を設定してください。</div>';
 $('manualArea').hidden=!result.manual.length;
 $('manualChecks').innerHTML=result.manual.map((text,i)=>`<label class="check"><input type="checkbox" data-manual="${i}" ${manualState.has(text)?'checked':''}><span>${Q.esc(text)}</span></label>`).join('');
 persist();
}
function exportReport(){update();const marks={pass:'OK',fail:'要確認',wait:'未入力'};const text=[`# 提出ガード チェック結果`,``,`日時: ${Q.date()}`,`条件セット: ${Q.md(rules.name)}`,`ファイル名: ${Q.md($('filename').value||'未指定')}`,`対象: ${range?'選択範囲':'全文'}`,`文字数: ${result.count}`,``,`## 自動照合`,...result.items.map(i=>`- [${marks[i.status]}] ${Q.md(i.label)} — ${Q.md(i.detail)}`),``,`## 手動確認`,...result.manual.map(t=>`- [${manualState.has(t)?'x':' '}] ${Q.md(t)}`),``,`## カウント設定`,`空白・タブを除く: ${rules.ignoreSpaces?'はい':'いいえ'}`,`改行を除く: ${rules.ignoreNewlines?'はい':'いいえ'}`,`Markdown見出しを除く: ${rules.excludeHeadings?'はい':'いいえ'}`,`参考文献以降を除く: ${rules.excludeReferences?'はい':'いいえ'}`,``,`この結果は提出条件との機械的照合です。内容の正確さや提出の完了は保証しません。原稿本文は含めていません。`].join('\n');Q.download('提出ガード_チェック結果.md',text);}
function reset(){clearTimeout(saveTimer);clearTimeout(updateTimer);rules={...C.DEFAULT_RULES};range=null;manualState.clear();lastSelection=null;$('manuscript').value='';$('filename').value='';$('autosave').checked=false;$('preset').value='custom';putRules();Q.save(KEY,null,false);update();}
function sample(){
 if(($('manuscript').value||$('filename').value)&&!confirm('現在の原稿と条件をサンプルに置き換えます。必要なデータは先にバックアップしてください。'))return;
 rules={...C.DEFAULT_RULES,name:'お試し：提出前チェック',min:'180',max:'400',required:'背景\n提案\n参考文献',filenameParts:'20260001',extensions:'pdf',manual:'課題の問いに答えている\n引用元と提出先を確認した'};
 $('manuscript').value='# 背景\n日常の作業では、内容を考えることに集中するあまり、提出時の細かな条件を見落としてしまうことがある。文字数やファイル名は単純な条件だが、締切直前に確認すると負担が大きい。\n\n# 提案\n原稿を書きながら提出条件を確認できる仕組みを用意する。自動で確認できる文字数や語句と、人が判断すべき内容の正確さを分けて表示することで、見落としを減らす。条件の共有は原稿とは別のファイルで行い、不要な個人情報を広めないことも重要である。';
 $('filename').value='レポート.docx';$('preset').value='custom';range=null;putRules();update(true);Q.toast('サンプルを読み込みました。参考文献・ファイル名・拡張子に確認点があります。');
}
$('helpBtn').onclick=Q.help;$('closeHelp').onclick=()=>$('helpDialog').close();$('sampleBtn').onclick=sample;
$('manuscript').addEventListener('input',()=>{range=null;lastSelection=null;manualState.clear();clearTimeout(updateTimer);updateTimer=setTimeout(()=>update(true),120);});
$('manuscript').addEventListener('select',()=>{const t=$('manuscript');if(t.selectionEnd>t.selectionStart)lastSelection={start:t.selectionStart,end:t.selectionEnd};});
$('useSelection').onclick=()=>{const t=$('manuscript');const r=t.selectionEnd>t.selectionStart?{start:t.selectionStart,end:t.selectionEnd}:lastSelection;if(!r||r.end>t.value.length)return Q.toast('原稿内の、数えたい部分を先に選択してください。');range=r;update(true);};
$('clearRange').onclick=()=>{range=null;update(true);};
[...ruleKeys,'ruleSetName','filename'].forEach(k=>$(k).addEventListener('input',()=>{clearTimeout(updateTimer);updateTimer=setTimeout(()=>update(true),100);}));
$('manualChecks').addEventListener('change',e=>{const i=e.target.dataset.manual;if(i===undefined)return;const text=result.manual[Number(i)];if(e.target.checked)manualState.add(text);else manualState.delete(text);});
$('preset').onchange=()=>{if($('preset').value==='custom')return;rules={...C.DEFAULT_RULES,...($('preset').value==='report'?{name:'レポート',min:'1800',max:'2200',required:'参考文献',extensions:'pdf',manual:'課題に答えている\n引用元を確認した\n提出先と締切を確認した'}:{name:'応募文',max:'400',manual:'応募先の名称に間違いがない\n連絡先に間違いがない'})};putRules();update(true);};
$('fileBtn').onclick=()=>$('sourceFile').click();$('sourceFile').onchange=async e=>{
 const file=e.target.files[0];e.target.value='';if(!file)return;
 try{const ext=file.name.split('.').pop().toLowerCase();if(['txt','md'].includes(ext)){if(file.size>3*1024*1024)throw new Error('本文ファイルは3MBまでです。');const text=(await file.text()).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');if(text.length>C.LIMIT)throw new Error('原稿は100万コード単位までです。');if(text.includes('\u0000'))throw new Error('テキストとして読み込めません。UTF-8の .txt / .md を選んでください。');if($('manuscript').value&&!confirm('現在の原稿を、選択したファイルの本文に置き換えますか？'))return;$('manuscript').value=text;range=null;Q.toast('本文とファイル名を読み込みました。');}else Q.toast('ファイル名のみ読み込みました。本文はコピーして貼り付けてください。');$('filename').value=file.name;update(true);}catch(err){Q.toast(err.message);}
};
$('exportRules').onclick=()=>{readRules();try{Q.json('提出ガード_条件.json',C.rulePack(rules));}catch(err){Q.toast(err.message);}};
$('backupBtn').onclick=()=>{readRules();Q.json('提出ガード_バックアップ.json',pack());};
$('importBtn').onclick=()=>$('importFile').click();$('importFile').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{const data=C.validatePack(await Q.readJSON(file,8*1024*1024));if(!confirm(data.type==='rules'?'現在の条件を読み込んだ条件に置き換えます。原稿は維持します。':'現在の原稿・条件をバックアップの内容に置き換えますか？'))return;rules=data.rules;if(data.type==='backup'){$('manuscript').value=data.text;$('filename').value=data.filename;range=data.range;}putRules();$('preset').value='custom';update(true);Q.toast('読み込みました。手動確認は未確認に戻しています。');}catch(err){Q.toast(err.message);}};
$('exportReport').onclick=exportReport;$('autosave').onchange=()=>{clearTimeout(saveTimer);readRules();const ok=Q.save(KEY,pack(),$('autosave').checked);if(!ok)$('autosave').checked=false;};$('resetBtn').onclick=()=>{if(confirm('このアプリの原稿・条件・端末への保存データをすべて消去します。よろしいですか？')){reset();Q.toast('データを消去しました。');}};
const saved=Q.load(KEY,C.validatePack);if(saved&&saved.type==='backup'){rules=saved.rules;$('manuscript').value=saved.text;$('filename').value=saved.filename;range=saved.range;$('autosave').checked=true;}putRules();update();
window.addEventListener('storage',e=>{if(e.key===KEY&&$('autosave').checked){clearTimeout(saveTimer);$('autosave').checked=false;Q.toast('別タブで保存データが変更されたため、自動保存を停止しました。必要な内容をバックアップしてから再読み込みしてください。');}});
window.addEventListener('pagehide',()=>{clearTimeout(saveTimer);if($('autosave').checked){readRules();Q.save(KEY,pack(),true);}});
})();
