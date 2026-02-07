# Backend Spec: Curriculum Map Persistence API

> Handoff document for backend development.

## Context & Problem

The **Curriculum Map** lets students plan their entire degree across semesters. Users can:

- Place **real courses** (by courseId) into future semester slots
- Create **placeholders** (generic credit allocations like "Advanced Elective, 6 ECTS") for undecided slots
- Manage **multiple plans** (1-3 per user) to compare degree paths
- Organize everything into **category columns** matching their transcript structure

**Currently all data lives in `localStorage` only** — plans are lost on browser clear, don't sync across devices, and can't be recovered. We need a server-side persistence layer, similar to the existing `study-plans` wishlist API.

---

## API Design: Single-Document Endpoint

Each user's entire curriculum map (all plans) is a single JSON document of **~2-10 KB**. We store and retrieve it as one blob.

### Endpoints

| Method   | Path               | Description                                 |
| -------- | ------------------ | ------------------------------------------- |
| `GET`    | `/curriculum-maps` | Fetch user's curriculum map document        |
| `PUT`    | `/curriculum-maps` | Save/replace user's curriculum map document |
| `DELETE` | `/curriculum-maps` | Delete all curriculum map data for user     |

### Authentication

Same pattern as existing `/study-plans` endpoints:

- `Authorization: Bearer {token}` (Azure Entra ID)
- User identity derived from JWT claims (no user ID in URL)
- Same default headers: `X-ApplicationId`, `X-RequestedLanguage`, `API-Version`, `Content-Type`

---

### `GET /curriculum-maps`

Returns the user's full curriculum map.

**`200 OK`** — Document exists:

```json
{
  "activePlanId": "plan-default",
  "schemaVersion": 1,
  "lastModified": "2025-06-15T14:30:00.000Z",
  "plans": {
    "plan-default": {
      "id": "plan-default",
      "name": "My Main Plan",
      "createdAt": "2025-06-01T10:00:00.000Z",
      "lastModified": "2025-06-15T14:30:00.000Z",
      "plannedItems": {
        "HS25": [
          {
            "type": "course",
            "courseId": "7,015,1.00",
            "categoryPath": "Compulsory/Core Modules",
            "shortName": "Fundamentals of CS"
          },
          {
            "type": "placeholder",
            "id": "placeholder-1738883456789-abc123def",
            "categoryPath": "Electives/Technical",
            "credits": 6,
            "label": "Advanced Elective"
          }
        ],
        "FS26": []
      },
      "wishlistOverrides": {
        "FS25": {
          "removedCourseIds": ["8,020,1.00"]
        }
      }
    }
  }
}
```

**`404 Not Found`** — New user, no data saved yet.

---

### `PUT /curriculum-maps`

Replaces the user's full document.

**Request body:** Same shape as the GET response.

**`200 OK`** — Returns the saved document with server-set `lastModified` timestamp.

---

### `DELETE /curriculum-maps`

Clears all curriculum map data for the user.

**`204 No Content`** — Success (idempotent — returns 204 even if no data existed).

---

## Data Schema Reference

### Top-Level Document

| Field           | Type                   | Required      | Description                                       |
| --------------- | ---------------------- | ------------- | ------------------------------------------------- |
| `activePlanId`  | string                 | Yes           | ID of the currently active plan                   |
| `schemaVersion` | number                 | Yes           | Schema version for forward-compat (currently `1`) |
| `lastModified`  | ISO 8601 string        | Set by server | Server-set timestamp on each PUT                  |
| `plans`         | `Record<string, Plan>` | Yes           | Map of planId to plan data                        |

### Plan Object

| Field               | Type                       | Required | Description                                                               |
| ------------------- | -------------------------- | -------- | ------------------------------------------------------------------------- |
| `id`                | string                     | Yes      | Unique plan ID (e.g., `"plan-default"`, `"plan-1738883456789-abc123def"`) |
| `name`              | string                     | Yes      | User-chosen display name (e.g., `"My Main Plan"`)                         |
| `createdAt`         | ISO 8601 string            | Yes      | When the plan was created                                                 |
| `lastModified`      | ISO 8601 string            | Yes      | When the plan was last edited (client-set)                                |
| `plannedItems`      | `Record<string, Item[]>`   | Yes      | Map of semester key (e.g., `"HS25"`) to array of items                    |
| `wishlistOverrides` | `Record<string, Override>` | No       | Per-semester overrides for wishlist visibility                            |

### Item Types

**Course item** — a real course from the university catalog:

```json
{
  "type": "course",
  "courseId": "7,015,1.00",
  "categoryPath": "Compulsory/Core Modules",
  "shortName": "Fundamentals of CS"
}
```

**Placeholder item** — a generic credit slot:

```json
{
  "type": "placeholder",
  "id": "placeholder-1738883456789-abc123def",
  "categoryPath": "Electives/Technical",
  "credits": 6,
  "label": "Advanced Elective"
}
```

### Wishlist Override Object

```json
{
  "removedCourseIds": ["8,020,1.00", "11,702,1.00"]
}
```

### Key Formats

- **Semester keys:** `[HS|FS][2-digit year]` — e.g., `HS24`, `FS25`, `HS25`
- **Course IDs:** University course numbers — e.g., `"7,015,1.00"`
- **Plan IDs:** `"plan-default"` or `"plan-{timestamp}-{random}"` — e.g., `"plan-1738883456789-abc123def"`
- **Placeholder IDs:** `"placeholder-{timestamp}-{random}"` — e.g., `"placeholder-1738883456789-abc123def"`

---

## Frontend Sync Strategy (FYI)

This section is for context (& for frontend devs).

1. **On app load:** `GET /curriculum-maps` → populate client state
2. **On every change:** Debounced `PUT /curriculum-maps` (300-500ms delay)
3. **Offline fallback:** If API unreachable, save to localStorage; retry on reconnect
4. **Migration for existing users:** If `GET` returns `404` but localStorage has data → `PUT` localStorage data to backend → continue normally
5. **Source of truth:** Server data wins over localStorage when both exist

### Frontend localStorage Keys (for reference)

The frontend currently persists across two localStorage entries:

| Key                                | Content                                                                                                        | Maps to...                 |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `biddit_curriculum_plans_registry` | Plan metadata: `{ activePlanId, plans: { [id]: { id, name, createdAt, lastModified } }, schemaVersion }`       | Top-level document fields  |
| `biddit_curriculum_plan`           | Active plan data: `{ plannedItems, wishlistOverrides, specialization, validations, syncStatus, lastModified }` | `plans[activePlanId]` body |

The `PUT` payload merges these two: the registry provides the plan list + active plan ID, and the plan atom provides the items/overrides for the active plan. The `specialization`, `validations`, and `syncStatus` fields are client-only state and will **not** be persisted to the backend.
