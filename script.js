const socket = io();
let username = "";
let roomCode = "";

// Error display functions
function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.style.display = 'block';
    errorElement.textContent = message;
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}

function backToSelection() {
    document.getElementById("join-room").classList.add("hidden");
    document.getElementById("chat-selection").classList.remove("hidden");
    history.replaceState({ screen: 'selection' }, '', '/');
}

// Add these functions near the top of the file after the initial variable declarations
function handleBrowserNavigation(event) {
    const currentState = event?.state;
    
    // Always prevent direct access to chat if no username
    if (!username) {
        document.getElementById("login-screen").classList.remove("hidden");
        document.getElementById("chat-selection").classList.add("hidden");
        document.getElementById("join-room").classList.add("hidden");
        document.getElementById("chat-room").classList.add("hidden");
        history.replaceState({ screen: 'login' }, '', '/');
        return;
    }

    // Handle back from chat room
    if (document.getElementById("chat-room").classList.contains("hidden") === false) {
        cleanupRoom();
        setTimeout(() => {
            document.getElementById("chat-room").classList.add("hidden");
            document.getElementById("chat-selection").classList.remove("hidden");
            history.replaceState({ screen: 'selection' }, '', '/');
        }, 1500); // Give time for the message to be seen
        return;
    }

    // Handle back from selection to login
    if (document.getElementById("chat-selection").classList.contains("hidden") === false) {
        username = ""; // Clear username when going back to login
        document.getElementById("chat-selection").classList.add("hidden");
        document.getElementById("login-screen").classList.remove("hidden");
        history.replaceState({ screen: 'login' }, '', '/');
        return;
    }

    // Handle back from join room to selection
    if (document.getElementById("join-room").classList.contains("hidden") === false) {
        document.getElementById("join-room").classList.add("hidden");
        document.getElementById("chat-selection").classList.remove("hidden");
        history.replaceState({ screen: 'selection' }, '', '/');
        return;
    }
}

// Add this near the top of the file
window.addEventListener('popstate', handleBrowserNavigation);

// Add this function near the top of the file
function handlePageLoad() {
    // Reset to initial state
    username = "";
    roomCode = "";
    
    // Show login screen
    document.getElementById("login-screen").classList.remove("hidden");
    document.getElementById("chat-selection").classList.add("hidden");
    document.getElementById("join-room").classList.add("hidden");
    document.getElementById("chat-room").classList.add("hidden");
    
    // Set initial history state
    history.replaceState({ screen: 'login' }, '', '/');
}

// Step 1: Enter Username
function enterChat() {
    username = document.getElementById("username").value.trim();
    if (!username) {
        showError("username-error", "Please enter a username");
        return;
    }
    if (username.length < 3) {
        showError("username-error", "Username must be at least 3 characters long");
        return;
    }

    // Check if username exists
    socket.emit("checkUsername", username);
}

// Add new socket listener for username check result
socket.on("usernameCheckResult", (isTaken) => {
    if (isTaken) {
        showError("username-error", "Username already exists. Please choose another one");
        return;
    }
    
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("chat-selection").classList.remove("hidden");
    history.pushState({ screen: 'selection' }, '', '/');
    initializeChatSelectionKeyboardNav();
});

// Step 2: Host a Room
function hostRoom() {
    if (!username) {
        showError("username-error", "Please enter a username first");
        return;
    }
    // Ensure any previous room is cleaned up
    cleanupRoom();
    socket.emit("createRoom", username);
}

// Receive Room Code from Server
socket.on("roomCreated", (code) => {
    roomCode = code;
    document.getElementById("room-id").innerText = `(${roomCode})`;
    document.getElementById("chat-selection").classList.add("hidden");
    document.getElementById("chat-room").classList.remove("hidden");
    // Only push one state for chat
    history.pushState({ screen: 'chat' }, '', '/');
    addSystemMessage("Room created successfully!");
});

