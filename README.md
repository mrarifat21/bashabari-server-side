# 🏠 Bashabari - Backend (Server Side)

This is the backend server for **Bashabari**, a real estate platform developed using the MERN stack. The server provides RESTful APIs for handling authentication, property management, reviews, user roles, wishlist, offers, Stripe payments, and more.

---

## 🌐 Live Server URL

🔗 https://bashabari-server.vercel.app

---

## 🧰 Tech Stack

- **Node.js**
- **Express.js**
- **MongoDB (Mongoose)**
- **Firebase Admin SDK**
- **Stripe Payments**
- **JWT Authentication**
- **CORS, Dotenv, and Middleware Utilities**

---

## 📁 API Features

### 🔐 Authentication

- Email/password login with JWT token generation
- Firebase Admin SDK for verifying user identity
- Role-based middleware protection (`user`, `agent`, `admin`)

### 🏘️ Property Management

- Agents can add, update, delete properties
- Admins can verify/reject properties
- Users can view verified properties only
- Support for advertised properties and fraud agent filtering

### 🧾 Wishlist & Offers

- Users can add properties to wishlist
- Offer system to bid within agent-defined price range
- Offers stored with `pending`, `accepted`, or `rejected` status

### 💳 Payments

- Stripe integration for secure transactions
- Buyers can pay after offer approval
- Payment status and transaction ID stored in MongoDB

### ⭐ Reviews

- Users can add, view, and delete reviews
- Admins can manage all reviews platform-wide

### 👤 User Management

- Admins can promote users to `agent` or `admin`
- Mark users as `fraud` (agents only)
- Fraud agents are restricted from adding new properties

---
