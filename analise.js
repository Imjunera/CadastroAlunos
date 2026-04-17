// analise.js — painel de análise de presença e atraso

let dadosAnalise = [];      // todos os registros carregados
let dadosAlunos  = {};      // { aluno_id: { nome, turma, turno, presencas, atrasos } }

let chartTempo       = null;
let chartPizza       = null;
let chartTurno       = null;
let chartAtrasoTurno = null;

// ===================== CORES =====================
const COR_PRESENTE = "#1a6641";
const COR_ATRASADO = "#e53e3e";
const COR_GRID     = "rgba(0,0,0,0.06)";

const CORES_TURNOS = {
    "Manhã": "#1a6641",
    "Tarde": "#d4a017",
    "Noite": "#3a3a6e",
    "Outros": "#888",
};

// ===================== INICIALIZAÇÃO DE DATAS =====================
(function setDefaultDates() {
    const hoje = new Date();
    const fim  = hoje.toISOString().split("T")[0];
    // Padrão: últimos 30 dias
    const inicio = new Date(hoje.getTime() - 29 * 24 * 60 * 60 * 1000)
        .toISOString().split("T")[0];

    document.getElementById("filtroInicio").value = inicio;
    document.getElementById("filtroFim").value    = fim;
})();

// ===================== CARREGAR =====================
async function carregarAnalise() {
    const inicio    = document.getElementById("filtroInicio").value;
    const fim       = document.getElementById("filtroFim").value;
    const filtTurno = document.getElementById("filtroTurno").value;

    try {
        let query = db
            .from("presencas")
            .select("id, horario_chegada, status, aluno_id, alunos(nome, turma, turno)")
            .order("horario_chegada", { ascending: true });

        if (inicio) query = query.gte("horario_chegada", inicio + "T00:00:00");
        if (fim)    query = query.lte("horario_chegada", fim + "T23:59:59");

        const { data, error } = await query;
        if (error) throw error;

        // Filtra turno client-side (vem do aluno, não da presença)
        dadosAnalise = (data || []).filter(p =>
            !filtTurno || p.alunos?.turno === filtTurno
        );

        processarDados();
        atualizarStats();
        renderGraficos();
        renderTabelaAlunos();

    } catch (err) {
        console.error(err);
        Notif.erro("Erro ao carregar análise", err.message);
    }
}

// ===================== PROCESSAR =====================
function processarDados() {
    dadosAlunos = {};

    dadosAnalise.forEach(p => {
        const id = p.aluno_id;
        const a  = p.alunos;
        if (!dadosAlunos[id]) {
            dadosAlunos[id] = {
                nome: a?.nome ?? "—",
                turma: a?.turma ?? "—",
                turno: a?.turno ?? "—",
                presencas: 0,
                atrasos: 0,
            };
        }
        dadosAlunos[id].presencas++;
        if (p.status === "atrasado") dadosAlunos[id].atrasos++;
    });
}

// ===================== STATS =====================
function atualizarStats() {
    const total     = dadosAnalise.length;
    const atrasos   = dadosAnalise.filter(p => p.status === "atrasado").length;
    const pontuais  = total - atrasos;
    const pct       = total > 0 ? Math.round((pontuais / total) * 100) : 0;
    const uniqueIds = new Set(dadosAnalise.map(p => p.aluno_id)).size;

    document.getElementById("statTotal").innerText        = total;
    document.getElementById("statAtrasos").innerText      = atrasos;
    document.getElementById("statPontualidade").innerText = `${pct}%`;
    document.getElementById("statAlunos").innerText       = uniqueIds;
}

// ===================== GRÁFICOS =====================
function renderGraficos() {
    renderChartTempo();
    renderChartPizza();
    renderChartTurno();
    renderChartAtrasoTurno();
}

function destruir(chart) {
    if (chart) chart.destroy();
}

// Linha: presenças por dia
function renderChartTempo() {
    destruir(chartTempo);

    // Agrupa por dia
    const porDia = {};
    dadosAnalise.forEach(p => {
        const dia = p.horario_chegada.split("T")[0];
        if (!porDia[dia]) porDia[dia] = { presentes: 0, atrasados: 0 };
        if (p.status === "atrasado") porDia[dia].atrasados++;
        else porDia[dia].presentes++;
    });

    const dias = Object.keys(porDia).sort();
    const presentes  = dias.map(d => porDia[d].presentes);
    const atrasados  = dias.map(d => porDia[d].atrasados);
    const labels     = dias.map(d => {
        const [y, m, dd] = d.split("-");
        return `${dd}/${m}`;
    });

    chartTempo = new Chart(document.getElementById("chartTempo"), {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Presentes",
                    data: presentes,
                    borderColor: COR_PRESENTE,
                    backgroundColor: COR_PRESENTE + "22",
                    tension: 0.3,
                    fill: true,
                    pointRadius: 3,
                },
                {
                    label: "Atrasados",
                    data: atrasados,
                    borderColor: COR_ATRASADO,
                    backgroundColor: COR_ATRASADO + "22",
                    tension: 0.3,
                    fill: true,
                    pointRadius: 3,
                },
            ],
        },
        options: chartOpts("Registros por dia"),
    });
}

