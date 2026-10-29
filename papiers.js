/* Ma Maison — onglet « Papiers » (DocClass intégré).
   Principe : le document est lu SUR L'APPAREIL (PDF.js + OCR Tesseract), jamais envoyé ni conservé.
   Ma Maison garde seulement, chiffrés comme le reste : le plan de classement, les règles approuvées
   et le registre des papiers classés (nom, date, rubrique, emplacement — sans le contenu).
   Le fichier renommé est remis à iOS (partage) : raccourci « Ranger dans iCloud » ou « Enregistrer dans Fichiers ».
   Utilise les utilitaires de index.html (S, live, uid, esc, modal, toast, touch, render…) au moment des appels. */
"use strict";
const PDFJS_BASE = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/";
const PAP_ROOT = "ADMINISTRATION_PERSONNELLE";
const LS_PAPMODE = "mm_pap_mode";              // "direct" | "raccourci" | "fichiers" (réglage propre à l'appareil)
const DIRECT_SHORTCUT = "Ranger mes papiers";   // raccourci du mode direct (sans menu de partage)
const DIRECT_CHUNK = 12e6;                      // taille max. d'un envoi par le presse-papiers (caractères base64)
let pendingSend = null, leavingForShortcut = false;
let papView = "classer";
const PQ = [];                                  // file d'analyse : en mémoire seulement (comme DocClass)
let pqBusy = false, ocrWorker = null, pdfP = null;
const planOpen = new Set();   // catégories du plan dépliées (mémorisées pendant la session)

/* ---------- accès aux données ---------- */
const planLive = () => live(S.data.plan||[]).sort((a,b)=>a.id.localeCompare(b.id,"fr"));
const rulesLive = () => live(S.data.docrules||[]);
const docsLive = () => live(S.data.docs||[]);
const planRub = ref => planLive().find(p=>p.ref===ref && !p.parts.length) || null;
const papMode = () => { try{ return localStorage.getItem(LS_PAPMODE) || "fichiers"; }catch(e){ return "fichiers"; } };
function seedPlan(){
  if((S.data.plan||[]).length) return 0;
  S.data.plan = DC.buildDefaultPlan().map(p=>({...p, updatedAt:1}));
  return 1;
}
function planPathOf(ref, parts, filename){ return DC.targetPath(planLive(), ref, parts||[], filename); }
const folderLabel = parts => (parts||[]).map(x=>x.replace(/_/g," ")).join(" › ");
function paperPlace(ref, parts){
  const r=planRub(ref); if(!r) return "Rubrique à choisir";
  return `Classeur ${r.binder} › intercalaire ${r.catcode} › ${r.ref} ${r.name}${parts&&parts.length?" › "+folderLabel(parts):""}`;
}

/* ---------- lecture locale des documents ---------- */
function loadPdfJs(){
  return pdfP ||= new Promise((res,rej)=>{
    const s=document.createElement("script"); s.src=PDFJS_BASE+"pdf.min.js";
    s.onload=()=>{ window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_BASE+"pdf.worker.min.js"; res(window.pdfjsLib); };
    s.onerror=()=>{ pdfP=null; s.remove(); rej(new Error("Impossible de charger le lecteur PDF (vérifie ta connexion).")); };
    document.head.appendChild(s);
  });
}
async function getOcr(onStep){
  if(ocrWorker) return ocrWorker;
  onStep && onStep("Chargement du dictionnaire français (la 1ʳᵉ fois seulement)…");
  const T = await loadTesseract();
  ocrWorker = await T.createWorker("fra", 1);
  return ocrWorker;
}
function endOcr(){ if(ocrWorker){ ocrWorker.terminate().catch(()=>{}); ocrWorker=null; } }
const isPdf = f => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name);
const isImg = f => /^image\//i.test(f.type) || /\.(jpe?g|png|heic|heif|tiff?|webp)$/i.test(f.name);
async function extractText(file, onStep){
  const MAXP=12, MAXOCR=4; let parts=[], ocr=false, warning="";
  if(isPdf(file)){
    const lib = await loadPdfJs();
    const task = lib.getDocument({data:new Uint8Array(await file.arrayBuffer()), isEvalSupported:false});
    const pdf = await task.promise;
    let ocrPages=0;
    try{
      for(let i=1;i<=Math.min(pdf.numPages,MAXP);i++){
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        const direct = tc.items.map(it=>(it.str||"")+(it.hasEOL?"\n":" ")).join("").trim();
        if(direct.length>=25) parts.push(direct);
        else if(ocrPages<MAXOCR){
          onStep && onStep(`Lecture de la page ${i} (texte scanné)…`);
          const vp = page.getViewport({scale:2});
          const c=document.createElement("canvas"); c.width=Math.round(vp.width); c.height=Math.round(vp.height);
          await page.render({canvasContext:c.getContext("2d"), viewport:vp}).promise;
          const w = await getOcr(onStep); const {data} = await w.recognize(c);
          parts.push(data.text||""); ocr=true; ocrPages++;
          c.width=c.height=0;
        } else if(!warning) warning=`Lecture limitée aux ${MAXOCR} premières pages scannées.`;
        try{ page.cleanup(); }catch(e){}
        if(parts.join("").length>=18000) break;
      }
    } finally { try{ await (task.destroy ? task.destroy() : pdf.destroy()); }catch(e){} }   // le nettoyage ne doit jamais masquer la lecture
  } else if(isImg(file)){
    onStep && onStep("Lecture de la photo…");
    const canvas = await prepareReceipt(file);
    const w = await getOcr(onStep); const {data} = await w.recognize(canvas);
    parts.push(data.text||""); ocr=true;
  } else if(/^text\//.test(file.type) || /\.(txt|md)$/i.test(file.name)){
    parts.push(await file.text());
  } else warning="Format non lu : classement d'après le nom du fichier seulement.";
  const text = parts.join("\n").slice(0,18000);
  return {text, method: ocr?"OCR (sur l'appareil)":text?"texte du PDF":"aucune", warning};
}

/* ---------- file d'analyse ---------- */
function addPapFiles(files){
  files=[...files].filter(f=>f && f.size>0);
  if(!files.length) return;
  for(const f of files) PQ.push({qid:uid(), file:f, status:"attente", step:"En attente", prop:null});
  papView="classer"; render(); runQueue();
}
async function runQueue(){
  if(pqBusy) return; pqBusy=true; busyLong=true;
  try{
    for(const q of PQ){
      if(q.status!=="attente") continue;
      q.status="analyse"; q.step="Analyse…"; render();
      try{
        const ex = await extractText(q.file, s=>{ q.step=s; render(); });
        q.method=ex.method; q.warning=ex.warning;
        q.prop = DC.propose(q.file.name, ex.text, planLive(), rulesLive());
        q.status="prêt"; q.step="";
      }catch(e){ q.status="erreur"; q.step=e.message||"Lecture impossible"; q.prop=DC.propose(q.file.name, "", planLive(), rulesLive()); }
      render();
    }
  } finally { endOcr(); pqBusy=false; busyLong=false; render(); }
}
/* documents encore à ranger : la mise à jour automatique de l'app attend (sinon la liste serait perdue) */
const papPending = () => PQ.some(x=>x.status!=="rangé");
const validated = () => PQ.filter(x=>x.status==="validé");
function pqRemove(q){ const i=PQ.indexOf(q); if(i>=0) PQ.splice(i,1); render(); }

