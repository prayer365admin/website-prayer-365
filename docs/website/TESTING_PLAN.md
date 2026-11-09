# PRAYER Website — User Acceptance Testing (UAT) Plan

| Field      | Value                                                        |
| ---------- | ------------------------------------------------------------ |
| Document   | UAT plan — customer-facing website                           |
| Version    | 2.0                                                          |
| Date       | 9 November 2026                                              |
| Author     | Catatia engineering                                          |
| Approver   | [TBD]                                                        |
| Applies to | `prayer-365-dashboard` website only                          |
| Test site  | [TBD — add the UAT URL]                                      |
| Status     | Draft for review — fill the [TBD] fields before the UAT pass |

## 1. About this plan

This plan is for testing the website as a normal customer. You do not need to
read code or use technical tools. Each test has:

- an ID,
- what to do, in order,
- what you should see,
- a box to record the result.

Test one feature at a time. If a step fails, finish the rest of that test case,
then log the problem and move on. Do not stop the whole pass for one failure.
Technical checks are kept in Annex A at the end; testers do not need to read it.

### What is included

- Creating an account, verifying email, signing in, resetting a password.
- Choosing a parish and language on first sign-in.
- Finding a church, opening a church page, reading and listening to prayers.
- Giving a one-time or monthly donation.
- Viewing and editing your profile.
- Public pages, language switch, mobile view, basic accessibility.
- Basic safety checks (signed-out access, private data, staff access).

### What is not included

- The admin dashboard (tested separately).
- The mobile app.
- Events page, notifications page, account deletion, push notifications.
- Per-church payouts (not switched on yet).
- Payment card handling inside PRAYER: payment always happens on Stripe.

## 2. Before you start

### 2.1 You need

| Item                 | Details                                                             |
| -------------------- | ------------------------------------------------------------------- |
| Test website address | [TBD — add the UAT URL]                                             |
| Browser              | Chrome or Edge, desktop. Use a private window for signed-out tests. |
| Email inbox          | The inbox used by the test site for verification and reset emails.  |
| Stripe test card     | `4242 4242 4242 4242`, any future expiry date, any 3-digit CVC.     |
| Time                 | About 5–6 hours for the full pass.                                  |

### 2.2 Test accounts

Password for all seeded accounts: `Test123!`

| Account                | Use it for                                                                  |
| ---------------------- | --------------------------------------------------------------------------- |
| `believer@example.com` | Main customer. Has a main parish and follows churches.                      |
| `visitor@example.com`  | Second customer. Use for cross-account checks.                              |
| `admin@catatia.com`    | Staff account. Use only for the “staff cannot use customer pages” test.     |
| A new email you own    | Registration and email verification tests. Use a different email each pass. |

### 2.3 Test data that must exist before you start

Ask the delivery team to confirm these are in the UAT environment:

- At least 5 approved churches with a cover photo, photo gallery, service times
  and pastoral staff.
- At least 10 published prayers, most with playable audio.
- One church with no gallery, no staff and no events (empty-state test).
- One prayer with text but no audio.
- One draft prayer that is not published.
- One suspended church and one archived church.
- One customer with an active monthly donation.
- One customer with no main church and no followed churches (create a fresh account
  and skip both setup steps).

### 2.4 How to record results

| Mark    | Meaning                                     |
| ------- | ------------------------------------------- |
| ☐       | Not tested                                  |
| ✔       | Pass — matches “What you should see”        |
| ✘       | Fail — add a defect number and a short note |
| N/A     | Not testable in this environment (say why)  |
| Blocked | Cannot test because of an earlier failure   |

A good defect note has: test ID, what you did, what happened, what you expected,
browser, and a screenshot if possible.

## 3. How to read a test case

Example:

> **UAT-01 — Create a new account**
>
> 1. Open `/register`.
> 2. Fill name, email and password.
> 3. Click **Create Sacred Account**.
>    **You should see:** “Check your email” and the email address you used.
>    **Result:** ☐

Use the exact button and field names shown in **bold**. Text in backticks such as
`/register` is the page address to open.

## 4. Feature 1 — Create an account and sign in

