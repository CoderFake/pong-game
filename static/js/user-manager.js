/**
 * File: static/js/user-manager.js
 * Mô tả: Quản lý thông tin người dùng, bạn bè và hồ sơ
 */

function initUserManager(user) {
    // Tải thông tin người dùng
    loadUserProfile();

    // Tải danh sách bạn bè
    loadFriendsList();

    // Tải lời mời kết bạn
    loadFriendRequests();

    // Thiết lập sự kiện
    setupUserEvents();
}

// Tải thông tin hồ sơ cá nhân
function loadUserProfile() {
    $.ajax({
        url: '/api/users/me/',
        method: 'GET',
        success: function(user) {
            // Cập nhật thông tin cơ bản
            $('#profile-display-name').text(user.display_name || user.username);
            $('#profile-username').text('@' + user.username);
            $('#profile-wins').text(user.wins);
            $('#profile-losses').text(user.losses);
            $('#profile-win-rate').text(user.win_rate + '%');

            if (user.avatar) {
                $('#user-avatar').attr('src', user.avatar);
            }

            // Tải lịch sử trận đấu
            loadMatchHistory();
        },
        error: function(error) {
            console.error('Lỗi khi tải thông tin người dùng:', error);
        }
    });
}

// Tải lịch sử trận đấu
function loadMatchHistory() {
    $.ajax({
        url: '/api/users/match-history/',
        method: 'GET',
        success: function(matches) {
            const matchHistory = $('#match-history');
            matchHistory.empty();

            if (matches.length > 0) {
                const matchesTable = $(`
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Ngày</th>
                                <th>Đối thủ</th>
                                <th>Điểm số</th>
                                <th>Kết quả</th>
                            </tr>
                        </thead>
                        <tbody id="matches-tbody">
                        </tbody>
                    </table>
                `);

                matchHistory.append(matchesTable);

                const matchesTbody = $('#matches-tbody');

                matches.forEach(match => {
                    // Xác định người chơi và đối thủ
                    const isPlayer1 = match.player1.id === userId;
                    const opponent = isPlayer1 ? match.player2 : match.player1;
                    const userScore = isPlayer1 ? match.player1_score : match.player2_score;
                    const opponentScore = isPlayer1 ? match.player2_score : match.player1_score;

                    // Xác định kết quả
                    let result = 'Hòa';
                    let resultClass = 'text-warning';

                    if (userScore > opponentScore) {
                        result = 'Thắng';
                        resultClass = 'text-success';
                    } else if (userScore < opponentScore) {
                        result = 'Thua';
                        resultClass = 'text-danger';
                    }

                    // Định dạng ngày
                    const matchDate = new Date(match.created_at);
                    const dateString = matchDate.toLocaleDateString('vi-VN');

                    const matchRow = $(`
                        <tr>
                            <td>${dateString}</td>
                            <td>${opponent.display_name || opponent.username}</td>
                            <td>${userScore} - ${opponentScore}</td>
                            <td class="${resultClass}">${result}</td>
                        </tr>
                    `);

                    matchesTbody.append(matchRow);
                });
            } else {
                matchHistory.html('<p class="text-center">Bạn chưa có trận đấu nào.</p>');
            }
        },
        error: function(error) {
            console.error('Lỗi khi tải lịch sử trận đấu:', error);
            $('#match-history').html('<p class="text-center text-danger">Không thể tải lịch sử trận đấu.</p>');
        }
    });
}

