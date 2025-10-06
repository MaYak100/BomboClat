// Константы таймингов
const TIMINGS = {
    BOMB_PREVIEW: 1000,        // Показ превью бомбы
    CARD_FLIP: 600,            // Анимация переворота карточки
    THEME_TRANSITION: 1200,    // Анимация волны темы
    CLICK_UNBLOCK: 1000,       // Разблокировка кликов после смены темы
    PLACE_TO_GUESS_DELAY: 1700, // Задержка перед сменой фазы
    ROUND_END_DELAY: 2500,     // Задержка перед новым раундом
    END_ROUND_INITIAL: 800     // Начальная задержка в конце раунда
};

// Состояние игры
const gameState = {
    currentScreen: 'lobby',
    gameMode: null, // 'offline' или 'online'
    roomCode: null,
    playerName: 'Гость',
    playerRole: null, // 'player1' или 'player2'
    roomRef: null,
    isTransitioning: false, // Блокировка кликов во время переходов
    isTransitioningTheme: false, // Флаг для предотвращения дублирования волны
    lastGamePhase: null, // Для отслеживания смены фазы
    activeTimeouts: [], // Активные таймеры для очистки
    opponentDisconnectHandled: false, // Флаг обработки отключения
    roundEndProcessed: false, // Флаг обработки конца раунда
    // Оффлайн состояние
    offlineState: {
        gamePhase: 'placing_bombs',
        bombs: [],
        selectedCells: [],
        currentPlayer: 1,
        scores: { player1: 0, player2: 0 }
    }
};

// DOM элементы
const screens = {
    lobby: document.getElementById('lobby-screen'),
    waiting: document.getElementById('waiting-screen'),
    game: document.getElementById('game-screen')
};

const elements = {
    // Лобби
    modeSelection: document.getElementById('mode-selection'),
    offlineBtn: document.getElementById('offline-btn'),
    onlineBtn: document.getElementById('online-btn'),
    onlineOptions: document.getElementById('online-options'),
    backToModeBtn: document.getElementById('back-to-mode-btn'),
    // Онлайн
    nicknameInput: document.getElementById('nickname-input'),
    roomCodeInput: document.getElementById('room-code-input'),
    createRoomBtn: document.getElementById('create-room-btn'),
    joinRoomBtn: document.getElementById('join-room-btn'),
    leaveRoomBtn: document.getElementById('leave-room-btn'),
    displayRoomCode: document.getElementById('display-room-code'),
    // Игра
    leaveGameBtn: document.getElementById('leave-game-btn'),
    gameBoard: document.getElementById('game-board'),
    gameStatus: document.getElementById('game-status'),
    leftPlayerInfo: document.getElementById('left-player'),
    rightPlayerInfo: document.getElementById('right-player'),
    leftPlayerName: document.getElementById('left-player-name'),
    rightPlayerName: document.getElementById('right-player-name'),
    leftPlayerScore: document.getElementById('left-player-score'),
    rightPlayerScore: document.getElementById('right-player-score'),
    // Эффекты
    themeWave: document.getElementById('theme-wave')
};

// Инициализация
function init() {
    createGameBoard();
    attachEventListeners();
    // Начинаем с light темы
    setTheme('light');
}

// Смена темы с волновым эффектом
function setTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
}

function transitionTheme(fromTheme, toTheme) {
    // Устанавливаем цвет волны в цвет новой темы
    elements.themeWave.className = 'theme-wave ' + toTheme;

    // Запускаем расширение круга
    setTimeout(() => {
        elements.themeWave.classList.add('expanding');
    }, 10);

    // Меняем тему одновременно с началом волны для плавного перехода элементов
    setTimeout(() => {
        setTheme(toTheme);
    }, 50);

    // Убираем волну после завершения (1.2s анимация)
    setTimeout(() => {
        elements.themeWave.classList.remove('expanding');
        setTimeout(() => {
            elements.themeWave.className = 'theme-wave';
        }, 100);
    }, 1300);
}

// Создание игрового поля
function createGameBoard() {
    elements.gameBoard.innerHTML = '';
    for (let i = 0; i < 9; i++) {
        const card = document.createElement('div');
        card.className = 'card hoverable wobble';
        card.dataset.index = i;

        card.innerHTML = `
            <div class="card-inner">
                <div class="card-face card-front"></div>
                <div class="card-face card-back"></div>
            </div>
        `;

        card.addEventListener('click', () => handleCardClick(i));
        elements.gameBoard.appendChild(card);
    }
}