| ID     | What to do                                                                                                                                                | What you should see                                                                                                                                  | Result |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| UAT-01 | 1. Open `/register`. 2. Enter your full name, a new email you can open, and a password of at least 8 characters. 3. Click **Create Sacred Account**.      | The page changes to **Check your email** and shows the email you used. A verification email arrives within a few minutes. You are not signed in yet. | ☐      |
| UAT-02 | 1. Open `/register` again. 2. Use the same email from UAT-01 and any valid password. 3. Click **Create Sacred Account**.                                  | A message under the email field says **This email is already registered. Please sign in instead.** No new account is created.                        | ☐      |
| UAT-03 | 1. Open `/register`. 2. Click **Create Sacred Account** with all fields empty. 3. Try an email without `@`. 4. Try a 7-character password.                | Each field shows its own error. The password message says at least 8 characters. Nothing is sent.                                                    | ☐      |
| UAT-04 | 1. Open the verification email from UAT-01. 2. Click the link. 3. Click **Verify Email**.                                                                 | First page asks you to confirm. After confirming, it says **Email has been verified** and offers **Sign in**.                                        | ☐      |
| UAT-05 | 1. Open the same verification link a second time.                                                                                                         | It says the link is invalid or expired and offers a way to request a new link. The page does not crash.                                              | ☐      |
| UAT-06 | 1. Open `/verify-email` without using an email link. 2. Enter your email in the resend form. 3. Click **Send a new link** twice quickly.                  | The page explains the link problem. The resend button counts down and cannot be clicked again until the countdown ends.                              | ☐      |
| UAT-07 | 1. Open `/login`. 2. Enter the email from UAT-01 and its password. 3. Click **Sign In to Fellowship** before verifying the email.                         | You are sent to **Verify your email first**. Your email is already filled in and you can resend the link. You are not signed in.                     | ☐      |
| UAT-08 | 1. Verify the email (UAT-04). 2. Open `/login`. 3. Sign in with the same email and password.                                                              | You land on the website home page. If your parish or language is not set, you are sent to **Complete Your Sanctuary Profile**.                       | ☐      |
| UAT-09 | 1. Sign in as `believer@example.com`. 2. Open `/login`, then `/register`, then `/welcome`.                                                                | All three send you back to the website home page. You do not see the sign-in or register forms while signed in.                                      | ☐      |
| UAT-10 | 1. Sign out. 2. Open `/forgot-password`. 3. Enter a registered email and submit. 4. Repeat with an email that does not exist.                             | Both show the same **Check your email** message. The page does not reveal whether the email exists.                                                  | ☐      |
| UAT-11 | 1. Open the reset email. 2. Enter a new password and a different confirmation password. 3. Correct the confirmation and submit.                           | The mismatch is blocked with a clear message. After a correct submit, the page says **Password has been reset**.                                     | ☐      |
| UAT-12 | 1. Sign in with the old password. 2. Sign in with the new password.                                                                                       | The old password fails. The new password signs you in.                                                                                               | ☐      |
| UAT-13 | 1. Open `/reset-password` without a valid link. 2. Click **Request a new link**.                                                                          | The page says the link is invalid or expired and takes you to **Forgot password**.                                                                   | ☐      |
| UAT-14 | 1. Register a fresh account. 2. Sign in. 3. On **Parish Connection**, search for a church, select it and click **Next**. 4. Reload the page.              | The parish is saved immediately. After reload you are on the language step, not back on the parish step.                                             | ☐      |
| UAT-15 | 1. On the parish step, click **Skip for now**. 2. On the language step, choose a language and click **Enter the Sanctuary**. 3. Reload `/customer/setup`. | Skipping the parish is allowed. The chosen language is saved. A finished setup sends you to the website home page.                                   | ☐      |
| UAT-16 | 1. On the language step, click **Skip for now**. 2. Sign out and sign in again.                                                                           | Skipping is allowed and English is used. The setup does not appear again in the same browser.                                                        | ☐      |
| UAT-17 | 1. Sign in as `admin@catatia.com`. 2. Open `/customer` and `/customer/setup`. 3. Open `/` and `/churches`.                                                | Staff are sent to the admin dashboard from customer-only pages. Public website pages still open normally.                                            | ☐      |
| UAT-18 | 1. Sign in as a customer. 2. Click your account menu. 3. Click **Sign out**.                                                                              | You are signed out and land on the sign-in page. Pressing the browser Back button does not show your profile again.                                  | ☐      |

## 5. Feature 2 — Find a church