/* ---------- rendu ---------- */
function papCard(attrs, title, where, meta, pills, oneLine){
  return `<div class="card item" ${attrs}><div class="main"><div class="name">${esc(title)}</div>
    ${where?`<div class="where">${esc(where)}</div>`:""}${meta?`<div class="meta">${esc(meta)}</div>`:""}${oneLine?`<div class="meta one">${esc(oneLine)}</div>`:""}${pills||""}</div></div>`;
}
function scorePill(s){ const cls = s>=80?"":s>=50?" warn":" bad"; return `<span class="pill${cls}">${s}/100</span>`; }
function renderPapiers(q){
  document.querySelectorAll("#papSeg button").forEach(b=>b.classList.toggle("on", b.dataset.v===papView));
  for(const v of ["classer","registre","plan"]) $("pap-"+v).classList.toggle("hidden", v!==papView);
  const nq=PQ.filter(x=>x.status!=="rangé").length;
  $("papSeg").querySelector('[data-v="classer"]').textContent = "Classer"+(nq?` · ${nq}`:"");
  $("papSeg").querySelector('[data-v="registre"]').textContent = "Registre"+(docsLive().length?` · ${docsLive().length}`:"");
  if(papView==="classer") renderQueue(q);
  if(papView==="registre") renderDocs(q);
  if(papView==="plan") renderPlan(q);
}
function renderQueue(q){
  const list = PQ.filter(x=>!q || matches(q, x.file.name, x.prop?.ref||"", x.prop?.org||""));
  $("pqList").innerHTML = list.length ? list.map(x=>{
    const p=x.prop, rub=p&&p.ref?planRub(p.ref):null;
    if(x.status==="validé") return papCard(`data-pq="${x.qid}"`, x.final.name, "→ "+paperPlace(x.final.ref, x.final.parts), x.b64?"Prêt pour le rangement automatique":"Préparation…", `<span class="pill">Validé ✓</span>`);
    const title = x.status==="rangé" ? "✓ "+x.savedName : x.file.name;   // ici le nom de fichier reste utile
    const where = x.status==="rangé" ? paperPlace(x.savedRef, x.savedParts) : rub ? `→ ${rub.ref} ${rub.name}${p.parts.length?" › "+folderLabel(p.parts):""}` : (x.status==="prêt"||x.status==="erreur") ? "→ rubrique à choisir" : "";
    const meta = x.status==="analyse"||x.status==="attente" ? x.step : x.status==="erreur" ? "⚠️ "+x.step : x.status==="rangé" ? "Rangé · l'original reste à sa place" : `${p.date?"Date : "+p.date:"Date à confirmer"} · ${x.method||""}`;
    const pills = x.status==="prêt"||x.status==="erreur" ? scorePill(p.score)+(p.kind!=="Non déterminé"?`<span class="pill">${esc(p.kind)}</span>`:"") : x.status==="rangé" ? `<span class="pill">Rangé</span>` : `<span class="pill warn">${x.status==="analyse"?"Lecture…":"En attente"}</span>`;
    return papCard(`data-pq="${x.qid}"`, title, where, meta, pills);
  }).join("") : `<div class="empty">${q?"Aucun document dans la liste pour cette recherche.":"<b>📄 Choisir</b> un PDF ou un scan, ou <b>📷 Photographier</b> un papier.<br>Il est lu sur ton téléphone (rien n'est envoyé),<br>tu vérifies la proposition, puis tu le ranges dans iCloud.<br>Ma Maison ne garde que sa fiche dans le Registre."}</div>`;
  const nv=validated().length;
  if(nv && papMode()==="direct") $("pqList").insertAdjacentHTML("afterbegin", `<button class="btn block" data-pqsend="1">☁️ Ranger ${nv>1?"les "+nv+" papiers validés":"le papier validé"} dans iCloud</button>`);
  const done=PQ.filter(x=>x.status==="rangé").length;
  $("pqClear").classList.toggle("hidden", !PQ.length);
  $("pqClear").textContent = done && done<PQ.length ? `Retirer les ${done} document(s) rangé(s)` : "Vider la liste";
}
function renderDocs(q){
  const list = docsLive().filter(d=>matches(q, d.name, d.title||"", d.org||"", d.kind||"", d.notes||"", d.ref, planRub(d.ref)?.name||"", folderLabel(d.parts), d.date||""))
    .sort((a,b)=>(b.date||"").localeCompare(a.date||"") || (b.updatedAt||0)-(a.updatedAt||0));
  const groups={};
  for(const d of list){ const r=planRub(d.ref); (groups[r?`Classeur ${r.binder}`:"Sans rubrique"] ||= []).push(d); }
  const keys=Object.keys(groups).sort();
  $("docsList").innerHTML = keys.length ? keys.map(k=>`<div class="group"><h3>${esc(k)}</h3><div class="list" style="margin-top:0">${groups[k].map(d=>{
      const r=planRub(d.ref), dd=d.due&&!d.dueDone?daysUntil(dayTs(d.due)):null;
      const pills=(d.kind&&d.kind!=="Non déterminé"?`<span class="pill">${esc(d.kind)}</span>`:"")+(dd!==null?`<span class="pill ${dd<0?"bad":dd<=14?"warn":""}">Échéance ${esc(fmtDate(dayTs(d.due)))}</span>`:"");
      return papCard(`data-doc="${esc(d.id)}"`, docTitle(d), r?`📁 ${r.ref} ${r.name}${d.parts?.length?" › "+folderLabel(d.parts):""}`:"📁 Rubrique à préciser", d.date?fmtDate(dayTs(d.date)):"Sans date", pills, d.name);
    }).join("")}</div></div>`).join("")
    : `<div class="empty">${q?"Aucun papier trouvé pour « "+esc(q)+" ».":"Aucun papier dans le registre.<br>Les papiers que tu ranges depuis « Classer » s'ajoutent ici.<br>Le bouton + ajoute un papier déjà rangé."}</div>`;
}
/* titre lisible : « Attestation de travail — Airbus », sinon le nom du fichier sans date ni extension */
function docTitle(d){
  if(d.kind && d.kind!=="Non déterminé") return d.kind+(d.org?" — "+d.org:"");
  const base=DC.splitName(d.name||"")[0].replace(/^\d{4}-\d{2}-\d{2}_?/,"").replace(/_/g," ").trim();
  return base ? cap(base) : (d.name||"Papier");
}
const planHay = p => [p.code, p.ref, p.name, p.category, p.detail, p.examples, p.parts.length?"":p.keywords, "classeur "+p.binder];
function findPlan(q){ return planLive().filter(p=>matches(q, planHay(p))).sort((a,b)=>(a.parts.length?1:0)-(b.parts.length?1:0) || a.id.localeCompare(b.id,"fr")); }
function planCard(p, compact){
  const kids = p.parts.length ? 0 : planLive().filter(x=>x.ref===p.ref && x.parts.length===1).length;
  return papCard(`data-plan="${esc(p.id)}"`, `${p.ref} — ${p.name}${p.parts.length?" › "+p.detail:""}`,
    compact ? `📁 Fiche ${p.code}` : `📁 Classeur ${p.binder} · intercalaire ${p.catcode} · fiche ${p.code}`, (p.examples||"").split("\n")[0], kids?`<span class="pill">${plural(kids,"dossier")}</span>`:"");
}
function renderPlan(q){
  const nr=rulesLive().length;
  $("planTools").innerHTML = `<button class="btn ghost small" id="pRules">Règles${nr?` · ${nr}`:""}</button><button class="btn ghost small" id="pPrint">🖨️ Guide A4</button>`;
  $("pRules").onclick=openRules; $("pPrint").onclick=openPrintMenu;
  const all=planLive();
  if(q){
    const list=findPlan(q), groups={}; for(const p of list) (groups[p.binder] ||= []).push(p);
    $("planList").innerHTML = Object.keys(groups).sort().map(b=>`<div class="group"><h3>Classeur ${esc(b)}</h3>
      <div class="list" style="margin-top:0">${groups[b].map(planCard).join("")}</div></div>`).join("")
      || `<div class="empty">Aucune rubrique trouvée pour « ${esc(q)} ».</div>`;
    return;
  }
  // Sans recherche : classeur › catégorie repliable › rubriques (au lieu de 66 cartes d'un coup)
  const byBinder={};
  for(const p of all.filter(x=>!x.parts.length)) ((byBinder[p.binder] ||= {})[p.catcode+"|"+p.category] ||= []).push(p);
  const nDocs = ref => docsLive().filter(d=>d.ref===ref).length;
  $("planList").innerHTML = Object.keys(byBinder).sort().map(b=>`<div class="group"><h3>Classeur ${esc(b)}</h3>${
    Object.keys(byBinder[b]).sort().map(k=>{ const [code,cat]=k.split("|"), rubs=byBinder[b][k], nd=rubs.reduce((n,r)=>n+nDocs(r.ref),0);
      return `<details class="cat" data-cat="${esc(code)}"${planOpen.has(code)?" open":""}><summary><span>${esc(code)} — ${esc(cat)}</span><small>${plural(rubs.length,"rubrique")}${nd?` · ${plural(nd,"papier")}`:""}</small></summary>
        <div class="list">${rubs.map(r=>planCard(r,true)).join("")}</div></details>`; }).join("")}</div>`).join("");
  $("planList").querySelectorAll("details.cat").forEach(d=>d.addEventListener("toggle",()=>{ d.open?planOpen.add(d.dataset.cat):planOpen.delete(d.dataset.cat); }));
}
/* recherche de l'onglet Rangement : papiers du registre puis plan */
function papSearchBlock(q){
  if(!q || !S.data.plan) return "";
  const docs = docsLive().filter(d=>matches(q, d.name, d.title||"", d.org||"", d.kind||"", d.notes||"", planRub(d.ref)?.name||"", folderLabel(d.parts))).slice(0,3);
  const plan = findPlan(q).slice(0, Math.max(0,4-docs.length));
  if(!docs.length && !plan.length) return "";
  return `<div class="group"><h3>📄 Papiers</h3><div class="list" style="margin-top:0">${
    docs.map(d=>papCard(`data-doc="${esc(d.id)}"`, docTitle(d), "📁 "+paperPlace(d.ref,d.parts), d.date?fmtDate(dayTs(d.date)):"", "", d.name)).join("")+plan.map(planCard).join("")}</div>
    <button class="btn ghost small" data-papsearch="1" style="margin-top:8px">Chercher dans Papiers</button></div>`;
}
function docAlerts(){
  const out=[];
  for(const d of docsLive()) if(d.due && !d.dueDone){ const n=daysUntil(dayTs(d.due)); if(n<=14 && n>=-60) out.push({kind:"doc", id:d.id, lv:n<0?"late":n<=3?"soon":"ok", icon:"📄", text:docTitle(d), sub:n<0?`Échéance dépassée (${fmtDate(dayTs(d.due))})`:`Échéance ${n===0?"aujourd'hui":n===1?"demain":"le "+fmtDate(dayTs(d.due))}`}); }
  return out;
}