// Обновление классов карточек в зависимости от состояния
function updateCardClasses(room = null) {
    const cards = document.querySelectorAll('.card');

    if (gameState.gameMode === 'offline') {
        // В оффлайн режиме все карточки активны (hoverable + wobble)
        cards.forEach(card => {
            if (!card.classList.contains('flipped')) {
                card.classList.add('hoverable', 'wobble');
                card.classList.remove('locked');
            }
        });
    } else if (gameState.gameMode === 'online' && room) {
        // В онлайн режиме проверяем чей ход
        const isMyTurn = (room.currentPlayer === 1 && gameState.playerRole === 'player1') ||
                       (room.currentPlayer === 2 && gameState.playerRole === 'player2');

        cards.forEach(card => {
            if (!card.classList.contains('flipped')) {
                if (isMyTurn) {
                    card.classList.add('hoverable', 'wobble');
                    card.classList.remove('locked');
                } else {
                    card.classList.remove('hoverable', 'wobble');
                    card.classList.add('locked');
                }
            }
        });
    }
}

// Обработчики событий
function attachEventListeners() {
    // Выбор режима
    elements.offlineBtn.addEventListener('click', startOfflineGame);
    elements.onlineBtn.addEventListener('click', showOnlineOptions);
    elements.backToModeBtn.addEventListener('click', backToModeSelection);

    // Онлайн режим
    elements.createRoomBtn.addEventListener('click', createRoom);
    elements.joinRoomBtn.addEventListener('click', joinRoom);
    elements.leaveRoomBtn.addEventListener('click', leaveRoom);
    elements.leaveGameBtn.addEventListener('click', leaveGame);
}

// ========== РЕЖИМЫ ИГРЫ ==========

// Оффлайн режим
function startOfflineGame() {
    gameState.gameMode = 'offline';
    gameState.offlineState.gamePhase = 'placing_bombs';
    gameState.offlineState.bombs = [];
    gameState.offlineState.selectedCells = [];
    gameState.offlineState.currentPlayer = 1;

    showScreen('game');
    updatePlayersDisplay();
    updateStatus('💣 Заминируй 2 клетки');
}

// Показать онлайн опции
function showOnlineOptions() {
    elements.modeSelection.style.display = 'none';
    elements.onlineOptions.classList.add('expanded');
}

// Вернуться к выбору режима
function backToModeSelection() {
    elements.onlineOptions.classList.remove('expanded');
    setTimeout(() => {
        elements.modeSelection.style.display = 'flex';
    }, 400);
}

// ========== FIREBASE ФУНКЦИИ ==========

// Создание комнаты
async function createRoom() {
    const nickname = elements.nicknameInput.value.trim() || 'Гость';
    const roomCode = generateRoomCode();

    gameState.gameMode = 'online';
    gameState.playerName = nickname;
    gameState.roomCode = roomCode;
    gameState.playerRole = 'player1';

    // Создаем комнату в Firebase
    const roomData = {
        player1: { name: nickname, connected: true },
        player2: null,
        gamePhase: 'waiting',
        bombs: [],
        selectedCells: [],
        flippedCards: [],
        flippedPreview: [],
        currentPlayer: 1,
        scores: { player1: 0, player2: 0 },
        showBombMessage: false,
        roundEndTriggered: false,
        roundWinner: null
    };

    gameState.roomRef = database.ref('rooms/' + roomCode);
    await gameState.roomRef.set(roomData);

    // Устанавливаем presence - удаляем player1 при отключении
    gameState.roomRef.child('player1/connected').onDisconnect().set(false);

    // Слушаем изменения комнаты
    listenToRoom();

    // Инициализируем lastGamePhase
    gameState.lastGamePhase = 'waiting';

    showScreen('waiting');
    elements.displayRoomCode.textContent = roomCode;
}

// Присоединение к комнате
async function joinRoom() {
    const nickname = elements.nicknameInput.value.trim() || 'Гость';
    const roomCode = elements.roomCodeInput.value.trim();

    if (roomCode.length !== 4 || !/^\d{4}$/.test(roomCode)) {
        alert('Введите корректный код комнаты (4 цифры)');
        return;
    }

    try {
        gameState.roomRef = database.ref('rooms/' + roomCode);

        // Используем transaction для защиты от race condition
        const result = await gameState.roomRef.child('player2').transaction((current) => {
            // Проверяем можно ли присоединиться (только если места нет вообще)
            if (current === null) {
                // Место свободно
                return { name: nickname, connected: true };
            }
            // Место занято - отменяем транзакцию
            return undefined;
        });

        if (!result.committed) {
            alert('Комната уже заполнена');
            gameState.roomRef = null;
            return;
        }

        gameState.gameMode = 'online';
        gameState.playerName = nickname;
        gameState.roomCode = roomCode;
        gameState.playerRole = 'player2';

        // Обновляем фазу игры
        await gameState.roomRef.child('gamePhase').set('placing_bombs');

        // Устанавливаем presence
        gameState.roomRef.child('player2/connected').onDisconnect().set(false);

        // Слушаем изменения комнаты
        listenToRoom();
    } catch (error) {
        console.error('Ошибка при подключении к комнате:', error);
        alert('Ошибка подключения. Попробуйте еще раз.');
        gameState.roomRef = null;
    }
}

