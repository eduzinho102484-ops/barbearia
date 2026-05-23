const state = {
  selectedService: MATEUS_CONFIG.services[0],
  selectedTime: "",
  slots: [],
  appointments: []
};

const supabaseClient = createSupabaseClient();
const storageKey = "mateus_barber_demo_data";

const servicesList = document.querySelector("#servicesList");
const bookingDate = document.querySelector("#bookingDate");
const timeSlots = document.querySelector("#timeSlots");
const bookingForm = document.querySelector("#bookingForm");
const feedback = document.querySelector("#bookingFeedback");

initializeClientApp();

async function initializeClientApp() {
  bookingDate.min = toDateInputValue(new Date());
  bookingDate.value = toDateInputValue(new Date());
  renderServices();
  await refreshBookingData();
  bookingDate.addEventListener("change", refreshBookingData);
  bookingForm.addEventListener("submit", handleBookingSubmit);
}

function createSupabaseClient() {
  // Sem credenciais reais, o sistema roda em modo demo com localStorage.
  const configured = MATEUS_CONFIG.supabaseUrl.startsWith("http") && MATEUS_CONFIG.supabaseAnonKey.length > 20;
  if (!configured || !window.supabase) return null;
  return window.supabase.createClient(MATEUS_CONFIG.supabaseUrl, MATEUS_CONFIG.supabaseAnonKey);
}

function renderServices() {
  servicesList.innerHTML = MATEUS_CONFIG.services
    .map((service) => `
      <button class="service-card ${service.id === state.selectedService.id ? "is-selected" : ""}" type="button" data-service="${service.id}">
        <strong>${service.name}<b>${formatCurrency(service.price)}</b></strong>
        <span>${service.duration}</span>
      </button>
    `)
    .join("");

  servicesList.querySelectorAll(".service-card").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedService = MATEUS_CONFIG.services.find((service) => service.id === button.dataset.service);
      renderServices();
    });
  });
}

async function refreshBookingData() {
  state.selectedTime = "";
  const date = bookingDate.value;
  // Carrega horários e bloqueia os que já possuem agendamento ativo na data.
  state.slots = await getAvailableSlots();
  state.appointments = await getAppointmentsByDate(date);
  renderTimeSlots();
}

async function getAvailableSlots() {
  if (!supabaseClient) return getDemoData().slots;

  const { data, error } = await supabaseClient.from("available_slots").select("time").order("time");
  if (error) {
    showFeedback("Não foi possível carregar os horários.", "error");
    return [];
  }
  return data.map((slot) => slot.time.slice(0, 5));
}

async function getAppointmentsByDate(date) {
  if (!supabaseClient) return getDemoData().appointments.filter((appointment) => appointment.date === date && appointment.status !== "cancelled");

  const { data, error } = await supabaseClient
    .from("appointments")
    .select("*")
    .eq("date", date)
    .neq("status", "cancelled")
    .order("time");

  if (error) {
    showFeedback("Não foi possível carregar os agendamentos.", "error");
    return [];
  }
  return data;
}

function renderTimeSlots() {
  const occupiedTimes = new Set(state.appointments.map((appointment) => appointment.time.slice(0, 5)));

  if (!state.slots.length) {
    timeSlots.innerHTML = `<p class="feedback error">Nenhum horário cadastrado para agendamento.</p>`;
    return;
  }

  timeSlots.innerHTML = state.slots
    .map((slot) => {
      const blocked = occupiedTimes.has(slot);
      return `
        <button class="slot-button ${blocked ? "is-blocked" : ""}" type="button" data-time="${slot}" ${blocked ? "disabled" : ""}>
          ${slot}
        </button>
      `;
    })
    .join("");

  timeSlots.querySelectorAll(".slot-button:not(.is-blocked)").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedTime = button.dataset.time;
      timeSlots.querySelectorAll(".slot-button").forEach((slot) => slot.classList.remove("is-selected"));
      button.classList.add("is-selected");
    });
  });
}

async function handleBookingSubmit(event) {
  event.preventDefault();

  if (!state.selectedTime) {
    showFeedback("Selecione um horário disponível.", "error");
    return;
  }

  const appointment = {
    service_id: state.selectedService.id,
    service_name: state.selectedService.name,
    service_price: state.selectedService.price,
    customer_name: document.querySelector("#customerName").value.trim(),
    customer_location: document.querySelector("#customerLocation").value.trim(),
    observation: document.querySelector("#customerNote").value.trim(),
    date: bookingDate.value,
    time: state.selectedTime,
    status: "scheduled"
  };

  try {
    await saveAppointment(appointment);
    showFeedback("Agendamento salvo. Abrindo WhatsApp...", "success");
    window.open(buildWhatsappUrl(appointment), "_blank");
    bookingForm.reset();
    bookingDate.value = appointment.date;
    await refreshBookingData();
  } catch (error) {
    showFeedback(error.message || "Não foi possível salvar o agendamento.", "error");
  }
}

async function saveAppointment(appointment) {
  if (!supabaseClient) {
    const demoData = getDemoData();
    demoData.appointments.push({ ...appointment, id: crypto.randomUUID(), created_at: new Date().toISOString() });
    saveDemoData(demoData);
    return;
  }

  const { error } = await supabaseClient.from("appointments").insert(appointment);
  if (error) throw new Error("Horário indisponível ou falha ao salvar no Supabase.");
}

function buildWhatsappUrl(appointment) {
  // A mensagem fica pronta para o barbeiro confirmar pelo WhatsApp.
  const message = `Olá Mateus, gostaria de agendar um horário.
Nome: ${appointment.customer_name}
Data: ${formatDate(appointment.date)}
Horário: ${appointment.time}
Local: ${appointment.customer_location}
Observação: ${appointment.observation || "Sem observação"}`;

  return `https://wa.me/${MATEUS_CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
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

function showFeedback(message, type) {
  feedback.textContent = message;
  feedback.className = `feedback ${type}`;
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

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}
