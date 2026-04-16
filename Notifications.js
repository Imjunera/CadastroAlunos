// ===================== SISTEMA DE NOTIFICAÇÕES =====================
// Substitui todos os alert(), confirm() e prompt() nativos

(function () {

    function init() {

        // ── Injetar estilos ──────────────────────────────────────────
        const style = document.createElement("style");
        style.textContent = `
            /* Toast container */
            #toast-container {
                position: fixed;
                top: 76px;
                right: 1.25rem;
                z-index: 99999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            }

            .toast {
                display: flex;
                align-items: flex-start;
                gap: 12px;
                background: #fff;
                border-radius: 12px;
                border: 1px solid #e0ddd8;
                padding: 14px 16px;
                min-width: 280px;
                max-width: 360px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.12);
                pointer-events: all;
                animation: toastIn 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards;
                position: relative;
                overflow: hidden;
            }

            .toast.saindo {
                animation: toastOut 0.22s ease forwards;
            }

            @keyframes toastIn {
                from { opacity:0; transform: translateX(40px); }
                to   { opacity:1; transform: translateX(0); }
            }

            @keyframes toastOut {
                from { opacity:1; transform: translateX(0); max-height:100px; }
                to   { opacity:0; transform: translateX(40px); max-height:0; padding:0; margin:0; }
            }

            .toast-barra {
                position: absolute;
                bottom: 0; left: 0;
                height: 3px;
                border-radius: 0 0 0 12px;
                animation: toastBarra linear forwards;
            }

            @keyframes toastBarra {
                from { width: 100%; }
                to   { width: 0%; }
            }

            .toast-icone {
                font-size: 1.15rem;
                flex-shrink: 0;
                margin-top: 1px;
            }

            .toast-corpo { flex: 1; }

            .toast-titulo {
                font-weight: 600;
                font-size: 0.88rem;
                color: #1c1a17;
                margin-bottom: 2px;
                font-family: 'DM Sans', Arial, sans-serif;
            }

            .toast-msg {
                font-size: 0.82rem;
                color: #6b6560;
                font-family: 'DM Sans', Arial, sans-serif;
                line-height: 1.4;
            }

            .toast-fechar {
                font-size: 1rem;
                cursor: pointer;
                color: #aaa;
                background: none;
                border: none;
                padding: 0;
                line-height: 1;
                flex-shrink: 0;
            }
            .toast-fechar:hover { color: #555; }

            /* Tipos */
            .toast.sucesso .toast-barra  { background: #1a6641; }
            .toast.erro    .toast-barra  { background: #b83232; }
            .toast.aviso   .toast-barra  { background: #c8a84b; }
            .toast.info    .toast-barra  { background: #185fa5; }

            /* Dialog (confirm) */
            #dialog-overlay {
                position: fixed;
                inset: 0;
                background: rgba(28,26,23,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99998;
                padding: 1rem;
                animation: fadeOverlay 0.18s ease;
            }

            @keyframes fadeOverlay {
                from { opacity:0; } to { opacity:1; }
            }

            .dialog-card {
                background: #fefefe;
                border-radius: 16px;
                border: 1px solid #ddd9d0;
                padding: 2rem 1.75rem;
                width: 100%;
                max-width: 360px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.14);
                animation: popIn 0.22s cubic-bezier(0.34,1.56,0.64,1);
                text-align: center;
            }

            @keyframes popIn {
                from { transform: scale(0.85); opacity:0; }
                to   { transform: scale(1);    opacity:1; }
            }

            .dialog-icone {
                font-size: 2rem;
                margin-bottom: 12px;
            }

            .dialog-titulo {
                font-family: 'DM Serif Display', serif;
                font-size: 1.15rem;
                color: #1c1a17;
                margin-bottom: 8px;
            }

            .dialog-msg {
                font-size: 0.88rem;
                color: #6b6560;
                margin-bottom: 1.5rem;
                line-height: 1.5;
                font-family: 'DM Sans', Arial, sans-serif;
            }

            .dialog-btns {
                display: flex;
                gap: 10px;
                justify-content: center;
            }

            .dialog-btn {
                padding: 9px 22px;
                border-radius: 8px;
                font-size: 0.88rem;
                font-weight: 600;
                cursor: pointer;
                border: none;
                font-family: 'DM Sans', Arial, sans-serif;
                transition: all 0.15s;
            }

            .dialog-btn.confirmar {
                background: #b83232;
                color: #fff;
            }
            .dialog-btn.confirmar:hover { background: #a02a2a; }

            .dialog-btn.cancelar {
                background: transparent;
                color: #6b6560;
                border: 1.5px solid #ddd9d0;
            }
            .dialog-btn.cancelar:hover { border-color: #bbb; color: #1c1a17; }
        `;
        document.head.appendChild(style);

        // ── Toast container ──────────────────────────────────────────
        const container = document.createElement("div");
        container.id = "toast-container";
        document.body.appendChild(container);

        // ── Toast ────────────────────────────────────────────────────
        const ICONES = { sucesso: "✓", erro: "✕", aviso: "!", info: "ℹ" };
        const DURACAO = { sucesso: 3500, erro: 5000, aviso: 4000, info: 3500 };

        window.Notif = {
            _show(tipo, titulo, msg) {
                const duracao = DURACAO[tipo] || 3500;
                const el = document.createElement("div");
                el.className = `toast ${tipo}`;
                el.innerHTML = `
                    <span class="toast-icone">${ICONES[tipo]}</span>
                    <div class="toast-corpo">
                        <div class="toast-titulo">${titulo}</div>
                        ${msg ? `<div class="toast-msg">${msg}</div>` : ""}
                    </div>
                    <button class="toast-fechar" onclick="this.closest('.toast').remove()">✕</button>
                    <div class="toast-barra" style="animation-duration:${duracao}ms"></div>
                `;
                container.appendChild(el);
                setTimeout(() => {
                    el.classList.add("saindo");
                    setTimeout(() => el.remove(), 230);
                }, duracao);
            },

            sucesso(titulo, msg = "")  { this._show("sucesso", titulo, msg); },
            erro(titulo, msg = "")     { this._show("erro",    titulo, msg); },
            aviso(titulo, msg = "")    { this._show("aviso",   titulo, msg); },
            info(titulo, msg = "")     { this._show("info",    titulo, msg); },

            // Confirm customizado — retorna Promise<boolean>
            confirmar(titulo, msg = "", icone = "⚠️") {
                return new Promise(resolve => {
                    const overlay = document.createElement("div");
                    overlay.id = "dialog-overlay";
                    overlay.innerHTML = `
                        <div class="dialog-card">
                            <div class="dialog-icone">${icone}</div>
                            <div class="dialog-titulo">${titulo}</div>
                            <div class="dialog-msg">${msg}</div>
                            <div class="dialog-btns">
                                <button class="dialog-btn cancelar" id="dlg-nao">Cancelar</button>
                                <button class="dialog-btn confirmar" id="dlg-sim">Confirmar</button>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(overlay);

                    overlay.querySelector("#dlg-sim").onclick = () => {
                        overlay.remove(); resolve(true);
                    };
                    overlay.querySelector("#dlg-nao").onclick = () => {
                        overlay.remove(); resolve(false);
                    };
                });
            }
        };
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();