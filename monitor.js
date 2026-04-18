// monitor.js — monitoramento em tempo real do sistema

(function () {

    const INTERVALO_MONITOR = 15000; // 15s
    let monitorAtivo = false;
    let intervalId   = null;

    // ===================== BARRA DE STATUS =====================
    function criarBarraStatus() {
        if (document.getElementById("sys-status-bar")) return;

        const bar = document.createElement("div");
        bar.id = "sys-status-bar";
        bar.innerHTML = `
            <div class="sys-status-inner">
                <span class="sys-status-dot" id="sysStatusDot"></span>
                <span class="sys-status-txt" id="sysStatusTxt">Sistema OK</span>
                <span class="sys-status-sep">·</span>
                <span class="sys-status-item" id="sysStatusDb">🔗 BD</span>
                <span class="sys-status-sep">·</span>
                <span class="sys-status-item" id="sysStatusSessao">👤 Sessão</span>
            </div>
        `;

        const style = document.createElement("style");
        style.textContent = `
            #sys-status-bar {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: rgba(28,26,23,0.88);
                backdrop-filter: blur(8px);
                padding: 5px 1rem;
                z-index: 9000;
                font-family: 'DM Sans', Arial, sans-serif;
                font-size: 0.75rem;
                color: rgba(255,255,255,0.7);
                border-top: 1px solid rgba(255,255,255,0.08);
                transition: opacity 0.3s;
                opacity: 0;
                pointer-events: none;
            }
            #sys-status-bar.visivel {
                opacity: 1;
                pointer-events: auto;
            }
            .sys-status-inner {
                display: flex;
                align-items: center;
                gap: 8px;
                max-width: 1200px;
                margin: 0 auto;
            }
            .sys-status-dot {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: #48bb78;
                flex-shrink: 0;
                transition: background 0.3s;
            }
            .sys-status-dot.aviso   { background: #e8bc5a; }
            .sys-status-dot.erro    { background: #fc5c5c; animation: piscaDot 1s infinite; }
            .sys-status-txt { color: rgba(255,255,255,0.85); font-weight: 500; }
            .sys-status-sep { color: rgba(255,255,255,0.25); }
            .sys-status-item { color: rgba(255,255,255,0.55); }
            .sys-status-item.ok     { color: #68d391; }
            .sys-status-item.falha  { color: #fc8181; font-weight: 600; }
            .sys-status-item.aviso  { color: #e8bc5a; }

            @keyframes piscaDot {
                0%, 100% { opacity: 1; }
                50%       { opacity: 0.2; }
            }

            /* Banner de erro persistente (não crítico) */
            .sys-banner-erro {
                position: fixed;
                top: 70px;
                left: 0;
                right: 0;
                background: #fff3cd;
                border-bottom: 2px solid #e8bc5a;
                color: #856404;
                padding: 10px 1.5rem;
                font-size: 0.85rem;
                font-family: 'DM Sans', Arial, sans-serif;
                z-index: 8999;
                display: flex;
                align-items: center;
                gap: 10px;
                animation: slideDown 0.3s ease;
            }
            .sys-banner-erro.critico {
                background: #fdeaea;
                border-bottom-color: #e53e3e;
                color: #c53030;
            }
            @keyframes slideDown {
                from { transform: translateY(-100%); opacity: 0; }
                to   { transform: translateY(0);     opacity: 1; }
            }
            .sys-banner-fechar {
                margin-left: auto;
                background: none;
                border: none;
                font-size: 1rem;
                cursor: pointer;
                color: inherit;
                opacity: 0.6;
            }
            .sys-banner-fechar:hover { opacity: 1; }
        `;

        document.head.appendChild(style);
        document.body.appendChild(bar);
    }

    function setStatusBar(estado, txt, dbOk, sessaoOk) {
        const bar    = document.getElementById("sys-status-bar");
        const dot    = document.getElementById("sysStatusDot");
        const label  = document.getElementById("sysStatusTxt");
        const dbEl   = document.getElementById("sysStatusDb");
        const sesEl  = document.getElementById("sysStatusSessao");
        if (!bar) return;

        bar.classList.add("visivel");

        dot.className = `sys-status-dot ${estado === "ok" ? "" : estado}`;
        label.textContent = {
            ok:     "Sistema OK",
            aviso:  "Atenção",
            erro:   "Falha detectada"
        }[estado] || txt;

        if (dbEl) {
            dbEl.className  = `sys-status-item ${dbOk ? "ok" : "falha"}`;
            dbEl.textContent = `🔗 BD: ${dbOk ? "OK" : "FALHA"}`;
        }
        if (sesEl) {
            const restante = sessaoRestante();
            sesEl.className  = `sys-status-item ${sessaoOk ? "ok" : "aviso"}`;
            sesEl.textContent = `👤 Sessão: ${restante}`;
        }
    }

    function sessaoRestante() {
        if (!window.Auth) return "—";
        const s = Auth.getSessao();
        if (!s) return "expirada";
        const min = Math.round((s.expiraEm - Date.now()) / 60000);
        if (min < 0)  return "expirada";
        if (min < 60) return `${min}min`;
        return `${Math.floor(min/60)}h${min%60 > 0 ? String(min%60).padStart(2,"0") : ""}`;
    }

    // ===================== BANNER DE AVISO =====================
    let bannerAtivo = null;

    function mostrarBanner(msg, critico = false) {
        // Evita duplicar o mesmo banner
        if (bannerAtivo && bannerAtivo.textContent.includes(msg)) return;

        fecharBanner();

        const el = document.createElement("div");
        el.className = `sys-banner-erro${critico ? " critico" : ""}`;
        el.innerHTML = `
            <span>${critico ? "🔴" : "⚠️"}</span>
            <span>${msg}</span>
            <button class="sys-banner-fechar" onclick="this.parentElement.remove()">✕</button>
        `;
        document.body.appendChild(el);
        bannerAtivo = el;

        // Auto-remover avisos não críticos após 8s
        if (!critico) {
            setTimeout(() => { if (el.isConnected) el.remove(); bannerAtivo = null; }, 8000);
        }
    }

    function fecharBanner() {
        if (bannerAtivo && bannerAtivo.isConnected) bannerAtivo.remove();
        bannerAtivo = null;
    }

    // ===================== HEALTH CHECK CONTÍNUO =====================
    async function verificarSaude() {
        // Usa o DataLayer em vez de fazer query direta — sem risco de travar
        const dbOk = window.AppInit?.DataLayer?.isDisponivel() ?? !!window.db;

        // Check sessão
        const sessao = window.Auth ? Auth.getSessao() : null;
        const sessaoOk = !!sessao;

        // Check sessão expirando (menos de 15 min)
        if (sessao) {
            const min = Math.round((sessao.expiraEm - Date.now()) / 60000);
            if (min > 0 && min < 15) {
                mostrarBanner(`Sua sessão expira em ${min} minuto(s). Salve seu trabalho.`, false);
            } else if (min <= 0) {
                mostrarBanner("Sessão expirada. Você será redirecionado ao login.", true);
                setTimeout(() => Auth.logout(), 3000);
            }
        }

        const estado = !dbOk ? "erro" : !sessaoOk ? "aviso" : "ok";
        setStatusBar(estado, "", dbOk, sessaoOk);

        if (!dbOk) {
            mostrarBanner("Sem conexão com o banco de dados. Verifique sua internet.", true);
            AppLog?.error("Monitor", "BD inacessível");
        }

        // Check scanner (se estiver na página do leitor)
        if (window.Html5Qrcode !== undefined) {
            const scannerOk = verificarScanner();
            if (!scannerOk) {
                AppLog?.warn("Monitor", "Scanner pode estar com problema");
            }
        }
    }

    function verificarScanner() {
        const canvas = document.getElementById("scannerCanvas");
        const reader = document.getElementById("reader");
        if (!canvas || !reader) return true; // não está na página do leitor
        return canvas.isConnected && reader.isConnected;
    }

    // ===================== INICIAR MONITORAMENTO =====================
    function iniciar() {
        if (monitorAtivo) return;
        monitorAtivo = true;
        criarBarraStatus();

        // Primeiro check imediato
        setTimeout(verificarSaude, 2000);

        // Check contínuo
        intervalId = setInterval(verificarSaude, INTERVALO_MONITOR);

        AppLog?.info("Monitor", `Monitoramento iniciado (intervalo: ${INTERVALO_MONITOR/1000}s)`);
    }

    function parar() {
        if (intervalId) clearInterval(intervalId);
        monitorAtivo = false;
    }

    // ===================== API PÚBLICA =====================
    window.Monitor = { iniciar, parar, verificarSaude, mostrarBanner, fecharBanner };

    // Auto-iniciar quando o sistema estiver pronto
    document.addEventListener("app:pronto", () => {
        Monitor.iniciar();
    });

})();