/* ---------- formulaire commun : rubrique, sous-dossier, date ---------- */
function rubOptions(cur){
  const groups={}; for(const r of planLive().filter(p=>!p.parts.length)) (groups[r.catcode+" — "+r.category] ||= []).push(r);
  return `<option value="">— À choisir —</option>`+Object.keys(groups).sort().map(g=>`<optgroup label="${esc(g)}">${groups[g].map(r=>`<option value="${r.ref}"${r.ref===cur?" selected":""}>${r.ref} — ${esc(r.name)} (classeur ${r.binder})</option>`).join("")}</optgroup>`).join("");
}
function folderOptions(ref, curParts){
  const cur=(curParts||[]).join("/");
  const opts=[["","(dossier principal)"]];
  for(const p of planLive().filter(x=>x.ref===ref && x.parts.length)) opts.push([p.parts.join("/"), "　".repeat(p.parts.length-1)+(p.parts.length>1?"└ ":"")+p.parts[p.parts.length-1].replace(/_/g," ")]);
  if(cur && !opts.some(o=>o[0]===cur)) opts.push([cur, folderLabel(curParts)+" (nouveau dossier)"]);
  return opts.map(([v,l])=>`<option value="${esc(v)}"${v===cur?" selected":""}>${esc(l)}</option>`).join("");
}
function bindRubFolder(bd, refSel, folSel, onChange){
  const r=bd.querySelector(refSel), f=bd.querySelector(folSel);
  r.onchange=()=>{ f.innerHTML=folderOptions(r.value, []); onChange&&onChange(); };
  f.onchange=()=>onChange&&onChange();
}
const partsOf = v => v ? v.split("/").filter(Boolean) : [];

