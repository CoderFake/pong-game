/**
 * File: static/js/tournament-manager.js
 * Mô tả: Quản lý giải đấu Pong
 */

function initTournamentManager() {
    // Tải danh sách giải đấu đang diễn ra
    loadActiveTournaments();

    // Thiết lập sự kiện
    setupTournamentEvents();
}

// Tải danh sách giải đấu đang diễn ra
function loadActiveTournaments() {
    $.ajax({
        url: '/api/game/active-tournaments/',
        method: 'GET',
        success: function(tournaments) {
            const tournamentsList = $('#active-tournaments');
            tournamentsList.empty();

            if (tournaments.length > 0) {
                const tournamentsRow = $('<div class="row"></div>');
                tournamentsList.append(tournamentsRow);

                tournaments.forEach(tournament => {
                    // Đếm số người chơi
                    const playerCount = tournament.players.length;
                    const maxPlayers = tournament.max_players;

                    // Tính phần trăm đã đầy
                    const fillPercentage = (playerCount / maxPlayers) * 100;

                    // Trạng thái giải đấu
                    let statusText = 'Đang mở đăng ký';
                    let statusClass = 'bg-success';

                    if (tournament.status === 'in_progress') {
                        statusText = 'Đang diễn ra';
                        statusClass = 'bg-primary';
                    } else if (tournament.status === 'completed') {
                        statusText = 'Đã kết thúc';
                        statusClass = 'bg-secondary';
                    }

                    const tournamentCard = $(`
                        <div class="col-md-6 col-lg-4 mb-3">
                            <div class="card">
                                <div class="card-header d-flex justify-content-between align-items-center">
                                    <h5 class="mb-0">${tournament.name}</h5>
                                    <span class="badge ${statusClass}">${statusText}</span>
                                </div>
                                <div class="card-body">
                                    <p>${tournament.description || 'Không có mô tả'}</p>
                                    <div>
                                        <small>Người chơi: ${playerCount}/${maxPlayers}</small>
                                        <div class="progress mb-3">
                                            <div class="progress-bar" role="progressbar" style="width: ${fillPercentage}%" aria-valuenow="${playerCount}" aria-valuemin="0" aria-valuemax="${maxPlayers}"></div>
                                        </div>
                                    </div>
                                    <div class="d-grid gap-2">
                                        <button class="btn btn-primary view-tournament" data-id="${tournament.id}">Xem chi tiết</button>
                                        ${tournament.status === 'registration' ? `
                                            <button class="btn btn-outline-primary join-tournament" data-id="${tournament.id}">Tham gia</button>
                                        ` : ''}
                                    </div>
                                </div>
                                <div class="card-footer text-muted">
                                    Tạo bởi: ${tournament.created_by.display_name || tournament.created_by.username}
                                </div>
                            </div>
                        </div>
                    `);

                    tournamentsRow.append(tournamentCard);
                });

                // Sự kiện cho các nút
                $('.view-tournament').on('click', function() {
                    const tournamentId = $(this).data('id');
                    window.location.hash = `tournament/${tournamentId}`;
                });

                $('.join-tournament').on('click', function() {
                    const tournamentId = $(this).data('id');
                    joinTournament(tournamentId);
                });
            } else {
                tournamentsList.html('<p class="text-center">Không có giải đấu nào đang diễn ra.</p>');
            }
        },
        error: function(error) {
            console.error('Lỗi khi tải danh sách giải đấu:', error);
            $('#active-tournaments').html('<p class="text-center text-danger">Không thể tải danh sách giải đấu.</p>');
        }
    });
}

// Tham gia giải đấu
function joinTournament(tournamentId) {
    $.ajax({
        url: `/api/game/tournaments/${tournamentId}/join/`,
        method: 'POST',
        headers: {
            'X-CSRFToken': getCookie('csrftoken')
        },
        success: function(response) {
            // Thông báo thành công
            alert('Tham gia giải đấu thành công!');

            // Hiển thị chi tiết giải đấu
            window.location.hash = `tournament/${tournamentId}`;
        },
        error: function(error) {
            console.error('Lỗi khi tham gia giải đấu:', error);

            if (error.responseJSON && error.responseJSON.error) {
                alert(error.responseJSON.error);
            } else {
                alert('Đã xảy ra lỗi khi tham gia giải đấu.');
            }
        }
    });
}

