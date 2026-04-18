// script.js v2 — cadastro de alunos

let alunos = [];
let editandoId = null;
let salvando = false;

// ===================== CARREGAR =====================
async function carregarAlunos() {
    try {
        const { data, error } = await db
            .from("alunos")
            .select("*")
            .order("nome", { ascending: true });

        if (error) throw error;
        alunos = data || [];
    } catch (err) {
        console.error(err);
        Notif.erro("Erro ao carregar alunos", err.message);
        alunos = [];
    }
}

async function carregarPresentesHoje() {
    try {
        const hoje = new Date().toISOString().split("T")[0];
        const { data, error } = await db
            .from("presencas")
            .select("id")
            .gte("horario_chegada", hoje + "T00:00:00")
            .lte("horario_chegada", hoje + "T23:59:59");

        if (error) throw error;
        document.getElementById("presentesHoje").innerText = data ? data.length : 0;
    } catch (err) {
        document.getElementById("presentesHoje").innerText = "—";
    }
}

// ===================== QR CODE =====================
function gerarQRCodeSync(id) {
    const url = `${BASE_URL}/registrar.html?id=${id}`;
    const tempDiv = document.createElement("div");
    tempDiv.style.cssText = "position:absolute;left:-9999px;top:-9999px;";
    document.body.appendChild(tempDiv);

    try {
        new QRCode(tempDiv, {
            text: url,
            width: 220,
            height: 220,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
        const canvas = tempDiv.querySelector("canvas");
        return canvas ? canvas.toDataURL("image/png") : "";
    } catch (err) {
        console.error("Erro ao gerar QR:", err);
        return "";
    } finally {
        document.body.removeChild(tempDiv);
    }
}

// ===================== VALIDAÇÃO =====================
function validarCampos() {
    const campos = ["nome", "idade", "turma", "turno"];
    let valido = true;

    campos.forEach(id => {
        const el = document.getElementById(id);
        const vazio = !el.value.trim();
        el.classList.toggle("erro-campo", vazio);
        if (vazio) valido = false;
    });

    const idade = parseInt(document.getElementById("idade").value);
    if (!isNaN(idade) && (idade < 1 || idade > 99)) {
        document.getElementById("idade").classList.add("erro-campo");
        Notif.aviso("Idade inválida", "Insira uma idade entre 1 e 99.");
        return false;
    }

    if (!valido) {
        Notif.aviso("Campos obrigatórios", "Preencha todos os campos antes de salvar.");
    }

    return valido;
}

// ===================== CADASTRAR =====================
async function cadastrar() {
    if (salvando) return;
    if (!validarCampos()) return;

    salvando = true;
    const btn = document.getElementById("btnSalvar");
    btn.disabled = true;
    btn.textContent = "Salvando...";

    const nome  = document.getElementById("nome").value.trim();
    const idade = parseInt(document.getElementById("idade").value);
    const turma = document.getElementById("turma").value.trim();
    const turno = document.getElementById("turno").value;

    try {
        if (editandoId) {
            const qr = gerarQRCodeSync(editandoId);
            const { error } = await db
                .from("alunos")
                .update({ nome, idade, turma, turno, qr })
                .eq("id", editandoId);

            if (error) throw error;
            Notif.sucesso("Aluno atualizado!", `${nome} foi salvo com sucesso.`);
            editandoId = null;
            document.getElementById("tituloForm").innerText = "Novo aluno";

        } else {
            // Insere primeiro para obter UUID
            const { data, error } = await db
                .from("alunos")
                .insert([{ nome, idade, turma, turno }])
                .select()
                .single();

            if (error) throw error;

            // Gera QR com UUID real e atualiza
            const qr = gerarQRCodeSync(data.id);
            if (qr) {
                await db.from("alunos").update({ qr }).eq("id", data.id);
            }

            Notif.sucesso("Aluno cadastrado!", `${nome} foi adicionado com sucesso.`);
        }

        await carregarAlunos();
        listar();
        limparCampos();

    } catch (err) {
        console.error(err);
        Notif.erro("Erro ao salvar", err.message || "Tente novamente.");
    } finally {
        salvando = false;
        btn.disabled = false;
        btn.textContent = "✅ Salvar aluno";
    }
}

// ===================== LISTAR =====================
function listar() {
    const tbody = document.getElementById("listaAlunos");
    const busca = (document.getElementById("busca").value || "").toLowerCase();
    const filtrados = alunos.filter(a => a.nome.toLowerCase().includes(busca));

    document.getElementById("totalAlunos").innerText = alunos.length;

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6">
            <div class="empty"><div class="empty-icon">🔍</div><p>Nenhum aluno encontrado.</p></div>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = filtrados.map(a => {
        const turnoClass = a.turno === "Manhã" ? "badge-verde"
                         : a.turno === "Tarde" ? "badge-amarelo"
                         : a.turno === "Noite" ? "badge-noite"
                         : "badge-cinza";
        return `
        <tr>
            <td><strong>${escHtml(a.nome)}</strong></td>
            <td>${a.idade ?? "—"}</td>
            <td>${escHtml(a.turma ?? "—")}</td>
            <td><span class="badge ${turnoClass}">${escHtml(a.turno ?? "—")}</span></td>
            <td>${a.qr
                ? `<img src="${a.qr}" class="qr-img" alt="QR de ${escHtml(a.nome)}">`
                : `<span style="font-size:0.78rem;color:var(--texto-fraco)">sem QR</span>`
            }</td>
            <td style="display:flex;gap:6px;flex-wrap:wrap;">
                <button class="btn btn-secondary btn-icon" onclick="editar('${a.id}')" title="Editar">✏️</button>
                <button class="btn btn-danger btn-icon" onclick="excluir('${a.id}')" title="Excluir">🗑️</button>
            </td>
        </tr>`;
    }).join("");
}

// ===================== EDITAR =====================
function editar(id) {
    const a = alunos.find(x => x.id === id);
    if (!a) return;

    document.getElementById("nome").value  = a.nome;
    document.getElementById("idade").value = a.idade ?? "";
    document.getElementById("turma").value = a.turma ?? "";
    document.getElementById("turno").value = a.turno ?? "";
    document.getElementById("tituloForm").innerText = `Editando: ${a.nome}`;

    editandoId = id;
    window.scrollTo({ top: 0, behavior: "smooth" });
    Notif.info("Modo edição", `Editando dados de ${a.nome}.`);
}

// ===================== EXCLUIR =====================
async function excluir(id) {
    const a = alunos.find(x => x.id === id);
    const nome = a?.nome ?? "este aluno";

    const ok = await Notif.confirmar(
        `Excluir ${nome}?`,
        "Esta ação não pode ser desfeita. As presenças registradas serão mantidas.",
        "🗑️"
    );
    if (!ok) return;

    try {
        const { error } = await db.from("alunos").delete().eq("id", id);
        if (error) throw error;
        Notif.sucesso("Aluno excluído", `${nome} foi removido.`);
        await carregarAlunos();
        listar();
    } catch (err) {
        Notif.erro("Erro ao excluir", err.message);
    }
}

// ===================== APAGAR TODOS =====================
async function confirmarApagarTodos() {
    if (alunos.length === 0) { Notif.aviso("Nenhum aluno", "Não há alunos para apagar."); return; }

    const ok = await Notif.confirmar(
        "Apagar todos os alunos?",
        `Isso removerá ${alunos.length} aluno(s) permanentemente do sistema.`,
        "⚠️"
    );
    if (!ok) return;

    try {
        const { error } = await db.from("alunos").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) throw error;
        Notif.sucesso("Alunos apagados", "Todos os registros foram removidos.");
        alunos = [];
        listar();
    } catch (err) {
        Notif.erro("Erro ao apagar", err.message);
    }
}

// ===================== RELATÓRIO DE PRESENÇAS =====================
async function gerarRelatorioPresencas() {
    if (!window.jspdf) {
        Notif.erro("jsPDF não carregado", "Adicione a biblioteca jsPDF ao projeto.");
        return;
    }

    Notif.info("Gerando relatório...", "Aguarde.");

    try {
        const hoje = new Date().toISOString().split("T")[0];
        const { data, error } = await db
            .from("presencas")
            .select("horario_chegada, alunos(nome, turma, turno)")
            .gte("horario_chegada", hoje + "T00:00:00")
            .lte("horario_chegada", hoje + "T23:59:59")
            .order("horario_chegada", { ascending: true });

        if (error) throw error;

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const dataFmt = new Date().toLocaleDateString("pt-BR");

        doc.setFontSize(16);
        doc.text("Relatório de Presenças", 20, 20);
        doc.setFontSize(10);
        doc.text(`Data: ${dataFmt}  |  Total: ${data.length} aluno(s)`, 20, 30);

        let y = 42;
        doc.setFontSize(9);
        doc.setFont(undefined, "bold");
        doc.text("Nome", 20, y);
        doc.text("Turma", 100, y);
        doc.text("Turno", 140, y);
        doc.text("Horário", 170, y);
        y += 6;
        doc.line(20, y, 195, y);
        y += 6;
        doc.setFont(undefined, "normal");

        (data || []).forEach(p => {
            const a = p.alunos;
            const hora = new Date(p.horario_chegada).toLocaleTimeString("pt-BR", {
                hour: "2-digit", minute: "2-digit"
            });
            doc.text(a?.nome ?? "—", 20, y);
            doc.text(a?.turma ?? "—", 100, y);
            doc.text(a?.turno ?? "—", 140, y);
            doc.text(hora, 170, y);
            y += 7;
            if (y > 280) { doc.addPage(); y = 20; }
        });

        doc.save(`presencas_${hoje}.pdf`);
        Notif.sucesso("Relatório gerado!", `${data.length} presença(s) exportada(s).`);

    } catch (err) {
        Notif.erro("Erro ao gerar relatório", err.message);
    }
}

// ===================== HELPERS =====================
function limparCampos() {
    ["nome","idade","turma"].forEach(id => {
        const el = document.getElementById(id);
        el.value = "";
        el.classList.remove("erro-campo");
    });
    const turno = document.getElementById("turno");
    turno.value = "";
    turno.classList.remove("erro-campo");
    document.getElementById("tituloForm").innerText = "Novo aluno";
    editandoId = null;
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// ===================== INICIAR =====================
function _iniciarMain() {
    carregarAlunos().then(() => listar());
    carregarPresentesHoje();
}

// Escuta app:pronto (disparado pelo AppInit no HTML)
if (window.AppInit) {
    document.addEventListener("app:pronto", _iniciarMain, { once: true });
} else {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", _iniciarMain);
    } else {
        _iniciarMain();
    }
}