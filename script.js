// =====================
// 設定・状態
// =====================
let cache = {};
let charConfig = {};
let currentCharacter = "syochou";

let state = "idle";
let currentChunks = [];
let chunkIndex = 0;
let typingTimer = null;
let isTyping = false;
let fullText = "";	

const MAIN_KEY = `mainIndex_${currentCharacter}`;
let mainIndex = Number(localStorage.getItem(MAIN_KEY) || 0);

function saveMainIndex() {
  localStorage.setItem(MAIN_KEY, mainIndex);
}


const KEY = `talkCount_${currentCharacter}`;

let talkCount = Number(localStorage.getItem(KEY) || 0);

function saveTalkCount() {
  localStorage.setItem(KEY, talkCount);
}

const TYPE_SPEED = 35;

// ★ 追加：初回フラグ
function hasSeenFirst() {
  return localStorage.getItem("seen_first") === "true";
}
function markSeenFirst() {
  localStorage.setItem("seen_first", "true");
}

// =====================
// 読み込み
// =====================
async function load(category) {
  const key = `${currentCharacter}_${category}`;
  if (cache[key]) return cache[key];

  const res = await fetch(`data/${currentCharacter}/${category}.json`);
  const data = await res.json();
  cache[key] = data;
  return data;
}

async function loadCharacter() {
  const res = await fetch(`data/${currentCharacter}/config.json`);
  charConfig = await res.json();
}

// =====================
// ユーティリティ
// =====================
function resolveImage(key) {
  return charConfig.basePath + charConfig.images[key];
}

function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function splitText(text) {
  return text.split("\n");
}

// =====================
// UI制御
// =====================
function openBox() {
  document.getElementById("message-box").classList.add("active");
}

function closeBox() {
  document.getElementById("message-box").classList.remove("active");
}

// =====================
// セリフ表示
// =====================
function startLine(line) {
  currentNode = line;
  currentChunks = splitText(line.text);
  chunkIndex = 0;

  document.getElementById("character").src = resolveImage(line.image);

  showChunk();
}

function showChunk() {
  typeLine(currentChunks[chunkIndex]);
}




function skipTyping() {
  if (!isTyping) return false;

  isTyping = false;

  const textEl = document.getElementById("text");
  const clean = fullText.replace(/{.*?}/g, "");

  textEl.innerText = clean;

  const span = document.createElement("span");
  span.id = "indicator";
  span.innerText = "▼";
  textEl.appendChild(span);

  return true;
}
// =====================
// 会話開始
// =====================
/*
async function startFirst() {
  const data = await load("first");
  const line = pickRandom(data.lines);

  openBox();
  startLine(line);
  state = "first";
}
*/


// =====================
// 進行
// =====================
function nextChunk() {
  if (skipTyping()) return;

  chunkIndex++;

  // まだ続きがある
  if (chunkIndex < currentChunks.length) {
    showChunk();
    return;
  }

  // ===== セリフ終了 =====

  // ▼ 分岐ノード対応（最優先）
  if (currentNode) {

    // 選択肢がある
    if (currentNode.choices) {
      renderChoices(currentNode.choices);
      return;
    }

    // 自動遷移
    if (currentNode.next) {
      runNode(currentNode.next);
      return;
    }
  }

  // ▼ 従来処理（fallback）

  if (state === "first") {
    state = "first_end";
    closeBox();
    showIdle();

  } else if (state === "talk") {
    state = "talk_end";

    talkCount++;
    saveTalkCount();

    closeBox();
    showIdle();
  }

}
// =====================
// タップ操作
// =====================
document.addEventListener("click", async () => {
if (document.getElementById("choices").children.length > 0) return;
  if (isTyping) {
    skipTyping();
    return;
  }

  switch (state) {

case "idle":
  if (!hasSeenFirst()) {
    runNode("first_root");
    markSeenFirst();
  } else if (talkCount > 0 && talkCount % 5 === 0) {
    runNode("main_root");
  } else {
    runNodeByTalkCount();
  }
  break;





    case "first":
      nextChunk();
      break;

   case "first_end":
  runNode("main_root"); // ←これに変更
  break;

    case "talk":
      nextChunk();
      break;

case "node":
  nextChunk();
  break;

case "talk_end":
  state = "idle";
  showIdle(); // ←追加
  break;
  }
});




// =====================
// 初期化
// =====================
async function init() {
  await loadCharacter();

  showIdle();   // ←これだけでいい
  closeBox();
}

const SEEN_KEY = `seen_${currentCharacter}`;
let seenIds = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");

function saveSeen() {
  localStorage.setItem(SEEN_KEY, JSON.stringify(seenIds));
}
function selectTable(data) {
  if (talkCount === 0) return data.tables.first;
  if (talkCount < 10) return data.tables.early;
  if (talkCount < 30) return data.tables.mid;
  return data.tables.late;
}

function filterUnseen(lines) {
  return lines.filter(l => !seenIds.includes(l.id));
}

