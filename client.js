// Global variables
let currentScreen = 'welcome-screen';
let gameData = null;
let selectedModes = [];
let currentGameId = null;
let currentPlayerId = null;
let isHost = false;
let localQuestions = [];
let currentLocalQuestionIndex = 0;
let socket = null;
let isConnected = false;
let players = [];

// Load the game data from JSON file
function loadGameData() {
  return fetch('data.json')
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to load game data');
      }
      return response.json();
    })
    .then(data => {
      gameData = data;
      return data;
    })
    .catch(error => {
      console.error('Error loading game data:', error);
      showNotification('Failed to load game data. Please refresh and try again.', 'error');
      return null;
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  // Load game data in background
  loadGameData();
  
  // Add event listeners to mode checkboxes
  document.querySelectorAll('input[name="mode"], input[name="share-mode"]').forEach(checkbox => {
    checkbox.addEventListener('change', function(e) {
      // If "All Categories" is checked, check all other boxes
      if (this.value === 'All of the above' && this.checked) {
        const checkboxes = this.closest('.mode-selection').querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
          cb.checked = true;
        });
      }
      
      // If a regular category is unchecked, uncheck "All Categories"
      if (this.value !== 'All of the above' && !this.checked) {
        const allCategoriesCheckbox = this.closest('.mode-selection').querySelector('input[value="All of the above"]');
        if (allCategoriesCheckbox) {
          allCategoriesCheckbox.checked = false;
        }
      }
    });
  });
});

// Show a specific screen
function showScreen(id) {
  // Hide all screens
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.add('hidden');
  });
  
  // Show the requested screen
  document.getElementById(id).classList.remove('hidden');
  currentScreen = id;
  
  // Show/hide back button
  const backButton = document.querySelector('.back-button');
  if (id === 'welcome-screen') {
    backButton.classList.add('hidden');
  } else {
    backButton.classList.remove('hidden');
  }
}

// Go back to previous screen
function goBack() {
  showScreen('welcome-screen');
}

// Show a notification message
function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className = 'notification'; // Reset classes
  notification.classList.add(type);
  notification.classList.remove('hidden');
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    notification.classList.add('hidden');
  }, 5000);
}

// Show join screen
function showJoinScreen() {
  showScreen('join-game');
  document.getElementById('join-loading-message').classList.add('hidden');
  document.getElementById('join-error-message').classList.add('hidden');
}

// Start a local game
function startLocalGame() {
  console.log("Starting local game");
  
  // Get selected modes
  selectedModes = [];
  document.querySelectorAll('input[name="mode"]:checked').forEach(checkbox => {
    selectedModes.push(checkbox.value);
  });
  
  if (selectedModes.length === 0) {
    showNotification("Please select at least one category", "error");
    return;
  }
  
  // Setup and start the game
  setupLocalGameQuestions();
}

// Setup questions for local game
function setupLocalGameQuestions() {
  // If gameData is not loaded yet, wait for it
  if (!gameData) {
    loadGameData().then(data => {
      if (data) {
        localQuestions = extractQuestionsFromData(data);
        startLocalGameWithQuestions();
      }
    });
  } else {
    localQuestions = extractQuestionsFromData(gameData);
    startLocalGameWithQuestions();
  }
}

// Extract questions from the data based on selected categories
function extractQuestionsFromData(data) {
  let allQuestions = [];
  
  selectedModes.forEach(mode => {
    // Handle "All Categories" special case
    if (mode === 'All of the above') {
      Object.keys(data).forEach(category => {
        if (Array.isArray(data[category])) {
          data[category].forEach(question => {
            allQuestions.push({
              text: question,
              category: category
            });
          });
        }
      });
    } 
    // Handle regular categories
    else if (data[mode] && Array.isArray(data[mode])) {
      data[mode].forEach(question => {
        allQuestions.push({
          text: question,
          category: mode
        });
      });
    }
  });
  
  // Shuffle questions
  allQuestions.sort(() => Math.random() - 0.5);
  
  return allQuestions;
}

// Start local game with prepared questions
function startLocalGameWithQuestions() {
  if (localQuestions.length === 0) {
    showNotification("No questions available for selected categories", "error");
    return;
  }
  
  // Reset question index
  currentLocalQuestionIndex = 0;
  
  // Update game mode title
  updateLocalGameModeTitle();
  
  // Show first question
  showLocalQuestion();
  
  // Show game screen
  showScreen('local-game-screen');
}

// Update the local game mode title based on selected modes
function updateLocalGameModeTitle() {
  let title = "Never Have I Ever";
  
  if (selectedModes.length === 1 && selectedModes[0] !== 'All of the above') {
    title += ": " + selectedModes[0];
  } else if (selectedModes.includes('All of the above')) {
    title += ": All Categories";
  } else if (selectedModes.length > 0) {
    title += ": Mixed Categories";
  }
  
  document.getElementById('local-game-mode-title').textContent = title;
}

