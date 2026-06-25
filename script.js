// ─── Firebase Config ────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyAlJxo9z5l1TfDeKZibIM_fQpon80VFlNA",
  authDomain:        "justus-1985.firebaseapp.com",
  databaseURL:       "https://justus-1985-default-rtdb.firebaseio.com",
  projectId:         "justus-1985",
  storageBucket:     "justus-1985.firebasestorage.app",
  messagingSenderId: "505124733826",
  appId:             "1:505124733826:web:5299e454ff40785876c59b",
  measurementId:     "G-L4FVMSVLCD",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ─── State ──────────────────────────────────────────────────────────────────
const userId      = `user_${Math.random().toString(36).substr(2, 9)}`;
let sharedKey     = "";
let roomKey       = "";
let replyText     = "";
let roomPresenceRef   = null;
let globalPresenceRef = null;

// ─── Loader ──────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const loader = document.getElementById("loader");

  Promise.all([
    db.ref("cheatcode").limitToLast(1).once("value"),
    db.ref("messages").once("value"),
  ]).then(([cheatSnap, msgSnap]) => {
    cheatSnap.forEach(child => {
      const code = child.val()?.cheat;
      if (code) cheat(code);
    });

    msgSnap.forEach(child => renderMessage(child.val()));

    setTimeout(() => { loader.style.display = "none"; }, 300);
  }).catch(err => {
    console.error("Loader error:", err);
    loader.style.display = "none";
  });
});

// ─── Room ────────────────────────────────────────────────────────────────────
document.getElementById("keyInput").addEventListener("change", (e) => {
  const value = e.target.value.trim();
  roomKey   = value;
  sharedKey = value;

  joinRoom(roomKey);
  document.getElementById("chatBox").innerHTML = "";

  db.ref("messages").once("value", snapshot => {
    snapshot.forEach(child => renderMessage(child.val()));
  });

  focusInput();
});

function joinRoom(room) {
  if (roomPresenceRef) roomPresenceRef.remove();

  roomPresenceRef = db.ref(`presence/${room}/${userId}`);
  roomPresenceRef.set(true);
  roomPresenceRef.onDisconnect().remove();

  updateRoomPresence(room);
  db.ref(`typing/${room}`).on("value", snapshot => {

  const users = [];

  snapshot.forEach(child => {

    if (child.key !== userId) {
      users.push(child.key);
    }

  });

  document.getElementById(
    "typingIndicator"
  ).innerText =
    users.length
      ? "Someone is typing..."
      : "";

});
}

function updateRoomPresence(room) {
  db.ref(`presence/${room}`).on("value", snapshot => {
    document.getElementById("onlineCount").innerText = `🔵 ${snapshot.numChildren()}`;
  });
}

function showUniverse() {
  const universeRef = db.ref("presence_global");
  globalPresenceRef = universeRef.child(userId);

  globalPresenceRef.set(true);
  globalPresenceRef.onDisconnect().remove();

  universeRef.on("value", snapshot => {
    document.getElementById("UniCount").innerText = `🔴 ${snapshot.numChildren()}`;
  });
}

// ─── Messages ────────────────────────────────────────────────────────────────
db.ref("messages").on("child_added", snapshot => {
  if (sharedKey) renderMessage(snapshot.val());
});

function renderMessage(msg) {
  const chatBox      = document.getElementById("chatBox");
  const messageInput = document.getElementById("messageInput");
  const wasFocused   = document.activeElement === messageInput;

  try {
    const decrypted = CryptoJS.AES.decrypt(msg.data, sharedKey).toString(CryptoJS.enc.Utf8);
    if (!decrypted) throw new Error("Invalid decryption");

    const timeSent = msg.t || new Date().toLocaleString();
    const replyHTML = msg.reply ? `<div class="reply">${msg.reply}</div>` : "";
    let content = "";

    if (msg.type === "text") {
      content = `
        <div class="chatBox">
          <div class="data">
            <div class="chatbox">
              ${replyHTML}
              <div class="text">${makeLinksClickable(decrypted)}</div>
            </div>
            <time class="time">${timeSent}</time>
          </div>
          <div class="util" onclick="replying(this)">⤶</div>
        </div>`;
    } else if (msg.type === "image") {
      content = `
        <div class="chatBox">
          <div class="data">
            <div class="chatbox">
              ${replyHTML}
              <div class="text">
                <img
  src="${decrypted}"
  class="chat-image"
  onclick="openImage(this.src)"
  style="max-width:60vw;border-radius:7px;cursor:pointer;">
              </div>
            </div>
            <time class="time">${timeSent}</time>
          </div>
          <div class="util" onclick="replying(this)">⤶</div>
        </div>`;
    }

    chatBox.insertAdjacentHTML("beforeend", content);
    chatBox.scrollTop = chatBox.scrollHeight;
    if (wasFocused) messageInput.focus();
  } catch (e) {
    // Silently ignore messages that fail decryption (wrong room key)
  }

  scrollToBottom();
}

