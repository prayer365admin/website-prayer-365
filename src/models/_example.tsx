// TODO: Change `Example` to your model name and change `User` with your model Name

import { Prisma, User } from '@prisma/client'
import { GeneralOmitModel } from './general-omit'

export interface ExampleDataModel extends User {}

export interface ExamplePayloadCreateModel extends Prisma.UserUncheckedCreateInput {}

export interface ExamplePayloadUpdateModel
  extends Omit<Prisma.UserUncheckedUpdateInput, GeneralOmitModel> {}

export interface ExampleFormModel extends Omit<ExampleDataModel, GeneralOmitModel> {}
