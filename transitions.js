// transitions.js — transições suaves entre páginas (SPA-like sem framework)

(function () {

    const DURACAO_FADE = 200; // ms

    // ===================== ESTILOS =====================
    const style = document.createElement("style");
    style.textContent = `
        /* Fade de saída na navegação */
        body.page-saindo {
            opacity: 0;
            transition: opacity ${DURACAO_FADE}ms ease;
            pointer-events: none;
        }

        /* Fade de entrada ao carregar */
        body.page-entrando {
            opacity: 0;
            transition: opacity ${DURACAO_FADE}ms ease;
        }

        /* Links de navegação com indicador de carregamento */
        .header-nav a.carregando::after {
            content: '';
            display: inline-block;
            width: 8px;
            height: 8px;
            border: 2px solid rgba(255,255,255,0.5);
            border-top-color: #fff;
            border-radius: 50%;
            animation: navSpin 0.6s linear infinite;
            margin-left: 6px;
            vertical-align: middle;
        }

        @keyframes navSpin {
            to { transform: rotate(360deg); }
        }

        /* Barra de progresso de topo */
        #nav-progress {
            position: fixed;
            top: 0;
            left: 0;
            width: 0%;
            height: 3px;
            background: var(--amarelo, #c8a84b);
            z-index: 99999;
            transition: width 0.3s ease, opacity 0.3s ease;
            opacity: 0;
        }
        #nav-progress.ativo {
            opacity: 1;
        }
    `;
    document.head.appendChild(style);

    // ===================== BARRA DE PROGRESSO =====================
    function criarProgressBar() {
        if (document.getElementById("nav-progress")) return;
        const bar = document.createElement("div");
        bar.id = "nav-progress";
        document.body.appendChild(bar);
    }

    let progressTimer = null;

    function iniciarProgresso() {
        const bar = document.getElementById("nav-progress");
        if (!bar) return;
        bar.style.width = "0%";
        bar.classList.add("ativo");

        let w = 0;
        clearInterval(progressTimer);
        progressTimer = setInterval(() => {
            // Progresso rápido no início, desacelera depois
            w += w < 50 ? 8 : w < 80 ? 3 : 0.5;
            if (w > 92) w = 92;
            bar.style.width = w + "%";
        }, 80);
    }

    function concluirProgresso() {
        const bar = document.getElementById("nav-progress");
        if (!bar) return;
        clearInterval(progressTimer);
        bar.style.width = "100%";
        setTimeout(() => {
            bar.classList.remove("ativo");
            bar.style.width = "0%";
        }, 300);
    }

    // ===================== FADE DE ENTRADA =====================
    function fadeEntrada() {
        document.body.classList.add("page-entrando");
        // Força reflow antes de remover a classe
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                document.body.classList.remove("page-entrando");
            });
        });
    }

    // ===================== INTERCEPTAR LINKS DE NAV =====================
    function interceptarLinks() {
        document.querySelectorAll(".header-nav a").forEach(link => {
            link.addEventListener("click", (e) => {
                const href = link.getAttribute("href");
                if (!href || href.startsWith("http") || href.startsWith("#")) return;

                // Não animar se já estiver na página
                const atual = window.location.pathname.split("/").pop() || "index.html";
                if (href === atual) return;

                e.preventDefault();

                // Feedback visual no link clicado
                link.classList.add("carregando");
                iniciarProgresso();

                // Fade de saída
                document.body.classList.add("page-saindo");

                setTimeout(() => {
                    concluirProgresso();
                    window.location.href = href;
                }, DURACAO_FADE + 20);
            });
        });
    }

    // ===================== INICIALIZAR =====================
    function iniciar() {
        criarProgressBar();
        fadeEntrada();

        // Interceptar links assim que o DOM estiver pronto
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", interceptarLinks);
        } else {
            interceptarLinks();
        }
    }

    // Auto-iniciar imediatamente (não precisa esperar app:pronto)
    iniciar();

    window.Transitions = { iniciar, fadeEntrada };

})();