| ID     | What to do                                                                                                                                                  | What you should see                                                                                                                                                                        | Result |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| UAT-20 | 1. Sign in as `believer@example.com`. 2. Click **Discovery Churches** in the header.                                                                        | The church directory opens with church cards on the left and a map on the right. Only approved churches are shown.                                                                         | ☐      |
| UAT-21 | 1. Type part of a church name in **Search churches by name or city**. 2. Wait a moment.                                                                     | The list narrows to matching churches. Clearing the search brings the full list back.                                                                                                      | ☐      |
| UAT-22 | 1. Type a city name in the search box.                                                                                                                      | Churches in that city are shown.                                                                                                                                                           | ☐      |
| UAT-23 | 1. Type a word that matches no church (for example `zzzz`).                                                                                                 | The page shows **No churches found**. No broken cards or blank spaces remain.                                                                                                              | ☐      |
| UAT-24 | 1. Allow location access when the browser asks. 2. Open the distance selector. 3. Try 5 km, 10 km, 25 km and 50 km. 4. Compare the cards with the map pins. | Only churches inside the chosen distance remain. The nearest church appears first. The map shows the same churches as the list.                                                            | ☐      |
| UAT-25 | 1. Open the denomination filter. 2. Choose **Lutheran / EELK**. 3. Choose another denomination. 4. Choose **All Denominations**.                            | Only churches of the chosen denomination appear. **All Denominations** restores the full list.                                                                                             | ☐      |
| UAT-26 | 1. Open the language filter under **Quick filters**. 2. Choose Estonian, then English, then **All Languages**.                                              | Only churches that offer the chosen service language appear. **All Languages** restores the full list.                                                                                     | ☐      |
| UAT-27 | 1. Choose a denomination and a language together. 2. Clear one of them.                                                                                     | Both filters apply together. Clearing one widens the results without losing the other filter.                                                                                              | ☐      |
| UAT-28 | 1. Hover a church card. 2. Click its pin on the map. 3. Click the small preview card on the map.                                                            | The card and the pin stay in sync. The preview card belongs to the same church.                                                                                                            | ☐      |
| UAT-29 | 1. Click **View profile** on a church card.                                                                                                                 | The church profile opens. The address bar shows the church name in the address, not a long code.                                                                                           | ☐      |
| UAT-30 | 1. On the profile, read the top section, **About the Parish**, address, contacts and **Worship Services**. 2. Click **Directions**.                         | The cover photo, description, address, phone, email, website and service times are shown. Service times match the church’s local time. **Directions** opens a map with the church address. | ☐      |
| UAT-31 | 1. Scroll to **Sanctuary Gallery & Sacred Architecture**. 2. Look at each photo and its caption.                                                            | Photos open correctly and follow the order set in the admin. Captions match the admin. If the church has no gallery, the cover photo is used and no broken image appears.                  | ☐      |
| UAT-32 | 1. Scroll to **Upcoming Gatherings**. 2. Click a **Join Service** link if one is shown.                                                                     | Up to three future events are shown, earliest first. The link opens the external registration page. Events without a link do not show a dead button.                                       | ☐      |
| UAT-33 | 1. Scroll to **Parish Notice Board**.                                                                                                                       | Up to two published notices are shown, newest first, with title, text and date. No draft or deleted notice appears.                                                                        | ☐      |
| UAT-34 | 1. Scroll to **Pastoral Care Office**. 2. Read each staff row.                                                                                              | Only name, church role and photo are shown. No personal phone number, private email or home address is visible.                                                                            | ☐      |
| UAT-35 | 1. Open your main church profile. 2. Open a different approved church profile.                                                                              | Your main church shows the **Primary Parish** label. The other church does not.                                                                                                            | ☐      |
| UAT-36 | 1. Open a church that has no gallery, no staff and no events.                                                                                               | Each empty section shows a friendly “not listed yet” message. No blank box, broken image or endless loading spinner.                                                                       | ☐      |
| UAT-37 | 1. On a church profile, fill in a prayer request. 2. Tick **Keep confidential**. 3. Click **Offer Prayer**. 4. Ask an admin to check the Requests list.     | A confirmation message names the church. The request appears in the admin Requests list and is marked private.                                                                             | ☐      |
| UAT-38 | 1. Submit several prayer requests in a row.                                                                                                                 | At some point the page asks you to try again later. It does not accept unlimited submissions.                                                                                              | ☐      |
| UAT-39 | 1. Ask the team for the suspended church address. 2. Open it directly. 3. Repeat with the archived church.                                                  | Both show a church-not-found message and a way back to the directory. No church details are shown.                                                                                         | ☐      |
| UAT-40 | 1. Look at the filter bar carefully.                                                                                                                        | Known limitation: the buttons for **Sunday Live Stream**, **Taizé Chants** and **Youth Ministry** are not on screen yet. Mark this test **N/A** and do not log it as a defect.             | ☐      |

## 6. Feature 3 — Read and listen to prayers