// Tải danh sách bạn bè
function loadFriendsList() {
    $.ajax({
        url: '/api/users/friends/',
        method: 'GET',
        success: function(friends) {
            const friendsList = $('#friends-list');
            friendsList.empty();

            if (friends.length > 0) {
                friends.forEach(friend => {
                    const item = $(`
                        <div class="d-flex align-items-center mb-3">
                            <div class="me-3">
                                <img src="${friend.avatar || '/media/avatars/default.png'}" class="user-avatar" alt="${friend.display_name}">
                            </div>
                            <div class="flex-grow-1">
                                <h5 class="mb-0">
                                    <span class="online-status ${friend.is_online ? 'status-online' : 'status-offline'}"></span>
                                    ${friend.display_name || friend.username}
                                </h5>
                                <small>@${friend.username}</small>
                            </div>
                            <div>
                                <div class="dropdown">
                                    <button class="btn btn-sm btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown">
                                        Tùy chọn
                                    </button>
                                    <ul class="dropdown-menu dropdown-menu-end">
                                        <li><a class="dropdown-item view-profile" href="#" data-username="${friend.username}">Xem hồ sơ</a></li>
                                        <li><a class="dropdown-item send-message" href="#" data-id="${friend.id}" data-username="${friend.username}">Gửi tin nhắn</a></li>
                                        <li><a class="dropdown-item invite-friend-game" href="#" data-id="${friend.id}" data-username="${friend.username}">Mời chơi game</a></li>
                                        <li><hr class="dropdown-divider"></li>
                                        <li><a class="dropdown-item text-danger remove-friend" href="#" data-id="${friend.id}">Xóa bạn</a></li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    `);

                    friendsList.append(item);
                });

                // Sự kiện cho các nút
                $('.view-profile').on('click', function(e) {
                    e.preventDefault();
                    const username = $(this).data('username');
                    window.location.hash = `profile/${username}`;
                });

                $('.send-message').on('click', function(e) {
                    e.preventDefault();
                    const username = $(this).data('username');
                    window.location.hash = `chat/${username}`;
                });

                $('.invite-friend-game').on('click', function(e) {
                    e.preventDefault();
                    const friendId = $(this).data('id');
                    const username = $(this).data('username');

                    // Lưu thông tin bạn được mời
                    currentInviteFriend = {
                        id: friendId,
                        username: username
                    };

                    // Hiển thị modal mời chơi game
                    $('#invite-game-modal').modal('show');
                });

                $('.remove-friend').on('click', function(e) {
                    e.preventDefault();
                    const friendId = $(this).data('id');

                    if (confirm('Bạn có chắc chắn muốn xóa bạn bè này?')) {
                        removeFriend(friendId);
                    }
                });
            } else {
                friendsList.html('<p class="text-center">Bạn chưa có bạn bè nào. Hãy tìm kiếm và thêm bạn bè.</p>');
            }
        },
        error: function(error) {
            console.error('Lỗi khi tải danh sách bạn bè:', error);
            $('#friends-list').html('<p class="text-center text-danger">Không thể tải danh sách bạn bè.</p>');
        }
    });
}

// Tải lời mời kết bạn
function loadFriendRequests() {
    $.ajax({
        url: '/api/users/friendships/',
        method: 'GET',
        success: function(friendships) {
            const friendRequests = $('#friend-requests');
            friendRequests.empty();

            // Lọc ra các lời mời đang chờ
            const pendingRequests = friendships.filter(fr => fr.status === 'pending' && fr.to_user.id === userId);

            if (pendingRequests.length > 0) {
                pendingRequests.forEach(request => {
                    const requestItem = $(`
                        <div class="friend-request">
                            <div class="d-flex align-items-center mb-2">
                                <div class="me-2">
                                    <img src="${request.from_user.avatar || '/media/avatars/default.png'}" class="user-avatar" style="width: 30px; height: 30px;" alt="${request.from_user.display_name}">
                                </div>
                                <div class="flex-grow-1">
                                    <strong>${request.from_user.display_name || request.from_user.username}</strong> đã gửi lời mời kết bạn cho bạn.
                                </div>
                            </div>
                            <div class="d-flex">
                                <button class="btn btn-sm btn-success me-2 accept-request" data-id="${request.id}">Chấp nhận</button>
                                <button class="btn btn-sm btn-outline-danger reject-request" data-id="${request.id}">Từ chối</button>
                            </div>
                        </div>
                    `);

                    friendRequests.append(requestItem);
                });

                // Sự kiện cho nút chấp nhận/từ chối
                $('.accept-request').on('click', function() {
                    const requestId = $(this).data('id');
                    acceptFriendRequest(requestId);
                });

                $('.reject-request').on('click', function() {
                    const requestId = $(this).data('id');
                    rejectFriendRequest(requestId);
                });
            } else {
                friendRequests.html('<p class="text-center">Không có lời mời kết bạn mới.</p>');
            }
        },
        error: function(error) {
            console.error('Lỗi khi tải lời mời kết bạn:', error);
            $('#friend-requests').html('<p class="text-center text-danger">Không thể tải lời mời kết bạn.</p>');
        }
    });
}