// Hiển thị chi tiết giải đấu
function renderTournamentDetail(tournament) {
    // Tạo HTML cho chi tiết giải đấu
    const detailHtml = `
        <div class="container">
            <div class="mb-3">
                <a href="#tournament" class="btn btn-outline-secondary">&larr; Quay lại danh sách giải đấu</a>
            </div>
            
            <div class="card mb-4">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h2 class="mb-0">${tournament.name}</h2>
                        <span class="badge ${getTournamentStatusClass(tournament.status)}">${getTournamentStatusText(tournament.status)}</span>
                    </div>
                    
                    <p>${tournament.description || 'Không có mô tả'}</p>
                    
                    <div class="row mb-3">
                        <div class="col-md-4">
                            <strong>Người tạo:</strong> ${tournament.created_by.display_name || tournament.created_by.username}
                        </div>
                        <div class="col-md-4">
                            <strong>Số người chơi tối đa:</strong> ${tournament.max_players}
                        </div>
                        <div class="col-md-4">
                            <strong>Điểm tối đa mỗi trận:</strong> ${tournament.max_score}
                        </div>
                    </div>
                    
                    <div class="mb-3">
                        <strong>Power-ups:</strong> ${tournament.enable_powerups ? 'Có' : 'Không'}
                    </div>
                    
                    ${tournament.created_by.id === userId && tournament.status === 'registration' ? `
                        <div class="mb-3">
                            <button class="btn btn-primary" id="start-tournament-btn" data-id="${tournament.id}">
                                Bắt đầu giải đấu
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="row">
                <div class="col-md-4">
                    <div class="card mb-4">
                        <div class="card-header">
                            <h5 class="mb-0">Người chơi (${tournament.players.length}/${tournament.max_players})</h5>
                        </div>
                        <div class="card-body">
                            <div id="tournament-players-list">
                                ${renderTournamentPlayers(tournament.players)}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-8">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0">Bảng đấu</h5>
                        </div>
                        <div class="card-body">
                            <div id="tournament-bracket">
                                ${tournament.status === 'registration' ? 
                                    '<p class="text-center">Giải đấu chưa bắt đầu</p>' : 
                                    renderTournamentBracket(tournament)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Cập nhật giao diện
    $('#tournament-detail').html(detailHtml);

    // Sự kiện bắt đầu giải đấu
    $('#start-tournament-btn').on('click', function() {
        const tournamentId = $(this).data('id');
        startTournament(tournamentId);
    });

    // Sự kiện tham gia trận đấu
    $('.join-match-btn').on('click', function() {
        const gameId = $(this).data('game-id');
        window.location.hash = `game/${gameId}`;
    });

    // Sự kiện xem hồ sơ người chơi
    $('.view-player-profile').on('click', function() {
        const username = $(this).data('username');
        window.location.hash = `profile/${username}`;
    });
}

// Hiển thị danh sách người chơi
function renderTournamentPlayers(players) {
    if (players.length === 0) {
        return '<p class="text-center">Chưa có người chơi nào tham gia.</p>';
    }

    let playersHtml = '';

    players.forEach(player => {
        const user = player.user;
        playersHtml += `
            <div class="d-flex align-items-center mb-2">
                <div class="me-2">
                    <img src="${user.avatar || '/media/avatars/default.png'}" alt="${user.display_name}" class="user-avatar" style="width: 30px; height: 30px;">
                </div>
                <div class="flex-grow-1">
                    <a href="#" class="view-player-profile" data-username="${user.username}">${user.display_name || user.username}</a>
                    ${player.eliminated ? '<span class="badge bg-danger ms-2">Đã bị loại</span>' : ''}
                </div>
            </div>
        `;
    });

    return playersHtml;
}

// Hiển thị bảng đấu
function renderTournamentBracket(tournament) {
    if (tournament.matches.length === 0) {
        return '<p class="text-center">Chưa có trận đấu nào.</p>';
    }

    // Phân nhóm các trận đấu theo vòng
    const matchesByRound = {};
    tournament.matches.forEach(match => {
        if (!matchesByRound[match.round_number]) {
            matchesByRound[match.round_number] = [];
        }
        matchesByRound[match.round_number].push(match);
    });

    // Sắp xếp các vòng theo thứ tự
    const rounds = Object.keys(matchesByRound).sort((a, b) => a - b);

    let bracketHtml = '<div class="d-flex tournament-bracket-container">';

    rounds.forEach(round => {
        const matches = matchesByRound[round].sort((a, b) => a.match_number - b.match_number);

        bracketHtml += `
            <div class="tournament-round me-3">
                <h6 class="text-center mb-3">Vòng ${round}</h6>
                <div class="d-flex flex-column">
        `;

        matches.forEach(match => {
            const player1Name = match.player1 ? (match.player1.user.display_name || match.player1.user.username) : 'TBD';
            const player2Name = match.player2 ? (match.player2.user.display_name || match.player2.user.username) : 'TBD';

            let matchStatus = '';
            let matchActions = '';

            // Kiểm tra trạng thái trận đấu
            if (match.winner) {
                // Trận đấu đã kết thúc
                matchStatus = `
                    <div class="mt-2">
                        <span class="badge bg-success">Người thắng: ${match.winner.user.display_name || match.winner.user.username}</span>
                    </div>
                `;
            } else if (match.game) {
                // Trận đấu đã được tạo
                matchStatus = `
                    <div class="mt-2">
                        <span class="badge bg-primary">Trận đấu đã sẵn sàng</span>
                    </div>
                `;

                // Kiểm tra xem người dùng có phải là người chơi không
                if (match.player1 && match.player2) {
                    if ((match.player1.user.id === userId || match.player2.user.id === userId)) {
                        matchActions = `
                            <div class="mt-2">
                                <button class="btn btn-sm btn-primary join-match-btn" data-game-id="${match.game.id}">
                                    Tham gia trận đấu
                                </button>
                            </div>
                        `;
                    }
                }
            }

            bracketHtml += `
                <div class="tournament-match mb-3">
                    <div class="d-flex justify-content-between mb-2">
                        <span>${player1Name}</span>
                        <span>${match.game && match.player1 ? match.game.players.find(p => p.user.id === match.player1.user.id)?.score || 0 : '0'}</span>
                    </div>
                    <div class="d-flex justify-content-between">
                        <span>${player2Name}</span>
                        <span>${match.game && match.player2 ? match.game.players.find(p => p.user.id === match.player2.user.id)?.score || 0 : '0'}</span>
                    </div>
                    ${matchStatus}
                    ${matchActions}
                </div>
            `;
        });

        bracketHtml += `
                </div>
            </div>
        `;
    });

    bracketHtml += '</div>';
    return bracketHtml;
}

// Lấy class CSS cho trạng thái giải đấu
function getTournamentStatusClass(status) {
    switch (status) {
        case 'registration':
            return 'bg-success';
        case 'in_progress':
            return 'bg-primary';
        case 'completed':
            return 'bg-secondary';
        default:
            return 'bg-secondary';
    }
}

// Lấy văn bản cho trạng thái giải đấu
function getTournamentStatusText(status) {
    switch (status) {
        case 'registration':
            return 'Đang mở đăng ký';
        case 'in_progress':
            return 'Đang diễn ra';
        case 'completed':
            return 'Đã kết thúc';
        default:
            return 'Không xác định';
    }
}

// Bắt đầu giải đấu
function startTournament(tournamentId) {
    $.ajax({
        url: `/api/game/tournaments/${tournamentId}/start/`,
        method: 'POST',
        headers: {
            'X-CSRFToken': getCookie('csrftoken')
        },
        success: function(response) {
            // Hiển thị thông báo
            alert('Giải đấu đã bắt đầu thành công!');

            // Tải lại thông tin giải đấu
            viewTournamentDetail(tournamentId);
        },
        error: function(error) {
            console.error('Lỗi khi bắt đầu giải đấu:', error);

            if (error.responseJSON && error.responseJSON.error) {
                alert(error.responseJSON.error);
            } else {
                alert('Đã xảy ra lỗi khi bắt đầu giải đấu.');
            }
        }
    });
}

// Thiết lập sự kiện cho giải đấu
function setupTournamentEvents() {
    // Nút tạo giải đấu
    $('#create-tournament-btn').on('click', function() {
        $('#create-tournament-modal').modal('show');
    });

    // Nút tìm giải đấu
    $('#join-tournament-btn').on('click', function() {
        // Tải lại danh sách giải đấu
        loadActiveTournaments();
    });

    // Gửi form tạo giải đấu
    $('#create-tournament-submit').on('click', function() {
        createTournament();
    });
}

// Tạo giải đấu mới
function createTournament() {
    const name = $('#tournament-name').val();
    const description = $('#tournament-description').val();
    const maxPlayers = $('#tournament-max-players').val();
    const maxScore = $('#tournament-max-score').val();
    const enablePowerups = $('#tournament-enable-powerups').prop('checked');

    // Kiểm tra dữ liệu
    if (!name) {
        alert('Vui lòng nhập tên giải đấu.');
        return;
    }

    // Tạo giải đấu
    $.ajax({
        url: '/api/game/tournaments/',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        data: JSON.stringify({
            name: name,
            description: description,
            max_players: maxPlayers,
            max_score: maxScore,
            enable_powerups: enablePowerups
        }),
        success: function(tournament) {
            // Đóng modal
            $('#create-tournament-modal').modal('hide');

            // Xóa form
            $('#create-tournament-form')[0].reset();

            // Hiển thị thông báo
            alert('Tạo giải đấu thành công!');

            // Chuyển đến trang chi tiết giải đấu
            window.location.hash = `tournament/${tournament.id}`;
        },
        error: function(error) {
            console.error('Lỗi khi tạo giải đấu:', error);
            alert('Đã xảy ra lỗi khi tạo giải đấu.');
        }
    });
}