| ID     | What to do                                                                                                                                                          | What you should see                                                                                                                                                                                             | Result |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| UAT-50 | 1. Sign in as `believer@example.com`. 2. Open the website home page. 3. Read the top greeting and **Today’s Liturgical Focus**.                                     | Your name and the current greeting are shown. The prayer feed shows prayers from your main church and followed churches only.                                                                                   | ☐      |
| UAT-51 | 1. Scroll through the home prayer list. 2. Check the church name and pastor on each card.                                                                           | Every prayer belongs to one of your churches. No draft, unpublished or unrelated church prayer appears.                                                                                                         | ☐      |
| UAT-52 | 1. Sign in as a customer with no main church and no followed churches. 2. Open the home page. 3. Click the directory link in the empty state.                       | The page explains that there are no prayers yet and offers a working **Go to church directory** button. No sample or invented prayers are shown.                                                                | ☐      |
| UAT-53 | 1. Click **Prayer** in the header. 2. Type a word from a prayer title in the search box.                                                                            | The prayer list shows matching prayers. The search clears back to the full list.                                                                                                                                | ☐      |
| UAT-54 | 1. On the prayer list, choose a language, a duration and a format one by one. 2. Combine two filters. 3. Open a church-specific list from the header church picker. | Each filter narrows the list. Combined filters still work. Clearing a filter widens the list again.                                                                                                             | ☐      |
| UAT-55 | 1. Search for a word that matches no prayer.                                                                                                                        | The page shows **No prayers match your search** and suggests a broader search.                                                                                                                                  | ☐      |
| UAT-56 | 1. Use the page numbers at the bottom of the prayer list. 2. Go forward and back.                                                                                   | The next page loads, keeps your filters, and starts at the top of the page.                                                                                                                                     | ☐      |
| UAT-57 | 1. Open a prayer from the list. 2. Read the title, church, pastor, introduction and full text.                                                                      | All parts are readable. Long paragraphs wrap correctly. No raw formatting code, strange brackets or audio instructions appear in the text.                                                                      | ☐      |
| UAT-58 | 1. On a prayer with audio, press Play. 2. Move the audio slider. 3. Press Pause.                                                                                    | Audio plays, the slider moves, seeking works and Pause stops the sound.                                                                                                                                         | ☐      |
| UAT-59 | 1. Open a prayer that has text but no audio.                                                                                                                        | Only the text is shown. No empty player and no error message about missing audio.                                                                                                                               | ☐      |
| UAT-60 | 1. Start one prayer playing. 2. Open another prayer and press Play.                                                                                                 | The first prayer stops. Only one prayer plays at a time.                                                                                                                                                        | ☐      |
| UAT-61 | 1. Ask the team for a prayer that is saved as a draft. 2. Search for its title. 3. Try to open its direct link if the team gives you one.                           | The draft never appears in the list or search. The direct link shows a not-found page.                                                                                                                          | ☐      |
| UAT-62 | 1. Copy the address of a prayer page. 2. Open it in a new tab.                                                                                                      | The same prayer opens. The address uses the readable prayer name, not an internal code.                                                                                                                         | ☐      |
| UAT-63 | 1. Open a church profile and scroll to **Prayer Lists**. 2. Press Play on a prayer.                                                                                 | The prayer plays inside the profile. A known limitation is that the profile has no separate **View prayers** button; use the header church picker to reach the full list. Mark that part **N/A**, not a defect. | ☐      |

## 7. Feature 4 — Donate

Use only the Stripe test card. No real money is charged.

| ID     | What to do                                                                                                                                                                                         | What you should see                                                                                                                                                                 | Result |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| UAT-70 | 1. Sign in as `believer@example.com`. 2. Open your main church profile. 3. Scroll to **Parish Stewardship** and click **Give via Baltic Banklink / Card** (or the **Support This Parish** banner). | The donation page opens with your church already selected as the beneficiary.                                                                                                       | ☐      |
| UAT-71 | 1. Open `/donate` without choosing a church.                                                                                                                                                       | The page selects your main church automatically. If you have no main church, it asks you to choose one before continuing.                                                           | ☐      |
| UAT-72 | 1. Look at the beneficiary, currency and preset amounts. 2. Compare them with the church settings shown by the admin.                                                                              | The currency and preset amounts match the church setup. Your own parish is marked as your registered parish.                                                                        | ☐      |
| UAT-73 | 1. Choose **One-Time Gift**. 2. Choose a preset amount. 3. Click the button that shows the amount.                                                                                                 | Stripe Checkout opens with the correct church, amount and currency. PRAYER itself does not ask for card details.                                                                    | ☐      |
| UAT-74 | 1. On Stripe Checkout, pay with `4242 4242 4242 4242`, any future expiry and any CVC. 2. Return to the website.                                                                                    | The result page first says the gift is being confirmed. After a short wait it says **Thank you — your gift is confirmed** and shows church, amount, currency and **One-time gift**. | ☐      |
| UAT-75 | 1. Choose **Monthly Sustaining Pledge**. 2. Choose a preset amount. 3. Complete Checkout with the test card. 4. Return to the result page, then open the donation page again.                      | The result shows a monthly pledge. The donation page shows your active monthly gift. Admin Donations shows the new subscription and its first payment.                              | ☐      |
| UAT-76 | 1. Enter a custom amount below the minimum. 2. Enter an amount above the maximum. 3. Type letters instead of a number. 4. Enter a valid custom amount.                                             | Invalid amounts are blocked with a clear message. A valid amount updates the button total and starts Checkout.                                                                      | ☐      |
| UAT-77 | 1. Start a one-time donation and let the Stripe page load. 2. Press the browser Back button and start again.                                                                                       | You do not get a second charge for the first attempt. Only completed payments appear in the donation list.                                                                          | ☐      |
| UAT-78 | 1. After a successful donation, copy the result page address. 2. Change the amount in the address to a smaller number and reload.                                                                  | The page does not say the gift is confirmed for the new amount. It stays unconfirmed or shows a failure.                                                                            | ☐      |
| UAT-79 | 1. Ask an admin to open Admin → your church → Donations. 2. Find your test donation.                                                                                                               | The donation is listed with the right church, amount, currency, date and paid status.                                                                                               | ☐      |
| UAT-80 | 1. Donate once as one-time and once as monthly. 2. Check the confirmation and the admin list.                                                                                                      | Each completed payment appears once. Refreshing the result page or the Stripe return page does not create a duplicate donation.                                                     | ☐      |
| UAT-81 | 1. With an active monthly pledge, open the donation page. 2. Click **Pause or Modify Monthly Pledge**.                                                                                             | The Stripe billing portal opens for your own subscription. You can change or pause it, then return to the donation page.                                                            | ☐      |
| UAT-82 | 1. Ask the team to switch donations off in the UAT environment. 2. Open the donation page.                                                                                                         | The donate button is disabled and a clear **Donations are not ready yet** message is shown. No fake success page appears. Switch it back on after the test.                         | ☐      |
| UAT-83 | 1. During Checkout, look for card number, CVC and expiry fields on the PRAYER page. 2. Check your browser address bar.                                                                             | Card fields appear only on Stripe’s secure page, not on the PRAYER page. PRAYER never stores your card details.                                                                     | ☐      |

