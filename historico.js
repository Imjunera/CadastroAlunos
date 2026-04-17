// historico.js — histórico de presenças por dia e turno

// Estado global do modal (para gerar PDF)
let modalAtual = { data: null, turno: null, registros: [] };

// Todos os dados carregados do Supabase
let dadosHistorico = [];

// ===================== CARREGAR =====================
async function carregarHistorico() {
    try {
        const { data, error } = await db
            .from("presencas")
            .select("id, horario_chegada, alunos(nome, turma, turno)")
            .order("horario_chegada", { ascending: false });

        if (error) throw error;

        dadosHistorico = data || [];
        atualizarStats();
        renderHistorico();

    } catch (err) {
        console.error(err);
        Notif.erro("Erro ao carregar histórico", err.message);
        document.getElementById("historicoContainer").innerHTML = `
            <div class="empty">
                <div class="empty-icon">❌</div>
                <p>Erro ao carregar o histórico. Verifique a conexão.</p>
            </div>`;
    }
}

// ===================== STATS =====================
function atualizarStats() {
    const dias = new Set(dadosHistorico.map(p => p.horario_chegada.split("T")[0]));

    document.getElementById("totalDias").innerText = dias.size;
    document.getElementById("totalRegistros").innerText = dadosHistorico.length;

    if (dadosHistorico.length > 0) {
        // O mais antigo fica no final (order descending)
        const maisAntigo = dadosHistorico[dadosHistorico.length - 1].horario_chegada.split("T")[0];
        document.getElementById("primeiroDia").innerText = formatarData(maisAntigo);
    } else {
        document.getElementById("primeiroDia").innerText = "—";
    }
}

// ===================== RENDER =====================
function renderHistorico() {
    const container = document.getElementById("historicoContainer");
    const filtroData  = document.getElementById("filtroData").value;   // "YYYY-MM-DD" ou ""
    const filtroTurno = document.getElementById("filtroTurno").value;  // "Manhã" | "Tarde" | "Noite" | ""

    // Filtra dados
    let dados = dadosHistorico;
    if (filtroData) {
        dados = dados.filter(p => p.horario_chegada.startsWith(filtroData));
    }
    if (filtroTurno) {
        dados = dados.filter(p => p.alunos?.turno === filtroTurno);
    }

    if (dados.length === 0) {
        container.innerHTML = `
            <div class="empty">
                <div class="empty-icon">📭</div>
                <p>Nenhum registro encontrado para este filtro.</p>
            </div>`;
        return;
    }

    // Agrupa por dia → por turno
    // estrutura: { "YYYY-MM-DD": { "Manhã": [...], "Tarde": [...], "Noite": [...] } }
    const agrupado = {};
    dados.forEach(p => {
        const dia = p.horario_chegada.split("T")[0];
        const turnoAluno = p.alunos?.turno ?? "Outros";
        if (!agrupado[dia]) agrupado[dia] = {};
        if (!agrupado[dia][turnoAluno]) agrupado[dia][turnoAluno] = [];
        agrupado[dia][turnoAluno].push(p);
    });

    // Ordena dias desc
    const diasOrdenados = Object.keys(agrupado).sort((a, b) => b.localeCompare(a));

    const ordemTurnos = ["Manhã", "Tarde", "Noite", "Outros"];

    const html = diasOrdenados.map(dia => {
        const turnos = agrupado[dia];
        const totalDia = Object.values(turnos).reduce((s, arr) => s + arr.length, 0);

        const turnosHtml = ordemTurnos
            .filter(t => turnos[t])
            .map(turno => {
                const regs = turnos[turno];
                const badgeClass = turno === "Manhã" ? "badge-verde"
                                 : turno === "Tarde" ? "badge-amarelo"
                                 : turno === "Noite" ? "badge-noite"
                                 : "badge-cinza";

                // Primeiros 3 nomes como preview
                const preview = regs.slice(0, 3).map(p => escHtml(p.alunos?.nome ?? "—")).join(", ");
                const extra = regs.length > 3 ? ` e mais ${regs.length - 3}...` : "";

                return `
                <div class="hist-turno-card" onclick="abrirModal('${dia}', '${turno}')">
                    <div class="hist-turno-header">
                        <span class="badge ${badgeClass}">${turno}</span>
                        <span class="hist-turno-count">${regs.length} presença${regs.length !== 1 ? "s" : ""}</span>
                        <button class="btn btn-success btn-sm hist-pdf-btn" onclick="event.stopPropagation();gerarPDF('${dia}', '${turno}')" title="Gerar PDF">📄</button>
                    </div>
                    <div class="hist-turno-preview">${preview}${extra}</div>
                </div>`;
            }).join("");

        return `
        <div class="hist-dia-card">
            <div class="hist-dia-header">
                <div>
                    <span class="hist-dia-label">${formatarData(dia)}</span>
                    <span class="hist-dia-sub">${formatarDiaSemana(dia)}</span>
                </div>
                <span class="hist-dia-total">${totalDia} aluno${totalDia !== 1 ? "s" : ""}</span>
            </div>
            <div class="hist-turnos-grid">
                ${turnosHtml}
            </div>
        </div>`;
    }).join("");

    container.innerHTML = html;
}