// Chấp nhận lời mời kết bạn
function acceptFriendRequest(requestId) {
    $.ajax({
        url: `/api/users/accept-friend-request/${requestId}/`,
        method: 'POST',
        headers: {
            'X-CSRFToken': getCookie('csrftoken')
        },
        success: function(response) {
            // Tải lại danh sách bạn bè và lời mời
            loadFriendsList();
            loadFriendRequests();

            // Thông báo
            alert('Đã chấp nhận lời mời kết bạn.');
        },
        error: function(error) {
            console.error('Lỗi khi chấp nhận lời mời kết bạn:', error);
            alert('Đã xảy ra lỗi khi chấp nhận lời mời kết bạn.');
        }
    });
}

// Từ chối lời mời kết bạn
function rejectFriendRequest(requestId) {
    $.ajax({
        url: `/api/users/reject-friend-request/${requestId}/`,
        method: 'POST',
        headers: {
            'X-CSRFToken': getCookie('csrftoken')
        },
        success: function(response) {
            // Tải lại lời mời
            loadFriendRequests();

            // Thông báo
            alert('Đã từ chối lời mời kết bạn.');
        },
        error: function(error) {
            console.error('Lỗi khi từ chối lời mời kết bạn:', error);
            alert('Đã xảy ra lỗi khi từ chối lời mời kết bạn.');
        }
    });
}

// Xóa bạn bè
function removeFriend(friendId) {
    // Tìm friendship id dựa vào friendId
    $.ajax({
        url: '/api/users/friendships/',
        method: 'GET',
        success: function(friendships) {
            // Tìm friendship giữa user hiện tại và friend
            const friendship = friendships.find(fs =>
                (fs.from_user.id === userId && fs.to_user.id === friendId) ||
                (fs.from_user.id === friendId && fs.to_user.id === userId)
            );

            if (friendship) {
                // Xóa friendship
                $.ajax({
                    url: `/api/users/friendships/${friendship.id}/`,
                    method: 'DELETE',
                    headers: {
                        'X-CSRFToken': getCookie('csrftoken')
                    },
                    success: function() {
                        // Tải lại danh sách bạn bè
                        loadFriendsList();

                        // Thông báo
                        alert('Đã xóa bạn bè thành công.');
                    },
                    error: function(error) {
                        console.error('Lỗi khi xóa bạn bè:', error);
                        alert('Đã xảy ra lỗi khi xóa bạn bè.');
                    }
                });
            } else {
                alert('Không tìm thấy thông tin bạn bè.');
            }
        },
        error: function(error) {
            console.error('Lỗi khi tải thông tin bạn bè:', error);
            alert('Đã xảy ra lỗi khi xóa bạn bè.');
        }
    });
}

// Tìm kiếm người dùng
function searchUsers() {
    const searchTerm = $('#search-username').val().trim();

    if (!searchTerm) {
        $('#search-results').html('<p class="text-center">Nhập tên người dùng để tìm kiếm.</p>');
        return;
    }

    // Hiển thị đang tải
    $('#search-results').html(`
        <div class="text-center py-3">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Đang tìm kiếm...</span>
            </div>
        </div>
    `);

    // Gửi yêu cầu tìm kiếm
    $.ajax({
        url: '/api/users/search/',
        method: 'GET',
        data: {
            username: searchTerm
        },
        success: function(users) {
            const searchResults = $('#search-results');
            searchResults.empty();

            if (users.length > 0) {
                users.forEach(user => {
                    // Bỏ qua người dùng hiện tại
                    if (user.id === userId) return;

                    const userItem = $(`
                        <div class="d-flex align-items-center mb-3">
                            <div class="me-3">
                                <img src="${user.avatar || '/media/avatars/default.png'}" class="user-avatar" style="width: 40px; height: 40px;" alt="${user.display_name}">
                            </div>
                            <div class="flex-grow-1">
                                <h6 class="mb-0">${user.display_name || user.username}</h6>
                                <small>@${user.username}</small>
                            </div>
                            <div>
                                <button class="btn btn-sm btn-primary add-friend" data-id="${user.id}">Thêm bạn</button>
                            </div>
                        </div>
                    `);

                    searchResults.append(userItem);
                });

                // Sự kiện thêm bạn
                $('.add-friend').on('click', function() {
                    const userId = $(this).data('id');
                    sendFriendRequest(userId);
                });
            } else {
                searchResults.html('<p class="text-center">Không tìm thấy người dùng phù hợp.</p>');
            }
        },
        error: function(error) {
            console.error('Lỗi khi tìm kiếm người dùng:', error);
            $('#search-results').html('<p class="text-center text-danger">Đã xảy ra lỗi khi tìm kiếm.</p>');
        }
    });
}

