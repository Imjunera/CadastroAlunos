// ===================== CONFIG GLOBAL =====================
const BASE_URL = "https://imjunera.github.io/CadastroAlunos";
const SUPA_URL = "https://yhfrfziqehannqbfgpaw.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloZnJmemlxZWhhbm5xYmZncGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3OTMyMDYsImV4cCI6MjA5MTM2OTIwNn0.Uj6JKsH4cKsvAs__xZqOkD9TPf0ntOkCxunFy0TubiY";

const { createClient } = window.supabase;
const db = createClient(SUPA_URL, SUPA_KEY);

// ===================== TURNOS =====================
// Cada turno tem início e fim em minutos desde meia-noite
const TURNOS = [
    { nome: "Manhã",  inicio:  6 * 60 + 45, fim: 13 * 60 },
    { nome: "Tarde",  inicio: 13 * 60,       fim: 18 * 60 },
    { nome: "Noite",  inicio: 19 * 60,       fim: 24 * 60 },
];

function minutosDoDia() {
    const agora = new Date();
    return agora.getHours() * 60 + agora.getMinutes();
}

function turnoAtual() {
    const m = minutosDoDia();
    return TURNOS.find(t => m >= t.inicio && m < t.fim) || null;
}

// Retorna o intervalo ISO do turno atual (ou do turno especificado)
function intervaloPorTurno(turno) {
    const hoje = new Date().toISOString().split("T")[0];
    const pad  = n => String(Math.floor(n / 60)).padStart(2,"0") + ":" + String(n % 60).padStart(2,"0") + ":00";
    return {
        inicio: `${hoje}T${pad(turno.inicio)}`,
        fim:    turno.fim === 24 * 60
            ? `${hoje}T23:59:59`
            : `${hoje}T${pad(turno.fim)}`
    };
}