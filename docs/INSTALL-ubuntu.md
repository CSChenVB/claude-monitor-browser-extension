# 在 Ubuntu 上安裝「in-page 用量面板」分支

這份文件說明如何在 **Ubuntu** 上，把本 fork 中「in-page 用量面板（content
script）」的開發分支載入瀏覽器執行。這個功能會把 Claude 用量面板直接顯示在
claude.ai 頁面的側邊欄上，不用點開工具列 popup 就能一直看到。

> 這是一個瀏覽器擴充功能，不是獨立程式。「執行」指的是把它以「開發人員模式 /
> 未封裝項目」的方式載入 Chrome / Chromium 或 Firefox。

---

## ⚠️ 分支名稱會變動 — 先找到正確的分支

新功能**不在** `main` 主線上，而是在一條開發分支。分支名稱可能隨開發更新而改變
（例如 `claude/content-script-usage-panel-xxxxxx`），所以**不要死記分支名**，用下
面的方法找出目前該用哪一條：

```bash
# 列出遠端所有分支
git branch -r
```

判斷原則（依序）：

1. 如果功能已經**合併進 `main`**（GitHub 上的 Pull Request 顯示已 merged），
   直接用 `main` 就好，跳過「切換分支」那一步。
2. 否則挑名稱含 **`content-script-usage-panel`** 的那條分支；若有多條，選最新的
   （在 GitHub 網頁的 **Branches** 頁面看「Updated」時間，或用下面指令看最後
   一次 commit 時間）：

   ```bash
   # 依最後 commit 時間排序，最新的在最下面
   git for-each-ref --sort=committerdate refs/remotes/origin --format='%(committerdate:short)  %(refname:short)'
   ```

下文都用 `<BRANCH>` 代表你找出來的分支名稱，請自行替換。

---

## 1. 取得程式碼

```bash
git clone https://github.com/CSChenVB/claude-monitor-browser-extension.git
cd claude-monitor-browser-extension

# 切換到正確的分支（用上面找到的名稱取代 <BRANCH>）
git checkout <BRANCH>
```

切換成功後，`extension/` 資料夾裡應該會出現這兩個新檔案，代表你在對的分支上：

```bash
ls extension/content-panel.js extension/content-panel.css
```

之後要拿最新修正時，在同一條分支上執行：

```bash
git pull
```

---

## 2A. 載入到 Chrome / Chromium（建議，最簡單）

如果還沒安裝：

```bash
sudo apt install chromium-browser
# 或自行安裝 Google Chrome 的 .deb 套件
```

1. 網址列輸入 `chrome://extensions`
2. 打開右上角的「**開發人員模式 / Developer mode**」
3. 點「**載入未封裝項目 / Load unpacked**」
4. 選取 repo 裡的 **`extension/` 資料夾**（注意：是 `extension/` 子資料夾，
   **不是** repo 根目錄）
5. 會出現「讀取及變更 claude.ai 上的資料」的權限提示，這是預期行為
   （content script 需要在 claude.ai 頁面上顯示面板）

**改了程式碼後如何更新**：回到 `chrome://extensions`，按該擴充功能卡片上的
重新整理圖示 ⟳，再重新整理 claude.ai 分頁即可。

---

## 2B. 載入到 Firefox（需先替換 manifest）

Firefox 讀取的檔名固定是 `manifest.json`，但本專案的 Firefox 設定放在
`manifest.firefox.json`，所以要先做一份 Firefox 專用目錄：

```bash
cp -r extension /tmp/extension-firefox
cp extension/manifest.firefox.json /tmp/extension-firefox/manifest.json
```

1. 網址列輸入 `about:debugging#/runtime/this-firefox`
2. 點「**載入暫時性附加元件 / Load Temporary Add-on…**」
3. 選 `/tmp/extension-firefox/manifest.json`

注意事項：

- Firefox 的「暫時性附加元件」**重啟瀏覽器就會消失**，每次重開都要重新載入。
- 需要 **Firefox 142 以上**（manifest 有標 `strict_min_version`）。
- 之後改了程式碼，要重新執行上面的 `cp` 指令再重新載入。

---

## 3. 讓面板動起來

1. 在**同一個瀏覽器設定檔**登入 [claude.ai](https://claude.ai)。
   （擴充功能和 claude.ai 的登入狀態必須在同一個 profile；無痕視窗、不同
   profile 的 cookie 是隔離的。）
2. background 每 5 分鐘自動抓一次用量。不想等的話，點工具列的擴充功能圖示
   開 popup，按右上角的 ⟳ 手動刷新。
3. 開任一個 claude.ai 頁面，面板會出現在**側邊欄底部**；如果側邊欄放不下或
   找不到掛載點，會自動退化成**右下角的浮動面板**。

---

## 疑難排解

### 面板顯示「Signed out: data is stale」，但我明明有登入

多半是**網路 / VPN 的問題**，不是真的登出：

- 有些 **VPN 或公司/學校網路的過濾設備**會攔截 claude.ai 的 API 流量，或觸發
  Cloudflare 的人機驗證，導致擴充功能的背景請求拿到 403。分頁本身能用是因為
  分頁能執行驗證用的 JavaScript，但背景 service worker 不行。
- **處理方式**：關掉 VPN（或把 `claude.ai` 排除，不走 VPN）→ 在分頁重新整理
  claude.ai 讓它正常載入 → 按 popup 的 ⟳ 手動刷新（手動刷新會強制略過內建的
  退避機制，通常立刻恢復）。

### 面板沒出現在側邊欄，只出現在右下角

代表 content script 找不到預期的側邊欄節點，退化成了浮動面板。這通常發生在
claude.ai 改版之後。修正方式：更新 `extension/content-panel.js` 最上方
`SIDEBAR_SELECTORS` 常數區裡的選擇器（用 DevTools 檢視側邊欄容器，取得新的
`data-testid` / class）。

### 完全沒有任何面板

- 確認你在正確的分支上（`extension/content-panel.js` 存在）。
- 確認網址是 `https://claude.ai/...`（content script 只在 claude.ai 上執行）。
- 到 `chrome://extensions` 看該擴充功能有沒有錯誤訊息，或點「Service Worker」
  開 console 檢查。

---

## 這個功能改了哪些檔案

為了方便日後跟上游同步，改動刻意隔離：

- 新增：`extension/content-panel.js`、`extension/content-panel.css`
- 修改：`extension/manifest.json`、`extension/manifest.firefox.json`
  （各只新增一段 `content_scripts` 區塊）

資料來源只有 `chrome.storage.local`（由 background 抓好的用量資料），content
script 不讀取頁面上的任何對話內容、不發任何網路請求。