function sendMessage() {
  const room    = document.getElementById("keyInput").value.trim();
  const message = document.getElementById("messageInput").value.trim();

  if (!message || !sharedKey || !room) {
    focusInput();
    return;
  }

  const now           = new Date();
  const formattedTime = `${now.getHours()}:${now.getMinutes().toString().padStart(2, "0")} ${now.getDate()}|${now.getMonth() + 1}|${now.getFullYear().toString().slice(-2)}`;

  const msgData = {
    type: "text",
    data: CryptoJS.AES.encrypt(message, sharedKey).toString(),
    key:  sharedKey,
    t:    formattedTime,
  };

  if (replyText) {
    msgData.reply = replyText;
    replyText = "";
  }

  db.ref("messages").push(msgData);
  document.getElementById("messageInput").value = "";

  cancelReply();
  scrollToBottom();
  focusInput();
}

function replying(el) {
  const chatBox = el.closest(".chatBox");
  replyText = chatBox.querySelector(".text").innerText;

  const preview = document.getElementById("replyPreview");

  preview.innerHTML = `
    <div class="reply-card">
      Replying to:
      ${replyText.substring(0,100)}
      <button onclick="cancelReply()">✕</button>
    </div>
  `;

  preview.style.display = "block";

  focusInput();
}

function cancelReply() {
  replyText = "";

  const preview = document.getElementById("replyPreview");

  preview.innerHTML = "";
  preview.style.display = "none";
}

// ─── Cheat Codes ─────────────────────────────────────────────────────────────
document.getElementById("cheat").addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    cheat();
  }
});

function cheat(inputCode = "") {
  const code = inputCode || document.getElementById("cheat").value.trim().toLowerCase();
  document.getElementById("cheat").value = "";

  if (code === "cleardb") {
    db.ref().remove();
    document.getElementById("chatBox").innerHTML = "";
    db.ref("cheatcode").push({ cheat: "def" });
    return;
  }

  if (code === "clear") {
    const room = document.getElementById("keyInput").value.trim();
    db.ref("/messages").once("value").then(snapshot => {
      snapshot.forEach(child => {
        if (child.val().key === room) db.ref("/messages/" + child.key).remove();
      });
    }).catch(err => console.error("Error clearing messages:", err));
    document.getElementById("chatBox").innerHTML = "";
    return;
  }

  if (code === "d") {
    const room = document.getElementById("keyInput").value.trim();
    db.ref("/messages").once("value").then(snapshot => {
      const matching = [];
      snapshot.forEach(child => {
        if (child.val().key === room) matching.push({ key: child.key });
      });
      if (matching.length > 0) {
        const last = matching[matching.length - 1];
        db.ref("/messages/" + last.key).remove()
          .then(() => console.log("Last entry deleted"))
          .catch(err => console.error("Error deleting last entry:", err));
      }
    }).catch(err => console.error("Error fetching messages:", err));
    removeLastChild("#chatBox");
  }
}