/* ---------- vérification d'un document puis rangement ---------- */
function openPQ(x){
  if(!x) return;
  if(x.status==="rangé"){ const d=docsLive().find(y=>y.id===x.docId); if(d) return openDoc(d); return; }
  if(x.status==="analyse"||x.status==="attente") return toast("Lecture en cours, patiente quelques secondes.");
  const p=x.prop; const [stem, ext]=DC.splitName(x.file.name);
  const dateOpts = p.dateOptions.map(o=>`<option value="${o.date}"${o.date===p.date?" selected":""}>${o.date} — ${esc(o.label)} (${o.confidence}/100)</option>`).join("");
  modal(`${sheetHead("paper","Vérifier avant de ranger", esc(x.file.name))}
    <div class="meta" style="margin:0 0 4px">Lecture : ${esc(x.method||"aucune")}${x.warning?" · "+esc(x.warning):""}${x.status==="erreur"?" · ⚠️ "+esc(x.step):""}</div>
    <div class="card" style="padding:10px 12px;margin-top:8px"><div style="font-weight:600">Score indicatif : ${p.score}/100 <span class="meta">(indices, pas une probabilité)</span></div>
      ${p.scoreItems.map(([t,pts,max,why])=>`<div class="meta" style="margin-top:3px">• ${esc(t)} : ${pts}/${max} — ${esc(why)}</div>`).join("")}
      <div class="meta" style="margin-top:3px">Type : ${esc(p.kind)} — ${esc(p.kindEvidence)}</div>
      ${p.org&&p.orgSource?`<div class="meta">Organisme lu dans : ${esc(p.orgSource)}</div>`:""}${p.rule?`<div class="meta">Règle approuvée appliquée : « ${esc(p.rule)} »</div>`:""}
      <div class="meta">Date : ${esc(p.dateReason)}</div></div>
    <label>Rubrique</label><select class="field" id="qRef">${rubOptions(p.ref)}</select>
    <label>Sous-dossier</label><select class="field" id="qFol">${p.ref?folderOptions(p.ref,p.parts):`<option value="">(dossier principal)</option>`}</select>
    <label>Date du document</label>
    <select class="field" id="qDate"><option value="">Aucune date</option>${dateOpts}<option value="__other">Autre date…</option></select>
    <input class="field hidden" id="qDateOther" type="date" style="margin-top:6px">
    <label>Nom du fichier rangé</label><input class="field" id="qName" value="${esc(p.filename)}" autocomplete="off">
    <label>Échéance à surveiller (facultatif)</label><input class="field" id="qDue" type="date" value="${esc(p.due||"")}">
    <label>Note (facultatif)</label><input class="field" id="qNotes" value="${esc(p.notes||"")}" placeholder="ex. payé par prélèvement" autocomplete="off">
    <label>Destination</label><div class="card" style="padding:10px 12px"><div id="qPlace" style="font-weight:600"></div><div class="meta" id="qPath" style="word-break:break-all"></div><div class="err" id="qErr"></div></div>
    <div class="hint">${papMode()==="direct"?"« Valider » met ce papier dans le lot. Ensuite, « Ranger … dans iCloud » les range tous d'un coup avec le raccourci « "+DIRECT_SHORTCUT+" ».":papMode()==="raccourci"?"« Ranger » copie la destination puis ouvre le partage : choisis le raccourci « Ranger dans iCloud ».":"« Ranger » ouvre le partage : choisis « Enregistrer dans Fichiers », puis le dossier indiqué ci-dessus."} Le document d'origine n'est ni modifié ni supprimé.</div>
    <div class="actions"><button class="btn danger" id="qDel">Retirer</button><button class="btn ghost" id="qRule">Règle…</button><span class="spacer"></span><button class="btn" id="qGo">${papMode()==="direct"?"Valider":"Ranger…"}</button></div>`,
  (bd, close)=>{
    const g=id=>bd.querySelector(id);
    let lastAuto=p.filename;
    const dateVal=()=>g("#qDate").value==="__other" ? g("#qDateOther").value : g("#qDate").value;
    const cur=()=>({ref:g("#qRef").value, parts:partsOf(g("#qFol").value), name:g("#qName").value.trim(), date:dateVal()});
    const update=()=>{
      const c=cur();
      // nom généré non retouché : seule la date change (le nom descriptif proposé par le moteur est conservé)
      if(g("#qName").value===lastAuto){ const core=DC.splitName(lastAuto)[0].replace(/^\d{4}-\d{2}(?:-\d{2})?_?/,"")||stem; lastAuto=DC.suggestName(core, ext, c.date); g("#qName").value=lastAuto; c.name=lastAuto; }
      g("#qPlace").textContent=paperPlace(c.ref,c.parts);
      g("#qPath").textContent=c.ref?planPathOf(c.ref,c.parts,c.name||"…"):"";
      const clash=c.ref && docsLive().some(d=>d.path===planPathOf(c.ref,c.parts,c.name));
      g("#qErr").textContent = !c.ref?"Choisis une rubrique.":!DC.validName(c.name)?"Nom invalide (pas de / \\ : ~).":clash?"Un papier du registre porte déjà ce nom ici : modifie le nom (ex. ajoute _2).":"";
      g("#qGo").disabled=!!g("#qErr").textContent;
    };
    bindRubFolder(bd,"#qRef","#qFol",update);
    g("#qDate").onchange=()=>{ g("#qDateOther").classList.toggle("hidden", g("#qDate").value!=="__other"); update(); };
    g("#qDateOther").onchange=update; g("#qName").oninput=update;
    update();
    g("#qDel").onclick=()=>{ close(); pqRemove(x); };
    g("#qRule").onclick=()=>{ const c=cur(); if(!c.ref) return toast("Choisis d'abord une rubrique."); openRuleNew(p.org||stem, c.ref); };
    g("#qGo").onclick=()=>{
      const c=cur(); update(); if(g("#qGo").disabled) return;
      const path=planPathOf(c.ref,c.parts,c.name);
      if(papMode()==="direct"){
        // les choix sont gardés dans la proposition : rouvrir le papier les retrouve
        Object.assign(p,{ref:c.ref, parts:c.parts, filename:c.name, date:c.date, due:g("#qDue").value, notes:g("#qNotes").value.trim()});
        if(c.date && !p.dateOptions.some(o=>o.date===c.date)) p.dateOptions.push({date:c.date, label:"Date saisie", confidence:0});
        x.final={...c, path, due:g("#qDue").value, notes:g("#qNotes").value.trim()};
        x.status="validé"; x.b64=null;
        fileToBase64(x.file).then(b=>{ x.b64=b; render(); }).catch(e=>{ x.status="prêt"; toast("Lecture du fichier impossible : "+e.message); render(); });
        close(); render(); toast("Validé ✓ Range le lot quand tu as fini");
        return;
      }
      const file=new File([x.file], c.name, {type:x.file.type||"application/octet-stream"});
      const finish=()=>{
        registerDoc(x, {...c, path, due:g("#qDue").value, notes:g("#qNotes").value.trim()});
        touch(); close(); render(); toast("Rangé ✓ Ajouté au registre");
      };
      shareOrDownload(file, path, finish);
    };
  });
}
function registerDoc(x, f){
  const now=Date.now(), id=uid();
  S.data.docs.push({id, name:f.name, title:x.file.name, ref:f.ref, parts:f.parts, path:f.path, date:f.date, due:f.due||"", dueDone:false,
    kind:x.prop.kind, org:x.prop.org, notes:f.notes||"", savedAt:now, updatedAt:now});
  Object.assign(x,{status:"rangé", docId:id, savedName:f.name, savedRef:f.ref, savedParts:f.parts, b64:null});
}
function fileToBase64(file){
  return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(String(r.result).split(",")[1]||""); r.onerror=()=>rej(r.error||new Error("lecture")); r.readAsDataURL(file); });
}

/* ---------- mode « Raccourci direct » : un appui range tout le lot ----------
   Le contenu passe par le presse-papiers (sur l'appareil) ; le raccourci le vide à la fin. */
function nextChunk(){
  const out=[]; let size=0;
  for(const x of validated()){
    if(!x.b64) continue;
    if(out.length && size+x.b64.length>DIRECT_CHUNK) break;
    out.push(x); size+=x.b64.length;
  }
  return out;
}
function launchShortcut(){
  leavingForShortcut=true; setTimeout(()=>{ leavingForShortcut=false; }, 4000);
  location.href = "shortcuts://run-shortcut?name="+encodeURIComponent(DIRECT_SHORTCUT)+"&input=clipboard";
}
function sendBatch(){
  if(validated().some(x=>!x.b64)) return toast("Préparation des fichiers en cours, réessaie dans un instant.");
  const chunk=nextChunk(); if(!chunk.length) return;
  const payload=JSON.stringify({app:"Ma Maison", version:1, fichiers:chunk.map(x=>({nom:x.final.name, chemin:x.final.path, origine:x.file.name, donnees:x.b64}))});
  const rest=validated().length-chunk.length;
  let write;
  try{ write=navigator.clipboard.writeText(payload); }catch(e){ write=Promise.reject(e); }   // dans le geste de l'utilisateur
  pendingSend={ids:chunk.map(x=>x.qid), at:Date.now()};
  write.then(()=>{ openPendingSend(rest); launchShortcut(); })
       .catch(e=>{ pendingSend=null; toast("Copie impossible ("+(e&&e.message||"presse-papiers")+"). Utilise le mode « Enregistrer dans Fichiers » dans les Réglages."); });
}
function openPendingSend(rest){
  if(!pendingSend) return;
  const items=pendingSend.ids.map(id=>PQ.find(x=>x.qid===id)).filter(Boolean);
  modal(`${sheetHead("paper","Rangement automatique", `${plural(items.length,"papier")} envoyé${items.length>1?"s":""} au raccourci`)}
    <div class="hint">Le raccourci « ${esc(DIRECT_SHORTCUT)} » s'ouvre et range les fichiers. Reviens ensuite ici (« ◀ » en haut à gauche) et confirme.</div>
    <div class="card" style="padding:2px 12px;margin-top:10px">${items.map(x=>`<div class="sub" style="cursor:default"><div style="min-width:0"><div class="name">${esc(x.final.name)}</div><div class="meta" style="margin:0;word-break:break-all">${esc(x.final.path.split("/").slice(0,-1).join("/"))}</div></div></div>`).join("")}</div>
    ${rest?`<div class="hint">Encore ${plural(rest,"papier")} à envoyer ensuite (lot découpé pour ne pas surcharger le presse-papiers).</div>`:""}
    <div class="hint">Vérifie la notification du raccourci, ou le dossier dans l'app Fichiers.</div>
    <div class="actions"><button class="btn ghost" id="psRetry">Relancer le raccourci</button><span class="spacer"></span>
      <button class="btn ghost" id="psNo">Pas rangés</button><button class="btn" id="psYes">Oui, c'est rangé</button></div>`,
  (bd, close)=>{
    bd.dataset.busy="1";   // pas de fermeture par appui à côté : il faut répondre
    bd.querySelector("#psRetry").onclick=()=>launchShortcut();
    bd.querySelector("#psNo").onclick=()=>{ pendingSend=null; close(); render(); toast("Rien n'est inscrit au registre ; les papiers restent validés."); };
    bd.querySelector("#psYes").onclick=()=>{
      for(const x of items) if(x.status==="validé") registerDoc(x, x.final);
      pendingSend=null;
      try{ navigator.clipboard.writeText("").catch(()=>{}); }catch(e){}   // par sécurité, en plus du raccourci
      touch(); close(); render();
      toast(validated().length?`Rangé ✓ Encore ${validated().length} à ranger`:"Rangé ✓ Ajouté au registre");
    };
  });
}

