const MATEUS_CONFIG = {
  supabaseUrl: "COLE_AQUI_A_URL_DO_SUPABASE",
  supabaseAnonKey: "COLE_AQUI_A_CHAVE_ANON",
  whatsappNumber: "5599999999999",
  adminPassword: "mateus123",
  defaultSlots: ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00"],
  services: [
    { id: "corte", name: "Corte masculino", duration: "45 min", price: 35 },
    { id: "barba", name: "Barba desenhada", duration: "30 min", price: 25 },
    { id: "combo", name: "Corte + barba", duration: "1h 15 min", price: 55 },
    { id: "sobrancelha", name: "Sobrancelha", duration: "15 min", price: 15 }
  ]
};
