# 27. Troubleshooting

> Part of: Admin Guidebook v1.0

## What this page is for

Real messages you will meet in the dashboard, what each one means, and the first thing to do. Every message here was copied from the running product, so you can match it word for word.

## Who can use it

| Reader    | Use                                                |
| --------- | -------------------------------------------------- |
| All staff | Match an on-screen message to a cause              |
| Support   | Answer a reported problem without opening the code |

## Before you start

- Note the exact message and the page address. Both are needed to find the cause.
- Check the obvious first: is the record published, is the church approved, is the account's role right.

## Step by step

### Step 1 — Sign-in problems

| Message                                                | Cause                                                    | First action                                                             |
| ------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------ |
| `Please check your email and password, and try again.` | Wrong credentials, or the account is not a staff account | Re-type the password; if it fails again, check the account in chapter 12 |
| `Reset link is invalid`                                | The reset link expired or was already used               | Press **Request new link** and use the newest mail                       |

### Step 2 — Access problems

| Message                                                                            | Cause                                             | First action                                                    |
| ---------------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------- |
| `You don't have access to that church.`                                            | Your role is not bound to that church             | Ask a super admin to change your jurisdiction (chapter 12)      |
| `Select a church assigned to your account.`                                        | No church selected yet                            | Open **Churches → My Churches** and press **Open** (chapter 03) |
| `Only requests allowed by your church and sensitive-data permissions are visible.` | Informational: the list is filtered by permission | If a request is missing, ask for the private grant (chapter 09) |
| A menu opens but the table says `No data`                                          | No records in your scope, or no permission        | Compare with chapter 02                                         |

### Step 3 — Content problems

| Message                                                                         | Cause                                           | First action                                        |
| ------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------- |
| `Full prayer text is required.`                                                 | The prayer text field is empty                  | Paste the text and press **Save text** (chapter 06) |
| `This version is already published. Edit the text to publish a new version.`    | A published version is locked                   | Save the new text, then publish the new version     |
| `A new church stays invisible to the public app until it is approved.`          | Informational on the church administration page | Approve the church (chapter 16)                     |
| `Archiving removes the church from public access while preserving all records.` | Warning before archiving                        | Confirm only if the church is really closing        |
| `No evidence file attached` (voice review)                                      | The consent document was never uploaded         | Ask the pastor to upload it (chapter 11)            |

### Step 4 — Website problems

| Symptom                                        | Cause                                                | First action                                                    |
| ---------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------- |
| The visitor sees old text                      | Browser cache                                        | Refresh, then hard refresh                                      |
| The church page is gone                        | Church suspended or archived                         | Check the status in chapter 16                                  |
| Prayers play no audio                          | Audio not approved, or the voice was never generated | Open the prayer, check the Audio & Publication tab (chapter 06) |
| Events or announcements are not on the website | By design in this release                            | Tell the user to use the mobile app (chapters 07, 08)           |
| Donations show `0.00`                          | Only provider-confirmed payments count               | Confirm the payment state in the provider (chapter 10)          |

### Step 5 — Report a problem well

Include these five facts:

1. The exact message text.
2. The page address.
3. The account you used (email, not password).
4. The church you were working in.
5. The time, with the time zone.

## Fields explained

| Term used in messages | What it means                                                   |
| --------------------- | --------------------------------------------------------------- |
| Scope                 | The part of the platform your account can see                   |
| Jurisdiction          | The organization node your account is bound to                  |
| Permitted modules     | Extra switches on an individual staff account                   |
| Provider-confirmed    | Confirmed by the payment or voice provider, not by the platform |
| Approved              | A state that makes a church public                              |
| Published             | A state that makes content public                               |

## What changes on the website

Nothing in this chapter. It only explains messages and public symptoms.

## Common problems

| Situation                                            | Best next step                                           |
| ---------------------------------------------------- | -------------------------------------------------------- |
| The same message repeats after the fix               | The change was not saved, or a cache holds the old state | Reload with cache cleared, then repeat the action once |
| A page renders a single word (`Region`, `Analytics`) | Placeholder screen                                       | See chapter 25                                         |
| Nothing in this book matches                         | Collect the five facts above and report them             | Do not guess in production                             |

Next: [28. Glossary](28-glossary.md)