function addSystemMessage(message) {
    const messagesDiv = document.getElementById("messages");
    messagesDiv.innerHTML += `<div class="system-message">${message}</div>`;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Step 3: Join a Room
function showJoinRoom() {
    document.getElementById("chat-selection").classList.add("hidden");
    document.getElementById("join-room").classList.remove("hidden");
    history.pushState({ screen: 'join' }, '', '/');
}

function joinRoom() {
    roomCode = document.getElementById("room-code").value.trim();
    if (!roomCode) {
        showError("room-error", "Please enter a room code");
        return;
    }
    if (roomCode.length !== 6 || isNaN(roomCode)) {
        showError("room-error", "Room code must be 6 digits");
        return;
    }
    socket.emit("joinRoom", { roomCode, username });
}

socket.on("error", (message) => {
    if (message === "Username already taken in this room!") {
        showError("username-error", message);
        roomCode = "";
        username = "";
        document.getElementById("join-room").classList.add("hidden");
        document.getElementById("login-screen").classList.remove("hidden");
        document.getElementById("username").value = "";
    } else if (message === "Room is full! Only 2 users allowed.") {
        showError("room-error", message);
        document.getElementById("room-code").value = "";
        setTimeout(() => {
            document.getElementById("join-room").classList.add("hidden");
            document.getElementById("chat-selection").classList.remove("hidden");
        }, 2000);
    } else {
        showError("room-error", message);
        document.getElementById("room-code").value = "";
    }
});

socket.on("userJoined", (user) => {
    document.getElementById("room-id").innerText = `(${roomCode})`;
    document.getElementById("join-room").classList.add("hidden");
    document.getElementById("chat-room").classList.remove("hidden");
    // Only push one state for chat
    history.pushState({ screen: 'chat' }, '', '/');
    addSystemMessage(`${user} joined the chat`);
});

// Update the socket event listener for userLeft
socket.on("userLeft", (data) => {
    // Show the leave message for any user
   
    
    // If host left, just show a notification but don't close the room
    if (data.isHost) {
        addSystemMessage(`${data.username} (Host) left the chat`);
    }
    else{
        addSystemMessage(`${data.username} left the chat`);

    }
});

function sendMessage() {
    const messageInput = document.getElementById("message");
    const message = messageInput.value.trim();
    
    if (!message) {
        return;
    }
    
    if (message.length > 500) {
        showError("message-error", "Message too long (max 500 characters)");
        return;
    }

    socket.emit("sendMessage", { roomCode, message, username });
    messageInput.value = "";
}

socket.on("receiveMessage", ({ username: messageUsername, message }) => {
    const messagesDiv = document.getElementById("messages");
    const isCurrentUser = messageUsername === username;
    const messageClass = isCurrentUser ? 'message current-user' : 'message other-user';
    messagesDiv.innerHTML += `<div class="${messageClass}"><b>${messageUsername}:</b> ${message}</div>`;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

// Add this function to handle button animation
function animateButton(button) {
    button.classList.add('button-click-animation');
    setTimeout(() => {
        button.classList.remove('button-click-animation');
    }, 100);
}

// Modify existing event listeners to include animation
document.getElementById("message").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        const sendButton = document.querySelector('.chat-input-container button');
        animateButton(sendButton);
        sendMessage();
    }
});

document.getElementById("username").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        const nextButton = document.querySelector('#login-screen button');
        animateButton(nextButton);
        enterChat();
    }
});

document.getElementById("room-code").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        const joinButton = document.querySelector('#join-room button');
        animateButton(joinButton);
        joinRoom();
    }
});

// Add click animation to all buttons
document.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', function(event) {
        animateButton(this);
    });
});

// Handle disconnection
socket.on("disconnect", () => {
    addSystemMessage("Disconnected from server. Please refresh the page.");
});

function copyRoomCode() {
    // Remove parentheses from the room code display
    const cleanRoomCode = roomCode.toString().replace(/[()]/g, '');
    
    // Copy to clipboard
    navigator.clipboard.writeText(cleanRoomCode)
        .then(() => {
            const copyButton = document.querySelector('.copy-button');
            const originalText = copyButton.textContent;
            copyButton.textContent = 'Copied!';
            setTimeout(() => {
                copyButton.textContent = originalText;
            }, 2000);
        })
        .catch(err => {
            console.error('Failed to copy:', err);
            showError("message-error", "Failed to copy room code");
        });
}

// Add this new function to handle chat selection keyboard navigation
function initializeChatSelectionKeyboardNav() {
    const hostButton = document.querySelector('#chat-selection button:nth-child(2)');
    const joinButton = document.querySelector('#chat-selection button:nth-child(3)');
    let currentSelection = 'host';

    function updateButtonStyles() {
        // Remove previous keyboard-selected class from all buttons
        document.querySelectorAll('#chat-selection button').forEach(btn => {
            btn.classList.remove('keyboard-selected');
        });
        
        // Add keyboard-selected class to current selection
        if (currentSelection === 'host') {
            hostButton.classList.add('keyboard-selected');
        } else {
            joinButton.classList.add('keyboard-selected');
        }
    }

    // Add mouse interaction handlers
    hostButton.addEventListener('mouseenter', () => {
        if (!hostButton.classList.contains('keyboard-selected')) {
            document.querySelectorAll('#chat-selection button').forEach(btn => {
                btn.classList.remove('keyboard-selected');
            });
        }
    });

    joinButton.addEventListener('mouseenter', () => {
        if (!joinButton.classList.contains('keyboard-selected')) {
            document.querySelectorAll('#chat-selection button').forEach(btn => {
                btn.classList.remove('keyboard-selected');
            });
        }
    });

    document.addEventListener('keydown', function(event) {
        if (!document.getElementById('chat-selection').classList.contains('hidden')) {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                currentSelection = currentSelection === 'host' ? 'join' : 'host';
                updateButtonStyles();
            } else if (event.key === 'Enter') {
                if (currentSelection === 'host') {
                    animateButton(hostButton);
                    hostRoom();
                } else {
                    animateButton(joinButton);
                    showJoinRoom();
                }
            }
        }
    });

    // Initialize the button styles
    updateButtonStyles();
}

