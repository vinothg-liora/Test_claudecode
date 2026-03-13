/* ============================
   Liora Cash Flow Analyzer
   Main Application Logic
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

    // ── Column Mapping ──
    // We normalize column names to handle slight variations
    const COL_MAP = {
        date: ['date'],
        mois: ['mois'],
        compte: ['compte bancaire', 'compte', 'bank account'],
        libelle: ['libellé', 'libelle', 'label', 'description'],
        montant: ['montant', 'amount'],
        tiers: ['tiers', 'third party', 'vendor'],
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

    // ── File Upload ──
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

        // Store file for later
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

    // ── File Processing ──
    function processFile(file) {
        showScreen('loading');
        const ext = file.name.split('.').pop().toLowerCase();

        if (ext === 'csv') {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                encoding: 'UTF-8',
                complete: (result) => {
                    setTimeout(() => {
                        parseAndAnalyze(result.data, result.meta.fields);
                    }, 500);
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
                String(montantRaw)
                    .replace(/\s/g, '')
                    .replace(',', '.')
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
            };
        });

        // Sort by date
        rawData.sort((a, b) => a.date - b.date);
        filteredData = [...rawData];

        setTimeout(() => {
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

        // DD/MM/YYYY or D/M/YYYY
        const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
        if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);

        // YYYY-MM-DD
        const ymd = s.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/);
        if (ymd) return new Date(+ymd[1], +ymd[2] - 1, +ymd[3]);

        // Excel numeric date
        if (/^\d+$/.test(s)) {
            const num = parseInt(s, 10);
            if (num > 40000 && num < 60000) {
                return new Date((num - 25569) * 86400 * 1000);
            }
        }

        return new Date(s);
    }

    function formatDate(d) {
        if (!d || isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    // ── Dashboard Builder ──
    function buildDashboard() {
        renderKPIs();
        renderFlowChart();
        renderCumulativeChart();
        renderCategoriesChart();
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

        // Period badge
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
        const cumData = data.net.map((v) => {
            cumulative += v;
            return cumulative;
        });

        const ctx = $('#chart-cumulative').getContext('2d');
        const defaults = getChartDefaults();

        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(139, 92, 246, 0.25)');
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');

        charts.cumulative = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [
                    {
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
                    },
                ],
            },
            options: defaults,
        });
    }

    // ── Categories (Expenses by Tiers/Libellé) ──
    function categorizeExpenses() {
        const categories = {};
        rawData
            .filter((r) => r.montant < 0)
            .forEach((r) => {
                const cat = extractCategory(r);
                if (!categories[cat]) categories[cat] = 0;
                categories[cat] += Math.abs(r.montant);
            });

        const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]);
        const top = sorted.slice(0, 10);
        const otherTotal = sorted.slice(10).reduce((s, [, v]) => s + v, 0);
        if (otherTotal > 0) top.push(['Autres', otherTotal]);

        return {
            labels: top.map(([k]) => k),
            values: top.map(([, v]) => v),
        };
    }

    function extractCategory(row) {
        // Use nom_carte or tiers if available, otherwise parse libellé
        if (row.nom_carte && row.nom_carte.trim()) return row.nom_carte.trim();
        if (row.tiers && row.tiers.trim()) return row.tiers.trim();

        const lib = row.libelle.toUpperCase();

        // Known patterns
        if (lib.includes('GOOGLE')) return 'Google';
        if (lib.includes('AMAZON')) return 'Amazon';
        if (lib.includes('MICROSOFT')) return 'Microsoft';
        if (lib.includes('OPENAI') || lib.includes('CHATGPT')) return 'OpenAI / ChatGPT';
        if (lib.includes('LINKEDIN')) return 'LinkedIn';
        if (lib.includes('SWAN')) return 'SWAN (frais bancaires)';
        if (lib.includes('ADOBE')) return 'Adobe';
        if (lib.includes('SEMRUSH')) return 'Semrush';
        if (lib.includes('SNOWFLAKE')) return 'Snowflake';
        if (lib.includes('ABEILLE VIE')) return 'Abeille Vie (assurance)';
        if (lib.includes('FRANCE TRAVAIL')) return 'France Travail';
        if (lib.includes('STRIPE')) return 'Stripe';
        if (lib.includes('STAPE')) return 'Stape';
        if (lib.includes('MAKE.COM') || lib.includes('MAKE')) return 'Make';
        if (lib.includes('PERPLEXITY')) return 'Perplexity';
        if (lib.includes('INDEED')) return 'Indeed';
        if (lib.includes('LA POSTE')) return 'La Poste';
        if (lib.includes('MISTER GARDEN')) return 'Mister Garden';
        if (lib.includes('GILMORE') || lib.includes('GILMORE')) return 'Gilmore';
        if (lib.includes('WIFIRST')) return 'WiFirst';
        if (lib.includes('IONOS')) return 'IONOS';

        // SEPA transfers
        if (lib.includes('VIR SEPA') || lib.includes('PRLV SEPA')) {
            const match = lib.match(/(?:FRM|FRPM|DE)\s+([A-Z][A-Z\s]+?)(?:\s+\/|\s+IEID|$)/);
            if (match) return match[1].trim();
        }

        // Fallback: first meaningful part
        const words = row.libelle.trim().split(/\s+/).slice(0, 3).join(' ');
        return words || 'Non catégorisé';
    }

    function renderCategoriesChart() {
        const data = categorizeExpenses();
        destroyChart('categories');

        const ctx = $('#chart-categories').getContext('2d');

        charts.categories = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        data: data.values,
                        backgroundColor: paletteArray.slice(0, data.labels.length),
                        borderColor: '#1a1428',
                        borderWidth: 2,
                        hoverOffset: 6,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '55%',
                plugins: {
                    legend: {
                        position: 'right',
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
            },
        });
    }

    // ── Top Vendors ──
    function renderTopVendorsChart() {
        const vendors = {};
        rawData.forEach((r) => {
            const name = extractCategory(r);
            if (!vendors[name]) vendors[name] = { in: 0, out: 0 };
            if (r.montant > 0) vendors[name].in += r.montant;
            else vendors[name].out += Math.abs(r.montant);
        });

        const sorted = Object.entries(vendors)
            .map(([name, v]) => ({ name, total: v.in + v.out, in: v.in, out: v.out }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);

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
                        ticks: {
                            ...defaults.scales.x.ticks,
                            callback: (v) => formatCurrency(v),
                        },
                    },
                    y: {
                        ...defaults.scales.y,
                        ticks: {
                            color: '#a5a0b8',
                            font: { family: 'Inter', size: 11 },
                        },
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
                datasets: [
                    {
                        data: sorted.map(([, v]) => v),
                        backgroundColor: [
                            chartColors.purple,
                            chartColors.blue,
                            chartColors.green,
                            chartColors.amber,
                            chartColors.pink,
                            chartColors.cyan,
                            chartColors.indigo,
                            chartColors.teal,
                        ],
                        borderColor: '#1a1428',
                        borderWidth: 2,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '55%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#a5a0b8',
                            font: { family: 'Inter', size: 11 },
                            padding: 10,
                            boxWidth: 12,
                            boxHeight: 12,
                        },
                    },
                    tooltip: {
                        backgroundColor: 'rgba(26, 20, 40, 0.95)',
                        titleColor: '#f1f0f5',
                        bodyColor: '#a5a0b8',
                        borderColor: 'rgba(139, 92, 246, 0.2)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                            label: (ctx) => {
                                const total = ctx.dataset.data.reduce((s, v) => s + v, 0);
                                const pct = ((ctx.parsed / total) * 100).toFixed(1);
                                return ctx.label + ': ' + formatCurrency(ctx.parsed) + ' (' + pct + '%)';
                            },
                        },
                    },
                },
            },
        });
    }

    // ── Table ──
    function populateFilters() {
        const types = new Set(rawData.map((r) => r.type).filter(Boolean));
        const teams = new Set(rawData.map((r) => r.equipe).filter(Boolean));

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

        typeSelect.addEventListener('change', applyFilters);
        teamSelect.addEventListener('change', applyFilters);
        $('#search-input').addEventListener('input', debounce(applyFilters, 300));
    }

    function applyFilters() {
        const search = $('#search-input').value.toLowerCase();
        const typeFilter = $('#filter-type').value;
        const teamFilter = $('#filter-team').value;

        filteredData = rawData.filter((r) => {
            if (typeFilter && r.type !== typeFilter) return false;
            if (teamFilter && r.equipe !== teamFilter) return false;
            if (search) {
                const searchable = [r.libelle, r.tiers, r.nom_carte, r.titulaire, r.equipe, r.type]
                    .join(' ')
                    .toLowerCase();
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
                <td title="${escapeHtml(r.libelle)}">${escapeHtml(truncate(r.libelle, 50))}</td>
                <td>${escapeHtml(r.tiers || '—')}</td>
                <td class="text-right ${r.montant >= 0 ? 'amount-positive' : 'amount-negative'}">
                    ${formatCurrency(r.montant)}
                </td>
                <td>${r.type ? `<span class="tag ${getTagClass(r.type)}">${escapeHtml(r.type)}</span>` : '—'}</td>
                <td>${escapeHtml(r.equipe || '—')}</td>
                <td>${escapeHtml(r.pl_liora || r.pl_omnes || '—')}</td>
                <td>${escapeHtml(r.titulaire || '—')}</td>
            </tr>`
            )
            .join('');

        renderPagination();
    }

    function renderPagination() {
        const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
        const container = $('#pagination');
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '';
        const maxVisible = 7;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        if (currentPage > 1) {
            html += `<button class="page-btn" data-page="${currentPage - 1}">&laquo;</button>`;
        }
        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        if (currentPage < totalPages) {
            html += `<button class="page-btn" data-page="${currentPage + 1}">&raquo;</button>`;
        }

        container.innerHTML = html;
        container.querySelectorAll('.page-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                currentPage = parseInt(btn.dataset.page, 10);
                renderTable();
                document.querySelector('.table-wrapper').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
        });
    }

    function getTagClass(type) {
        const t = type.toLowerCase();
        if (t.includes('finance') || t.includes('frais')) return 'tag-finance';
        if (t.includes('support')) return 'tag-support';
        return 'tag-default';
    }

    // ── Summary ──
    function renderSummary() {
        // Top expenses
        const expensesByCat = {};
        rawData.filter((r) => r.montant < 0).forEach((r) => {
            const cat = extractCategory(r);
            if (!expensesByCat[cat]) expensesByCat[cat] = 0;
            expensesByCat[cat] += Math.abs(r.montant);
        });
        const topExpenses = Object.entries(expensesByCat)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);

        $('#summary-expenses').innerHTML = topExpenses
            .map(
                ([name, val]) =>
                    `<div class="summary-item">
                        <span class="summary-item-label">${escapeHtml(name)}</span>
                        <span class="summary-item-value amount-negative">${formatCurrency(-val)}</span>
                    </div>`
            )
            .join('');

        // Top income
        const incomeByCat = {};
        rawData.filter((r) => r.montant > 0).forEach((r) => {
            const cat = extractCategory(r);
            if (!incomeByCat[cat]) incomeByCat[cat] = 0;
            incomeByCat[cat] += r.montant;
        });
        const topIncome = Object.entries(incomeByCat)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);

        $('#summary-income').innerHTML = topIncome
            .map(
                ([name, val]) =>
                    `<div class="summary-item">
                        <span class="summary-item-label">${escapeHtml(name)}</span>
                        <span class="summary-item-value amount-positive">${formatCurrency(val)}</span>
                    </div>`
            )
            .join('');

        // Alerts
        renderAlerts();
    }

    function renderAlerts() {
        const alerts = [];
        const totalIn = rawData.filter((r) => r.montant > 0).reduce((s, r) => s + r.montant, 0);
        const totalOut = Math.abs(rawData.filter((r) => r.montant < 0).reduce((s, r) => s + r.montant, 0));
        const net = totalIn - totalOut;

        // Net position
        if (net < 0) {
            alerts.push({
                type: 'warning',
                text: `Le solde net est négatif (${formatCurrency(-Math.abs(net))}). Les décaissements dépassent les encaissements sur la période.`,
            });
        } else {
            alerts.push({
                type: 'success',
                text: `Le solde net est positif (${formatCurrency(net)}). Les encaissements couvrent les décaissements.`,
            });
        }

        // Large transactions
        const sorted = [...rawData].sort((a, b) => Math.abs(b.montant) - Math.abs(a.montant));
        const largest = sorted[0];
        if (largest) {
            alerts.push({
                type: 'info',
                text: `Transaction la plus importante : ${formatCurrency(largest.montant)} — ${largest.libelle.substring(0, 60)}`,
            });
        }

        // Unjustified transactions
        const unjustified = rawData.filter((r) => r.justifie && r.justifie.toLowerCase() === 'non');
        if (unjustified.length > 0) {
            const totalUnjustified = unjustified.reduce((s, r) => s + Math.abs(r.montant), 0);
            alerts.push({
                type: 'warning',
                text: `${unjustified.length} transaction(s) non justifiée(s) pour un total de ${formatCurrency(totalUnjustified)}.`,
            });
        }

        // Concentration risk
        const topExpense = Object.entries(
            rawData.filter((r) => r.montant < 0).reduce((acc, r) => {
                const cat = extractCategory(r);
                acc[cat] = (acc[cat] || 0) + Math.abs(r.montant);
                return acc;
            }, {})
        ).sort((a, b) => b[1] - a[1])[0];

        if (topExpense && totalOut > 0) {
            const pct = ((topExpense[1] / totalOut) * 100).toFixed(1);
            if (pct > 30) {
                alerts.push({
                    type: 'warning',
                    text: `Concentration : "${topExpense[0]}" représente ${pct}% des dépenses totales.`,
                });
            }
        }

        // Recurring SEPA debits
        const sepaDebits = rawData.filter((r) => r.libelle.toUpperCase().includes('PRLV SEPA'));
        if (sepaDebits.length > 0) {
            const total = sepaDebits.reduce((s, r) => s + Math.abs(r.montant), 0);
            alerts.push({
                type: 'info',
                text: `${sepaDebits.length} prélèvement(s) SEPA détecté(s) pour un total de ${formatCurrency(total)}.`,
            });
        }

        const iconMap = {
            warning: '<svg class="alert-icon alert-warning" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            info: '<svg class="alert-icon alert-info" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
            success: '<svg class="alert-icon alert-success" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        };

        $('#summary-alerts').innerHTML = alerts
            .map(
                (a) =>
                    `<div class="alert-item">${iconMap[a.type]}<span>${escapeHtml(a.text)}</span></div>`
            )
            .join('');
    }

    // ── Utilities ──
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
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), ms);
        };
    }

    // ── New File Button ──
    $('#btn-new-file').addEventListener('click', () => {
        // Reset state
        rawData = [];
        filteredData = [];
        currentPage = 1;
        Object.keys(charts).forEach(destroyChart);

        fileInput.value = '';
        $('#file-info').classList.add('hidden');
        window._selectedFile = null;
        showScreen('upload');
    });

    // ── Export (simple print) ──
    $('#btn-export').addEventListener('click', () => {
        window.print();
    });

    // ── Mouse glow effect ──
    document.addEventListener('mousemove', (e) => {
        document.documentElement.style.setProperty('--mouse-x', e.clientX + 'px');
        document.documentElement.style.setProperty('--mouse-y', e.clientY + 'px');
    });
})();
