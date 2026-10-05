from pathlib import Path
import os, shutil
from playwright.sync_api import sync_playwright
import json, sys, traceback
from browser_harness import mount
OUT=Path(__file__).resolve().parent; results=[]

def check(app,name,condition):
    ok=bool(condition);results.append({'app':app,'test':name,'pass':ok})
    print(('PASS' if ok else 'FAIL')+' '+app+' '+name,flush=True)
    if not ok: raise AssertionError(name)

def spy(page):
    page.evaluate('''()=>{window.__exports=[];Quiet.download=async(name,content,type)=>{const blob=content instanceof Blob?content:new Blob([content]);window.__exports.push({name,type:type||blob.type,text:blob.type==='image/png'?null:await blob.text(),signature:blob.type==='image/png'?Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0,8)):null});};}''')

def exported(page,button,parse=True):
    old=page.evaluate('__exports.length');page.click(button)
    for _ in range(40):
        if page.evaluate('__exports.length')>old: break
        page.wait_for_timeout(50)
    x=page.evaluate('__exports.at(-1)');return json.loads(x['text']) if parse else x

def import_json(page,selector,data,name='backup.json'):
    buf=data if isinstance(data,bytes) else json.dumps(data,ensure_ascii=False).encode()
    page.locator(selector).set_input_files({'name':name,'mimeType':'application/json','buffer':buf})
    page.wait_for_timeout(180)

def boot(b,slug,storage=None):
    p=b.new_page(viewport={'width':1440,'height':1050})
    p.set_default_timeout(7000);errs=[];p.on('pageerror',lambda e:errs.append(str(e)))
    p.on('dialog',lambda d:d.accept());mount(p,slug,storage={} if storage is None else storage);spy(p)
    return p,errs

def storage(p):return p.evaluate('Object.fromEntries(__testStorage)')

def submit(b):
    s='teishutsu-guard';p,errs=boot(b,s)
    check(s,'empty state is not falsely passed',p.locator('#overallBadge').inner_text()!='自動照合 OK')
    p.click('#sampleBtn');check(s,'sample failures are exposed',p.locator('#failCount').inner_text()=='3')
    original=p.locator('#manuscript').input_value()
    rule=exported(p,'#exportRules');check(s,'rule export omits manuscript and file name','text' not in rule and 'filename' not in rule and original not in json.dumps(rule,ensure_ascii=False))
    p.locator('#manualChecks input').first.check();p.locator('#filename').fill('20260001.pdf');p.wait_for_timeout(200)
    check(s,'editing file name invalidates manual verification',not p.locator('#manualChecks input').first.is_checked())
    p.locator('#manuscript').fill(original+'\n\n参考文献\nサンプルの参照資料');p.wait_for_timeout(200)
    check(s,'fixing conditions changes result to pass',p.locator('#overallBadge').inner_text()=='自動照合 OK')
    p.evaluate("()=>{const t=document.getElementById('manuscript');t.focus();t.setSelectionRange(0,4);t.dispatchEvent(new Event('select'));}")
    p.click('#useSelection');check(s,'selection activates range count','選択範囲' in p.locator('#rangeStatus').inner_text())
    p.locator('#manuscript').fill('👨‍👩‍👧‍👦あ\nい');p.wait_for_timeout(200)
    check(s,'editing clears stale selection','全文' in p.locator('#rangeStatus').inner_text())
    check(s,'Unicode family is one grapheme',p.locator('#charCount').inner_text()=='3')
    p.locator('#manuscript').fill('PRIVATE-DRAFT-EXAMPLE');p.wait_for_timeout(200)
    report=exported(p,'#exportReport',False);check(s,'report omits full draft','PRIVATE-DRAFT-EXAMPLE' not in report['text'])
    imp=dict(rule);imp['rules']['name']='Imported rules'
    import_json(p,'#importFile',imp)
    check(s,'rule import preserves draft',p.locator('#manuscript').input_value()=='PRIVATE-DRAFT-EXAMPLE')
    check(s,'rule import actually replaces rules',p.locator('#ruleSetName').input_value()=='Imported rules')
    backup=exported(p,'#backupBtn');import_json(p,'#importFile',b'{broken')
    check(s,'invalid import preserves state',p.locator('#manuscript').input_value()==backup['text'])
    p.locator('#autosave').check();p.wait_for_timeout(350);saved=storage(p)
    check(s,'opt-in persistence serializes current draft',json.loads(saved['quiet.teishutsu-guard.v1'])['text']==backup['text'])
    p2,err2=boot(b,s,saved)
    check(s,'new instance restores from saved storage fixture',p2.locator('#manuscript').input_value()==backup['text'] and p2.locator('#autosave').is_checked())
    p2.evaluate("dispatchEvent(new StorageEvent('storage',{key:'quiet.teishutsu-guard.v1'}))")
    check(s,'other-tab change stops autosave',not p2.locator('#autosave').is_checked())
    p2.evaluate("()=>{localStorage.setItem=()=>{throw new DOMException('quota','QuotaExceededError')}}")
    p2.locator('#autosave').click()
    check(s,'quota failure disables autosave with notice',not p2.locator('#autosave').is_checked() and '保存できません' in p2.locator('#toast').inner_text())
    p.locator('#sourceFile').set_input_files({'name':'file.txt','mimeType':'text/plain','buffer':b'one\r\ntwo'})
    p.wait_for_timeout(200);check(s,'TXT import normalizes line endings',p.locator('#manuscript').input_value()=='one\ntwo')
    p.locator('#sourceFile').set_input_files({'name':'report.pdf','mimeType':'application/pdf','buffer':b'filename-only-test'})
    p.wait_for_timeout(200);check(s,'nontext file only supplies filename',p.locator('#filename').input_value()=='report.pdf' and p.locator('#manuscript').input_value()=='one\ntwo')
    p.locator('#required').fill('<img src=x onerror=alert(1)>');p.wait_for_timeout(200)
    check(s,'user phrases render as text, not HTML',p.locator('#results img').count()==0 and '<img' in p.locator('#results').inner_text())
    check(s,'no JavaScript errors',not errs and not err2);p.close();p2.close()

with sync_playwright() as tool:
    executable=os.environ.get('QUIET_CHROMIUM') or shutil.which('chromium')
    kwargs={'headless':True}
    if executable: kwargs['executable_path']=executable
    browser=tool.chromium.launch(**kwargs)
    try:
        submit(browser)
    except Exception as e:
        results.append({'app':'teishutsu-guard','test':'unexpected harness error','pass':False,'detail':str(e)});traceback.print_exc()
    finally:
        browser.close()
(OUT/'integration-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print('TOTAL',len(results),'PASS',sum(r['pass'] for r in results),'FAIL',sum(not r['pass'] for r in results),flush=True)
sys.exit(int(any(not r['pass'] for r in results)))
