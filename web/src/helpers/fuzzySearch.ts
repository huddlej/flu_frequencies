import { isEmpty } from 'lodash-es'
import Fuse from 'fuse.js'

export function fuzzySearch(items: string[], searchTerm: string) {
  if (isEmpty(searchTerm)) {
    return items.map((item) => ({ item, score: 1 }))
  }
  const fuse = new Fuse(items, {
    includeScore: true,
    includeMatches: true,
    shouldSort: true,
    findAllMatches: true,
  })
  return fuse.search(searchTerm)
}

export function fuzzySearchObj<T extends Record<string, unknown>>(
  items: T[],
  keys: (keyof T & string)[],
  searchTerm: string,
) {
  if (isEmpty(searchTerm)) {
    return items.map((item) => ({ item, score: 1 }))
  }
  const fuse = new Fuse(items, {
    includeScore: true,
    includeMatches: true,
    shouldSort: true,
    findAllMatches: true,
    keys,
  })
  return fuse.search(searchTerm)
}
