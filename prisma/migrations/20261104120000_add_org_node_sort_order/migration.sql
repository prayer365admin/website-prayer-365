-- Sibling ordering for the central hierarchy tree.
ALTER TABLE "org_nodes" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "org_nodes_parent_id_sort_order_idx" ON "org_nodes"("parent_id", "sort_order");