## 8. Your profile

| ID     | What to do                                                                                                                                   | What you should see                                                                                                                                                | Result |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| UAT-90 | 1. Sign in as `believer@example.com`. 2. Open **Profile** from the account menu.                                                             | Your profile opens with a summary header, a small menu, a quietude card and a **Sign out** button. No admin sidebar appears.                                       | ☐      |
| UAT-91 | 1. Change **Full Name**. 2. Change **Preferred Language**. 3. Click **Save**. 4. Reload the page.                                            | The save is confirmed. The header shows the new name. The website language changes. Both values survive the reload. Email stays read-only.                         | ☐      |
| UAT-92 | 1. Click **Change picture**. 2. Upload a JPG, PNG, WEBP or HEIC photo under 8 MB. 3. Save.                                                   | The photo appears in the profile header after saving. A **Remove** option clears it.                                                                               | ☐      |
| UAT-93 | 1. Upload a 9 MB photo. 2. Upload a PDF.                                                                                                     | Both are refused with a clear message. The existing photo is not removed.                                                                                          | ☐      |
| UAT-94 | 1. Open **Church Affiliations**. 2. Set a **Main Church**. 3. Add a followed church. 4. Remove a followed church. 5. Click **Save Changes**. | Only one main church is allowed. The save is confirmed. The followed list matches what you chose after a reload.                                                   | ☐      |
| UAT-95 | 1. On **Church Affiliations**, clear the Main Church. 2. Click **Save Changes**. 3. Open the home page.                                      | The main church is removed. The home page shows the “choose a parish” state instead of a parish card.                                                              | ☐      |
| UAT-96 | 1. Open **Sacramental Privacy**. 2. Read the page.                                                                                           | The page opens inside the website layout. It is information only; no export or delete action is available yet.                                                     | ☐      |
| UAT-97 | 1. Look at the profile menu. 2. Ask the team for the direct addresses of the Notifications and Stewardship profile pages.                    | **Notifications** and **Giving & Stewardship** are not in the menu yet. Their direct pages are not built. Mark this **N/A**; it is a known deferral, not a defect. | ☐      |

## 9. Public pages and general behaviour

