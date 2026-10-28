import { HierarchyNode } from '@/models/hierarchy'

/** Depth-first flatten of the org tree so kinds can be filtered into selects. */
export function flattenHierarchy(nodes: HierarchyNode[]): HierarchyNode[] {
  const result: HierarchyNode[] = []
  function traverse(list: HierarchyNode[]) {
    for (const node of list) {
      result.push(node)
      if (node.children?.length) {
        traverse(node.children)
      }
    }
  }
  traverse(nodes)
  return result
}
