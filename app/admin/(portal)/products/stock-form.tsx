import { ActionForm } from "../action-form";
import { setStockAction } from "./actions";
import { input } from "./fields";

export function StockForm({ productId, variantId, stock }: { productId: string; variantId: string; stock: number }) {
  return (
    <ActionForm action={setStockAction} submit="Save" variant="btn-outline" className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="variantId" value={variantId} />
      <label className="block w-24">
        <span className="text-sm font-medium text-bone/80">In stock</span>
        <input name="stock" type="number" inputMode="numeric" min={0} step={1} defaultValue={stock} required className={input} />
      </label>
    </ActionForm>
  );
}