// Слушаем изменения в комнате
function listenToRoom() {
    gameState.roomRef.on('value', (snapshot) => {
        const room = snapshot.val();

        if (!room) {
            // Комната удалена - выходим
            alert('Комната закрыта');
            leaveRoom();
            return;
        }

        // Проверяем статус подключения противника
        const opponentDisconnected = 
            (gameState.playerRole === 'player1' && room.player2 && !room.player2.connected) ||
            (gameState.playerRole === 'player2' && room.player1 && !room.player1.connected);

        if (opponentDisconnected) {
            // Противник отключился - показываем победу
            handleOpponentDisconnect(room);
        } else {
            // Обновляем UI на основе состояния комнаты
            updateGameFromRoom(room);
        }
    });
}

// Обработка отключения противника
function handleOpponentDisconnect(room) {
    // Обрабатываем только один раз
    if (gameState.opponentDisconnectHandled) return;
    gameState.opponentDisconnectHandled = true;
    
    // Блокируем игру
    gameState.isTransitioning = true;
    
    // Определяем имя победителя
    const winnerName = gameState.playerRole === 'player1' 
        ? room.player1?.name || 'Игрок 1'
        : room.player2?.name || 'Игрок 2';
    
    // Показываем сообщение об отключении
    updateStatus('⚠️ Противник отключился');
    
    // Через 2 секунды показываем победителя
    const timeoutId = setTimeout(() => {
        updateStatus(`🏆 Победитель: ${winnerName}`);
        
        // Через 3 секунды возвращаемся в лобби
        const timeoutId2 = setTimeout(() => {
            leaveRoom();
        }, 3000);
        gameState.activeTimeouts.push(timeoutId2);
    }, 2000);
    gameState.activeTimeouts.push(timeoutId);
}

// Обновление игры из Firebase
function updateGameFromRoom(room) {
    // Если второй игрок присоединился - начинаем игру (для обоих игроков)
    if (room.player2 && room.gamePhase !== 'waiting' && gameState.currentScreen !== 'game') {
        showScreen('game');
        // Инициализируем lastGamePhase для корректной синхронизации
        gameState.lastGamePhase = room.gamePhase;
        // Устанавливаем правильную тему при входе
        const expectedTheme = (room.gamePhase === 'placing_bombs' || room.gamePhase === 'waiting') ? 'light' : 'dark';
        setTheme(expectedTheme);
    }

    // Обновляем UI
    if (gameState.currentScreen === 'game') {
        // Обновляем дисплей игроков (Я слева, противник справа)
        updatePlayersDisplay(room);

        // Обрабатываем сброс доски
        if (room.gamePhase === 'resetting') {
            resetBoardVisual();
            return; // Не обновляем остальное во время сброса
        }

        // Показываем "Бомба!" если кто-то попал на бомбу
        if (room.showBombMessage && room.gamePhase === 'guessing') {
            updateStatus('💥 Бомба!');
        }

        // Обрабатываем завершение раунда (только один раз)
        if (room.roundEndTriggered && room.gamePhase === 'guessing' && !gameState.roundEndProcessed) {
            gameState.roundEndProcessed = true;
            gameState.isTransitioning = true;
            const bombs = room.bombs || [];
            const won = room.roundWinner;
            const timeoutId = setTimeout(() => endRoundOnline(won, bombs), TIMINGS.END_ROUND_INITIAL);
            gameState.activeTimeouts.push(timeoutId);
        }

        // Отслеживаем смену фазы для волновой анимации
        const phaseChanged = gameState.lastGamePhase && gameState.lastGamePhase !== room.gamePhase;
        
        if (phaseChanged) {
            // Запускаем анимацию только если не в процессе другой анимации
            if (!gameState.isTransitioningTheme) {
                // placing_bombs → guessing: light → dark
                if (gameState.lastGamePhase === 'placing_bombs' && room.gamePhase === 'guessing') {
                    gameState.isTransitioning = true;
                    gameState.isTransitioningTheme = true;
                    transitionTheme('light', 'dark');
                    const timeoutId = setTimeout(() => {
                        gameState.isTransitioning = false;
                        gameState.isTransitioningTheme = false;
                    }, TIMINGS.CLICK_UNBLOCK);
                    gameState.activeTimeouts.push(timeoutId);
                }
                // resetting → placing_bombs: dark → light
                // ИЛИ round_end → placing_bombs (если resetting пропущен)
                else if ((gameState.lastGamePhase === 'resetting' || gameState.lastGamePhase === 'round_end') 
                         && room.gamePhase === 'placing_bombs') {
                    gameState.isTransitioning = true;
                    gameState.isTransitioningTheme = true;
                    transitionTheme('dark', 'light');
                    const timeoutId = setTimeout(() => {
                        gameState.isTransitioning = false;
                        gameState.isTransitioningTheme = false;
                    }, TIMINGS.CLICK_UNBLOCK);
                    gameState.activeTimeouts.push(timeoutId);
                }
                // Любая другая смена - сбрасываем блокировку
                else {
                    gameState.isTransitioning = false;
                }
            }
            
            // ВАЖНО: обновляем lastGamePhase ВСЕГДА при смене (вне зависимости от isTransitioningTheme)
            gameState.lastGamePhase = room.gamePhase;
        } else if (!gameState.lastGamePhase) {
            // Первая инициализация
            gameState.lastGamePhase = room.gamePhase;
        }

        // Обновляем статус
        updateStatusFromPhase(room);

        // Синхронизируем превью бомб (только если Я размещаю - для напоминания что выбрал)
        const isMyTurn = (room.currentPlayer === 1 && gameState.playerRole === 'player1') ||
                        (room.currentPlayer === 2 && gameState.playerRole === 'player2');
        if (isMyTurn && room.gamePhase === 'placing_bombs') {
            syncFlippedPreview(room.flippedPreview || []);
        }

        // Синхронизируем перевороты карточек (только в фазах guessing и round_end)
        if (room.gamePhase === 'guessing' || room.gamePhase === 'round_end') {
            syncFlippedCards(room.flippedCards || []);
        }

        // Обновляем классы карточек (блокировка/разблокировка)
        updateCardClasses(room);
    }
}

