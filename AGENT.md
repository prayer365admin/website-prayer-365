# 🤖 Catatia AI Agent Protocol

This document defines how AI Agents (Gemini, OpenClaw, etc.) should interact with, build upon, and debug projects using the **Catatia Next.js Dashboard Template**.

---

## 📚 Documentation-First Protocol

Before planning, implementing, debugging, or reviewing any work, agents must consult the relevant files in `docs/` and keep the work aligned with them. Do not rely on this protocol alone as a substitute for the project documentation.

- Start with `docs/OVERVIEW.md` for the product, users, platform boundaries, and shared-backend context.
- Use `docs/FEATURE.md` as the current-scope baseline. Items under **Future Approach** are excluded unless the user explicitly expands the scope.
- Use `docs/SPEC.md` as the authoritative technical implementation guide, including architecture, contracts, security, permissions, data rules, verification, open decisions, and document precedence.
- Use `docs/DESIGN.md` and `docs/design-assets/` for screen behavior, page mappings, states, and layout intent.
- Check `docs/TASK.md` before implementation for current completion status, task order, verification commands, blockers, and work that should not be redone. Keep it accurate when a task is completed or its status materially changes.
- Consult `docs/TIMELINE.md` for sequencing, dependencies, milestones, and release gates, and `docs/BOM.md` for service, infrastructure, capacity, and cost assumptions.
- If the documentation conflicts with an explicit user instruction, follow the user instruction and update the affected documentation when requested or necessary to keep the repository consistent. If documents conflict with one another, apply the precedence in `docs/SPEC.md` and surface unresolved decisions instead of guessing.
- Re-check the relevant documentation during verification so acceptance criteria, security boundaries, and explicit exclusions are covered.

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

_Note: This protocol is a concise operating guide. The project documents under `docs/`, especially `docs/SPEC.md`, remain the source of truth for technical detail and scope._