// Modify the window load event listener
window.addEventListener('load', () => {
    handlePageLoad();
    // Prevent forward navigation
    history.pushState(null, '', '/');
    history.pushState(null, '', '/');
    history.back();
});

// Update the server-side socket handler to ensure the message is sent before disconnection
socket.on("userLeaving", ({ roomCode, username }) => {
    if (roomCode && rooms.has(roomCode)) {
        const room = rooms.get(roomCode);
        const isHost = Array.from(room.users.entries())[0][0] === socket.id;
        
        // Emit to all users in the room
        io.to(roomCode).emit("userLeft", { 
            username, 
            isHost: isHost 
        });
    }
});

// Update the history state management
function updateHistoryState(screen) {
    switch(screen) {
        case 'login':
            history.replaceState({ screen: 'login' }, '', '/');
            break;
        case 'selection':
            history.pushState({ screen: 'selection' }, '', '/');
            break;
        case 'join':
            history.pushState({ screen: 'join' }, '', '/');
            break;
        case 'chat':
            history.pushState({ screen: 'chat' }, '', '/');
            break;
    }
}

// Modify the cleanupRoom function
function cleanupRoom() {
    if (roomCode) {
        socket.emit("userLeaving", { roomCode, username });
        setTimeout(() => {
            socket.emit("leaveRoom", { roomCode, username });
            roomCode = "";
            document.getElementById("messages").innerHTML = "";
            document.getElementById("room-id").innerText = "";
        }, 1000);
    }
}

// Add this new socket event listener
socket.on("forceDisconnect", () => {
    cleanupRoom();
    document.getElementById("chat-room").classList.add("hidden");
    document.getElementById("chat-selection").classList.remove("hidden");
    history.replaceState({ screen: 'selection' }, '', '/');
    addSystemMessage("Room has been closed by the host.");
});

// Add these near the top of your script.js file
let isConnected = true;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

// Update the socket initialization
const socket = io({
    reconnection: true,
    reconnectionAttempts: maxReconnectAttempts,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
});

// Add these event listeners
socket.on('connect', () => {
    isConnected = true;
    reconnectAttempts = 0;
    if (roomCode) {
        socket.emit("joinRoom", { roomCode, username });
    }
});

socket.on('disconnect', () => {
    isConnected = false;
    addSystemMessage("Connection lost. Attempting to reconnect...");
});

socket.on('reconnect', (attemptNumber) => {
    isConnected = true;
    addSystemMessage("Reconnected to server!");
    if (roomCode) {
        socket.emit("joinRoom", { roomCode, username });
    }
});

socket.on('reconnect_failed', () => {
    addSystemMessage("Failed to reconnect. Please refresh the page.");
});

// Add visibility change handler
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !isConnected) {
        socket.connect();
    }
});

// Add message retry mechanism
function sendMessageWithRetry(messageData, retries = 3) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      socket.emit("sendMessage", messageData, (ack) => {
        if (ack?.success) {
          resolve();
        } else if (retries > 0) {
          setTimeout(() => {
            retries--;
            attempt();
          }, 1000);
        } else {
          reject(new Error("Failed to send message"));
        }
      });
    };
    attempt();
  });
}

// Add message queue
const messageQueue = [];
async function processMessageQueue() {
  while (messageQueue.length > 0) {
    const message = messageQueue[0];
    try {
      await sendMessageWithRetry(message);
      messageQueue.shift();
    } catch (error) {
      addSystemMessage("Failed to send message. Please try again.");
      break;
    }
  }
}

// Add process handling for production
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Notify monitoring service
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  // Notify monitoring service
});

// Add graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Performing graceful shutdown...');
  server.close(() => {
    // Close database connections
    process.exit(0);
  });
});