// Обновление дисплея игроков (Я слева, противник справа)
function updatePlayersDisplay(room = null) {
    if (gameState.gameMode === 'offline') {
        const state = gameState.offlineState;
        const currentPlayer = state.currentPlayer;
        
        // Игроки остаются на своих местах
        elements.leftPlayerName.textContent = 'Игрок 1';
        elements.rightPlayerName.textContent = 'Игрок 2';
        elements.leftPlayerScore.textContent = state.scores.player1;
        elements.rightPlayerScore.textContent = state.scores.player2;
        
        // Рамка перемещается в зависимости от того, чей ход
        const isPlaying = state.gamePhase === 'placing_bombs' || state.gamePhase === 'guessing';
        if (isPlaying) {
            // Показываем рамку у того, кто ходит
            elements.leftPlayerInfo.classList.toggle('active', currentPlayer === 1);
            elements.rightPlayerInfo.classList.toggle('active', currentPlayer === 2);
        } else {
            // Убираем обе рамки в конце раунда
            elements.leftPlayerInfo.classList.remove('active');
            elements.rightPlayerInfo.classList.remove('active');
        }
    } else if (gameState.gameMode === 'online' && room) {
        // Я слева, противник справа
        if (gameState.playerRole === 'player1') {
            elements.leftPlayerName.textContent = room.player1?.name || 'Вы';
            elements.rightPlayerName.textContent = room.player2?.name || 'Противник';
            elements.leftPlayerScore.textContent = room.scores.player1;
            elements.rightPlayerScore.textContent = room.scores.player2;
        } else {
            elements.leftPlayerName.textContent = room.player2?.name || 'Вы';
            elements.rightPlayerName.textContent = room.player1?.name || 'Противник';
            elements.leftPlayerScore.textContent = room.scores.player2;
            elements.rightPlayerScore.textContent = room.scores.player1;
        }
        
        // Индикатор чей ход
        const isMyTurn = (room.currentPlayer === 1 && gameState.playerRole === 'player1') ||
                        (room.currentPlayer === 2 && gameState.playerRole === 'player2');
        elements.leftPlayerInfo.classList.toggle('active', isMyTurn);
        elements.rightPlayerInfo.classList.toggle('active', !isMyTurn);
    }
}

