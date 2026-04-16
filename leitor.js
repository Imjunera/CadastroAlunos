// leitor.js v2

// ===================== DATA / RELÓGIO =====================
function atualizarRelogio() {
    const agora = new Date();
    document.getElementById("relogioChip").innerText =
        agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

(function iniciarInfo() {
    const hoje = new Date();
    const opts = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
    const str  = hoje.toLocaleDateString("pt-BR", opts);
    document.getElementById("dataHoje").innerText =
        str.charAt(0).toUpperCase() + str.slice(1);

    atualizarRelogio();
    setInterval(atualizarRelogio, 1000);
})();

// ===================== TURNO =====================
function atualizarTurnoBanner() {
    const turno = turnoAtual();
    const banner = document.getElementById("turnoBanner");
    const txt    = document.getElementById("turnoTxt");
    const stat   = document.getElementById("turnoAtualStat");

    if (turno) {
        banner.className = "turno-banner";
        txt.innerText    = `Turno ativo: ${turno.nome}`;
        stat.innerText   = turno.nome;
    } else {
        banner.className = "turno-banner fora";
        txt.innerText    = "Fora do horário de aulas";
        stat.innerText   = "—";
    }
}

// Chave no localStorage para saber qual turno foi limpo por último
function chaveUltimoTurno() {
    const hoje = new Date().toISOString().split("T")[0];
    return `turno_limpo_${hoje}`;
}

// Verifica se o turno acabou e precisa limpar — roda a cada minuto
async function verificarTrocaTurno() {
    atualizarTurnoBanner();

    const m = minutosDoDia();
    // Momentos de virada: fim de Manhã (780), fim de Tarde (1080), fim de Noite (1440→0)
    const viradas = [13 * 60, 18 * 60, 24 * 60];

    for (const virada of viradas) {
        // Janela de 1 minuto após a virada
        if (m >= virada && m < virada + 1) {
            const chave = chaveUltimoTurno() + "_" + virada;
            if (!localStorage.getItem(chave)) {
                localStorage.setItem(chave, "1");
                await limparPresencasTurnoAnterior(virada);
            }
        }
    }
}

async function limparPresencasTurnoAnterior(virada) {
    // Determina o intervalo do turno que acabou
    const turnos = [
        { inicio: 6*60+45, fim: 13*60,  nome: "Manhã" },
        { inicio: 13*60,   fim: 18*60,  nome: "Tarde" },
        { inicio: 19*60,   fim: 24*60,  nome: "Noite" },
    ];
    const turno = turnos.find(t => t.fim === virada);
    if (!turno) return;

    const { inicio, fim } = intervaloPorTurno(turno);

    try {
        const { error } = await db
            .from("presencas")
            .delete()
            .gte("horario_chegada", inicio)
            .lte("horario_chegada", fim);

        if (!error) {
            Notif.info(`Turno ${turno.nome} encerrado`, "Lista de presença foi limpa automaticamente.");
            carregarPresencas();
        }
    } catch (err) {
        console.error("Erro ao limpar presenças do turno:", err);
    }
}

// ===================== MODAL =====================
function mostrarModal({ tipo, nome, turma, turno }) {
    const cfg = {
        sucesso:   { icon: "✓", texto: "Presença registrada!" },
        duplicado: { icon: "!", texto: "Já registrado neste turno." },
        erro:      { icon: "✕", texto: "Aluno não encontrado." },
    };
    const c = cfg[tipo] || cfg.erro;

    document.getElementById("modalIcon").className  = `modal-icon ${tipo}`;
    document.getElementById("modalIcon").innerText  = c.icon;
    document.getElementById("modalNome").innerText  = nome || "—";
    document.getElementById("modalInfo").innerText  = turma ? `Turma: ${turma} — ${turno}` : "";
    document.getElementById("modalBadge").className = `modal-badge ${tipo}`;
    document.getElementById("modalBadge").innerText = c.texto;
    document.getElementById("modalOverlay").style.display = "flex";

    clearTimeout(window._modalTimer);
    window._modalTimer = setTimeout(() => {
        const o = document.getElementById("modalOverlay");
        if (o) o.style.display = "none";
    }, 4000);
}

function fecharModal(e) {
    if (e.target.id === "modalOverlay")
        document.getElementById("modalOverlay").style.display = "none";
}

// ===================== PRESENÇAS =====================
function formatarHora(iso) {
    return new Date(iso).toLocaleTimeString("pt-BR", {
        hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
}

async function carregarPresencas() {
    const turno = turnoAtual();
    const tbody = document.getElementById("listaPresencas");
    const totalEl = document.getElementById("totalPresentes");
    const ultimaEl = document.getElementById("ultimaEntrada");

    if (!turno) {
        tbody.innerHTML = `<tr><td colspan="3">
            <div class="empty"><div class="empty-icon">🌙</div><p>Fora do horário de aulas.</p></div>
        </td></tr>`;
        totalEl.innerText = "—";
        ultimaEl.innerText = "—";
        return;
    }

    const { inicio, fim } = intervaloPorTurno(turno);

    try {
        const { data, error } = await db
            .from("presencas")
            .select("id, horario_chegada, alunos(nome, turma, turno)")
            .gte("horario_chegada", inicio)
            .lte("horario_chegada", fim)
            .order("horario_chegada", { ascending: false });

        if (error) throw error;

        totalEl.innerText = data ? data.length : 0;

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3">
                <div class="empty"><div class="empty-icon">📋</div><p>Nenhuma presença ainda.</p></div>
            </td></tr>`;
            ultimaEl.innerText = "—";
            return;
        }

        ultimaEl.innerText = formatarHora(data[0].horario_chegada);

        tbody.innerHTML = data.map((p, i) => {
            const a = p.alunos;
            const tc = a?.turno === "Manhã" ? "badge-verde"
                     : a?.turno === "Tarde" ? "badge-amarelo"
                     : a?.turno === "Noite" ? "badge-noite"
                     : "badge-cinza";
            return `
            <tr class="${i === 0 ? "entrada-nova" : ""}">
                <td><strong>${escHtml(a?.nome ?? "—")}</strong></td>
                <td>${a?.turma ? `<span class="badge ${tc}">${escHtml(a.turma)}</span>` : "—"}</td>
                <td><span class="horario-chip">${formatarHora(p.horario_chegada)}</span></td>
            </tr>`;
        }).join("");

    } catch (err) {
        console.error(err);
        Notif.erro("Erro ao carregar presenças", err.message);
    }
}

// ===================== REGISTRAR =====================
let ultimoId = null;
let registrando = false;

async function onScanSuccess(texto) {
    if (registrando) return;

    let id = null;
    try {
        const url = new URL(texto);
        id = url.searchParams.get("id");
    } catch {
        const m = texto.match(/ID[:\s]+(\S+)/i);
        if (m) id = m[1];
    }

    if (!id || id === ultimoId) return;
    ultimoId = id;
    setTimeout(() => { ultimoId = null; }, 5000);

    registrando = true;
    await registrar(id);
    registrando = false;
}

async function registrar(id) {
    // Verifica turno ativo
    const turno = turnoAtual();
    if (!turno) {
        Notif.aviso("Fora do horário", "Não há turno ativo no momento.");
        mostrarModal({ tipo: "erro", nome: "Fora do horário" });
        return;
    }

    try {
        // Busca aluno
        const { data: aluno, error: errAluno } = await db
            .from("alunos")
            .select("id, nome, turma, turno")
            .eq("id", id)
            .single();

        if (errAluno || !aluno) {
            mostrarModal({ tipo: "erro" });
            Notif.erro("Aluno não encontrado", "ID não corresponde a nenhum aluno.");
            return;
        }

        // Verifica duplicata no turno atual
        const { inicio, fim } = intervaloPorTurno(turno);
        const { data: existe } = await db
            .from("presencas")
            .select("id")
            .eq("aluno_id", id)
            .gte("horario_chegada", inicio)
            .lte("horario_chegada", fim);

        if (existe && existe.length > 0) {
            mostrarModal({ tipo: "duplicado", nome: aluno.nome, turma: aluno.turma, turno: aluno.turno });
            return;
        }

        // Insere presença
        const { error: errIns } = await db
            .from("presencas")
            .insert([{ aluno_id: id }]);

        if (errIns) throw errIns;

        mostrarModal({ tipo: "sucesso", nome: aluno.nome, turma: aluno.turma, turno: aluno.turno });
        carregarPresencas();

    } catch (err) {
        console.error(err);
        Notif.erro("Erro ao registrar presença", err.message);
        mostrarModal({ tipo: "erro" });
    }
}

// ===================== RELATÓRIO =====================
async function gerarRelatorioPresencas() {
    if (!window.jspdf) {
        Notif.erro("jsPDF não carregado", "Adicione a biblioteca jsPDF ao projeto.");
        return;
    }

    const turno = turnoAtual();
    Notif.info("Gerando relatório...", "Aguarde.");

    try {
        let query = db
            .from("presencas")
            .select("horario_chegada, alunos(nome, turma, turno)")
            .order("horario_chegada", { ascending: true });

        // Filtra pelo turno atual se houver
        if (turno) {
            const { inicio, fim } = intervaloPorTurno(turno);
            query = query.gte("horario_chegada", inicio).lte("horario_chegada", fim);
        } else {
            const hoje = new Date().toISOString().split("T")[0];
            query = query.gte("horario_chegada", hoje + "T00:00:00").lte("horario_chegada", hoje + "T23:59:59");
        }

        const { data, error } = await query;
        if (error) throw error;

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const dataFmt = new Date().toLocaleDateString("pt-BR");

        doc.setFontSize(16);
        doc.text("Relatório de Presenças", 20, 20);
        doc.setFontSize(10);
        doc.text(`Data: ${dataFmt}  |  Turno: ${turno?.nome ?? "Todos"}  |  Total: ${data?.length ?? 0}`, 20, 30);

        let y = 44;
        doc.setFont(undefined, "bold");
        doc.text("Nome", 20, y); doc.text("Turma", 100, y);
        doc.text("Turno", 140, y); doc.text("Horário", 170, y);
        y += 5; doc.line(20, y, 195, y); y += 7;
        doc.setFont(undefined, "normal");

        (data || []).forEach(p => {
            const a = p.alunos;
            const hora = new Date(p.horario_chegada).toLocaleTimeString("pt-BR", {
                hour: "2-digit", minute: "2-digit"
            });
            doc.setFontSize(9);
            doc.text(String(a?.nome ?? "—").substring(0, 35), 20, y);
            doc.text(String(a?.turma ?? "—"), 100, y);
            doc.text(String(a?.turno ?? "—"), 140, y);
            doc.text(hora, 170, y);
            y += 7;
            if (y > 280) { doc.addPage(); y = 20; }
        });

        const hoje = new Date().toISOString().split("T")[0];
        doc.save(`presencas_${hoje}_${turno?.nome ?? "geral"}.pdf`);
        Notif.sucesso("Relatório gerado!", `${data?.length ?? 0} presença(s) exportada(s).`);

    } catch (err) {
        Notif.erro("Erro ao gerar relatório", err.message);
    }
}

// ===================== CÂMERA =====================
let html5QrCode = null;

async function iniciarCamera() {
    const status = document.getElementById("scannerStatus");
    const btn    = document.getElementById("btnIniciar");

    btn.disabled = true;
    status.className = "scanner-status";
    status.innerText = "Solicitando permissão...";

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        stream.getTracks().forEach(t => t.stop());

        status.className = "scanner-status ok";
        status.innerText  = "✅ Câmera ativa — aponte para o QR Code";

        html5QrCode = new Html5Qrcode("reader");
        await html5QrCode.start(
            { facingMode: "environment" },
            {
                fps: 15,
                qrbox: (w, h) => {
                    const s = Math.floor(Math.min(w, h) * 0.75);
                    return { width: s, height: s };
                },
                aspectRatio: 1.0,
                experimentalFeatures: { useBarCodeDetectorIfSupported: true }
            },
            onScanSuccess
        );

        btn.style.display = "none";
        Notif.sucesso("Câmera ativa", "Aponte o QR Code do aluno para a câmera.");

    } catch (err) {
        status.className = "scanner-status erro";
        if (err.name === "NotAllowedError")
            status.innerText = "❌ Permissão negada. Habilite a câmera nas configurações.";
        else if (err.name === "NotFoundError")
            status.innerText = "❌ Câmera não encontrada.";
        else
            status.innerText = "❌ " + (err.message || "Erro desconhecido.");

        Notif.erro("Erro na câmera", status.innerText.replace("❌ ", ""));
        btn.disabled = false;
    }
}

// ===================== HELPERS =====================
function escHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// ===================== INICIAR =====================
atualizarTurnoBanner();
carregarPresencas();
verificarTrocaTurno();
setInterval(verificarTrocaTurno, 60 * 1000); // checa a cada minuto