/**
 * File: static/js/game-interface.js
 * Mô tả: Xử lý giao diện và tương tác người dùng cho game Pong
 */

let pongGame = null;
let gameSocket = null;

// Khởi tạo giao diện game
function initGameInterface() {
    setupEventListeners();
    loadGameModes();
}

// Thiết lập các sự kiện
function setupEventListeners() {
    // Nút tạo game mới
    $('#create-game-btn').on('click', function() {
        $('#create-game-modal').modal('show');
    });

    // Form tạo game
    $('#create-game-form').on('submit', function(e) {
        e.preventDefault();
        createNewGame();
    });

    // Nút tham gia game
    $('#join-game-btn').on('click', function() {
        loadAvailableGames();
        $('#join-game-modal').modal('show');
    });

    // Nút chơi với AI
    $('#play-ai-btn').on('click', function() {
        $('#ai-game-modal').modal('show');
    });

    // Form chơi với AI
    $('#ai-game-form').on('submit', function(e) {
        e.preventDefault();
        startAIGame();
    });

    // Nút làm mới danh sách game
    $('#refresh-games-btn').on('click', function() {
        loadAvailableGames();
    });
}

// Tải danh sách chế độ chơi
function loadGameModes() {
    // Hiển thị phần giao diện chọn chế độ
    $('#game-modes').removeClass('hidden');
    $('#game-container').addClass('hidden');
}

// Tạo game mới
function createNewGame() {
    const maxScore = parseInt($('#max-score').val());
    const enablePowerups = $('#enable-powerups').prop('checked');
    const ballSpeed = parseFloat($('#ball-speed').val());
    const paddleSize = $('#paddle-size').val();

    $.ajax({
        url: '/api/game/games/',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        data: JSON.stringify({
            max_score: maxScore,
            enable_powerups: enablePowerups,
            ball_speed: ballSpeed,
            paddle_size: paddleSize
        }),
        success: function(response) {
            $('#create-game-modal').modal('hide');

            // Chuyển tới màn hình chờ
            showWaitingScreen(response);
        },
        error: function(error) {
            console.error('Lỗi khi tạo game:', error);
            alert('Đã xảy ra lỗi khi tạo game. Vui lòng thử lại.');
        }
    });
}

// Hiển thị màn hình chờ
function showWaitingScreen(game) {
    $('#game-modes').addClass('hidden');
    $('#waiting-screen').removeClass('hidden');

    // Hiển thị thông tin game
    $('#game-id').text(game.id);
    $('#game-max-score').text(game.max_score);
    $('#game-powerups').text(game.enable_powerups ? 'Có' : 'Không');

    // Tạo game URL để chia sẻ
    const gameUrl = `${window.location.origin}/game/${game.id}/`;
    $('#game-url').val(gameUrl);

    // Nút sao chép URL
    $('#copy-url-btn').on('click', function() {
        $('#game-url').select();
        document.execCommand('copy');

        // Thay đổi nút sau khi sao chép
        $(this).text('Đã sao chép!');
        setTimeout(() => {
            $(this).text('Sao chép URL');
        }, 2000);
    });

    // Kết nối WebSocket để nhận thông báo khi có người tham gia
    connectToGameSocket(game.id);
}

