import "salto-src/selection/selection-popup.css";
import "./style.css";

import { createRoot } from "react-dom/client";

import { SelectionPopupApp } from "salto-src/selection/SelectionPopupApp";

function SelectionLab() {
  return (
    <div className="salto-live-token-scope">
      <main className="selection-lab-shell">
        <section aria-labelledby="selection-lab-title" className="selection-lab-reader">
          <p className="selection-lab-kicker">选择测试页</p>
          <h1 id="selection-lab-title">阅读不该变成一次绕路。</h1>
          <p>
            选中这段文字中的生词或短语。Salto 会在选区附近放置一个紧凑的翻译图标，等待你明确点击，
            然后打开邻近面板，同时保留当前阅读上下文。
          </p>
          <p>
            这个交互刻意保持很小：选中文字，查看附近面板，需要时保存词汇，然后回到文章。浮动控件应当
            在任意网页内容上方保持准确、清晰、安静。
          </p>
          <blockquote>
            一个词汇工具只有像页边批注，而不是模态流程时，才真正值得信任。
          </blockquote>
        </section>
      </main>
      <SelectionPopupApp />
    </div>
  );
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Selection lab root is missing");
}

createRoot(rootElement).render(<SelectionLab />);
