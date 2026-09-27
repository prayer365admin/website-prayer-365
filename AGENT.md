# 🤖 Catatia AI Agent Protocol

This document defines how AI Agents (Gemini, OpenClaw, etc.) should interact with, build upon, and debug projects using the **Catatia Next.js Dashboard Template**.

---

## 🏗️ Architectural Guardrails

Agents must respect the following "Law of Layers" to ensure maintainability:

1.  **The JSX Law:** No JSX logic allowed in `src/app/`. All UI must reside in `src/contents/<feature>/`.
2.  **The Database Law:** Never call `db` (Prisma) directly in API routes. Always use functions from `src/providers/` named in **UPPER_SNAKE_CASE**.
3.  **The Hook Law:** All data fetching must use **TanStack Query** hooks located in `src/hooks/data/`.
4.  **The Error Law:** Use the `GeneralError` class for all expected failures to maintain a consistent JSON response shape.

---

## 🛠️ Task-Specific Protocols

### 1. Adding a New Feature

When asked to add a feature (e.g., "products"), generate code for these files in this specific order:

1.  **Model:** `src/models/product.tsx` (Define Create/Update payloads).
2.  **Provider:** `src/providers/product.tsx` (Prisma CRUD logic).
3.  **API Routes:** `src/app/api/v1/product/route.ts` (List/Post) & `[id]/route.ts` (Get/Put/Delete).
4.  **Hooks:** `src/hooks/data/product.tsx` (TanStack Query mutations/queries).
5.  **Contents:** `src/contents/product/` (UI components).

### 2. Debugging

When debugging, check the flow in this sequence:

- **Client-side:** Check the `queryKey` in the hook. Is it invalidated after a mutation?
- **Auth/Permissions:** Check the `requiredAuth()` call and the `<project_prefix>_<resource>` subject name.
- **Provider:** Is the Prisma query using `$transaction` for paginated results?

---

## 🔐 Security & Permissions

Agents must always implement the **accesscontrol** pattern:

- Subjects naming: `<project_name>_<resource_name>`.
- Always check `permission.readAny().granted` before returning data.
- Always check `permission.createAny().granted` or `permission.updateAny().granted` before modifying data.

---

## 📁 File Naming Conventions

| Type              | Convention       | Example                               |
| :---------------- | :--------------- | :------------------------------------ |
| **Folders/Files** | kebab-case       | `user-management`, `media-upload.tsx` |
| **Components**    | PascalCase       | `UploadBox.tsx`, `ProductList.tsx`    |
| **Functions**     | camelCase        | `useProducts`, `parseSearchParams`    |
| **DB Functions**  | UPPER_SNAKE_CASE | `GET_PRODUCTS`, `CREATE_PRODUCT`      |

---

_Note: This protocol is a supplement to the `template-dashboard-spec.md`. Refer to the main spec for technical deep-dives._
