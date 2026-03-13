/* ============================
   Liora Cash Flow Analyzer
   Main Application Logic
   v6.2.1h — Categorization Engine
   ============================ */

(function () {
    'use strict';

    // ── State ──
    let rawData = [];
    let filteredData = [];
    let currentPage = 1;
    const PAGE_SIZE = 25;
    let charts = {};

    // ── DOM References ──
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const screens = {
        upload: $('#upload-screen'),
        loading: $('#loading-screen'),
        dashboard: $('#dashboard-screen'),
    };

    // ══════════════════════════════════════════════
    //  CATEGORIZATION ENGINE (translated from Python v6.2.1h)
    // ══════════════════════════════════════════════

    // ── Helpers: accent stripping & normalization ──
    function stripAccents(s) {
        if (typeof s !== 'string') return '';
        return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function normUpper(s) {
        if (s == null) s = '';
        s = String(s);
        s = stripAccents(s).toUpperCase();
        s = s.replace(/\s+/g, ' ').trim();
        return s;
    }

    function containsAnyDual(textNorm, keywords) {
        if (typeof textNorm !== 'string') return false;
        const up = textNorm;
        const noacc = stripAccents(up);
        for (const kw of keywords) {
            const k = kw.toUpperCase();
            if (up.includes(k) || noacc.includes(k)) return true;
        }
        return false;
    }

    // ── Person detection ──
    const CIV_RE = /\b(M\.?|MR|MME|MADAME|MADEMOISELLE|MLLE|MLE|MONSIEUR)\b/i;

    const FIRSTNAMES_EXTRA = new Set([
        'YOUSEF','YOUSSEF','PRISCILLIA','MARTA','ALEJANDRA','GUILLAUME','KATIA','DIALLO','AMINE','WILFRIED',
        'YASMINE','VLADISLAV','SAMUEL','OUALID','WALID','MAROUANE','MAHDI','AURORE','JEAN-RAPHAEL','DENIS',
        'ABDOULAYE','HASSAN','HORACE','GUSTAVE','ALESSANDRO','FARIS','CYRIELLE','JEAN-PAUL','THIBAUT',
    ].map(x => stripAccents(x).toUpperCase()));

    function looksLikePerson(textNorm) {
        if (CIV_RE.test(textNorm)) return true;

        let toks = stripAccents(textNorm).toUpperCase().split(/\s+/).filter(t => /^[A-Z]+$/i.test(t));
        for (let i = 0; i < toks.length - 1; i++) {
            if (FIRSTNAMES_EXTRA.has(toks[i]) || FIRSTNAMES_EXTRA.has(toks[i + 1])) return true;
        }

        const m = textNorm.match(/\/FRM\s+([^/]+)/i);
        if (m) {
            const part = normUpper(m[1]);
            const toks2 = stripAccents(part).toUpperCase().split(/\s+/).filter(t => /^[A-Z]+$/i.test(t));
            for (let i = 0; i < toks2.length - 1; i++) {
                if (FIRSTNAMES_EXTRA.has(toks2[i]) || FIRSTNAMES_EXTRA.has(toks2[i + 1])) return true;
            }
        }
        return false;
    }

    // ── Keyword dictionaries ──

    // Encaissements
    const INTERCO_ENC_KEYS = [
        'TRESO','TRESORERIE','AFORSSIC','FORSSIC','VIREMENT COMPENSE','DST GERMANY',
        'APPROVISIONNEMENT','DEBIT MENSUEL CARTE BLEUE','COMPTE PRO','APPRO','PRELEVEMENT AUTOMATIQUE',
        'AMERICAN EXPRESS CARTE','AMERICAN EXPRESS CARTE-FRANCE','TRESORERIE',
    ];

    const OPCO_KEYS = [
        'AFDAS','ATLAS','OCAPIAT','UNIFORMATION','CONSTRUCTYS',"L'OPCOMMERCE",'OPCOMMERCE','AKTO','OPCO2I',
        'OPCO MOBILITES','OPCO EP','OPCO SANTE',
    ];

    const CPF_KEYS = ['CPF','CAISSE DES DEPOTS'];

    const RECONV_KEYS = [
        'TRANSITIONS PRO','REGION','FRANCE TRAVAIL','POLE EMPLOI','NOUVELLE-AQUITAINE','METROPOLE','VILLE',
        'COMMUNE','MEURTHE-ET-MOSELLE','SOMME','CENTRE ET LOIRET','VAL DE SEINE','YVELINES','DORDOGNE',
        'NORMANDIE','OCCITANIE','VAL DE SAONE','LOIRET',
    ];

    const B2B_EXTRA = [
        'AEROPORTS','AEROPORT','ELUSDIF','DELANE SI','MANUFACTURE','ACTEMIK','WADAM-IT','24 SEVRES','ADME',
        'ADWAY','GIRONDIN','AIR AUSTRAL','ALBA UP','ALBINGIA','AUBAY','AVELOOK','CHRU','CHRS','RHODIA','COTE FLUX',
        'CREDIT AGRICOLE','DEPIXUS','EASYDIS','ECHOSENS','ECO CO2','FACILITY PARK','FIOULMARKET',
        'MAINTENANCE','FLOCA','GUILDE DES LUNETIERS','HIGH CO BOX','HUTCHINSON','LIAISONS','LONG PLAY','GAMBLING',
        'SIEGE','NEOLITHE','NERABIS','FILTRATION','OLINDA','ONASOFT','OODRIVE','OPEN BEE','ORTHO-CARAIBES',
        'PLACE DE LA','PONTOON','POSOS','PRAEMIA','PRELIGENS','PRODISER','PROXISERVE','QUANTUM','RANDSTAD','REALITES',
        'RENTR','RESEAU CANOPE','INDUSTRIE','SCALIAN','SELARL FIDES','SIACI SAINT HONORE','COMPOSITE','TISSIUM',
        'TYRES','VALRHONA','VEDICOM','LEARNQUEST','WINKO','ORANGE','LHH','NOOUS','SODEXO','LE PUY DU FOU',
        'LIGUE NATIONALE','DOMIS','MUTUELLES','MY MONEY BANK','METRO','SAPMER','CONSUMER FINANCE','GOLDEN BEES',
        'ALIXIO','SIMPLON','MANPOWER','DACODE','CEREMA','INVEST','SALSIFY','IZNES','SOCIETE DE GESTION',
        'MANCHE NUMERIQUE','TILD','SOCFIM','BUSINESS SOLUTIONS','PHARMA','FUTUROSOFT','HUSQVARNA','ASNR',
        'NEXITY','COMMISSARIAT','HEALTHCARE','TEKSIALCSTA','FRANPRIX','WEBCHECK','VERTUO','SANDVIK',
        'CONSTRUCTION','POS CONNECT','SYNERINTERNATIONALGIE','APICIL','GROUPE','IT SERVICES',
        'SYSTEMES ET TELECOMMUNICATIONS','DISNEY','ANTARGAZ','INTERNATIONAL','WIRING SYSTEMS','SOCIETE GENERALE',
        'LP GROUPE','LDLC FINANCE','PROFESSION SANTE','NIIT IRELAND','ALLIANZ','ALSO FRANCE','ENGIE','VINCI',
        'CASTORAMA','VENATHEC','MOODY','DISTRIBUTION','AIA INGENIERIE','SOLIDARITES ET SANTE','ELOGEN',
        'CAMCA MUTUELLE','LISEA','STE CCAS',
        'ORSYS','ARCELORMITTAL','SAINT-GOBAIN','SELARL','ASSURANCES','BUROK TECH','WORLDLINE FRANCE',
        'ARS HAUTS DE FRANCE','GIVENCHY','USSEL','SMART','CONSULTING','CORETAB','MISTERTEMP','SMILE','AXYLIS',
        'ARAQIM','CONECS','G3 SERVICE','INRAE','SIDEV','MALTA','LUMINESS','ASSISTANCE','LIVESTORM',
        'OLYMPIQUE LYONNAIS','YZICO','ICON FRANCE','CANDEX','XELIANS','AVITUM','MACIF','PERNOD RICARD',
        'CNMSS','LEAKMITED','ACCENTURE','AVANADE','DCM 075','ICAPE','PASS CULTURE','SYSTEMGIE','MNH1',
        'FORMIRIS','SPARKS',
    ];

    const B2C_PSP = ['ALMA','GOCARDLESS','STRIPE'];

    const AUTRES_REV_KEYS = ['CPAM','AIDE','SUBVENTION'];

    // Décaissements
    const INTERCO_DEC_KEYS = [
        'TRESO','TRESORERIE','AFORSSIC','FORSSIC','VIREMENT COMPENSE','DST GERMANY','ALIMENTATION SPENDESK',
        'DEBIT MENSUEL CARTE BLEUE','APPRO SPDSK','APPRO PENNY','TRESORERIE','REGUL','REGULARISATION',
        'TRESORERIE','REGULARISATION','AMERICAN EXPRESS CARTE','AMERICAN EXPRESS CARTE-FRANCE',
    ];

    const BANQUES_DETTES_KEYS = [
        'FRAIS VIREMENT',"FRAIS AVIS D'OPERE",'DOMICILIATION INCOMPLETE','DONT HORS TAXE','COMMISSION',
        'COMMISSIONS','PRET','INTERETS','INTERET','BPIFRANCE FINANCEMENT','TRANSACTION CARTE',
        'FRAIS DE CHANGE','CARD TRANSACTION IN FOREIGN CURRENCY','COTISATION MULTIPRO','ECART RAPPRO',
        'BPIFRANCE','CHEQUE IMPAYE','COTISATION','FRAIS','INTERETS','SWAN - TRANSACTION',
    ];

    const FGS_KEYS = [
        'ORANGE','FREE','AMAZON PAYMENTS','LA POSTE','ENDESA ENERGIA','EDF','ENGIE','GRDF','AMAZON EU SARL','AMZN',
        'NESPRESSO','CULLIGAN','KAWA','ARVAL SERVICE LEASE','CREDIPAR','MAILEVA','GSF.PROPRETE','GSF GRANDE ARCHE',
        'CIAMT','CAR WASH','VINCI','ELF','ALIEXPRESS','ALIMENTATION','ALLENBY','ALLISON PNEUS','AMAZON PRIME',
        'AMAZON.FR*','AUTOROUTE','AUCHAN','BNP PARIBAS LEASE','CARREFOUR','CHRONOPOST','COFIROUTE','COPY TOP',
        'E.LECLERC','EASY CHARGE','ESSO','FNAC','FORF P.STAT','FRANPRIX','GARAGE','MAXSOCIETE','IKEA','INDIGO',
        'LEBONCOIN','LETTRE24','EVCHARGE','OBJETRAMA','RAKUTEN','ROXY COPY','ROX COPY','SAPN','AMENDE','SACEF',
        'CRECHE','LE VERGER DE GALLY','SNP*MLG EVENTS','CARROSSERIE','AUTOMOBILES','VISTAPRINT','IMPRIMERIE',
    ];

    const NOTES_FRAIS_KEYS = [
        'SNCF-VOYAGEURS','HOTEL','AIRBNB','UBER','NOTES DE FRAIS','RESTAURANT','RESTAURANTS','TRANSPORT',
        'DELIVEROO','DAILY DEFENSE','IBIS','TOUR I','SERVICE NAVIGO','YBRY KASH','LIORIM','MAIRIE DE PARIS',
        'LE BAZAR','W.A.X','SUPERMARCHE','TAXI','POLLY MAGGO','FONDUE ZHANGGE','1ERE CLASSE','API RESTAURATION',
        'AFILAL LARBI','API 01161','ASTERIX','ASIATI K','ATELIERNIEL','AU DELICE','AYEL','BABAIT','BASSAR',
        'BBV-MEATPACKING','BEKEF','BELIB','BENSON KFE','BILLY','BIOBURGER','BOMB SQUAD','BOOKING.COM',
        'BOUCHERIE','BOULANGERIE','BP DAC','BP PUTEAUX','BURGER KING','CAFE HOCHE','BUDDIE','CANOE','RESTO',
        'CHARLES PATISSI','CERTAS','CHEZ INOUN','CHEZ FRANCK','CHOCOLAT','INTERFLORA','COMMANDE','SUSHI',
        'CTOIR PRINCIPAL','CT PAY','COUT ESPLANADE','DAMYEL','DAV AND JO','DECATHLON','DELICES D\'ASNIE',
        'DELMAMA','DIFFORT','DIVAN DU MONDE','DORON NIEL','DORON SPONTINI','DS CAFE DEFENSE','EL AL','ENVATO',
        'EUROPCAR','VEVOR','FRAISE D AMOUR','FUNBOOKER','GETAROUND','GRAMI','GRILL BAR','HC MONTEVIDEO',
        'RESTAURATIO','HYPER BOULOGNE','IL CONTE','IOSSA','JACOB MEATPACKE','JEFF DE BRUGES','JEYM',
        'JETBRAINS','KAHN FAMOUS DEL','KANTEEN','KAVOD','KEOLIS LYON','KING DAVID','KOOKIE PARIS','L ABREUVOIR',
        'L ATELIER DELI','L&L GEORGES','LA BELLE EPOQUE','LA CABANE','LA CREME DES','LA GARGAMELLE','LA RECREE',
        'LA VILLA K','L\'AS DU FALLAFE','LE DUPLEX','LE GAY LUSSAC','LE JULYANN','LE SAFRANE','LE STUDIO','LE XXV',
        'LE YAD','LES DELICES','LES GARCONS','LES ZOUZOUS','LEVAPARC','CAFFE','LIOR','LIVIO','LS MOMENTO',
        'LW-BILLETWEB','MAISON','MARCEAU RIVE','SANDWICH','MONDIAL RELAY','MOSES DELI','MSFT *','NYX*CASCADE',
        'NACHOS','OCTOPUSMIND','PIZZA','PAIN','OTTER*','P COMME PAPILLE','PAPA','VOYAGES','PARIS DEFENSE',
        'PAVILLON DU LAC','PHCIE','PHOTOMATON','POINCARE DISTRI','PICTO','PUB SAINT JOHN\'S','RATP','QPLD','RIMONE',
        'RODCHENKO','RNG26','ROSETTA','SABA','SARL DAV','SARL MAISON','MISTER GARDE','SENDINBLUE','SNCF',
        'STAT AVIA','STATPBPHONEVILL','SUMUP','TAMIN','TOTAL','UBR*','ZETTLE',
    ];

    const PREVOYANCE_KEYS = ['ABEILLE VIE','MALAKOFF HUMANIS','HENNER','AXA','ALLIANZ','GSA ASSURANCES','HUMANIS PREVOYANCE'];

    const SAAS_IT_KEYS = [
        'GOOGLE SERVICES','GSUITE','MICROSOFT','IONOS','AMAZON WEB SERVICES','NOTION LABS','ADOBE','OPENAI',
        'SNOWFLAKE','STAPE','STREAMYARD','FACTORIALHR','SUPERPROF','YOAST','WELCOME TO THE JUNGLE','CAPCUT',
        'SMSFACTOR','SEMRUSH','TRYHACKME','BALSAMIQ','CALENDLY','SERPAPI','CLAUDE.AI','PADDLE.NET','ARTIFEX',
        'TYPEFORM','MAKE.COM','RINGOVER','IMAGIFY','CRAZY EGG.COM','WIFIRST','APPLE.COM','UDEMY','INOREADER',
        'SCALEWAY','ZOOM','ABONNEMENT KASP','ADA4MONTH','AGICAP','ZAPIER','ASANA','ARTICULATE GLOBAL',
        'ATLASSIAN','AWS EMEA','BACK MARKET','MONDAY.COM','BOTPRESS.COM','BOONDMANAGER','BOTSPACE','CANVA',
        'CLASSMARKER','DARTY','DELL','DIGIREACH SOLUTIONS','GODADDY','DOCUSIGN','FISIO','FIVERR','FORMCRAFTS',
        'GITHUB','GOCARDLESS','GOOGLE CLOUD','ZOHO-INVOICE','HEYGEN TECHNOLOGY INC.','HUAWEI','HUBSPOT','KAHOOT!',
        'LEMLIST','LIVESTORM','MEETUP','METRICOOL.COM','MIDJOURNEY','OVH','PANDADOC','STRIPE','SAMSUNG',
        'SALESFORCE','SKILLABLE','SLACK','SURVICATE','SURVEYMONKEY','GOOGLE*CLOUD','LINKTREE','EDUSIGN','DATADOG',
        'YAMM','ONLINEFORMAPRO',
    ];

    const MKT_ACQ_KEYS = [
        'GOOGLE IRELAND','TIKTOK','CRITEO','LINKEDIN','META','FACEBOOK','INDEED','REDDIT','FACEBK',
        'LINKODY','GOOGLE *ADS','ADWORDS',
    ];

    const URSSAF_KEYS = ['URSSAF'];

    const PA_ACAD_KEYS = ['SORBONNE','MINES','PEARSON','GILMORE','EDITIONS ENI','BUREAU.VERITAS','UNIVERSITE','XVOUCHER'];

    const FF_GEN_KEYS = ['CONSEIL','CONSULTING','CABINET','COURTAGE'];

    const FF_SPECIFIC_KEYS = [
        'REEL ECH','SECHE ARTHUR','SLOAN','IT TRAININGS','AFRICAN DEVELOPMENT ENGINEERING','FCIT NEW GENERATION',
        'SECOPS GUARD SOLUTIONS','IT TRAININGS ETS','ICPF ECH','AGENCE KEACREA','NATHANIEL COHN','ATHLAN STEPHANIE',
        'RAMISARIJAONA','BE API','MEDIATION SOLUTION','PALOOMA','NGUETI MANFO','GHISLAINE BEN CHEMOUL',
        'ELBAZ RAPHAEL','MEVENGUE BERNARD',
    ];

    const REMBOURSEMENT_KEYS = ['RMBT','REMB','REMBOURSEMENT','RMB'];

    const SALAIRES_HINTS = ['INDEMN. KM.','INDEMNIT','SALAIRE'];
    const SALAIRES_REGEX_PID5 = /VIR\s*SEPA\s*EMIS\b.*?\/PID[:\s-]*\d{5}\b/i;

    const LOYERS_KEYS = ['SVENSKASAGAX','ESSET','KEY SENSE'];

    const AUTRES_IMPOTS_KEYS = ['CVAE','TAXE FONCIERE','CFE'];

    const FF_REGEX_PENNYLANE = /\bPENNYLANE-[A-Z0-9]+\b/;
    const FF_REGEX_PID_PENNYLANE = /\bPID\s+PENNYLANE\b/;

    // ── FILIZ special case ──
    function isFilizB2B(tiersNorm, libNorm) {
        return tiersNorm.includes('FILIZ') && !containsAnyDual(libNorm, OPCO_KEYS);
    }

    // ── Encaissements categorization ──
    function categoriseEnc(libNorm, tiersNorm) {
        const both = libNorm + ' || ' + tiersNorm;
        if (containsAnyDual(both, INTERCO_ENC_KEYS)) return ['Interco', 'Enc: Interco'];
        if (containsAnyDual(libNorm, OPCO_KEYS)) return ['Alternance (OPCO)', 'Enc: OPCO'];
        if (containsAnyDual(libNorm, CPF_KEYS)) return ['CPF', 'Enc: CPF'];
        if (containsAnyDual(libNorm, RECONV_KEYS)) return ['Reconversion', 'Enc: Reconversion'];
        if (containsAnyDual(both, B2B_EXTRA) || isFilizB2B(tiersNorm, libNorm)) return ['B2B', 'Enc: B2B'];
        if (containsAnyDual(libNorm, B2C_PSP) || looksLikePerson(libNorm) || looksLikePerson(tiersNorm)) return ['B2C', 'Enc: B2C'];
        if (containsAnyDual(libNorm, AUTRES_REV_KEYS)) return ['Autres revenus', 'Enc: Autres revenus'];
        return ['Autres revenus', 'Enc: Fallback'];
    }

    // ── Décaissements categorization ──
    function categoriseDec(libNorm) {
        if (containsAnyDual(libNorm, INTERCO_DEC_KEYS)) return ['Interco', 'Dec: Interco'];
        if (containsAnyDual(libNorm, BANQUES_DETTES_KEYS)) return ['Banques/Dettes', 'Dec: Banques/Dettes'];
        if (libNorm.includes('DGFIP') && (libNorm.includes('TS-') || libNorm.includes('TS1-')))
            return ['Taxe sur les salaires', 'Dec: DGFIP TS/TS1'];
        if (libNorm.includes('DGFIP') && libNorm.includes('PASDSN'))
            return ['Prélèvement à la source (PAS)', 'Dec: PAS'];
        if (containsAnyDual(libNorm, FGS_KEYS)) return ['Frais généraux & services', 'Dec: FGS'];
        if (containsAnyDual(libNorm, NOTES_FRAIS_KEYS)) return ['Note de frais', 'Dec: Note de frais'];
        if (containsAnyDual(libNorm, PREVOYANCE_KEYS)) return ['Prévoyance / Mutuelle', 'Dec: Prevoyance/Mutuelle'];
        if (libNorm.includes('PLUXEE')) return ['Ticket restaurant', 'Dec: Ticket restaurant'];
        if (containsAnyDual(libNorm, SAAS_IT_KEYS)) return ['SaaS/IT', 'Dec: SaaS/IT'];
        if (containsAnyDual(libNorm, MKT_ACQ_KEYS)) return ['Marketing & Acquisition', 'Dec: Marketing/Acquisition'];
        if (containsAnyDual(libNorm, URSSAF_KEYS)) return ['URSSAF', 'Dec: URSSAF'];
        if (containsAnyDual(libNorm, PA_ACAD_KEYS)) return ['Partenariat académique', 'Dec: Partenariat academique'];
        if (containsAnyDual(libNorm, FF_GEN_KEYS) || containsAnyDual(libNorm, FF_SPECIFIC_KEYS) ||
            FF_REGEX_PENNYLANE.test(libNorm) || FF_REGEX_PID_PENNYLANE.test(libNorm))
            return ['Formateurs / Freelances', 'Dec: Formateurs/Freelances'];
        if (containsAnyDual(libNorm, REMBOURSEMENT_KEYS)) return ['Remboursement', 'Dec: Remboursement'];
        if (containsAnyDual(libNorm, SALAIRES_HINTS) || SALAIRES_REGEX_PID5.test(libNorm))
            return ['Salaires', 'Dec: Salaires'];
        if (containsAnyDual(libNorm, LOYERS_KEYS)) return ['Loyers & charges', 'Dec: Loyers & charges'];
        if (containsAnyDual(libNorm, AUTRES_IMPOTS_KEYS)) return ['Autres impôts', 'Dec: Autres impots'];
        return ['DIVERS', 'Dec: Fallback'];
    }

    // ── Main categorization pipeline ──
    function categorizeAll(data) {
        // Step 1: baseline categorization
        data.forEach(row => {
            const libNorm = normUpper(row.libelle);
            const tiersNorm = normUpper(row.tiers);
            row._libNorm = libNorm;
            row._tiersNorm = tiersNorm;
            row.sens = row.montant > 0 ? 'Encaissement' : (row.montant < 0 ? 'Décaissement' : 'Neutre');

            if (row.sens === 'Encaissement') {
                const [cat, rule] = categoriseEnc(libNorm, tiersNorm);
                row.categorie = cat;
                row.ruleHit = rule;
            } else if (row.sens === 'Décaissement') {
                const [cat, rule] = categoriseDec(libNorm);
                row.categorie = cat;
                row.ruleHit = rule;
            } else {
                row.categorie = 'Neutre';
                row.ruleHit = 'Neutre';
            }
        });

        // Step 2: Anti-regression — formes juridiques → B2B (enc only, sauf GOCARDLESS SAS)
        const formsRe = /\b(SAS|SARL|EURL|SA)\b/;
        const excRe = /GOCARDLESS\s+SAS/;
        data.forEach(row => {
            if (row.sens === 'Encaissement' && formsRe.test(row._libNorm) && !excRe.test(row._libNorm)) {
                row.categorie = 'B2B';
                row.ruleHit = 'Enc: Anti-reg formes juridiques';
            }
        });

        // Step 3: Post-fix rules
        const PRIORITY_CATS = new Set(['Interco', 'Alternance (OPCO)', 'CPF', 'Reconversion']);

        data.forEach(row => {
            // Interco prioritaire si "TRESO" dans libellé
            if (row._libNorm.includes('TRESO')) {
                row.categorie = 'Interco';
                row.ruleHit = 'Post-fix: Interco (TRESO in Libelle)';
            }
        });

        data.forEach(row => {
            // B2C si CA CONSUMER FINANCE (enc only)
            if (row.sens === 'Encaissement' && row._libNorm.includes('CA CONSUMER FINANCE')) {
                row.categorie = 'B2C';
                row.ruleHit = 'Post-fix: B2C (CA CONSUMER FINANCE)';
            }
        });

        data.forEach(row => {
            // Marketing & Acquisition si Google/AdWords (dec only)
            if (row.sens === 'Décaissement' &&
                (row._libNorm.includes('GOOGLE IRELAND') || row._libNorm.includes('ADWORDS') || row._libNorm.includes('GOOGLE *ADS'))) {
                row.categorie = 'Marketing & Acquisition';
                row.ruleHit = 'Post-fix: Marketing & Acquisition (Google/AdWords)';
            }
        });

        data.forEach(row => {
            // B2B enc — nouveaux marqueurs (ne pas écraser Interco/OPCO/CPF/Reconversion)
            if (row.sens === 'Encaissement' && !PRIORITY_CATS.has(row.categorie)) {
                const libUp = String(row._libNorm).toUpperCase();
                if (B2B_EXTRA.some(k => libUp.includes(k.toUpperCase()))) {
                    row.categorie = 'B2B';
                    row.ruleHit = 'Post-fix: Enc B2B (client markers v621h)';
                }
            }
        });

        data.forEach(row => {
            // SaaS/IT — ONLINEFORMAPRO
            if (row._libNorm.includes('ONLINEFORMAPRO')) {
                row.categorie = 'SaaS/IT';
                row.ruleHit = 'Post-fix: SaaS/IT (ONLINEFORMAPRO)';
            }
        });

        data.forEach(row => {
            // Formateurs / Freelances — PID PENNYLANE
            if (FF_REGEX_PID_PENNYLANE.test(row._libNorm)) {
                row.categorie = 'Formateurs / Freelances';
                row.ruleHit = 'Post-fix: FF (PID PENNYLANE)';
            }
        });
    }

    // ══════════════════════════════════════════════
    //  COLUMN MAPPING
    // ══════════════════════════════════════════════

    const COL_MAP = {
        date: ['date'],
        mois: ['mois'],
        compte: ['compte bancaire', 'compte', 'bank account'],
        libelle: ['libellé', 'libelle', 'label', 'description'],
        montant: ['montant', 'amount'],
        tiers: ['tiers', 'third party', 'vendor', 'nom du tiers'],
        justifie: ['justifié', 'justifie', 'justified'],
        commentaires: ['commentaires', 'comments'],
        etat: ['état', 'etat', 'status'],
        type: ['type'],
        equipe: ['equipe', 'équipe', 'team'],
        pl_liora: ['p&l liora', 'p&l_liora', 'pl liora', 'pnl liora'],
        pl_omnes: ['p&l omnes', 'p&l_omnes', 'pl omnes', 'pnl omnes'],
        projets: ['projets', 'projects'],
        titulaire: ['titulaire de la carte', 'titulaire', 'card holder'],
        nom_carte: ['nom de la carte', 'nom carte', 'card name'],
    };

    function mapColumns(headers) {
        const mapping = {};
        const lowerHeaders = headers.map((h) => h.trim().toLowerCase());

        for (const [key, aliases] of Object.entries(COL_MAP)) {
            const idx = lowerHeaders.findIndex((h) => aliases.some((a) => h.includes(a)));
            if (idx !== -1) mapping[key] = headers[idx];
        }
        return mapping;
    }

    // ══════════════════════════════════════════════
    //  FILE UPLOAD
    // ══════════════════════════════════════════════

    const uploadZone = $('#upload-zone');
    const fileInput = $('#file-input');

    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) handleFile(fileInput.files[0]);
    });

    function handleFile(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['csv', 'xlsx', 'xls'].includes(ext)) {
            alert('Format non supporté. Veuillez importer un fichier .csv, .xlsx ou .xls');
            return;
        }

        $('#file-name').textContent = file.name;
        $('#file-size').textContent = formatFileSize(file.size);
        $('#file-info').classList.remove('hidden');
        window._selectedFile = file;
    }

    $('#analyze-btn').addEventListener('click', () => {
        if (window._selectedFile) processFile(window._selectedFile);
    });

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' o';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' Ko';
        return (bytes / 1048576).toFixed(1) + ' Mo';
    }

    function showScreen(name) {
        Object.values(screens).forEach((s) => s.classList.remove('active'));
        screens[name].classList.add('active');
    }

    // ══════════════════════════════════════════════
    //  FILE PROCESSING
    // ══════════════════════════════════════════════

    function processFile(file) {
        showScreen('loading');
        const ext = file.name.split('.').pop().toLowerCase();

        if (ext === 'csv') {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                encoding: 'UTF-8',
                complete: (result) => {
                    setTimeout(() => parseAndAnalyze(result.data, result.meta.fields), 500);
                },
                error: () => {
                    alert('Erreur lors de la lecture du fichier CSV.');
                    showScreen('upload');
                },
            });
        } else {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const workbook = XLSX.read(e.target.result, { type: 'array' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                    const headers = json.length > 0 ? Object.keys(json[0]) : [];
                    setTimeout(() => parseAndAnalyze(json, headers), 500);
                } catch {
                    alert('Erreur lors de la lecture du fichier Excel.');
                    showScreen('upload');
                }
            };
            reader.readAsArrayBuffer(file);
        }
    }

    function parseAndAnalyze(data, headers) {
        $('#loader-status').textContent = 'Analyse des données...';

        const colMap = mapColumns(headers);
        rawData = data.map((row) => {
            const montantRaw = row[colMap.montant] || '0';
            const montant = parseFloat(
                String(montantRaw).replace(/\s/g, '').replace(',', '.')
            ) || 0;

            const dateRaw = row[colMap.date] || '';
            const parsedDate = parseDate(dateRaw);

            return {
                date: parsedDate,
                dateStr: formatDate(parsedDate),
                mois: row[colMap.mois] || '',
                compte: row[colMap.compte] || '',
                libelle: row[colMap.libelle] || '',
                montant,
                tiers: row[colMap.tiers] || '',
                justifie: row[colMap.justifie] || '',
                commentaires: row[colMap.commentaires] || '',
                etat: row[colMap.etat] || '',
                type: row[colMap.type] || '',
                equipe: row[colMap.equipe] || '',
                pl_liora: row[colMap.pl_liora] || '',
                pl_omnes: row[colMap.pl_omnes] || '',
                projets: row[colMap.projets] || '',
                titulaire: row[colMap.titulaire] || '',
                nom_carte: row[colMap.nom_carte] || '',
                // Will be filled by categorizeAll
                categorie: '',
                ruleHit: '',
                sens: '',
            };
        });

        // Sort by date
        rawData.sort((a, b) => a.date - b.date);

        // Run categorization engine
        $('#loader-status').textContent = 'Catégorisation des transactions...';
        setTimeout(() => {
            categorizeAll(rawData);
            filteredData = [...rawData];

            $('#loader-status').textContent = 'Génération du tableau de bord...';
            setTimeout(() => {
                buildDashboard();
                showScreen('dashboard');
            }, 400);
        }, 300);
    }

    function parseDate(str) {
        if (!str) return new Date(0);
        const s = String(str).trim();
        const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
        if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
        const ymd = s.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/);
        if (ymd) return new Date(+ymd[1], +ymd[2] - 1, +ymd[3]);
        if (/^\d+$/.test(s)) {
            const num = parseInt(s, 10);
            if (num > 40000 && num < 60000) return new Date((num - 25569) * 86400 * 1000);
        }
        return new Date(s);
    }

    function formatDate(d) {
        if (!d || isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    // ══════════════════════════════════════════════
    //  DASHBOARD BUILDER
    // ══════════════════════════════════════════════

    function buildDashboard() {
        renderKPIs();
        renderFlowChart();
        renderCumulativeChart();
        renderEncCategoriesChart();
        renderDecCategoriesChart();
        renderTopVendorsChart();
        renderTeamsChart();
        populateFilters();
        renderTable();
        renderSummary();
    }

    // ── KPIs ──
    function renderKPIs() {
        const inflows = rawData.filter((r) => r.montant > 0).reduce((s, r) => s + r.montant, 0);
        const outflows = rawData.filter((r) => r.montant < 0).reduce((s, r) => s + r.montant, 0);
        const net = inflows + outflows;

        $('#kpi-inflows').textContent = formatCurrency(inflows);
        $('#kpi-inflows').className = 'kpi-value amount-positive';
        $('#kpi-outflows').textContent = formatCurrency(outflows);
        $('#kpi-outflows').className = 'kpi-value amount-negative';
        $('#kpi-net').textContent = formatCurrency(net);
        $('#kpi-net').className = 'kpi-value ' + (net >= 0 ? 'amount-positive' : 'amount-negative');
        $('#kpi-count').textContent = rawData.length.toLocaleString('fr-FR');

        const dates = rawData.map((r) => r.date).filter((d) => d && !isNaN(d.getTime()));
        if (dates.length > 0) {
            const minDate = new Date(Math.min(...dates));
            const maxDate = new Date(Math.max(...dates));
            $('#period-badge').textContent =
                minDate.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) +
                ' → ' +
                maxDate.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
        }
    }

    function formatCurrency(val) {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(val);
    }

    // ── Chart Defaults ──
    const chartColors = {
        purple: '#8b5cf6',
        blue: '#3b82f6',
        green: '#10b981',
        red: '#ef4444',
        amber: '#f59e0b',
        cyan: '#06b6d4',
        pink: '#ec4899',
        indigo: '#6366f1',
        teal: '#14b8a6',
        orange: '#f97316',
        lime: '#84cc16',
        rose: '#f43f5e',
        sky: '#38bdf8',
        fuchsia: '#d946ef',
        emerald: '#34d399',
        yellow: '#eab308',
    };
    const paletteArray = Object.values(chartColors);

    function getChartDefaults() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#a5a0b8',
                        font: { family: 'Inter', size: 12 },
                        padding: 16,
                    },
                },
                tooltip: {
                    backgroundColor: 'rgba(26, 20, 40, 0.95)',
                    titleColor: '#f1f0f5',
                    bodyColor: '#a5a0b8',
                    borderColor: 'rgba(139, 92, 246, 0.2)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    titleFont: { family: 'Inter', weight: '600' },
                    bodyFont: { family: 'Inter' },
                    callbacks: {
                        label: (ctx) => {
                            const val = ctx.parsed.y ?? ctx.parsed;
                            return ctx.dataset.label + ': ' + formatCurrency(val);
                        },
                    },
                },
            },
            scales: {
                x: {
                    ticks: { color: '#6b6580', font: { family: 'Inter', size: 11 } },
                    grid: { color: 'rgba(139, 92, 246, 0.06)' },
                },
                y: {
                    ticks: {
                        color: '#6b6580',
                        font: { family: 'Inter', size: 11 },
                        callback: (v) => formatCurrency(v),
                    },
                    grid: { color: 'rgba(139, 92, 246, 0.06)' },
                },
            },
        };
    }

    function getDoughnutOptions(position) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '55%',
            plugins: {
                legend: {
                    position: position || 'right',
                    labels: {
                        color: '#a5a0b8',
                        font: { family: 'Inter', size: 11 },
                        padding: 10,
                        boxWidth: 12,
                        boxHeight: 12,
                        borderRadius: 3,
                    },
                },
                tooltip: {
                    backgroundColor: 'rgba(26, 20, 40, 0.95)',
                    titleColor: '#f1f0f5',
                    bodyColor: '#a5a0b8',
                    borderColor: 'rgba(139, 92, 246, 0.2)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    callbacks: {
                        label: (ctx) => {
                            const total = ctx.dataset.data.reduce((s, v) => s + v, 0);
                            const pct = ((ctx.parsed / total) * 100).toFixed(1);
                            return ctx.label + ': ' + formatCurrency(ctx.parsed) + ' (' + pct + '%)';
                        },
                    },
                },
            },
        };
    }

    function destroyChart(key) {
        if (charts[key]) {
            charts[key].destroy();
            charts[key] = null;
        }
    }

    // ── Aggregate by Month ──
    function aggregateByMonth() {
        const months = {};
        rawData.forEach((r) => {
            if (!r.date || isNaN(r.date.getTime())) return;
            const key = r.date.getFullYear() + '-' + String(r.date.getMonth() + 1).padStart(2, '0');
            if (!months[key]) months[key] = { inflows: 0, outflows: 0 };
            if (r.montant > 0) months[key].inflows += r.montant;
            else months[key].outflows += r.montant;
        });
        const keys = Object.keys(months).sort();
        return {
            labels: keys.map((k) => {
                const [y, m] = k.split('-');
                return new Date(+y, +m - 1).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
            }),
            inflows: keys.map((k) => months[k].inflows),
            outflows: keys.map((k) => Math.abs(months[k].outflows)),
            net: keys.map((k) => months[k].inflows + months[k].outflows),
        };
    }

    // ── Flow Chart (Bar) ──
    function renderFlowChart() {
        const data = aggregateByMonth();
        destroyChart('flow');
        const ctx = $('#chart-flow').getContext('2d');
        const defaults = getChartDefaults();

        charts.flow = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        label: 'Encaissements',
                        data: data.inflows,
                        backgroundColor: 'rgba(16, 185, 129, 0.7)',
                        borderColor: '#10b981',
                        borderWidth: 1,
                        borderRadius: 4,
                    },
                    {
                        label: 'Décaissements',
                        data: data.outflows,
                        backgroundColor: 'rgba(239, 68, 68, 0.7)',
                        borderColor: '#ef4444',
                        borderWidth: 1,
                        borderRadius: 4,
                    },
                    {
                        label: 'Solde net',
                        data: data.net,
                        type: 'line',
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        borderWidth: 2,
                        pointRadius: 4,
                        pointBackgroundColor: '#8b5cf6',
                        tension: 0.3,
                        fill: true,
                    },
                ],
            },
            options: {
                ...defaults,
                interaction: { intersect: false, mode: 'index' },
                plugins: {
                    ...defaults.plugins,
                    tooltip: {
                        ...defaults.plugins.tooltip,
                        callbacks: {
                            label: (ctx) => {
                                const val = ctx.parsed.y;
                                const prefix = ctx.datasetIndex === 1 ? '-' : '';
                                return ctx.dataset.label + ': ' + prefix + formatCurrency(Math.abs(val));
                            },
                        },
                    },
                },
            },
        });
    }

    // ── Cumulative Chart ──
    function renderCumulativeChart() {
        const data = aggregateByMonth();
        destroyChart('cumulative');
        let cumulative = 0;
        const cumData = data.net.map((v) => { cumulative += v; return cumulative; });
        const ctx = $('#chart-cumulative').getContext('2d');
        const defaults = getChartDefaults();
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(139, 92, 246, 0.25)');
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');

        charts.cumulative = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Solde cumulé',
                    data: cumData,
                    borderColor: '#8b5cf6',
                    backgroundColor: gradient,
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#8b5cf6',
                    pointBorderColor: '#1a1428',
                    pointBorderWidth: 2,
                }],
            },
            options: defaults,
        });
    }

    // ── Encaissements by category (doughnut) ──
    function aggregateByCategorie(sens) {
        const cats = {};
        rawData.filter(r => r.sens === sens).forEach(r => {
            const cat = r.categorie || 'Non catégorisé';
            if (!cats[cat]) cats[cat] = 0;
            cats[cat] += Math.abs(r.montant);
        });
        const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
        return {
            labels: sorted.map(([k]) => k),
            values: sorted.map(([, v]) => v),
        };
    }

    function renderEncCategoriesChart() {
        const data = aggregateByCategorie('Encaissement');
        destroyChart('encCategories');
        const ctx = $('#chart-enc-categories').getContext('2d');

        charts.encCategories = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.values,
                    backgroundColor: paletteArray.slice(0, data.labels.length),
                    borderColor: '#1a1428',
                    borderWidth: 2,
                    hoverOffset: 6,
                }],
            },
            options: getDoughnutOptions('right'),
        });
    }

    function renderDecCategoriesChart() {
        const data = aggregateByCategorie('Décaissement');
        destroyChart('decCategories');
        const ctx = $('#chart-dec-categories').getContext('2d');

        charts.decCategories = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.values,
                    backgroundColor: paletteArray.slice(0, data.labels.length),
                    borderColor: '#1a1428',
                    borderWidth: 2,
                    hoverOffset: 6,
                }],
            },
            options: getDoughnutOptions('right'),
        });
    }

    // ── Top Vendors (by category now) ──
    function renderTopVendorsChart() {
        const cats = {};
        rawData.forEach(r => {
            const cat = r.categorie || 'Non catégorisé';
            if (!cats[cat]) cats[cat] = { in: 0, out: 0 };
            if (r.montant > 0) cats[cat].in += r.montant;
            else cats[cat].out += Math.abs(r.montant);
        });

        const sorted = Object.entries(cats)
            .map(([name, v]) => ({ name, total: v.in + v.out, in: v.in, out: v.out }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 12);

        destroyChart('topVendors');
        const ctx = $('#chart-top-vendors').getContext('2d');
        const defaults = getChartDefaults();

        charts.topVendors = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sorted.map((v) => v.name),
                datasets: [
                    {
                        label: 'Encaissements',
                        data: sorted.map((v) => v.in),
                        backgroundColor: 'rgba(16, 185, 129, 0.7)',
                        borderRadius: 4,
                    },
                    {
                        label: 'Décaissements',
                        data: sorted.map((v) => v.out),
                        backgroundColor: 'rgba(239, 68, 68, 0.7)',
                        borderRadius: 4,
                    },
                ],
            },
            options: {
                ...defaults,
                indexAxis: 'y',
                scales: {
                    ...defaults.scales,
                    x: {
                        ...defaults.scales.x,
                        ticks: { ...defaults.scales.x.ticks, callback: (v) => formatCurrency(v) },
                    },
                    y: {
                        ...defaults.scales.y,
                        ticks: { color: '#a5a0b8', font: { family: 'Inter', size: 11 } },
                        grid: { display: false },
                    },
                },
            },
        });
    }

    // ── Teams Chart ──
    function renderTeamsChart() {
        const teams = {};
        rawData.forEach((r) => {
            const team = r.equipe && r.equipe.trim() ? r.equipe.trim() : 'Non attribué';
            if (!teams[team]) teams[team] = 0;
            teams[team] += Math.abs(r.montant);
        });

        const sorted = Object.entries(teams).sort((a, b) => b[1] - a[1]);
        destroyChart('teams');
        const ctx = $('#chart-teams').getContext('2d');

        charts.teams = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: sorted.map(([k]) => k),
                datasets: [{
                    data: sorted.map(([, v]) => v),
                    backgroundColor: paletteArray.slice(0, sorted.length),
                    borderColor: '#1a1428',
                    borderWidth: 2,
                }],
            },
            options: getDoughnutOptions('right'),
        });
    }

    // ══════════════════════════════════════════════
    //  TABLE
    // ══════════════════════════════════════════════

    function populateFilters() {
        const types = new Set(rawData.map((r) => r.type).filter(Boolean));
        const teams = new Set(rawData.map((r) => r.equipe).filter(Boolean));
        const categories = new Set(rawData.map((r) => r.categorie).filter(Boolean));

        const typeSelect = $('#filter-type');
        typeSelect.innerHTML = '<option value="">Tous les types</option>';
        types.forEach((t) => {
            typeSelect.innerHTML += `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`;
        });

        const teamSelect = $('#filter-team');
        teamSelect.innerHTML = '<option value="">Toutes les équipes</option>';
        teams.forEach((t) => {
            teamSelect.innerHTML += `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`;
        });

        const catSelect = $('#filter-categorie');
        catSelect.innerHTML = '<option value="">Toutes les catégories</option>';
        [...categories].sort().forEach((c) => {
            catSelect.innerHTML += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
        });

        typeSelect.addEventListener('change', applyFilters);
        teamSelect.addEventListener('change', applyFilters);
        catSelect.addEventListener('change', applyFilters);
        $('#search-input').addEventListener('input', debounce(applyFilters, 300));
    }

    function applyFilters() {
        const search = $('#search-input').value.toLowerCase();
        const typeFilter = $('#filter-type').value;
        const teamFilter = $('#filter-team').value;
        const catFilter = $('#filter-categorie').value;

        filteredData = rawData.filter((r) => {
            if (typeFilter && r.type !== typeFilter) return false;
            if (teamFilter && r.equipe !== teamFilter) return false;
            if (catFilter && r.categorie !== catFilter) return false;
            if (search) {
                const searchable = [r.libelle, r.tiers, r.nom_carte, r.titulaire, r.equipe, r.type, r.categorie]
                    .join(' ').toLowerCase();
                if (!searchable.includes(search)) return false;
            }
            return true;
        });

        currentPage = 1;
        renderTable();
    }

    function renderTable() {
        const tbody = $('#table-body');
        const start = (currentPage - 1) * PAGE_SIZE;
        const pageData = filteredData.slice(start, start + PAGE_SIZE);

        tbody.innerHTML = pageData
            .map(
                (r) => `
            <tr>
                <td>${escapeHtml(r.dateStr)}</td>
                <td title="${escapeHtml(r.libelle)}">${escapeHtml(truncate(r.libelle, 45))}</td>
                <td>${escapeHtml(r.tiers || '—')}</td>
                <td class="text-right ${r.montant >= 0 ? 'amount-positive' : 'amount-negative'}">
                    ${formatCurrency(r.montant)}
                </td>
                <td><span class="tag ${getCatTagClass(r.categorie)}" title="${escapeHtml(r.ruleHit)}">${escapeHtml(r.categorie || '—')}</span></td>
                <td><span class="tag tag-sens-${r.montant >= 0 ? 'enc' : 'dec'}">${r.montant >= 0 ? 'Enc' : 'Déc'}</span></td>
                <td>${escapeHtml(r.equipe || '—')}</td>
                <td>${escapeHtml(r.titulaire || '—')}</td>
            </tr>`
            )
            .join('');

        renderPagination();
    }

    function renderPagination() {
        const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
        const container = $('#pagination');
        if (totalPages <= 1) { container.innerHTML = ''; return; }

        let html = '';
        const maxVisible = 7;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

        if (currentPage > 1) html += `<button class="page-btn" data-page="${currentPage - 1}">&laquo;</button>`;
        for (let i = startPage; i <= endPage; i++)
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        if (currentPage < totalPages) html += `<button class="page-btn" data-page="${currentPage + 1}">&raquo;</button>`;

        container.innerHTML = html;
        container.querySelectorAll('.page-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                currentPage = parseInt(btn.dataset.page, 10);
                renderTable();
                document.querySelector('.table-wrapper').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
        });
    }

    // Category tag color mapping
    const CAT_COLOR_MAP = {
        'B2B': 'tag-b2b', 'B2C': 'tag-b2c', 'Interco': 'tag-interco',
        'Alternance (OPCO)': 'tag-opco', 'CPF': 'tag-cpf', 'Reconversion': 'tag-reconv',
        'Salaires': 'tag-salaires', 'URSSAF': 'tag-urssaf',
        'SaaS/IT': 'tag-saas', 'Marketing & Acquisition': 'tag-mkt',
        'Formateurs / Freelances': 'tag-ff',
        'Frais généraux & services': 'tag-fgs', 'Note de frais': 'tag-ndf',
        'Banques/Dettes': 'tag-banques', 'Autres revenus': 'tag-autres-rev',
        'DIVERS': 'tag-divers',
    };

    function getCatTagClass(cat) {
        return CAT_COLOR_MAP[cat] || 'tag-default';
    }

    // ══════════════════════════════════════════════
    //  SUMMARY
    // ══════════════════════════════════════════════

    function renderSummary() {
        // Top expense categories
        const expensesByCat = {};
        rawData.filter((r) => r.montant < 0).forEach((r) => {
            const cat = r.categorie || 'Non catégorisé';
            expensesByCat[cat] = (expensesByCat[cat] || 0) + Math.abs(r.montant);
        });
        const topExpenses = Object.entries(expensesByCat).sort((a, b) => b[1] - a[1]).slice(0, 8);

        $('#summary-expenses').innerHTML = topExpenses
            .map(([name, val]) =>
                `<div class="summary-item">
                    <span class="summary-item-label">${escapeHtml(name)}</span>
                    <span class="summary-item-value amount-negative">${formatCurrency(-val)}</span>
                </div>`
            ).join('');

        // Top income categories
        const incomeByCat = {};
        rawData.filter((r) => r.montant > 0).forEach((r) => {
            const cat = r.categorie || 'Non catégorisé';
            incomeByCat[cat] = (incomeByCat[cat] || 0) + r.montant;
        });
        const topIncome = Object.entries(incomeByCat).sort((a, b) => b[1] - a[1]).slice(0, 8);

        $('#summary-income').innerHTML = topIncome
            .map(([name, val]) =>
                `<div class="summary-item">
                    <span class="summary-item-label">${escapeHtml(name)}</span>
                    <span class="summary-item-value amount-positive">${formatCurrency(val)}</span>
                </div>`
            ).join('');

        renderAlerts();
    }

    function renderAlerts() {
        const alerts = [];
        const totalIn = rawData.filter((r) => r.montant > 0).reduce((s, r) => s + r.montant, 0);
        const totalOut = Math.abs(rawData.filter((r) => r.montant < 0).reduce((s, r) => s + r.montant, 0));
        const net = totalIn - totalOut;

        if (net < 0) {
            alerts.push({ type: 'warning', text: `Solde net négatif (${formatCurrency(-Math.abs(net))}). Les décaissements dépassent les encaissements.` });
        } else {
            alerts.push({ type: 'success', text: `Solde net positif (${formatCurrency(net)}). Les encaissements couvrent les décaissements.` });
        }

        // Largest transaction
        const sorted = [...rawData].sort((a, b) => Math.abs(b.montant) - Math.abs(a.montant));
        if (sorted[0]) {
            alerts.push({ type: 'info', text: `Transaction max : ${formatCurrency(sorted[0].montant)} — ${sorted[0].libelle.substring(0, 60)}` });
        }

        // Unjustified
        const unjustified = rawData.filter((r) => r.justifie && r.justifie.toLowerCase() === 'non');
        if (unjustified.length > 0) {
            const tot = unjustified.reduce((s, r) => s + Math.abs(r.montant), 0);
            alerts.push({ type: 'warning', text: `${unjustified.length} transaction(s) non justifiée(s) pour ${formatCurrency(tot)}.` });
        }

        // Concentration risk (by category)
        const topExpCat = Object.entries(
            rawData.filter(r => r.montant < 0).reduce((acc, r) => {
                const cat = r.categorie || 'DIVERS';
                acc[cat] = (acc[cat] || 0) + Math.abs(r.montant);
                return acc;
            }, {})
        ).sort((a, b) => b[1] - a[1])[0];

        if (topExpCat && totalOut > 0) {
            const pct = ((topExpCat[1] / totalOut) * 100).toFixed(1);
            if (pct > 30) {
                alerts.push({ type: 'warning', text: `Concentration : « ${topExpCat[0]} » = ${pct}% des décaissements.` });
            }
        }

        // Interco volume
        const intercoTotal = rawData.filter(r => r.categorie === 'Interco').reduce((s, r) => s + Math.abs(r.montant), 0);
        if (intercoTotal > 0) {
            alerts.push({ type: 'info', text: `Flux Interco détectés pour un volume de ${formatCurrency(intercoTotal)}.` });
        }

        // SEPA debits
        const sepa = rawData.filter(r => normUpper(r.libelle).includes('PRLV SEPA'));
        if (sepa.length > 0) {
            const tot = sepa.reduce((s, r) => s + Math.abs(r.montant), 0);
            alerts.push({ type: 'info', text: `${sepa.length} prélèvement(s) SEPA pour ${formatCurrency(tot)}.` });
        }

        // Fallback / DIVERS count
        const diversCount = rawData.filter(r => r.categorie === 'DIVERS' || r.ruleHit.includes('Fallback')).length;
        if (diversCount > 0) {
            alerts.push({ type: 'warning', text: `${diversCount} transaction(s) classée(s) « DIVERS / Fallback » — à vérifier manuellement.` });
        }

        const iconMap = {
            warning: '<svg class="alert-icon alert-warning" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            info: '<svg class="alert-icon alert-info" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
            success: '<svg class="alert-icon alert-success" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        };

        $('#summary-alerts').innerHTML = alerts
            .map((a) => `<div class="alert-item">${iconMap[a.type]}<span>${escapeHtml(a.text)}</span></div>`)
            .join('');
    }

    // ══════════════════════════════════════════════
    //  UTILITIES
    // ══════════════════════════════════════════════

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function truncate(str, len) {
        if (!str) return '';
        return str.length > len ? str.substring(0, len) + '…' : str;
    }

    function debounce(fn, ms) {
        let timer;
        return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
    }

    // ── New File Button ──
    $('#btn-new-file').addEventListener('click', () => {
        rawData = [];
        filteredData = [];
        currentPage = 1;
        Object.keys(charts).forEach(destroyChart);
        fileInput.value = '';
        $('#file-info').classList.add('hidden');
        window._selectedFile = null;
        showScreen('upload');
    });

    // ── Export ──
    $('#btn-export').addEventListener('click', () => { window.print(); });

    // ── Mouse glow ──
    document.addEventListener('mousemove', (e) => {
        document.documentElement.style.setProperty('--mouse-x', e.clientX + 'px');
        document.documentElement.style.setProperty('--mouse-y', e.clientY + 'px');
    });
})();