// Show the current local question
function showLocalQuestion() {
  if (currentLocalQuestionIndex < localQuestions.length) {
    const question = localQuestions[currentLocalQuestionIndex];
    document.getElementById('local-game-question').textContent = "Never have I ever " + question.text;
  } else {
    document.getElementById('local-game-question').textContent = "Game Over! You've gone through all the questions.";
    document.getElementById('local-next-btn').disabled = true;
  }
}

// Move to next local question
function nextLocalQuestion() {
  currentLocalQuestionIndex++;
  showLocalQuestion();
}

// Create a multiplayer game
function createMultiplayerGame() {
  console.log("Setting up multiplayer game");
  
  // Get selected modes
  selectedModes = [];
  document.querySelectorAll('input[name="share-mode"]:checked').forEach(checkbox => {
    selectedModes.push(checkbox.value);
  });
  
  if (selectedModes.length === 0) {
    showNotification("Please select at least one category", "error");
    return;
  }
  
  // Get host name
  const hostName = document.getElementById('host-name-input').value.trim();
  if (!hostName) {
    showNotification("Please enter your name", "error");
    return;
  }
  
  // Initialize game connection
  initializeSocketConnection(hostName);
}

// Initialize game connection
function initializeSocketConnection(playerName) {
  console.log("Initializing socket connection");
  showNotification("Connecting to game server...", "info");
  
  // Close existing socket if there is one
  if (socket) {
    socket.close();
  }
  
  // Initialize Socket.IO connection
  socket = io.connect(window.location.origin, {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });
  
  // Set up socket event handlers
  socket.on('connect', () => {
    console.log('Socket connected');
    isConnected = true;
    showNotification("Connected to game server", "success");
    
    // If joining with a game code
    if (document.getElementById('join-game').classList.contains('hidden') === false) {
      const joiningName = document.getElementById('player-name-input').value.trim();
      const gameCode = document.getElementById('game-code-input').value.trim().toUpperCase();
      
      if (joiningName && gameCode) {
        joinGame(joiningName, gameCode);
      }
    } else if (playerName) {
      // Creating a new game
      createGame(playerName, selectedModes);
    }
  });
  
  socket.on('connection_response', (data) => {
    console.log('Connection response:', data);
  });
  
  socket.on('error', (data) => {
    console.error('Socket error:', data);
    showNotification(data.message || 'An error occurred', 'error');
  });
  
  socket.on('join_success', (data) => {
    console.log('Successfully joined game:', data);
    updateJoinedPlayersList(data.players);
  });
  
  socket.on('player_joined', (data) => {
    console.log('Player joined:', data);
    showNotification(`${data.player.name} joined the game`, 'info');
    updateJoinedPlayersList(data.players);
  });
  
  socket.on('disconnect', () => {
    console.log('Socket disconnected');
    isConnected = false;
    showNotification("Disconnected from game server", "warning");
  });
}

// Create a new game on the server
function createGame(playerName, modes) {
  console.log("Creating new game");
  
  try {
    // Generate a unique player ID
    const playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Create game via API
    fetch('/api/games', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        host_id: playerId,
        host_name: playerName,
        game_modes: modes
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      console.log("Game created:", data);
      currentGameId = data.id;
      currentPlayerId = playerId;
      isHost = true;
      
      // Join the socket.io room for this game
      if (socket && isConnected) {
        socket.emit('join_game', {
          game_id: currentGameId,
          player_id: currentPlayerId
        });
      }
      
      // Update game code display
      document.getElementById('game-code-display').textContent = currentGameId;
      
      // Generate QR code
      generateQRCode(currentGameId);
      
      // Show QR screen
      showScreen('qr-section');
      
      // Add questions to the game from selected categories
      addQuestionsToGame(currentGameId, modes);
    })
    .catch(error => {
      console.error("Error creating game:", error);
      showNotification("Failed to create game: " + error.message, "error");
    });
    
  } catch (error) {
    console.error("Error creating game:", error);
    showNotification("Failed to create game: " + error.message, "error");
  }
}

// Add questions to a game from selected categories
function addQuestionsToGame(gameId, selectedCategories) {
  // If gameData is not loaded yet, load it now
  if (!gameData) {
    loadGameData().then(data => {
      sendQuestionsToServer(gameId, data, selectedCategories);
    });
  } else {
    sendQuestionsToServer(gameId, gameData, selectedCategories);
  }
}

