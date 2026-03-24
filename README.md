# Stract

A modern project management app built with **Go** and **Next.js**.
---

## Prerequisites

- Go 1.21+
- Node.js 18+
- A [Supabase](https://supabase.com) project

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/jessaardithya/Stract.git
cd Stract
```

---

### 2. Backend

```bash
cd stract-backend
```

Create a `.env` file:

```env
SUPABASE_JWT_SECRET=your-jwt-secret
DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
PORT=8080
```

Run:

```bash
go mod download
go run ./cmd/api
```

---

### 3. Frontend

```bash
cd stract-frontend
```

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
```

Run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