/* Remise du fichier à iOS. Aucun appel bloquant avant navigator.share : Safari exige le geste de l'utilisateur. */
function shareOrDownload(file, path, onDone){
  if(papMode()==="raccourci"){ try{ navigator.clipboard.writeText(path).catch(()=>{}); }catch(e){} }
  if(navigator.canShare && navigator.canShare({files:[file]})){
    navigator.share({files:[file], title:file.name}).then(onDone).catch(e=>{
      if(e && e.name==="AbortError") return toast("Rangement annulé : rien n'a changé.");
      manualSave(file, path, onDone, e);
    });
  } else manualSave(file, path, onDone);
}
function manualSave(file, path, onDone, err){
  const url=URL.createObjectURL(file);
  modal(`${sheetHead("paper","Ranger à la main", esc(file.name))}
    <div class="hint">${err?"Le partage n'a pas pu s'ouvrir. ":""}Télécharge le fichier renommé, puis dépose-le dans ce dossier iCloud Drive :</div>
    <div class="card" style="padding:10px 12px;margin-top:8px;word-break:break-all">${esc(path.split("/").slice(0,-1).join("/"))}</div>
    <div class="actions"><button class="btn ghost" id="mCopy">Copier le chemin</button><a class="btn ghost" id="mDl" href="${url}" download="${esc(file.name)}">Télécharger</a><span class="spacer"></span>
      <button class="btn ghost" id="mNo">Annuler</button><button class="btn" id="mOk">C'est rangé</button></div>`,
  (bd, close)=>{
    bd.querySelector("#mCopy").onclick=()=>navigator.clipboard.writeText(path.split("/").slice(0,-1).join("/")).then(()=>toast("Chemin copié ✓"),()=>toast("Copie impossible ici."));
    bd.querySelector("#mNo").onclick=()=>{ URL.revokeObjectURL(url); close(); };
    bd.querySelector("#mOk").onclick=()=>{ URL.revokeObjectURL(url); close(); onDone(); };
  });
}

/* ---------- registre ---------- */
function openDoc(d){
  const isNew=!d; d = d || {ref:"", parts:[], name:"", date:"", due:"", notes:"", dueDone:false};
  modal(`${sheetHead("paper", isNew?"Ajouter au registre":"Registre des papiers", isNew?"Papier déjà rangé":esc(d.name))}
    ${isNew?`<div class="hint">Pour un papier déjà rangé dans iCloud ou un classeur : rien n'est déplacé, la fiche sert à le retrouver.</div>`:""}
    <label>Nom du fichier</label><input class="field" id="dName" value="${esc(d.name)}" placeholder="ex. 2025-08-12_avis_d_imposition.pdf" autocomplete="off">
    <label>Rubrique</label><select class="field" id="dRef">${rubOptions(d.ref)}</select>
    <label>Sous-dossier</label><select class="field" id="dFol">${d.ref?folderOptions(d.ref,d.parts):`<option value="">(dossier principal)</option>`}</select>
    <div class="row2"><div><label>Date du document</label><input class="field" id="dDate" type="date" value="${esc(d.date||"")}"></div>
    <div><label>Échéance</label><input class="field" id="dDue" type="date" value="${esc(d.due||"")}"></div></div>
    <label class="chkline"><input type="checkbox" id="dDone"${d.dueDone?" checked":""}> Échéance traitée (plus de rappel)</label>
    <label>Note</label><input class="field" id="dNotes" value="${esc(d.notes||"")}" autocomplete="off">
    ${isNew?"":`<label>Emplacement</label><div class="card" style="padding:10px 12px"><div style="font-weight:600" id="dPlace"></div><div class="meta" id="dPath" style="word-break:break-all"></div></div>
      ${d.title&&d.title!==d.name?`<div class="meta">Nom d'origine : ${esc(d.title)}</div>`:""}${d.savedAt?`<div class="meta">Rangé le ${fmtDate(d.savedAt)}</div>`:""}`}
    <div class="err" id="dErr"></div>
    <div class="actions">${isNew?"":`<button class="btn danger" id="dDel">Retirer</button><button class="btn ghost" id="dCopy">Copier le chemin</button>${d.due?`<button class="btn ghost" id="dIcs">🔔</button>`:""}`}<span class="spacer"></span>
      <button class="btn ghost" id="dCancel">Annuler</button><button class="btn" id="dSave">Enregistrer</button></div>`,
  (bd, close)=>{
    const g=id=>bd.querySelector(id);
    const upd=()=>{ if(isNew) return; g("#dPlace").textContent=paperPlace(g("#dRef").value, partsOf(g("#dFol").value)); g("#dPath").textContent=g("#dRef").value?planPathOf(g("#dRef").value, partsOf(g("#dFol").value), g("#dName").value.trim()):""; };
    bindRubFolder(bd,"#dRef","#dFol",upd); g("#dName").oninput=upd; upd();
    g("#dCancel").onclick=close;
    g("#dSave").onclick=()=>{
      const name=g("#dName").value.trim(), ref=g("#dRef").value;
      if(!DC.validName(name)) return g("#dErr").textContent="Nom de fichier invalide.";
      if(!ref) return g("#dErr").textContent="Choisis une rubrique.";
      const parts=partsOf(g("#dFol").value), now=Date.now();
      const v={name, ref, parts, path:planPathOf(ref,parts,name), date:g("#dDate").value, due:g("#dDue").value, dueDone:g("#dDone").checked, notes:g("#dNotes").value.trim(), updatedAt:now};
      if(isNew) S.data.docs.push({id:uid(), title:name, kind:"", org:"", ...v}); else Object.assign(d,v);
      touch(); close(); render(); toast(isNew?"Ajouté au registre ✓":"Enregistré ✓");
    };
    if(!isNew){
      g("#dDel").onclick=()=>{ if(confirm(`Retirer « ${d.name} » du registre ?\n\nLe document lui-même reste dans iCloud : rien n'est supprimé.`)){ d.deleted=true; d.updatedAt=Date.now(); touch(); close(); render(); } };
      g("#dCopy").onclick=()=>navigator.clipboard.writeText(d.path).then(()=>toast("Chemin copié ✓"),()=>toast("Copie impossible ici."));
      const ic=g("#dIcs"); if(ic) ic.onclick=()=>downloadIcs({title:`Échéance : ${d.name}`, start:dayTs(d.due), alarm:"-P2D", desc:`${paperPlace(d.ref,d.parts)}${d.notes?"\n"+d.notes:""}`});
    }
  });
}