// Extract and send questions to the server
function sendQuestionsToServer(gameId, data, selectedCategories) {
  let gameQuestions = [];
  
  selectedCategories.forEach(category => {
    if (data[category] && Array.isArray(data[category])) {
      // Add each question with its category
      data[category].forEach(questionText => {
        gameQuestions.push({
          text: questionText,
          category: category
        });
      });
    }
  });
  
  // Shuffle questions
  gameQuestions.sort(() => Math.random() - 0.5);
  
  // Send questions to the server
  fetch(`/api/games/${gameId}/questions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      questions: gameQuestions
    })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Failed to add questions to game');
    }
    return response.json();
  })
  .then(data => {
    console.log("Questions added to game:", data);
  })
  .catch(error => {
    console.error("Error adding questions:", error);
    showNotification("Failed to add questions to game", "error");
  });
}

// Join an existing game
function joinMultiplayerGame() {
  const playerName = document.getElementById('player-name-input').value.trim();
  const gameCode = document.getElementById('game-code-input').value.trim().toUpperCase();
  
  if (!playerName) {
    showNotification("Please enter your name", "error");
    return;
  }
  
  if (!gameCode) {
    showNotification("Please enter a game code", "error");
    return;
  }
  
  // Show loading message
  document.getElementById('join-loading-message').classList.remove('hidden');
  document.getElementById('join-error-message').classList.add('hidden');
  
  // Initialize socket connection if not already connected
  if (!socket || !isConnected) {
    initializeSocketConnection(playerName);
  } else {
    // Use existing connection
    joinGame(playerName, gameCode);
  }
}

// Join a game on the server
function joinGame(playerName, gameCode) {
  console.log("Joining game:", gameCode);
  
  try {
    // First check if the game exists
    fetch(`/api/games/${gameCode}`)
      .then(response => {
        if (!response.ok) {
          throw new Error('Game not found');
        }
        return response.json();
      })
      .then(gameData => {
        // Generate a unique player ID
        const playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // Join the game
        return fetch(`/api/games/${gameCode}/players`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            player_id: playerId,
            player_name: playerName
          })
        });
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to join game');
        }
        return response.json();
      })
      .then(playerData => {
        console.log("Joined game successfully:", playerData);
        
        // Store player and game info
        currentGameId = gameCode;
        currentPlayerId = playerData.id;
        isHost = playerData.is_host;
        
        // Join the socket.io room for this game
        if (socket && isConnected) {
          socket.emit('join_game', {
            game_id: currentGameId,
            player_id: currentPlayerId
          });
        }
        
        // Hide loading/error messages
        document.getElementById('join-loading-message').classList.add('hidden');
        document.getElementById('join-error-message').classList.add('hidden');
        
        // Redirect to game
        window.location.href = `game.html?game=${currentGameId}&player=${currentPlayerId}&host=${isHost}`;
      })
      .catch(error => {
        console.error("Error joining game:", error);
        document.getElementById('join-loading-message').classList.add('hidden');
        document.getElementById('join-error-message').textContent = error.message || "Failed to join game";
        document.getElementById('join-error-message').classList.remove('hidden');
      });
    
  } catch (error) {
    console.error("Error joining game:", error);
    document.getElementById('join-loading-message').classList.add('hidden');
    document.getElementById('join-error-message').textContent = "Failed to join game: " + error.message;
    document.getElementById('join-error-message').classList.remove('hidden');
  }
}

// Generate QR code for a game
function generateQRCode(gameId) {
  const gameUrl = `${window.location.origin}/game.html?game=${gameId}`;
  document.getElementById('qr-url').textContent = gameUrl;
  
  QRCode.toCanvas(document.getElementById('qrcode'), gameUrl, {
    width: 200,
    margin: 1,
    color: {
      dark: '#331e1e',
      light: '#fbeaea'
    }
  }, function (error) {
    if (error) {
      console.error('Error generating QR code:', error);
    }
  });
}

// Copy game URL to clipboard
function copyGameUrl() {
  const gameUrl = document.getElementById('qr-url').textContent;
  
  if (navigator.clipboard) {
    navigator.clipboard.writeText(gameUrl)
      .then(() => {
        showNotification("Game URL copied to clipboard!", "success");
      })
      .catch(err => {
        console.error('Failed to copy:', err);
        showNotification("Failed to copy URL", "error");
      });
  } else {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = gameUrl;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      showNotification(successful ? "Game URL copied to clipboard!" : "Failed to copy URL", 
                     successful ? "success" : "error");
    } catch (err) {
      console.error('Failed to copy:', err);
      showNotification("Failed to copy URL", "error");
    }
    
    document.body.removeChild(textArea);
  }
}

// Go to the game page as a host
function goToGameAsHost() {
  if (currentGameId && currentPlayerId) {
    window.location.href = `game.html?game=${currentGameId}&player=${currentPlayerId}&host=true`;
  }
}

// Update the list of joined players
function updateJoinedPlayersList(playersList) {
  if (!playersList) return;
  players = playersList;
  
  const list = document.getElementById('joined-players-list');
  list.innerHTML = '';
  
  playersList.forEach(player => {
    const li = document.createElement('li');
    li.textContent = player.name + (player.is_host ? ' (Host)' : '');
    list.appendChild(li);
  });
}