// Обновление статуса с эмодзи
function updateStatusFromPhase(room) {
    const isMyTurn = (room.currentPlayer === 1 && gameState.playerRole === 'player1') ||
                     (room.currentPlayer === 2 && gameState.playerRole === 'player2');

    if (room.gamePhase === 'waiting') {
        updateStatus('⏳ Ожидание игрока...');
    } else if (room.gamePhase === 'placing_bombs') {
        if (isMyTurn) {
            updateStatus('💣 Заминируй 2 клетки');
        } else {
            updateStatus('⏳ Противник минирует поле...');
        }
    } else if (room.gamePhase === 'guessing') {
        if (isMyTurn) {
            updateStatus('🎯 Найди 3 безопасных!');
        } else {
            updateStatus('👀 Противник делает ход...');
        }
    } else if (room.gamePhase === 'round_end') {
        // Показываем разные сообщения для победителя и проигравшего
        const iWon = (room.winner && isMyTurn) || (!room.winner && !isMyTurn);
        updateStatus(iWon ? '🎉 Победа!' : '💀 Поражение!');
    }
}

// Синхронизация превью бомб для второго игрока
function syncFlippedPreview(flippedPreview) {
    // Отслеживаем уже показанные превью чтобы не дублировать
    if (!gameState.shownPreviews) gameState.shownPreviews = new Set();
    
    flippedPreview.forEach(index => {
        if (!gameState.shownPreviews.has(index)) {
            const card = document.querySelector(`[data-index="${index}"]`);
            if (card && !card.classList.contains('animating')) {
                flipBombPreview(index);
                gameState.shownPreviews.add(index);
            }
        }
    });
    
    // Очищаем если preview пустой (новый раунд)
    if (flippedPreview.length === 0) {
        gameState.shownPreviews.clear();
    }
}

// Синхронизация перевернутых карточек
function syncFlippedCards(flippedCards) {
    flippedCards.forEach(cardData => {
        const card = document.querySelector(`[data-index="${cardData.index}"]`);
        // Проверяем что карта существует и еще не перевернута и не в процессе анимации
        if (card && !card.classList.contains('flipped') && !card.classList.contains('animating')) {
            flipCardVisual(cardData.index, cardData.isBomb);
        }
    });
}

// ========== ИГРОВАЯ ЛОГИКА ==========

// Обработка клика по карточке
async function handleCardClick(index) {
    if (gameState.gameMode === 'offline') {
        handleOfflineClick(index);
    } else if (gameState.gameMode === 'online') {
        handleOnlineClick(index);
    }
}

// Оффлайн клик
function handleOfflineClick(index) {
    const card = document.querySelector(`[data-index="${index}"]`);
    const state = gameState.offlineState;

    // Блокируем клики во время переходов
    if (gameState.isTransitioning) return;
    if (card.classList.contains('flipped') || card.classList.contains('animating')) return;

    if (state.gamePhase === 'placing_bombs') {
        const bombs = state.bombs;

        if (bombs.includes(index)) {
            // Отмена выбора бомбы
            state.bombs = bombs.filter(b => b !== index);
            flipBombPreview(index);
        } else if (bombs.length < 2) {
            // Выбор бомбы
            state.bombs.push(index);
            flipBombPreview(index);

            if (state.bombs.length === 2) {
                // Блокируем клики до конца перехода
                gameState.isTransitioning = true;

                // Переход к фазе угадывания с волновым эффектом
                const timeoutId1 = setTimeout(() => {
                    // ВАЖНО: переключаем игрока (кто ставил бомбы, тот НЕ угадывает)
                    state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
                    state.gamePhase = 'guessing';
                    transitionTheme('light', 'dark');
                    const timeoutId2 = setTimeout(() => {
                        updatePlayersDisplay();
                        updateStatus('🎯 Найди 3 безопасных!');
                        const timeoutId3 = setTimeout(() => {
                            gameState.isTransitioning = false;
                        }, TIMINGS.CLICK_UNBLOCK);
                        gameState.activeTimeouts.push(timeoutId3);
                    }, 400);
                    gameState.activeTimeouts.push(timeoutId2);
                }, TIMINGS.PLACE_TO_GUESS_DELAY);
                gameState.activeTimeouts.push(timeoutId1);
            }
        }
    } else if (state.gamePhase === 'guessing') {
        const isBomb = state.bombs.includes(index);
        flipCardVisual(index, isBomb);

        if (isBomb) {
            // Попал на бомбу - показываем "Бомба!" сразу
            updateStatus('💥 Бомба!');
            gameState.isTransitioning = true;
            const timeoutId = setTimeout(() => endRoundOffline(false), TIMINGS.END_ROUND_INITIAL);
            gameState.activeTimeouts.push(timeoutId);
        } else {
            state.selectedCells.push(index);

            if (state.selectedCells.length === 3) {
                // Выбрал 3 безопасные - победа
                gameState.isTransitioning = true;
                const timeoutId = setTimeout(() => endRoundOffline(true), TIMINGS.END_ROUND_INITIAL);
                gameState.activeTimeouts.push(timeoutId);
            }
        }
    }
}

