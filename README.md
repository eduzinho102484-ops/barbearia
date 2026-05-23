# Mateus Barber

Sistema estático para agendamento de barbearia com área do cliente, painel admin e integração com Supabase.

## Arquivos

- `index.html`: tela do cliente.
- `admin.html`: painel administrativo.
- `styles.css`: visual escuro premium e responsivo.
- `app.js`: agendamento, horários e WhatsApp.
- `admin.js`: login, dashboard, horários e status dos atendimentos.
- `supabase-config.js`: configurações do Supabase, WhatsApp, senha e serviços.

## Configuração

1. Crie um projeto no Supabase.
2. Rode o SQL abaixo no editor SQL do Supabase.
3. Copie a Project URL e a `anon public key` para `supabase-config.js`.
4. Troque `whatsappNumber` pelo número do barbeiro com DDI e DDD.

```sql
create table if not exists public.available_slots (
  id uuid primary key default gen_random_uuid(),
  time time not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  service_id text not null,
  service_name text not null,
  service_price numeric(10, 2) not null,
  customer_name text not null,
  customer_location text not null,
  observation text,
  date date not null,
  time time not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (date, time)
);

alter table public.available_slots enable row level security;
alter table public.appointments enable row level security;

create policy "Public read slots"
on public.available_slots for select
using (true);

create policy "Public manage slots"
on public.available_slots for all
using (true)
with check (true);

create policy "Public read appointments"
on public.appointments for select
using (true);

create policy "Public create appointments"
on public.appointments for insert
with check (true);

create policy "Public update appointments"
on public.appointments for update
using (true)
with check (true);

insert into public.available_slots (time)
values ('08:00'), ('09:00'), ('10:00'), ('11:00'), ('14:00'), ('15:00'), ('16:00'), ('17:00'), ('18:00')
on conflict (time) do nothing;
```

> Para produção, substitua o login simples por autenticação real do Supabase e endureça as políticas de segurança.

## Modo demo

Enquanto `supabase-config.js` estiver sem URL e chave reais, o sistema usa `localStorage`. Isso permite testar cliente e admin imediatamente no navegador.
