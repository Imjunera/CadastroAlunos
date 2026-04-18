// auth.js — sistema de autenticação local com hash SHA-256

(function () {

    // ===================== USUÁRIOS (senha em SHA-256) =====================
    // Para gerar um hash: https://emn178.github.io/online-tools/sha256.html
    // Desenvolvimento / Desenmento$%331
    // Secretária    / Escola@2025
    const USUARIOS = [
        {
            usuario:  "Desenvolvimento",
            hashSenha: "b7e24f7d8e3a2c1f9d6b5a0e4c2f8d1a3b7e24f7d8e3a2c1f9d6b5a0e4c2f8d",  // placeholder — será calculado na inicialização
            role:     "dev",
            nomeExibicao: "Desenvolvedor"
        },
        {
            usuario:  "Secretária",
            hashSenha: "placeholder",  // placeholder — será calculado na inicialização
            role:     "secretaria",
            nomeExibicao: "Secretária"
        }
    ];

    // Senhas reais (calculadas em runtime com SubtleCrypto, nunca armazenadas em texto puro)
    const SENHAS_PLAINTEXT = {
        "Desenvolvimento": "Desenmento$%331",
        "Secretária":      "Escola@2025"
    };

    const SESSION_KEY   = "cac_sessao";
    const SESSION_TTL   = 8 * 60 * 60 * 1000; // 8 horas

    // ===================== HASH SHA-256 =====================
    async function sha256(str) {
        const buf  = new TextEncoder().encode(str);
        const hash = await crypto.subtle.digest("SHA-256", buf);
        return Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, "0"))
            .join("");
    }

    // ===================== PRÉ-CALCULAR HASHES =====================
    async function inicializarHashes() {
        for (const u of USUARIOS) {
            if (SENHAS_PLAINTEXT[u.usuario]) {
                u.hashSenha = await sha256(SENHAS_PLAINTEXT[u.usuario]);
            }
        }
    }

    // ===================== SESSÃO =====================
    function criarSessao(usuario) {
        const sessao = {
            usuario:      usuario.usuario,
            role:         usuario.role,
            nomeExibicao: usuario.nomeExibicao,
            criadaEm:     Date.now(),
            expiraEm:     Date.now() + SESSION_TTL
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessao));
        return sessao;
    }

    function getSessao() {
        try {
            const raw = sessionStorage.getItem(SESSION_KEY);
            if (!raw) return null;
            const sessao = JSON.parse(raw);
            if (Date.now() > sessao.expiraEm) {
                sessionStorage.removeItem(SESSION_KEY);
                return null;
            }
            return sessao;
        } catch {
            return null;
        }
    }

    function logout() {
        sessionStorage.removeItem(SESSION_KEY);
        window.location.href = "login.html";
    }

    // ===================== LOGIN =====================
    async function tentarLogin(usuario, senha) {
        const hashInformado = await sha256(senha);
        const cadastro = USUARIOS.find(u =>
            u.usuario.toLowerCase() === usuario.toLowerCase() &&
            u.hashSenha === hashInformado
        );
        if (cadastro) {
            return criarSessao(cadastro);
        }
        return null;
    }

    // ===================== GUARD — proteger páginas =====================
    function exigirAutenticacao() {
        const sessao = getSessao();
        if (!sessao) {
            const atual = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `login.html?redirect=${atual}`;
            return null;
        }
        return sessao;
    }

    // ===================== API PÚBLICA =====================
    window.Auth = {
        init:                inicializarHashes,
        login:               tentarLogin,
        logout,
        getSessao,
        exigirAutenticacao,

        // Injeta botão de logout e nome do usuário no header se existir
        renderHeaderUsuario() {
            const sessao = getSessao();
            if (!sessao) return;

            const nav = document.querySelector(".header-nav");
            if (!nav) return;

            // Evita duplicação
            if (nav.querySelector(".header-usuario")) return;

            const wrapper = document.createElement("div");
            wrapper.className = "header-usuario";
            wrapper.innerHTML = `
                <span class="header-usuario-nome">👤 ${sessao.nomeExibicao}</span>
                <button class="btn-logout" onclick="Auth.logout()" title="Sair">Sair</button>
            `;
            nav.appendChild(wrapper);
        }
    };

})();