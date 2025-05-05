// client.js - Never Have I Ever Game Client

// Global variables
let players = [];
let screenHistory = [];
let selectedModes = [];
let currentQuestionIndex = 0;
let questions = [];
let gameData = null;
let socket = null;
let currentGameId = '';
let currentPlayerId = '';
let isHost = false;
let isConnected = false;

// Default game data as a backup
const defaultGameData = {
  "workAndSchool": [
    "Never have I ever fallen asleep in class.",
    "Never have I ever cheated on a test.",
    "Never have I ever forgotten to do my homework.",
    "Never have I ever gotten detention.",
    "Never have I ever skipped a class."
  ],
  "Embarrassing & awkward moments": [
    "Never have I ever called a teacher 'mom' or 'dad'.",
    "Never have I ever tripped in front of the entire class.",
    "Never have I ever answered a question confidently and been completely wrong."
  ],
  "Tarvel & adventure": [
    "Never have I ever traveled alone.",
    "Never have I ever been on a road trip.",
    "Never have I ever flown in a helicopter."
  ],
  "Relationship & dating": [
    "Never have I ever gone on a blind date.",
    "Never have I ever been in love.",
    "Never have I ever kissed someone on the first date."
  ],
  "Party and fun": [
    "Never have I ever gone to a party and not remembered anything the next day.",
    "Never have I ever thrown a surprise party.",
    "Never have I ever danced all night at a party."
  ],
  "Money & shopping": [
    "Never have I ever bought something expensive just because it was on sale.",
    "Never have I ever splurged on something I didn't need.",
    "Never have I ever spent money on something and immediately regretted it."
  ],
  "girlsNight": [
    "Never have I ever had a girls' night sleepover.",
    "Never have I ever stayed up all night gossiping with my girlfriends.",
    "Never have I ever done a DIY spa night with my friends."
  ]
};

// DOM loaded event
document.addEventListener('DOMContentLoaded', () => {
  // Initialize game by loading data
  loadGameData();
});

// Function to show screens
function showScreen(id) {
  const currentVisible = document.querySelector('.screen:not(.hidden)');
  if (currentVisible) {
    screenHistory.push(currentVisible.id);
  }

  document.querySelectorAll('.screen').forEach(screen => screen.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  document.querySelector('.back-button').classList.toggle('hidden', screenHistory.length === 0);
}

// Function to go back
function goBack() {
  if (screenHistory.length > 0) {
    const previousScreen = screenHistory.pop();
    document.querySelectorAll('.screen').forEach(screen => screen.classList.add('hidden'));
    document.getElementById(previousScreen).classList.remove('hidden');
    document.querySelector('.back-button').classList.toggle('hidden', screenHistory.length === 0);
  }
}

// Show notification
function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.classList.remove('hidden');
  
  setTimeout(() => {
    notification.classList.add('hidden');
  }, 3000);
}

// Show Join Screen
function showJoinScreen() {
  showScreen('join-game');
  document.getElementById('player-name-input').focus();
}

// Load game data from data.json
function loadGameData() {
  return new Promise((resolve) => {
    fetch('data.json')
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        gameData = data;
        console.log("Loaded data.json successfully");
        resolve(gameData);
      })
      .catch(error => {
        console.error('Error loading questions:', error);
        gameData = JSON.parse(JSON.stringify(defaultGameData)); // Use a copy of the backup
        console.log("Using default game data instead");
        showNotification("Using default questions (couldn't load data.json)", "warning");
        resolve(gameData);
      });
  });
}

// Start local game (singleplayer)
function startLocalGame() {
  selectedModes = [];
  document.querySelectorAll('input[name="mode"]:checked').forEach(cb => selectedModes.push(cb.value));
  
  if (selectedModes.length === 0) {
    showNotification("Please select at least one category", "error");
    return;
  }
  
  setupLocalGameQuestions();
  showScreen('local-game-screen');
}

// Set up questions for local game
function setupLocalGameQuestions() {
  // If gameData is not loaded yet, load it now
  if (!gameData) {
    loadGameData().then(data => {
      extractQuestionsFromData(data);
    });
  } else {
    extractQuestionsFromData(gameData);
  }
}

// Extract questions from game data
function extractQuestionsFromData(data) {
  questions = [];
  
  selectedModes.forEach(mode => {
    if (data[mode] && Array.isArray(data[mode])) {
      questions = questions.concat(data[mode]);
    }
  });
  
  // Shuffle questions
  questions.sort(() => Math.random() - 0.5);
  
  // Reset question index
  currentQuestionIndex = 0;
  
  // Update game title based on selected modes
  updateLocalGameModeTitle();
  
  // Show first question
  showLocalQuestion();
}

// Update local game title based on selected modes
function updateLocalGameModeTitle() {
  const title = document.getElementById('local-game-mode-title');
  if (selectedModes.includes('All of the above')) {
    title.textContent = "Never Have I Ever: All Categories";
  } else if (selectedModes.length === 1) {
    title.textContent = "Never Have I Ever: " + selectedModes[0];
  } else {
    title.textContent = `Never Have I Ever: ${selectedModes.length} Categories`;
  }
}

// Show current local question
function showLocalQuestion() {
  const questionElement = document.getElementById('local-game-question');
  
  if (currentQuestionIndex < questions.length) {
    questionElement.textContent = questions[currentQuestionIndex];
  } else {
    questionElement.textContent = "Game Over! No more questions.";
    document.getElementById('local-next-btn').disabled = true;
  }
}

// Move to next local question
function nextLocalQuestion() {
  currentQuestionIndex++;
  showLocalQuestion();
}

// Create a multiplayer game
function createMultiplayerGame() {
  selectedModes = [];
  document.querySelectorAll('input[name="share-mode"]:checked').forEach(cb => selectedModes.push(cb.value));
  
  if (selectedModes.length === 0) {
    showNotification("Please select at least one category", "error");
    return;
  }
  
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
  console.log("Initializing game connection");
  showNotification("Connecting to game server...", "info");
  
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
}

// Create a new game on the server
function createGame(playerName, modes) {
  console.log("Creating new game");
  
  try {
    // Generate a unique player ID
    const playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Create game via API instead of socket
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
    showNotification("Please select at least one category", "error");
    return;
  }
  
  if (!gameCode) {
    showNotification("Please enter a game code", "error");
    return;
  }
  
  // Show loading message
  document.getElementById('join-loading-message').classList.remove('hidden');
  document.getElementById('join-error-message').classList.add('hidden');
  
  // Use our new direct API approach
  joinGame(playerName, gameCode);
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
        
        // Hide loading/error messages
        document.getElementById('join-loading-message').classList.add('hidden');
        document.getElementById('join-error-message').classList.add('hidden');
        
        // Redirect to game
        window.location.href = `game.html?game=${currentGameId}&player=${currentPlayerId}`;
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
  if (currentGameId) {
    window.location.href = `game.html?game=${currentGameId}&host=true`;
  }
}

// Update the list of joined players
function updateJoinedPlayersList() {
  const list = document.getElementById('joined-players-list');
  list.innerHTML = '';
  
  players.forEach(player => {
    const li = document.createElement('li');
    li.textContent = player.name + (player.isHost ? ' (Host)' : '');
    list.appendChild(li);
  });
}