// ─── Utilities ───────────────────────────────────────────────────────────────
document.getElementById("messageInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

function focusInput() {
  document.getElementById("messageInput").focus();
}

function scrollToBottom() {

  const bottom =
    document.getElementById("v");

  if (bottom) {

    bottom.scrollIntoView({
      behavior: "smooth"
    });

  }

}

// Keep old name working (used inline in HTML)
function down() { scrollToBottom(); }

function makeLinksClickable(text) {
  return text.replace(/((https?:\/\/|www\.)[^\s]+)/gi, (url) => {
    const href = url.startsWith("http") ? url : "https://" + url;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
}

function removeLastChild(selector) {
  const parent = document.querySelector(selector);
  if (parent?.lastElementChild) parent.removeChild(parent.lastElementChild);
}


let cheatBuffer = "";

document.addEventListener("keydown", e => {

  cheatBuffer += e.key.toLowerCase();

  if (cheatBuffer.length > 15) {
    cheatBuffer = cheatBuffer.slice(-15);
  }

  if (cheatBuffer.includes("opencheat")) {

    const code = prompt("Enter Cheat Code");

    if (code) cheat(code);

    cheatBuffer = "";
  }
});



let logoTapCount = 0;

document.querySelector(".logo")
.addEventListener("click", () => {

  logoTapCount++;

  if (logoTapCount >= 7) {

    const code = prompt("Cheat Code");

    if (code) cheat(code);

    logoTapCount = 0;

  }

  setTimeout(() => {

    logoTapCount = 0;

  }, 3000);

});




const searchBox = document.getElementById("searchBox");

if(searchBox){

searchBox.addEventListener("input", e => {

const term = e.target.value.toLowerCase();

document.querySelectorAll(".chatBox")
.forEach(msg => {

const text = msg.innerText.toLowerCase();

msg.style.display =
text.includes(term)
? "flex"
: "none";

});
});
}



const messageInput =
document.getElementById("messageInput");

messageInput.addEventListener("input", () => {

  if (!roomKey) return;

  db.ref(`typing/${roomKey}/${userId}`)
    .set(true);

  clearTimeout(window.typingTimeout);

  window.typingTimeout =
    setTimeout(() => {

      db.ref(`typing/${roomKey}/${userId}`)
        .remove();

    }, 1500);

});




db.ref(`typing/${roomKey}`)
.on("value", snapshot => {

 const users = [];

 snapshot.forEach(child => {

 if(child.key !== userId){

 users.push(child.key);

 }

 });

 document.getElementById(
 "typingIndicator"
 ).innerText =
 users.length
 ? "Someone is typing..."
 : "";
});










document.getElementById("send")
?.addEventListener("click", sendMessage);






// ─── Init ─────────────────────────────────────────────────────────────────────
showUniverse();


// ─── Image Upload ──────────────────────────────────────────────────────────

const imageInput = document.getElementById("imageInput");

if (imageInput) {

  imageInput.addEventListener("change", async (e) => {

    const file = e.target.files[0];

    if (!file) return;

    // Always read the live input value so it works even if the user
    // hasn't tabbed out of the room-number field yet.
    const room = document.getElementById("keyInput").value.trim();

    if (!room) {
      alert("Enter room number first");
      imageInput.value = "";
      return;
    }

    // Sync globals in case they weren't set yet
    sharedKey = room;
    roomKey   = room;

    if (file.size > 5 * 1024 * 1024) {
      alert("Image too large (max 5 MB)");
      imageInput.value = "";
      return;
    }

    try {

      const fileName =
        `${Date.now()}_${file.name}`;

      const storageRef =
        firebase.storage()
          .ref("images/" + fileName);

      await storageRef.put(file);

      const downloadURL =
        await storageRef.getDownloadURL();

      db.ref("messages").push({

        type: "image",

        data:
          CryptoJS.AES
            .encrypt(downloadURL, sharedKey)
            .toString(),

        key: sharedKey,

        t: new Date().toLocaleString()

      });

    } catch (err) {

      console.error(err);

      alert("Upload failed");

    }

    imageInput.value = "";

  });

}

// ─── Image Viewer ──────────────────────────────────────────────────────────

function openImage(src) {

  const viewer =
    document.getElementById("imageViewer");

  const img =
    document.getElementById("viewerImg");

  if (!viewer || !img) return;

  img.src = src;
  viewer.style.display = "flex";

}

function closeImage() {

  const viewer =
    document.getElementById("imageViewer");

  if (viewer) {
    viewer.style.display = "none";
  }

}





// ─── About ───────────────────────────────────────────────────────────────────
const creator     = "Bhagyam Pathak";
const description = `I've created this to connect two or more people privately. It's easy to use, no ads, no login required — just a secret Room no. you share with your friend(s). This website is end-to-end encrypted since the database contains only encrypted text, which can only be decrypted using your Room no.`;
console.log("JustUs v7 | " + creator);
console.log(description);