// Kết nối tới WebSocket của game
function connectToGameSocket(gameId) {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/game/${gameId}/`;

    gameSocket = new WebSocket(wsUrl);

    gameSocket.onopen = function(e) {
        console.log('Kết nối WebSocket thành công');
    };

    gameSocket.onmessage = function(e) {
        const data = JSON.parse(e.data);

        if (data.type === 'player_status' && data.connected && data.user_id !== userId) {
            // Có người chơi mới tham gia, bắt đầu game
            startMultiplayerGame(gameId);
        }
    };

    gameSocket.onclose = function(e) {
        console.log('Kết nối WebSocket đã đóng');
    };

    // Kiểm tra trạng thái game định kỳ
    checkGameStatus(gameId);
}

// Kiểm tra trạng thái game định kỳ
function checkGameStatus(gameId) {
    const interval = setInterval(function() {
        $.ajax({
            url: `/api/game/games/${gameId}/`,
            method: 'GET',
            success: function(response) {
                if (response.players.length > 1) {
                    clearInterval(interval);
                    startMultiplayerGame(gameId);
                }
            },
            error: function(error) {
                console.error('Lỗi khi kiểm tra trạng thái game:', error);
                clearInterval(interval);
            }
        });
    }, 5000);
}

// Tải danh sách game có sẵn
function loadAvailableGames() {
    $.ajax({
        url: '/api/game/games/',
        method: 'GET',
        success: function(response) {
            // Lọc ra các game đang chờ người chơi
            const availableGames = response.filter(game => game.status === 'waiting');

            // Hiển thị danh sách game
            const gamesList = $('#available-games-list');
            gamesList.empty();

            if (availableGames.length > 0) {
                for (const game of availableGames) {
                    const item = $(`
                        <div class="card mb-3">
                            <div class="card-body">
                                <h5 class="card-title">Game #${game.id}</h5>
                                <p class="card-text">
                                    Điểm tối đa: ${game.max_score} | 
                                    Power-ups: ${game.enable_powerups ? 'Có' : 'Không'}
                                </p>
                                <div class="d-grid">
                                    <button class="btn btn-primary join-game" data-id="${game.id}">Tham gia</button>
                                </div>
                            </div>
                        </div>
                    `);

                    gamesList.append(item);
                }

                // Sự kiện cho nút tham gia
                $('.join-game').on('click', function() {
                    const gameId = $(this).data('id');
                    joinGame(gameId);
                });
            } else {
                gamesList.html('<p>Không có game nào đang chờ người chơi.</p>');
            }
        },
        error: function(error) {
            console.error('Lỗi khi tải danh sách game:', error);
            $('#available-games-list').html('<p>Đã xảy ra lỗi khi tải danh sách game.</p>');
        }
    });
}

// Tham gia một game
function joinGame(gameId) {
    $.ajax({
        url: `/api/game/games/${gameId}/join/`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        data: JSON.stringify({
            side: 'right'
        }),
        success: function(response) {
            $('#join-game-modal').modal('hide');

            // Bắt đầu game
            startMultiplayerGame(gameId);
        },
        error: function(error) {
            console.error('Lỗi khi tham gia game:', error);
            alert('Đã xảy ra lỗi khi tham gia game. Vui lòng thử lại.');
        }
    });
}

// Bắt đầu game với AI
function startAIGame() {
    // Lấy các tùy chọn
    const difficulty = $('#ai-difficulty').val();
    const maxScore = parseInt($('#ai-max-score').val());
    const enablePowerups = $('#ai-enable-powerups').prop('checked');

    // Ẩn các phần giao diện khác
    $('#game-modes').addClass('hidden');
    $('#waiting-screen').addClass('hidden');
    $('#ai-game-modal').modal('hide');

    // Hiển thị khu vực game
    $('#game-container').removeClass('hidden');

    // Tạo hidden input để lưu phía người chơi (luôn là bên trái trong chế độ AI)
    const sideInput = $('<input type="hidden" id="user-side" value="left">');
    $('#game-container').append(sideInput);

    // Tạo canvas cho game
    const canvas = $('<canvas id="game-canvas"></canvas>');
    $('#game-canvas-container').empty().append(canvas);

    // Khởi tạo game
    pongGame = new PongGame('game-canvas', {
        maxScore: maxScore,
        enablePowerups: enablePowerups,
        aiEnabled: true,
        aiDifficulty: difficulty
    });

    // Hiển thị thông tin game
    $('#game-info').html(`
        <div class="mb-3">
            <h4>Chế độ AI - ${getDifficultyName(difficulty)}</h4>
            <p>Điểm tối đa: ${maxScore} | Power-ups: ${enablePowerups ? 'Có' : 'Không'}</p>
        </div>
        <div class="mb-3">
            <button id="start-game-btn" class="btn btn-primary">Bắt đầu</button>
            <button id="back-to-menu-btn" class="btn btn-secondary ms-2">Trở về Menu</button>
        </div>
    `);

    // Sự kiện cho nút bắt đầu
    $('#start-game-btn').on('click', function() {
        pongGame.startGame();
        $(this).prop('disabled', true);
    });

    // Sự kiện cho nút trở về menu
    $('#back-to-menu-btn').on('click', function() {
        if (pongGame) {
            pongGame = null;
        }

        $('#game-container').addClass('hidden');
        $('#game-modes').removeClass('hidden');
    });
}

// Bắt đầu game multiplayer
function startMultiplayerGame(gameId) {
    $.ajax({
        url: `/api/game/games/${gameId}/`,
        method: 'GET',
        success: function(response) {
            // Xác định phía của người chơi
            let userSide = 'left';
            for (const player of response.players) {
                if (player.user.id === userId) {
                    userSide = player.side;
                    break;
                }
            }

            // Ẩn các phần giao diện khác
            $('#game-modes').addClass('hidden');
            $('#waiting-screen').addClass('hidden');

            // Hiển thị khu vực game
            $('#game-container').removeClass('hidden');

            // Tạo hidden input để lưu phía người chơi
            const sideInput = $('<input type="hidden" id="user-side">').val(userSide);
            $('#game-container').append(sideInput);

            // Tạo canvas cho game
            const canvas = $('<canvas id="game-canvas"></canvas>');
            $('#game-canvas-container').empty().append(canvas);

            // Tạo WebSocket URL
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${wsProtocol}//${window.location.host}/ws/game/${gameId}/`;

            // Khởi tạo game
            pongGame = new PongGame('game-canvas', {
                maxScore: response.max_score,
                enablePowerups: response.enable_powerups,
                ballSpeed: response.ball_speed,
                paddleSize: response.paddle_size === 'small' ? 75 : (response.paddle_size === 'large' ? 125 : 100),
                gameId: gameId,
                wsUrl: wsUrl
            });

            // Hiển thị thông tin game
            $('#game-info').html(`
                <div class="mb-3">
                    <h4>Game #${gameId}</h4>
                    <p>
                        Phía của bạn: ${userSide === 'left' ? 'Trái (W/S)' : 'Phải (↑/↓)'} | 
                        Điểm tối đa: ${response.max_score} | 
                        Power-ups: ${response.enable_powerups ? 'Có' : 'Không'}
                    </p>
                </div>
                <div class="mb-3">
                    <button id="ready-game-btn" class="btn btn-primary">Sẵn sàng</button>
                </div>
            `);

            // Sự kiện cho nút sẵn sàng
            $('#ready-game-btn').on('click', function() {
                if (pongGame && pongGame.ws) {
                    pongGame.ws.send(JSON.stringify({
                        type: 'game_ready'
                    }));

                    $(this).prop('disabled', true).text('Đã sẵn sàng');

                    // Cập nhật trạng thái sẵn sàng lên server
                    $.ajax({
                        url: `/api/game/games/${gameId}/ready/`,
                        method: 'POST',
                        headers: {
                            'X-CSRFToken': getCookie('csrftoken')
                        },
                        error: function(error) {
                            console.error('Lỗi khi gửi trạng thái sẵn sàng:', error);
                        }
                    });
                }
            });
        },
        error: function(error) {
            console.error('Lỗi khi tải thông tin game:', error);
            alert('Đã xảy ra lỗi khi tải thông tin game. Vui lòng thử lại.');

            // Trở về menu chính
            $('#waiting-screen').addClass('hidden');
            $('#game-modes').removeClass('hidden');
        }
    });
}

// Lấy tên độ khó của AI
function getDifficultyName(difficulty) {
    switch (difficulty) {
        case 'easy':
            return 'Dễ';
        case 'medium':
            return 'Trung bình';
        case 'hard':
            return 'Khó';
        default:
            return 'Trung bình';
    }
}

// Lấy CSRF token từ cookie
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// Khởi tạo giao diện khi trang đã tải xong
$(document).ready(function() {
    initGameInterface();
});