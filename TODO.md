# TODO

## 待處理

- [ ] **刪除已合併的遠端分支 `claude/content-script-usage-panel-t25edu`**
  - 背景：in-page 用量面板功能已經 fast-forward 併入 `main`
    （commits `b46b855`、`f74a1a6`、`3f11717`），這條開發分支已無用途。
  - 為什麼還沒刪：目前用來操作的 GitHub App token 沒有刪除分支的權限
    （`git push origin --delete` 回 403），需要用有完整權限的個人帳號來刪。
  - 刪除方式（二選一）：
    - GitHub 網頁：開
      https://github.com/CSChenVB/claude-monitor-browser-extension/branches
      → 找到該分支 → 點右邊的垃圾桶圖示。
    - 本地 git：
      ```bash
      git push origin --delete claude/content-script-usage-panel-t25edu
      ```
  - 註：分支內容不會遺失，所有 commit 都已在 `main` 的歷史中；刪掉的只是分支指標。
