import { db } from '../../src/utils/db-connection'
import { expandPrayerGrants } from './prayer-roles'

export const seedPermission = async () => {
  // Template baseline permissions
  await db.permission.createMany({
    data: [
      // General Data
      {
        id: '40b32e72-7279-4c71-9eff-87a0eea10421',
        actions: 'read',
        scope: 'ANY',
        subject: 'master_data',
      },
      {
        id: 'c8429108-68d5-4d87-aba2-928d8e7c92fb',
        actions: 'read',
        scope: 'ANY',
        subject: 'user_management',
      },

      // Role
      {
        id: '8ab9ac2c-add9-4fbe-9810-1edd4f972581',
        actions: 'read',
        scope: 'ANY',
        subject: 'user_management_role',
      },
      {
        id: '9c06d9a0-4b1b-41cb-84b8-3f5a17a36ee4',
        actions: 'create',
        scope: 'ANY',
        subject: 'user_management_role',
      },
      {
        id: 'd0aae575-5158-47ab-8733-3a4b13626319',
        actions: 'update',
        scope: 'ANY',
        subject: 'user_management_role',
      },
      {
        id: '1b2df0c7-81dd-4753-86fd-75132962e171',
        actions: 'delete',
        scope: 'ANY',
        subject: 'user_management_role',
      },

      // User
      {
        id: '5968304a-3515-4c12-be98-cb05a66baf25',
        actions: 'read',
        scope: 'ANY',
        subject: 'user_management_user',
      },
      {
        id: '79aa3684-7b8f-4b88-8004-4a538ec867c5',
        actions: 'create',
        scope: 'ANY',
        subject: 'user_management_user',
      },
      {
        id: 'd279b325-2a7e-46d3-ba33-54b144ba9538',
        actions: 'update',
        scope: 'ANY',
        subject: 'user_management_user',
      },
      {
        id: '8e634e4c-413d-4981-b85e-fa025028dccc',
        actions: 'update',
        scope: 'OWN',
        subject: 'user_management_user',
      },
      {
        id: 'ddfebd55-7b5b-46df-a67e-3206d3c9c5f4',
        actions: 'delete',
        scope: 'ANY',
        subject: 'user_management_user',
      },

      // Permission
      {
        id: '32f39be6-3cc3-4c6e-9db9-3259499095dc',
        actions: 'read',
        scope: 'ANY',
        subject: 'user_management_permission',
      },
    ],
    skipDuplicates: true,
  })

  // Prayer permission catalogue (from the role matrix)
  await db.permission.createMany({ data: expandPrayerGrants(), skipDuplicates: true })
}