function parseText(text) {
  const regex = /{(.*?)}/g;
  let result = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }

    const tag = match[1];

    if (tag.startsWith("face:")) {
      result.push({ type: "face", value: tag.split(":")[1] });
    } else if (tag.startsWith("bg:")) {
      result.push({ type: "bg", value: tag.split(":")[1] });
    } else if (tag.startsWith("wait:")) {
      result.push({ type: "wait", value: Number(tag.split(":")[1]) });
    } else if (tag === "shake") {
      result.push({ type: "shake" });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    result.push({ type: "text", value: text.slice(lastIndex) });
  }

  return result;
}
function resetGame() {
  localStorage.removeItem(`talkCount_${currentCharacter}`);
  localStorage.removeItem(`seen_${currentCharacter}`);
  localStorage.removeItem(`mainIndex_${currentCharacter}`); // ← 追加
  localStorage.removeItem("seen_first");
  location.reload();
}


function showIdle() {
  const charEl = document.getElementById("character");

  if (charConfig.images.idle) {
    charEl.src = resolveImage("idle");
  } else {
    // fallback（なければnormal）
    charEl.src = resolveImage("normal");
  }
}

function clearIndicator() {
  const old = document.getElementById("indicator");
  if (old) old.remove();
}

function typeLine(text) {
  const textEl = document.getElementById("text");

  clearTimeout(typingTimer);
  isTyping = true;
  fullText = text;

  clearIndicator(); // ←追加
  textEl.innerText = "";

  const tokens = parseText(text);

  let tokenIndex = 0;
  let charIndex = 0;

  function loop() {
    if (!isTyping) return; // ←追加（暴走防止）

    if (tokenIndex >= tokens.length) {
      isTyping = false;

      clearIndicator(); // 念のため
      const span = document.createElement("span");
      span.id = "indicator";
      span.innerText = "▼";
      textEl.appendChild(span);
      return;
    }

    const token = tokens[tokenIndex];

    if (token.type === "text") {
      textEl.innerText += token.value[charIndex++];
      if (charIndex >= token.value.length) {
        tokenIndex++;
        charIndex = 0;
      }
      typingTimer = setTimeout(loop, TYPE_SPEED);
    }

    else if (token.type === "face") {
      document.getElementById("character").src = resolveImage(token.value);
      tokenIndex++;
      loop();
    }

    else if (token.type === "bg") {
      const gameEl = document.getElementById("game");
      gameEl.style.backgroundImage = `url(${resolveImage(token.value)})`;
      tokenIndex++;
      loop();
    }

    else if (token.type === "wait") {
      tokenIndex++;
      typingTimer = setTimeout(loop, token.value);
    }

    else if (token.type === "shake") {
      const gameEl = document.getElementById("game");
      gameEl.classList.add("shake");
      setTimeout(() => gameEl.classList.remove("shake"), 300);
      tokenIndex++;
      loop();
    }
  }

  loop();
}

function skipTyping() {
  if (!isTyping) return false;

  isTyping = false;
  clearTimeout(typingTimer);

  const textEl = document.getElementById("text");

  clearIndicator(); // ←追加

  const clean = fullText.replace(/{.*?}/g, "");
  textEl.innerText = clean;

  const span = document.createElement("span");
  span.id = "indicator";
  span.innerText = "▼";
  textEl.appendChild(span);

  return true;
}

let currentNode = null;

async function runNode(id) {

  // main_rootは順番に選ぶ
  if (id === "main_root") {
    const data = await load("talk");
    const list = data.mainStory;
    if (mainIndex >= list.length) {
      runNodeByTalkCount();
      return;
    }
    const next = list[mainIndex];
    mainIndex++;
    saveMainIndex();
    return runNode(next);
  }

  const data = await load("talk");
  const node = data.nodes[id];

  if (!node) {
    console.warn("node not found:", id);
    return;
  }

  // randomは未読フィルタしてランダム選択
  if (node.random) {
    let candidates = node.random.filter(id => !seenIds.includes(id));
    if (candidates.length === 0) {
      candidates = node.random;
    }
    const next = pickRandom(candidates);
    const nextNode = data.nodes[next];
    if (nextNode && nextNode.text) {
      seenIds.push(next);
      saveSeen();
    }
    return runNode(next);
  }

  // idle処理
  if (node.action === "idle") {
    talkCount++;
    saveTalkCount();
    state = "idle";
    closeBox();
    showIdle();
    return;
  }

  // セリフ表示
  currentNode = node;
  openBox();
  startLine(node);
  state = "node";
}





function runNodeByTalkCount() {
  if (talkCount < 10) runNode("early_root");
  else if (talkCount < 30) runNode("normal_root");
  else runNode("late_root");
}

function handleChoice(next) {
  const box = document.getElementById("choices");
  box.innerHTML = "";
  box.style.display = "none";
  
  // クリックイベントの伝播を止める必要があるので
  // 少し遅延してrunNodeを呼ぶ
  setTimeout(() => runNode(next), 0);
}



function renderChoices(choices) {
  const box = document.getElementById("choices");
  box.innerHTML = "";

  choices.forEach(c => {
    const btn = document.createElement("button");
    btn.innerText = c.text;
    btn.onclick = () => handleChoice(c.next);
    box.appendChild(btn);
  });

  box.style.display = "block"; // ←これも追加
}

init();
