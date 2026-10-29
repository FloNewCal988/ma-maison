/* Ma Maison — moteur « Papiers » (portage JavaScript de DocClass V2.5.2).
   Fonctions pures, sans accès au réseau ni au stockage : tout se passe sur l'appareil.
   Les documents ne sont jamais conservés ; seules leurs métadonnées passent par ici. */
"use strict";
const DC_DEFAULTS = {"cats":[["01","Identité et état civil",["Identité","Passeport et voyages officiels","État civil","Permis de conduire","Nationalité et citoyenneté","Autres justificatifs personnels"]],["02","Études et formations",["Scolarité","Classes préparatoires PTSI-PT","DUT Génie Industriel et Maintenance","INSA Toulouse","KEDGE Business School","Formations et certifications"]],["03","Carrière et emploi",["CHT Gaston-Bourret","Alstom","Sephora","Airbus","Recherche d’emploi et CV","Retraite et droits professionnels","Documents professionnels transversaux"]],["04","Banques et finances",["Comptes bancaires","Crédits et emprunts","Épargne et placements","Budget personnel","Moyens de paiement","Autres documents financiers"]],["05","Assurances",["Assurance automobile","Assurance habitation","Assurance-vie","Prévoyance et protection","Autres assurances"]],["06","Logement et immobilier",["Acquisition et propriété","Financement immobilier","Copropriété","Travaux et rénovations","Équipements et installations","Location et gestion locative","Entretien et interventions"]],["07","Véhicules",["Documents administratifs","Acquisition et financement","Entretien et réparations","Contrôles et conformité","Vente et historique"]],["08","Santé",["Couverture santé","Consultations et examens","Hospitalisations et interventions","Ordonnances et traitements","Remboursements et dépenses","Médecine du travail et aptitudes","Vaccinations et prévention"]],["09","Fiscalité et administrations",["Impôt sur le revenu","Fiscalité immobilière","Autres taxes et contributions","Démarches administratives","Organismes et prestations","Contentieux et réclamations"]],["10","Contrats et abonnements",["Électricité et énergie","Eau et services","Internet et téléphonie","Services numériques","Autres contrats récurrents"]],["11","Achats et garanties",["Informatique et téléphonie","Électroménager","Mobilier et équipements","Domotique et électronique","Autres achats importants","Réparations et SAV"]]],"binders":{"01":"A","02":"A","03":"A","04":"B","05":"B","06":"C","07":"C","08":"D","09":"D","10":"E","11":"E"},"rules":{"01.01":"carte identite cni piece identite","01.02":"passeport visa voyage titre sejour","01.03":"acte naissance mariage livret famille etat civil","01.04":"permis conduire categorie permis","01.05":"nationalite citoyennete electoral vote","01.06":"justificatif personnel","02.01":"bulletin scolaire college lycee bac baccalaureat brevet","02.02":"ptsi pt prepa classe preparatoire concours","02.03":"dut gim genie industriel maintenance iut","02.04":"insa toulouse ingenieur diplome releve notes","02.05":"kedge mastere supply chain business school","02.06":"toeic certification python formation attestation","03.01":"cht gaston bourret hopital bulletin paie salaire contrat travail","03.02":"alstom bulletin paie salaire contrat","03.03":"sephora bulletin paie salaire contrat","03.04":"airbus bulletin paie salaire contrat","03.05":"cv candidature lettre motivation recherche emploi","03.06":"retraite carriere cotisation pension","03.07":"attestation employeur professionnel","04.01":"banque compte bancaire releve bci bnc banque populaire revolut rib","04.02":"credit emprunt pret remboursement tableau amortissement","04.03":"epargne placement livret investissement amundi bnp sharinbox actions per pee","04.04":"budget personnel depenses","04.05":"carte bancaire paiement chequier","04.06":"document financier","05.01":"assurance auto automobile voiture sinistre","05.02":"assurance habitation logement maison sinistre","05.03":"assurance vie abeille epargne active beneficiaire","05.04":"prevoyance protection invalidite garantie","05.05":"assurance contrat","06.01":"acte notarie acquisition propriete achat maison","06.02":"financement immobilier credit immobilier","06.03":"copropriete syndic assemblee generale charges","06.04":"travaux renovation devis artisan permis construire","06.05":"photovoltaïque solaire chauffe eau installation","06.06":"bail location locataire quittance","06.07":"entretien maison maintenance intervention","07.01":"carte grise immatriculation certificat cession","07.02":"achat voiture moto vehicule leasing","07.03":"revision vidange garage entretien reparation voiture","07.04":"controle technique homologation","07.05":"vente voiture moto vehicule","08.01":"cafat mutuelle couverture sante","08.02":"analyse laboratoire examen consultation resultat medical","08.03":"hospitalisation chirurgie intervention","08.04":"ordonnance prescription medicament","08.05":"remboursement soin facture medical","08.06":"medecine travail aptitude visite medicale","08.07":"vaccin vaccination","09.01":"impot revenu declaration avis imposition","09.02":"taxe fonciere fiscalite immobiliere","09.03":"taxe contribution","09.04":"demarche administrative courrier administration","09.05":"organisme prestation droit allocation","09.06":"reclamation contentieux litige","10.01":"enercal eec electricite energie facture","10.02":"eau abonnement facture","10.03":"internet telephone mobilis free operateur abonnement","10.04":"icloud netflix youtube abonnement numerique","10.05":"abonnement contrat renouvellement resiliation","11.01":"ordinateur iphone mac ipad tablette facture garantie","11.02":"electromenager frigo machine laver","11.03":"mobilier meuble equipement achat","11.04":"sonoff zigbee home assistant domotique camera","11.05":"achat facture garantie","11.06":"sav garantie reparation reclamation produit"},"examples":{"01":"Carte d’identité, passeport, actes d’état civil, permis de conduire.","02":"Diplômes, bulletins scolaires, relevés de notes, attestations de formation.","03":"Contrats de travail, bulletins de paie, attestations employeur, CV.","04":"Relevés bancaires, RIB, contrats de crédit, documents d’épargne.","05":"Contrats et attestations d’assurance, sinistres, échéanciers.","06":"Acte de propriété, copropriété, devis et factures de travaux.","07":"Carte grise, factures d’entretien, contrôle technique, vente.","08":"Attestations de couverture, comptes rendus, ordonnances, remboursements.","09":"Déclarations fiscales, avis d’imposition, courriers administratifs.","10":"Contrats, factures et résiliations d’abonnements.","11":"Factures d’achat, garanties, notices, dossiers SAV."},"subExamples":{"01.01":"Carte nationale d’identité, justificatifs d’identité.","01.02":"Passeports, visas, autorisations de voyage.","01.03":"Actes de naissance, livret de famille, actes de mariage.","01.04":"Permis de conduire et justificatifs associés.","01.05":"Documents de nationalité et de citoyenneté.","01.06":"Autres justificatifs d’identité personnelle.","02.01":"Bulletins scolaires, relevés de notes et diplômes scolaires.","02.02":"Bulletins, relevés et attestations de classes préparatoires.","02.03":"Diplôme DUT, relevés de notes et attestations.","02.04":"Diplôme INSA, relevés de notes et attestations.","02.05":"Diplôme KEDGE, relevés de notes et attestations.","02.06":"Certificats, attestations de formation et résultats TOEIC.","03.01":"Contrat CHT, bulletins de paie et attestations.","03.02":"Contrat Alstom, bulletins de paie et attestations.","03.03":"Contrat Sephora, bulletins de paie et attestations.","03.04":"Contrat Airbus, bulletins de paie et attestations.","03.05":"CV, lettres de motivation, candidatures et réponses.","03.06":"Relevés de carrière, droits à la retraite et cotisations.","03.07":"Attestations professionnelles et documents transversaux.","05.01":"Contrats auto, attestations, échéances et sinistres.","05.02":"Contrats habitation, attestations, échéances et sinistres.","05.03":"Contrat assurance-vie, relevés et opérations.","05.04":"Garanties prévoyance, invalidité et protection.","05.05":"Autres contrats et justificatifs d’assurance.","06.01":"Acte notarié, compromis et titres de propriété.","06.02":"Offres de prêt immobilier, échéanciers et garanties.","06.03":"Convocations et procès-verbaux d’AG, charges et syndic.","06.04":"Devis, factures, autorisations et suivi de travaux.","06.05":"Notices, certificats et documents des installations du logement.","06.06":"Baux, états des lieux, quittances et gestion locative.","06.07":"Contrats d’entretien et comptes rendus d’intervention.","07.01":"Carte grise, certificat d’immatriculation et documents administratifs.","07.02":"Facture d’achat, contrat de financement et cession.","07.03":"Factures de garage, révisions et réparations.","07.04":"Contrôles techniques et certificats de conformité.","07.05":"Certificat de cession, annonce et historique de vente.","08.01":"Attestations CAFAT, mutuelle et couverture santé.","08.02":"Comptes rendus médicaux, examens et résultats.","08.03":"Comptes rendus d’hospitalisation et d’intervention.","08.04":"Ordonnances et prescriptions.","08.05":"Décomptes de remboursement et factures de soins.","08.06":"Visites médicales professionnelles et avis d’aptitude.","08.07":"Carnets et certificats de vaccination.","09.01":"Déclarations de revenus et avis d’imposition.","09.02":"Taxe foncière et autres documents fiscaux immobiliers.","09.03":"Autres taxes, avis et contributions.","09.04":"Formulaires, demandes et courriers administratifs.","09.05":"Attestations de droits, prestations et organismes.","09.06":"Réclamations, litiges et réponses officielles.","10.01":"Contrats, factures et résiliations d’électricité et d’énergie.","10.02":"Contrats et factures d’eau et de services.","10.03":"Contrats et factures Internet et téléphonie.","10.04":"Abonnements numériques et justificatifs de paiement.","10.05":"Autres contrats récurrents et résiliations.","11.01":"Factures et garanties des ordinateurs, téléphones et tablettes.","11.02":"Factures, garanties et notices d’électroménager.","11.03":"Factures et garanties de mobilier.","11.04":"Factures, garanties et notices des équipements domotiques.","11.05":"Factures et garanties des autres achats importants.","11.06":"Dossiers de réparation, SAV et échanges avec vendeurs.","04.01":"Documents liés aux comptes courants et aux établissements bancaires.","04.02":"Offres de prêt, contrats, tableaux d’amortissement, attestations de remboursement.","04.03":"Épargne salariale, retraite, actions, relevés de placements et fiscalité.","04.04":"Tableaux de budget, bilans de dépenses, prévisions personnelles.","04.05":"Documents relatifs aux cartes bancaires, chéquiers et moyens de paiement.","04.06":"Documents financiers ne correspondant à aucune autre rubrique."},"leafExamples":{"Releves_de_comptes":"Relevés mensuels ou périodiques émis par la banque. Classer par année.","Conventions_et_contrats":"Convention de compte, avenants, conditions contractuelles.","RIB":"Relevés d’identité bancaire et coordonnées de compte.","Frais_et_incidents":"Avis de frais, incidents, contestations et régularisations.","Contrats_et_adhesions":"Bulletins d’adhésion, conditions et documents d’ouverture.","Releves_et_situations":"Relevés annuels, situations de compte ou de portefeuille.","Versements_et_operations":"Versements, arbitrages, transferts et opérations enregistrées.","Fiscalite":"Attestations fiscales et justificatifs fiscaux.","Actions_et_attributions":"Notifications d’attribution d’actions et documents associés.","Operations_et_dividendes":"Ventes, achats, opérations sur titres et dividendes.","Autres_placements":"Autres supports d’épargne et de placement."},"details":{"04.01":{"BCI":{"Releves_de_comptes":{"2025":{},"2026":{}},"Conventions_et_contrats":{},"RIB":{},"Frais_et_incidents":{}},"BNC":{"Releves_de_comptes":{"2025":{},"2026":{}},"Conventions_et_contrats":{},"RIB":{},"Frais_et_incidents":{}},"Banque_Populaire":{"Releves_de_comptes":{"2025":{},"2026":{}},"Conventions_et_contrats":{},"RIB":{},"Frais_et_incidents":{}},"Revolut":{"Releves_de_comptes":{"2025":{},"2026":{}},"Conventions_et_contrats":{},"RIB":{},"Frais_et_incidents":{}}},"04.03":{"Amundi":{"Contrats_et_adhesions":{},"Releves_et_situations":{},"Versements_et_operations":{},"Fiscalite":{}},"BNP_Mon_Epargne_Entreprise":{"Contrats_et_adhesions":{},"Releves_et_situations":{},"Versements_et_operations":{},"Fiscalite":{}},"SG_Sharinbox":{"Actions_et_attributions":{},"Releves_et_situations":{},"Operations_et_dividendes":{},"Fiscalite":{}},"Autres_placements":{}}},"knownOrganisms":[["cht gaston bourret","03.01","CHT Gaston-Bourret"],["centre hospitalier territorial","03.01","CHT Gaston-Bourret"],["gaston bourret","03.01","CHT Gaston-Bourret"],["alstom","03.02","Alstom"],["sephora","03.03","Sephora"],["airbus","03.04","Airbus"],["insa toulouse","02.04","INSA Toulouse"],["insa","02.04","INSA Toulouse"],["kedge","02.05","KEDGE Business School"],["cafat","08.01","CAFAT"],["enercal","10.01","Enercal"],["eec","10.01","EEC"]],"documentTypes":[["Attestation de travail",["attestation de travail","attestation d emploi","certificat de travail"]],["Bulletin de salaire",["bulletin de salaire","bulletin de paie","fiche de paie"]],["Relevé bancaire",["releve de compte","releve bancaire"]],["Facture",["facture n","facture numero","facture du"]],["Contrat",["contrat de travail","contrat d apprentissage","contrat de location"]],["Diplôme",["diplome","attestation de reussite"]],["Attestation d’assurance",["attestation d assurance","certificat d assurance"]],["Avis d’imposition",["avis d imposition","avis d impot"]],["Relevé d’identité bancaire",["releve d identite bancaire"]],["Quittance de loyer",["quittance de loyer"]],["Certificat d’immatriculation",["certificat d immatriculation","carte grise"]],["Contrôle technique",["proces verbal de controle technique","controle technique"]],["Devis",["devis n","devis numero"]],["Avis d’échéance",["avis d echeance","echeancier"]],["Attestation de droits",["attestation de droits"]],["Relevé de notes",["releve de notes"]]]};