// Pizza: presentes vs atrasados
function renderChartPizza() {
    destruir(chartPizza);

    const total    = dadosAnalise.length;
    const atrasos  = dadosAnalise.filter(p => p.status === "atrasado").length;
    const pontuais = total - atrasos;

    chartPizza = new Chart(document.getElementById("chartPizza"), {
        type: "doughnut",
        data: {
            labels: ["Pontuais", "Atrasados"],
            datasets: [{
                data: [pontuais, atrasos],
                backgroundColor: [COR_PRESENTE, COR_ATRASADO],
                borderWidth: 2,
                borderColor: "#fff",
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: "bottom", labels: { font: { size: 12 } } },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const pct = total > 0 ? Math.round((ctx.raw / total) * 100) : 0;
                            return ` ${ctx.label}: ${ctx.raw} (${pct}%)`;
                        }
                    }
                }
            },
        },
    });
}

// Barras: presenças por turno
function renderChartTurno() {
    destruir(chartTurno);

    const turnos = ["Manhã", "Tarde", "Noite"];
    const conts  = turnos.map(t =>
        dadosAnalise.filter(p => p.alunos?.turno === t).length
    );

    chartTurno = new Chart(document.getElementById("chartTurno"), {
        type: "bar",
        data: {
            labels: turnos,
            datasets: [{
                label: "Presenças",
                data: conts,
                backgroundColor: turnos.map(t => CORES_TURNOS[t] + "cc"),
                borderColor:     turnos.map(t => CORES_TURNOS[t]),
                borderWidth: 2,
                borderRadius: 6,
            }],
        },
        options: chartOpts("Presenças por turno"),
    });
}

// Barras: atrasos por turno
function renderChartAtrasoTurno() {
    destruir(chartAtrasoTurno);

    const turnos = ["Manhã", "Tarde", "Noite"];
    const conts  = turnos.map(t =>
        dadosAnalise.filter(p => p.alunos?.turno === t && p.status === "atrasado").length
    );

    chartAtrasoTurno = new Chart(document.getElementById("chartAtrasoTurno"), {
        type: "bar",
        data: {
            labels: turnos,
            datasets: [{
                label: "Atrasos",
                data: conts,
                backgroundColor: COR_ATRASADO + "99",
                borderColor:     COR_ATRASADO,
                borderWidth: 2,
                borderRadius: 6,
            }],
        },
        options: chartOpts("Atrasos por turno"),
    });
}

function chartOpts(titulo) {
    return {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { display: true, position: "bottom", labels: { font: { size: 11 } } },
            title:  { display: false },
        },
        scales: {
            x: { grid: { color: COR_GRID } },
            y: { beginAtZero: true, grid: { color: COR_GRID }, ticks: { stepSize: 1 } },
        },
    };
}

// ===================== TABELA DE ALUNOS =====================
function renderTabelaAlunos() {
    const busca   = (document.getElementById("buscaAluno").value || "").toLowerCase();
    const ordenar = document.getElementById("ordenarPor").value;
    const tbody   = document.getElementById("tabelaAlunos");

    let lista = Object.values(dadosAlunos).filter(a =>
        a.nome.toLowerCase().includes(busca)
    );

    if (ordenar === "presencas") lista.sort((a, b) => b.presencas - a.presencas);
    else if (ordenar === "atrasos") lista.sort((a, b) => b.atrasos - a.atrasos);
    else lista.sort((a, b) => a.nome.localeCompare(b.nome));

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7">
            <div class="empty"><div class="empty-icon">🔍</div><p>Nenhum aluno encontrado.</p></div>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map((a, i) => {
        const pct = a.presencas > 0 ? Math.round(((a.presencas - a.atrasos) / a.presencas) * 100) : 0;
        const pctClass = pct >= 90 ? "pct-verde" : pct >= 70 ? "pct-amarelo" : "pct-vermelho";
        const turnoClass = a.turno === "Manhã" ? "badge-verde"
                         : a.turno === "Tarde" ? "badge-amarelo"
                         : a.turno === "Noite" ? "badge-noite"
                         : "badge-cinza";
        return `
        <tr>
            <td style="color:var(--texto-fraco);font-size:0.8rem;">${i + 1}</td>
            <td><strong>${escHtml(a.nome)}</strong></td>
            <td>${escHtml(a.turma)}</td>
            <td><span class="badge ${turnoClass}">${escHtml(a.turno)}</span></td>
            <td><strong>${a.presencas}</strong></td>
            <td style="color:${a.atrasos > 0 ? "var(--danger,#e53e3e)" : "inherit"};">
                ${a.atrasos > 0 ? `<strong>${a.atrasos}</strong>` : "0"}
            </td>
            <td>
                <div class="pct-bar-wrap">
                    <div class="pct-bar-fill ${pctClass}" style="width:${pct}%"></div>
                </div>
                <span class="pct-label ${pctClass}">${pct}%</span>
            </td>
        </tr>`;
    }).join("");
}

// ===================== HELPERS =====================
function limparFiltros() {
    const hoje  = new Date();
    const fim   = hoje.toISOString().split("T")[0];
    const inicio = new Date(hoje.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    document.getElementById("filtroInicio").value = inicio;
    document.getElementById("filtroFim").value    = fim;
    document.getElementById("filtroTurno").value  = "";
    document.getElementById("buscaAluno").value   = "";
    carregarAnalise();
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// ===================== INICIAR =====================
carregarAnalise();