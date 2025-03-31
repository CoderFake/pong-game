/**
 * File: static/js/spa-router.js
 * Mô tả: Xử lý điều hướng SPA đơn giản
 */

function initSpaRouter() {
    // Kiểm tra URL hiện tại và hiển thị trang phù hợp
    function checkCurrentUrl() {
        const url = window.location.href;
        const hash = window.location.hash.substring(1);

        if (hash) {
            // Kiểm tra các định dạng route đặc biệt
            if (hash.startsWith('game/')) {
                const gameId = hash.split('/')[1];
                if (gameId) {
                    joinGameById(gameId);
                    return;
                }
            } else if (hash.startsWith('tournament/')) {
                const tournamentId = hash.split('/')[1];
                if (tournamentId) {
                    viewTournamentDetail(tournamentId);
                    return;
                }
            } else if (hash.startsWith('profile/')) {
                const username = hash.split('/')[1];
                if (username) {
                    viewUserProfile(username);
                    return;
                }
            } else if (hash.startsWith('chat/')) {
                const username = hash.split('/')[1];
                if (username) {
                    openChatWithUser(username);
                    return;
                }
            } else {
                // Kiểm tra các trang thông thường
                const page = hash;
                if (["home", "games", "tournament", "profile", "friends", "chat"].includes(page)) {
                    showPage(page);
                    return;
                }
            }
        }

        // Mặc định hiển thị trang chủ
        showPage('home');
    }

    // Xử lý sự kiện khi URL thay đổi
    window.addEventListener('hashchange', checkCurrentUrl);

    // Thêm sự kiện cho tất cả các liên kết điều hướng
    document.querySelectorAll('[data-page]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.getAttribute('data-page');
            window.location.hash = page;
        });
    });

    // Thiết lập điều hướng ban đầu
    checkCurrentUrl();

    // Xử lý các sự kiện điều hướng bổ sung
    document.getElementById('profile-dropdown')?.addEventListener('click', function(e) {
        e.preventDefault();
        window.location.hash = 'profile';
    });

    return {
        navigate: function(page) {
            window.location.hash = page;
        },

        navigateToGame: function(gameId) {
            window.location.hash = `game/${gameId}`;
        },

        navigateToTournament: function(tournamentId) {
            window.location.hash = `tournament/${tournamentId}`;
        },

        navigateToProfile: function(username) {
            window.location.hash = `profile/${username}`;
        },

        navigateToChat: function(username) {
            window.location.hash = `chat/${username}`;
        }
    };
}

// Tham gia game theo ID
function joinGameById(gameId) {
    // Kiểm tra đăng nhập
    if (!userId) {
        alert('Vui lòng đăng nhập để tham gia game');
        showPage('login-form');
        return;
    }

    // Kiểm tra game tồn tại và tham gia
    $.ajax({
        url: `/api/game/games/${gameId}/`,
        method: 'GET',
        success: function(response) {
            // Kiểm tra nếu game đang chờ và chưa đủ người chơi
            if (response.status === 'waiting' && response.players.length < 2) {
                // Kiểm tra xem người dùng đã tham gia chưa
                let isPlayerInGame = false;
                let availableSide = 'right'; // Mặc định bên phải

                for (const player of response.players) {
                    if (player.user.id === userId) {
                        isPlayerInGame = true;
                        break;
                    }

                    // Chọn phía còn trống
                    if (player.side === 'right') {
                        availableSide = 'left';
                    } else {
                        availableSide = 'right';
                    }
                }

                if (isPlayerInGame) {
                    // Người dùng đã tham gia, hiển thị màn hình chờ
                    showWaitingScreen(response);
                } else {
                    // Tham gia game
                    joinGame(gameId, availableSide);
                }
            } else if (response.status === 'playing') {
                // Kiểm tra xem người dùng có phải là người chơi không
                let isPlayerInGame = false;

                for (const player of response.players) {
                    if (player.user.id === userId) {
                        isPlayerInGame = true;
                        break;
                    }
                }

                if (isPlayerInGame) {
                    // Người dùng là người chơi, bắt đầu game
                    startMultiplayerGame(gameId);
                } else {
                    // Người dùng không phải người chơi, hiển thị thông báo
                    alert('Game này đã bắt đầu và bạn không phải là người chơi.');
                    showPage('games');
                }
            } else {
                // Game đã kết thúc hoặc đã đủ người
                alert('Game này không khả dụng để tham gia.');
                showPage('games');
            }
        },
        error: function(error) {
            console.error('Lỗi khi kiểm tra game:', error);
            alert('Không tìm thấy game hoặc đã xảy ra lỗi.');
            showPage('games');
        }
    });
}

// Hiển thị chi tiết giải đấu
function viewTournamentDetail(tournamentId) {
    if (!userId) {
        alert('Vui lòng đăng nhập để xem giải đấu');
        showPage('login-form');
        return;
    }

    // Tải thông tin giải đấu
    $.ajax({
        url: `/api/game/tournaments/${tournamentId}/`,
        method: 'GET',
        success: function(tournament) {
            renderTournamentDetail(tournament);
            showPage('tournament-detail');
        },
        error: function(error) {
            console.error('Lỗi khi tải thông tin giải đấu:', error);
            alert('Không tìm thấy giải đấu hoặc đã xảy ra lỗi.');
            showPage('tournament');
        }
    });
}

// Xem hồ sơ người dùng
function viewUserProfile(username) {
    if (!userId) {
        alert('Vui lòng đăng nhập để xem hồ sơ người dùng');
        showPage('login-form');
        return;
    }

    // Tải thông tin người dùng
    $.ajax({
        url: `/api/users/profile/${username}/`,
        method: 'GET',
        success: function(user) {
            if (user.id === userId) {
                // Nếu là hồ sơ của chính mình
                showPage('profile');
            } else {
                // Hiển thị hồ sơ của người khác
                renderUserProfile(user);
                showPage('user-profile');
            }
        },
        error: function(error) {
            console.error('Lỗi khi tải thông tin người dùng:', error);
            alert('Không tìm thấy người dùng hoặc đã xảy ra lỗi.');
            showPage('friends');
        }
    });
}

// Mở chat với người dùng
function openChatWithUser(username) {
    if (!userId) {
        alert('Vui lòng đăng nhập để trò chuyện');
        showPage('login-form');
        return;
    }

    // Tải thông tin người dùng
    $.ajax({
        url: `/api/users/profile/${username}/`,
        method: 'GET',
        success: function(user) {
            // Mở chat với người dùng
            openChatWindow(user);
            showPage('chat');
        },
        error: function(error) {
            console.error('Lỗi khi tải thông tin người dùng:', error);
            alert('Không tìm thấy người dùng hoặc đã xảy ra lỗi.');
            showPage('chat');
        }
    });
}