const DC = (() => {
  const D = DC_DEFAULTS;
  /* ---------- normalisation ---------- */
  const norm = s => (s||"").toString().replace(/['’ʼ‘`]/g," ").normalize("NFKD").replace(/[̀-ͯ]/g,"").toLowerCase();
  const baseNorm = s => (s||"").toString().normalize("NFKD").replace(/[̀-ͯ]/g,"").toLowerCase();
  const slug = s => baseNorm(s).replace(/[^A-Za-z0-9]+/g,"_").replace(/_+/g,"_").replace(/^_|_$/g,"");
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const tokensOf = q => new Set(q.match(/[a-z0-9]+/g)||[]);
  const wordRe = k => new RegExp("(?:^|[^a-z0-9])"+reEsc(k)+"(?![a-z0-9])");
  const hasPhrase = (text, phrases) => phrases.some(k => wordRe(k).test(text));
  /* position de fin de la dernière expression trouvée (-1 si aucune) : la plus proche de la date l'emporte */
  function lastPhrase(text, phrases){
    let best=-1;
    for(const k of phrases){ const re=new RegExp("(?:^|[^a-z0-9])"+reEsc(k)+"(?![a-z0-9])","g"); let m; while((m=re.exec(text))){ best=Math.max(best, m.index+m[0].length); re.lastIndex=m.index+1; } }
    return best;
  }

  /* ---------- plan de classement par défaut ---------- */
  function buildDefaultPlan(){
    const out=[];
    for(const [code,title,subs] of D.cats){
      subs.forEach((sub,i)=>{
        const ref=`${code}.${String(i+1).padStart(2,"0")}`;
        out.push(planRubrique(code,title,ref,sub,D.rules[ref]||"",D.subExamples[ref]||D.examples[code]||""));
        const visit=(branch,parts)=>{ for(const [name,kids] of Object.entries(branch||{})){
          const p=[...parts,name];
          if(!(/^\d{4}$/.test(name))) out.push(planFolder(out.find(x=>x.id==="p:"+ref), p, defaultFolderExamples(p, sub)));
          visit(kids,p);
        }};
        visit(D.details[ref],[]);
      });
    }
    return out;
  }
  function planRubrique(catcode,category,ref,name,keywords,examples){
    const binder=D.binders[catcode]||"?";
    const folder=`${catcode}_${slug(category)}`, subfolder=`${ref}_${slug(name)}`;
    return {id:"p:"+ref, binder, catcode, category, ref, name, code:`${binder}-${ref}`, keywords, parts:[], detail:"",
            path:`${folder}/${subfolder}`, examples};
  }
  function planFolder(rub, parts, examples){
    return {id:`p:${rub.ref}/${parts.join("/")}`, binder:rub.binder, catcode:rub.catcode, category:rub.category, ref:rub.ref,
            name:rub.name, code:rub.code, keywords:"", parts:[...parts], detail:parts.map(x=>x.replace(/_/g," ")).join(" › "),
            path:`${rub.path}/${parts.join("/")}`, examples};
  }
  function defaultFolderExamples(parts, rubName){
    const last=parts[parts.length-1];
    let t=D.leafExamples[last]||"";
    if(last==="Releves_de_comptes") t+=" Un sous-dossier par année.";
    return t.trim() || `Documents de « ${last.replace(/_/g," ")} » (${rubName}).`;
  }

  /* ---------- dates ---------- */
  const MONTHS={janvier:1,fevrier:2,mars:3,avril:4,mai:5,juin:6,juillet:7,aout:8,septembre:9,octobre:10,novembre:11,decembre:12};
  const DATE_RE=new RegExp(
    "((?:19|20)\\d{2})[-_./ ](\\d{1,2})[-_./ ](\\d{1,2})(?!\\d)"+
    "|(\\d{1,2})[\\s./-]+(\\d{1,2})[\\s./-]+(\\d{4})(?!\\d)"+
    "|(\\d{1,2})(?:er)?\\s+("+Object.keys(MONTHS).join("|")+")\\s+(\\d{4})(?!\\d)","g");
  const NEG=["depuis le","depuis","debut","embauche","contrat","apprentissage","fin du","fin de","echeance","jusqu au","prevue","prevision","naissance","ne le","nee le","periode","valable","expiration"];
  const DUE=["echeance","a payer avant","a payer avant le","payer avant le","date limite","date limite de paiement","au plus tard le","avant le","date d echeance","prelevement le","sera preleve le"];
  const POS=["fait a","fait le","emis le","emise le","delivre le","delivree le","etabli le","etablie le","date de signature","date d emission","date de delivrance","date de facture","date du document"];
  function isoOf(y,m,d){
    if(!(m>=1&&m<=12&&d>=1&&y>=1)) return null;
    const dt=new Date(Date.UTC(y,m-1,d));
    if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d) return null;
    return `${String(y).padStart(4,"0")}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  }
  function* dateMatches(s){
    const re=new RegExp(DATE_RE.source,"g"); let m;
    while((m=re.exec(s))){
      if(m.index>0 && /\d/.test(s[m.index-1])){ re.lastIndex=m.index+1; continue; }   // équivalent du (?<!\d) Python
      let iso;
      if(m[1]) iso=isoOf(+m[1],+m[2],+m[3]);
      else if(m[6]) iso=isoOf(+m[6],+m[5],+m[4]);
      else iso=isoOf(+m[9],MONTHS[m[8]],+m[7]);
      yield {iso, start:m.index, end:m.index+m[0].length, text:m[0]};
    }
  }
  function dateCandidates(text, filename){
    const found=new Map();
    for(const [source,body] of [["nom du fichier",filename||""],["contenu",text||""]]){
      const n=norm(body);
      for(const m of dateMatches(n)){
        if(!m.iso) continue;
        const before=n.slice(Math.max(0,m.start-115),m.start), after=n.slice(m.end,m.end+80);
        const nearby=before.slice(-55);
        let label="Date mentionnée", score=35;
        if(source==="nom du fichier"){ score=65; label="Date présente dans le nom"; }
        const negAt=lastPhrase(nearby,NEG), posAt=lastPhrase(nearby,POS), dueAt=lastPhrase(nearby,DUE);
        const negative=negAt>=0 && negAt>=posAt;          // V2.5.1 : la positive gagnait toujours ; ici la plus proche décide
        if(negative){ score=12; label="Date de contrat / échéance (à vérifier)"; }
        if(posAt>=0 && posAt>negAt){ score=90; label="Date d’émission / signature probable"; }
        const due = source!=="nom du fichier" && dueAt>=0 && dueAt>=posAt;
        if(source!=="nom du fichier" && m.start<600 && !negative && /(?:^|\n)[a-z][a-z -]{2,35},?\s+le[ \t]*$/m.test(nearby)){ score=96; label="Date d’en-tête (émission probable)"; }
        if(source!=="nom du fichier" && m.start<700 && score===35) score=50;
        const c={date:m.iso,label,confidence:score,due,context:(before.slice(-85)+" "+m.text+" "+after.slice(0,55)).trim().slice(0,145)};
        if(!found.has(m.iso) || score>found.get(m.iso).confidence) found.set(m.iso,c);
      }
    }
    return [...found.values()].sort((a,b)=>b.confidence-a.confidence || (a.date<b.date?-1:a.date>b.date?1:0));
  }
  function chooseDate(text, filename){
    const options=dateCandidates(text, filename);
    if(!options.length) return {date:"", options, reason:"Aucune date détectée"};
    const best=options[0];
    if(best.confidence<60) return {date:"", options, reason:"Dates trouvées, mais aucune date d’émission fiable : choix manuel requis"};
    if(options.length>1 && best.confidence-options[1].confidence<12) return {date:"", options, reason:"Plusieurs dates plausibles : choix manuel requis"};
    return {date:best.date, options, reason:best.label};
  }

  /* ---------- reconnaissance documentaire ---------- */
  function identifyType(name, text){
    const hay=norm(name+" "+(text||"").slice(0,7000));
    for(const [label,phrases] of D.documentTypes) for(const p of phrases) if(hay.includes(p)) return {kind:label, evidence:`Expression « ${p} » détectée`};
    return {kind:"Non déterminé", evidence:"Aucune expression documentaire suffisamment distinctive"};
  }
  const rubriques = plan => plan.filter(p=>!p.parts.length);
  const byRef = (plan, ref) => plan.find(p=>p.ref===ref && !p.parts.length) || null;
  function orgFolders(plan, ref){ return [...new Set(plan.filter(p=>p.ref===ref && p.parts.length).map(p=>p.parts[0]))]; }
  function childFolders(plan, ref, org){ return plan.filter(p=>p.ref===ref && p.parts.length===2 && p.parts[0]===org).map(p=>p.parts[1]); }
  const ALIASES={Banque_Populaire:["banque populaire"],BNP_Mon_Epargne_Entreprise:["bnp mon epargne entreprise","bnp epargne entreprise","bnp"],SG_Sharinbox:["sg sharinbox","sharinbox"]};
  function matchOrganism(text, plan){   // banques et placements (04.01 / 04.03) : donnent un sous-dossier
    const q=baseNorm(text).replace(/_/g," "); const m=[];
    for(const ref of ["04.01","04.03"]) for(const name of orgFolders(plan,ref)){
      for(const ph of (ALIASES[name]||[baseNorm(name.replace(/_/g," "))])) if(wordRe(ph).test(q)){ m.push([ph.length,ref,name]); break; }
    }
    m.sort((a,b)=>b[0]-a[0] || (b[1]>a[1]?1:-1) || (b[2]>a[2]?1:-1));
    return m.length ? {ref:m[0][1], org:m[0][2]} : {ref:null, org:null};
  }
  function matchKnown(text, plan){
    const q=norm(text).replace(/[_-]/g," "); let best=null;
    for(const [phrase,ref,label] of D.knownOrganisms){
      if(!byRef(plan,ref)) continue;
      const m=new RegExp("(^|[^a-z0-9])"+reEsc(phrase)+"(?![a-z0-9])").exec(q);
      if(m){ const pos=m.index+m[1].length; if(!best || pos<best.pos || (pos===best.pos && phrase.length>best.len)) best={ref,org:label,pos,len:phrase.length}; }
    }
    return best || {ref:null, org:null, pos:-1};
  }
  function matchDocumentType(text, plan, ref, org){
    const q=baseNorm(text); const br=new Set(childFolders(plan,ref,org));
    const pats=[[/\b(rib|iban|coordonnees bancaires)\b/,["RIB"]],[/\b(dividende|dividendes)\b/,["Operations_et_dividendes"]],
      [/\b(fiscal|fiscale|fiscalite|impot)\b/,["Fiscalite"]],[/\b(frais|incident|agios)\b/,["Frais_et_incidents"]],
      [/\b(contrat|convention|adhesion|avenant)\b/,["Conventions_et_contrats","Contrats_et_adhesions"]],
      [/\b(releve|releves|situation|solde)\b/,["Releves_de_comptes","Releves_et_situations"]],
      [/\b(versement|arbitrage|transfert)\b/,["Versements_et_operations"]],[/\b(action|actions|attribution)\b/,["Actions_et_attributions"]]];
    for(const [re,opts] of pats) if(re.test(q)) for(const o of opts) if(br.has(o)) return o;
    return null;
  }

  /* ---------- classification par mots-clés (DocClass V1.3 → V1.7) ---------- */
  function classify(query, plan){
    const q=baseNorm(query), tokens=tokensOf(q), res=[];
    for(const row of rubriques(plan)){
      const ref=row.ref, keys=baseNorm(row.keywords||""), name=baseNorm(row.name);
      let score=0;
      for(const w of new Set(keys.match(/[a-z0-9]+/g)||[])) if(w.length>2 && tokens.has(w)) score+=3;
      for(const w of new Set(name.match(/[a-z0-9]+/g)||[])) if(w.length>3 && tokens.has(w)) score+=2;
      if(q.includes(name)) score+=8;
      const any=(...w)=>w.some(x=>tokens.has(x));
      if(ref==="02.04" && (any("banque","bancaire","bci","bnc","revolut"))) score=0;
      if(ref==="04.01" && any("bci","bnc","revolut")) score+=15;
      if(ref==="04.03" && any("amundi","sharinbox")) score+=15;
      if(ref==="03.01" && tokens.has("cht")) score+=12;
      if(score>0) res.push([score,row]);
    }
    return res.sort((a,b)=>b[0]-a[0] || (a[1].ref<b[1].ref?-1:1)).slice(0,5);
  }
  function classifyV17(query, plan){
    const tokens=tokensOf(baseNorm(query));
    const has=(...w)=>w.some(x=>tokens.has(x));
    if(has("releve","releves") && !has("insa","kedge","dut","gim","notes","scolaire","bulletin","diplome","universite","formation")){
      const banking=has("banque","bancaire","compte","bci","bnc","revolut"), savings=has("epargne","placement","amundi","sharinbox","bnp","actions","per","pee");
      const r1=byRef(plan,"04.01"), r3=byRef(plan,"04.03");
      if(banking && !savings && r1) return [[40,r1]];
      if(savings && !banking && r3) return [[40,r3]];
      return [r1&&[10,r1], r3&&[10,r3]].filter(Boolean);
    }
    const matches=classify(query, plan);
    for(const [t,ref] of [["insa","02.04"],["kedge","02.05"],["cht","03.01"]]) if(tokens.has(t) && byRef(plan,ref)) return [[40,byRef(plan,ref)]];
    return matches;
  }

  /* ---------- règles approuvées (noms de fichiers uniquement) ---------- */
  const rulePhrase = p => norm((p||"").trim()).replace(/_/g," ").replace(/\s+/g," ").trim();
  function validateRule(phrase, ref){
    const p=rulePhrase(phrase);
    if(p.length<4 || p.length>100 || !/^[\w .-]+$/.test(p)) throw new Error("Expression invalide (4 à 100 caractères : lettres, chiffres, espaces, point, tiret).");
    if(!/^\d{2}\.\d{2}$/.test(ref||"")) throw new Error("Sous-catégorie invalide.");
    return p;
  }
  const ruleMatches = (phrase, normalizedName) => { const p=rulePhrase(phrase); return !!p && new RegExp("(?:^|[^\\w])"+reEsc(p)+"(?![\\w])").test(normalizedName); };

  /* ---------- score explicable ---------- */
  function confidence(org, kind, options, date, ref, orgRef, rule){
    const orgPts=org?30:0, kindPts=kind!=="Non déterminé"?25:0;
    const sel=options.find(c=>c.date===date);
    const datePts=sel&&sel.confidence>=90?25:(sel?15:0);
    const destPts=ref&&(orgRef===ref||rule)?20:(ref?10:0);
    const items=[["Organisme",orgPts,30,org?"Organisme reconnu : "+org:"Organisme non reconnu"],
      ["Type de document",kindPts,25,kindPts?kind:"Type non déterminé"],
      ["Date principale",datePts,25,sel?sel.label:"Date à confirmer"],
      ["Destination",destPts,20,destPts===20?"Correspondance explicite":(ref?"Catégorie plausible à vérifier":"Destination manquante")]];
    return {score:items.reduce((s,x)=>s+x[1],0), items};
  }

  /* ---------- proposition complète ---------- */
  function splitName(fileName){ const i=fileName.lastIndexOf("."); return i>0 ? [fileName.slice(0,i), fileName.slice(i).toLowerCase()] : [fileName, ""]; }
  function propose(fileName, extracted, plan, rules){
    extracted=extracted||"";
    const [stem, ext]=splitName(fileName);
    const name=stem.replace(/_/g," "), combined=name+" "+extracted.slice(0,9000);
    let orgRef=null, org=null, orgSource="";
    let r=matchOrganism(name, plan);
    if(r.ref){ orgRef=r.ref; org=r.org; orgSource="nom du fichier"; }
    else { const k=matchKnown(name, plan); if(k.ref){ orgRef=k.ref; org=k.org; orgSource="nom du fichier"; } }
    if(!orgRef && extracted){
      const k=matchKnown(extracted.slice(0,1500), plan);
      const zone=k.ref ? extracted.slice(0,k.pos) : extracted.slice(0,3500);
      const b=zone ? matchOrganism(zone, plan) : {ref:null};
      if(b.ref){ orgRef=b.ref; org=b.org; orgSource="contenu (en-tête)"; }
      else if(k.ref){ orgRef=k.ref; org=k.org; orgSource="contenu (en-tête)"; }
    }
    let bankOrg=!!orgRef && ["04.01","04.03"].includes(orgRef) && orgFolders(plan,orgRef).includes(org);
    let candidates=classifyV17(name, plan); const nameCandidates=candidates.length>0;
    if(!candidates.length && extracted) candidates=classifyV17(extracted.slice(0,1800), plan);
    const clear=c=>c.length>0 && (c.length===1 || c[0][0]-c[1][0]>=8);
    let ref;
    if(orgRef && !bankOrg && orgSource.startsWith("contenu") && nameCandidates && clear(candidates)) ref=candidates[0][1].ref;
    else ref=orgRef || (candidates.length ? candidates[0][1].ref : null);
    if(candidates.length && !orgRef && !clear(candidates)) ref=null;
    const d=chooseDate(extracted.slice(0,12000), name);
    let dtype=bankOrg && ref ? matchDocumentType(combined, plan, ref, org) : null;
    const t=identifyType(name, extracted);
    let rule="";
    const nn=norm(name);
    for(const x of (rules||[])) if(x.enabled!==false && !x.deleted && byRef(plan,x.ref) && ruleMatches(x.phrase,nn)){ ref=x.ref; rule=rulePhrase(x.phrase); break; }
    if(rule && orgRef && orgRef!==ref){ bankOrg=false; dtype=null; }
    const sc=confidence(org, t.kind, d.options, d.date, ref, orgRef, rule);
    const parts=[];
    if(bankOrg && ref===orgRef){ parts.push(org); if(dtype){ parts.push(dtype); if(dtype==="Releves_de_comptes" && d.date) parts.push(d.date.slice(0,4)); } }
    const dueOpt=d.options.filter(o=>o.due).sort((a,b)=>a.date<b.date?-1:1)[0];
    return {ref, org:org||"", orgSource, date:d.date, dateOptions:d.options, dateReason:d.reason, parts, due:dueOpt?dueOpt.date:"",
      score:sc.score, scoreItems:sc.items, kind:t.kind, kindEvidence:t.evidence, rule, ext,
      filename:suggestName(cleanName(stem, t.kind, org), ext, d.date || periodOf(name)),
      reason:rule?"Règle approuvée : "+rule:(org?"Organisme reconnu":(ref?"Catégorie suggérée":"À choisir manuellement"))};
  }
  /* nom d'appareil photo ou de scanner (IMG_4021, Scan 12, Document, 0004…) : peu parlant */
  const isGenericName = stem => /^(img|image|photo|pxl|dsc|dcim|scan|scanned|numerisation|document|doc|fichier|capture|screenshot|sans titre|untitled|cam|whatsapp image)?[\s_-]*[\d\s_-]*$/i.test(baseNorm(stem).trim()) || !/[a-z]{3}/.test(baseNorm(stem));
  function descriptiveStem(kind, org, stem){
    const words=[kind && kind!=="Non déterminé" ? kind : "", org||""].filter(Boolean).join(" ");
    return words || stem;
  }
  /* Nom propre : on garde les mots du nom d'origine, sans identifiants (C10294589), numéros,
     dates ni mois (déjà dans le préfixe). Nom trop pauvre ou générique → type + organisme. */
  const NAME_STOP=new Set(["de","du","des","la","le","les","l","d","et","a","au","aux","en","pour","sur","un","une","n","no"]);
  const MONTH_WORDS=new Set([...Object.keys(MONTHS),"janv","fev","fevr","avr","juil","sept","oct","nov","dec"]);
  function cleanWords(text){
    return slug(text).toLowerCase().split("_").filter(w=>w && !/\d/.test(w) && !MONTH_WORDS.has(w) && w.length>1 || w==="d" || w==="l");
  }
  function cleanName(stem, kind, org){
    const NOISE=/^(img|image|photo|pxl|dsc|dcim|scan|scanned|numerisation|document|doc|fichier|capture|screenshot|untitled|copie|copy|final|finale|version|v|vf|def|definitif|nouveau|new|ok)$/;
    const kept=cleanWords(stem).filter(w=>!/\d/.test(w) && !NOISE.test(w));
    while(kept.length && NAME_STOP.has(kept[0])) kept.shift();
    while(kept.length && NAME_STOP.has(kept[kept.length-1])) kept.pop();
    const meaningful=kept.filter(w=>!NAME_STOP.has(w));
    const known = kind && kind!=="Non déterminé";
    if(meaningful.length>=2) return kept.join("_");   // nom déjà parlant : on le garde (nettoyé)
    const base=[known?kind:"", org||""].filter(Boolean).join(" ");
    return base ? slug(base).toLowerCase() : (kept.join("_") || slug(stem).toLowerCase() || "document");
  }
  /* période AAAA-MM lisible dans le nom (« Bulletin 2026_09 » → 2026-09), quand aucune date sûre */
  function periodOf(name){
    const n=baseNorm(name);
    let m=n.match(/(?:^|[^0-9])((?:19|20)\d{2})[-_. ](0[1-9]|1[0-2])(?![0-9])/);
    if(m) return `${m[1]}-${m[2]}`;
    m=n.match(new RegExp("(?:^|[^a-z])("+Object.keys(MONTHS).join("|")+")[\\s_-]*((?:19|20)\\d{2})(?![0-9])"));
    if(m) return `${m[2]}-${String(MONTHS[m[1]]).padStart(2,"0")}`;
    return "";
  }
  function suggestName(stem, ext, date){
    const s=slug(stem).slice(0,65)||"document";
    const withoutDate=s.replace(/^\d{4}_\d{2}(?:_\d{2})?_?/,"")||s;
    return (date ? date+"_"+withoutDate : s)+(ext||"");
  }
  function validName(n){ return !!n && n.trim()===n && !/[\/\\:~]/.test(n) && n!=="." && n!==".." && n.length<=150; }
  function targetPath(plan, ref, parts, filename){
    const rub=byRef(plan, ref); if(!rub) return null;
    return [D.rootName||"ADMINISTRATION_PERSONNELLE", rub.path, ...parts, filename].join("/");
  }
  return {D, norm, baseNorm, slug, buildDefaultPlan, planRubrique, planFolder, dateCandidates, chooseDate, identifyType,
    matchOrganism, matchKnown, matchDocumentType, classify, classifyV17, rulePhrase, validateRule, ruleMatches, confidence,
    propose, suggestName, cleanName, periodOf, isGenericName, validName, targetPath, byRef, rubriques, splitName, isoOf};
})();
if(typeof module!=="undefined") module.exports=DC;