/* ---------- plan de classement ---------- */
function openPlan(p){
  if(!p) return;
  const kids = planLive().filter(x=>x.ref===p.ref && x.parts.length===p.parts.length+1 && p.parts.every((v,i)=>x.parts[i]===v));
  const parent = p.parts.length ? planLive().find(x=>x.ref===p.ref && x.parts.length===p.parts.length-1 && x.parts.every((v,i)=>p.parts[i]===v)) : null;
  const nDocs = docsLive().filter(d=>d.ref===p.ref && p.parts.every((v,i)=>(d.parts||[])[i]===v)).length;
  const icloud = PAP_ROOT+"/"+p.path;
  modal(`${sheetHead("paper","Plan de classement", esc(`${p.ref} — ${p.name}${p.parts.length?" › "+p.detail:""}`))}
    <div class="card" style="padding:10px 12px">Classeur <strong>${esc(p.binder)}</strong> › intercalaire <strong>${esc(p.catcode)}</strong> — ${esc(p.category)}<br>Fiche <strong>${esc(p.code)}</strong>${nDocs?` · ${plural(nDocs,"papier")} au registre`:""}</div>
    <label>Documents à ranger ici</label><textarea class="field" id="plEx" rows="3">${esc(p.examples||"")}</textarea>
    ${p.parts.length?"":`<label>Mots-clés (pour reconnaître les documents)</label><input class="field" id="plKw" value="${esc(p.keywords||"")}" autocomplete="off">`}
    <label>Dossier iCloud Drive</label><div class="meta" style="font-size:14px;word-break:break-all">${esc(icloud)}</div>
    ${kids.length?`<label>Sous-dossiers</label><div class="card" style="padding:2px 12px">${kids.map(k=>`<div class="sub" data-subplan="${esc(k.id)}"><span style="font-size:18px;width:28px;text-align:center">📁</span><span class="name">${esc(k.parts[k.parts.length-1].replace(/_/g," "))}</span><span class="meta" style="margin-left:auto">›</span></div>`).join("")}</div>`:""}
    <div class="actions">${parent||p.parts.length?`<button class="btn ghost small" id="plUp">↑ Remonter</button>`:""}${p.parts.length?`<button class="btn danger small" id="plDel">Retirer du plan</button>`:""}
      <button class="btn ghost small" id="plAdd">+ Sous-dossier</button><span class="spacer"></span>
      <button class="btn ghost" id="plCopy">Copier le chemin</button><button class="btn" id="plSave">Enregistrer</button></div>`,
  (bd, close)=>{
    const g=id=>bd.querySelector(id);
    bd.querySelectorAll("[data-subplan]").forEach(x=>x.onclick=()=>openPlan(planLive().find(y=>y.id===x.dataset.subplan)));
    const up=g("#plUp"); if(up) up.onclick=()=>openPlan(parent||planRub(p.ref));
    g("#plCopy").onclick=()=>navigator.clipboard.writeText(icloud).then(()=>toast("Chemin copié ✓"),()=>toast("Copie impossible ici."));
    g("#plSave").onclick=()=>{ p.examples=g("#plEx").value.trim(); if(g("#plKw")) p.keywords=g("#plKw").value.trim(); p.updatedAt=Date.now(); touch(); close(); render(); toast("Plan enregistré ✓"); };
    g("#plAdd").onclick=()=>{
      const name=(prompt("Nom du nouveau dossier (ex. Société Générale) :")||"").trim(); if(!name) return;
      const key=DC.slug(name); if(!key) return toast("Nom invalide.");
      const parts=[...p.parts, key], id=`p:${p.ref}/${parts.join("/")}`;
      const ex=(S.data.plan||[]).find(x=>x.id===id);
      if(ex && !ex.deleted) return toast("Ce dossier existe déjà.");
      const rub=planRub(p.ref), now=Date.now();
      const add=(pp,exText)=>{ const e={...DC.planFolder(rub,pp,exText), updatedAt:now}; S.data.plan=S.data.plan.filter(x=>x.id!==e.id); S.data.plan.push(e); };
      add(parts, `Documents de « ${name} » (${rub.name}).`);
      const model = !p.parts.length && p.ref==="04.01" ? ["Releves_de_comptes","Conventions_et_contrats","RIB","Frais_et_incidents"]
                  : !p.parts.length && p.ref==="04.03" ? ["Contrats_et_adhesions","Releves_et_situations","Versements_et_operations","Fiscalite"] : [];
      for(const m of model) add([...parts,m], (DC.D.leafExamples[m]||"")+(m==="Releves_de_comptes"?" Un sous-dossier par année.":""));
      touch(); toast(`« ${name} » ajouté au plan. Le dossier iCloud sera créé au premier rangement.`); openPlan(planLive().find(x=>x.id===id));
    };
    const del=g("#plDel"); if(del) del.onclick=()=>{
      if(!confirm(`Retirer « ${p.detail} » et ses sous-dossiers du plan ?\n\nAucun dossier ni document iCloud ne sera supprimé.`)) return;
      const now=Date.now(); for(const x of planLive()) if(x.ref===p.ref && p.parts.every((v,i)=>x.parts[i]===v)){ x.deleted=true; x.updatedAt=now; }
      touch(); close(); render();
    };
  });
}
function openNewRubrique(){
  const cats=[...new Map(planLive().filter(p=>!p.parts.length).map(p=>[p.catcode,p.category])).entries()].sort();
  modal(`${sheetHead("paper","Plan de classement","Nouvelle rubrique")}
    <label>Catégorie</label><select class="field" id="nrCat">${cats.map(([c,t])=>`<option value="${c}">${c} — ${esc(t)}</option>`).join("")}</select>
    <label>Nom de la rubrique</label><input class="field" id="nrName" placeholder="ex. Nouvel employeur" autocomplete="off">
    <div class="hint">Elle reçoit le numéro suivant de la catégorie (ex. 03.08) et une fiche dans le guide du classeur.</div>
    <div class="actions"><span class="spacer"></span><button class="btn ghost" id="nrNo">Annuler</button><button class="btn" id="nrOk">Ajouter</button></div>`,
  (bd, close)=>{
    bd.querySelector("#nrNo").onclick=close;
    bd.querySelector("#nrOk").onclick=()=>{
      const c=bd.querySelector("#nrCat").value, name=cap(bd.querySelector("#nrName").value.trim()); if(!name) return bd.querySelector("#nrName").focus();
      const used=(S.data.plan||[]).filter(p=>p.catcode===c && !p.parts.length).map(p=>+p.ref.split(".")[1]);
      const ref=`${c}.${String(Math.max(0,...used)+1).padStart(2,"0")}`;
      const cat=cats.find(x=>x[0]===c)[1];
      S.data.plan.push({...DC.planRubrique(c,cat,ref,name,"",""), updatedAt:Date.now()});
      touch(); close(); render(); toast(`Rubrique ${ref} ajoutée ✓`);
    };
  });
}
/* ---------- règles approuvées ---------- */
function openRuleNew(suggestion, ref){
  const rub=planRub(ref);
  const phrase=prompt(`Apprentissage contrôlé\n\nExpression exacte à rechercher dans les futurs NOMS de fichiers (le contenu des documents n'est jamais utilisé) :`, suggestion||"");
  if(phrase===null) return;
  let ph; try{ ph=DC.validateRule(phrase, ref); }catch(e){ return toast(e.message); }
  if(!confirm(`Enregistrer la règle ?\n\nNom contenant : ${ph}\nRubrique proposée : ${ref} — ${rub?rub.name:""}\n\nElle ne range jamais rien toute seule : elle pré-remplit la proposition.`)) return;
  const now=Date.now(), ex=(S.data.docrules||[]).find(r=>r.phrase===ph);
  if(ex) Object.assign(ex,{ref, enabled:true, deleted:false, updatedAt:now});
  else S.data.docrules.push({id:uid(), phrase:ph, ref, enabled:true, createdAt:now, updatedAt:now});
  touch(); toast("Règle enregistrée ✓ (prochaines analyses)");
}
function openRules(){
  const list=rulesLive().sort((a,b)=>(b.enabled!==false)-(a.enabled!==false) || a.phrase.localeCompare(b.phrase,"fr"));
  modal(`${sheetHead("paper","Apprentissage contrôlé","Règles mémorisées")}
    <div class="hint">Une règle repère une expression dans le NOM d'un fichier et propose une rubrique. Elle ne range jamais rien toute seule.</div>
    <div class="card" style="padding:2px 12px;margin-top:10px">${list.length?list.map(r=>`<div class="sub" style="cursor:default"><div style="flex:1;min-width:0"><div class="name">« ${esc(r.phrase)} »</div><div class="meta" style="margin:0">→ ${esc(r.ref)} ${esc(planRub(r.ref)?.name||"(rubrique absente)")}</div></div>
      <button class="btn ghost small" data-rtog="${esc(r.id)}">${r.enabled===false?"Réactiver":"Désactiver"}</button></div>`).join(""):`<div class="meta" style="padding:12px 0">Aucune règle. Dans la vérification d'un document, « Règle… » en crée une.</div>`}</div>
    <div class="actions"><span class="spacer"></span><button class="btn" id="rOk">Fermer</button></div>`,
  (bd, close)=>{
    bd.querySelector("#rOk").onclick=close;
    bd.querySelectorAll("[data-rtog]").forEach(b=>b.onclick=()=>{ const r=S.data.docrules.find(x=>x.id===b.dataset.rtog); if(!r) return; r.enabled=r.enabled===false; r.updatedAt=Date.now(); touch(); openRules(); render(); });
  });
}

/* ---------- guide imprimable des classeurs (A4 portrait, recto, pochettes) ---------- */
const printMark = b => (S.data.papmeta||[]).find(x=>x.id==="print:"+b && !x.deleted);
function binderPages(b){
  const rubs=planLive().filter(p=>p.binder===b && !p.parts.length);
  const last=printMark(b)?.at||0;
  return rubs.map(r=>{ const sub=planLive().filter(x=>x.ref===r.ref && x.parts.length);
    const changed = !last || [r,...sub].some(x=>(x.updatedAt||0)>last) || (S.data.plan||[]).some(x=>x.deleted && x.ref===r.ref && (x.updatedAt||0)>last);
    return {r, sub, changed}; });
}
function openPrintMenu(){
  const bs=[...new Set(planLive().map(p=>p.binder))].sort();
  modal(`${sheetHead("paper","Guide papier","Imprimer le guide d'un classeur")}
    <div class="hint">Format A4 portrait, recto, une fiche par rubrique, pour pochettes transparentes.</div>
    <div class="card" style="padding:2px 12px;margin-top:10px">${bs.map(b=>{ const pg=binderPages(b), n=pg.filter(x=>x.changed).length, m=printMark(b);
      return `<div class="sub" style="cursor:default"><div style="flex:1"><div class="name">Classeur ${b}</div><div class="meta" style="margin:0">${m?`Imprimé le ${fmtDate(m.at)} · ${n} fiche(s) modifiée(s)`:"Jamais imprimé depuis Ma Maison"}</div></div>
      <button class="btn ghost small" data-pall="${b}">Tout</button>${m&&n?`<button class="btn small" data-pchg="${b}">Modifiées</button>`:""}</div>`; }).join("")}</div>
    <div class="actions"><span class="spacer"></span><button class="btn ghost" id="prNo">Fermer</button></div>`,
  (bd, close)=>{
    bd.querySelector("#prNo").onclick=close;
    bd.querySelectorAll("[data-pall]").forEach(x=>x.onclick=()=>{ close(); printGuide(x.dataset.pall,false); });
    bd.querySelectorAll("[data-pchg]").forEach(x=>x.onclick=()=>{ close(); printGuide(x.dataset.pchg,true); });
  });
}
function printGuide(b, onlyChanged){
  const pages=binderPages(b), sel=onlyChanged?pages.filter(x=>x.changed):pages, today=fmtDate(Date.now());
  const cats=[...new Set(pages.map(x=>x.r.catcode+" — "+x.r.category))];
  const page=(code,title,body)=>`<section class="pg"><div class="pgh">DOCCLASS · MA MAISON — GUIDE DE CLASSEMENT<span>CLASSEUR ${esc(b)}</span></div><h1>${esc(title)}</h1>${body}<div class="pgf">FICHE ${esc(code)} · A4 RECTO<span>Mise à jour : ${today}</span></div></section>`;
  let html="";
  if(!onlyChanged){
    html+=page(`${b}-COUV`,`Classeur ${b}`, `<div class="box"><h2>Votre organisation papier</h2>${cats.map(c=>`<p class="big">${esc(c)}</p>`).join("")}</div><div class="box"><h2>Mode d'emploi</h2><p>Glisse chaque fiche dans une pochette transparente, recto visible.</p><p>Classe les documents derrière la fiche de leur rubrique.</p><p>Quand une fiche change, Ma Maison l'indique : réimprime seulement les fiches modifiées.</p></div>`);
    html+=page(`${b}-SOM`,"Sommaire des intercalaires", `<div class="cols">${pages.map(x=>`<p>${esc(x.r.ref)} — ${esc(x.r.name)} <small>· fiche ${esc(x.r.code)}</small></p>`).join("")}</div>`);
  } else {
    html+=page(`${b}-MAJ`,"Fiches à remplacer", `<div class="box"><h2>À imprimer et remplacer</h2>${sel.map(x=>`<p>${esc(x.r.code)} — ${esc(x.r.name)}</p>`).join("")||"<p>Aucune</p>"}</div>`);
  }
  for(const {r,sub} of sel){
    html+=page(r.code, `${r.ref} — ${r.name}`, `<div class="box"><h2>Repères de classement</h2><p>Catégorie : ${esc(r.catcode)} — ${esc(r.category)}</p><p>Intercalaire : ${esc(r.ref)} — ${esc(r.name)}</p></div>
      <div class="box"><h2>Documents à ranger</h2><p>${esc(r.examples||"—")}</p>${sub.length?`<h2 style="margin-top:4mm">Dossiers internes</h2>${sub.map(s=>`<p>${"　".repeat(s.parts.length-1)}• ${esc(s.parts[s.parts.length-1].replace(/_/g," "))}</p>`).join("")}`:""}</div>
      <div class="box"><h2>Emplacement numérique</h2><p class="path">${esc(PAP_ROOT+"/"+r.path)}</p></div>`);
  }
  $("printRoot").innerHTML=html;
  setTimeout(()=>{
    window.print();
    setTimeout(()=>{ if(confirm(`As-tu imprimé et inséré les fiches du classeur ${b} ?\n\nOui : Ma Maison retient cette date pour ne proposer ensuite que les fiches modifiées.`)){
      const now=Date.now(), m=(S.data.papmeta||[]).find(x=>x.id==="print:"+b);
      if(m) Object.assign(m,{at:now, deleted:false, updatedAt:now}); else S.data.papmeta.push({id:"print:"+b, at:now, updatedAt:now});
      touch(); toast(`Classeur ${b} marqué comme imprimé ✓`); }
      $("printRoot").innerHTML=""; }, 600);
  }, 80);
}

/* ---------- import du plan exporté par DocClass (Mac), pour reprendre tes réglages une fois ---------- */
function importDocClassPlan(file){
  const r=new FileReader();
  r.onload=()=>{
    let d; try{ d=JSON.parse(r.result); if(d.format!=="docclass-plan"||!Array.isArray(d.entries)) throw 0; }catch(e){ return toast("Ce fichier n'est pas un plan exporté par DocClass."); }
    const now=Date.now(); let n=0;
    for(const e of d.entries){
      if(!e || typeof e.id!=="string" || !/^p:\d{2}\.\d{2}(\/|$)/.test(e.id)) continue;
      const parts=e.id.slice(2).split("/").slice(1);
      const o={id:e.id, binder:String(e.binder||""), catcode:String(e.catcode||""), category:String(e.category||""), ref:String(e.ref||""), name:String(e.name||""),
        code:String(e.code||""), keywords:String(e.keywords||""), parts, detail:folderLabel(parts), path:String(e.path||""), examples:String(e.examples||"")};
      const cur=S.data.plan.find(x=>x.id===o.id);
      if(!cur){ S.data.plan.push({...o, updatedAt:now}); n++; }
      else if(cur.deleted || ["keywords","examples","name","path"].some(k=>cur[k]!==o[k])){ Object.assign(cur, o, {deleted:false, updatedAt:now}); n++; }
    }
    touch(); render(); toast(`Plan DocClass repris ✓ ${n} rubrique(s) ajoutée(s) ou mise(s) à jour`);
  };
  r.readAsText(file);
}

/* ---------- aide aux raccourcis iPhone ---------- */
function openShortcutHelp(){
  const steps=(rows)=>rows.map(([n,t])=>`<div class="helprow"><span class="hi">${n}</span><span>${esc(t)}</span></div>`).join("");
  modal(`${sheetHead("help","Une seule fois",`Raccourci « ${esc(DIRECT_SHORTCUT)} »`)}
    <div class="hint">Mode « Raccourci direct » : tu valides tes papiers, un appui et ils sont rangés dans iCloud Drive, sans menu de partage. Ma Maison passe les fichiers au raccourci par le presse-papiers ; le raccourci le vide à la fin.</div>
    <div style="margin-top:8px">${steps([
      ["1",`App Raccourcis → + → nomme-le exactement « ${DIRECT_SHORTCUT} ».`],
      ["2","Action « Obtenir le presse-papiers »."],
      ["3","Action « Obtenir le dictionnaire à partir de l'entrée » (entrée : Presse-papiers)."],
      ["4","Action « Obtenir la valeur du dictionnaire » : Valeur pour la clé « fichiers »."],
      ["5","Action « Répéter avec chaque élément » (sur la Valeur du dictionnaire de l'étape 4). Dans la boucle :"],
      ["5a","« Obtenir la valeur du dictionnaire » : clé « donnees », dans « Élément répété »."],
      ["5b","« Encoder en base64 » sur cette valeur, puis touche › et choisis « Décoder »."],
      ["5c","« Obtenir la valeur du dictionnaire » : clé « nom », dans « Élément répété »."],
      ["5d","« Définir le nom » : renomme le résultat base64 (5b) avec la valeur « nom » (5c)."],
      ["5e","« Obtenir la valeur du dictionnaire » : clé « chemin », dans « Élément répété »."],
      ["5f","« Enregistrer le fichier » : le fichier renommé (5d) ; touche ›, désactive « Demander où enregistrer », Destination = iCloud Drive, Sous-chemin = la valeur « chemin » (5e), « Écraser si le fichier existe » DÉSACTIVÉ."],
      ["5g","« Obtenir la valeur du dictionnaire » : clé « origine », dans « Élément répété » (nom du fichier d'origine)."],
      ["5h","« Texte » : ADMINISTRATION_PERSONNELLE/00_A_TRAITER/ suivi de la valeur « origine » (5g)."],
      ["5i","« Obtenir le fichier dans le dossier » : dossier iCloud Drive, chemin = le Texte (5h) ; désactive « Erreur si introuvable »."],
      ["5j","« Si » : Fichier (5i) « a une valeur » → « Supprimer les fichiers » (Fichier 5i). Laisse « Confirmer avant de supprimer » activé pour les premiers essais. Fin du Si."],
      ["6","Après la boucle : action « Texte » laissée vide, puis « Copier dans le presse-papiers » (vide le presse-papiers : confidentialité)."],
      ["7","Action « Afficher la notification » : « Papiers rangés ✓ » (facultatif)."],
      ["8","Ici : ⚙️ Réglages → Papiers → choisis « Raccourci direct ». Au 1er usage, iOS demande l'accès au presse-papiers et à iCloud Drive : choisis « Toujours autoriser »."]
    ])}</div>
    <div class="hint">Étapes 5g à 5j : l'original est supprimé seulement s'il se trouve dans ADMINISTRATION_PERSONNELLE › 00_A_TRAITER, et seulement après l'enregistrement de la copie. Il reste 30 jours dans « Supprimés récemment ». Le raccourci crée les dossiers manquants. S'il échoue, réponds « Pas rangés » dans Ma Maison : tes papiers restent validés, et tu peux passer au mode « Enregistrer dans Fichiers ».</div>
    <details style="margin-top:10px"><summary class="meta">Ancien raccourci « Ranger dans iCloud » (par le menu de partage)</summary>
      <div style="margin-top:6px">${steps([["1","Raccourci « Ranger dans iCloud », affiché dans la feuille de partage, types : Fichiers."],["2","« Obtenir le presse-papiers », puis « Enregistrer le fichier » (entrée du raccourci ; Demander où : non ; iCloud Drive ; Sous-chemin : Presse-papiers ; Écraser : non)."]])}</div></details>
    <div class="actions"><span class="spacer"></span><button class="btn" id="shOk">Compris</button></div>`,
  (bd, close)=>{ bd.querySelector("#shOk").onclick=close; });
}

/* ---------- liaisons (appelées par index.html après le chargement) ---------- */
function initPapiers(){
  $("papPick").onclick=()=>$("papFile").click();
  $("papCam").onclick=()=>$("papCamFile").click();
  for(const id of ["papFile","papCamFile"]) $(id).onchange=e=>{ const fs=[...e.target.files]; e.target.value=""; addPapFiles(fs); };
  $("pqClear").onclick=()=>{ const done=PQ.filter(x=>x.status==="rangé");
    if(done.length && done.length<PQ.length){ for(const x of done) PQ.splice(PQ.indexOf(x),1); }
    else if(confirm(`Retirer les ${PQ.length} document(s) de la liste ?\n\nAucun fichier n'est supprimé ; le registre est conservé.`)) PQ.splice(0, PQ.length);
    render(); };
  document.querySelectorAll("#papSeg button").forEach(b=>b.onclick=()=>{ papView=b.dataset.v; $("q").value=""; setTab("papers"); });
  const radios=[...document.querySelectorAll('input[name="papMode"]')];
  for(const r of radios){
    r.checked = r.value===papMode();
    r.onchange=()=>{ if(!r.checked) return; try{ localStorage.setItem(LS_PAPMODE, r.value); }catch(_){}
      toast(r.value==="direct"?`Rangement automatique par le raccourci « ${DIRECT_SHORTCUT} »`:r.value==="raccourci"?"Rangement par le raccourci « Ranger dans iCloud »":"Rangement par « Enregistrer dans Fichiers »");
      if(r.value!=="direct") for(const x of validated()){ x.status="prêt"; x.b64=null; }
      render(); };
  }
  $("papShortcutHelp").onclick=openShortcutHelp;
  $("papImportBtn").onclick=()=>$("papImportFile").click();
  $("papImportFile").onchange=e=>{ if(e.target.files[0]) importDocClassPlan(e.target.files[0]); e.target.value=""; };
  document.addEventListener("click", e=>{
    if(!S.data || e.target.closest("#modalRoot")) return;
    let el;
    if(el=e.target.closest("[data-pqsend]")) return sendBatch();
    if(el=e.target.closest("[data-pq]")) return openPQ(PQ.find(x=>x.qid===el.dataset.pq));
    if(el=e.target.closest("[data-doc]")) return openDoc(docsLive().find(x=>x.id===el.dataset.doc));
    if(el=e.target.closest("[data-plan]")) return openPlan(planLive().find(x=>x.id===el.dataset.plan));
    if(el=e.target.closest("[data-papsearch]")){ const q=$("q").value; papView=docsLive().some(d=>matches(q,d.name,d.org||"",planRub(d.ref)?.name||""))?"registre":"plan"; setTab("papers"); $("q").value=q; render(); }
  });
  window.addEventListener("beforeunload", e=>{ if(papPending() && !leavingForShortcut){ e.preventDefault(); e.returnValue=""; } });
}