// Онлайн клик
async function handleOnlineClick(index) {
    const card = document.querySelector(`[data-index="${index}"]`);

    // Блокируем клики во время переходов
    if (gameState.isTransitioning) return;

    const snapshot = await gameState.roomRef.once('value');
    const room = snapshot.val();

    if (!room || card.classList.contains('flipped') || card.classList.contains('animating')) return;

    const isMyTurn = (room.currentPlayer === 1 && gameState.playerRole === 'player1') ||
                     (room.currentPlayer === 2 && gameState.playerRole === 'player2');

    if (!isMyTurn) return;

    if (room.gamePhase === 'placing_bombs') {
        const bombs = room.bombs || [];
        const flippedPreview = room.flippedPreview || [];

        if (bombs.includes(index)) {
            // Отмена выбора бомбы
            const newBombs = bombs.filter(b => b !== index);
            const newPreview = flippedPreview.filter(p => p !== index);
            await gameState.roomRef.update({
                bombs: newBombs,
                flippedPreview: newPreview
            });
            flipBombPreview(index);
        } else if (bombs.length < 2) {
            // Выбор бомбы - добавляем в preview для синхронизации
            const newBombs = [...bombs, index];
            const newPreview = [...flippedPreview, index];
            await gameState.roomRef.update({
                bombs: newBombs,
                flippedPreview: newPreview
            });
            flipBombPreview(index);

            if (newBombs.length === 2) {
                // Переход к фазе угадывания (волна запустится автоматически)
                const timeoutId = setTimeout(async () => {
                    try {
                        const nextPlayer = room.currentPlayer === 1 ? 2 : 1;
                        await gameState.roomRef.update({
                            gamePhase: 'guessing',
                            currentPlayer: nextPlayer,
                            flippedCards: [],
                            flippedPreview: []
                        });
                    } catch (error) {
                        console.error('Ошибка смены фазы:', error);
                    }
                }, TIMINGS.PLACE_TO_GUESS_DELAY);
                gameState.activeTimeouts.push(timeoutId);
            }
        }
    } else if (room.gamePhase === 'guessing') {
        const bombs = room.bombs || [];
        const selectedCells = room.selectedCells || [];
        const flippedCards = room.flippedCards || [];

        const isBomb = bombs.includes(index);

        // Используем transaction для избежания race conditions
        const flippedCardsRef = gameState.roomRef.child('flippedCards');
        await flippedCardsRef.transaction((current) => {
            if (!current) current = [];
            // Проверяем что эта карта еще не перевернута
            if (current.find(c => c.index === index)) {
                return; // Abort transaction
            }
            current.push({ index, isBomb });
            return current;
        });

        if (isBomb) {
            // Попал на бомбу - показываем "Бомба!" сразу обоим игрокам
            gameState.isTransitioning = true;
            await gameState.roomRef.update({
                showBombMessage: true,
                roundEndTriggered: true, // Флаг что раунд завершается
                roundWinner: false
            });
        } else {
            const newSelectedCells = [...selectedCells, index];
            await gameState.roomRef.child('selectedCells').set(newSelectedCells);

            if (newSelectedCells.length === 3) {
                // Выбрал 3 безопасные - победа
                gameState.isTransitioning = true;
                await gameState.roomRef.update({
                    roundEndTriggered: true, // Флаг что раунд завершается
                    roundWinner: true
                });
            }
        }
    }
}

// Превью бомбы при установке
function flipBombPreview(index) {
    const card = document.querySelector(`[data-index="${index}"]`);
    if (!card) return;
    const back = card.querySelector('.card-back');

    card.classList.add('animating');

    // Устанавливаем содержимое сразу (оно скрыто через opacity: 0)
    back.classList.add('bomb');
    back.textContent = '💣';

    // Переворачиваем карточку на следующем кадре
    requestAnimationFrame(() => {
        card.classList.add('flipped');
    });

    // Переворачиваем обратно через 1000мс
    const timeoutId1 = setTimeout(() => {
        card.classList.remove('flipped');

        // Очищаем содержимое после полного возврата
        const timeoutId2 = setTimeout(() => {
            back.className = 'card-face card-back';
            back.textContent = '';
            card.classList.remove('animating');
        }, TIMINGS.CARD_FLIP);
        gameState.activeTimeouts.push(timeoutId2);
    }, TIMINGS.BOMB_PREVIEW);
    gameState.activeTimeouts.push(timeoutId1);
}

