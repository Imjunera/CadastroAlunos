// app-init.js v3 — inicialização resiliente com separação Boot / Auth / Data

(function (global) {

    // ─────────────────────────────────────────────────────────────────────────
    //  CONSTANTES
    // ─────────────────────────────────────────────────────────────────────────

    const ESTADOS = Object.freeze({
        LOADING:    "loading",
        READY:      "ready",
        ERROR:      "error",
        RECOVERING: "recovering",
    });

    const CFG = Object.freeze({
        TIMEOUT_BOOT:           6000,
        POLL_INTERVAL:           150,
        POLL_MAX_MS:            6000,
        SUPABASE_POLL_MAX_MS:   3000,
        MAX_RETRY_BOOT:            2,
        LOG_MAX_ENTRIES:         300,
        PAGINAS_PUBLICAS: ["login.html", "registrar.html", ""],
    });

    // ─────────────────────────────────────────────────────────────────────────
    //  LOGGER — disponível imediatamente, antes de qualquer boot
    // ─────────────────────────────────────────────────────────────────────────

    const _logBuffer = [];

    function _log(nivel, modulo, msg, detalhe) {
        const entrada = {
            ts:      new Date().toISOString(),
            nivel,
            modulo,
            msg,
            detalhe: detalhe != null ? String(detalhe) : "",
        };
        _logBuffer.push(entrada);
        if (_logBuffer.length > CFG.LOG_MAX_ENTRIES) _logBuffer.shift();

        const fn = nivel === "error" ? "error" : nivel === "warn" ? "warn" : "log";
        console[fn](`[${modulo}] ${msg}`, entrada.detalhe || "");
    }

    global.AppLog = Object.freeze({
        info:     (m, msg, d) => _log("info",  m, msg, d),
        warn:     (m, msg, d) => _log("warn",  m, msg, d),
        error:    (m, msg, d) => _log("error", m, msg, d),
        getLogs:  ()           => [..._logBuffer],
        getErros: ()           => _logBuffer.filter(l => l.nivel === "error"),
        clear:    ()           => { _logBuffer.splice(0); },
    });

    // ─────────────────────────────────────────────────────────────────────────
    //  ESTADO GLOBAL
    // ─────────────────────────────────────────────────────────────────────────

    let _estado = ESTADOS.LOADING;

    global.AppState = Object.freeze({
        get estado()  { return _estado; },
        isReady()     { return _estado === ESTADOS.READY; },
        isError()     { return _estado === ESTADOS.ERROR; },
        isLoading()   { return _estado === ESTADOS.LOADING || _estado === ESTADOS.RECOVERING; },

        _set(novo) {
            if (novo === _estado) return;
            AppLog.info("AppState", `${_estado} → ${novo}`);
            _estado = novo;
            _emit("app:estado", { estado: novo });
        },
    });

    // ─────────────────────────────────────────────────────────────────────────
    //  CAPTURA GLOBAL DE ERROS
    //  Registra sempre. Só exibe tela de erro se ocorrer durante o boot.
    //  Após app:pronto, erros são reportados via Notif sem travar a UI.
    // ─────────────────────────────────────────────────────────────────────────

    global.onerror = function (msg, src, linha, col) {
        AppLog.error("GlobalError", msg, `${src}:${linha}:${col}`);
        if (AppState.isLoading()) {
            AppState._set(ESTADOS.ERROR);
            UI.mostrarErro("Erro de script durante a inicialização.", `${msg} — ${src}:${linha}`);
        }
        return false;
    };

    global.addEventListener("unhandledrejection", (e) => {
        const msg = e.reason?.message || String(e.reason) || "Promise rejeitada";
        AppLog.error("UnhandledRejection", msg);

        if (AppState.isLoading()) {
            AppState._set(ESTADOS.ERROR);
            UI.mostrarErro("Erro assíncrono durante a inicialização.", msg);
            return;
        }

        if (AppState.isReady() && global.Notif) {
            Notif.erro("Erro interno", msg);
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    //  UI — loading screen e error screen
    //  Criadas sob demanda. Estilos injetados uma única vez.
    // ─────────────────────────────────────────────────────────────────────────

    const UI = (() => {
        let _stylesOk = false;

        function _estilos() {
            if (_stylesOk || document.getElementById("__app_init_styles")) {
                _stylesOk = true;
                return;
            }
            _stylesOk = true;

            const s = document.createElement("style");
            s.id = "__app_init_styles";
            s.textContent = `
                #app-loading-screen {
                    position: fixed; inset: 0;
                    background: var(--fundo, #f7f4ee);
                    z-index: 99997;
                    display: flex; align-items: center; justify-content: center;
                    transition: opacity 0.35s ease;
                }
                #app-loading-screen.saindo { opacity: 0; pointer-events: none; }

                .app-loading-inner {
                    display: flex; flex-direction: column;
                    align-items: center; gap: 14px;
                }
                .app-loading-spinner {
                    width: 44px; height: 44px;
                    border: 4px solid rgba(26,102,65,0.2);
                    border-top-color: #1a6641;
                    border-radius: 50%;
                    animation: __appSpin 0.8s linear infinite;
                }
                @keyframes __appSpin { to { transform: rotate(360deg); } }

                .app-loading-titulo {
                    font-family: 'DM Serif Display', serif;
                    font-size: 1.1rem; color: var(--texto, #1c1a17); margin: 0;
                }
                .app-loading-sub {
                    font-size: 0.82rem; color: var(--texto-fraco, #888);
                    margin: 0; font-family: 'DM Sans', Arial, sans-serif;
                    min-height: 1.2em;
                }

                #app-error-screen {
                    position: fixed; inset: 0;
                    background: var(--fundo, #f7f4ee);
                    z-index: 99996;
                    display: none; align-items: center; justify-content: center;
                    padding: 2rem;
                }
                #app-error-screen.visivel { display: flex; }

                .app-error-inner { max-width: 440px; text-align: center; }
                .app-error-icone { font-size: 3rem; margin-bottom: 1rem; }
                .app-error-titulo {
                    font-family: 'DM Serif Display', serif;
                    font-size: 1.3rem; color: #c53030; margin-bottom: 0.5rem;
                }
                .app-error-msg {
                    font-size: 0.88rem; color: var(--texto-fraco, #666);
                    margin-bottom: 1.5rem; line-height: 1.6;
                    font-family: 'DM Sans', Arial, sans-serif;
                }
                .app-error-detalhe {
                    font-size: 0.75rem; color: #999; background: #f0ede6;
                    border-radius: 8px; padding: 8px 12px; margin-bottom: 1.2rem;
                    font-family: monospace; text-align: left;
                    max-height: 120px; overflow-y: auto; display: none;
                }
                .app-error-actions {
                    display: flex; gap: 10px;
                    justify-content: center; flex-wrap: wrap;
                }
                .app-error-btn {
                    padding: 10px 24px; background: #1a6641; color: #fff;
                    border: none; border-radius: 10px; font-size: 0.9rem;
                    font-weight: 600; cursor: pointer;
                    font-family: 'DM Sans', Arial, sans-serif;
                    transition: background 0.15s;
                }
                .app-error-btn:hover { background: #155230; }
                .app-error-btn.sec {
                    background: transparent; color: #666;
                    border: 1.5px solid #ccc;
                }
                .app-error-btn.sec:hover { border-color: #999; color: #333; }
            `;
            document.head.appendChild(s);
        }

        function criarLoading() {
            if (document.getElementById("app-loading-screen")) return;
            _estilos();

            const loading = document.createElement("div");
            loading.id = "app-loading-screen";
            loading.innerHTML = `
                <div class="app-loading-inner">
                    <div class="app-loading-spinner"></div>
                    <p class="app-loading-titulo">Colégio Antônio Costa</p>
                    <p class="app-loading-sub" id="app-loading-msg">Inicializando...</p>
                </div>`;
            document.body.appendChild(loading);

            const erro = document.createElement("div");
            erro.id = "app-error-screen";
            erro.innerHTML = `
                <div class="app-error-inner">
                    <div class="app-error-icone">⚠️</div>
                    <div class="app-error-titulo">Falha na inicialização</div>
                    <div class="app-error-msg" id="app-error-msg">
                        O sistema encontrou um problema e não pôde continuar.
                    </div>
                    <div class="app-error-detalhe" id="app-error-detalhe"></div>
                    <div class="app-error-actions">
                        <button class="app-error-btn" onclick="location.reload()">🔄 Recarregar</button>
                        <button class="app-error-btn sec" onclick="AppInit._retry()">↩ Tentar novamente</button>
                    </div>
                </div>`;
            document.body.appendChild(erro);
        }

        function setMsg(msg) {
            const el = document.getElementById("app-loading-msg");
            if (el) el.textContent = msg;
        }

        function esconderLoading() {
            const el = document.getElementById("app-loading-screen");
            if (!el) return;
            el.classList.add("saindo");
            setTimeout(() => el.remove(), 400);
        }

        function mostrarErro(msg, detalhe) {
            const el = document.getElementById("app-error-screen");
            if (!el) return;
            const msgEl = document.getElementById("app-error-msg");
            const detEl = document.getElementById("app-error-detalhe");
            if (msgEl) msgEl.textContent = msg;
            if (detalhe && detEl) {
                detEl.textContent   = detalhe;
                detEl.style.display = "block";
            }
            el.classList.add("visivel");
            esconderLoading();
        }

        function esconderErro() {
            const el = document.getElementById("app-error-screen");
            if (el) el.classList.remove("visivel");
        }

        return Object.freeze({ criarLoading, setMsg, esconderLoading, mostrarErro, esconderErro });
    })();

    // ─────────────────────────────────────────────────────────────────────────
    //  UTILITÁRIOS INTERNOS
    // ─────────────────────────────────────────────────────────────────────────

    function _esperar(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    function _emit(evento, detalhe) {
        document.dispatchEvent(new CustomEvent(evento, { detail: detalhe || {} }));
    }

    function _paginaAtual() {
        return global.location.pathname.split("/").pop() || "";
    }

    function _ehPaginaPublica() {
        return CFG.PAGINAS_PUBLICAS.includes(_paginaAtual());
    }

    // Polling não-bloqueante. Retorna true/false, nunca lança.
    async function _poll(predicate, maxMs) {
        const limite = maxMs != null ? maxMs : CFG.POLL_MAX_MS;
        const inicio = Date.now();
        while (!predicate()) {
            if (Date.now() - inicio >= limite) return false;
            await _esperar(CFG.POLL_INTERVAL);
        }
        return true;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  FASE 1 — BOOT
    //  Carrega o ambiente local (DOM, Auth, Notif).
    //  Sem rede, sem Supabase. Falha aqui é genuinamente crítica.
    // ─────────────────────────────────────────────────────────────────────────

    const Boot = (() => {

        // Notif stub — usado quando Notifications.js não carregou (404, bloqueio, etc.)
        // Mantém a API completa mas sem UI. AppLog registra tudo normalmente.
        const _notifStub = Object.freeze({
            sucesso:   (t, m) => AppLog.info("NotifStub",  `[sucesso] ${t}${m ? " — " + m : ""}`),
            erro:      (t, m) => AppLog.error("NotifStub", `[erro] ${t}${m ? " — " + m : ""}`),
            aviso:     (t, m) => AppLog.warn("NotifStub",  `[aviso] ${t}${m ? " — " + m : ""}`),
            info:      (t, m) => AppLog.info("NotifStub",  `[info] ${t}${m ? " — " + m : ""}`),
            confirmar: ()     => Promise.resolve(false),
            _show:     ()     => {},
        });

        async function _aguardarDOM() {
            if (document.readyState !== "loading") return;
            await new Promise(r => document.addEventListener("DOMContentLoaded", r, { once: true }));
        }

        // Aguarda um módulo crítico — lança se não chegar
        async function _exigirModulo(apelido, predicate) {
            const ok = await _poll(predicate);
            if (!ok) {
                throw new Error(
                    `Módulo crítico "${apelido}" não carregou em ${CFG.POLL_MAX_MS}ms. ` +
                    `Verifique se o arquivo está no servidor e o nome está correto.`
                );
            }
            AppLog.info("Boot", `✓ ${apelido} (crítico)`);
        }

        // Aguarda um módulo opcional — instala stub se não chegar, nunca lança
        async function _tentarModulo(apelido, predicate, instalarStub) {
            const ok = await _poll(predicate, 3000); // timeout menor para opcionais
            if (ok) {
                AppLog.info("Boot", `✓ ${apelido}`);
            } else {
                AppLog.warn("Boot", `⚠ ${apelido} indisponível — usando substituto`);
                instalarStub();
            }
        }

        async function executar() {
            UI.setMsg("Aguardando DOM...");
            await _aguardarDOM();

            UI.setMsg("Carregando módulos...");

            // Auth é crítico — sem ele não há controle de acesso
            await _exigirModulo("Auth",
                () => !!global.Auth &&
                      typeof global.Auth.getSessao === "function" &&
                      typeof global.Auth.init      === "function"
            );

            // Notif é degradável — se o arquivo não existir no servidor,
            // o sistema continua com um stub silencioso
            await _tentarModulo(
                "Notif",
                () => !!global.Notif && typeof global.Notif.sucesso === "function",
                () => { global.Notif = _notifStub; }
            );

            UI.setMsg("Inicializando autenticação...");
            await global.Auth.init();

            AppLog.info("Boot", "Fase concluída");
        }

        return Object.freeze({ executar });
    })();

    // ─────────────────────────────────────────────────────────────────────────
    //  FASE 2 — AUTH CHECK
    //  Verifica sessão e impõe controle de acesso.
    //  Retorna false + redireciona se não autenticado (sem lançar erro).
    //  Isolada do Boot para ser clara, testável e fácil de modificar.
    // ─────────────────────────────────────────────────────────────────────────

    const AuthCheck = (() => {

        function executar() {
            if (_ehPaginaPublica()) {
                AppLog.info("AuthCheck", `Página pública — sem verificação (${_paginaAtual()})`);
                return true;
            }

            UI.setMsg("Verificando acesso...");

            const sessao = global.Auth.getSessao();

            if (!sessao) {
                AppLog.warn("AuthCheck", "Sessão ausente ou expirada — redirecionando para login");
                const redirect = encodeURIComponent(global.location.pathname + global.location.search);
                global.location.replace(`login.html?redirect=${redirect}`);
                return false;
            }

            AppLog.info("AuthCheck", `Acesso autorizado — ${sessao.usuario} (${sessao.role})`);
            global.Auth.renderHeaderUsuario();
            return true;
        }

        return Object.freeze({ executar });
    })();

    // ─────────────────────────────────────────────────────────────────────────
    //  FASE 3 — DATA LAYER
    //  Verifica e expõe o estado do Supabase.
    //  NUNCA bloqueia o app. NUNCA executa queries.
    //  Emite app:supabase para que módulos de negócio decidam como agir.
    //  Avisa o usuário via Notif se o cliente não estiver disponível.
    // ─────────────────────────────────────────────────────────────────────────

    const DataLayer = (() => {

        let _disponivel = false;

        function _clienteValido() {
            return (
                typeof global.supabase !== "undefined" &&
                typeof global.db       !== "undefined" &&
                typeof global.db.from  === "function"
            );
        }

        async function executar() {
            // Polling curto — Supabase CDN pode chegar ligeiramente depois do app:pronto
            const chegou = await _poll(_clienteValido, CFG.SUPABASE_POLL_MAX_MS);

            _disponivel = chegou && _clienteValido();

            if (_disponivel) {
                AppLog.info("DataLayer", "Supabase disponível");
            } else {
                AppLog.warn("DataLayer", "Supabase indisponível — dados não carregarão");
                if (global.Notif) {
                    Notif.aviso(
                        "Banco de dados indisponível",
                        "Verifique sua conexão. Os dados não carregarão até a reconexão."
                    );
                }
            }

            _emit("app:supabase", { disponivel: _disponivel });
        }

        function isDisponivel() { return _disponivel; }

        return Object.freeze({ executar, isDisponivel });
    })();

    // ─────────────────────────────────────────────────────────────────────────
    //  ORQUESTRADOR
    // ─────────────────────────────────────────────────────────────────────────

    let _iniciando  = false;
    let _retryCount = 0;
    let _timeoutId  = null;

    async function _executarInit() {
        AppState._set(ESTADOS.LOADING);
        UI.criarLoading();
        UI.esconderErro();

        _timeoutId = setTimeout(() => {
            if (!AppState.isLoading()) return;
            AppLog.error("AppInit", `Timeout de ${CFG.TIMEOUT_BOOT}ms atingido`);
            AppState._set(ESTADOS.ERROR);
            UI.mostrarErro(
                "O sistema demorou demais para inicializar.",
                "Verifique sua conexão e recarregue a página."
            );
            _iniciando = false;
        }, CFG.TIMEOUT_BOOT);

        try {
            // Fase 1 — Boot local (obrigatório, pode falhar e acionar retry)
            await Boot.executar();

            // Fase 2 — Auth (controle de acesso, pode redirecionar)
            const autorizado = AuthCheck.executar();
            if (!autorizado) {
                clearTimeout(_timeoutId);
                return;
            }

            // App pronto — liberar UI antes de qualquer operação de rede
            clearTimeout(_timeoutId);
            _retryCount = 0;
            _iniciando  = false;
            AppState._set(ESTADOS.READY);
            AppLog.info("AppInit", "Sistema pronto");
            UI.esconderLoading();
            _emit("app:pronto");

            // Fase 3 — Data layer (assíncrono, pós-pronto, sem bloquear)
            DataLayer.executar().catch(err => {
                AppLog.error("DataLayer", "Erro inesperado", err?.message);
            });

        } catch (err) {
            clearTimeout(_timeoutId);
            AppLog.error("AppInit", "Falha no boot", err?.message);

            if (_retryCount < CFG.MAX_RETRY_BOOT) {
                _retryCount++;
                _iniciando = false;
                AppState._set(ESTADOS.RECOVERING);
                UI.setMsg(`Tentando novamente... (${_retryCount}/${CFG.MAX_RETRY_BOOT})`);
                AppLog.warn("AppInit", `Retry ${_retryCount}/${CFG.MAX_RETRY_BOOT}`);
                await _esperar(1800);
                return _executarInit();
            }

            _iniciando = false;
            AppState._set(ESTADOS.ERROR);
            UI.mostrarErro(
                "Não foi possível inicializar o sistema.",
                err?.message || "Erro desconhecido"
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  API PÚBLICA
    // ─────────────────────────────────────────────────────────────────────────

    global.AppInit = Object.freeze({

        inicializar() {
            if (_iniciando || AppState.isReady()) return;
            _iniciando  = true;
            _retryCount = 0;
            _executarInit();
        },

        // Retry manual exposto para o botão na tela de erro
        _retry() {
            if (_iniciando) return;
            _iniciando = true;
            AppLog.info("AppInit", "Retry manual");
            _executarInit();
        },

        // Expõe camadas para uso por monitor.js, dev-panel.js, etc.
        Boot,
        AuthCheck,
        DataLayer,
        UI,
        CFG,
    });

})(window);