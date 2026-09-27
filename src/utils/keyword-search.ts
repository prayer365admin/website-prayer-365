import { Prisma } from '@prisma/client'

type propTypes = {
  keyword: string
  name: string
  parent?: string
  grand_parent?: string
}

export const handleDynamicSearchKeyword = ({ keyword, name }: propTypes) => {
  return keyword
    .split(' ')
    .filter(Boolean)
    .map((word) => ({
      [name]: {
        contains: word,
        mode: Prisma.QueryMode.insensitive,
      },
    }))
}

export default function keywordSearch({ keyword, name, parent, grand_parent }: propTypes) {
  const result = keyword
    ? [
        grand_parent && parent
          ? {
              [grand_parent]: {
                some: { [parent]: { AND: handleDynamicSearchKeyword({ keyword, name }) } },
              },
            }
          : parent
            ? {
                [parent]: {
                  AND: handleDynamicSearchKeyword({ keyword, name }),
                },
              }
            : {
                AND: handleDynamicSearchKeyword({ keyword, name }),
              },
      ]
    : []

  return result
}
