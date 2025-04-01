const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const sanitizeHtml = require('sanitize-html');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  connectTimeout: 45000,
  maxHttpBufferSize: 1e6 // 1MB max message size
});

app.use(cors());
app.use(express.static(path.join(__dirname)));

// Add rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));

// Add security headers
app.use(helmet());

// Add message sanitization
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/selection", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/join", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/chat", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("*", (req, res) => {
  res.redirect("/");
});

const rooms = new Map(); // Store active rooms

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("createRoom", (username) => {
    try {
      if (!username || typeof username !== 'string') {
        throw new Error("Invalid username");
      }

      const roomCode = Math.floor(100000 + Math.random() * 900000).toString();
      rooms.set(roomCode, { 
        users: new Map([[socket.id, username]]),
        messages: [],
        maxUsers: 2 // Set maximum users to 2
      });
      
      socket.join(roomCode);
      socket.emit("roomCreated", roomCode);
      console.log(`Room ${roomCode} created by ${username}`);
    } catch (error) {
      socket.emit("error", error.message);
    }
  });

  socket.on("joinRoom", ({ roomCode, username }) => {
    try {
      if (!roomCode || !username) {
        throw new Error("Invalid room code or username");
      }

      const room = rooms.get(roomCode);
      if (!room) {
        throw new Error("Invalid Room Code!");
      }

      // Check if room is full
      if (room.users.size >= room.maxUsers) {
        throw new Error("Room is full! Only 2 users allowed.");
      }

      // Check if username is already taken
      if (Array.from(room.users.values()).includes(username)) {
        throw new Error("Username already taken in this room!");
      }

      room.users.set(socket.id, username);
      socket.join(roomCode);
      io.to(roomCode).emit("userJoined", username);
      console.log(`${username} joined room ${roomCode}`);
    } catch (error) {
      socket.emit("error", error.message);
    }
  });

  socket.on("sendMessage", ({ roomCode, message, username }) => {
    try {
      if (!roomCode || !message || !username) {
        throw new Error("Invalid message data");
      }

      // Sanitize message
      const sanitizedMessage = sanitizeHtml(message, {
        allowedTags: [],
        allowedAttributes: {}
      });

      // Add message length validation
      if (sanitizedMessage.length > 500) {
        throw new Error("Message too long");
      }

      const room = rooms.get(roomCode);
      if (!room) {
        throw new Error("Room not found");
      }

      // Add timestamp and message ID
      const messageData = {
        id: Date.now().toString(),
        username,
        message: sanitizedMessage,
        timestamp: new Date().toISOString()
      };

      io.to(roomCode).emit("receiveMessage", messageData);
      room.messages.push(messageData);

      // Limit stored messages per room
      if (room.messages.length > 100) {
        room.messages.shift();
      }
    } catch (error) {
      socket.emit("error", error.message);
    }
  });

  socket.on("checkUsername", (username) => {
    let isUsernameTaken = false;
    
    // Check all rooms for the username
    rooms.forEach((room) => {
      if (Array.from(room.users.values()).includes(username)) {
        isUsernameTaken = true;
      }
    });
    
    socket.emit("usernameCheckResult", isUsernameTaken);
  });

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

  socket.on("leaveRoom", ({ roomCode, username }) => {
    if (roomCode && rooms.has(roomCode)) {
        const room = rooms.get(roomCode);
        
        // Remove user from room
        room.users.delete(socket.id);
        socket.leave(roomCode);
        
        // Don't delete the room even if the host leaves
        // This allows other users to continue chatting
    }
  });

  socket.on("roomClosed", () => {
    // Force all users in the room to leave
    socket.emit("forceDisconnect");
  });

  socket.on("disconnect", () => {
    // Find the room this user was in
    for (const [roomCode, room] of rooms.entries()) {
        if (room.users.has(socket.id)) {
            const username = room.users.get(socket.id);
            const isHost = Array.from(room.users.entries())[0][0] === socket.id;
            
            // Notify everyone in the room
            io.to(roomCode).emit("userLeft", { 
                username, 
                isHost: isHost 
            });
            
            // Remove user from room
            room.users.delete(socket.id);
            socket.leave(roomCode);
            
            // Don't delete the room even if host disconnects
            break;
        }
    }
  });
});

// Add room cleanup interval
setInterval(() => {
  rooms.forEach((room, code) => {
    // Clean up inactive rooms (no messages in last hour)
    const lastMessage = room.messages[room.messages.length - 1];
    if (lastMessage && Date.now() - new Date(lastMessage.timestamp) > 3600000) {
      rooms.delete(code);
    }
  });
}, 3600000); // Check every hour

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));