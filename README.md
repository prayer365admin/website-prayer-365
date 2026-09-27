## System Requirement

1. Node Version: `v22.9.0`
2. Yarn Version: `v1.22.22`

## Getting Started

First, install all dependencies:

```
yarn
```

Second, running dev serve:

```
yarn dev
```

## Commit Convention

we using "Conventional Commit" as a standard when doing commit, here the list:

- Feat: ✨ every time adding new feature
- Fix: 🐛 every time doing some bug fixing
- Refactor: ♻️ every time doing refactor

Please download [Link](https://marketplace.visualstudio.com/items?itemName=vivaxy.vscode-conventional-commits) on your vscode to make your live easier

## Folder Structure

- App
  > all the things here is server side render "use client" is not allowed on this folder.
- Components

  > please create a components as you wish here, naming convention for that component is following the folder name. each components will always have `index.tsx` and `index.module.scss`.

  > Ex: `/component/main-button will` have `MainButton` as the components name

- Contents

  > all the things inside tha pages need to covered here first, able to use "use client" and able to use any other components inside. this folder will represent about the pages inside `app/[pages]`. name of the content should be following the Contents > Master Data > Brand

  > Ex: `contents/master-data/brand` it will be `ContentsMasterDataBrand`

- Data
  > when you need something is static, please use this folder to save all the static data.
- Hooks
  > all the client hooks are needed will serve here, UI for Hooks regarding UI things, and DATA for hooks regarding data integration
- Models
  > all the models are needed to define, please put all the models are necessary here!
- Providers
  > when you need to integrate with Prisma you will need doing some QUERY, and the here you need to go. all the things inside here will using CAPITAL_CASE as the name of function
- Utils
  > all the things you need on parsing data or whatever you want to do, at least it will be used modular, please create a file here based on function you are needed. it will be using `camelCase`

## How to Work

1. Select your card on Project Management Tools
2. Create branch based on your Card name, and make sure your base is correct. example: [Feat]: Remove Submit Button - feat/remove-submit-button, or using Card ID
3. Create models, follow another standard if doesn't need any custom models
4. Create your own API, please using `_template` as your code base. Don't forget to include all the new API to Postman Collections. remember to always using plural as name of API folder
5. Create Hooks, please using `_template` as your code base
6. Create a UI as you wish, remember to working on `Contents` and make `Components` if needed
7. Commit your changes, make sure always using Conventional Commits
8. Create PR to the correct base

## CRUD Implementation

1. Add new data on Prisma Schema (make sure included, `created_at`, `updated_at`, and `deleted_at`)
2. Create permission seed, add new permission for your data & make sure use unique UUID
3. Add Models, Duplicate `/models/_template`, and change all`Users` to specific `Entity`
4. Add Provider, create all necessary Provider
5. Create Route, for API, duplicate `/app/api/_template`, and change the result as you wish
6. Create Hooks, duplicate `/hooks/data/_example.tsx`, and change `baseUrl (api endpoint url)`, `entity (singular)`, and `queryKey (plural)`
7. Create Front-End (Add Page, Edit Page)
8. Do refactor for any redundant code, put on `controller` (for anything need calling PROVIDER in multiple step) or `utils` (for anything are need to handle repeatedly, like Data Parsing)
