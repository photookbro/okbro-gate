create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  phone text,
  purchase_count integer default 0,
  created_at timestamptz default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  order_number text unique,
  platform text,
  used_at timestamptz default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  name text,
  date date,
  drive_folder_a text,
  drive_folder_b text,
  created_at timestamptz default now()
);

create table downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  order_id uuid references orders(id),
  photo_id text,
  downloaded_at timestamptz default now()
);
