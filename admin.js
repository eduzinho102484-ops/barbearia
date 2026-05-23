const supabaseClient = createSupabaseClient();
const storageKey = "mateus_barber_demo_data";

const loginView = document.querySelector("#loginView");
const dashboardView = document.querySelector("#dashboardView");
const loginForm = document.querySelector("#loginForm");
const logoutButton = document.querySelector("#logoutButton");
const adminDate = document.querySelector("#adminDate");
const slotForm = document.querySelector("#slotForm");
const newSlot = document.querySelector("#newSlot");
const slotsAdminList = document.querySelector("#slotsAdminList");
const appointmentsList = document.querySelector("#appointmentsList");
const dailyRevenue = document.querySelector("#dailyRevenue");
const completedCount = document.querySelector("#completedCount");
const todayCount = document.querySelector("#todayCount");

initializeAdminApp();

function initializeAdminApp() {
  adminDate.value = toDateInputValue(new Date());
  loginForm.addEventListener("submit", handleLogin);
  logoutButton.addEventListener("click", handleLogout);
  slotForm.addEventListener("submit", handleSlotCreate);
  adminDate.addEventListener("change", refreshDashboard);

  if (sessionStorage.getItem("mateus_admin_logged") === "true") showDashboard();
}

function createSupabaseClient() {
  // Sem credenciais reais, o painel compartilha dados de teste via localStorage.
  const configured = MATEUS_CONFIG.supabaseUrl.startsWith("http") && MATEUS_CONFIG.supabaseAnonKey.length > 20;
  if (!configured || !window.supabase) return null;
  return window.supabase.createClient(MATEUS_CONFIG.supabaseUrl, MATEUS_CONFIG.supabaseAnonKey);
}

function handleLogin(event) {
  event.preventDefault();
  const password = document.querySelector("#adminPassword").value;
  if (password !== MATEUS_CONFIG.adminPassword) {
    alert("Senha incorreta.");
    return;
  }
  sessionStorage.setItem("mateus_admin_logged", "true");
  showDashboard();
}

function handleLogout() {
  sessionStorage.removeItem("mateus_admin_logged");
  loginView.classList.remove("is-hidden");
  dashboardView.classList.add("is-hidden");
}

async function showDashboard() {
  loginView.classList.add("is-hidden");
  dashboardView.classList.remove("is-hidden");
  await refreshDashboard();
}

async function refreshDashboard() {
  // Mantém cartões, lista de horários e agenda sincronizados com a data filtrada.
  const [slots, appointments] = await Promise.all([getAvailableSlots(), getAppointments()]);
  renderSlots(slots);
  renderAppointments(appointments);
  renderStats(appointments);
}

async function getAvailableSlots() {
  if (!supabaseClient) return getDemoData().slots;

  const { data, error } = await supabaseClient.from("available_slots").select("*").order("time");
  if (error) {
    alert("Falha ao carregar horários.");
    return [];
  }
  return data.map((slot) => slot.time.slice(0, 5));
}

async function getAppointments() {
  const date = adminDate.value;
  if (!supabaseClient) return getDemoData().appointments.filter((appointment) => appointment.date === date);

  const { data, error } = await supabaseClient.from("appointments").select("*").eq("date", date).order("time");
  if (error) {
    alert("Falha ao carregar agendamentos.");
    return [];
  }
  return data;
}

function renderSlots(slots) {
  slotsAdminList.innerHTML = slots
    .map((slot) => `
      <span class="chip">
        ${slot}
        <button type="button" aria-label="Remover ${slot}" data-remove-slot="${slot}">x</button>
      </span>
    `)
    .join("");

  slotsAdminList.querySelectorAll("[data-remove-slot]").forEach((button) => {
    button.addEventListener("click", () => removeSlot(button.dataset.removeSlot));
  });
}

