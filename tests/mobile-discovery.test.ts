import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=(file:string)=>readFileSync(new URL(`../${file}`,import.meta.url),"utf8");
test("homepage puts Radar before activity and exposes all four source routes",()=>{
  const home=source("src/app/page.tsx");assert.ok(home.indexOf("<RadarCards")<home.indexOf("<HomeTradingTable"));
  for(const path of ["/congress","/senate","/insiders","/institutions"])assert.ok(home.includes(`href="${path}"`));
  assert.ok(home.includes("previewHomeWindows(windows)"));
});
test("mobile sector selection is native and the full stock list lives on its own page",()=>{
  assert.ok(source("src/components/HomeSectorExplorer.tsx").includes('id="mobile-sector"'));
  const table=source("src/components/HomeTradingTable.tsx");assert.ok(table.includes("/activity?source="));assert.ok(!table.includes("setExpanded"));
  const css=source("src/app/homepage.css");assert.match(css,/home-sector-picker select[^}]+width:100%/);assert.match(css,/home-source-controls[^}]+overflow:visible/);assert.match(css,/home-shell :is\(input,select\)[^}]+font-size:16px/);
});
test("navigation exposes Radar and mobile escape returns focus to the menu control",()=>{
  const nav=source("src/components/Navbar.tsx");assert.ok(nav.includes('href: "/radar"'));assert.ok(nav.includes('event.key==="Escape"'));assert.ok(nav.includes("menuButton.current?.focus()"));assert.ok(nav.includes("aria-expanded={menuOpen}"));
});