| ID      | What to do                                                                                                               | What you should see                                                                                                                                                                          | Result |
| ------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| UAT-100 | 1. Sign out. 2. Open `/welcome`. 3. Read the page and click **Begin Fellowship**, then go back and click **Sign In**.    | The public welcome page opens without signing in. The prayer sample plays if shown. The buttons open the register and sign-in pages.                                                         | ☐      |
| UAT-101 | 1. Open `/login`, `/register`, `/verify-email`, `/verify-account`, `/forgot-password` and `/reset-password`.             | Each page opens with the website header/footer style and the correct form. No admin sidebar or dashboard menu appears.                                                                       | ☐      |
| UAT-102 | 1. Sign in. 2. Click every link in the header, including the account menu and church picker.                             | Each link opens the expected page. No link is dead. The church picker shows your followed churches.                                                                                          | ☐      |
| UAT-103 | 1. Scroll to the footer. 2. Click every footer link.                                                                     | Working links open normally. Known gaps: **Privacy of Confession**, **Terms of Fellowship** and **Pastoral Support** do not have pages yet. Mark those three as known gaps, not new defects. | ☐      |
| UAT-104 | 1. Open a page address that does not exist, for example `/prayers/not-a-prayer`.                                         | A friendly not-found page appears with a way back. No blank screen, error code or technical message.                                                                                         | ☐      |
| UAT-105 | 1. In Chrome developer tools, set the network to **Slow 3G**. 2. Open the home page, the directory and a church profile. | A loading skeleton appears while data loads. The header stays visible. Content does not jump from empty to full without a loading state.                                                     | ☐      |
| UAT-106 | 1. Ask the team to switch the site into maintenance mode. 2. Open `/`. 3. Open `/admin`.                                 | The website shows the maintenance page. The admin login remains reachable. Ask the team to switch maintenance off afterwards.                                                                | ☐      |
| UAT-107 | 1. Open the website on a phone or narrow browser window. 2. Open the menu button.                                        | The header collapses into a menu. All menu links are reachable. Closing the menu returns you to the same place on the page.                                                                  | ☐      |

## 10. Language, screen size and accessibility

| ID      | What to do                                                                                                                            | What you should see                                                                                                                                                | Result |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| UAT-110 | 1. Sign out and open `/welcome`. 2. Use the language selector to switch English → Estonian → Swedish → Finnish → English.             | The page text changes immediately, without a reload. The chosen language stays selected after moving to another page.                                              | ☐      |
| UAT-111 | 1. Sign in. 2. Switch language on the home page, the directory, the prayer list and the donation page.                                | Each page updates its text. No mixed-language page and no empty or missing labels appear.                                                                          | ☐      |
| UAT-112 | 1. Open **Profile**. 2. Change **Preferred Language** and save. 3. Reload and sign in again.                                          | The website keeps the chosen language after reload and after a new sign-in. The profile and header language agree.                                                 | ☐      |
| UAT-113 | 1. In each language, check service times, event dates, donation amounts and the result page.                                          | Dates and times are readable and match the church’s local time. Amounts show the correct currency. Church and pastor names are not translated.                     | ☐      |
| UAT-114 | 1. Set the browser window to phone width (about 390 px). 2. Open the home page, directory, church profile, donation page and profile. | No sideways scrolling. Cards stack in one column. The menu button works. The donate button stays reachable.                                                        | ☐      |
| UAT-115 | 1. Set the window to tablet width (about 768 px) and then small laptop width (about 1024 px). 2. Repeat the same pages.               | The directory changes from one column to two when there is space. Text does not overlap. Buttons are not cut off.                                                  | ☐      |
| UAT-116 | 1. Set the window to desktop width (about 1440 px). 2. Open the directory and a church profile.                                       | The directory shows cards and a map side by side. Photos keep their shape and are not stretched.                                                                   | ☐      |
| UAT-117 | 1. On `/login`, use only the Tab key to move through the form. 2. Press Enter to submit.                                              | You can reach every field and button. The focused item is clearly visible. Enter submits the form.                                                                 | ☐      |
| UAT-118 | 1. Look at the sign-in and profile forms. 2. Check the icons and photos.                                                              | Every field has a visible label. Icon-only buttons have a readable name when hovered or read by a screen reader. Decorative images do not announce confusing text. | ☐      |
| UAT-119 | 1. Zoom the browser to 200%. 2. Open the home page and the donation page.                                                             | Text stays readable. Nothing is cut off. The donate button and form can still be used.                                                                             | ☐      |

## 11. Safety checks

These are simple checks that customer data stays private and staff tools stay
separate from the customer website.