// Визуальный переворот карточки
function flipCardVisual(index, isBomb) {
    const card = document.querySelector(`[data-index="${index}"]`);
    if (!card) return;
    const back = card.querySelector('.card-back');

    if (card.classList.contains('flipped') || card.classList.contains('animating')) return;

    card.classList.add('animating');

    // Устанавливаем содержимое сразу (оно скрыто через opacity: 0)
    if (isBomb) {
        back.classList.add('bomb');
        back.textContent = '💣';
    } else {
        back.classList.add('safe');
        back.textContent = '✅';
    }

    // Переворачиваем на следующем кадре
    requestAnimationFrame(() => {
        card.classList.add('flipped');
    });

    const timeoutId = setTimeout(() => {
        card.classList.remove('animating');
    }, TIMINGS.CARD_FLIP);
    gameState.activeTimeouts.push(timeoutId);
}

// Завершение раунда (оффлайн)
function endRoundOffline(won) {
    const state = gameState.offlineState;

    const timeoutId1 = setTimeout(() => {
        // Показываем все бомбы
        state.bombs.forEach(bombIndex => {
            const card = document.querySelector(`[data-index="${bombIndex}"]`);
            if (!card.classList.contains('flipped')) {
                flipCardVisual(bombIndex, true);
            }
        });

        // Ждем пока все карточки перевернутся (600мс анимация + буфер)
        const timeoutId2 = setTimeout(() => {
            // Обновляем счет
            // currentPlayer - тот кто УГАДЫВАЕТ (как в онлайн режиме)
            if (won) {
                // Угадывающий выиграл (выбрал 3 безопасные)
                if (state.currentPlayer === 1) state.scores.player1++;
                else state.scores.player2++;
            } else {
                // Угадывающий проиграл (попал на бомбу) - очко закладывавшему
                if (state.currentPlayer === 1) state.scores.player2++;
                else state.scores.player1++;
            }

            // Устанавливаем фазу "конец раунда" чтобы убрать рамку
            state.gamePhase = 'round_end';
            updatePlayersDisplay();
            // Показываем результат с точки зрения текущего игрока
            updateStatus(won ? '🎉 Победа!' : '💀 Поражение!');

            // Новый раунд через 2.5 секунды
            const timeoutId3 = setTimeout(() => {
                // Сначала переворачиваем карточки обратно
                resetBoardVisual();

                // Ждем завершения переворота и затем меняем тему
                const timeoutId4 = setTimeout(() => {
                    // НЕ переключаем игрока! Кто угадывал (currentPlayer), тот теперь закладывает
                    state.gamePhase = 'placing_bombs';
                    state.bombs = [];
                    state.selectedCells = [];

                    // Возвращаемся к light теме
                    transitionTheme('dark', 'light');

                    const timeoutId5 = setTimeout(() => {
                        updatePlayersDisplay();
                        updateStatus('💣 Заминируй 2 клетки');
                        gameState.isTransitioning = false;
                    }, TIMINGS.THEME_TRANSITION + 100);
                    gameState.activeTimeouts.push(timeoutId5);
                }, TIMINGS.CARD_FLIP);
                gameState.activeTimeouts.push(timeoutId4);
            }, TIMINGS.ROUND_END_DELAY);
            gameState.activeTimeouts.push(timeoutId3);
        }, 700);
        gameState.activeTimeouts.push(timeoutId2);
    }, TIMINGS.END_ROUND_INITIAL);
    gameState.activeTimeouts.push(timeoutId1);
}

// Завершение раунда (онлайн)
async function endRoundOnline(won, bombs) {
    const timeoutId1 = setTimeout(async () => {
        try {
            const snapshot = await gameState.roomRef.once('value');
            const room = snapshot.val();
            if (!room) return;

            // Показываем все бомбы
            const flippedCards = room.flippedCards || [];
            const updatedFlippedCards = [...flippedCards];
            bombs.forEach(bombIndex => {
                if (!updatedFlippedCards.find(c => c.index === bombIndex)) {
                    updatedFlippedCards.push({ index: bombIndex, isBomb: true });
                }
            });
            
            await gameState.roomRef.child('flippedCards').set(updatedFlippedCards);

            const timeoutId2 = setTimeout(async () => {
                try {
                    // Обновляем счет
                    const scores = { ...room.scores };
                    if (won) {
                        if (room.currentPlayer === 1) scores.player1++;
                        else scores.player2++;
                    } else {
                        if (room.currentPlayer === 1) scores.player2++;
                        else scores.player1++;
                    }

                    await gameState.roomRef.update({
                        gamePhase: 'round_end',
                        winner: won,
                        scores: scores,
                        showBombMessage: false // Сбрасываем флаг
                    });

                    // Новый раунд
                    const timeoutId3 = setTimeout(async () => {
                        try {
                            await gameState.roomRef.update({
                                gamePhase: 'resetting'
                            });
                            
                            const timeoutId4 = setTimeout(async () => {
                                try {
                                    await gameState.roomRef.update({
                                        gamePhase: 'placing_bombs',
                                        bombs: [],
                                        selectedCells: [],
                                        flippedCards: [],
                                        flippedPreview: [],
                                        roundEndTriggered: false,
                                        roundWinner: null
                                    });
                                    // Сбрасываем флаг для следующего раунда
                                    gameState.roundEndProcessed = false;
                                } catch (error) {
                                    console.error('Ошибка сброса:', error);
                                }
                            }, TIMINGS.CARD_FLIP);
                            gameState.activeTimeouts.push(timeoutId4);
                        } catch (error) {
                            console.error('Ошибка resetting:', error);
                        }
                    }, TIMINGS.ROUND_END_DELAY);
                    gameState.activeTimeouts.push(timeoutId3);
                } catch (error) {
                    console.error('Ошибка обновления счета:', error);
                }
            }, 700);
            gameState.activeTimeouts.push(timeoutId2);
        } catch (error) {
            console.error('Ошибка показа бомб:', error);
        }
    }, TIMINGS.END_ROUND_INITIAL);
    gameState.activeTimeouts.push(timeoutId1);
}

