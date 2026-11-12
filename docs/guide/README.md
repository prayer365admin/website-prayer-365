# Prayer 365 — Admin Guidebook

| Field    | Value                                                              |
| -------- | ------------------------------------------------------------------ |
| Document | Admin Guidebook — every dashboard feature, with the website effect |
| Version  | 1.0                                                                |
| Date     | 12 November 2026                                                   |
| Author   | Catatia engineering                                                |
| Approver | [TBD]                                                              |
| Audience | Church administrators, central staff, super admins, pastors        |

## What this book is

A step-by-step handbook for the Prayer 365 admin dashboard. Every chapter covers one screen: what it is for, who may use it, numbered steps with annotated screenshots, what each field means, what changes on the public website, and the problems you are likely to meet.

It describes the product **as it runs today**. Where a screen is a placeholder or a feature is not wired yet, the book says so instead of inventing steps (chapter 25 and chapter 24 are the two cases).

## How to start

1. Read [00. Book map](00-index.md) — the full chapter list and the screenshot legend.
2. Read [01. Getting started](01-getting-started.md) if you have never signed in.
3. Read [02. Roles and what you can see](02-roles-and-what-you-can-see.md) — the sidebar looks the same for everyone; the data inside it does not.
4. Keep [26. Website impact map](26-website-impact-map.md) open while you work: it is the one page that answers "what did this change for visitors?".

## What is covered

| Part                   | Chapters | Scope                                                                                                                                |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Start here             | 01–02    | Sign-in, roles, navigation                                                                                                           |
| Church work            | 03–11    | Church list, overview, profile, prayers, events, announcements, requests, donations, My Voice                                        |
| Governance             | 12–14    | Staff accounts, roles and permissions, customers                                                                                     |
| Central administration | 15–24    | Overview, churches, pastors, all prayers, voice profiles, hierarchy, countries, languages, announcements, notifications, master data |
| Reference              | 25–28    | Placeholder screens, website impact map, troubleshooting, glossary                                                                   |

## About the screenshots

- 64 annotated screenshots, captured from a locally running copy of the product.
- Every screenshot comes from a **demo database**: fake churches, fake pastors, fake donations, no real customer data.
- Red boxes mark the element a step refers to; the red number gives the step order.
- No password, token or customer secret appears in any image.

## Known limits of this release

| Limit                                                                          | Where it is explained |
| ------------------------------------------------------------------------------ | --------------------- |
| Events and announcements reach the mobile app, not the public church page      | Chapters 07, 08, 26   |
| Regional dashboard and church analytics are placeholder screens                | Chapter 25            |
| Brand and colour registries are empty; the live palette is build configuration | Chapter 24            |
| Requests cannot be answered inside the platform                                | Chapter 09            |
| Donation totals count provider-confirmed payments only                         | Chapter 10            |

## Conventions in this book

| Convention                                 | Meaning                                                   |
| ------------------------------------------ | --------------------------------------------------------- |
| **Bold text**                              | A label you see on the screen, exactly as written         |
| `Code style`                               | A value, address or system name                           |
| Warning box                                | An action that is hard to undo, or data that is sensitive |
| `Refresh` / `Publish required` / `Rebuild` | How quickly a change reaches the website (chapter 26)     |

Summary: 29 documents, 64 annotated screenshots, one checker script as the gate.