| ID      | What to do                                                                                                                                                              | What you should see                                                                                              | Result |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------ |
| UAT-120 | 1. Sign out. 2. Open `/`, `/churches`, `/prayers`, `/donate`, `/customer` and `/customer/setup` directly.                                                               | Each page sends you to the welcome or sign-in page. No prayer, church or profile content appears.                | ☐      |
| UAT-121 | 1. Sign in with a spare customer account. 2. Ask an admin to mark that account inactive. 3. Refresh the website. 4. Ask the admin to reactivate it afterwards.          | The website signs you out or sends you to the sign-in page. Your old session no longer shows protected content.  | ☐      |
| UAT-122 | 1. Sign in as a customer. 2. Open `/dashboard`.                                                                                                                         | You are sent back to the customer website. The admin dashboard does not open.                                    | ☐      |
| UAT-123 | 1. Sign in as `admin@catatia.com`. 2. Open `/customer` and `/customer/setup`.                                                                                           | You are sent to the admin dashboard. A staff account cannot use the customer profile area.                       | ☐      |
| UAT-124 | 1. Open a church profile. 2. Read the **Pastoral Care Office** section.                                                                                                 | Only staff name, role and photo are shown. No private phone number, personal email or home address is visible.   | ☐      |
| UAT-125 | 1. Open the suspended church address directly. 2. Open the archived church address.                                                                                     | Both show a not-found message. The church details are not shown.                                                 | ☐      |
| UAT-126 | 1. Ask an admin to save a disposable prayer containing text like `<script>alert(1)</script>`. 2. Open that prayer on the website. 3. Delete the test prayer afterwards. | The text is shown safely or removed. No pop-up, alert box or page break occurs.                                  | ☐      |
| UAT-127 | 1. Sign in as `believer@example.com` and note the donations shown. 2. Sign out. 3. Sign in as `visitor@example.com` and open the donation page and profile.             | You see only the second account’s own details. No name, donation or profile data from the first account appears. | ☐      |
| UAT-128 | 1. Sign in. 2. Open the account menu and sign out. 3. Press the browser Back button.                                                                                    | The protected page does not come back. You stay on the sign-in page.                                             | ☐      |

## 12. Known limitations

These are already known. Do not log them as new defects unless the behaviour is
different from the description here.

| Item                              | What you will see                                                                                                                                | Status        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| Quick filters                     | The buttons for Sunday Live Stream, Taizé Chants and Youth Ministry are not on screen. Search, distance, denomination and language filters work. | Open decision |
| Church profile prayer link        | The profile shows its prayer list inside the page. There is no separate **View prayers** button; use the header church picker.                   | Accepted      |
| Notifications page                | Not built. The menu item is hidden.                                                                                                              | Deferred      |
| Giving & Stewardship profile page | Not built. Giving is available from the main **Giving & Stewardship** header link and from each church profile.                                  | Deferred      |
| Legal footer pages                | **Privacy of Confession**, **Terms of Fellowship** and **Pastoral Support** have no pages yet.                                                   | Launch item   |
| Pastoral care hotline             | The footer does not show a phone number yet and points to the church directory instead.                                                          | Launch item   |
| Sample numbers on sign-in         | The sign-in side panel contains sample member and diocese numbers.                                                                               | Launch item   |
| Privacy wording                   | The “zero-knowledge encryption” wording is still under legal review.                                                                             | Launch item   |
| Translations                      | Estonian, Swedish and Finnish are draft translations and need a native-speaker review.                                                           | Launch item   |
| Church payouts                    | Donations are collected on one PRAYER payment account. Per-church payouts are not switched on yet.                                               | Open decision |
| Prayer text size                  | There are no text width or size controls on the prayer page.                                                                                     | Accepted      |
| Design sign-off                   | Some screens were built from shared designs and still need formal sign-off.                                                                      | Pending       |

## 13. Coverage against the SDD

Use this table to confirm that every feature area in the source documents has a
test section.

| SDD area                             | Source                                 | Covered by                     |
| ------------------------------------ | -------------------------------------- | ------------------------------ |
| WF1 User onboarding                  | FEATURE WF1; SPEC §7.1                 | Section 4, UAT-01 to UAT-18    |
| WF2 Church directory                 | FEATURE WF2; SPEC §6.2, §6.5           | Section 5, UAT-20 to UAT-40    |
| WF3 Prayer                           | FEATURE WF3; SPEC §7.3                 | Section 6, UAT-50 to UAT-63    |
| WF4 Donations                        | FEATURE WF4; SPEC §7.4                 | Section 7, UAT-70 to UAT-83    |
| Customer profile                     | TASK WB1-P01 to P08; DESIGN W13        | Section 8, UAT-90 to UAT-97    |
| Public pages and states              | SPEC §4; TASK WB-08                    | Section 9, UAT-100 to UAT-107  |
| Languages, responsive, accessibility | SPEC §5.1; FEATURE shared requirements | Section 10, UAT-110 to UAT-119 |
| Access and privacy                   | SPEC §9, §10                           | Section 11, UAT-120 to UAT-128 |

## 14. Sign-off

### 14.1 UAT result

| Field               | Value                                          |
| ------------------- | ---------------------------------------------- |
| Tester name         | [TBD]                                          |
| Test date(s)        | [TBD]                                          |
| Build / commit      | [TBD]                                          |
| Environment         | [TBD — UAT URL]                                |
| Tests passed        | [TBD] / total                                  |
| Tests failed        | [TBD]                                          |
| Tests blocked       | [TBD]                                          |
| Overall result      | [ ] Pass / [ ] Pass with conditions / [ ] Fail |
| Conditions or notes | [TBD]                                          |

### 14.2 Approval

