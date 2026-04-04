# Stract 🚀

Stract is a high-performance project management platform built for modern teams. It features a robust **Go** backend and a reactive **Next.js** frontend, designed with "Enterprise SaaS" aesthetics in mind.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Go Version](https://img.shields.io/badge/Go-1.21%2B-blue)](https://golang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)

---

## 🛠 Features (v1.0.0-beta)

- 📋 **Task Management**: Kanban-style boards with drag-and-drop.
- 🤝 **Minutes of Meeting**: Structured MoM with action item tracking.
- 📝 **Project Forms**: Public/Internal intake forms with automated task creation.
- 👤 **Workspace Management**: Secure multi-workspace environments with member roles.
- 📊 **Analytics**: Real-time KPI reporting and project health tracking.

---

## 🏗 Repository Structure

We follow a [Standard Git Flow](CONTRIBUTING.md#branch-strategy):
- `main`: Production-ready code only.
- `develop`: Integration branch for new features.
- `feature/*`: Active development branches.

---

## 🚀 Getting Started

### Prerequisites
- [Go 1.21+](https://go.dev/dl/)
- [Node.js 18+](https://nodejs.org/)
- [Supabase](https://supabase.com) Project

### 1. Installation
```bash
git clone https://github.com/jessaardithya/Stract.git
cd Stract
```

### 2. Environment Setup

#### Backend (`/stract-backend`)
Create `.env`:
```env
SUPABASE_JWT_SECRET=your-jwt-secret
DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
PORT=8080
```

#### Frontend (`/stract-frontend`)
Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
```

### 3. Running Locally

**Start Backend:**
```bash
cd stract-backend
go run ./cmd/api/.
```

**Start Frontend:**
```bash
cd stract-frontend
npm install
npm run dev
```

---

## 🤝 Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for our coding standards and pull request process.

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.
