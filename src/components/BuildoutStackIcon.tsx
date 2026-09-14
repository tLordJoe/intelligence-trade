import { layers } from "@/lib/data";
import { SUBCATEGORIES } from "@/lib/subcategories";
import { STACK_GRADIENTS, stackWidth } from "@/lib/stack-presentation";

/** Same labels, order, colors and width calculation as Explore; decorative preview only. */
export default function BuildoutStackIcon() {
  return <div className="home-mini-stack" aria-hidden="true">
    {layers.map(layer => <div className="stack-bar home-mini-layer" key={layer.slug}
      style={{ width: `${stackWidth(layer.slug)}%`, background: STACK_GRADIENTS[layer.slug] }}>
      <span>{layer.name}</span><div>{(SUBCATEGORIES[layer.slug] ?? []).map(sub => <i key={sub.name} className="subcategory-bubble" />)}</div>
    </div>)}
  </div>;
}