| Role                    | Name  | Decision                                                   | Date  |
| ----------------------- | ----- | ---------------------------------------------------------- | ----- |
| Product owner           | [TBD] | [ ] Approved / [ ] Approved with conditions / [ ] Rejected | [TBD] |
| Tech lead               | [TBD] | [ ] Approved / [ ] Approved with conditions / [ ] Rejected | [TBD] |
| Client / business owner | [TBD] | [ ] Approved / [ ] Approved with conditions / [ ] Rejected | [TBD] |

## 15. Result log

Add one row per test pass. Do not overwrite an earlier row.

| Run | Date  | Tester | Environment | Passed | Failed | Blocked | Defects logged | Notes       |
| --- | ----- | ------ | ----------- | -----: | -----: | ------: | -------------- | ----------- |
| 1   | [TBD] | [TBD]  | UAT         |      0 |      0 |       0 | 0              | Not started |
| 2   |       |        |             |        |        |         |                |             |

## Annex A — Notes for the delivery team (not needed for UAT)

This annex records how the manual cases were derived and what the technical
checks found. UAT testers can stop at section 15.

### A.1 What was checked

- The source documents: `docs/website/OVERVIEW.md`, `FEATURE.md`, `SPEC.md`,
  `TASK.md`, with `DESIGN.md` and the `REPORT/` notes where they define a screen
  or a known gap.
- The real repository: website pages, site API routes, session guards, models,
  migrations, seeds, environment sample and tests.
- The four feature areas in FEATURE.md (`WF1–WF4`), the SPEC §10 verification
  rows and every TASK row that is not marked done.

### A.2 Automated result at the time of writing

| Check               | Result (9 Nov 2026, `b0c6baa`) |
| ------------------- | ------------------------------ |
| `bun run typecheck` | Pass                           |
| `bun run lint`      | Pass                           |
| Website test suite  | 68 files, 389 tests passed     |
| Full test suite     | 348 files, 2375 tests passed   |

Manual UAT is still required: the automated tests do not cover real cookies,
redirects, S3 media or Stripe Checkout.

### A.3 Technical items behind the UAT limitations

| Item                 | Technical position                                                                                                                                                                          | Owner             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Quick-filter buttons | The API accepts `sunday_live_stream`, `taize_chants`, `youth_ministry`, but the directory screen has no controls for them                                                                   | Product           |
| Church payouts       | No `PaymentAccount` model; checkout uses one `STRIPE_PLATFORM_ACCOUNT_ID` with church metadata                                                                                              | Product + backend |
| Route documentation  | SPEC §4 omits `/welcome`, `/prayers`, `/customer/church-affiliations`, `/customer/privacy`, `/verify-account`, and says guests go to `/login` while the site group sends them to `/welcome` | Docs              |
| Privacy copy         | “256-bit zero-knowledge encryption” still appears in `src/i18n/messages.ts` and ships on auth/profile surfaces                                                                              | Product + legal   |
| Hotline              | `src/components/site/support-hotline.ts` has an empty number on purpose                                                                                                                     | Operations        |
| Legal pages          | Footer links `/privacy`, `/terms`, `/support` have no pages                                                                                                                                 | Product + legal   |
| Translations         | et/sv/fi copy is draft until native review                                                                                                                                                  | Product           |
| Stripe end to end    | Automated tests mock the provider; live Checkout and webhook must be tested manually in test mode                                                                                           | Backend           |
| Test coverage gaps   | `prayer-archive` route has no direct route test; `/prayers` and `/donate/result` pages have no page test                                                                                    | Engineering       |

### A.4 Team setup and reset

```bash
bun install
bunx prisma migrate deploy
bun run seed:demo        # media + demo rows + readiness gate
bun run seed:verify      # must exit 0
bun run dev

# Stripe webhook forward (second terminal)
stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe
```

`bun run build` runs `prisma migrate deploy`; do not run it against a shared or
production database.

To create the UAT fixtures (suspended/archived church, text-only prayer, draft
prayer, empty church), use the admin dashboard as described in section 2.3.

### A.5 Defect severity for the delivery team

| Level | Meaning                                           | Example                                      |
| ----- | ------------------------------------------------- | -------------------------------------------- |
| P0    | Data loss, payment/security breach, site unusable | duplicate donation, customer sees admin data |
| P1    | A feature cannot be completed                     | cannot register, audio never plays           |
| P2    | Works with a workaround                           | filter needs a reload                        |
| P3    | Cosmetic or copy                                  | spacing, wording                             |

## Summary

This is a manual UAT plan for the customer website. It has 102 step-by-step test
cases in plain language, grouped by feature: account and sign-in, church
directory, prayer, donations, profile, public pages, language and screen size,
and safety. Known limitations are listed separately so testers do not log them
as new defects. A short annex keeps the technical check results and setup
commands for the delivery team.