// Gửi lời mời kết bạn
function sendFriendRequest(toUserId) {
    $.ajax({
        url: '/api/users/friendships/',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        data: JSON.stringify({
            to_user_id: toUserId
        }),
        success: function(response) {
            // Thông báo thành công
            alert('Đã gửi lời mời kết bạn thành công.');

            // Cập nhật nút
            $(`button.add-friend[data-id="${toUserId}"]`)
                .text('Đã gửi lời mời')
                .removeClass('btn-primary')
                .addClass('btn-outline-secondary')
                .prop('disabled', true);
        },
        error: function(error) {
            console.error('Lỗi khi gửi lời mời kết bạn:', error);

            if (error.responseJSON && error.responseJSON.to_user_id) {
                alert(error.responseJSON.to_user_id[0]);
            } else {
                alert('Đã xảy ra lỗi khi gửi lời mời kết bạn.');
            }
        }
    });
}

// Cập nhật hồ sơ
function updateProfile() {
    const displayName = $('#edit-display-name').val();
    const formData = new FormData();

    // Thêm thông tin vào form data
    formData.append('display_name', displayName);

    // Thêm avatar nếu có
    const avatarFile = document.getElementById('avatar-upload').files[0];
    if (avatarFile) {
        formData.append('avatar', avatarFile);
    }

    // Gửi yêu cầu cập nhật
    $.ajax({
        url: '/api/users/me/',
        method: 'PATCH',
        processData: false,
        contentType: false,
        headers: {
            'X-CSRFToken': getCookie('csrftoken')
        },
        data: formData,
        success: function(user) {
            // Cập nhật giao diện
            $('#profile-display-name').text(user.display_name || user.username);
            if (user.avatar) {
                $('#user-avatar').attr('src', user.avatar);
            }

            // Đóng modal
            $('#edit-profile-modal').modal('hide');

            // Thông báo
            alert('Cập nhật hồ sơ thành công.');
        },
        error: function(error) {
            console.error('Lỗi khi cập nhật hồ sơ:', error);
            alert('Đã xảy ra lỗi khi cập nhật hồ sơ.');
        }
    });
}