// Сброс визуального состояния поля
function resetBoardVisual() {
    const cards = document.querySelectorAll('.card');
    
    cards.forEach(card => {
        // Убираем flipped - карточка начнет переворачиваться обратно
        card.classList.remove('flipped', 'selected', 'locked');
        card.classList.add('hoverable', 'wobble');
    });
    
    // Один общий таймер для всех карт вместо 9 отдельных
    const timeoutId = setTimeout(() => {
        cards.forEach(card => {
            card.classList.remove('animating');
            const back = card.querySelector('.card-back');
            if (back) {
                back.className = 'card-face card-back';
                back.textContent = '';
            }
        });
    }, TIMINGS.CARD_FLIP);
    
    gameState.activeTimeouts.push(timeoutId);
    
    // Очищаем отслеживание превью для нового раунда
    if (gameState.shownPreviews) {
        gameState.shownPreviews.clear();
    }
}

// Выход из комнаты (онлайн)
async function leaveRoom() {
    // Очищаем все активные таймеры
    gameState.activeTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    gameState.activeTimeouts = [];

    if (gameState.roomRef) {
        try {
            // Отключаем listener
            gameState.roomRef.off();
            
            // ВАЖНО: Отменяем onDisconnect хуки перед выходом
            if (gameState.playerRole === 'player1') {
                await gameState.roomRef.child('player1/connected').onDisconnect().cancel();
                await gameState.roomRef.child('player1/connected').set(false);
            } else if (gameState.playerRole === 'player2') {
                await gameState.roomRef.child('player2/connected').onDisconnect().cancel();
                await gameState.roomRef.child('player2/connected').set(false);
            }
        } catch (error) {
            console.error('Ошибка при выходе из комнаты:', error);
        }
        
        gameState.roomRef = null;
    }

    gameState.roomCode = null;
    gameState.playerRole = null;
    gameState.gameMode = null;
    gameState.lastGamePhase = null;
    gameState.isTransitioning = false;
    gameState.isTransitioningTheme = false;
    gameState.opponentDisconnectHandled = false;
    gameState.roundEndProcessed = false;
    if (gameState.shownPreviews) {
        gameState.shownPreviews.clear();
    }

    resetBoardVisual();
    resetLobby();
    showScreen('lobby');
    setTheme('light');
}

// Выход из игры
function leaveGame() {
    // Очищаем все активные таймеры для обоих режимов
    gameState.activeTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    gameState.activeTimeouts = [];
    
    if (gameState.gameMode === 'offline') {
        gameState.offlineState = {
            gamePhase: 'placing_bombs',
            bombs: [],
            selectedCells: [],
            currentPlayer: 1,
            scores: { player1: 0, player2: 0 }
        };
        gameState.gameMode = null;
        gameState.isTransitioning = false;
        gameState.isTransitioningTheme = false;
        gameState.opponentDisconnectHandled = false;
        gameState.roundEndProcessed = false;
        resetBoardVisual();
        resetLobby();
        showScreen('lobby');
        setTheme('light');
    } else if (gameState.gameMode === 'online') {
        leaveRoom();
    }
}

// Сброс лобби
function resetLobby() {
    elements.modeSelection.style.display = 'flex';
    elements.onlineOptions.classList.remove('expanded');
}


// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
    gameState.currentScreen = screenName;
}

function generateRoomCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

function updateStatus(text) {
    elements.gameStatus.textContent = text;
}

// Запуск при загрузке страницы
document.addEventListener('DOMContentLoaded', init);