function renderAppointments(appointments) {
  if (!appointments.length) {
    appointmentsList.innerHTML = `<p class="feedback">Nenhum agendamento para esta data.</p>`;
    return;
  }

  appointmentsList.innerHTML = appointments
    .map((appointment) => `
      <article class="appointment-card">
        <header>
          <div>
            <h3>${appointment.time.slice(0, 5)} - ${appointment.customer_name}</h3>
            <p>${appointment.service_name} • ${formatCurrency(Number(appointment.service_price || 0))}</p>
          </div>
          <span class="status-pill">${translateStatus(appointment.status)}</span>
        </header>
        <p><strong>Local:</strong> ${appointment.customer_location}</p>
        <p><strong>Observação:</strong> ${appointment.observation || "Sem observação"}</p>
        <div class="appointment-actions">
          <button class="success-button" type="button" data-complete="${appointment.id}">Concluir</button>
          <button class="danger-button" type="button" data-cancel="${appointment.id}">Cancelar</button>
        </div>
      </article>
    `)
    .join("");

  appointmentsList.querySelectorAll("[data-complete]").forEach((button) => {
    button.addEventListener("click", () => updateAppointmentStatus(button.dataset.complete, "completed"));
  });
  appointmentsList.querySelectorAll("[data-cancel]").forEach((button) => {
    button.addEventListener("click", () => updateAppointmentStatus(button.dataset.cancel, "cancelled"));
  });
}

function renderStats(appointments) {
  // O faturamento considera apenas atendimentos marcados como concluídos.
  const completed = appointments.filter((appointment) => appointment.status === "completed");
  const scheduledToday = appointments.filter((appointment) => appointment.status !== "cancelled");
  const revenue = completed.reduce((total, appointment) => total + Number(appointment.service_price || 0), 0);

  dailyRevenue.textContent = formatCurrency(revenue);
  completedCount.textContent = completed.length;
  todayCount.textContent = scheduledToday.length;
}

async function handleSlotCreate(event) {
  event.preventDefault();
  const time = newSlot.value;
  if (!time) return;

  if (!supabaseClient) {
    const demoData = getDemoData();
    demoData.slots = Array.from(new Set([...demoData.slots, time])).sort();
    saveDemoData(demoData);
  } else {
    const { error } = await supabaseClient.from("available_slots").insert({ time });
    if (error) alert("Este horário já existe ou não pôde ser salvo.");
  }

  slotForm.reset();
  await refreshDashboard();
}

async function removeSlot(time) {
  if (!confirm(`Remover o horário ${time}?`)) return;

  if (!supabaseClient) {
    const demoData = getDemoData();
    demoData.slots = demoData.slots.filter((slot) => slot !== time);
    saveDemoData(demoData);
  } else {
    const { error } = await supabaseClient.from("available_slots").delete().eq("time", time);
    if (error) alert("Não foi possível remover o horário.");
  }

  await refreshDashboard();
}

async function updateAppointmentStatus(id, status) {
  if (!supabaseClient) {
    const demoData = getDemoData();
    demoData.appointments = demoData.appointments.map((appointment) => (
      appointment.id === id ? { ...appointment, status } : appointment
    ));
    saveDemoData(demoData);
  } else {
    const { error } = await supabaseClient.from("appointments").update({ status }).eq("id", id);
    if (error) alert("Não foi possível atualizar o agendamento.");
  }

  await refreshDashboard();
}

function getDemoData() {
  const existing = localStorage.getItem(storageKey);
  if (existing) return JSON.parse(existing);
  const initialData = { slots: MATEUS_CONFIG.defaultSlots, appointments: [] };
  saveDemoData(initialData);
  return initialData;
}

function saveDemoData(data) {
  localStorage.setItem(storageKey, JSON.stringify(data));
}

function translateStatus(status) {
  const statuses = {
    scheduled: "Agendado",
    completed: "Concluído",
    cancelled: "Cancelado"
  };
  return statuses[status] || status;
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCurrency(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
