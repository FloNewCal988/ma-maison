/* Tests du moteur Papiers (Node 18+) : node tests/moteur.test.js
   Documents entièrement fictifs. Aucun réseau, aucun fichier lu. */
const assert = require("assert");
const DC = require("../papiers-moteur.js");
const plan = DC.buildDefaultPlan();
let ok = 0;
const t = (name, fn) => { try { fn(); ok++; console.log("ok  ", name); } catch (e) { console.log("ÉCHEC", name, "\n     ", e.message); process.exitCode = 1; } };
const AIRBUS = "AIRBUS Operations S.A.S.\n316 route de Bayonne\nBlagnac, le 16 mars 2021\n\nATTESTATION DE TRAVAIL\n\nNous soussignés, AIRBUS Operations, certifions que Monsieur Test FICTIF\nest employé dans notre société depuis le 17 septembre 2018 en qualité d’ingénieur,\ndans le cadre d’un contrat à durée déterminée jusqu’au 10 septembre 2021.\n";

t("plan par défaut : 66 rubriques, codes et chemins relatifs", () => {
  assert.strictEqual(DC.rubriques(plan).length, 66);
  assert.ok(plan.every(p => !p.path.startsWith("/") && !p.parts.some(x => /^\d{4}$/.test(x))));
  assert.strictEqual(new Set(plan.map(p => p.id)).size, plan.length);
  assert.strictEqual(DC.byRef(plan, "03.04").code, "A-03.04");
});
t("apostrophes typographiques normalisées", () => assert.strictEqual(DC.norm("Jusqu’au d'emploi"), "jusqu au d emploi"));
t("Airbus : date d'en-tête, dates de contrat écartées", () => {
  const d = DC.chooseDate(AIRBUS, "");
  assert.strictEqual(d.date, "2021-03-16");
  const by = Object.fromEntries(d.options.map(o => [o.date, o.confidence]));
  assert.strictEqual(by["2018-09-17"], 12); assert.strictEqual(by["2021-09-10"], 12);
});
t("« personne le » n'est pas une date de naissance", () => assert.notStrictEqual(DC.dateCandidates("remis à la personne le 16 mars 2021")[0].confidence, 12));
t("« née le » est écartée", () => assert.strictEqual(DC.dateCandidates("Madame Test, née le 31 juillet 1990")[0].confidence, 12));
t("date ISO dans le nom", () => { const o = DC.dateCandidates("", "2021-03-16 attestation"); assert.deepStrictEqual([o[0].date, o[0].confidence], ["2021-03-16", 65]); });
t("date impossible ignorée, aucune date inventée", () => { assert.deepStrictEqual(DC.dateCandidates("le 31/02/2024"), []); assert.strictEqual(DC.chooseDate("rien", "").date, ""); });
t("deux dates plausibles → choix manuel", () => assert.strictEqual(DC.chooseDate("Fait à Nouméa le 01/02/2024\nFait à Paris le 05/02/2024", "").date, ""));
t("facture : date d'émission + échéance proposée", () => {
  const p = DC.propose("facture.pdf", "ENERCAL\nFacture n° 123456\nDate de facture : 05/09/2025\nÉchéance : 25/09/2025", plan, []);
  assert.deepStrictEqual([p.ref, p.org, p.date, p.due, p.score], ["10.01", "Enercal", "2025-09-05", "2025-09-25", 100]);
});
t("Airbus complet : 03.04, 100/100, nom proposé", () => {
  const p = DC.propose("Attestation de travail Airbus.pdf", AIRBUS, plan, []);
  assert.deepStrictEqual([p.ref, p.org, p.date, p.score, p.kind, p.filename], ["03.04", "Airbus", "2021-03-16", 100, "Attestation de travail", "2021-03-16_attestation_de_travail_airbus.pdf"]);
  assert.strictEqual(DC.targetPath(plan, p.ref, p.parts, p.filename), "ADMINISTRATION_PERSONNELLE/03_carriere_et_emploi/03.04_airbus/2021-03-16_attestation_de_travail_airbus.pdf");
});
t("relevé BNC : sous-dossier banque / relevés / année", () => {
  const p = DC.propose("Releve de compte BNC 15-03-2025.pdf", "Relevé de compte", plan, []);
  assert.deepStrictEqual([p.ref, p.parts], ["04.01", ["BNC", "Releves_de_comptes", "2025"]]);
});
t("CV citant l'INSA reste un CV", () => assert.strictEqual(DC.propose("CV candidature recherche emploi.pdf", "Diplômé INSA Toulouse", plan, []).ref, "03.05"));
t("règle approuvée : change la rubrique et efface le sous-dossier bancaire", () => {
  const p = DC.propose("Releve de compte BNC 15-03-2025.pdf", "x", plan, [{ phrase: "Releve de compte BNC", ref: "09.04" }]);
  assert.deepStrictEqual([p.ref, p.parts, p.rule], ["09.04", [], "releve de compte bnc"]);
});
t("règle désactivée ignorée ; règle jamais appliquée au contenu", () => {
  assert.notStrictEqual(DC.propose("Releve de compte BNC.pdf", "", plan, [{ phrase: "releve de compte bnc", ref: "09.04", enabled: false }]).ref, "09.04");
  assert.notStrictEqual(DC.propose("document.pdf", "mot secret", plan, [{ phrase: "mot secret", ref: "11.05" }]).ref, "11.05");
});
t("règles invalides refusées", () => { for (const b of ["ab", "x".repeat(150), "a/b/c", "../.."]) assert.throws(() => DC.validateRule(b, "03.04")); assert.throws(() => DC.validateRule("Airbus", "3.4")); });
t("noms de fichiers : pas de chemin ni de caractère réservé", () => {
  for (const b of ["", "a/b.pdf", "..", "x~y.pdf", " espace.pdf"]) assert.ok(!DC.validName(b), b);
  assert.ok(DC.validName("2021-03-16_attestation.pdf"));
});
t("nom déjà daté : la date n'est pas doublée", () => assert.strictEqual(DC.suggestName("2021-03-16_attestation", ".pdf", "2021-03-16"), "2021-03-16_attestation.pdf"));
t("photo au nom générique : nom tiré du type et de l'organisme", () => {
  const p = DC.propose("IMG_4021.jpg", "CAFAT\nAttestation de droits\nNouméa, le 3 février 2026", plan, []);
  assert.strictEqual(p.filename, "2026-02-03_attestation_de_droits_cafat.jpg");
  assert.ok(DC.isGenericName("Scan 0004") && DC.isGenericName("Document") && !DC.isGenericName("Facture Enercal"));
  assert.strictEqual(DC.propose("Facture Enercal.pdf", "", plan, []).filename, "facture_enercal.pdf");
});
console.log(`\n${ok} test(s) réussi(s)${process.exitCode ? " — ÉCHECS ci-dessus" : ""}`);
