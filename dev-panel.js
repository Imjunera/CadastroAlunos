// dev-panel.js — painel de diagnóstico para o papel "dev"
// Ativo apenas quando sessão.role === "dev"
// Atalho: Ctrl+Shift+L

(function () {

    let painelAberto = false;
    let painelEl = null;
    let refreshInterval = null;

    // ===================== VERIFICAR ROLE =====================
    function isDev() {
        if (!window.Auth) return false;
        const s = Auth.getSessao();
        return s?.role === "dev";
    }

    // ===================== ESTILOS =====================
    function injetarEstilos() {
        if (document.getElementById("dev-panel-style")) return;
        const style = document.createElement("style");
        style.id = "dev-panel-style";
        style.textContent = `
            #dev-panel {
                position: fixed;
                bottom: 0;
                right: 0;
                width: min(680px, 100vw);
                max-height: 60vh;
                background: #1a1a2e;
                color: #e0e0e0;
                font-family: 'Consolas', 'Courier New', monospace;
                font-size: 0.78rem;
                z-index: 99998;
                border-top: 2px solid #3a3a6e;
                border-left: 2px solid #3a3a6e;
                border-radius: 10px 0 0 0;
                display: flex;
                flex-direction: column;
                box-shadow: -4px -4px 24px rgba(0,0,0,0.4);
                animation: devPanelIn 0.2s ease;
            }
            @keyframes devPanelIn {
                from { transform: translateY(100%); opacity: 0; }
                to   { transform: translateY(0);    opacity: 1; }
            }

            #dev-panel-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 12px;
                background: #16213e;
                border-radius: 10px 0 0 0;
                border-bottom: 1px solid #2a2a4e;
                gap: 10px;
                flex-shrink: 0;
            }
            #dev-panel-titulo {
                font-weight: 700;
                color: #7ec8e3;
                font-size: 0.8rem;
                letter-spacing: 0.05em;
            }
            .dev-panel-tabs {
                display: flex;
                gap: 4px;
            }
            .dev-tab {
                padding: 3px 10px;
                border-radius: 5px;
                background: transparent;
                border: 1px solid #3a3a6e;
                color: #aaa;
                font-size: 0.72rem;
                cursor: pointer;
                font-family: inherit;
                transition: all 0.15s;
            }
            .dev-tab.ativo {
                background: #3a3a6e;
                color: #fff;
                border-color: #5a5a9e;
            }
            .dev-tab:hover:not(.ativo) { border-color: #5a5a7e; color: #ddd; }

            .dev-panel-actions {
                display: flex;
                gap: 6px;
                align-items: center;
            }
            .dev-btn {
                padding: 3px 8px;
                border-radius: 4px;
                background: #2a2a4e;
                border: 1px solid #3a3a6e;
                color: #ccc;
                font-size: 0.7rem;
                cursor: pointer;
                font-family: inherit;
            }
            .dev-btn:hover { background: #3a3a5e; }
            .dev-btn.danger { border-color: #6e2a2a; color: #fc8181; }
            .dev-btn.danger:hover { background: #4e1a1a; }

            #dev-panel-body {
                flex: 1;
                overflow-y: auto;
                padding: 8px 0;
                scrollbar-width: thin;
                scrollbar-color: #3a3a6e #1a1a2e;
            }

            /* ABA LOGS */
            .dev-log-linha {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                padding: 2px 12px;
                border-bottom: 1px solid rgba(255,255,255,0.03);
                line-height: 1.5;
            }
            .dev-log-linha:hover { background: rgba(255,255,255,0.04); }
            .dev-log-ts   { color: #555; flex-shrink: 0; font-size: 0.7rem; }
            .dev-log-nivel {
                flex-shrink: 0;
                width: 38px;
                font-weight: 700;
                font-size: 0.7rem;
            }
            .dev-log-nivel.info  { color: #68d391; }
            .dev-log-nivel.warn  { color: #e8bc5a; }
            .dev-log-nivel.error { color: #fc8181; }
            .dev-log-modulo { color: #7ec8e3; flex-shrink: 0; width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .dev-log-msg  { color: #e0e0e0; flex: 1; word-break: break-all; }
            .dev-log-det  { color: #666; font-size: 0.7rem; margin-left: 4px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

            /* ABA ESTADO */
            .dev-estado-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
                padding: 10px 12px;
            }
            .dev-estado-item {
                background: #16213e;
                border: 1px solid #2a2a4e;
                border-radius: 6px;
                padding: 8px 10px;
            }
            .dev-estado-label { font-size: 0.68rem; color: #666; margin-bottom: 3px; }
            .dev-estado-valor { font-size: 0.8rem; font-weight: 600; color: #e0e0e0; }
            .dev-estado-valor.ok    { color: #68d391; }
            .dev-estado-valor.falha { color: #fc8181; }
            .dev-estado-valor.aviso { color: #e8bc5a; }

            /* ABA HEALTH */
            .dev-health-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 12px;
                border-bottom: 1px solid rgba(255,255,255,0.03);
            }
            .dev-health-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
            .dev-health-dot.ok   { background: #68d391; }
            .dev-health-dot.erro { background: #fc8181; animation: piscaDotDev 1s infinite; }
            .dev-health-dot.pend { background: #e8bc5a; }
            @keyframes piscaDotDev { 0%,100%{opacity:1}50%{opacity:0.2} }
            .dev-health-nome { flex: 1; color: #ccc; }
            .dev-health-msg  { color: #666; font-size: 0.7rem; }

            /* Botão flutuante quando painel fechado */
            #dev-panel-toggle {
                position: fixed;
                bottom: 12px;
                right: 12px;
                width: 36px;
                height: 36px;
                border-radius: 8px;
                background: #1a1a2e;
                border: 1.5px solid #3a3a6e;
                color: #7ec8e3;
                font-size: 1rem;
                cursor: pointer;
                z-index: 99997;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 8px rgba(0,0,0,0.4);
                transition: transform 0.15s;
            }
            #dev-panel-toggle:hover { transform: scale(1.1); }
            #dev-panel-toggle.com-erro {
                border-color: #6e2a2a;
                color: #fc8181;
                animation: piscaDotDev 1.5s infinite;
            }
        `;
        document.head.appendChild(style);
    }

    // ===================== CRIAR PAINEL =====================
    let abaAtiva = "logs";

    function criarPainel() {
        if (document.getElementById("dev-panel")) return;

        painelEl = document.createElement("div");
        painelEl.id = "dev-panel";
        painelEl.innerHTML = `
            <div id="dev-panel-header">
                <span id="dev-panel-titulo">🛠 DEV PANEL</span>
                <div class="dev-panel-tabs">
                    <button class="dev-tab ativo" onclick="DevPanel._aba('logs')">Logs</button>
                    <button class="dev-tab" onclick="DevPanel._aba('estado')">Estado</button>
                    <button class="dev-tab" onclick="DevPanel._aba('health')">Health</button>
                </div>
                <div class="dev-panel-actions">
                    <button class="dev-btn" onclick="DevPanel._exportar()">⬇ Export</button>
                    <button class="dev-btn danger" onclick="DevPanel._limpar()">🗑 Limpar</button>
                    <button class="dev-btn" onclick="DevPanel.fechar()">✕</button>
                </div>
            </div>
            <div id="dev-panel-body">
                <div id="dev-aba-logs"></div>
                <div id="dev-aba-estado" style="display:none;"></div>
                <div id="dev-aba-health" style="display:none;"></div>
            </div>
        `;

        document.body.appendChild(painelEl);
        renderAba();
        refreshInterval = setInterval(renderAba, 2000);
    }

    // ===================== ABAS =====================
    window.DevPanel = {
        _aba(nome) {
            abaAtiva = nome;
            document.querySelectorAll(".dev-tab").forEach((t, i) => {
                t.classList.toggle("ativo", ["logs","estado","health"][i] === nome);
            });
            renderAba();
        },
        fechar() {
            if (painelEl) { painelEl.remove(); painelEl = null; }
            clearInterval(refreshInterval);
            painelAberto = false;
        },
        _limpar() {
            AppLog?.getLogs()?.splice(0);
            renderAba();
        },
        _exportar() {
            const logs = AppLog?.getLogs() || [];
            const txt = logs.map(l =>
                `[${l.ts}] [${l.nivel.toUpperCase()}] [${l.modulo}] ${l.msg} ${l.detalhe || ""}`
            ).join("\n");
            const blob = new Blob([txt], { type: "text/plain" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `logs_${new Date().toISOString().split("T")[0]}.txt`;
            a.click();
        },
        abrir() { abrir(); }
    };

    function renderAba() {
        if (!painelEl) return;

        if (abaAtiva === "logs") {
            const logs = AppLog?.getLogs() || [];
            const el = document.getElementById("dev-aba-logs");
            el.style.display = "";
            document.getElementById("dev-aba-estado").style.display = "none";
            document.getElementById("dev-aba-health").style.display  = "none";

            if (logs.length === 0) {
                el.innerHTML = `<div style="padding:16px;color:#555;text-align:center;">Nenhum log ainda.</div>`;
                return;
            }

            el.innerHTML = [...logs].reverse().map(l => {
                const ts = l.ts.split("T")[1]?.split(".")[0] || l.ts;
                return `
                <div class="dev-log-linha">
                    <span class="dev-log-ts">${ts}</span>
                    <span class="dev-log-nivel ${l.nivel}">${l.nivel.toUpperCase()}</span>
                    <span class="dev-log-modulo">${l.modulo}</span>
                    <span class="dev-log-msg">${l.msg}</span>
                    ${l.detalhe ? `<span class="dev-log-det" title="${l.detalhe}">${l.detalhe}</span>` : ""}
                </div>`;
            }).join("");

        } else if (abaAtiva === "estado") {
            const el = document.getElementById("dev-aba-estado");
            el.style.display = "";
            document.getElementById("dev-aba-logs").style.display   = "none";
            document.getElementById("dev-aba-health").style.display  = "none";

            const sessao = window.Auth ? Auth.getSessao() : null;
            const min = sessao ? Math.round((sessao.expiraEm - Date.now()) / 60000) : 0;
            const estadoSistema = window.AppState?.estado || "—";
            const erros = AppLog?.getErros()?.length || 0;

            el.innerHTML = `
                <div class="dev-estado-grid">
                    <div class="dev-estado-item">
                        <div class="dev-estado-label">Estado do sistema</div>
                        <div class="dev-estado-valor ${estadoSistema === "ready" ? "ok" : estadoSistema === "error" ? "falha" : "aviso"}">${estadoSistema}</div>
                    </div>
                    <div class="dev-estado-item">
                        <div class="dev-estado-label">Erros registrados</div>
                        <div class="dev-estado-valor ${erros > 0 ? "falha" : "ok"}">${erros}</div>
                    </div>
                    <div class="dev-estado-item">
                        <div class="dev-estado-label">Sessão</div>
                        <div class="dev-estado-valor ${sessao ? "ok" : "falha"}">${sessao ? sessao.usuario : "sem sessão"}</div>
                    </div>
                    <div class="dev-estado-item">
                        <div class="dev-estado-label">Sessão expira em</div>
                        <div class="dev-estado-valor ${min < 15 ? "aviso" : "ok"}">${min > 0 ? min + " min" : "expirada"}</div>
                    </div>
                    <div class="dev-estado-item">
                        <div class="dev-estado-label">Supabase (db)</div>
                        <div class="dev-estado-valor ${window.db ? "ok" : "falha"}">${window.db ? "conectado" : "ausente"}</div>
                    </div>
                    <div class="dev-estado-item">
                        <div class="dev-estado-label">Câmera ativa</div>
                        <div class="dev-estado-valor ${typeof _cameraAtiva !== "undefined" && _cameraAtiva ? "ok" : "aviso"}">${typeof _cameraAtiva !== "undefined" ? (_cameraAtiva ? "sim" : "não") : "n/a"}</div>
                    </div>
                    <div class="dev-estado-item">
                        <div class="dev-estado-label">Página</div>
                        <div class="dev-estado-valor">${window.location.pathname.split("/").pop()}</div>
                    </div>
                    <div class="dev-estado-item">
                        <div class="dev-estado-label">Logs totais</div>
                        <div class="dev-estado-valor">${AppLog?.getLogs()?.length || 0}</div>
                    </div>
                </div>`;

        } else if (abaAtiva === "health") {
            const el = document.getElementById("dev-aba-health");
            el.style.display = "";
            document.getElementById("dev-aba-logs").style.display   = "none";
            document.getElementById("dev-aba-estado").style.display  = "none";

            const checks = [
                { nome: "window.Auth",       ok: !!window.Auth,           msg: window.Auth ? "carregado" : "ausente" },
                { nome: "window.db (Supabase)", ok: !!(window.AppInit?.DataLayer?.isDisponivel() ?? window.db), msg: window.AppInit?.DataLayer?.isDisponivel() ? "disponível" : "indisponível" },
                { nome: "window.Notif",      ok: !!window.Notif,          msg: window.Notif ? "carregado" : "ausente" },
                { nome: "window.AppState",   ok: !!window.AppState,       msg: window.AppState?.estado || "ausente" },
                { nome: "window.AppLog",     ok: !!window.AppLog,         msg: window.AppLog ? "carregado" : "ausente" },
                { nome: "window.Monitor",    ok: !!window.Monitor,        msg: window.Monitor ? "ativo" : "ausente" },
                { nome: "document.body",     ok: !!document.body,         msg: "ok" },
                { nome: "sessionStorage",    ok: (() => { try { sessionStorage.setItem("_t","1"); sessionStorage.removeItem("_t"); return true; } catch { return false; } })(), msg: "ok" },
                { nome: "crypto.subtle",     ok: !!window.crypto?.subtle, msg: window.crypto?.subtle ? "disponível" : "indisponível" },
                { nome: "Html5Qrcode",       ok: typeof Html5Qrcode !== "undefined", msg: typeof Html5Qrcode !== "undefined" ? "carregado" : "ausente (normal fora do leitor)" },
            ];

            el.innerHTML = checks.map(c => `
                <div class="dev-health-item">
                    <div class="dev-health-dot ${c.ok ? "ok" : "erro"}"></div>
                    <div class="dev-health-nome">${c.nome}</div>
                    <div class="dev-health-msg">${c.msg}</div>
                </div>
            `).join("");
        }

        // Atualizar botão flutuante
        atualizarBotaoFlutuante();
    }

    // ===================== BOTÃO FLUTUANTE =====================
    function criarBotaoFlutuante() {
        if (document.getElementById("dev-panel-toggle")) return;
        const btn = document.createElement("button");
        btn.id = "dev-panel-toggle";
        btn.title = "Dev Panel (Ctrl+Shift+L)";
        btn.innerHTML = "🛠";
        btn.onclick = () => painelAberto ? DevPanel.fechar() : abrir();
        document.body.appendChild(btn);
    }

    function atualizarBotaoFlutuante() {
        const btn = document.getElementById("dev-panel-toggle");
        if (!btn) return;
        const erros = AppLog?.getErros()?.length || 0;
        btn.classList.toggle("com-erro", erros > 0);
        btn.innerHTML = erros > 0 ? `⚠ ${erros}` : "🛠";
    }

    // ===================== ABRIR =====================
    function abrir() {
        if (!isDev()) return;
        painelAberto = true;
        injetarEstilos();
        criarPainel();
    }

    // ===================== ATALHO DE TECLADO =====================
    document.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === "L") {
            e.preventDefault();
            if (!isDev()) {
                console.warn("Dev panel disponível apenas para role=dev");
                return;
            }
            if (painelAberto) {
                DevPanel.fechar();
            } else {
                abrir();
            }
        }
    });

    // ===================== INICIALIZAR =====================
    document.addEventListener("app:pronto", () => {
        if (isDev()) {
            injetarEstilos();
            criarBotaoFlutuante();
            AppLog?.info("DevPanel", "Painel de desenvolvimento disponível (Ctrl+Shift+L)");
        }
    });

})();