// Hiển thị hồ sơ người dùng khác
function renderUserProfile(user) {
    // Tạo hồ sơ HTML
    const profileHtml = `
        <div class="container">
            <div class="row">
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-body text-center">
                            <img src="${user.avatar || '/media/avatars/default.png'}" alt="${user.display_name}" class="rounded-circle" style="width: 150px; height: 150px; object-fit: cover;">
                            <h4 class="mt-3">${user.display_name || user.username}</h4>
                            <p>@${user.username}</p>
                            <div>
                                <button class="btn btn-primary send-message-btn" data-id="${user.id}" data-username="${user.username}">Gửi tin nhắn</button>
                                <button class="btn btn-outline-primary invite-game-btn" data-id="${user.id}" data-username="${user.username}">Mời chơi game</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-8">
                    <div class="card mb-3">
                        <div class="card-body">
                            <h5 class="card-title">Thống kê</h5>
                            <div class="row">
                                <div class="col-md-4 text-center">
                                    <h3>${user.wins}</h3>
                                    <p>Thắng</p>
                                </div>
                                <div class="col-md-4 text-center">
                                    <h3>${user.losses}</h3>
                                    <p>Thua</p>
                                </div>
                                <div class="col-md-4 text-center">
                                    <h3>${user.win_rate}%</h3>
                                    <p>Tỉ lệ thắng</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">Lịch sử trận đấu gần đây</h5>
                            <div id="user-match-history">
                                <div class="text-center py-3">
                                    <div class="spinner-border text-primary" role="status">
                                        <span class="visually-hidden">Đang tải...</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Thêm vào trang
    $('#user-profile').html(profileHtml);

    // Tải lịch sử trận đấu của người dùng
    loadUserMatchHistory(user.id);

    // Sự kiện cho các nút
    $('.send-message-btn').on('click', function() {
        const username = $(this).data('username');
        window.location.hash = `chat/${username}`;
    });

    $('.invite-game-btn').on('click', function() {
        const userId = $(this).data('id');
        const username = $(this).data('username');

        // Lưu thông tin bạn được mời
        currentInviteFriend = {
            id: userId,
            username: username
        };

        // Hiển thị modal mời chơi game
        $('#invite-game-modal').modal('show');
    });
}

// Tải lịch sử trận đấu của người dùng khác
function loadUserMatchHistory(userId) {
    $.ajax({
        url: `/api/users/${userId}/match-history/`,
        method: 'GET',
        success: function(matches) {
            const matchHistory = $('#user-match-history');
            matchHistory.empty();

            if (matches.length > 0) {
                const matchesTable = $(`
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Ngày</th>
                                <th>Đối thủ</th>
                                <th>Điểm số</th>
                                <th>Kết quả</th>
                            </tr>
                        </thead>
                        <tbody id="user-matches-tbody">
                        </tbody>
                    </table>
                `);

                matchHistory.append(matchesTable);

                const matchesTbody = $('#user-matches-tbody');

                // Hiển thị tối đa 5 trận gần nhất
                const recentMatches = matches.slice(0, 5);

                recentMatches.forEach(match => {
                    // Xác định người chơi và đối thủ
                    const isPlayer1 = match.player1.id === userId;
                    const opponent = isPlayer1 ? match.player2 : match.player1;
                    const userScore = isPlayer1 ? match.player1_score : match.player2_score;
                    const opponentScore = isPlayer1 ? match.player2_score : match.player1_score;

                    // Xác định kết quả
                    let result = 'Hòa';
                    let resultClass = 'text-warning';

                    if (userScore > opponentScore) {
                        result = 'Thắng';
                        resultClass = 'text-success';
                    } else if (userScore < opponentScore) {
                        result = 'Thua';
                        resultClass = 'text-danger';
                    }

                    // Định dạng ngày
                    const matchDate = new Date(match.created_at);
                    const dateString = matchDate.toLocaleDateString('vi-VN');

                    const matchRow = $(`
                        <tr>
                            <td>${dateString}</td>
                            <td>${opponent.display_name || opponent.username}</td>
                            <td>${userScore} - ${opponentScore}</td>
                            <td class="${resultClass}">${result}</td>
                        </tr>
                    `);

                    matchesTbody.append(matchRow);
                });
            } else {
                matchHistory.html('<p class="text-center">Chưa có trận đấu nào.</p>');
            }
        },
        error: function(error) {
            console.error('Lỗi khi tải lịch sử trận đấu:', error);
            $('#user-match-history').html('<p class="text-center text-danger">Không thể tải lịch sử trận đấu.</p>');
        }
    });
}

// Thiết lập sự kiện cho người dùng
function setupUserEvents() {
    // Sự kiện tìm kiếm người dùng
    $('#search-user-btn').on('click', function() {
        searchUsers();
    });

    $('#search-username').on('keypress', function(e) {
        if (e.which === 13) {
            searchUsers();
            return false;
        }
    });

    // Sự kiện làm mới danh sách bạn bè
    $('#refresh-friends-btn').on('click', function() {
        loadFriendsList();
    });

    // Sự kiện chỉnh sửa hồ sơ
    $('#edit-profile-btn').on('click', function() {
        // Tải thông tin hiện tại
        $.ajax({
            url: '/api/users/me/',
            method: 'GET',
            success: function(user) {
                $('#edit-display-name').val(user.display_name || user.username);
                if (user.avatar) {
                    $('#avatar-preview').attr('src', user.avatar);
                }

                // Hiển thị modal
                $('#edit-profile-modal').modal('show');
            },
            error: function(error) {
                console.error('Lỗi khi tải thông tin người dùng:', error);
                alert('Đã xảy ra lỗi khi tải thông tin hồ sơ.');
            }
        });
    });

    // Sự kiện xem trước avatar
    $('#avatar-upload').on('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                $('#avatar-preview').attr('src', e.target.result);
            }
            reader.readAsDataURL(file);
        }
    });

    // Sự kiện lưu hồ sơ
    $('#save-profile-btn').on('click', function() {
        updateProfile();
    });
}