// ===================== MODAL =====================
async function abrirModal(dia, turno) {
    // Filtra registros daquele dia e turno
    const regs = dadosHistorico.filter(p =>
        p.horario_chegada.startsWith(dia) && p.alunos?.turno === turno
    );

    // Ordena por horário
    regs.sort((a, b) => a.horario_chegada.localeCompare(b.horario_chegada));

    modalAtual = { data: dia, turno, registros: regs };

    document.getElementById("modalTituloHist").innerText =
        `${formatarData(dia)} — ${turno} (${regs.length} presença${regs.length !== 1 ? "s" : ""})`;

    const tbody = document.getElementById("modalListaHist");
    if (regs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3"><div class="empty"><p>Sem registros.</p></div></td></tr>`;
    } else {
        const badgeClass = turno === "Manhã" ? "badge-verde"
                         : turno === "Tarde" ? "badge-amarelo"
                         : turno === "Noite" ? "badge-noite"
                         : "badge-cinza";
        tbody.innerHTML = regs.map(p => `
            <tr>
                <td><strong>${escHtml(p.alunos?.nome ?? "—")}</strong></td>
                <td>${p.alunos?.turma ? `<span class="badge ${badgeClass}">${escHtml(p.alunos.turma)}</span>` : "—"}</td>
                <td><span class="horario-chip">${formatarHora(p.horario_chegada)}</span></td>
            </tr>
        `).join("");
    }

    document.getElementById("modalOverlay").style.display = "flex";
}

function fecharModalHist(e) {
    if (e.target.id === "modalOverlay")
        document.getElementById("modalOverlay").style.display = "none";
}

// ===================== PDF =====================
async function gerarPDF(dia, turno) {
    const regs = dadosHistorico.filter(p =>
        p.horario_chegada.startsWith(dia) && p.alunos?.turno === turno
    );
    regs.sort((a, b) => a.horario_chegada.localeCompare(b.horario_chegada));

    _gerarPDFComDados(dia, turno, regs);
}

function gerarPDFDoModal() {
    _gerarPDFComDados(modalAtual.data, modalAtual.turno, modalAtual.registros);
}

function _gerarPDFComDados(dia, turno, regs) {
    if (!window.jspdf) {
        Notif.erro("jsPDF não carregado", "Adicione a biblioteca jsPDF ao projeto.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const dataFmt = new Date(dia + "T12:00:00").toLocaleDateString("pt-BR");

    doc.setFontSize(16);
    doc.text("Relatório de Presenças", 20, 20);
    doc.setFontSize(10);
    doc.text(`Data: ${dataFmt}  |  Turno: ${turno}  |  Total: ${regs.length} aluno(s)`, 20, 30);
    doc.text("Colégio Estadual Des. Antônio F. F. da Costa — Icaraíma / PR", 20, 38);

    let y = 50;
    doc.setFontSize(9);
    doc.setFont(undefined, "bold");
    doc.text("Nome", 20, y);
    doc.text("Turma", 110, y);
    doc.text("Horário", 170, y);
    y += 5;
    doc.line(20, y, 195, y);
    y += 7;
    doc.setFont(undefined, "normal");

    regs.forEach(p => {
        const a = p.alunos;
        const hora = new Date(p.horario_chegada).toLocaleTimeString("pt-BR", {
            hour: "2-digit", minute: "2-digit"
        });
        doc.text(String(a?.nome ?? "—").substring(0, 40), 20, y);
        doc.text(String(a?.turma ?? "—"), 110, y);
        doc.text(hora, 170, y);
        y += 7;
        if (y > 280) { doc.addPage(); y = 20; }
    });

    doc.save(`presencas_${dia}_${turno}.pdf`);
    Notif.sucesso("PDF gerado!", `${regs.length} presença(s) — ${turno} de ${dataFmt}`);
}

// ===================== FILTROS =====================
function limparFiltros() {
    document.getElementById("filtroData").value = "";
    document.getElementById("filtroTurno").value = "";
    renderHistorico();
}

// ===================== HELPERS =====================
function formatarData(isoDate) {
    // "YYYY-MM-DD" → "DD/MM/YYYY"
    const [y, m, d] = isoDate.split("-");
    return `${d}/${m}/${y}`;
}

function formatarDiaSemana(isoDate) {
    const date = new Date(isoDate + "T12:00:00");
    return date.toLocaleDateString("pt-BR", { weekday: "long" });
}

function formatarHora(iso) {
    return new Date(iso).toLocaleTimeString("pt-BR", {
        hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// ===================== INICIAR =====================
carregarHistorico();